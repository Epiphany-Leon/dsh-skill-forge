/**
 * DarwinOptimizer —— 达尔文模式：单体技能爬山优化系统
 *
 * 核心思想（源自 darwin-skill）：像训练模型一样优化单个技能，
 * 每次只改一个维度，独立 Verifier 评分，提升就保留、下降就回滚（ratchet 机制）。
 *
 * 9 维度评估体系：
 *   1. structural_completeness   结构完整性
 *   2. logical_consistency       逻辑一致性
 *   3. operationality            可操作性
 *   4. practicality              实用性
 *   5. security                  安全性
 *   6. frontmatter_completeness  Frontmatter 完整性
 *   7. trigger_quality           触发短语质量
 *   8. tool_call_conformity      工具调用规范
 *   9. verification_completeness 验证完备性
 *   (plus) cross_scenario_versatility 跨场景通用性
 *
 * 爬山循环：选最低分维度 → Refiner 优化 → Verifier 重评
 *   → 分数提升则保留，下降则回滚 → 下一个维度
 *
 * 终止条件：
 *   - 所有维度 >= 高分阈值（darwinHighScoreThreshold，默认 0.85）
 *   - 连续 3 轮无提升
 *   - 达到最大轮数（darwinMaxIterations，默认 10）
 *
 * 人在回路：每轮优化后暂停，用户确认后继续（autoApprove=false 时）。
 */

import { BaseService } from './BaseService.js'
import {
  DarwinDimension,
  DARWIN_DIMENSION_LABELS,
  DARWIN_DIMENSION_WEIGHTS,
  DarwinRunStatus,
  QualityDimension,
  type DarwinRun,
  type DarwinOptimizationHistoryEntry,
  type SkillForgeConfig,
  type GeneratedSkill,
  type VerificationResult,
} from '../types.js'
import { SYSTEM_PROMPTS } from '../prompts/index.js'

/** 达尔文模式依赖的外部服务 */
export interface DarwinDeps {
  /** 技能库（版本管理、读写） */
  registry: any
  /** 验证 Agent（5 维度评估） */
  verifier: any
  /** 优化 Agent（基于验证结果做增量优化） */
  refiner: any
}

/** 9 维度评估结果 */
interface DarwinEvaluation {
  scores: Record<DarwinDimension, number>
  overallScore: number
  /** 扩展维度的详细评估说明 */
  extendedNotes: Partial<Record<DarwinDimension, string>>
}

export class DarwinOptimizer extends BaseService {
  private deps: DarwinDeps
  /** 运行中的达尔文任务（runId -> DarwinRun） */
  private runs: Map<string, DarwinRun> = new Map()
  /** 持久化路径 */
  private storagePath: string = ''

  constructor(ctx: any, config: SkillForgeConfig, deps: DarwinDeps) {
    super(ctx, config)
    this.deps = deps
  }

