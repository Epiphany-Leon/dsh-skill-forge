/**
 * ForgeOrchestrator —— 锻造编排器
 *
 * 协调整个锻造流水线。通过构造函数注入依赖，不访问 ctx 上的自定义属性。
 *
 * 流水线阶段（Gate 0-6）：
 *   Gate 0: Trigger（自动触发时评估是否值得锻造）
 *   Gate 1: Extract（从对话提取方法论）
 *   Gate 2: Generate（生成 SKILL.md）
 *   Gate 3-4: Verify + Iterate（多维度验证 + 迭代优化）
 *   Gate 5: Audit（安全审计）
 *   Gate 6: Approve（人工审批 / 自动通过）
 */

import {
  ForgeRunStatus,
  TriggerMode,
  FailureCode,
  type ForgeRun,
  type FailureReason,
  type SkillForgeConfig,
  type GeneratedSkill,
  type VerificationResult,
} from '../types.js'
import type { RefineChangeSummary, RefineResult } from '../agents/RefinerAgent.js'
import { generateId, clamp } from '../utils/helpers.js'
import {
  PERSIST_DEBOUNCE_MS,
  MAX_HISTORICAL_RUNS,
  DEFAULT_VERIFICATION_PASS_THRESHOLD,
} from '../utils/constants.js'
import type { MinimalLogger, DshLogger } from './BaseService.js'

// ============================================================
// 依赖接口（只声明实际用到的方法，减少耦合）
// ============================================================

/** Registry 最小接口 */
export interface ForgeRegistry {
  activateForgedSkill(run: ForgeRun): Promise<string>
  getSkill(skillId: string): { frontmatter: { name: string }; body: string; verificationScore?: number } | null
}

/** Auditor 最小接口 */
export interface ForgeAuditor {
  audit(skill: GeneratedSkill, run: ForgeRun): Promise<{
    passed: boolean
    warnings: string[]
    dangers: string[]
  }>
}

/** Extractor 最小接口 */
export interface ForgeExtractor {
  extract(run: ForgeRun): Promise<{ confidence: number }>
}

/** Generator 最小接口 */
export interface ForgeGenerator {
  generate(run: ForgeRun): Promise<GeneratedSkill>
}

/** Verifier 最小接口 */
export interface ForgeVerifier {
  verify(skill: GeneratedSkill, run?: ForgeRun): Promise<{
    overallScore: number
    passed: boolean
    dimensions: Record<string, number>
  }>
}

/** Refiner 最小接口 */
export interface ForgeRefiner {
  refineWithSummary(
    skill: GeneratedSkill,
    verification: { overallScore: number; passed: boolean; dimensions: Record<string, number>; improvementSuggestions?: string[]; failurePatterns?: Record<string, number> },
    run: ForgeRun,
  ): Promise<{ skill: GeneratedSkill; changeSummary: RefineChangeSummary }>
  checkNoRegression(
    prevSkill: GeneratedSkill,
    newSkill: GeneratedSkill,
    prevVr: { overallScore: number; dimensions: Record<string, number> },
    newVr: { overallScore: number; dimensions: Record<string, number> },
    changeSummary: RefineChangeSummary | { dimensionDeltas: Array<{ name: string; key: string; before: number; after: number; delta: number }>; overallDelta: number; rollbackReason: string },
  ): RefineResult
}

/** Trigger 最小接口 */
export interface ForgeTrigger {
  evaluateForgeWorthiness(run: ForgeRun): Promise<boolean>
  cleanupSessions?(sessionIds: string[]): void
}

/** 锻造依赖的子服务 */
export interface ForgeDeps {
  registry: ForgeRegistry
  auditor: ForgeAuditor
  extractor: ForgeExtractor
  generator: ForgeGenerator
  verifier: ForgeVerifier
  refiner: ForgeRefiner
  trigger: ForgeTrigger
}

