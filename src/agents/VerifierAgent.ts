/**
 * VerifierAgent —— 验证 Agent
 *
 * Gate 3: 自动生成多维度测试用例并验证技能质量。
 * 覆盖 5 个质量维度：结构完整性、逻辑一致性、可操作性、实用性、安全性。
 */

import { BaseAgent } from './BaseAgent.js'
import type {
  GeneratedSkill,
  ForgeRun,
  VerificationResult,
  TestResult,
  TestIssue,
  SkillForgeConfig,
} from '../types.js'
import {
  QualityDimension,
  QUALITY_DIMENSION_WEIGHTS,
  QUALITY_DIMENSION_LABELS,
} from '../types.js'
import { SYSTEM_PROMPTS } from '../prompts/index.js'

/** 测试用例接口 */
interface TestCase {
  id: string
  name: string
  category: QualityDimension
  input: string
}

/** LLM 评估返回结构 */
interface JudgeResult {
  passed: boolean
  score: number
  output: string
  feedback: string
  issues: TestIssue[]
}

export class VerifierAgent extends BaseAgent {
  constructor(ctx: unknown, config: SkillForgeConfig) {
    super(ctx, config)
  }

  /** 低温验证/优化调用（减少随机性） */
  protected async callLLMLow(systemPrompt: string, userPrompt: string): Promise<any> {
    return this.callLLM(systemPrompt, userPrompt, 'mimo-v2.5-pro', 0.3)
  }

  /**
   * 验证技能（多维度质量评估）
   */
  async verify(skill: GeneratedSkill, run: ForgeRun): Promise<VerificationResult> {
    this.log('info', `Verifying skill: ${skill.frontmatter.name}`)

    // Step 1: 生成多维度测试用例
    const testCases = await this.generateTestCases(skill, run)

    // Step 2: 执行测试（LLM 模拟验证，返回详细结果）
    const testResults: TestResult[] = []
    for (const testCase of testCases) {
      const result = await this.runTest(skill, testCase)
      testResults.push(result)
    }

    // Step 3: 汇总各维度得分
    const dimensions = this.calculateDimensionScores(testResults)

    // Step 4: 计算加权总体得分
    const overallScore = this.calculateWeightedScore(dimensions)

    // Step 5: 生成改进建议
    const improvementSuggestions = this.generateSuggestions(testResults)

    // Step 6: 失败模式分类
    const failurePatterns = this.classifyFailurePatterns(testResults)

    const passedTests = testResults.filter(r => r.passed).length
    const total = testResults.length
    const passThreshold = 0.8 // 合理阈值：0.81 分就能通过，不用触发迭代

    this.log('info',
      `Verification complete: ${passedTests}/${total} passed, ` +
      `overallScore=${overallScore.toFixed(2)}, threshold=${passThreshold}`
    )

    // 打印各维度得分
    for (const [dim, score] of Object.entries(dimensions)) {
      const label = QUALITY_DIMENSION_LABELS[dim as QualityDimension] || dim
      this.log('info', `  ${label}: ${(score * 100).toFixed(0)}%`)
    }

    return {
      totalTests: total,
      passedTests,
      failedTests: total - passedTests,
      testResults,
      overallScore,
      passed: overallScore >= passThreshold,
      dimensions,
      improvementSuggestions,
      failurePatterns,
    }
  }

  /**
   * 生成多维度测试用例
   */
  private async generateTestCases(skill: GeneratedSkill, run: ForgeRun): Promise<TestCase[]> {
    try {
      const result = await this.callLLMLow(
        SYSTEM_PROMPTS.verifier_casegen,
        `## 技能信息
名称: ${skill.frontmatter.name}
描述: ${skill.frontmatter.description}
适用场景: ${skill.frontmatter.whenToUse}

## 技能正文
${skill.body.substring(0, 3000)}
`,
      )

      if (result.testCases && Array.isArray(result.testCases)) {
        const validCases = (result.testCases as Array<Record<string, unknown>>)
          .filter((tc): tc is { id: string; name: string; category: string; input: string } =>
            typeof tc.id === 'string' && typeof tc.name === 'string' &&
            typeof tc.category === 'string' && typeof tc.input === 'string'
          )
          .map((tc): TestCase => ({
            id: tc.id,
            name: tc.name,
            category: tc.category as QualityDimension,
            input: tc.input,
          }))
          .slice(0, 8)

        // 确保 5 个维度都至少覆盖到
        const covered = new Set(validCases.map(c => c.category))
        const allDims = Object.values(QualityDimension)
        for (const dim of allDims) {
          if (!covered.has(dim)) {
            validCases.push(this.fallbackTestCase(dim, skill))
          }
        }

        return validCases
      }
    } catch (err) {
      this.log('warn', `Test case generation failed: ${(err as Error).message}`)
    }

    // 降级：每个维度返回一个默认测试用例
    return Object.values(QualityDimension).map(dim =>
      this.fallbackTestCase(dim, skill)
    )
  }