  /** 初始化：加载历史运行记录 */
  async initialize(storagePath: string): Promise<void> {
    this.storagePath = `${storagePath}/darwin-runs.json`
    try {
      const fs = await import('node:fs/promises')
      try {
        const raw = await fs.readFile(this.storagePath, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data)) {
          for (const run of data) {
            this.runs.set(run.id, run)
          }
          this.log('info', `Loaded ${data.length} historical darwin runs`)
        }
      } catch {
        // 文件不存在，正常
      }
    } catch (err) {
      this.log('warn', `Failed to load darwin runs: ${(err as Error).message}`)
    }
  }

  /** 保存 runs 到磁盘（防抖） */
  private saveTimeout: any = null
  private saveRuns(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(async () => {
      try {
        const fs = await import('node:fs/promises')
        const all = Array.from(this.runs.values())
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 50)
        await fs.writeFile(this.storagePath, JSON.stringify(all, null, 2), 'utf-8')
      } catch (err) {
        this.log('warn', `Failed to save darwin runs: ${(err as Error).message}`)
      }
    }, 500)
  }

  // ============================================================
  // 对外 API
  // ============================================================

  /**
   * 启动达尔文模式优化
   *
   * @param skillName 目标技能名称
   * @param targetDimensions 目标维度（为空则自动选择所有低分维度）
   * @param autoApprove 是否自动批准（无人在回路）
   */
  async startOptimization(
    skillName: string,
    targetDimensions?: DarwinDimension[],
    autoApprove?: boolean,
  ): Promise<{ runId: string; status: DarwinRunStatus }> {
    const skill = this.deps.registry.getSkillByName(skillName)
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`)
    }

    const runId = this.genId()
    const run: DarwinRun = {
      id: runId,
      skillName,
      skillId: skill.id,
      status: DarwinRunStatus.CREATED,
      targetDimensions: targetDimensions && targetDimensions.length > 0
        ? targetDimensions
        : [], // 空数组 = 自动模式（全部低分维度）
      autoApprove: autoApprove ?? this.config.darwinAutoApprove ?? false,
      currentIteration: 0,
      maxIterations: this.config.darwinMaxIterations ?? 10,
      highScoreThreshold: this.config.darwinHighScoreThreshold ?? 0.85,
      initialScores: null,
      currentScores: null,
      initialOverallScore: null,
      currentOverallScore: null,
      history: [],
      stagnationCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.runs.set(runId, run)
    this.log('info', `Darwin run started for skill "${skillName}": ${runId}`)

    // 异步启动优化循环
    this.runOptimizationLoop(runId).catch(err => {
      this.log('error', `Darwin run failed: ${err.message}`)
      const r = this.runs.get(runId)
      if (r) {
        r.status = DarwinRunStatus.FAILED
        r.failureReason = err.message
        r.completedAt = Date.now()
        r.updatedAt = Date.now()
        this.saveRuns()
      }
    })

    return { runId, status: DarwinRunStatus.CREATED }
  }

  /** 获取运行状态 */
  getRun(runId: string): DarwinRun | undefined {
    return this.runs.get(runId)
  }

  /** 列出最近的达尔文运行 */
  listRuns(limit = 20): DarwinRun[] {
    return Array.from(this.runs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  /**
   * 批准当前轮优化，继续下一轮（人在回路模式用）
   *
   * @param runId 运行 ID
   * @param dimension 本轮目标维度（用于校验）
   */
  async approveRound(runId: string, dimension: DarwinDimension): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false
    if (run.status !== DarwinRunStatus.PENDING_APPROVAL) return false
    if (!run.pendingApproval) return false
    if (run.pendingApproval.targetDimension !== dimension) return false

    const pending = run.pendingApproval

    // 接受本轮优化：写入技能、更新分数
    const skill = this.deps.registry.getSkill(run.skillId)
    if (!skill) {
      run.status = DarwinRunStatus.FAILED
      run.failureReason = 'Skill not found during approval'
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      this.saveRuns()
      return false
    }

    // 保存当前版本快照（接受前先存一份）
    await this.deps.registry.saveVersionSnapshot(
      skill,
      `Darwin round ${pending.iteration}: ${DARWIN_DIMENSION_LABELS[dimension]} optimization accepted`,
    )

    // 更新技能内容
    await this.deps.registry.updateSkill(run.skillId, {
      frontmatter: pending.proposedSkill.frontmatter,
      body: pending.proposedSkill.body,
      bumpLevel: 'patch',
      changelog: `Darwin round ${pending.iteration}: ${DARWIN_DIMENSION_LABELS[dimension]} — ${pending.changeDescription.slice(0, 80)}`,
    })

    // 记录到历史
    const entry: DarwinOptimizationHistoryEntry = {
      iteration: pending.iteration,
      targetDimension: dimension,
      scoreBefore: pending.scoreBefore,
      scoreAfter: pending.scoreAfter,
      overallBefore: pending.overallBefore,
      overallAfter: pending.overallAfter,
      changeDescription: pending.changeDescription,
      accepted: true,
      timestamp: Date.now(),
    }
    run.history.push(entry)

    // 更新当前分数
    run.currentScores = pending.proposedScores
    run.currentOverallScore = this.calculateOverallScore(pending.proposedScores)
    run.stagnationCount = pending.scoreAfter > pending.scoreBefore
      ? 0
      : run.stagnationCount + 1
    run.pendingApproval = undefined
    run.currentIteration = pending.iteration
    run.updatedAt = Date.now()

    // 检查是否继续
    const shouldContinue = this.checkContinue(run)
    if (shouldContinue) {
      run.status = DarwinRunStatus.OPTIMIZING
      this.saveRuns()
      // 启动下一轮
      this.runOptimizationLoop(runId).catch(err => {
        this.log('error', `Darwin run continuation failed: ${err.message}`)
        const r = this.runs.get(runId)
        if (r) {
          r.status = DarwinRunStatus.FAILED
          r.failureReason = err.message
          r.completedAt = Date.now()
          r.updatedAt = Date.now()
          this.saveRuns()
        }
      })
    } else {
      run.status = DarwinRunStatus.COMPLETED
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      this.log('info', `Darwin run completed: ${runId} (final score: ${(run.currentOverallScore ?? 0).toFixed(3)})`)
      this.saveRuns()
    }

    return true
  }

  /**
   * 拒绝当前轮优化，继续下一轮（人在回路模式用）
   * 拒绝意味着回滚本轮，继续尝试下一个维度。
   */
  async rejectRound(runId: string, dimension: DarwinDimension, reason?: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false
    if (run.status !== DarwinRunStatus.PENDING_APPROVAL) return false
    if (!run.pendingApproval) return false
    if (run.pendingApproval.targetDimension !== dimension) return false

    const pending = run.pendingApproval

    // 记录为未接受
    const entry: DarwinOptimizationHistoryEntry = {
      iteration: pending.iteration,
      targetDimension: dimension,
      scoreBefore: pending.scoreBefore,
      scoreAfter: pending.scoreAfter,
      overallBefore: pending.overallBefore,
      overallAfter: pending.overallAfter,
      changeDescription: pending.changeDescription,
      accepted: false,
      rollbackReason: reason || 'User rejected',
      timestamp: Date.now(),
    }
    run.history.push(entry)

    run.stagnationCount++
    run.pendingApproval = undefined
    run.currentIteration = pending.iteration
    run.updatedAt = Date.now()

    const shouldContinue = this.checkContinue(run)
    if (shouldContinue) {
      run.status = DarwinRunStatus.OPTIMIZING
      this.saveRuns()
      this.runOptimizationLoop(runId).catch(err => {
        this.log('error', `Darwin run continuation failed: ${err.message}`)
        const r = this.runs.get(runId)
        if (r) {
          r.status = DarwinRunStatus.FAILED
          r.failureReason = err.message
          r.completedAt = Date.now()
          r.updatedAt = Date.now()
          this.saveRuns()
        }
      })
    } else {
      run.status = DarwinRunStatus.COMPLETED
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      this.saveRuns()
    }

    return true
  }

  /** 停止达尔文优化 */
  stopRun(runId: string, reason?: string): boolean {
    const run = this.runs.get(runId)
    if (!run) return false
    if (run.status === DarwinRunStatus.COMPLETED
      || run.status === DarwinRunStatus.STOPPED
      || run.status === DarwinRunStatus.FAILED) {
      return false
    }
    run.status = DarwinRunStatus.STOPPED
    run.stopReason = reason || 'Manually stopped'
    run.completedAt = Date.now()
    run.updatedAt = Date.now()
    this.saveRuns()
    this.log('info', `Darwin run stopped: ${runId} — ${reason || 'manual stop'}`)
    return true
  }

  // ============================================================
  // 核心优化循环
  // ============================================================

  /**
   * 主优化循环。
   * - 初次运行：先做 9 维度初始评估
   * - 每轮：选最低分维度 → 优化 → 重评 → 决定保留/回滚 → 暂停或继续
   */
  private async runOptimizationLoop(runId: string): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return

    // ---- 初始评估（仅首轮） ----
    if (run.currentIteration === 0) {
      run.status = DarwinRunStatus.INITIAL_EVALUATING
      run.updatedAt = Date.now()
      this.saveRuns()

      const skill = this.deps.registry.getSkill(run.skillId)
      if (!skill) {
        run.status = DarwinRunStatus.FAILED
        run.failureReason = 'Skill not found'
        run.completedAt = Date.now()
        run.updatedAt = Date.now()
        this.saveRuns()
        return
      }

      const generated: GeneratedSkill = {
        frontmatter: skill.frontmatter,
        body: skill.body,
        qualityScore: (skill.frontmatter as any).qualityScore,
      }

      const evalResult = await this.evaluate9Dimensions(generated, run)
      run.initialScores = evalResult.scores
      run.currentScores = evalResult.scores
      run.initialOverallScore = evalResult.overallScore
      run.currentOverallScore = evalResult.overallScore

      this.log('info',
        `Darwin initial evaluation for "${run.skillName}": overall=${evalResult.overallScore.toFixed(3)}`
      )
      for (const [dim, score] of Object.entries(evalResult.scores)) {
        const label = DARWIN_DIMENSION_LABELS[dim as DarwinDimension] || dim
        this.log('info', `  ${label}: ${(score * 100).toFixed(0)}%`)
      }

      // 初始检查：如果已经全部达标，直接结束
      if (!this.checkContinue(run)) {
        run.status = DarwinRunStatus.COMPLETED
        run.completedAt = Date.now()
        run.updatedAt = Date.now()
        this.log('info', `Darwin run completed immediately: all dimensions already above threshold`)
        this.saveRuns()
        return
      }
    }

    // ---- 爬山循环 ----
    run.status = DarwinRunStatus.OPTIMIZING
    run.updatedAt = Date.now()
    this.saveRuns()

    while (run.currentIteration < run.maxIterations) {
      // 选择本轮要优化的维度（最低分的那个）
      const targetDim = this.pickNextDimension(run)
      if (!targetDim) break // 没有可优化的维度了

      const iteration = run.currentIteration + 1
      this.log('info',
        `Darwin round ${iteration}/${run.maxIterations}: optimizing ` +
        `"${DARWIN_DIMENSION_LABELS[targetDim]}" ` +
        `(current: ${((run.currentScores?.[targetDim] ?? 0) * 100).toFixed(0)}%)`
      )

      // 执行单轮优化
      const result = await this.optimizeOneDimension(run, targetDim, iteration)

      // 人在回路模式：暂停等待用户批准
      if (!run.autoApprove) {
        run.status = DarwinRunStatus.PENDING_APPROVAL
        run.pendingApproval = {
          iteration,
          targetDimension: targetDim,
          scoreBefore: result.scoreBefore,
          scoreAfter: result.scoreAfter,
          overallBefore: result.overallBefore,
          overallAfter: result.overallAfter,
          changeDescription: result.changeDescription,
          proposedSkill: result.proposedSkill,
          proposedScores: result.newScores,
          timestamp: Date.now(),
        }
        run.updatedAt = Date.now()
        this.saveRuns()
        return // 暂停，等 approveRound / rejectRound 唤醒
      }

      // 自动模式：直接决定是否接受
      const accepted = result.scoreAfter > result.scoreBefore
        && result.overallAfter >= result.overallBefore - 0.02 // 容忍微小总体波动

      if (accepted) {
        // 接受：写入技能
        const skill = this.deps.registry.getSkill(run.skillId)
        if (skill) {
          await this.deps.registry.saveVersionSnapshot(
            skill,
            `Darwin round ${iteration}: ${DARWIN_DIMENSION_LABELS[targetDim]} improvement accepted`,
          )
        }
        await this.deps.registry.updateSkill(run.skillId, {
          frontmatter: result.proposedSkill.frontmatter,
          body: result.proposedSkill.body,
          bumpLevel: 'patch',
          changelog: `Darwin round ${iteration}: ${DARWIN_DIMENSION_LABELS[targetDim]} — ${result.changeDescription.slice(0, 80)}`,
        })

        run.currentScores = result.newScores
        run.currentOverallScore = this.calculateOverallScore(result.newScores)
        run.stagnationCount = 0

        run.history.push({
          iteration,
          targetDimension: targetDim,
          scoreBefore: result.scoreBefore,
          scoreAfter: result.scoreAfter,
          overallBefore: result.overallBefore,
          overallAfter: result.overallAfter,
          changeDescription: result.changeDescription,
          accepted: true,
          timestamp: Date.now(),
        })
      } else {
        // 回退：不写入，计入停滞
        run.stagnationCount++
        run.history.push({
          iteration,
          targetDimension: targetDim,
          scoreBefore: result.scoreBefore,
          scoreAfter: result.scoreAfter,
          overallBefore: result.overallBefore,
          overallAfter: result.overallAfter,
          changeDescription: result.changeDescription,
          accepted: false,
          rollbackReason: 'Score did not improve (auto mode)',
          timestamp: Date.now(),
        })
      }

      run.currentIteration = iteration
      run.updatedAt = Date.now()
      this.saveRuns()

      // 检查终止条件
      if (!this.checkContinue(run)) break
    }

    // 循环结束
    const currentStatus = run.status as string
    if (currentStatus !== DarwinRunStatus.STOPPED && currentStatus !== DarwinRunStatus.FAILED) {
      run.status = DarwinRunStatus.COMPLETED
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      this.log('info',
        `Darwin run completed: ${runId} — ` +
        `${run.history.length} rounds, ` +
        `${run.history.filter(h => h.accepted).length} accepted, ` +
        `final score: ${(run.currentOverallScore ?? 0).toFixed(3)}`
      )
    }
    this.saveRuns()
  }

  // ============================================================
  // 单轮优化：针对单个维度
  // ============================================================

  /**
   * 针对单个维度执行一轮优化。
   * 复用 RefinerAgent 和 VerifierAgent，但通过构造"仅聚焦该维度"的验证结果
   * 来引导 Refiner 只改这一个维度。
   */
  private async optimizeOneDimension(
    run: DarwinRun,
    targetDim: DarwinDimension,
    iteration: number,
  ): Promise<{
    targetDimension: DarwinDimension
    scoreBefore: number
    scoreAfter: number
    overallBefore: number
    overallAfter: number
    newScores: Record<DarwinDimension, number>
    changeDescription: string
    proposedSkill: GeneratedSkill
  }> {
    const skill = this.deps.registry.getSkill(run.skillId)
    if (!skill) throw new Error('Skill not found')

    const currentScores = run.currentScores!
    const generated: GeneratedSkill = {
      frontmatter: { ...skill.frontmatter },
      body: skill.body,
      qualityScore: (skill.frontmatter as any).qualityScore,
    }

    // 构造一个"伪" VerificationResult，让 Refiner 聚焦目标维度
    // 策略：把目标维度的分数设为当前低分，其他维度设为高分（保护）
    const pseudoVr = this.buildPseudoVerificationForDimension(targetDim, currentScores)

    // 构造一个伪 ForgeRun（仅用于 Refiner 接口）
    const pseudoRun = {
      id: run.id,
      currentIteration: iteration,
      maxIterations: run.maxIterations,
      sourceSummary: `Darwin mode — optimizing ${DARWIN_DIMENSION_LABELS[targetDim]}`,
      sourceSessionIds: ['darwin'],
      triggerMode: 'manual',
    } as any

    // 调用 Refiner
    const { skill: refinedSkill, changeSummary } =
      await this.deps.refiner.refineWithSummary(generated, pseudoVr, pseudoRun)

    // 重新做 9 维度评估
    const reEval = await this.evaluate9Dimensions(refinedSkill, run)

    const scoreBefore = currentScores[targetDim]
    const scoreAfter = reEval.scores[targetDim]
    const overallBefore = this.calculateOverallScore(currentScores)
    const overallAfter = reEval.overallScore

    this.log('info',
      `  → ${DARWIN_DIMENSION_LABELS[targetDim]}: ` +
      `${(scoreBefore * 100).toFixed(0)}% → ${(scoreAfter * 100).toFixed(0)}% ` +
      `(${scoreAfter >= scoreBefore ? '✓ improve' : '✗ regress'})`
    )

    return {
      targetDimension: targetDim,
      scoreBefore,
      scoreAfter,
      overallBefore,
      overallAfter,
      newScores: reEval.scores,
      changeDescription: changeSummary?.description || `优化 ${DARWIN_DIMENSION_LABELS[targetDim]}`,
      proposedSkill: refinedSkill,
    }
  }

  // ============================================================
  // 9 维度评估
  // ============================================================

  /**
   * 9 维度评估：
   * - 5 个基础维度复用 VerifierAgent 的 verify() 结果
   * - 4 个扩展维度通过直接启发式检查 + LLM 轻量评估
   */
  private async evaluate9Dimensions(
    skill: GeneratedSkill,
    run: DarwinRun,
  ): Promise<DarwinEvaluation> {
    // 伪 ForgeRun 用于 Verifier 接口
    const pseudoRun = {
      id: run.id,
      currentIteration: run.currentIteration,
      maxIterations: run.maxIterations,
      sourceSummary: run.skillName,
      sourceSessionIds: ['darwin'],
      triggerMode: 'manual',
    } as any

    // 基础 5 维度
    const baseResult = await this.deps.verifier.verify(skill, pseudoRun)

    const scores: Record<string, number> = {
      [DarwinDimension.STRUCTURAL_COMPLETENESS]: baseResult.dimensions[QualityDimension.STRUCTURAL_COMPLETENESS] ?? 0.5,
      [DarwinDimension.LOGICAL_CONSISTENCY]: baseResult.dimensions[QualityDimension.LOGICAL_CONSISTENCY] ?? 0.5,
      [DarwinDimension.OPERATIONALITY]: baseResult.dimensions[QualityDimension.OPERATIONALITY] ?? 0.5,
      [DarwinDimension.PRACTICALITY]: baseResult.dimensions[QualityDimension.PRACTICALITY] ?? 0.5,
      [DarwinDimension.SECURITY]: baseResult.dimensions[QualityDimension.SECURITY] ?? 0.5,
    }

    // 扩展 5 维度（frontmatter / trigger / tool_call / verification / cross_scenario）
    // 通过启发式规则 + LLM 轻量评估计算
    const extended = await this.evaluateExtendedDimensions(skill)

    for (const [dim, score] of Object.entries(extended.scores)) {
      scores[dim] = score
    }

    const overallScore = this.calculateOverallScore(scores as Record<DarwinDimension, number>)

    return {
      scores: scores as Record<DarwinDimension, number>,
      overallScore,
      extendedNotes: extended.notes,
    }
  }

  /**
   * 评估扩展 5 个维度（frontmatter / trigger / tool_call / verification / cross_scenario）。
   *
   * 方法：启发式规则为主，LLM 辅助验证。
   * 避免为每个扩展维度都发起完整 LLM 调用（节省 token）。
   */
  private async evaluateExtendedDimensions(
    skill: GeneratedSkill,
  ): Promise<{ scores: Partial<Record<DarwinDimension, number>>; notes: Partial<Record<DarwinDimension, string>> }> {
    const fm = skill.frontmatter
    const body = skill.body
    const scores: Partial<Record<DarwinDimension, number>> = {}
    const notes: Partial<Record<DarwinDimension, string>> = {}

    // ---- 6. Frontmatter 完整性 ----
    {
      const requiredFields = ['name', 'description', 'whenToUse', 'version']
      const optionalFields = ['tags', 'author', 'category']
      let score = 0
      for (const field of requiredFields) {
        if ((fm as any)[field] && String((fm as any)[field]).trim().length > 0) score += 1 / requiredFields.length
      }
      // 可选字段加分
      let optionalCount = 0
      for (const field of optionalFields) {
        if ((fm as any)[field] && String((fm as any)[field]).trim().length > 0) optionalCount++
      }
      score += (optionalCount / optionalFields.length) * 0.2
      score = Math.min(1, score)
      scores[DarwinDimension.FRONTMATTER_COMPLETENESS] = Math.round(score * 100) / 100
      notes[DarwinDimension.FRONTMATTER_COMPLETENESS] = `必填字段 ${requiredFields.filter(f => (fm as any)[f]).length}/${requiredFields.length}，可选字段 ${optionalCount}/${optionalFields.length}`
    }

    // ---- 7. 触发短语质量 ----
    {
      const whenToUse = (fm as any).whenToUse || ''
      const whenLen = whenToUse.length
      // 太短 → 分数低；中等长度 → 高；太长 → 略有下降
      let score = 0.5
      if (whenLen < 10) score = 0.3
      else if (whenLen < 30) score = 0.6
      else if (whenLen < 150) score = 0.85
      else if (whenLen < 300) score = 0.75
      else score = 0.6

      // 含场景描述/触发条件关键词加分
      const keywords = ['当', '如果', '需要', '遇到', '场景', '情况', '任务', '问题']
      let kwCount = 0
      for (const kw of keywords) {
        if (whenToUse.includes(kw)) kwCount++
      }
      score = Math.min(1, score + kwCount * 0.03)

      scores[DarwinDimension.TRIGGER_QUALITY] = Math.round(score * 100) / 100
      notes[DarwinDimension.TRIGGER_QUALITY] = `whenToUse 长度 ${whenLen}，关键词命中 ${kwCount}/${keywords.length}`
    }

    // ---- 8. 工具调用规范 ----
    {
      // 检查正文中是否明确提到了工具及其使用方式
      const toolMentionPatterns = [
        /工具/, /调用/, /使用/, /执行/, /运行/,
        /\btool\b/i, /\binvoke\b/i, /\bexecute\b/i,
        /ctx\./, /skill_view/, /web_search/, /web_extract/,
      ]
      let mentions = 0
      for (const pat of toolMentionPatterns) {
        if (pat.test(body)) mentions++
      }

      // 是否有明确的操作步骤（编号列表）
      const hasStepPattern = /^\s*(?:\d+[\.、)]|[-*])\s+/m.test(body)

      // 是否有验证步骤
      const hasVerification = /验证|确认|检查|校验|assert|expect/i.test(body)

      let score = 0.4
      if (mentions >= 3) score += 0.2
      else if (mentions >= 1) score += 0.1
      if (hasStepPattern) score += 0.2
      if (hasVerification) score += 0.2
      score = Math.min(1, score)

      scores[DarwinDimension.TOOL_CALL_CONFORMITY] = Math.round(score * 100) / 100
      notes[DarwinDimension.TOOL_CALL_CONFORMITY] = `工具提及 ${mentions} 种模式，有步骤结构: ${hasStepPattern}，有验证: ${hasVerification}`
    }

    // ---- 9. 验证完备性 ----
    {
      const verificationKeywords = ['验证', '确认', '检查', '校验', '验证步骤', '自测', '验收', 'assert', 'expect', 'should']
      let kwMatches = 0
      for (const kw of verificationKeywords) {
        if (new RegExp(kw, 'i').test(body)) kwMatches++
      }

      // 是否有错误处理
      const hasErrorHandling = /错误|异常|失败|报错|error|fail|catch/i.test(body)

      // 是否有常见问题/排错章节
      const hasFaq = /FAQ|常见问题|排错|排查|问题|troubleshoot/i.test(body)

      let score = 0.3
      if (kwMatches >= 4) score += 0.3
      else if (kwMatches >= 2) score += 0.2
      else if (kwMatches >= 1) score += 0.1
      if (hasErrorHandling) score += 0.2
      if (hasFaq) score += 0.2
      score = Math.min(1, score)

      scores[DarwinDimension.VERIFICATION_COMPLETENESS] = Math.round(score * 100) / 100
      notes[DarwinDimension.VERIFICATION_COMPLETENESS] = `验证关键词命中 ${kwMatches}/${verificationKeywords.length}，错误处理: ${hasErrorHandling}，FAQ/排错: ${hasFaq}`
    }

    // ---- 10. 跨场景通用性 ----
    {
      // 启发式：适用场景列表长度 + whenToUse 中场景多样性 + 标签数量
      const whenToUse = (fm as any).whenToUse || ''
      const tags = (fm as any).tags || []
      const bodyLen = body.length

      // 场景列举数（用顿号/逗号/换行分隔的场景）
      const sceneMatches = whenToUse.match(/[，,、\n]/g)
      const sceneCount = sceneMatches ? sceneMatches.length + 1 : 1

      let score = 0.4
      if (sceneCount >= 4) score += 0.25
      else if (sceneCount >= 3) score += 0.15
      else if (sceneCount >= 2) score += 0.1

      if (tags.length >= 5) score += 0.15
      else if (tags.length >= 3) score += 0.1
      else if (tags.length >= 1) score += 0.05

      // 正文长度适中 → 通用性可能更好（过短可能场景覆盖少）
      if (bodyLen > 2000) score += 0.1
      else if (bodyLen > 1000) score += 0.05

      score = Math.min(1, score)

      scores[DarwinDimension.CROSS_SCENARIO_VERSATILITY] = Math.round(score * 100) / 100
      notes[DarwinDimension.CROSS_SCENARIO_VERSATILITY] = `场景数约 ${sceneCount}，标签 ${tags.length} 个，正文 ${bodyLen} 字`
    }

    return { scores, notes }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /** 计算加权总体得分 */
  private calculateOverallScore(scores: Record<DarwinDimension, number>): number {
    let total = 0
    let totalWeight = 0
    for (const dim of Object.values(DarwinDimension)) {
      const weight = DARWIN_DIMENSION_WEIGHTS[dim] || 0
      total += (scores[dim] || 0) * weight
      totalWeight += weight
    }
    if (totalWeight === 0) return 0
    return Math.round((total / totalWeight) * 100) / 100
  }

  /**
   * 选择下一个要优化的维度。
   * - 如果指定了 targetDimensions，只从里面选最低分的
   * - 否则从所有维度中选低于阈值的最低分那个
   * - 已经达标的维度不选
   */
  private pickNextDimension(run: DarwinRun): DarwinDimension | null {
    if (!run.currentScores) return null

    const threshold = run.highScoreThreshold
    const allDims = Object.values(DarwinDimension)

    // 候选维度池
    let candidates: DarwinDimension[]
    if (run.targetDimensions.length > 0) {
      candidates = run.targetDimensions.filter(d => allDims.includes(d))
    } else {
      candidates = allDims
    }

    // 过滤掉已经达标的维度
    const below = candidates.filter(d => (run.currentScores?.[d] ?? 0) < threshold)
    if (below.length === 0) return null

    // 选最低分的
    below.sort((a, b) => (run.currentScores?.[a] ?? 0) - (run.currentScores?.[b] ?? 0))
    return below[0]!
  }

  /** 检查是否应该继续优化 */
  private checkContinue(run: DarwinRun): boolean {
    if (run.status === DarwinRunStatus.STOPPED) return false
    if (run.status === DarwinRunStatus.FAILED) return false
    if (run.currentIteration >= run.maxIterations) return false
    if (run.stagnationCount >= 3) return false

    if (!run.currentScores) return true

    // 检查是否所有维度都达标
    const threshold = run.highScoreThreshold
    for (const dim of Object.values(DarwinDimension)) {
      // 如果指定了目标维度，只检查目标维度
      if (run.targetDimensions.length > 0 && !run.targetDimensions.includes(dim)) continue
      if ((run.currentScores[dim] ?? 0) < threshold) return true
    }

    return false // 全部达标
  }

  /**
   * 构造一个伪 VerificationResult，让 Refiner 聚焦到目标维度。
   *
   * 策略：
   * - 目标维度：低分 + 改进建议（从 darwin 维度映射到 5 基础维度）
   * - 其他维度：高分（保护名单，不让 Refiner 动）
   * - 对于扩展维度（frontmatter/trigger 等），映射到最相关的基础维度
   */
  private buildPseudoVerificationForDimension(
    targetDim: DarwinDimension,
    currentScores: Record<DarwinDimension, number>,
  ): VerificationResult {
    // 达尔文维度 → 基础 5 维度的映射
    const dimMap: Record<DarwinDimension, QualityDimension> = {
      [DarwinDimension.STRUCTURAL_COMPLETENESS]: 'structural_completeness' as QualityDimension,
      [DarwinDimension.LOGICAL_CONSISTENCY]: 'logical_consistency' as QualityDimension,
      [DarwinDimension.OPERATIONALITY]: 'operationality' as QualityDimension,
      [DarwinDimension.PRACTICALITY]: 'practicality' as QualityDimension,
      [DarwinDimension.SECURITY]: 'security' as QualityDimension,
      [DarwinDimension.FRONTMATTER_COMPLETENESS]: 'structural_completeness' as QualityDimension,
      [DarwinDimension.TRIGGER_QUALITY]: 'practicality' as QualityDimension,
      [DarwinDimension.TOOL_CALL_CONFORMITY]: 'operationality' as QualityDimension,
      [DarwinDimension.VERIFICATION_COMPLETENESS]: 'operationality' as QualityDimension,
      [DarwinDimension.CROSS_SCENARIO_VERSATILITY]: 'practicality' as QualityDimension,
    }

    const targetBaseDim = dimMap[targetDim]
    const dimLabel = DARWIN_DIMENSION_LABELS[targetDim]

    const dimensions: Record<string, number> = {}
    const baseDims = [
      'structural_completeness',
      'logical_consistency',
      'operationality',
      'practicality',
      'security',
    ]
    for (const bd of baseDims) {
      // 非目标维度设为高分（保护）
      if (bd !== targetBaseDim) {
        dimensions[bd] = 0.95
      } else {
        // 目标维度用当前分数
        dimensions[bd] = currentScores[targetDim] ?? 0.5
      }
    }

    const overallScore = dimensions[targetBaseDim] ?? 0.5

    return {
      totalTests: 5,
      passedTests: 4,
      failedTests: 1,
      testResults: [],
      overallScore,
      passed: false,
      dimensions: dimensions as Record<QualityDimension, number>,
      improvementSuggestions: [
        `[${dimLabel}] 重点优化"${dimLabel}"维度，该维度当前得分较低，需要针对性改进。`,
        `只修改与"${dimLabel}"相关的内容，其他维度已经是高分，请保持不动。`,
      ],
      failurePatterns: { [`${dimLabel}不足`]: 1 },
    }
  }

  private genId(): string {
    return `darwin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}
