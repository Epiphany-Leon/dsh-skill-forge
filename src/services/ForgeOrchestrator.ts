/**
 * ForgeOrchestrator —— 锻造编排器
 *
 * 协调整个锻造流水线。通过构造函数注入依赖，不访问 ctx 上的自定义属性。
 */

import {
  ForgeRunStatus,
  TriggerMode,
  FailureCode,
  type ForgeRun,
  type FailureReason,
  type SkillForgeConfig,
  type GeneratedSkill,
} from '../types.js'
import type { RefineChangeSummary } from '../agents/RefinerAgent.js'

/** 锻造依赖的子服务 */
export interface ForgeDeps {
  registry: any
  auditor: any
  extractor: any
  generator: any
  verifier: any
  refiner: any
  trigger: any
}

export class ForgeOrchestrator {
  protected ctx: any
  protected config: SkillForgeConfig
  protected logger: any
  private deps: ForgeDeps
  private runs: Map<string, ForgeRun> = new Map()
  private runsStoragePath: string = ''
  private saveTimeout: any = null
  /** 运行时统计（与 runs 一起持久化） */
  private runStats: {
    injectionCount: number
    intentAwareHits: number
    totalSkillInjections: number
  } = {
    injectionCount: 0,
    intentAwareHits: 0,
    totalSkillInjections: 0,
  }

  constructor(ctx: any, config: SkillForgeConfig, deps: ForgeDeps) {
    this.ctx = ctx
    this.config = config
    this.logger = ctx.logger?.child?.('skill-forge') || console
    this.deps = deps
  }

