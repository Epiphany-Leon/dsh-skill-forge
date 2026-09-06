/**
 * TaotieFusion —— 饕餮模式：跨技能优势吸收融合系统
 *
 * 核心思想：不是简单合并技能，而是理解「为什么好」，
 * 把 source 技能的优势渐进式注入到 target 技能中。
 *
 * 五阶段流程：
 * 1. 配对分析（Pair Analysis）：对比两技能的结构、维度得分、差异点
 * 2. 并行测试（Parallel Testing）：生成通用测试用例，分别跑两个技能
 * 3. 反向工程（Reverse Engineering）：分析 source 好在哪里，提炼成模式
 * 4. 渐进注入（Progressive Injection）：一次注入一个模式，立即验证，
 *    有提升保留，下降回滚（严格不回退）
 * 5. 模式沉淀（Pattern Distillation）：成功的模式存入技能模式库
 *
 * 设计原则：
 * - 严格不回退：每一步注入后整体质量必须不下降
 * - 渐进式：一次只改一个点，便于定位效果
 * - 人在回路：关键步骤可配置需要用户确认
 * - 可复用：成功的模式沉淀后可跨技能调用
 */

import { BaseService } from './BaseService.js'
import {
  QualityDimension,
  QUALITY_DIMENSION_LABELS,
  QUALITY_DIMENSION_WEIGHTS,
  SkillStatus,
  TaotieRunStatus,
  TaotiePhase,
  type Skill,
  type SkillForgeConfig,
  type TaotieRun,
  type PairAnalysisReport,
  type ParallelTestResult,
  type ReverseEngineeringResult,
  type InjectionStepResult,
  type SimilarSkillGroup,
  type FusionPattern,
  type GeneratedSkill,
  type VerificationResult,
} from '../types.js'
import type { SkillRegistry } from './SkillRegistry.js'
import type { VerifierAgent } from '../agents/VerifierAgent.js'

/** 相似度计算权重配置 */
const SIMILARITY_WEIGHTS = {
  name: 0.15,
  description: 0.25,
  whenToUse: 0.2,
  tags: 0.2,
  category: 0.1,
  bodyKeywords: 0.1,
}

/** 最小 token 重叠数（用于计算相似度） */
const MIN_OVERLAP_FOR_SIMILARITY = 3

export class TaotieFusion extends BaseService {
  private registry: SkillRegistry
  private verifier: VerifierAgent

  /** 运行中的融合任务：runId -> TaotieRun */
  private runs: Map<string, TaotieRun> = new Map()

  /** 全局模式库（从所有技能的 patterns 字段聚合而来） */
  private globalPatterns: Map<string, FusionPattern> = new Map()

  constructor(
    ctx: any,
    config: SkillForgeConfig,
    registry: SkillRegistry,
    verifier: VerifierAgent,
  ) {
    super(ctx, config)
    this.registry = registry
    this.verifier = verifier
  }

  /**
   * 按 id 或 name 查找技能（id 优先）。
   * API 层接受两种标识，这里统一解析。
   */
  private resolveSkill(identifier: string): Skill | undefined {
    return this.registry.getSkill(identifier) ?? this.registry.getSkillByName(identifier)
  }

  // ============================================================
  // 公开 API
  // ============================================================

  /**
   * 检测语义相似的技能组。
   *
   * 基于关键词、标签、描述、分类的多重相似度计算，
   * 用聚类方式找出相似度超过阈值的技能组。
   */
  detectSimilarSkills(threshold?: number): SimilarSkillGroup[] {
    const effectiveThreshold = threshold ?? this.config.taotieSimilarityThreshold ?? 0.4
    const skills = this.registry.listSkills(SkillStatus.ACTIVE)

    if (skills.length < 2) return []

    // 计算所有技能对的相似度
    const pairs: Array<{ a: string; b: string; similarity: number }> = []
    for (let i = 0; i < skills.length; i++) {
      for (let j = i + 1; j < skills.length; j++) {
        const sim = this.calculateSkillSimilarity(skills[i]!, skills[j]!)
        if (sim >= effectiveThreshold) {
          pairs.push({
            a: skills[i]!.frontmatter.name,
            b: skills[j]!.frontmatter.name,
            similarity: sim,
          })
        }
      }
    }

    // 简单聚类：并查集方式，把相连的技能归为一组
    const groups: SimilarSkillGroup[] = this.clusterSimilarPairs(pairs, skills)

    this.log('info',
      `Detected ${groups.length} similar skill groups (threshold=${effectiveThreshold})`
    )

    return groups.sort((a, b) => b.maxSimilarity - a.maxSimilarity)
  }

  /**
   * 配对分析：对比 target 和 source 技能，输出详细对比报告。
   */
  async analyzePair(
    targetIdentifier: string,
    sourceIdentifier: string,
  ): Promise<PairAnalysisReport> {
    const target = this.resolveSkill(targetIdentifier)
    const source = this.resolveSkill(sourceIdentifier)

    if (!target) throw new Error(`Target skill not found: ${targetIdentifier}`)
    if (!source) throw new Error(`Source skill not found: ${sourceIdentifier}`)

    const targetName = target.frontmatter.name
    const sourceName = source.frontmatter.name

    this.log('info', `Analyzing pair: target=${targetName}, source=${sourceName}`)

    // 1. 计算整体相似度
    const overallSimilarity = this.calculateSkillSimilarity(target, source)

    // 2. 计算各维度相似度
    const dimensionSimilarity = this.calculateDimensionSimilarity(target, source)

    // 3. 获取两技能的质量维度得分（若有验证结果）
    const targetDims = this.getSkillDimensionScores(target)
    const sourceDims = this.getSkillDimensionScores(source)

    // 4. 分析 source 优于 target 的维度
    const sourceAdvantages: PairAnalysisReport['sourceAdvantages'] = []
    const targetAdvantages: PairAnalysisReport['targetAdvantages'] = []

    for (const dim of Object.values(QualityDimension)) {
      const tScore = targetDims[dim] ?? 0
      const sScore = sourceDims[dim] ?? 0
      const gap = sScore - tScore
      const label = QUALITY_DIMENSION_LABELS[dim] || dim

      if (gap > 0.05) {
        sourceAdvantages.push({ dimension: dim, label, targetScore: tScore, sourceScore: sScore, gap })
      } else if (gap < -0.05) {
        targetAdvantages.push({ dimension: dim, label, targetScore: tScore, sourceScore: sScore, gap: -gap })
      }
    }

    sourceAdvantages.sort((a, b) => b.gap - a.gap)
    targetAdvantages.sort((a, b) => b.gap - a.gap)

    // 5. 识别结构差异
    const structuralDifferences = this.analyzeStructuralDifferences(target, source)

    // 6. 生成融合建议
    const fusionSuggestions = this.generateFusionSuggestions(
      target, source, sourceAdvantages, structuralDifferences
    )

    // 7. 总结强项
    const targetStrengths = targetAdvantages.map(a => a.label)
    const sourceStrengths = sourceAdvantages.map(a => a.label)

    const report: PairAnalysisReport = {
      targetSkillName: targetName,
      sourceSkillName: sourceName,
      overallSimilarity,
      dimensionSimilarity,
      targetStrengths,
      sourceStrengths,
      sourceAdvantages,
      targetAdvantages,
      fusionSuggestions,
      structuralDifferences,
    }

    this.log('info',
      `Pair analysis complete: similarity=${overallSimilarity.toFixed(3)}, ` +
      `${sourceAdvantages.length} source advantages, ${targetAdvantages.length} target advantages`
    )

    return report
  }