/** 注入统计数据结构 */
export interface InjectionStats {
  totalInjections: number
  intentAwareHits: number
  totalSkillInjections: number
  smartInjectionRatio: number
}

// ============================================================
// 常量
// ============================================================

/** 连续 N 轮无明显进步则提前终止迭代 */
const STAGNATION_LIMIT = 2
/** 有进步阈值（正常锻造流水线） */
const IMPROVEMENT_THRESHOLD = 0.05
/** 有进步阈值（reforge 流水线） */
const REFORGE_IMPROVEMENT_THRESHOLD = 0.02
/** 活跃状态集合（可被取消的状态） */
const ACTIVE_STATUSES = new Set([
  ForgeRunStatus.CREATED,
  ForgeRunStatus.TRIGGERING,
  ForgeRunStatus.EXTRACTING,
  ForgeRunStatus.GENERATING,
  ForgeRunStatus.VERIFYING,
  ForgeRunStatus.ITERATING,
  ForgeRunStatus.AUDITING,
])

// ============================================================
// ForgeOrchestrator
// ============================================================

export class ForgeOrchestrator {
  /** DSH 上下文（保持 unknown，只通过类型守卫访问已知属性） */
  protected ctx: unknown
  protected config: SkillForgeConfig
  protected logger: MinimalLogger
  private deps: ForgeDeps
  private runs: Map<string, ForgeRun> = new Map()
  private runsStoragePath = ''
  private saveTimeout: ReturnType<typeof setTimeout> | null = null
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

  constructor(ctx: unknown, config: SkillForgeConfig, deps: ForgeDeps) {
    this.ctx = ctx
    this.config = config
    const ctxAsRecord = ctx as { logger?: DshLogger }
    const baseLogger = ctxAsRecord.logger
    this.logger = baseLogger?.child?.('skill-forge') ?? baseLogger ?? console as unknown as MinimalLogger
    this.deps = deps
  }

  /**
   * 初始化：从磁盘加载历史 runs。
   * 兼容两种存储格式：
   * - 旧格式：纯数组 [run1, run2, ...]
   * - 新格式：{ runs: [...], stats: {...}, _version: 2 }
   */
  async initialize(storagePath: string): Promise<void> {
    this.runsStoragePath = `${storagePath}/forge-runs.json`
    try {
      const fs = await import('node:fs/promises')
      try {
        const raw = await fs.readFile(this.runsStoragePath, 'utf-8')
        const data = JSON.parse(raw) as
          | ForgeRun[]
          | { runs?: ForgeRun[]; stats?: { injectionCount?: number; intentAwareHits?: number; totalSkillInjections?: number } }
        if (Array.isArray(data)) {
          // 旧格式：纯数组
          for (const run of data) {
            this.runs.set(run.id, run)
          }
          this.log('info', `Loaded ${data.length} historical forge runs from disk (legacy format)`)
        } else if (data && typeof data === 'object') {
          // 新格式
          if (Array.isArray(data.runs)) {
            for (const run of data.runs) {
              this.runs.set(run.id, run)
            }
          }
          if (data.stats) {
            this.runStats.injectionCount = data.stats.injectionCount ?? 0
            this.runStats.intentAwareHits = data.stats.intentAwareHits ?? 0
            this.runStats.totalSkillInjections = data.stats.totalSkillInjections ?? 0
          }
          this.log('info', `Loaded ${this.runs.size} historical forge runs from disk`)
        }
      } catch {
        // 文件不存在，首次运行，正常
      }
    } catch (err) {
      this.log('warn', `Failed to load runs: ${(err as Error).message}`)
    }
  }

  // ==========================================================
  // 对外接口
  // ==========================================================

  /**
   * 手动触发锻造。
   * 返回 runId 和初始状态，流水线在后台异步执行。
   */
  async startManualForge(reason: string): Promise<{ runId: string; status: ForgeRunStatus }> {
    const runId = this.genId()
    const run = this.createRun(runId, TriggerMode.MANUAL, ['manual'], reason)
    this.runs.set(runId, run)
    this.log('info', `Manual forge started: ${runId}`)
    this.executePipeline(runId).catch(e => this.log('error', `Pipeline failed: ${e.message}`))
    return { runId, status: ForgeRunStatus.CREATED }
  }

