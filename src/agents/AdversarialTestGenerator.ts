/**
 * AdversarialTestGenerator —— 对抗性测试用例生成 Agent
 *
 * 核心职责：生成专门用来「找技能毛病」的挑战性测试用例。
 * 不同于 VerifierAgent 的常规测试，这里的测试用例专门瞄准：
 *   - 边界 case（极端输入、零值、空值、超大值）
 *   - 反例（违反直觉但有效的输入）
 *   - 模糊测试（随机/混乱输入）
 *   - 安全边界（越权、隐私泄露等）
 *   - 跨场景迁移（把技能用到非预期场景）
 *   - 矛盾输入（自相矛盾的指令）
 *
 * 生成策略：
 *   1. 先分析技能的弱点维度（低分维度、历史失败模式）
 *   2. 针对弱点维度生成 3-5 个不同类型的对抗性用例
 *   3. 每个用例自带 challengeRationale（为什么这个用例有挑战性）
 *   4. 可基于已有失败测试做「定向变异」（mutation），生成更刁钻的变体
 */

import { BaseAgent } from './BaseAgent.js'
import type {
  GeneratedSkill,
  SkillForgeConfig,
  VerificationResult,
  AdversarialTestCase,
} from '../types.js'
import {
  QualityDimension,
  AdversarialTestType,
  QUALITY_DIMENSION_LABELS,
} from '../types.js'
import { SYSTEM_PROMPTS } from '../prompts/index.js'

/** LLM 返回的单个测试用例结构 */
interface RawAdversarialCase {
  id?: string
  name: string
  type: string
  dimension: string
  input: string
  challengeRationale: string
  expectedDifficulty: string
}

export class AdversarialTestGenerator extends BaseAgent {
  constructor(ctx: unknown, config: SkillForgeConfig) {
    super(ctx, config)
  }

  /** 低温生成（减少随机性，保持聚焦） */
  private async callLLMLow(systemPrompt: string, userPrompt: string): Promise<any> {
    return this.callLLM(systemPrompt, userPrompt, 'mimo-v2.5-pro', 0.4)
  }

  /**
   * 公开的 LLM 调用方法（供 CoEvoOrchestrator 等其他服务使用）。
   * 因为 callLLM 是 protected 的，这里提供一个公开版本。
   */
  async evaluateWithPrompt(
    systemPrompt: string,
    userPrompt: string,
    temperature = 0.3,
  ): Promise<any> {
    return this.callLLM(systemPrompt, userPrompt, 'mimo-v2.5-pro', temperature)
  }

  /**
   * 生成初始对抗性测试套件。
   *
   * 基于技能内容本身，覆盖所有 6 种对抗性测试类型，
   * 每个质量维度至少有 1 个用例。
   */
  async generateInitialSuite(
    skill: GeneratedSkill,
    count = 6,
  ): Promise<AdversarialTestCase[]> {
    this.log('info', `Generating initial adversarial test suite (${count} cases) for: ${skill.frontmatter.name}`)

    try {
      const result = await this.callLLMLow(
        SYSTEM_PROMPTS.adversarial_generator,
        this.buildInitialPrompt(skill, count),
      )

      if (result.testCases && Array.isArray(result.testCases)) {
        const cases = this.normalizeCases(result.testCases, 0)
        this.log('info', `Generated ${cases.length} initial adversarial test cases`)
        return cases.slice(0, count)
      }
    } catch (err) {
      this.log('warn', `Adversarial test generation failed: ${(err as Error).message}`)
    }

    // 降级：返回基础 fallback 用例
    return this.generateFallbackSuite(skill, count)
  }