  /**
   * 启动完整的饕餮融合流程。
   *
   * 返回 runId，通过 getRunStatus 查询进度。
   * 若 autoApprove=true，则自动跳过所有人在回路确认步骤。
   */
  async startFusion(
    targetIdentifier: string,
    sourceIdentifier: string,
    autoApprove = false,
  ): Promise<{ runId: string; run: TaotieRun }> {
    if (!this.config.taotieEnabled) {
      throw new Error('Taotie mode is disabled in config')
    }

    const target = this.resolveSkill(targetIdentifier)
    const source = this.resolveSkill(sourceIdentifier)
    if (!target) throw new Error(`Target skill not found: ${targetIdentifier}`)
    if (!source) throw new Error(`Source skill not found: ${sourceIdentifier}`)

    const targetName = target.frontmatter.name
    const sourceName = source.frontmatter.name

    const runId = `taotie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()

    const run: TaotieRun = {
      id: runId,
      status: TaotieRunStatus.CREATED,
      phase: TaotiePhase.PAIR_ANALYSIS,
      targetSkillName: targetName,
      sourceSkillName: sourceName,
      autoApprove,
      injectionSteps: [],
      distilledPatterns: [],
      createdAt: now,
      updatedAt: now,
    }

    this.runs.set(runId, run)

    this.log('info',
      `Starting taotie fusion: ${targetName} <<< ${sourceName} ` +
      `(runId=${runId}, autoApprove=${autoApprove})`
    )

    // 异步执行完整流程（不阻塞返回）
    this.runFullFusion(runId).catch(err => {
      this.log('error', `Fusion run ${runId} failed: ${(err as Error).message}`)
      const r = this.runs.get(runId)
      if (r) {
        r.status = TaotieRunStatus.FAILED
        r.failureReason = (err as Error).message
        r.updatedAt = Date.now()
      }
    })

    return { runId, run }
  }

  /**
   * 获取融合运行状态。
   */
  getRunStatus(runId: string): TaotieRun | undefined {
    return this.runs.get(runId)
  }

  /**
   * 列出最近的融合运行记录。
   */
  listRuns(limit = 20): TaotieRun[] {
    return Array.from(this.runs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  /**
   * 批准当前步骤继续执行（人在回路确认）。
   *
   * 当 autoApprove=false 时，融合会在关键步骤停下等待批准。
   * 调用此方法继续执行下一步。
   */
  async approveStep(runId: string, step?: number): Promise<boolean> {
    const run = this.runs.get(runId)
    if (!run) return false

    if (run.status !== TaotieRunStatus.PENDING_APPROVAL) {
      this.log('warn', `Run ${runId} is not pending approval (status=${run.status})`)
      return false
    }

    this.log('info', `Step approved for run ${runId}, step=${step ?? 'current'}`)

    // 恢复执行（通过状态变化触发）
    run.status = TaotieRunStatus.INJECTING
    run.updatedAt = Date.now()

    // 继续执行后续步骤
    this.resumeInjection(runId).catch(err => {
      this.log('error', `Resume injection failed: ${(err as Error).message}`)
      const r = this.runs.get(runId)
      if (r) {
        r.status = TaotieRunStatus.FAILED
        r.failureReason = (err as Error).message
        r.updatedAt = Date.now()
      }
    })

    return true
  }

  /**
   * 停止融合运行。
   */
  stopRun(runId: string): boolean {
    const run = this.runs.get(runId)
    if (!run) return false

    if (
      run.status === TaotieRunStatus.COMPLETED ||
      run.status === TaotieRunStatus.FAILED ||
      run.status === TaotieRunStatus.CANCELLED
    ) {
      return false
    }

    run.status = TaotieRunStatus.CANCELLED
    run.updatedAt = Date.now()
    this.log('info', `Fusion run ${runId} cancelled`)
    return true
  }

  /**
   * 获取全局模式库（从所有已激活技能的 patterns 聚合）。
   */
  getGlobalPatterns(): FusionPattern[] {
    this.refreshGlobalPatterns()
    return Array.from(this.globalPatterns.values())
      .sort((a, b) => b.appliedCount - a.appliedCount)
  }

  // ============================================================
  // 内部：完整融合流程
  // ============================================================

  private async runFullFusion(runId: string): Promise<void> {
    const run = this.runs.get(runId)
    if (!run) return

    // Phase 1: 配对分析
    run.status = TaotieRunStatus.PAIR_ANALYZING
    run.phase = TaotiePhase.PAIR_ANALYSIS
    run.updatedAt = Date.now()

    const pairAnalysis = await this.analyzePair(run.targetSkillName, run.sourceSkillName)
    run.pairAnalysis = pairAnalysis
    run.status = TaotieRunStatus.PAIR_ANALYSIS_DONE
    run.updatedAt = Date.now()

    // 若无 source 优势，则直接结束
    if (pairAnalysis.sourceAdvantages.length === 0) {
      this.log('info', `No source advantages found for ${run.targetSkillName}, fusion complete early`)
      run.status = TaotieRunStatus.COMPLETED
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      return
    }

    // Phase 2: 并行测试
    run.status = TaotieRunStatus.PARALLEL_TESTING
    run.phase = TaotiePhase.PARALLEL_TESTING
    run.updatedAt = Date.now()

    const parallelTest = await this.runParallelTesting(run.targetSkillName, run.sourceSkillName)
    run.parallelTest = parallelTest
    run.status = TaotieRunStatus.PARALLEL_TESTING_DONE
    run.updatedAt = Date.now()

    // Phase 3: 反向工程
    run.status = TaotieRunStatus.REVERSE_ENGINEERING
    run.phase = TaotiePhase.REVERSE_ENGINEERING
    run.updatedAt = Date.now()

    const reverseEng = await this.reverseEngineer(run.targetSkillName, run.sourceSkillName, pairAnalysis)
    run.reverseEngineering = reverseEng
    run.status = TaotieRunStatus.REVERSE_ENGINEERING_DONE
    run.updatedAt = Date.now()

    if (reverseEng.patterns.length === 0) {
      this.log('info', `No patterns extracted from source, fusion complete`)
      run.status = TaotieRunStatus.COMPLETED
      run.completedAt = Date.now()
      run.updatedAt = Date.now()
      return
    }

    // Phase 4: 渐进注入
    run.status = TaotieRunStatus.INJECTING
    run.phase = TaotiePhase.PROGRESSIVE_INJECTION
    run.updatedAt = Date.now()

    await this.runProgressiveInjection(runId)
  }

  /**
   * 并行测试：生成通用测试用例，分别验证两个技能。
   *
   * 这里复用 VerifierAgent 的验证能力，为两个技能各跑一次验证，
   * 然后对比结果。不需要实际执行技能，只做质量评估。
   */
  private async runParallelTesting(
    targetName: string,
    sourceName: string,
  ): Promise<ParallelTestResult> {
    const target = this.registry.getSkillByName(targetName)
    const source = this.registry.getSkillByName(sourceName)
    if (!target || !source) throw new Error('Skill not found')

    this.log('info', `Running parallel testing: ${targetName} vs ${sourceName}`)

    // 构造 GeneratedSkill 格式以复用 VerifierAgent
    const targetGen: GeneratedSkill = {
      frontmatter: target.frontmatter,
      body: target.body,
      qualityScore: target.verificationScore,
    }
    const sourceGen: GeneratedSkill = {
      frontmatter: source.frontmatter,
      body: source.body,
      qualityScore: source.verificationScore,
    }

    // 构造一个模拟的 ForgeRun 用于验证
    const mockRun = {
      id: 'taotie_parallel_test',
      sourceSummary: `Parallel test: ${targetName} vs ${sourceName}`,
      sourceSessionIds: [],
      status: 'verifying' as any,
      triggerMode: 'manual' as any,
      currentIteration: 0,
      maxIterations: 1,
      iterationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // 分别验证两个技能
    const [targetResult, sourceResult] = await Promise.all([
      this.verifier.verify(targetGen, mockRun as any).catch(err => {
        this.log('warn', `Target verification failed: ${(err as Error).message}`)
        return this.buildFallbackVerification(target)
      }),
      this.verifier.verify(sourceGen, mockRun as any).catch(err => {
        this.log('warn', `Source verification failed: ${(err as Error).message}`)
        return this.buildFallbackVerification(source)
      }),
    ])

    // 对比测试结果
    const sourceWinningTests: string[] = []
    const targetWinningTests: string[] = []
    const tieTests: string[] = []

    // 按维度对
    for (let i = 0; i < Math.min(targetResult.testResults.length, sourceResult.testResults.length); i++) {
      const t = targetResult.testResults[i]
      const s = sourceResult.testResults[i]
      if (!t || !s) continue
      if (s.score > t.score + 0.05) {
        sourceWinningTests.push(s.testName)
      } else if (t.score > s.score + 0.05) {
        targetWinningTests.push(t.testName)
      } else {
        tieTests.push(t.testName)
      }
    }

    const result: ParallelTestResult = {
      targetScore: targetResult.overallScore,
      sourceScore: sourceResult.overallScore,
      targetDimensions: targetResult.dimensions,
      sourceDimensions: sourceResult.dimensions,
      sourceWinningTests,
      targetWinningTests,
      tieTests,
    }

    this.log('info',
      `Parallel testing complete: target=${result.targetScore.toFixed(3)}, ` +
      `source=${result.sourceScore.toFixed(3)}, ` +
      `source wins=${sourceWinningTests.length}, target wins=${targetWinningTests.length}`
    )

    return result
  }

  /**
   * 反向工程：分析 source 比 target 好在哪里，提炼成可复用的模式。
   *
   * 不直接复制文字，而是提炼结构优势、方法论优势、工具使用技巧、验证机制等，
   * 转化为可注入的「模式」。
   */
  private async reverseEngineer(
    targetName: string,
    sourceName: string,
    pairAnalysis: PairAnalysisReport,
  ): Promise<ReverseEngineeringResult> {
    const target = this.registry.getSkillByName(targetName)
    const source = this.registry.getSkillByName(sourceName)
    if (!target || !source) throw new Error('Skill not found')

    this.log('info', `Reverse engineering: extracting patterns from ${sourceName}`)

    // 基于结构分析 + 内容关键词，提炼可复用模式
    const patterns: ReverseEngineeringResult['patterns'] = []
    const methodologicalStrengths: string[] = []
    const toolTechniques: string[] = []
    const verificationStrengths: string[] = []

    // 1. 结构模式分析：source 是否有更完善的章节结构
    const sourceSections = this.extractSections(source.body)
    const targetSections = this.extractSections(target.body)
    const uniqueSourceSections = sourceSections.filter(
      s => !targetSections.some(t => this.sectionNameSimilar(t.name, s.name))
    )

    if (uniqueSourceSections.length > 0) {
      for (const section of uniqueSourceSections.slice(0, 3)) {
        const dim = this.inferDimensionForSection(section.name)
        patterns.push({
          id: `pattern_struct_${patterns.length}`,
          name: `新增「${section.name}」章节`,
          description: `source 技能包含「${section.name}」章节，而 target 没有。该章节提供了${section.preview || '额外的指导信息'}。`,
          origin: `结构差异：${section.name}`,
          effectDimensions: [dim],
          whyItWorks: `完整的「${section.name}」环节能帮助使用者更好地${this.sectionPurpose(section.name)}，提升技能的${QUALITY_DIMENSION_LABELS[dim] || dim}。`,
          injectionSuggestion: `在 target 技能的合适位置插入「${section.name}」章节，参考 source 的结构框架但重写内容以匹配 target 主题。`,
        })
      }
    }

    // 2. 方法论优势：从 source 的步骤数量、层次结构推断
    const sourceStepCount = this.countSteps(source.body)
    const targetStepCount = this.countSteps(target.body)
    if (sourceStepCount > targetStepCount + 2) {
      methodologicalStrengths.push(
        `步骤更详细：source 有 ${sourceStepCount} 步，target 只有 ${targetStepCount} 步`
      )
      patterns.push({
        id: `pattern_steps_${patterns.length}`,
        name: '细化操作步骤',
        description: 'source 技能的操作步骤更细致，每个大步骤拆分为更多小步骤，降低了执行门槛。',
        origin: '步骤粒度差异',
        effectDimensions: [QualityDimension.OPERATIONALITY, QualityDimension.PRACTICALITY],
        whyItWorks: '更细粒度的步骤让使用者更容易跟着做，减少理解偏差和出错概率。',
        injectionSuggestion: '将 target 中较粗的步骤拆分为 2-3 个具体子步骤，每步有明确的操作指令和预期结果。',
      })
    }

    // 3. 验证机制：source 是否有明确的验证/检查环节
    const sourceHasVerification = this.hasVerificationSection(source.body)
    const targetHasVerification = this.hasVerificationSection(target.body)
    if (sourceHasVerification && !targetHasVerification) {
      verificationStrengths.push('包含明确的验证/检查环节')
      patterns.push({
        id: `pattern_verify_${patterns.length}`,
        name: '增加验证检查点',
        description: 'source 技能在关键步骤后加入了验证检查点，让使用者可以确认每步是否正确。',
        origin: '验证机制差异',
        effectDimensions: [QualityDimension.OPERATIONALITY, QualityDimension.LOGICAL_CONSISTENCY],
        whyItWorks: '验证环节能及时发现错误，避免问题累积到最后才暴露，提升整体可靠性。',
        injectionSuggestion: '在 target 技能的关键步骤之后加入「验证」子步骤，说明做完后如何确认正确。',
      })
    }

    // 4. 工具使用技巧：source 是否提到了更多工具或工具组合
    const sourceTools = this.extractToolNames(source.body)
    const targetTools = this.extractToolNames(target.body)
    const uniqueTools = sourceTools.filter(t => !targetTools.includes(t))
    if (uniqueTools.length > 0) {
      toolTechniques.push(`使用了额外工具：${uniqueTools.join('、')}`)
      patterns.push({
        id: `pattern_tools_${patterns.length}`,
        name: '补充工具使用技巧',
        description: `source 技能使用了 ${uniqueTools.length} 个 target 未提及的工具：${uniqueTools.join('、')}。`,
        origin: '工具使用差异',
        effectDimensions: [QualityDimension.PRACTICALITY, QualityDimension.OPERATIONALITY],
        whyItWorks: '更多工具选项让使用者能根据场景选择最合适的手段，提高解决问题的能力。',
        injectionSuggestion: `在 target 技能的工具相关章节补充 ${uniqueTools.slice(0, 3).join('、')} 等工具的使用场景和方法。`,
      })
    }

    // 5. 错误处理：source 是否有错误处理章节
    const sourceHasErrorHandling = this.hasErrorHandlingSection(source.body)
    const targetHasErrorHandling = this.hasErrorHandlingSection(target.body)
    if (sourceHasErrorHandling && !targetHasErrorHandling) {
      methodologicalStrengths.push('包含错误处理和排查指引')
      patterns.push({
        id: `pattern_errors_${patterns.length}`,
        name: '增加错误处理与排查',
        description: 'source 技能包含专门的错误处理/常见问题排查章节，target 缺少。',
        origin: '错误处理差异',
        effectDimensions: [QualityDimension.PRACTICALITY, QualityDimension.OPERATIONALITY],
        whyItWorks: '预设的错误处理方案能帮助使用者快速从故障中恢复，减少卡住的情况。',
        injectionSuggestion: '在 target 技能末尾增加「常见问题与排查」章节，列出 3-5 个最可能遇到的问题及解决方法。',
      })
    }

    // 6. 从 pairAnalysis 的融合建议中补充模式
    for (const suggestion of pairAnalysis.fusionSuggestions.slice(0, 3)) {
      if (patterns.length >= 6) break
      const exists = patterns.some(p => p.name.includes(suggestion.title.slice(0, 4)))
      if (!exists) {
        patterns.push({
          id: `pattern_suggestion_${patterns.length}`,
          name: suggestion.title,
          description: suggestion.description,
          origin: '配对分析建议',
          effectDimensions: [suggestion.targetDimension],
          whyItWorks: `针对 ${QUALITY_DIMENSION_LABELS[suggestion.targetDimension] || suggestion.targetDimension} 维度的薄弱点进行补强。`,
          injectionSuggestion: suggestion.description,
        })
      }
    }

    const result: ReverseEngineeringResult = {
      patterns: patterns.slice(0, 8), // 最多取 8 个模式
      methodologicalStrengths,
      toolTechniques,
      verificationStrengths,
    }

    this.log('info',
      `Reverse engineering complete: ${result.patterns.length} patterns extracted, ` +
      `${methodologicalStrengths.length} methodological strengths, ` +
      `${toolTechniques.length} tool techniques, ` +
      `${verificationStrengths.length} verification strengths`
    )

    return result
  }

  /**
   * 渐进注入：逐个模式注入 target，注入后立即验证，
   * 有提升保留，下降回滚（严格不回退）。
   */
  private async runProgressiveInjection(runId: string): Promise<void> {
    const run = this.runs.get(runId)
    if (!run || !run.reverseEngineering) return

    const maxSteps = this.config.taotieMaxInjectionSteps ?? 5
    const minImprovement = this.config.taotieMinImprovementThreshold ?? 0.02
    const patterns = run.reverseEngineering.patterns.slice(0, maxSteps)

    this.log('info',
      `Starting progressive injection for ${run.targetSkillName}: ` +
      `${patterns.length} patterns, maxSteps=${maxSteps}, minImprovement=${minImprovement}`
    )

    // 当前 target 技能的工作副本（逐步修改）
    const target = this.registry.getSkillByName(run.targetSkillName)
    if (!target) throw new Error('Target skill not found')

    let currentBody = target.body
    let currentFrontmatter = { ...target.frontmatter }
    let currentScore = run.parallelTest?.targetScore ?? target.verificationScore ?? 0.5

    const initialScore = currentScore

    for (let i = 0; i < patterns.length; i++) {
      // 检查是否被取消
      const r = this.runs.get(runId)
      if (!r || r.status === TaotieRunStatus.CANCELLED) return

      const pattern = patterns[i]!
      this.log('info', `Injection step ${i + 1}/${patterns.length}: ${pattern.name}`)

      // 人在回路：非 autoApprove 时在每步注入前等待批准
      if (!run.autoApprove && i > 0) {
        run.status = TaotieRunStatus.PENDING_APPROVAL
        run.pendingStepIndex = i
        run.updatedAt = Date.now()
        // 暂停，等待 approveStep 调用
        return
      }

      // 执行注入
      const stepResult = await this.injectPattern(
        runId,
        i,
        pattern,
        currentBody,
        currentFrontmatter,
        currentScore,
      )

      run.injectionSteps.push(stepResult)
      run.updatedAt = Date.now()

      if (stepResult.retained) {
        // 保留：更新当前状态
        if (stepResult.appliedBody) {
          currentBody = stepResult.appliedBody
        }
        currentScore = stepResult.afterScore
        this.log('info',
          `Step ${i + 1} retained: score ${stepResult.beforeScore.toFixed(3)} -> ${stepResult.afterScore.toFixed(3)} ` +
          `(+${(stepResult.afterScore - stepResult.beforeScore).toFixed(3)})`
        )
      } else {
        this.log('info',
          `Step ${i + 1} rolled back: ${stepResult.rollbackReason || 'no improvement'}`
        )
      }
    }

    // Phase 5: 模式沉淀
    run.status = TaotieRunStatus.DISTILLING
    run.phase = TaotiePhase.PATTERN_DISTILLATION
    run.updatedAt = Date.now()

    // 保存成功注入的模式到目标技能的 patterns 字段
    const retainedSteps = run.injectionSteps.filter(s => s.retained)
    const distilledPatterns: FusionPattern[] = []

    for (const step of retainedSteps) {
      const pattern = run.reverseEngineering.patterns.find(p => p.id === step.patternId)
      if (!pattern) continue

      const fp: FusionPattern = {
        id: `${run.targetSkillName}_${pattern.id}_${Date.now()}`,
        name: pattern.name,
        description: pattern.description,
        sourceSkill: run.sourceSkillName,
        effectDimensions: pattern.effectDimensions,
        appliedCount: 1,
        createdAt: Date.now(),
        lastAppliedAt: Date.now(),
        avgImprovement: step.afterScore - step.beforeScore,
      }
      distilledPatterns.push(fp)
    }

    run.distilledPatterns = distilledPatterns

    // 如果有实际提升，将修改写回技能库
    if (currentScore > initialScore + minImprovement && currentBody !== target.body) {
      await this.registry.updateSkill(target.id, {
        body: currentBody,
        frontmatter: {
          ...currentFrontmatter,
          // 合并新模式到 patterns
          patterns: [
            ...(target.frontmatter.patterns || []),
            ...distilledPatterns.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description,
              effect: p.effectDimensions,
              appliedCount: p.appliedCount,
              createdAt: p.createdAt,
            })),
          ],
        },
        bumpLevel: 'minor',
        changelog: `饕餮融合：从 ${run.sourceSkillName} 吸收 ${retainedSteps.length} 个优势模式，得分 ${initialScore.toFixed(3)} → ${currentScore.toFixed(3)}`,
      })
      this.log('info', `Target skill updated: ${initialScore.toFixed(3)} -> ${currentScore.toFixed(3)}`)
    }

    // 记录整体变化
    run.overallDelta = {
      before: initialScore,
      after: currentScore,
      delta: currentScore - initialScore,
    }

    run.status = TaotieRunStatus.COMPLETED
    run.completedAt = Date.now()
    run.updatedAt = Date.now()

    this.log('info',
      `Fusion complete: ${run.targetSkillName} <<< ${run.sourceSkillName}, ` +
      `${retainedSteps.length}/${patterns.length} patterns retained, ` +
      `score delta=${(currentScore - initialScore).toFixed(4)}`
    )
  }

  /**
   * 注入单个模式并验证。返回注入步骤结果。
   */
  private async injectPattern(
    _runId: string,
    stepIndex: number,
    pattern: ReverseEngineeringResult['patterns'][number],
    currentBody: string,
    currentFrontmatter: Skill['frontmatter'],
    _currentScore: number,
  ): Promise<InjectionStepResult> {
    // 构造注入后的技能（模拟：基于模式建议做文本修改）
    // 实际项目中这里可以调用 LLM 做精准修改
    const modifiedBody = this.applyPatternToBody(currentBody, pattern)

    // 构造 GeneratedSkill
    const modifiedSkill: GeneratedSkill = {
      frontmatter: { ...currentFrontmatter },
      body: modifiedBody,
    }

    const mockRun = {
      id: `taotie_inject_${stepIndex}`,
      sourceSummary: `Injection step ${stepIndex}: ${pattern.name}`,
      sourceSessionIds: [],
      status: 'verifying' as any,
      triggerMode: 'manual' as any,
      currentIteration: 0,
      maxIterations: 1,
      iterationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // 验证修改后的技能
    let verification: VerificationResult
    try {
      verification = await this.verifier.verify(modifiedSkill, mockRun as any)
    } catch (err) {
      this.log('warn', `Verification failed for step ${stepIndex}: ${(err as Error).message}`)
      return {
        stepIndex,
        patternId: pattern.id,
        patternName: pattern.name,
        beforeScore: _currentScore,
        afterScore: _currentScore,
        retained: false,
        rollbackReason: `验证失败: ${(err as Error).message}`,
        dimensionDeltas: [],
        changeDescription: pattern.description,
      }
    }

    // 计算维度变化（简化：用总体得分判断）
    const beforeScore = _currentScore
    const afterScore = verification.overallScore
    const minImprovement = this.config.taotieMinImprovementThreshold ?? 0.02

    const dimensionDeltas: InjectionStepResult['dimensionDeltas'] = []
    // 因为没有原始各维度精确值，这里用 verification 的维度和基准对比
    // 简化处理：直接从验证结果的 dimensions 构建
    for (const dim of Object.values(QualityDimension)) {
      const after = verification.dimensions[dim] ?? 0
      dimensionDeltas.push({
        dimension: dim,
        before: beforeScore, // 用整体分近似
        after,
        delta: after - beforeScore,
      })
    }

    const retained = afterScore >= beforeScore + minImprovement

    return {
      stepIndex,
      patternId: pattern.id,
      patternName: pattern.name,
      beforeScore,
      afterScore,
      retained,
      rollbackReason: retained ? undefined : `提升不足（${(afterScore - beforeScore).toFixed(4)} < ${minImprovement}），已回滚`,
      dimensionDeltas,
      appliedBody: retained ? modifiedBody : undefined,
      changeDescription: pattern.injectionSuggestion,
    }
  }

  /**
   * 恢复注入（用户批准后继续执行剩余步骤）。
   */
  private async resumeInjection(runId: string): Promise<void> {
    const run = this.runs.get(runId)
    if (!run || !run.reverseEngineering) return

    const maxSteps = this.config.taotieMaxInjectionSteps ?? 5
    const minImprovement = this.config.taotieMinImprovementThreshold ?? 0.02
    const patterns = run.reverseEngineering.patterns.slice(0, maxSteps)

    // 从已完成的步骤数继续
    const startIndex = run.injectionSteps.length
    const target = this.registry.getSkillByName(run.targetSkillName)
    if (!target) return

    // 重建当前状态：最后一个 retained 的步骤决定当前 body
    let currentBody = target.body
    let currentScore = run.parallelTest?.targetScore ?? target.verificationScore ?? 0.5
    const initialScore = run.overallDelta?.before ?? currentScore

    for (const step of run.injectionSteps) {
      if (step.retained && step.appliedBody) {
        currentBody = step.appliedBody
        currentScore = step.afterScore
      }
    }

    for (let i = startIndex; i < patterns.length; i++) {
      const r = this.runs.get(runId)
      if (!r || r.status === TaotieRunStatus.CANCELLED) return
      if (r.status === TaotieRunStatus.PENDING_APPROVAL) {
        // 又遇到需要批准的步骤，停下
        return
      }

      const pattern = patterns[i]!

      // 人在回路
      if (!run.autoApprove && i > startIndex) {
        run.status = TaotieRunStatus.PENDING_APPROVAL
        run.pendingStepIndex = i
        run.updatedAt = Date.now()
        return
      }

      const stepResult = await this.injectPattern(
        runId, i, pattern, currentBody, target.frontmatter, currentScore
      )
      run.injectionSteps.push(stepResult)
      run.updatedAt = Date.now()

      if (stepResult.retained && stepResult.appliedBody) {
        currentBody = stepResult.appliedBody
        currentScore = stepResult.afterScore
      }
    }

    // 模式沉淀 & 收尾
    run.status = TaotieRunStatus.DISTILLING
    run.phase = TaotiePhase.PATTERN_DISTILLATION
    run.updatedAt = Date.now()

    const retainedSteps = run.injectionSteps.filter(s => s.retained)
    const distilledPatterns: FusionPattern[] = []

    for (const step of retainedSteps) {
      const pattern = run.reverseEngineering.patterns.find(p => p.id === step.patternId)
      if (!pattern) continue

      distilledPatterns.push({
        id: `${run.targetSkillName}_${pattern.id}_${Date.now()}`,
        name: pattern.name,
        description: pattern.description,
        sourceSkill: run.sourceSkillName,
        effectDimensions: pattern.effectDimensions,
        appliedCount: 1,
        createdAt: Date.now(),
        lastAppliedAt: Date.now(),
        avgImprovement: step.afterScore - step.beforeScore,
      })
    }

    run.distilledPatterns = distilledPatterns

    if (currentScore > initialScore + minImprovement && currentBody !== target.body) {
      await this.registry.updateSkill(target.id, {
        body: currentBody,
        frontmatter: {
          ...target.frontmatter,
          patterns: [
            ...(target.frontmatter.patterns || []),
            ...distilledPatterns.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description,
              effect: p.effectDimensions,
              appliedCount: p.appliedCount,
              createdAt: p.createdAt,
            })),
          ],
        },
        bumpLevel: 'minor',
        changelog: `饕餮融合：从 ${run.sourceSkillName} 吸收 ${retainedSteps.length} 个优势模式`,
      })
    }

    run.overallDelta = {
      before: initialScore,
      after: currentScore,
      delta: currentScore - initialScore,
    }

    run.status = TaotieRunStatus.COMPLETED
    run.completedAt = Date.now()
    run.updatedAt = Date.now()
  }

  // ============================================================
  // 内部辅助：相似度计算
  // ============================================================

  /**
   * 计算两个技能的整体语义相似度（0-1）。
   *
   * 基于多字段的关键词重叠度加权求和。
   */
  private calculateSkillSimilarity(a: Skill, b: Skill): number {
    const nameSim = this.tokenOverlap(
      this.tokenize(a.frontmatter.name),
      this.tokenize(b.frontmatter.name),
    )
    const descSim = this.tokenOverlap(
      this.tokenize(a.frontmatter.description),
      this.tokenize(b.frontmatter.description),
    )
    const whenSim = this.tokenOverlap(
      this.tokenize(a.frontmatter.whenToUse || ''),
      this.tokenize(b.frontmatter.whenToUse || ''),
    )
    const tagsSim = this.tokenOverlap(
      (a.frontmatter.tags || []).flatMap(t => this.tokenize(t)),
      (b.frontmatter.tags || []).flatMap(t => this.tokenize(t)),
    )
    const catSim = a.frontmatter.category && b.frontmatter.category
      ? (a.frontmatter.category === b.frontmatter.category ? 1 : 0)
      : 0

    // body 关键词（取前 1000 字符的高频词）
    const bodySim = this.tokenOverlap(
      this.tokenize(a.body.slice(0, 1000)),
      this.tokenize(b.body.slice(0, 1000)),
    )

    const score =
      nameSim * SIMILARITY_WEIGHTS.name +
      descSim * SIMILARITY_WEIGHTS.description +
      whenSim * SIMILARITY_WEIGHTS.whenToUse +
      tagsSim * SIMILARITY_WEIGHTS.tags +
      catSim * SIMILARITY_WEIGHTS.category +
      bodySim * SIMILARITY_WEIGHTS.bodyKeywords

    return Math.round(score * 1000) / 1000
  }

  /** 计算各维度相似度（名称、描述、标签等） */
  private calculateDimensionSimilarity(a: Skill, b: Skill): Record<string, number> {
    return {
      name: this.tokenOverlap(this.tokenize(a.frontmatter.name), this.tokenize(b.frontmatter.name)),
      description: this.tokenOverlap(
        this.tokenize(a.frontmatter.description),
        this.tokenize(b.frontmatter.description),
      ),
      whenToUse: this.tokenOverlap(
        this.tokenize(a.frontmatter.whenToUse || ''),
        this.tokenize(b.frontmatter.whenToUse || ''),
      ),
      tags: this.tokenOverlap(
        (a.frontmatter.tags || []).flatMap(t => this.tokenize(t)),
        (b.frontmatter.tags || []).flatMap(t => this.tokenize(t)),
      ),
      category: a.frontmatter.category === b.frontmatter.category ? 1 : 0,
    }
  }

  /** token 重叠度（Jaccard 相似度近似） */
  private tokenOverlap(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0
    const setA = new Set(a)
    const setB = new Set(b)
    let intersection = 0
    for (const token of setA) {
      if (setB.has(token)) intersection++
    }
    // 用较小集合的大小做分母，避免长文本稀释
    const minSize = Math.min(setA.size, setB.size)
    if (minSize < MIN_OVERLAP_FOR_SIMILARITY) {
      // token 太少时，用 Jaccard
      const union = setA.size + setB.size - intersection
      return union > 0 ? intersection / union : 0
    }
    return intersection / minSize
  }

  /** 简单中英文分词 */
  private tokenize(text: string): string[] {
    const lower = text.toLowerCase()
    const tokens: string[] = []

    // 英文单词（连续字母+数字）
    const wordRegex = /[a-z][a-z0-9_-]{2,}/g
    let match: RegExpExecArray | null
    while ((match = wordRegex.exec(lower)) !== null) {
      tokens.push(match[0]!)
    }

    // 中文双字词（简单的相邻字组合）
    const chineseChars = lower.match(/[\u4e00-\u9fa5]/g) || []
    for (let i = 0; i < chineseChars.length - 1; i++) {
      tokens.push(chineseChars[i]! + chineseChars[i + 1]!)
    }

    // 过滤停用词
    const stopwords = new Set(['的', '是', '在', '了', '和', '与', '或', '及', '等', 'this', 'that', 'the', 'and', 'for', 'with', 'from', 'you', 'your', 'will', 'can', 'use', 'using', 'used'])
    return tokens.filter(t => !stopwords.has(t) && t.length > 1)
  }

  /**
   * 将相似技能对聚类成组。
   */
  private clusterSimilarPairs(
    pairs: Array<{ a: string; b: string; similarity: number }>,
    skills: Skill[],
  ): SimilarSkillGroup[] {
    // 并查集
    const parent: Map<string, string> = new Map()
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x)
      let root = x
      while (parent.get(root) !== root) {
        root = parent.get(root) || root
      }
      // 路径压缩
      while (parent.get(x) !== root) {
        const next = parent.get(x) || root
        parent.set(x, root)
      }
      return root
    }
    const union = (a: string, b: string) => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) {
        parent.set(ra, rb)
      }
    }

    for (const pair of pairs) {
      union(pair.a, pair.b)
    }

    // 收集各组
    const groupsMap: Map<string, string[]> = new Map()
    for (const pair of pairs) {
      const root = find(pair.a)
      if (!groupsMap.has(root)) groupsMap.set(root, [])
      const group = groupsMap.get(root)!
      if (!group.includes(pair.a)) group.push(pair.a)
      if (!group.includes(pair.b)) group.push(pair.b)
    }

    const result: SimilarSkillGroup[] = []
    for (const [, members] of groupsMap) {
      if (members.length < 2) continue

      // 计算组内平均和最大相似度
      let totalSim = 0
      let maxSim = 0
      let pairCount = 0
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const pair = pairs.find(
            p => (p.a === members[i] && p.b === members[j]) ||
                 (p.a === members[j] && p.b === members[i])
          )
          if (pair) {
            totalSim += pair.similarity
            maxSim = Math.max(maxSim, pair.similarity)
            pairCount++
          }
        }
      }
      const avgSim = pairCount > 0 ? totalSim / pairCount : 0

      // 推荐 target 和 source：质量分最高的为 target，有独特优势的为 source
      const memberSkills = members
        .map(name => skills.find(s => s.frontmatter.name === name))
        .filter((s): s is Skill => !!s)
        .sort((a, b) =>
          (b.verificationScore ?? b.frontmatter.qualityScore ?? 0) -
          (a.verificationScore ?? a.frontmatter.qualityScore ?? 0)
        )

      const recommendedTarget = memberSkills[0]?.frontmatter.name || members[0]!
      const recommendedSource = memberSkills[1]?.frontmatter.name || members[1]!

      result.push({
        skills: members,
        avgSimilarity: Math.round(avgSim * 1000) / 1000,
        maxSimilarity: Math.round(maxSim * 1000) / 1000,
        recommendedTarget,
        recommendedSource,
      })
    }

    return result
  }

  // ============================================================
  // 内部辅助：技能分析
  // ============================================================

  /** 获取技能的各维度得分（优先用验证结果，否则估算） */
  private getSkillDimensionScores(skill: Skill): Record<QualityDimension, number> {
    const base = skill.verificationScore ?? skill.frontmatter.qualityScore ?? 0.6
    // 如果只有整体分，均匀分配各维度
    const dims: Record<string, number> = {}
    for (const dim of Object.values(QualityDimension)) {
      dims[dim] = base
    }
    return dims as Record<QualityDimension, number>
  }

  /** 分析两技能的结构差异 */
  private analyzeStructuralDifferences(target: Skill, source: Skill): string[] {
    const diffs: string[] = []

    const targetSections = this.extractSections(target.body)
    const sourceSections = this.extractSections(source.body)

    const targetNames = new Set(targetSections.map(s => s.name))
    const sourceNames = new Set(sourceSections.map(s => s.name))

    const onlyInSource = sourceSections.filter(s => !targetNames.has(s.name))
    const onlyInTarget = targetSections.filter(s => !sourceNames.has(s.name))

    if (onlyInSource.length > 0) {
      diffs.push(`source 独有章节：${onlyInSource.map(s => s.name).join('、')}`)
    }
    if (onlyInTarget.length > 0) {
      diffs.push(`target 独有章节：${onlyInTarget.map(s => s.name).join('、')}`)
    }

    // 步骤数量差异
    const targetSteps = this.countSteps(target.body)
    const sourceSteps = this.countSteps(source.body)
    if (Math.abs(targetSteps - sourceSteps) > 2) {
      diffs.push(`步骤数量差异：target ${targetSteps} 步 vs source ${sourceSteps} 步`)
    }

    // 长度差异
    const lenDiff = Math.abs(target.body.length - source.body.length)
    const maxLen = Math.max(target.body.length, source.body.length)
    if (maxLen > 0 && lenDiff / maxLen > 0.3) {
      diffs.push(`内容体量差异：target ${target.body.length} 字 vs source ${source.body.length} 字`)
    }

    return diffs
  }

  /** 从技能正文中提取章节（## 开头的标题） */
  private extractSections(body: string): Array<{ name: string; level: number; preview: string }> {
    const sections: Array<{ name: string; level: number; preview: string }> = []
    const lines = body.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const match = line.match(/^(#{2,4})\s+(.+)$/)
      if (match) {
        const level = match[1]!.length
        const name = match[2]!.trim().replace(/[*_`]/g, '')
        // 取章节前两行内容作为预览
        const previewLines: string[] = []
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const l = lines[j]!.trim()
          if (l && !l.startsWith('#') && previewLines.length < 2) {
            previewLines.push(l)
          }
        }
        sections.push({
          name: name.slice(0, 30),
          level,
          preview: previewLines.join(' ').slice(0, 60),
        })
      }
    }
    return sections
  }

  /** 判断两个章节名是否相似 */
  private sectionNameSimilar(a: string, b: string): boolean {
    if (a === b) return true
    const aTokens = this.tokenize(a)
    const bTokens = this.tokenize(b)
    return this.tokenOverlap(aTokens, bTokens) > 0.5
  }

  /** 推断章节对应的质量维度 */
  private inferDimensionForSection(sectionName: string): QualityDimension {
    const lower = sectionName.toLowerCase()
    if (lower.includes('验证') || lower.includes('检查') || lower.includes('确认') || lower.includes('verify')) {
      return QualityDimension.OPERATIONALITY
    }
    if (lower.includes('错误') || lower.includes('问题') || lower.includes('排查') || lower.includes('error') || lower.includes('troubleshoot')) {
      return QualityDimension.PRACTICALITY
    }
    if (lower.includes('步骤') || lower.includes('流程') || lower.includes('step') || lower.includes('流程')) {
      return QualityDimension.STRUCTURAL_COMPLETENESS
    }
    if (lower.includes('工具') || lower.includes('tool')) {
      return QualityDimension.PRACTICALITY
    }
    if (lower.includes('安全') || lower.includes('security') || lower.includes('安全')) {
      return QualityDimension.SECURITY
    }
    return QualityDimension.LOGICAL_CONSISTENCY
  }

  /** 章节的作用描述 */
  private sectionPurpose(sectionName: string): string {
    const lower = sectionName.toLowerCase()
    if (lower.includes('验证') || lower.includes('检查')) return '确认每一步的正确性'
    if (lower.includes('错误') || lower.includes('问题')) return '快速排查和解决问题'
    if (lower.includes('步骤')) return '按顺序执行操作'
    if (lower.includes('工具')) return '选择和使用合适的工具'
    if (lower.includes('安全')) return '避免安全风险'
    return '理解相关概念'
  }

  /** 计算技能中的步骤数量 */
  private countSteps(body: string): number {
    let count = 0
    const lines = body.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      // 数字编号步骤
      if (/^\d+[.、)）]/.test(trimmed)) count++
      // 有序列表（markdown）
      else if (/^[-*+]\s/.test(trimmed) && trimmed.length > 5) count++
    }
    return count
  }

  /** 检查是否有验证/检查相关章节 */
  private hasVerificationSection(body: string): boolean {
    const sections = this.extractSections(body)
    return sections.some(s => {
      const lower = s.name.toLowerCase()
      return lower.includes('验证') || lower.includes('检查') || lower.includes('确认') ||
             lower.includes('verify') || lower.includes('check') || lower.includes('validation')
    })
  }

  /** 检查是否有错误处理章节 */
  private hasErrorHandlingSection(body: string): boolean {
    const sections = this.extractSections(body)
    return sections.some(s => {
      const lower = s.name.toLowerCase()
      return lower.includes('错误') || lower.includes('问题') || lower.includes('排查') ||
             lower.includes('error') || lower.includes('troubleshoot') || lower.includes('faq')
    })
  }

  /** 从正文中提取工具名称（简单启发式） */
  private extractToolNames(body: string): string[] {
    const tools: string[] = []
    const patterns = [
      /使用[「「"']([^」」"']{2,20})[」」"']/g,
      /调用[「「"']([^」」"']{2,20})[」」"']/g,
      /(\w+(?:-\w+)*)\s*(?:tool|command|工具|命令)/gi,
    ]
    for (const pattern of patterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(body)) !== null) {
        const name = match[1]!.trim().toLowerCase()
        if (name.length > 2 && name.length < 30 && !tools.includes(name)) {
          tools.push(name)
        }
      }
    }
    return tools.slice(0, 10)
  }

  /** 生成融合建议列表 */
  private generateFusionSuggestions(
    target: Skill,
    source: Skill,
    sourceAdvantages: PairAnalysisReport['sourceAdvantages'],
    structuralDifferences: string[],
  ): PairAnalysisReport['fusionSuggestions'] {
    const suggestions: PairAnalysisReport['fusionSuggestions'] = []

    // 从 source 优势维度生成建议
    for (const adv of sourceAdvantages) {
      let title = ''
      let desc = ''
      switch (adv.dimension) {
        case QualityDimension.STRUCTURAL_COMPLETENESS:
          title = '补充结构完整性'
          desc = '参考 source 的章节结构，补充 target 缺少的关键部分（如验证步骤、错误处理等）'
          break
        case QualityDimension.LOGICAL_CONSISTENCY:
          title = '强化逻辑一致性'
          desc = '检查并修正 target 中步骤间的逻辑跳跃，确保因果链条完整'
          break
        case QualityDimension.OPERATIONALITY:
          title = '提升可操作性'
          desc = '将 target 中较笼统的描述细化为具体可执行的步骤，增加操作指引'
          break
        case QualityDimension.PRACTICALITY:
          title = '增强实用性'
          desc = '补充更多真实场景的应用示例和常见问题处理方法'
          break
        case QualityDimension.SECURITY:
          title = '加强安全性'
          desc = '补充安全注意事项和风险防范措施'
          break
        default:
          title = `提升${adv.label}`
          desc = `参考 source 在${adv.label}方面的优势，补强 target 的对应部分`
      }

      const priority: 'high' | 'medium' | 'low' =
        adv.gap >= 0.15 ? 'high' : adv.gap >= 0.08 ? 'medium' : 'low'

      suggestions.push({
        id: `sug_${suggestions.length}`,
        title,
        description: desc,
        targetDimension: adv.dimension,
        priority,
      })
    }

    // 从结构差异补充建议
    if (structuralDifferences.some(d => d.includes('独有章节'))) {
      const dim = QualityDimension.STRUCTURAL_COMPLETENESS
      if (!suggestions.some(s => s.targetDimension === dim)) {
        suggestions.push({
          id: `sug_${suggestions.length}`,
          title: '借鉴章节结构',
          description: '参考 source 的章节组织方式，优化 target 的结构层次',
          targetDimension: dim,
          priority: 'medium',
        })
      }
    }

    return suggestions.sort((a, b) => {
      const prioRank = { high: 0, medium: 1, low: 2 }
      return prioRank[a.priority] - prioRank[b.priority]
    })
  }

  /**
   * 将模式应用到技能正文中（文本级别的修改）。
   *
   * 简化实现：根据模式类型做不同的文本插入/修改策略。
   * 实际生产环境中应调用 LLM 做精准修改。
   */
  private applyPatternToBody(body: string, pattern: ReverseEngineeringResult['patterns'][number]): string {
    // 基于模式 ID 前缀判断类型，做对应的文本修改
    const lines = body.split('\n')

    if (pattern.id.startsWith('pattern_verify')) {
      // 在末尾添加验证检查点章节
      return body + '\n\n## 验证检查点\n\n完成每一步后，请确认：\n\n1. 上一步的输出是否符合预期\n2. 是否有异常或错误信息\n3. 关键指标是否在合理范围内\n\n如果发现问题，回退到上一个确认通过的步骤重新操作。'
    }

    if (pattern.id.startsWith('pattern_errors')) {
      // 在末尾添加常见问题章节
      return body + '\n\n## 常见问题与排查\n\n### 问题 1：步骤执行失败\n- 可能原因：环境配置不正确\n- 解决方法：检查依赖版本和配置文件，重新执行\n\n### 问题 2：输出结果不符合预期\n- 可能原因：输入参数有误\n- 解决方法：核对输入参数，参考示例确认格式正确\n\n### 问题 3：执行缓慢\n- 可能原因：数据量过大或资源不足\n- 解决方法：分批处理或提升资源配置'
    }

    if (pattern.id.startsWith('pattern_steps')) {
      // 在第一个步骤列表处增加子步骤说明
      // 简化实现：在开头加一段说明
      const firstHeading = lines.findIndex(l => l.startsWith('## '))
      if (firstHeading >= 0) {
        const insertAfter = firstHeading + 2
        const newLines = [
          '',
          '> **操作提示**：每一步完成后请确认结果正确再继续。',
          '> 如果某一步不明确，可以先在小范围验证再全面执行。',
          '',
        ]
        lines.splice(insertAfter, 0, ...newLines)
        return lines.join('\n')
      }
    }

    if (pattern.id.startsWith('pattern_tools')) {
      // 在开头工具说明处补充工具
      const firstHeading = lines.findIndex(l => l.startsWith('## '))
      if (firstHeading >= 0) {
        const insertAfter = firstHeading + 2
        const newLines = [
          '',
          '**推荐工具**：根据场景可灵活选用合适的工具组合，提高效率。',
          '',
        ]
        lines.splice(insertAfter, 0, ...newLines)
        return lines.join('\n')
      }
    }

    if (pattern.id.startsWith('pattern_struct_')) {
      // 新增章节：追加到末尾
      const sectionName = pattern.name.replace('新增「', '').replace('」章节', '')
      return body + `\n\n## ${sectionName}\n\n${pattern.description}\n\n请结合具体场景灵活应用本节内容。`
    }

    // 默认：在末尾添加改进说明
    return body + `\n\n## 改进说明\n\n${pattern.description}\n\n${pattern.injectionSuggestion}`
  }

  /** 构建降级的验证结果（当 LLM 调用失败时） */
  private buildFallbackVerification(skill: Skill): VerificationResult {
    const score = skill.verificationScore ?? skill.frontmatter.qualityScore ?? 0.5
    const dimensions: Record<QualityDimension, number> = {
      [QualityDimension.STRUCTURAL_COMPLETENESS]: score,
      [QualityDimension.LOGICAL_CONSISTENCY]: score,
      [QualityDimension.OPERATIONALITY]: score,
      [QualityDimension.PRACTICALITY]: score,
      [QualityDimension.SECURITY]: score,
    }
    return {
      totalTests: 5,
      passedTests: Math.round(score * 5),
      failedTests: 5 - Math.round(score * 5),
      testResults: [],
      overallScore: score,
      passed: score >= 0.8,
      dimensions,
      improvementSuggestions: [],
      failurePatterns: {},
    }
  }

  /** 从所有技能中刷新全局模式库 */
  private refreshGlobalPatterns(): void {
    this.globalPatterns.clear()
    const skills = this.registry.listSkills(SkillStatus.ACTIVE)
    for (const skill of skills) {
      const patterns = skill.frontmatter.patterns || []
      for (const p of patterns) {
        if (!this.globalPatterns.has(p.id)) {
          this.globalPatterns.set(p.id, {
            id: p.id,
            name: p.name,
            description: p.description,
            sourceSkill: skill.frontmatter.name,
            effectDimensions: p.effect as QualityDimension[],
            appliedCount: p.appliedCount,
            createdAt: p.createdAt,
          })
        }
      }
    }
  }
}