  /** 初始化：加载历史 runs */
  async initialize(storagePath: string): Promise<void> {
    this.runsStoragePath = `${storagePath}/forge-runs.json`
    try {
      const fs = await import('node:fs/promises')
      try {
        const raw = await fs.readFile(this.runsStoragePath, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data)) {
          // 旧格式：纯数组
          for (const run of data) {
            this.runs.set(run.id, run)
          }
          this.log('info', `Loaded ${data.length} historical forge runs from disk (legacy format)`)
        } else if (data && typeof data === 'object') {
          // 新格式：{ runs: [], stats: {} }
          if (Array.isArray(data.runs)) {
            for (const run of data.runs) {
              this.runs.set(run.id, run)
            }
          }
          if (data.stats) {
            this.runStats.injectionCount = data.stats.injectionCount || 0
            this.runStats.intentAwareHits = data.stats.intentAwareHits || 0
            this.runStats.totalSkillInjections = data.stats.totalSkillInjections || 0
          }
          this.log('info', `Loaded ${this.runs.size} historical forge runs from disk`)
        }
      } catch {
        // 文件不存在，正常
      }
    } catch (err) {
      this.log('warn', `Failed to load runs: ${(err as Error).message}`)
    }
  }

  /** 保存 runs 到磁盘（防抖） */
  private saveRuns(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(async () => {
      try {
        const fs = await import('node:fs/promises')
        // 只保留最近 50 条，避免文件太大
        const all = Array.from(this.runs.values())
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 50)
        const payload = {
          runs: all,
          stats: { ...this.runStats },
          _version: 2,
        }
        await fs.writeFile(this.runsStoragePath, JSON.stringify(payload, null, 2), 'utf-8')
      } catch (err) {
        this.log('warn', `Failed to save runs: ${(err as Error).message}`)
      }
    }, 500)
  }

  // ---- 对外接口 ----

  async startManualForge(reason: string): Promise<{ runId: string; status: ForgeRunStatus }> {
    const runId = this.genId()
    const run: ForgeRun = {
      id: runId,
      status: ForgeRunStatus.CREATED,
      triggerMode: TriggerMode.MANUAL,
      sourceSessionIds: ['manual'],
      sourceSummary: reason,
      currentIteration: 0,
      maxIterations: this.config.maxIterations,
      iterationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.runs.set(runId, run)
    this.log('info', `Manual forge started: ${runId}`)
    this.executePipeline(runId).catch(e => this.log('error', `Pipeline failed: ${e.message}`))
    return { runId, status: ForgeRunStatus.CREATED }
  }

  async startAutoForge(sessionIds: string[], summary: string): Promise<string | null> {
    if (!this.config.autoTrigger) return null
    const runId = this.genId()
    const run: ForgeRun = {
      id: runId,
      status: ForgeRunStatus.CREATED,
      triggerMode: TriggerMode.AUTO,
      sourceSessionIds: sessionIds,
      sourceSummary: summary,
      currentIteration: 0,
      maxIterations: this.config.maxIterations,
      iterationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.runs.set(runId, run)
    this.executePipeline(runId).catch(e => this.log('error', `Auto pipeline failed: ${e.message}`))
    return runId
  }

  async approveSkill(runId: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run || run.status !== ForgeRunStatus.PENDING_APPROVAL) return false
    try {
      const skillId = await this.deps.registry.activateForgedSkill(run)
      this.setStatus(runId, ForgeRunStatus.ACTIVE)
      run.completedAt = Date.now()
      this.emit('skill-forge/completed', { runId, skillId })
      return true
    } catch (e) {
      this.log('error', `Approve failed: ${(e as Error).message}`)
      return false
    }
  }

  async rejectSkill(runId: string, reasons: string[], customText?: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run || run.status !== ForgeRunStatus.PENDING_APPROVAL) return false
    run.rejectionReason = { presetReasons: reasons, customText, timestamp: Date.now() }
    this.setStatus(runId, ForgeRunStatus.REJECTED)
    run.completedAt = Date.now()
    return true
  }

  async cancelForge(runId: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false
    const active = ['created', 'triggering', 'extracting', 'generating', 'verifying', 'iterating', 'auditing']
    if (!active.includes(run.status)) return false
    this.setStatus(runId, ForgeRunStatus.CANCELLED)
    run.completedAt = Date.now()
    return true
  }

  async retryRun(runId: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false
    run.status = ForgeRunStatus.CREATED
    run.failureReason = undefined
    run.currentIteration = 0
    run.iterationHistory = []
    run.updatedAt = Date.now()
    this.executePipeline(runId).catch(e => this.log('error', `Retry failed: ${e.message}`))
    return true
  }

  /**
   * 基于已有技能重新锻造（reforge）
   * 以现有技能的 body 和 frontmatter 为起点，走完整锻造流水线的精炼迭代。
   */
  async reforgeSkill(skillId: string, reason?: string): Promise<{ runId: string; status: ForgeRunStatus } | null> {
    const skill = this.deps.registry.getSkill(skillId)
    if (!skill) return null

    const runId = this.genId()
    const run: ForgeRun = {
      id: runId,
      status: ForgeRunStatus.CREATED,
      triggerMode: TriggerMode.MANUAL,
      sourceSessionIds: ['reforge'],
      sourceSummary: reason || `Reforge based on skill: ${skill.frontmatter.name}`,
      currentIteration: 0,
      maxIterations: this.config.maxIterations,
      iterationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // 以当前技能内容作为生成起点
      generatedSkill: {
        frontmatter: { ...skill.frontmatter },
        body: skill.body,
        qualityScore: skill.verificationScore,
      },
    }
    this.runs.set(runId, run)
    this.log('info', `Reforge started for skill ${skill.frontmatter.name}: ${runId}`)
    // 跳过提取阶段，直接从验证/迭代开始
    this.executeReforgePipeline(runId).catch(e => this.log('error', `Reforge pipeline failed: ${e.message}`))
    return { runId, status: ForgeRunStatus.CREATED }
  }

  getRun(runId: string): ForgeRun | undefined { return this.runs.get(runId) }
  listRuns(limit = 20): ForgeRun[] {
    return Array.from(this.runs.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
  }

  /** 记录一次注入 */
  recordInjection(skillCount: number, isIntentAware: boolean): void {
    this.runStats.injectionCount++
    this.runStats.totalSkillInjections += skillCount
    if (isIntentAware) {
      this.runStats.intentAwareHits++
    }
    this.saveRuns()
  }

  /** 获取持久化的注入统计 */
  getInjectionStats(): { totalInjections: number; intentAwareHits: number; totalSkillInjections: number; smartInjectionRatio: number } {
    const { injectionCount, intentAwareHits, totalSkillInjections } = this.runStats
    const smartInjectionRatio = injectionCount > 0 ? intentAwareHits / injectionCount : 0
    return {
      totalInjections: injectionCount,
      intentAwareHits,
      totalSkillInjections,
      smartInjectionRatio,
    }
  }

  // ---- 内部：流水线 ----

  private async executePipeline(runId: string): Promise<void> {
    const run = this.runs.get(runId)!
    try {
      // Gate 0: Trigger（手动跳过）
      if (run.triggerMode === TriggerMode.AUTO) {
        this.setStatus(runId, ForgeRunStatus.TRIGGERING)
        const ok = await this.deps.trigger.evaluateForgeWorthiness(run)
        // Gate 0 评估完成后清理会话痕迹（无论通过与否）
        this.deps.trigger.cleanupSessions?.(run.sourceSessionIds)
        if (!ok) { this.setStatus(runId, ForgeRunStatus.TRIGGER_SKIPPED); run.completedAt = Date.now(); return }
      }

      // Gate 1: Extract
      this.setStatus(runId, ForgeRunStatus.EXTRACTING)
      try { run.extractionResult = await this.deps.extractor.extract(run) }
      catch (e) { this.fail(runId, FailureCode.EXTRACTION_LLM_ERROR, 'Extraction failed', (e as Error).message, 1); return }
      // 手动触发的门槛更低（用户主动要求，肯定值得做）
      const gate1Threshold = run.triggerMode === TriggerMode.MANUAL ? 0.1 : this.config.triggerThreshold
      if (!run.extractionResult || run.extractionResult.confidence < gate1Threshold)
      { this.fail(runId, FailureCode.EXTRACTION_SCHEMA_INVALID, 'Confidence too low', `threshold=${gate1Threshold}, actual=${run.extractionResult?.confidence}`, 1); return }

      // Gate 2: Generate
      this.setStatus(runId, ForgeRunStatus.GENERATING)
      try { run.generatedSkill = await this.deps.generator.generate(run) }
      catch (e) { this.fail(runId, FailureCode.GENERATION_LLM_ERROR, 'Generation failed', (e as Error).message, 2); return }

      // Gate 3-4: Verify + Iterate
      this.setStatus(runId, ForgeRunStatus.VERIFYING)
      let skill = run.generatedSkill!
      let vr = await this.deps.verifier.verify(skill, run)
      run.iterationHistory = []
      run.iterationHistory.push({ iteration: 0, score: vr.overallScore, changes: 'initial generation' })

      // 无进步提前终止：连续 2 轮提升 < 0.05 就停止
      const IMPROVEMENT_THRESHOLD = 0.05
      let stagnationCount = 0

      while (!vr.passed && run.currentIteration < run.maxIterations) {
        run.currentIteration++
        this.setStatus(runId, ForgeRunStatus.ITERATING)
        const prevScore = vr.overallScore
        const prevSkill = skill
        try {
          // Step 1: 生成精炼版本 + changeSummary
          const { skill: refinedSkill, changeSummary } =
            await this.deps.refiner.refineWithSummary(prevSkill, vr, run)

          // Step 2: 重新验证
          const newVr = await this.deps.verifier.verify(refinedSkill, run)

          // Step 3: 严格不回退检查（overallScore + 高分维度保护）
          const refineResult = this.deps.refiner.checkNoRegression(
            prevSkill,
            refinedSkill,
            vr,
            newVr,
            changeSummary,
          )

          if (refineResult.rolledBack) {
            this.log('warn',
              `Iteration ${run.currentIteration} rolled back: ${refineResult.changeSummary.rollbackReason}`
            )
            skill = prevSkill
            run.iterationHistory.push({
              iteration: run.currentIteration,
              score: prevScore,
              changes: `回退：${refineResult.changeSummary.rollbackReason || 'score regressed'}`,
            })
            stagnationCount++
          } else {
            const improvement = refineResult.newScore - prevScore
            skill = refineResult.skill
            vr = newVr
            const deltas = (refineResult.changeSummary.dimensionDeltas as RefineChangeSummary['dimensionDeltas'])
              .filter((d): boolean => d.delta > 0)
              .map(d => `${d.name}+${(d.delta * 100).toFixed(0)}%`)
              .join('、')
            const improvedDims = deltas
            run.iterationHistory.push({
              iteration: run.currentIteration,
              score: refineResult.newScore,
              changes: `score +${improvement.toFixed(3)}；${improvedDims || '无维度提升'}；${refineResult.changeSummary.description.slice(0, 80)}`,
            })
            if (improvement < IMPROVEMENT_THRESHOLD) {
              stagnationCount++
            } else {
              stagnationCount = 0
            }
          }

          // 连续 2 轮无明显进步，提前终止
          if (stagnationCount >= 2) {
            this.log('info', `Early stop: ${stagnationCount} consecutive iterations with improvement < ${IMPROVEMENT_THRESHOLD}`)
            break
          }
        } catch (e) {
          this.log('warn', `Iteration ${run.currentIteration} failed: ${(e as Error).message}`)
          skill = prevSkill
          break
        }
      }
      run.verificationResult = vr
      run.generatedSkill = skill
      run.qualityScore = vr.overallScore

      // Gate 5: Audit
      this.setStatus(runId, ForgeRunStatus.AUDITING)
      run.auditResult = await this.deps.auditor.audit(skill, run)
      const audit = run.auditResult!
      if (!audit.passed) {
        this.setStatus(runId, ForgeRunStatus.AUDIT_FAILED)
        run.failureReason = { code: FailureCode.AUDIT_DANGEROUS_PATTERN, message: 'Audit failed', detail: audit.dangers.join(', '), gate: 5 }
        run.completedAt = Date.now()
        this.emit('skill-forge/failed', { runId, reason: run.failureReason })
        return
      }

      // Gate 6: Approve
      const needsApproval = this.needsHumanApproval(run)
      if (needsApproval) {
        this.setStatus(runId, ForgeRunStatus.PENDING_APPROVAL)
      } else {
        const skillId = await this.deps.registry.activateForgedSkill(run)
        this.setStatus(runId, ForgeRunStatus.ACTIVE)
        run.completedAt = Date.now()
        this.emit('skill-forge/completed', { runId, skillId })
      }
    } catch (e) {
      this.fail(runId, 'E999' as any, 'Unexpected error', (e as Error).message, -1)
    }
  }

  /**
   * Reforge 流水线：跳过提取，直接从验证/迭代开始，以现有技能内容为基础。
   */
  private async executeReforgePipeline(runId: string): Promise<void> {
    const run = this.runs.get(runId)!
    try {
      let skill = run.generatedSkill!
      if (!skill) {
        this.fail(runId, 'E202' as any, 'No base skill for reforge', 'generatedSkill is empty', 2)
        return
      }

      // Gate 3-4: Verify + Iterate
      this.setStatus(runId, ForgeRunStatus.VERIFYING)
      let vr = await this.deps.verifier.verify(skill)
      let stagnationCount = 0
      const IMPROVEMENT_THRESHOLD = 0.02

      for (
        run.currentIteration = 1;
        run.currentIteration <= run.maxIterations && !vr.passed && stagnationCount < 2;
        run.currentIteration++
      ) {
        this.setStatus(runId, ForgeRunStatus.ITERATING)
        const prevSkill = skill
        const prevScore = vr.overallScore
        try {
          const changeSummary = `Iteration ${run.currentIteration}: improving weak dimensions`
          const refinedSkill = await this.deps.refiner.refine(prevSkill, vr, changeSummary)
          const newVr = await this.deps.verifier.verify(refinedSkill)

          const refineResult = this.deps.refiner.checkNoRegression(
            prevSkill,
            refinedSkill,
            vr,
            newVr,
            { dimensionDeltas: [], overallDelta: newVr.overallScore - prevScore, rollbackReason: '' },
          )

          if (refineResult.rolledBack) {
            skill = prevSkill
            run.iterationHistory.push({
              iteration: run.currentIteration,
              score: prevScore,
              changes: '回退：质量回退',
            })
            stagnationCount++
          } else {
            const improvement = Math.abs(newVr.overallScore - prevScore)
            skill = refineResult.skill
            vr = newVr
            run.iterationHistory.push({
              iteration: run.currentIteration,
              score: newVr.overallScore,
              changes: `迭代优化，得分 ${(newVr.overallScore * 100).toFixed(0)}%`,
            })
            if (improvement < IMPROVEMENT_THRESHOLD) stagnationCount++
            else stagnationCount = 0
          }

          if (stagnationCount >= 2) break
        } catch {
          skill = prevSkill
          break
        }
      }
      run.verificationResult = vr
      run.generatedSkill = skill

      // Gate 5: Audit
      this.setStatus(runId, ForgeRunStatus.AUDITING)
      run.auditResult = await this.deps.auditor.audit(skill, run)
      const audit = run.auditResult!
      if (!audit.passed) {
        this.setStatus(runId, ForgeRunStatus.AUDIT_FAILED)
        run.failureReason = { code: FailureCode.AUDIT_DANGEROUS_PATTERN, message: 'Audit failed', detail: audit.dangers.join(', '), gate: 5 }
        run.completedAt = Date.now()
        this.emit('skill-forge/failed', { runId, reason: run.failureReason })
        return
      }

      // Gate 6: Approve
      const needsApproval = this.needsHumanApproval(run)
      if (needsApproval) {
        this.setStatus(runId, ForgeRunStatus.PENDING_APPROVAL)
      } else {
        const skillId = await this.deps.registry.activateForgedSkill(run)
        this.setStatus(runId, ForgeRunStatus.ACTIVE)
        run.completedAt = Date.now()
        this.emit('skill-forge/completed', { runId, skillId })
      }
    } catch (e) {
      this.fail(runId, 'E999' as any, 'Unexpected reforge error', (e as Error).message, -1)
    }
  }

  // ---- 辅助 ----

  private setStatus(runId: string, s: ForgeRunStatus) {
    const run = this.runs.get(runId)
    if (!run) return
    const prev = run.status
    run.status = s
    run.updatedAt = Date.now()
    this.saveRuns()
    this.emit('skill-forge/status-changed', { runId, status: s, prevStatus: prev })
  }

  private fail(runId: string, code: any, msg: string, detail: string, gate: number) {
    const run = this.runs.get(runId)
    if (!run) return
    run.status = ForgeRunStatus.FAILED
    run.failureReason = { code, message: msg, detail, gate }
    run.completedAt = Date.now()
    this.emit('skill-forge/failed', { runId, reason: run.failureReason })
  }

  private needsHumanApproval(run: ForgeRun): boolean {
    const passed = run.verificationResult?.passed ?? false
    const hasWarnings = (run.auditResult?.warnings.length ?? 0) > 0
    const hasDangers = (run.auditResult?.dangers.length ?? 0) > 0
    switch (this.config.securityLevel) {
      case 'strict': return true
      case 'normal': return run.triggerMode === TriggerMode.AUTO || !passed || hasWarnings
      case 'permissive': return !passed || hasDangers
      case 'auto': return false
      default: return true
    }
  }

  private emit(event: string, payload: any) {
    this.ctx.emit?.(event, payload)
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', msg: string) {
    const fn = (this.logger as any)[level] || (this.logger as any).info
    fn.call(this.logger, `[ForgeOrchestrator] ${msg}`)
  }

  private genId(): string {
    return `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}