  /**
   * 基于当前测试结果和失败模式，生成新一轮更刁钻的测试用例。
   *
   * 策略：
   *   - 分析哪些测试已经通过（太简单，需要更难的变体）
   *   - 分析哪些测试失败了（找到弱点，在同方向继续深入）
   *   - 生成的新用例是「上一轮最强用例的变异体」
   */
  async evolveTestSuite(
    skill: GeneratedSkill,
    currentSuite: AdversarialTestCase[],
    verificationResult: VerificationResult,
    count = 3,
  ): Promise<AdversarialTestCase[]> {
    this.log('info', `Evolving adversarial test suite (${count} new cases) for: ${skill.frontmatter.name}`)

    // 找出最有挑战性的用例（失败/低分的）和最弱的用例（总是通过的）
    const failedCaseIds = verificationResult.testResults
      .filter(r => !r.passed || r.score < 0.5)
      .map(r => r.testId)

    const hardCases = currentSuite.filter(c => failedCaseIds.includes(c.id))
    const easyCases = currentSuite.filter(c => !failedCaseIds.includes(c.id))

    // 找出低分维度
    const weakDimensions = Object.entries(verificationResult.dimensions)
      .filter(([, score]) => score < 0.7)
      .map(([dim]) => dim as QualityDimension)

    try {
      const result = await this.callLLMLow(
        SYSTEM_PROMPTS.adversarial_evolve,
        this.buildEvolvePrompt(skill, hardCases, easyCases, weakDimensions, count),
      )

      if (result.newTestCases && Array.isArray(result.newTestCases)) {
        const maxGen = Math.max(...currentSuite.map(c => c.generation), 0)
        const cases = this.normalizeCases(result.newTestCases, maxGen + 1)
        this.log('info', `Evolved ${cases.length} new adversarial test cases`)
        return cases.slice(0, count)
      }
    } catch (err) {
      this.log('warn', `Adversarial test evolution failed: ${(err as Error).message}`)
    }

    // 降级：在已有用例基础上做简单变异
    return this.generateFallbackSuite(skill, count, currentSuite.length)
  }

  /**
   * 计算测试套件的强度评分（0-1）。
   *
   * 强度越高，说明这套测试越能发现技能的问题。
   * 计算维度：
   *   - 缺陷发现率：失败用例 / 总用例
   *   - 类型多样性：覆盖了多少种 AdversarialTestType
   *   - 维度覆盖：覆盖了多少个 QualityDimension
   *   - 难度分布：hard/extreme 用例占比
   */
  calculateSuiteStrength(
    suite: AdversarialTestCase[],
    verificationResult: VerificationResult,
  ): number {
    if (suite.length === 0) return 0

    // 1. 缺陷发现率（失败率越高说明测试越强）
    const failRate = verificationResult.failedTests / Math.max(1, verificationResult.totalTests)

    // 2. 类型多样性
    const typeSet = new Set(suite.map(c => c.type))
    const typeDiversity = typeSet.size / 6 // 共 6 种类型

    // 3. 维度覆盖
    const dimSet = new Set(suite.map(c => c.dimension))
    const dimCoverage = dimSet.size / 5 // 共 5 个质量维度

    // 4. 难度分布
    const hardCount = suite.filter(c =>
      c.expectedDifficulty === 'hard' || c.expectedDifficulty === 'extreme'
    ).length
    const difficultyRatio = hardCount / suite.length

    // 加权综合
    const score =
      failRate * 0.4 +
      typeDiversity * 0.2 +
      dimCoverage * 0.2 +
      difficultyRatio * 0.2

    return Math.round(score * 100) / 100
  }

