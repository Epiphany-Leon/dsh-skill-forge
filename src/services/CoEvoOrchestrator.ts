/**
 * CoEvoOrchestrator —— 共进化编排器
 *
 * 核心思想（CoEvo = Co-Evolution）：
 *   技能和对抗性测试用例共同进化，形成「军备竞赛」：
 *     - 测试用例不断变得更刁钻，试图发现技能的新缺陷
 *     - 技能不断修复缺陷，变得更健壮
 *     - 双方互相驱动，最终都得到提升
 *
 * 共进化循环：
 *   ┌──────────────────────────────────────────┐
 *   │  Phase 1: 技能进化                       │
 *   │  → 用当前测试套件跑技能                   │
 *   │  → 找出失败的测试                         │
 *   │  → Refiner 修复这些失败                   │
 *   │  → 重测，分数提升则保留                    │
 *   ├──────────────────────────────────────────┤
 *   │  Phase 2: 测试用例进化                    │
 *   │  → 分析哪些测试太容易通过（弱用例）        │
 *   │  → 分析哪些测试总能发现问题（强用例方向）   │
 *   │  → 生成更刁钻的新测试用例                  │
 *   │  → 淘汰最弱的一批测试用例（避免测试膨胀）   │
 *   └──────────────────────────────────────────┘
 *                  ↓ 循环，直到双方都达到目标
 *
 * 终止条件：
 *   - 技能得分达到目标（targetSkillScore）且测试套件强度达到目标（targetTestStrength）
 *   - 连续 N 轮双方都无显著提升（停滞）
 *   - 达到最大轮数
 *
 * 人在回路：每轮进化后可暂停等待用户批准。
 */

import { BaseService } from './BaseService.js'
import {
  CoEvoRunStatus,
  CoEvoPhase,
  QualityDimension,
  QUALITY_DIMENSION_LABELS,
  QUALITY_DIMENSION_WEIGHTS,
  type CoEvoRun,
  type CoEvoRound,
  type AdversarialTestCase,
  type SkillForgeConfig,
  type GeneratedSkill,
  type VerificationResult,
  type TestResult,
} from '../types.js'
import { SYSTEM_PROMPTS } from '../prompts/index.js'

/** CoEvo 依赖的外部服务 */
export interface CoEvoDeps {
  /** 技能库（版本管理、读写） */
  registry: any
  /** 验证 Agent（跑测试用例） */
  verifier: any
  /** 优化 Agent（基于验证结果做增量优化） */
  refiner: any
  /** 对抗性测试用例生成器 */
  adversarial: any
}

export class CoEvoOrchestrator extends BaseService {
  private deps: CoEvoDeps
  /** 运行中的 CoEvo 任务（runId -> CoEvoRun） */
  private runs: Map<string, CoEvoRun> = new Map()
  /** 持久化路径 */
  private storagePath: string = ''

  constructor(ctx: any, config: SkillForgeConfig, deps: CoEvoDeps) {
    super(ctx, config)
    this.deps = deps
  }