  /**
   * 自动触发锻造（由 TriggerEngine 调用）。
   * 若 autoTrigger 配置为 false 则返回 null。
   */
  async startAutoForge(sessionIds: string[], summary: string): Promise<string | null> {
    if (!this.config.autoTrigger) return null
    const runId = this.genId()
    const run = this.createRun(runId, TriggerMode.AUTO, sessionIds, summary)
    this.runs.set(runId, run)
    this.executePipeline(runId).catch(e => this.log('error', `Auto pipeline failed: ${e.message}`))
    return runId
  }

  /**
   * 批准待审核的技能，激活并注册到 DSH。
   */
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

  /**
   * 拒绝待审核的技能。
   */
  async rejectSkill(runId: string, reasons: string[], customText?: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run || run.status !== ForgeRunStatus.PENDING_APPROVAL) return false
    const rejection = { presetReasons: reasons, timestamp: Date.now() } as { presetReasons: string[]; customText?: string; timestamp: number }
    if (customText !== undefined) rejection.customText = customText
    run.rejectionReason = rejection
    this.setStatus(runId, ForgeRunStatus.REJECTED)
    run.completedAt = Date.now()
    return true
  }

  /**
   * 取消正在进行中的锻造任务。
   */
  async cancelForge(runId: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false
    if (!ACTIVE_STATUSES.has(run.status)) return false
    this.setStatus(runId, ForgeRunStatus.CANCELLED)
    run.completedAt = Date.now()
    return true
  }

  /**
   * 重试失败的锻造任务。
   */
  async retryRun(runId: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false
    run.status = ForgeRunStatus.CREATED
    run.failureReason = undefined
    run.currentIteration = 0
    run.iterationHistory = []
    run.updatedAt = Date.now()
    this.saveRuns()
    this.executePipeline(runId).catch(e => this.log('error', `Retry failed: ${e.message}`))
    return true
  }

  /**
   * 基于已有技能重新锻造（reforge）。
   * 以现有技能的 body 和 frontmatter 为起点，跳过提取阶段，直接走验证+迭代。
   */
  async reforgeSkill(skillId: string, reason?: string): Promise<{ runId: string; status: ForgeRunStatus } | null> {
    const skill = this.deps.registry.getSkill(skillId)
    if (!skill) return null

    const runId = this.genId()
    const run = this.createRun(runId, TriggerMode.MANUAL, ['reforge'], reason ?? `Reforge based on skill: ${skill.frontmatter.name}`)
    // 以当前技能内容作为生成起点
    run.generatedSkill = {
      frontmatter: { ...skill.frontmatter } as GeneratedSkill['frontmatter'],
      body: skill.body,
      qualityScore: skill.verificationScore,
    }
    this.runs.set(runId, run)
    this.log('info', `Reforge started for skill ${skill.frontmatter.name}: ${runId}`)
    // 跳过提取阶段，直接从验证/迭代开始
    this.executeReforgePipeline(runId).catch(e => this.log('error', `Reforge pipeline failed: ${e.message}`))
    return { runId, status: ForgeRunStatus.CREATED }
  }

  /** 获取单个 run 详情 */
  getRun(runId: string): ForgeRun | undefined {
    return this.runs.get(runId)
  }

  /**
   * 列出最近的锻造任务（按创建时间倒序）。
   * @param limit - 最大返回数量，默认 20
   */
  listRuns(limit = 20): ForgeRun[] {
    const clampedLimit = clamp(limit, 1, 200)
    return Array.from(this.runs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, clampedLimit)
  }

  /** 记录一次技能注入（供统计用） */
  recordInjection(skillCount: number, isIntentAware: boolean): void {
    this.runStats.injectionCount++
    this.runStats.totalSkillInjections += skillCount
    if (isIntentAware) {
      this.runStats.intentAwareHits++
    }
    this.saveRuns()
  }

  /** 获取持久化的注入统计 */
  getInjectionStats(): InjectionStats {
    const { injectionCount, intentAwareHits, totalSkillInjections } = this.runStats
    const smartInjectionRatio = injectionCount > 0 ? intentAwareHits / injectionCount : 0
    return {
      totalInjections: injectionCount,
      intentAwareHits,
      totalSkillInjections,
      smartInjectionRatio,
    }
  }

  // ==========================================================
  // 内部：主流水线
  // ==========================================================

  private async executePipeline(runId: string): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return

    try {
      // Gate 0: Trigger（仅自动触发时评估）
      if (run.triggerMode === TriggerMode.AUTO) {
        this.setStatus(runId, ForgeRunStatus.TRIGGERING)
        const worthForging = await this.deps.trigger.evaluateForgeWorthiness(run)
        // 评估完成后清理会话痕迹（无论通过与否）
        this.deps.trigger.cleanupSessions?.(run.sourceSessionIds)
        if (!worthForging) {
          this.setStatus(runId, ForgeRunStatus.TRIGGER_SKIPPED)
          run.completedAt = Date.now()
          return
        }
      }

      // Gate 1: Extract
      this.setStatus(runId, ForgeRunStatus.EXTRACTING)
      try {
        run.extractionResult = await this.deps.extractor.extract(run) as ForgeRun['extractionResult']
      } catch (e) {
        this.fail(runId, FailureCode.EXTRACTION_LLM_ERROR, 'Extraction failed', (e as Error).message, 1)
        return
      }
      // 手动触发的门槛更低（用户主动要求，肯定值得做）
      const gate1Threshold = run.triggerMode === TriggerMode.MANUAL ? 0.1 : this.config.triggerThreshold
      if (!run.extractionResult || run.extractionResult.confidence < gate1Threshold) {
        const actual = run.extractionResult?.confidence
        this.fail(runId, FailureCode.EXTRACTION_SCHEMA_INVALID, 'Confidence too low', `threshold=${gate1Threshold}, actual=${actual}`, 1)
        return
      }

      // Gate 2: Generate
      this.setStatus(runId, ForgeRunStatus.GENERATING)
      try {
        run.generatedSkill = await this.deps.generator.generate(run)
      } catch (e) {
        this.fail(runId, FailureCode.GENERATION_LLM_ERROR, 'Generation failed', (e as Error).message, 2)
        return
      }

      // Gate 3-4: Verify + Iterate
      this.setStatus(runId, ForgeRunStatus.VERIFYING)
      const initialSkill = run.generatedSkill!
      const iterateResult = await this.runIterationLoop(runId, initialSkill, IMPROVEMENT_THRESHOLD)
      run.verificationResult = iterateResult.verification
      run.generatedSkill = iterateResult.skill
      run.qualityScore = iterateResult.verification.overallScore

      // Gate 5: Audit
      this.setStatus(runId, ForgeRunStatus.AUDITING)
      run.auditResult = await this.deps.auditor.audit(iterateResult.skill, run)
      const audit = run.auditResult
      if (!audit.passed) {
        this.setStatus(runId, ForgeRunStatus.AUDIT_FAILED)
        run.failureReason = {
          code: FailureCode.AUDIT_DANGEROUS_PATTERN,
          message: 'Audit failed',
          detail: audit.dangers.join(', '),
          gate: 5,
        }
        run.completedAt = Date.now()
        this.emit('skill-forge/failed', { runId, reason: run.failureReason })
        return
      }

      // Gate 6: Approve
      await this.finalizeOrRequestApproval(runId)
    } catch (e) {
      this.fail(runId, 'E999', 'Unexpected error', (e as Error).message, -1)
    }
  }

  /**
   * Reforge 流水线：跳过提取，直接从验证/迭代开始，以现有技能内容为基础。
   */
  private async executeReforgePipeline(runId: string): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return

    try {
      const initialSkill = run.generatedSkill
      if (!initialSkill) {
        this.fail(runId, FailureCode.GENERATION_FORMAT_INVALID, 'No base skill for reforge', 'generatedSkill is empty', 2)
        return
      }

      // Gate 3-4: Verify + Iterate
      this.setStatus(runId, ForgeRunStatus.VERIFYING)
      const iterateResult = await this.runIterationLoop(runId, initialSkill, REFORGE_IMPROVEMENT_THRESHOLD)
      run.verificationResult = iterateResult.verification
      run.generatedSkill = iterateResult.skill

      // Gate 5: Audit
      this.setStatus(runId, ForgeRunStatus.AUDITING)
      run.auditResult = await this.deps.auditor.audit(iterateResult.skill, run)
      const audit = run.auditResult
      if (!audit.passed) {
        this.setStatus(runId, ForgeRunStatus.AUDIT_FAILED)
        run.failureReason = {
          code: FailureCode.AUDIT_DANGEROUS_PATTERN,
          message: 'Audit failed',
          detail: audit.dangers.join(', '),
          gate: 5,
        }
        run.completedAt = Date.now()
        this.emit('skill-forge/failed', { runId, reason: run.failureReason })
        return
      }

      // Gate 6: Approve
      await this.finalizeOrRequestApproval(runId)
    } catch (e) {
      this.fail(runId, 'E999', 'Unexpected reforge error', (e as Error).message, -1)
    }
  }

  // ==========================================================
  // 内部：迭代循环（Verify + Refine 的公共逻辑）
  // ==========================================================

  /**
   * 运行验证-迭代循环。
   * 直到通过、达到最大迭代次数、或连续停滞 N 轮。
   */
  private async runIterationLoop(
    runId: string,
    initialSkill: GeneratedSkill,
    improvementThreshold: number,
  ): Promise<{ skill: GeneratedSkill; verification: VerificationResult }> {
    const run = this.runs.get(runId)!
    let skill = initialSkill
    let vr = await this.deps.verifier.verify(skill, run) as VerificationResult
    run.iterationHistory = []
    run.iterationHistory.push({ iteration: 0, score: vr.overallScore, changes: 'initial generation' })

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
        const newVr = await this.deps.verifier.verify(refinedSkill, run) as VerificationResult

        // Step 3: 严格不回退检查
        const refineResult = this.deps.refiner.checkNoRegression(
          prevSkill,
          refinedSkill,
          vr,
          newVr,
          changeSummary,
        )

        if (refineResult.rolledBack) {
          this.log('warn',
            `Iteration ${run.currentIteration} rolled back: ${refineResult.changeSummary.rollbackReason ?? 'score regressed'}`
          )
          skill = prevSkill
          run.iterationHistory.push({
            iteration: run.currentIteration,
            score: prevScore,
            changes: `回退：${refineResult.changeSummary.rollbackReason ?? 'score regressed'}`,
          })
          stagnationCount++
        } else {
          const improvement = refineResult.newScore - prevScore
          skill = refineResult.skill
          vr = newVr
          const improvedDims = (changeSummary.dimensionDeltas as RefineChangeSummary['dimensionDeltas'])
            .filter(d => d.delta > 0)
            .map(d => `${d.name}+${(d.delta * 100).toFixed(0)}%`)
            .join('、')
          run.iterationHistory.push({
            iteration: run.currentIteration,
            score: refineResult.newScore,
            changes: `score +${improvement.toFixed(3)}；${improvedDims || '无维度提升'}；${changeSummary.description.slice(0, 80)}`,
          })
          if (improvement < improvementThreshold) {
            stagnationCount++
          } else {
            stagnationCount = 0
          }
        }

        // 连续 N 轮无明显进步，提前终止
        if (stagnationCount >= STAGNATION_LIMIT) {
          this.log('info',
            `Early stop: ${stagnationCount} consecutive iterations with improvement < ${improvementThreshold}`
          )
          break
        }
      } catch (e) {
        this.log('warn', `Iteration ${run.currentIteration} failed: ${(e as Error).message}`)
        skill = prevSkill
        break
      }
    }

    return { skill, verification: vr }
  }

  // ==========================================================
  // 内部：收尾逻辑
  // ==========================================================

  /** 根据安全等级决定是自动通过还是等待人工审批 */
  private async finalizeOrRequestApproval(runId: string): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return

    if (this.needsHumanApproval(run)) {
      this.setStatus(runId, ForgeRunStatus.PENDING_APPROVAL)
    } else {
      const skillId = await this.deps.registry.activateForgedSkill(run)
      this.setStatus(runId, ForgeRunStatus.ACTIVE)
      run.completedAt = Date.now()
      this.emit('skill-forge/completed', { runId, skillId })
    }
  }

  /**
   * 判断是否需要人工审批。
   * 不同安全等级的审批门槛不同：
   * - strict: 全部需要审批
   * - normal: 自动触发 / 未通过 / 有警告 → 需要审批
   * - permissive: 未通过 / 有危险 → 需要审批
   * - auto: 全部自动通过
   */
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

  // ==========================================================
  // 辅助方法
  // ==========================================================

  /** 创建一个新的 ForgeRun 实例 */
  private createRun(id: string, mode: TriggerMode, sessionIds: string[], summary: string): ForgeRun {
    const now = Date.now()
    return {
      id,
      status: ForgeRunStatus.CREATED,
      triggerMode: mode,
      sourceSessionIds: sessionIds,
      sourceSummary: summary,
      currentIteration: 0,
      maxIterations: this.config.maxIterations,
      iterationHistory: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  /** 更新 run 状态，触发事件，保存到磁盘 */
  private setStatus(runId: string, status: ForgeRunStatus): void {
    const run = this.runs.get(runId)
    if (!run) return
    const prevStatus = run.status
    run.status = status
    run.updatedAt = Date.now()
    this.saveRuns()
    this.emit('skill-forge/status-changed', { runId, status, prevStatus })
  }

  /** 标记 run 为失败状态 */
  private fail(runId: string, code: FailureCode | string, message: string, detail: string, gate: number): void {
    const run = this.runs.get(runId)
    if (!run) return
    const reason: FailureReason = { code, message, detail, gate }
    run.status = ForgeRunStatus.FAILED
    run.failureReason = reason
    run.completedAt = Date.now()
    this.saveRuns()
    this.emit('skill-forge/failed', { runId, reason })
  }

  /** 触发 cordis 事件（可选，ctx 上没有 emit 时静默跳过） */
  private emit(event: string, payload: unknown): void {
    const ctxAsRecord = this.ctx as { emit?: (event: string, payload: unknown) => void }
    ctxAsRecord.emit?.(event, payload)
  }

  /** 输出带类名前缀的日志 */
  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    const fn = this.logger[level] ?? this.logger.info
    fn(`[ForgeOrchestrator] ${message}`)
  }

  /** 生成 run ID */
  private genId(): string {
    return generateId('forge_')
  }

  // ==========================================================
  // 持久化
  // ==========================================================

  /** 保存 runs 到磁盘（防抖，避免频繁写磁盘） */
  private saveRuns(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(async () => {
      try {
        const fs = await import('node:fs/promises')
        // 只保留最近 N 条，避免文件太大
        const recent = Array.from(this.runs.values())
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, MAX_HISTORICAL_RUNS)
        const payload = {
          runs: recent,
          stats: { ...this.runStats },
          _version: 2,
        }
        await fs.writeFile(this.runsStoragePath, JSON.stringify(payload, null, 2), 'utf-8')
      } catch (err) {
        this.log('warn', `Failed to save runs: ${(err as Error).message}`)
      }
    }, PERSIST_DEBOUNCE_MS)
  }
}