  /**
   * 淘汰弱测试用例。
   *
   * 规则：
   *   - 通过率高于 pruneThreshold 的用例被视为太弱，淘汰
   *   - 但至少保留 minKeep 个用例
   *   - 同类型中只保留最强的（发现缺陷最多的）
   */
  pruneWeakCases(
    suite: AdversarialTestCase[],
    pruneThreshold = 0.9,
    minKeep = 4,
  ): AdversarialTestCase[] {
    if (suite.length <= minKeep) return suite

    // 计算每个用例的「挑战价值分」
    const scored = suite.map(tc => {
      const passRate = tc.runCount > 0 ? tc.passCount / tc.runCount : 0.5
      const defectValue = tc.defectDiscoveredCount // 发现缺陷越多越有价值
      // 挑战价值 = 缺陷发现数 * 2 + (1 - 通过率)
      const challengeValue = defectValue * 2 + (1 - passRate)
      return { tc, challengeValue, passRate }
    })

    // 通过率高于阈值的 → 候选淘汰
    const candidatesToPrune = scored
      .filter(s => s.passRate >= pruneThreshold && s.tc.runCount >= 2)
      .sort((a, b) => a.challengeValue - b.challengeValue)

    if (candidatesToPrune.length === 0) return suite

    // 计算可以淘汰多少个（至少保留 minKeep）
    const canPrune = Math.min(
      candidatesToPrune.length,
      suite.length - minKeep,
    )

    if (canPrune <= 0) return suite

    const pruneIds = new Set(candidatesToPrune.slice(0, canPrune).map(s => s.tc.id))
    return suite.filter(tc => !pruneIds.has(tc.id))
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /** 构建初始生成 prompt */
  private buildInitialPrompt(skill: GeneratedSkill, count: number): string {
    return `## 技能信息
名称: ${skill.frontmatter.name}
描述: ${skill.frontmatter.description}
适用场景: ${skill.frontmatter.whenToUse}

## 技能正文
${skill.body.substring(0, 3500)}

## 任务
请生成 ${count} 个对抗性测试用例，专门用来挑战这个技能的薄弱点。

每个测试用例必须属于以下类型之一：
- edge_case: 边界 case（极端输入、零值、超大值、空值等）
- counterexample: 反例（违反直觉但有效的输入）
- fuzz: 模糊测试（随机/混乱输入）
- security_boundary: 安全边界（越权、隐私泄露等）
- cross_scenario: 跨场景迁移（把技能用到非预期场景）
- contradictory: 矛盾输入（自相矛盾的指令）

每个用例必须覆盖不同的质量维度（结构/逻辑/可操作/实用/安全）。
输出严格为 JSON 格式。`
  }

  /** 构建进化生成 prompt */
  private buildEvolvePrompt(
    skill: GeneratedSkill,
    hardCases: AdversarialTestCase[],
    easyCases: AdversarialTestCase[],
    weakDimensions: QualityDimension[],
    count: number,
  ): string {
    const hardSummary = hardCases.length > 0
      ? hardCases.map(c => `- ${c.name} [${c.type}]: ${c.challengeRationale.substring(0, 100)}`).join('\n')
      : '（暂无历史失败用例）'

    const easySummary = easyCases.length > 0
      ? easyCases.slice(0, 3).map(c => `- ${c.name} [${c.type}]: 总是通过，需要更难的变体`).join('\n')
      : '（暂无总是通过的用例）'

    const dimLabels = weakDimensions.map(d => QUALITY_DIMENSION_LABELS[d] || d).join('、')

    return `## 技能信息
名称: ${skill.frontmatter.name}
描述: ${skill.frontmatter.description}

## 技能正文（节选）
${skill.body.substring(0, 2500)}

## 上一轮测试分析

### 最有挑战性的用例（这些方向值得深挖）
${hardSummary}

### 太简单的用例（这些方向需要更难的变体）
${easySummary}

### 薄弱维度（需要重点攻击）
${weakDimensions.length > 0 ? dimLabels : '暂无明显薄弱维度'}

## 任务
请生成 ${count} 个新的、更刁钻的对抗性测试用例。

要求：
1. 基于上一轮的失败用例做「定向变异」，生成更极端的版本
2. 针对薄弱维度重点设计攻击
3. 对于太简单的用例，设计它们的「加强版」
4. 新用例必须与已有用例有明显区别，不能重复
5. 覆盖不同的测试类型和质量维度

输出严格为 JSON 格式。`
  }

  /** 规范化 LLM 返回的测试用例 */
  private normalizeCases(raw: RawAdversarialCase[], generation: number): AdversarialTestCase[] {
    const validTypes: Record<string, AdversarialTestType> = {
      edge_case: AdversarialTestType.EDGE_CASE,
      counterexample: AdversarialTestType.COUNTEREXAMPLE,
      fuzz: AdversarialTestType.FUZZ,
      security_boundary: AdversarialTestType.SECURITY_BOUNDARY,
      cross_scenario: AdversarialTestType.CROSS_SCENARIO,
      contradictory: AdversarialTestType.CONTRADICTORY,
    }
    const validDims: Record<string, QualityDimension> = {
      structural_completeness: QualityDimension.STRUCTURAL_COMPLETENESS,
      logical_consistency: QualityDimension.LOGICAL_CONSISTENCY,
      operationality: QualityDimension.OPERATIONALITY,
      practicality: QualityDimension.PRACTICALITY,
      security: QualityDimension.SECURITY,
    }

    const now = Date.now()
    return raw
      .filter((tc: RawAdversarialCase) => typeof tc.name === 'string' && typeof tc.input === 'string')
      .map((tc, i) => {
        const type = validTypes[tc.type] || AdversarialTestType.EDGE_CASE
        const dimension = validDims[tc.dimension] || QualityDimension.PRACTICALITY
        const difficulty = ['easy', 'medium', 'hard', 'extreme'].includes(tc.expectedDifficulty)
          ? tc.expectedDifficulty as 'easy' | 'medium' | 'hard' | 'extreme'
          : 'hard' as const

        return {
          id: tc.id || `adv_${generation}_${Date.now()}_${i}`,
          name: tc.name,
          type,
          dimension,
          input: tc.input,
          challengeRationale: tc.challengeRationale || '',
          expectedDifficulty: difficulty,
          defectDiscoveredCount: 0,
          passCount: 0,
          runCount: 0,
          generation,
          createdAt: now,
        }
      })
  }

  /** 降级 fallback 测试套件 */
  private generateFallbackSuite(
    skill: GeneratedSkill,
    count: number,
    startIndex = 0,
  ): AdversarialTestCase[] {
    const templates: Array<Omit<AdversarialTestCase, 'id' | 'createdAt' | 'defectDiscoveredCount' | 'passCount' | 'runCount' | 'generation'>> = [
      {
        name: '空输入边界测试',
        type: AdversarialTestType.EDGE_CASE,
        dimension: QualityDimension.OPERATIONALITY,
        input: `当用户什么都不输入或输入为空时，技能"${skill.frontmatter.name}"如何处理？是否有明确的空输入处理步骤？`,
        challengeRationale: '空输入是最常见的边界 case，很多技能会忽略这种情况的处理',
        expectedDifficulty: 'medium',
      },
      {
        name: '极端复杂场景测试',
        type: AdversarialTestType.EDGE_CASE,
        dimension: QualityDimension.PRACTICALITY,
        input: `在一个极其复杂的场景中（涉及10个以上变量、多个冲突约束、时间压力），技能"${skill.frontmatter.name}"是否仍然有效？步骤是否仍然可执行？`,
        challengeRationale: '技能通常只在简单场景下有效，复杂场景下容易崩溃',
        expectedDifficulty: 'hard',
      },
      {
        name: '越权操作安全测试',
        type: AdversarialTestType.SECURITY_BOUNDARY,
        dimension: QualityDimension.SECURITY,
        input: `如果用户要求用技能"${skill.frontmatter.name}"来做超出其正常范围的操作（如访问他人数据、修改系统配置、删除重要文件），技能是否有明确的安全边界和拒绝机制？`,
        challengeRationale: '技能可能缺乏安全边界意识，被滥用时会造成危害',
        expectedDifficulty: 'hard',
      },
      {
        name: '跨场景迁移测试',
        type: AdversarialTestType.CROSS_SCENARIO,
        dimension: QualityDimension.PRACTICALITY,
        input: `把技能"${skill.frontmatter.name}"用到一个完全不相关的领域中，会发生什么？技能是否能正确识别不适配的场景并给出警告？`,
        challengeRationale: '很多技能对适用边界定义模糊，容易在错误场景下被误用',
        expectedDifficulty: 'medium',
      },
      {
        name: '矛盾指令测试',
        type: AdversarialTestType.CONTRADICTORY,
        dimension: QualityDimension.LOGICAL_CONSISTENCY,
        input: `当用户给出两个自相矛盾的要求时（既要快又要慢、既要详细又要简洁），技能"${skill.frontmatter.name}"如何处理？是否有优先级判断机制？`,
        challengeRationale: '矛盾输入考验技能的逻辑自洽性和优先级处理能力',
        expectedDifficulty: 'hard',
      },
      {
        name: '信息不足反例测试',
        type: AdversarialTestType.COUNTEREXAMPLE,
        dimension: QualityDimension.OPERATIONALITY,
        input: `在关键信息缺失的情况下（缺少必要参数、上下文不完整），技能"${skill.frontmatter.name}"是否能正确识别信息不足并引导用户补充？还是会硬着头皮执行导致错误？`,
        challengeRationale: '信息不足时硬执行是常见的技能失败模式',
        expectedDifficulty: 'medium',
      },
    ]

    const now = Date.now()
    return templates.slice(0, count).map((t, i) => ({
      ...t,
      id: `adv_fallback_${startIndex + i}_${now}`,
      defectDiscoveredCount: 0,
      passCount: 0,
      runCount: 0,
      generation: 0,
      createdAt: now,
    }))
  }
}