  /** 初始化：加载历史运行记录 */
  async initialize(storagePath: string): Promise<void> {
    this.storagePath = `${storagePath}/coevo-runs.json`
    try {
      const fs = await import('node:fs/promises')
      try {
        const raw = await fs.readFile(this.storagePath, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data)) {
          for (const run of data) {
            this.runs.set(run.id, run)
          }
          this.log('info', `Loaded ${data.length} historical coevo runs`)
        }
      } catch {
        // 文件不存在，正常
      }
    } catch (err) {
      this.log('warn', `Failed to load coevo runs: ${(err as Error).message}`)
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
          .slice(0, 30)
        await fs.writeFile(this.storagePath, JSON.stringify(all, null, 2), 'utf-8')
      } catch (err) {
        this.log('warn', `Failed to save coevo runs: ${(err as Error).message}`)
      }
    }, 500)
  }

  // ============================================================
  // 对外 API
  // ============================================================

  /**
   * 启动 CoEvo 共进化
   */
  async startCoEvolution(
    skillName: string,
    options?: {
      autoApprove?: boolean
      maxRounds?: number
      targetSkillScore?: number
      targetTestStrength?: number
    },
  ): Promise<{ runId: string; status: CoEvoRunStatus }> {
    const skill = this.deps.registry.getSkillByName(skillName)
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`)
    }

    const runId = this.genId()
    const run: CoEvoRun = {
      id: runId,
      skillName,
      skillId: skill.id,
      status: CoEvoRunStatus.CREATED,
      autoApprove: options?.autoApprove ?? this.config.coevoAutoApprove ?? false,
      currentRound: 0,
      maxRounds: options?.maxRounds ?? this.config.coevoMaxRounds ?? 8,
      targetSkillScore: options?.targetSkillScore ?? this.config.coevoTargetSkillScore ?? 0.85,
      targetTestStrength: options?.targetTestStrength ?? this.config.coevoTargetTestStrength ?? 0.7,
      initialTestCaseCount: this.config.coevoInitialTestCount ?? 6,
      maxTestCases: this.config.coevoMaxTestCases ?? 20,
      currentSkillScore: null,
      currentTestStrength: null,
      testSuite: [],
      history: [],
      stagnationCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.runs.set(runId, run)
    this.log('info', `CoEvo run started for skill "${skillName}": ${runId}`)

    // 异步启动共进化循环
    this.runCoEvolutionLoop(runId).catch(err => {
      this.log('error', `CoEvo run failed: ${err.message}`)
      const r = this.runs.get(runId)
      if (r) {
        r.status = CoEvoRunStatus.FAILED
        r.failureReason = err.message
        r.completedAt = Date.now()
        r.updatedAt = Date.now()
        this.saveRuns()
      }
    })

    return { runId, status: CoEvoRunStatus.CREATED }
  }

  /** 获取运行状态 */
  getRun(runId: string): CoEvoRun | undefined {
    return this.runs.get(runId)
  }

  /** 列出最近的 CoEvo 运行 */
  listRuns(limit = 20): CoEvoRun[] {
    return Array.from(this.runs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  /**
   * 批准当前轮进化，继续下一轮
   */
  async approveRound(runId: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false
    if (run.status !== CoEvoRunStatus.PENDING_APPROVAL) return false
    if (!run.pendingApproval) return false

    const pending = run.pendingApproval
    const phase = pending.phase

    if (phase === CoEvoPhase.SKILL_EVOLUTION && pending.proposedSkill) {
      // 技能进化：写入技能
      const skill = this.deps.registry.getSkill(run.skillId)
      if (skill) {
        await this.deps.registry.saveVersionSnapshot(
          skill,
          `CoEvo round ${pending.round}: skill evolution accepted`,
        )
      }
      await this.deps.registry.updateSkill(run.skillId, {
        frontmatter: pending.proposedSkill.frontmatter,
        body: pending.proposedSkill.body,
        bumpLevel: 'patch',
        changelog: `CoEvo round ${pending.round}: skill evolution — ${pending.changeDescription.slice(0, 80)}`,
      })
    }

    // 更新测试套件（无论哪个阶段都可能更新）
    run.testSuite = pending.proposedTestSuite

    // 记录历史
    const entry: CoEvoRound = {
      round: pending.round,
      phase,
      skillScoreBefore: pending.skillScoreBefore,
      skillScoreAfter: pending.skillScoreAfter,
      testSuiteStrengthBefore: pending.testStrengthBefore,
      testSuiteStrengthAfter: pending.testStrengthAfter,
      newTestCases: pending.newTestCases.length,
      prunedTestCases: 0, // 简化：在循环里算
      newDefectsFound: 0,
      defectsFixed: phase === CoEvoPhase.SKILL_EVOLUTION ? 1 : 0,
      changeDescription: pending.changeDescription,
      accepted: true,
      timestamp: Date.now(),
    }
    run.history.push(entry)

    // 更新当前分数
    run.currentSkillScore = pending.skillScoreAfter
    run.currentTestStrength = pending.testStrengthAfter

    // 停滞计数：双方都没提升才算停滞
    const skillImproved = pending.skillScoreAfter > pending.skillScoreBefore + 0.01
    const testImproved = pending.testStrengthAfter > pending.testStrengthBefore + 0.01
    if (!skillImproved && !testImproved) {
      run.stagnationCount++
    } else {
      run.stagnationCount = 0
    }

    run.pendingApproval = undefined
    run.currentRound = pending.round
    run.updatedAt = Date.now()

    // 检查是否继续
    if (this.checkContinue(run)) {
      run.status = phase === CoEvoPhase.SKILL_EVOLUTION
        ? CoEvoRunStatus.TEST_EVOLVING
        : CoEvoRunStatus.SKILL_EVOLVING
      this.saveRuns()
      // 启动下一轮
      this.runCoEvolutionLoop(runId).catch(err => {
        this.log('error', `CoEvo run continuation failed: ${err.message}`)
        const r = this.runs.get(runId)
        if (r) {
          r.status = CoEvoRunStatus.FAILED
          r.failureReason = err.message
          r.completedAt = Date.now()
          r.updatedAt = Date.now()
          this.saveRuns()
        }
      })
    } else {
      run.status = CoEvoRunStatus.COMPLETED
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      this.log('info',
        `CoEvo run completed: ${runId} — ` +
        `final skill score: ${(run.currentSkillScore ?? 0).toFixed(3)}, ` +
        `final test strength: ${(run.currentTestStrength ?? 0).toFixed(3)}`
      )
      this.saveRuns()
    }

    return true
  }

  /**
   * 拒绝当前轮进化
   */
  async rejectRound(runId: string, reason?: string): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false
    if (run.status !== CoEvoRunStatus.PENDING_APPROVAL) return false
    if (!run.pendingApproval) return false

    const pending = run.pendingApproval

    // 记录为未接受
    run.history.push({
      round: pending.round,
      phase: pending.phase,
      skillScoreBefore: pending.skillScoreBefore,
      skillScoreAfter: pending.skillScoreAfter,
      testSuiteStrengthBefore: pending.testStrengthBefore,
      testSuiteStrengthAfter: pending.testStrengthAfter,
      newTestCases: pending.newTestCases.length,
      prunedTestCases: 0,
      newDefectsFound: 0,
      defectsFixed: 0,
      changeDescription: pending.changeDescription,
      accepted: false,
      timestamp: Date.now(),
    })

    run.stagnationCount++
    run.pendingApproval = undefined
    run.currentRound = pending.round
    run.updatedAt = Date.now()

    if (this.checkContinue(run)) {
      run.status = pending.phase === CoEvoPhase.SKILL_EVOLUTION
        ? CoEvoRunStatus.TEST_EVOLVING
        : CoEvoRunStatus.SKILL_EVOLVING
      this.saveRuns()
      this.runCoEvolutionLoop(runId).catch(err => {
        this.log('error', `CoEvo run continuation failed: ${err.message}`)
        const r = this.runs.get(runId)
        if (r) {
          r.status = CoEvoRunStatus.FAILED
          r.failureReason = err.message
          r.completedAt = Date.now()
          r.updatedAt = Date.now()
          this.saveRuns()
        }
      })
    } else {
      run.status = CoEvoRunStatus.COMPLETED
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      this.saveRuns()
    }

    return true
  }

  /** 停止 CoEvo 运行 */
  stopRun(runId: string, reason?: string): boolean {
    const run = this.runs.get(runId)
    if (!run) return false
    if (run.status === CoEvoRunStatus.COMPLETED
      || run.status === CoEvoRunStatus.STOPPED
      || run.status === CoEvoRunStatus.FAILED) {
      return false
    }
    run.status = CoEvoRunStatus.STOPPED
    run.stopReason = reason || 'Manually stopped'
    run.completedAt = Date.now()
    run.updatedAt = Date.now()
    this.saveRuns()
    this.log('info', `CoEvo run stopped: ${runId} — ${reason || 'manual stop'}`)
    return true
  }

  // ============================================================
  // 核心共进化循环
  // ============================================================

  /**
   * 主共进化循环。
   *
   * 执行流程：
   *   1. 首轮：生成初始对抗性测试套件 → 基线测试 → 记录初始分数
   *   2. 交替进行技能进化和测试进化
   *   3. 每轮后检查终止条件
   */
  private async runCoEvolutionLoop(runId: string): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return

    // ---- 首轮：初始测试套件生成 + 基线测试 ----
    if (run.currentRound === 0) {
      run.status = CoEvoRunStatus.INITIAL_TESTING
      run.updatedAt = Date.now()
      this.saveRuns()

      const skill = this.deps.registry.getSkill(run.skillId)
      if (!skill) {
        run.status = CoEvoRunStatus.FAILED
        run.failureReason = 'Skill not found'
        run.completedAt = Date.now()
        run.updatedAt = Date.now()
        this.saveRuns()
        return
      }

      const generated: GeneratedSkill = {
        frontmatter: { ...skill.frontmatter },
        body: skill.body,
        qualityScore: (skill.frontmatter as any).qualityScore,
      }

      // 生成初始对抗性测试套件
      this.log('info', `CoEvo: generating initial adversarial test suite for "${run.skillName}"`)
      const initialSuite = await this.deps.adversarial.generateInitialSuite(
        generated,
        run.initialTestCaseCount,
      )
      run.testSuite = initialSuite

      // 基线测试
      this.log('info', `CoEvo: running baseline verification (${initialSuite.length} tests)`)
      const baselineResult = await this.runAdversarialVerification(
        generated,
        initialSuite,
        run,
      )

      run.currentSkillScore = baselineResult.verification.overallScore
      const initialStrength = this.deps.adversarial.calculateSuiteStrength(
        initialSuite,
        baselineResult.verification,
      )
      run.currentTestStrength = initialStrength

      // 更新测试用例的统计数据
      run.testSuite = this.updateTestCaseStats(initialSuite, baselineResult.verification)

      this.log('info',
        `CoEvo baseline: skill=${(run.currentSkillScore * 100).toFixed(0)}%, ` +
        `testStrength=${((run.currentTestStrength ?? 0) * 100).toFixed(0)}%`
      )

      // 初始检查：如果已经全部达标，直接结束
      if (!this.checkContinue(run)) {
        run.status = CoEvoRunStatus.COMPLETED
        run.completedAt = Date.now()
        run.updatedAt = Date.now()
        this.log('info', `CoEvo run completed immediately: targets already met`)
        this.saveRuns()
        return
      }
    }

    // ---- 共进化主循环 ----
    while (run.currentRound < run.maxRounds) {
      const nextRound = run.currentRound + 1

      // 决定本轮阶段：奇数轮技能进化，偶数轮测试进化
      const phase = nextRound % 2 === 1
        ? CoEvoPhase.SKILL_EVOLUTION
        : CoEvoPhase.TEST_EVOLUTION

      this.log('info',
        `CoEvo round ${nextRound}/${run.maxRounds}: ` +
        `${phase === CoEvoPhase.SKILL_EVOLUTION ? 'skill evolution' : 'test evolution'}`
      )

      if (phase === CoEvoPhase.SKILL_EVOLUTION) {
        run.status = CoEvoRunStatus.SKILL_EVOLVING
        const result = await this.evolveSkill(run, nextRound)

        // 人在回路模式：暂停等待批准
        if (!run.autoApprove) {
          run.status = CoEvoRunStatus.PENDING_APPROVAL
          run.pendingApproval = {
            round: nextRound,
            phase,
            skillScoreBefore: result.skillScoreBefore,
            skillScoreAfter: result.skillScoreAfter,
            testStrengthBefore: result.testStrengthBefore,
            testStrengthAfter: result.testStrengthAfter,
            changeDescription: result.changeDescription,
            proposedSkill: result.proposedSkill,
            proposedTestSuite: result.testSuite,
            newTestCases: [],
            timestamp: Date.now(),
          }
          run.updatedAt = Date.now()
          this.saveRuns()
          return
        }

        // 自动模式：分数提升则接受
        const improved = result.skillScoreAfter > result.skillScoreBefore
        if (improved) {
          // 接受：写入技能
          const skill = this.deps.registry.getSkill(run.skillId)
          if (skill) {
            await this.deps.registry.saveVersionSnapshot(
              skill,
              `CoEvo round ${nextRound}: skill evolution improvement accepted`,
            )
          }
          await this.deps.registry.updateSkill(run.skillId, {
            frontmatter: result.proposedSkill.frontmatter,
            body: result.proposedSkill.body,
            bumpLevel: 'patch',
            changelog: `CoEvo round ${nextRound}: skill evolution — ${result.changeDescription.slice(0, 80)}`,
          })

          run.currentSkillScore = result.skillScoreAfter
          run.testSuite = result.testSuite

          run.history.push({
            round: nextRound,
            phase,
            skillScoreBefore: result.skillScoreBefore,
            skillScoreAfter: result.skillScoreAfter,
            testSuiteStrengthBefore: result.testStrengthBefore,
            testSuiteStrengthAfter: result.testStrengthAfter,
            newTestCases: 0,
            prunedTestCases: 0,
            newDefectsFound: 0,
            defectsFixed: 1,
            changeDescription: result.changeDescription,
            accepted: true,
            timestamp: Date.now(),
          })

          run.stagnationCount = 0
        } else {
          run.stagnationCount++
          run.history.push({
            round: nextRound,
            phase,
            skillScoreBefore: result.skillScoreBefore,
            skillScoreAfter: result.skillScoreAfter,
            testSuiteStrengthBefore: result.testStrengthBefore,
            testSuiteStrengthAfter: result.testStrengthAfter,
            newTestCases: 0,
            prunedTestCases: 0,
            newDefectsFound: 0,
            defectsFixed: 0,
            changeDescription: result.changeDescription + ' (rejected: no improvement)',
            accepted: false,
            timestamp: Date.now(),
          })
        }
      } else {
        // 测试进化轮
        run.status = CoEvoRunStatus.TEST_EVOLVING
        const result = await this.evolveTestSuite(run, nextRound)

        if (!run.autoApprove) {
          run.status = CoEvoRunStatus.PENDING_APPROVAL
          run.pendingApproval = {
            round: nextRound,
            phase,
            skillScoreBefore: result.skillScoreBefore,
            skillScoreAfter: result.skillScoreAfter,
            testStrengthBefore: result.testStrengthBefore,
            testStrengthAfter: result.testStrengthAfter,
            changeDescription: result.changeDescription,
            proposedTestSuite: result.testSuite,
            newTestCases: result.newTestCases,
            timestamp: Date.now(),
          }
          run.updatedAt = Date.now()
          this.saveRuns()
          return
        }

        // 自动模式：测试套件变强则接受
        const stronger = result.testStrengthAfter > result.testStrengthBefore
        if (stronger) {
          run.testSuite = result.testSuite
          run.currentTestStrength = result.testStrengthAfter
          run.currentSkillScore = result.skillScoreAfter

          run.history.push({
            round: nextRound,
            phase,
            skillScoreBefore: result.skillScoreBefore,
            skillScoreAfter: result.skillScoreAfter,
            testSuiteStrengthBefore: result.testStrengthBefore,
            testSuiteStrengthAfter: result.testStrengthAfter,
            newTestCases: result.newTestCases.length,
            prunedTestCases: result.prunedCount,
            newDefectsFound: result.newDefectsFound,
            defectsFixed: 0,
            changeDescription: result.changeDescription,
            accepted: true,
            timestamp: Date.now(),
          })

          run.stagnationCount = 0
        } else {
          run.stagnationCount++
          run.history.push({
            round: nextRound,
            phase,
            skillScoreBefore: result.skillScoreBefore,
            skillScoreAfter: result.skillScoreAfter,
            testSuiteStrengthBefore: result.testStrengthBefore,
            testSuiteStrengthAfter: result.testStrengthAfter,
            newTestCases: 0,
            prunedTestCases: 0,
            newDefectsFound: 0,
            defectsFixed: 0,
            changeDescription: result.changeDescription + ' (rejected: no strength gain)',
            accepted: false,
            timestamp: Date.now(),
          })
        }
      }

      run.currentRound = nextRound
      run.updatedAt = Date.now()
      this.saveRuns()

      // 检查终止条件
      if (!this.checkContinue(run)) break
    }

    // 循环结束
    const currentStatus = run.status as string
    if (currentStatus !== CoEvoRunStatus.STOPPED && currentStatus !== CoEvoRunStatus.FAILED) {
      run.status = CoEvoRunStatus.COMPLETED
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      this.log('info',
        `CoEvo run completed: ${runId} — ` +
        `${run.history.length} rounds, ` +
        `${run.history.filter(h => h.accepted).length} accepted, ` +
        `final skill score: ${(run.currentSkillScore ?? 0).toFixed(3)}, ` +
        `final test strength: ${(run.currentTestStrength ?? 0).toFixed(3)}`
      )
    }
    this.saveRuns()
  }

  // ============================================================
  // 技能进化
  // ============================================================

  /**
   * 执行一轮技能进化。
   *
   * 用当前测试套件测技能 → 发现缺陷 → Refiner 修复 → 重测
   */
  private async evolveSkill(
    run: CoEvoRun,
    round: number,
  ): Promise<{
    skillScoreBefore: number
    skillScoreAfter: number
    testStrengthBefore: number
    testStrengthAfter: number
    changeDescription: string
    proposedSkill: GeneratedSkill
    testSuite: AdversarialTestCase[]
  }> {
    const skill = this.deps.registry.getSkill(run.skillId)
    if (!skill) throw new Error('Skill not found')

    const generated: GeneratedSkill = {
      frontmatter: { ...skill.frontmatter },
      body: skill.body,
      qualityScore: (skill.frontmatter as any).qualityScore,
    }

    const skillScoreBefore = run.currentSkillScore ?? 0
    const testStrengthBefore = run.currentTestStrength ?? 0

    // Step 1: 用当前测试套件跑验证
    const testResult = await this.runAdversarialVerification(
      generated,
      run.testSuite,
      run,
    )

    // 更新测试用例统计
    const updatedSuite = this.updateTestCaseStats(run.testSuite, testResult.verification)

    // Step 2: 构造针对失败测试的优化请求
    const failedTests = testResult.verification.testResults.filter(r => !r.passed)
    const improvementSugs = this.buildImprovementSuggestions(
      testResult.verification,
      updatedSuite,
    )

    // 构造伪 VerificationResult 让 Refiner 聚焦于对抗性测试发现的问题
    const pseudoVr: VerificationResult = {
      totalTests: testResult.verification.totalTests,
      passedTests: testResult.verification.passedTests,
      failedTests: testResult.verification.failedTests,
      testResults: testResult.verification.testResults,
      overallScore: testResult.verification.overallScore,
      passed: false,
      dimensions: testResult.verification.dimensions,
      improvementSuggestions: improvementSugs,
      failurePatterns: this.classifyAdversarialFailures(failedTests, updatedSuite),
    }

    // 构造伪 ForgeRun
    const pseudoRun = {
      id: run.id,
      currentIteration: round,
      maxIterations: run.maxRounds,
      sourceSummary: `CoEvo mode — skill evolution round ${round}`,
      sourceSessionIds: ['coevo'],
      triggerMode: 'manual',
    } as any

    // Step 3: 调用 Refiner 优化
    const { skill: refinedSkill, changeSummary } =
      await this.deps.refiner.refineWithSummary(generated, pseudoVr, pseudoRun)

    // Step 4: 用同样的测试套件重测优化后的技能
    const reTestResult = await this.runAdversarialVerification(
      refinedSkill,
      updatedSuite,
      run,
    )

    const skillScoreAfter = reTestResult.verification.overallScore
    const testStrengthAfter = this.deps.adversarial.calculateSuiteStrength(
      updatedSuite,
      reTestResult.verification,
    )

    const reUpdatedSuite = this.updateTestCaseStats(updatedSuite, reTestResult.verification)

    this.log('info',
      `  → skill evolution: ` +
      `${(skillScoreBefore * 100).toFixed(0)}% → ${(skillScoreAfter * 100).toFixed(0)}% ` +
      `(${skillScoreAfter >= skillScoreBefore ? '✓ improve' : '✗ regress'})`
    )

    return {
      skillScoreBefore,
      skillScoreAfter,
      testStrengthBefore,
      testStrengthAfter,
      changeDescription: changeSummary?.description || `对抗性测试驱动的技能优化（修复 ${failedTests.length} 个失败用例）`,
      proposedSkill: refinedSkill,
      testSuite: reUpdatedSuite,
    }
  }

  // ============================================================
  // 测试用例进化
  // ============================================================

  /**
   * 执行一轮测试用例进化。
   *
   * 生成新的更刁钻的测试用例 → 跑一遍验证 → 淘汰弱用例 → 更新套件
   */
  private async evolveTestSuite(
    run: CoEvoRun,
    round: number,
  ): Promise<{
    skillScoreBefore: number
    skillScoreAfter: number
    testStrengthBefore: number
    testStrengthAfter: number
    changeDescription: string
    testSuite: AdversarialTestCase[]
    newTestCases: AdversarialTestCase[]
    prunedCount: number
    newDefectsFound: number
  }> {
    const skill = this.deps.registry.getSkill(run.skillId)
    if (!skill) throw new Error('Skill not found')

    const generated: GeneratedSkill = {
      frontmatter: { ...skill.frontmatter },
      body: skill.body,
      qualityScore: (skill.frontmatter as any).qualityScore,
    }

    const skillScoreBefore = run.currentSkillScore ?? 0
    const testStrengthBefore = run.currentTestStrength ?? 0

    // 先用当前套件跑一遍，拿到最新验证结果（作为进化输入）
    const currentResult = await this.runAdversarialVerification(
      generated,
      run.testSuite,
      run,
    )
    const currentUpdatedSuite = this.updateTestCaseStats(run.testSuite, currentResult.verification)

    // Step 1: 生成新的更刁钻的测试用例
    const newCases = await this.deps.adversarial.evolveTestSuite(
      generated,
      currentUpdatedSuite,
      currentResult.verification,
      this.config.coevoTestsPerRound ?? 3,
    )

    this.log('info', `  → generated ${newCases.length} new adversarial test cases`)

    // Step 2: 用新用例测试技能，验证它们确实能发现问题（或至少有效）
    const combinedSuite = [...currentUpdatedSuite, ...newCases]
    const fullResult = await this.runAdversarialVerification(
      generated,
      combinedSuite,
      run,
    )

    // 更新所有用例的统计
    const fullUpdatedSuite = this.updateTestCaseStats(combinedSuite, fullResult.verification)

    // 计算新发现的缺陷数（新用例中失败的数量）
    const newCaseIds = new Set(newCases.map((c: AdversarialTestCase) => c.id))
    const newFailures = fullResult.verification.testResults.filter(
      r => !r.passed && newCaseIds.has(r.testId)
    )
    const newDefectsFound = newFailures.length

    // Step 3: 淘汰最弱的测试用例（通过率太高的那些）
    const pruneThreshold = this.config.coevoTestPruneThreshold ?? 0.9
    const prunedSuite = this.deps.adversarial.pruneWeakCases(
      fullUpdatedSuite,
      pruneThreshold,
      run.initialTestCaseCount, // 至少保留初始数量
    )

    // 如果超过最大数量，再额外淘汰最弱的
    const maxCases = run.maxTestCases
    let finalSuite = prunedSuite
    let prunedCount = fullUpdatedSuite.length - prunedSuite.length

    if (finalSuite.length > maxCases) {
      // 按挑战价值排序，保留最强的 maxCases 个
      const scored: Array<{ tc: AdversarialTestCase; value: number }> = finalSuite.map((tc: AdversarialTestCase) => {
        const passRate = tc.runCount > 0 ? tc.passCount / tc.runCount : 0.5
        const value = tc.defectDiscoveredCount * 2 + (1 - passRate)
        return { tc, value }
      })
      scored.sort((a: { tc: AdversarialTestCase; value: number }, b: { tc: AdversarialTestCase; value: number }) => b.value - a.value)
      finalSuite = scored.slice(0, maxCases).map((s: { tc: AdversarialTestCase; value: number }) => s.tc)
      prunedCount += scored.length - maxCases
    }

    // Step 4: 计算新的测试套件强度
    // （用最终测试套件重新测一次，拿到准确的强度分数）
    const finalResult = await this.runAdversarialVerification(
      generated,
      finalSuite,
      run,
    )
    const finalUpdatedSuite = this.updateTestCaseStats(finalSuite, finalResult.verification)

    const skillScoreAfter = finalResult.verification.overallScore
    const testStrengthAfter = this.deps.adversarial.calculateSuiteStrength(
      finalUpdatedSuite,
      finalResult.verification,
    )

    this.log('info',
      `  → test evolution: strength ` +
      `${(testStrengthBefore * 100).toFixed(0)}% → ${(testStrengthAfter * 100).toFixed(0)}% ` +
      `(${testStrengthAfter >= testStrengthBefore ? '✓ stronger' : '✗ weaker'}), ` +
      `suite size: ${finalSuite.length} (new: ${newCases.length}, pruned: ${prunedCount})`
    )

    return {
      skillScoreBefore,
      skillScoreAfter,
      testStrengthBefore,
      testStrengthAfter,
      changeDescription: `测试套件进化：新增 ${newCases.length} 个用例，淘汰 ${prunedCount} 个弱用例，发现 ${newDefectsFound} 个新缺陷`,
      testSuite: finalUpdatedSuite,
      newTestCases: newCases,
      prunedCount,
      newDefectsFound,
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 运行对抗性测试套件的验证。
   *
   * 为了复用 VerifierAgent 的验证逻辑，我们把对抗性测试用例
   * 转换为 VerifierAgent 能理解的格式，然后直接调用 runTest 逐个跑。
   *
   * 但 VerifierAgent 的 test case 生成和验证是耦合的，所以这里
   * 我们直接复用 runTest 的逻辑，构造 TestCase 对象。
   */
  private async runAdversarialVerification(
    skill: GeneratedSkill,
    testCases: AdversarialTestCase[],
    run: CoEvoRun,
  ): Promise<{ verification: VerificationResult }> {
    // 将对抗性测试用例转换为 VerifierAgent 的格式
    const verifierTestCases = testCases.map(tc => ({
      id: tc.id,
      name: tc.name,
      category: tc.dimension,
      input: tc.input,
    }))

    // 逐个调用 verifier 的 runTest（通过反射/直接访问，因为 runTest 是 private）
    // 实际上，我们构造一个新的验证调用
    // 由于 runTest 是 private 的，我们走另一条路：直接调用 verify
    // 但 verify 会自己生成测试用例，这不是我们想要的。
    //
    // 方案：直接复制 runTest 的逻辑到这里，或者用更聪明的方式。
    // 考虑到代码复用，我们改为：构造一个自定义验证流程，
    // 复用 VerifierAgent 的 callLLMLow + 评估 prompt。

    const testResults: TestResult[] = []
    for (const tc of verifierTestCases) {
      // 通过调用 verifier 的公开接口来运行单个测试
      // 由于 runTest 是 private 的，我们绕过它，直接在这里实现类似逻辑
      const result = await this.evaluateSingleTest(skill, tc)
      testResults.push(result)
    }

    // 计算各维度得分
    const dimensions = this.calculateDimensionScores(testResults)
    const overallScore = this.calculateOverallScore(dimensions)
    const passedTests = testResults.filter(r => r.passed).length

    return {
      verification: {
        totalTests: testResults.length,
        passedTests,
        failedTests: testResults.length - passedTests,
        testResults,
        overallScore,
        passed: overallScore >= 0.8,
        dimensions,
        improvementSuggestions: [],
        failurePatterns: {},
      },
    }
  }

  /**
   * 运行单个测试用例的评估。
   * 通过 adversarial agent 调用 LLM（复用 verifier_judge prompt）。
   */
  private async evaluateSingleTest(
    skill: GeneratedSkill,
    testCase: { id: string; name: string; category: QualityDimension; input: string },
  ): Promise<TestResult> {
    const startTime = Date.now()
    const dimLabel = QUALITY_DIMENSION_LABELS[testCase.category] || testCase.category

    const userPrompt = `## 技能名称: ${skill.frontmatter.name}

## 技能描述: ${skill.frontmatter.description}

## 技能正文
${skill.body.substring(0, 3000)}

## 测试维度: ${dimLabel} (${testCase.category})
## 测试用例: ${testCase.name}
测试输入: ${testCase.input}

注意：这是一个对抗性测试用例，专门用来发现技能的薄弱点。请严格、深入地评估，不要轻易给通过。`

    try {
      const result = await this.deps.adversarial.evaluateWithPrompt(
        SYSTEM_PROMPTS.verifier_judge,
        userPrompt,
        0.3,
      ) as any

      const passed = result.passed === true
      const score = this.normalizeScore(result.score)
      const issues: any[] = Array.isArray(result.issues)
        ? result.issues.map((i: any) => typeof i === 'string'
          ? { severity: 'minor' as const, description: i }
          : {
              severity: i.severity || 'minor',
              description: i.description || '',
              location: i.location,
              suggestion: i.suggestion,
            }
        )
        : []

      return {
        testId: testCase.id,
        testName: testCase.name,
        category: testCase.category,
        passed,
        score,
        output: result.output || '',
        feedback: result.feedback || '',
        issues,
        duration: Date.now() - startTime,
      }
    } catch (err) {
      return {
        testId: testCase.id,
        testName: testCase.name,
        category: testCase.category,
        passed: false,
        score: 0,
        error: (err as Error).message,
        feedback: '测试执行出错',
        issues: [{
          severity: 'critical' as const,
          description: `测试执行失败: ${(err as Error).message}`,
        }],
        duration: Date.now() - startTime,
      }
    }
  }

  /** 规范化分数 */
  private normalizeScore(score: any): number {
    const num = typeof score === 'number' ? score : parseFloat(String(score))
    if (isNaN(num)) return 0.5
    return Math.max(0, Math.min(1, num))
  }

  /** 计算各维度得分 */
  private calculateDimensionScores(results: TestResult[]): Record<QualityDimension, number> {
    const dims = Object.values(QualityDimension) as QualityDimension[]
    const scores: Record<string, number> = {}

    for (const dim of dims) {
      const dimResults = results.filter(r => r.category === dim)
      if (dimResults.length === 0) {
        scores[dim] = 0.5 // 未测试的维度给中性分
      } else {
        const avg = dimResults.reduce((sum, r) => sum + r.score, 0) / dimResults.length
        scores[dim] = Math.round(avg * 100) / 100
      }
    }

    return scores as Record<QualityDimension, number>
  }

  /** 计算加权总体得分 */
  private calculateOverallScore(dimensions: Record<QualityDimension, number>): number {
    let total = 0
    let totalWeight = 0
    for (const dim of Object.values(QualityDimension) as QualityDimension[]) {
      const weight = QUALITY_DIMENSION_WEIGHTS[dim] || 0
      total += (dimensions[dim] || 0) * weight
      totalWeight += weight
    }
    if (totalWeight === 0) return 0
    return Math.round((total / totalWeight) * 100) / 100
  }

  /** 更新测试用例的运行统计 */
  private updateTestCaseStats(
    suite: AdversarialTestCase[],
    verification: VerificationResult,
  ): AdversarialTestCase[] {
    const resultMap = new Map(verification.testResults.map(r => [r.testId, r]))

    return suite.map(tc => {
      const result = resultMap.get(tc.id)
      if (!result) return tc

      return {
        ...tc,
        runCount: tc.runCount + 1,
        passCount: tc.passCount + (result.passed ? 1 : 0),
        defectDiscoveredCount: tc.defectDiscoveredCount + (result.passed ? 0 : 1),
        lastRunAt: Date.now(),
      }
    })
  }

  /** 构建改进建议（给 Refiner 用） */
  private buildImprovementSuggestions(
    verification: VerificationResult,
    suite: AdversarialTestCase[],
  ): string[] {
    const suggestions: string[] = []
    const caseMap = new Map<string, AdversarialTestCase>(suite.map((c: AdversarialTestCase) => [c.id, c]))

    for (const result of verification.testResults) {
      if (result.passed) continue

      const tc = caseMap.get(result.testId)
      const dimLabel = QUALITY_DIMENSION_LABELS[result.category] || result.category
      const typeLabel = tc?.type || 'unknown'

      // 用对抗性测试的 challengeRationale 作为改进的上下文
      const context = tc?.challengeRationale
        ? `（攻击方式：${tc.challengeRationale.substring(0, 80)}）`
        : ''

      if (result.feedback) {
        suggestions.push(`[${dimLabel} / ${typeLabel}] ${result.feedback}${context}`)
      }

      for (const issue of result.issues) {
        if (issue.severity !== 'info') {
          suggestions.push(
            `[${dimLabel} / ${typeLabel}] ${issue.description}` +
            (issue.suggestion ? ` → 建议：${issue.suggestion}` : '') +
            context
          )
        }
      }

      if (suggestions.length >= 15) break
    }

    return suggestions.slice(0, 10)
  }

  /** 分类对抗性测试失败模式 */
  private classifyAdversarialFailures(
    failedTests: TestResult[],
    suite: AdversarialTestCase[],
  ): Record<string, number> {
    const patterns: Record<string, number> = {}
    const caseMap = new Map<string, AdversarialTestCase>(suite.map((tc: AdversarialTestCase) => [tc.id, tc]))

    for (const result of failedTests) {
      const tc = caseMap.get(result.testId)

      // 按测试类型分类
      const typeLabel = tc?.type || 'unknown'
      patterns[typeLabel] = (patterns[typeLabel] || 0) + 1

      // 按维度分类
      const dimLabel = QUALITY_DIMENSION_LABELS[result.category] || result.category
      patterns[`${dimLabel}不足`] = (patterns[`${dimLabel}不足`] || 0) + 1

      // 按严重程度
      for (const issue of result.issues) {
        const sevKey = issue.severity === 'critical' ? '严重问题'
          : issue.severity === 'major' ? '主要问题'
          : issue.severity === 'minor' ? '次要问题'
          : '信息提示'
        patterns[sevKey] = (patterns[sevKey] || 0) + 1
      }
    }

    return patterns
  }

  /** 检查是否应该继续进化 */
  private checkContinue(run: CoEvoRun): boolean {
    if (run.status === CoEvoRunStatus.STOPPED) return false
    if (run.status === CoEvoRunStatus.FAILED) return false
    if (run.currentRound >= run.maxRounds) return false
    if (run.stagnationCount >= 4) return false // 连续 4 轮无提升则停止

    const skillScore = run.currentSkillScore ?? 0
    const testStrength = run.currentTestStrength ?? 0

    // 双方都达标才停止（这是共进化的目标）
    if (skillScore >= run.targetSkillScore && testStrength >= run.targetTestStrength) {
      return false
    }

    return true
  }

  private genId(): string {
    return `coevo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}