  /**
   * 生成某个维度的默认降级测试用例
   */
  private fallbackTestCase(dim: QualityDimension, skill: GeneratedSkill): TestCase {
    const label = QUALITY_DIMENSION_LABELS[dim]
    const inputs: Record<QualityDimension, string> = {
      [QualityDimension.STRUCTURAL_COMPLETENESS]:
        `检查技能"${skill.frontmatter.name}"的结构是否完整，是否包含 frontmatter、步骤说明、验证方法、错误处理等必要要素`,
      [QualityDimension.LOGICAL_CONSISTENCY]:
        `检查技能"${skill.frontmatter.name}"的步骤之间是否逻辑自洽，前后描述是否矛盾`,
      [QualityDimension.OPERATIONALITY]:
        `检查技能"${skill.frontmatter.name}"的每一步是否具体可操作，是否存在含糊其辞的描述`,
      [QualityDimension.PRACTICALITY]:
        `检查技能"${skill.frontmatter.name}"在实际场景中是否真正有用，是否能解决实际问题`,
      [QualityDimension.SECURITY]:
        `检查技能"${skill.frontmatter.name}"是否存在安全隐患，如危险操作、隐私泄露、越权等`,
    }
    return {
      id: `tc_fallback_${dim}`,
      name: `${label}基础检查`,
      category: dim,
      input: inputs[dim],
    }
  }

  /**
   * 运行单个测试，返回详细评估结果
   */
  private async runTest(skill: GeneratedSkill, testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now()
    const dimLabel = QUALITY_DIMENSION_LABELS[testCase.category] || testCase.category

    try {
      const result = await this.callLLMLow(
        SYSTEM_PROMPTS.verifier_judge,
        `## 技能名称: ${skill.frontmatter.name}

## 技能描述: ${skill.frontmatter.description}

## 技能正文
${skill.body.substring(0, 3000)}

## 测试维度: ${dimLabel} (${testCase.category})
## 测试用例: ${testCase.name}
测试输入: ${testCase.input}
`,
      ) as JudgeResult

      const passed = result.passed === true
      const score = this.normalizeScore(result.score)
      const issues: TestIssue[] = Array.isArray(result.issues)
        ? result.issues.map((i: TestIssue) => ({
            severity: (i.severity as TestIssue['severity']) || 'minor',
            description: (i.description as string) || '',
            location: i.location as string | undefined,
            suggestion: i.suggestion as string | undefined,
          }))
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

  /**
   * 计算各维度平均得分
   */
  private calculateDimensionScores(results: TestResult[]): Record<QualityDimension, number> {
    const dims = Object.values(QualityDimension)
    const scores: Record<string, number> = {}

    for (const dim of dims) {
      const dimResults = results.filter(r => r.category === dim)
      if (dimResults.length === 0) {
        scores[dim] = 0
      } else {
        const avg = dimResults.reduce((sum, r) => sum + r.score, 0) / dimResults.length
        scores[dim] = Math.round(avg * 100) / 100
      }
    }

    return scores as Record<QualityDimension, number>
  }

  /**
   * 计算加权总体得分
   */
  private calculateWeightedScore(dimensions: Record<QualityDimension, number>): number {
    let total = 0
    let totalWeight = 0
    for (const dim of Object.values(QualityDimension)) {
      const weight = QUALITY_DIMENSION_WEIGHTS[dim] || 0
      total += (dimensions[dim] || 0) * weight
      totalWeight += weight
    }
    const score = totalWeight > 0 ? total / totalWeight : 0
    return Math.round(score * 100) / 100
  }

  /**
   * 从测试结果中提取改进建议
   */
  private generateSuggestions(results: TestResult[]): string[] {
    const suggestions: string[] = []
    const seen = new Set<string>()

    for (const result of results) {
      // 从每个 issue 的 suggestion 提取
      for (const issue of result.issues) {
        const text = issue.suggestion || issue.description
        const key = text.substring(0, 60)
        if (!seen.has(key) && issue.severity !== 'info') {
          seen.add(key)
          const dimLabel = QUALITY_DIMENSION_LABELS[result.category] || result.category
          suggestions.push(`[${dimLabel}] ${text}`)
        }
      }
      // 从 feedback 中提取非通过项的反馈
      if (!result.passed && result.feedback) {
        const key = result.feedback.substring(0, 60)
        if (!seen.has(key)) {
          seen.add(key)
          const dimLabel = QUALITY_DIMENSION_LABELS[result.category] || result.category
          suggestions.push(`[${dimLabel}] ${result.feedback}`)
        }
      }
    }

    // 按问题严重程度排序（有 critical issue 的测试项优先）
    return suggestions.slice(0, 10)
  }

  /**
   * 失败模式分类
   */
  private classifyFailurePatterns(results: TestResult[]): Record<string, number> {
    const patterns: Record<string, number> = {}

    for (const result of results) {
      if (result.passed) continue

      // 按维度分类
      const dimLabel = QUALITY_DIMENSION_LABELS[result.category] || result.category
      const dimKey = `${dimLabel}不足`
      patterns[dimKey] = (patterns[dimKey] || 0) + 1

      // 按 issue 严重程度分类
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

  /**
   * 规范化分数到 0-1 范围
   */
  private normalizeScore(score: unknown): number {
    const num = typeof score === 'number' ? score : parseFloat(String(score))
    if (isNaN(num)) return 0.5
    return Math.max(0, Math.min(1, num))
  }
}
