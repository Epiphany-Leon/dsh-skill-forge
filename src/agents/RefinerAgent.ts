/**
 * RefinerAgent —— 优化 Agent
 *
 * Gate 4: 根据验证结果迭代优化技能。
 * 借鉴 SkillOpt 思想，做增量修改而非重写。
 *
 * 升级要点：
 * 1. 利用多维度得分（dimensions）与改进建议（improvementSuggestions）做精准优化
 * 2. 结合失败模式（failurePatterns）定位共性问题，一次修一类 bug
 * 3. 高分维度（>0.8）保持不动，避免越改越差
 * 4. 严格不回退检查：新 overallScore 必须 >= 旧版本，否则回退
 * 5. 返回 changeSummary 说明本轮优化了什么、哪些维度提升
 */

import { BaseAgent } from './BaseAgent.js'
import type {
  GeneratedSkill,
  VerificationResult,
  ForgeRun,
  SkillForgeConfig,
  QualityDimension,
} from '../types.js'
import { QUALITY_DIMENSION_LABELS } from '../types.js'
import { SYSTEM_PROMPTS } from '../prompts/index.js'

/** 高分阈值：高于此值的维度不再修改 */
const HIGH_SCORE_THRESHOLD = 0.9 // 高于此分数的维度视为高分，不修改以避免回退

/** 精炼结果（含变更摘要） */
export interface RefineResult {
  skill: GeneratedSkill
  changeSummary: RefineChangeSummary
  rolledBack: boolean
  previousScore: number
  newScore: number
}

/** 变更摘要 */
export interface RefineChangeSummary {
  /** 本轮优化重点（维度中文名列表） */
  focusAreas: string[]
  /** 采纳的改进建议条数 */
  suggestionsApplied: number
  /** 针对的失败模式数量 */
  failurePatternsAddressed: number
  /** 维度提升情况（完整维度列表，含未改的） */
  dimensionDeltas: Array<{ name: string; key: QualityDimension; before: number; after: number; delta: number }>
  /** 变更描述（来自 LLM 的 changes 字段） */
  description: string
  /** 是否触发回退 */
  rolledBack: boolean
  /** 回退原因（若有） */
  rollbackReason?: string
  /** LLM 声称提升的维度 */
  claimedImprovements?: string[]
}

export class RefinerAgent extends BaseAgent {
  constructor(ctx: any, config: SkillForgeConfig) {
    super(ctx, config)
  }

  /** 低温验证/优化调用（减少随机性） */
  protected async callLLMLow(systemPrompt: string, userPrompt: string): Promise<any> {
    return this.callLLM(systemPrompt, userPrompt, 'mimo-v2.5-pro', 0.3)
  }

  /**
   * 根据验证结果优化技能（简化接口，兼容旧调用方式）。
   *
   * 注意：此方法不做回退检查，回退由 orchestrator 调用 checkNoRegression 处理。
   */
  async refine(
    skill: GeneratedSkill,
    verification: VerificationResult,
    run: ForgeRun,
  ): Promise<GeneratedSkill> {
    const result = await this.refineWithSummary(skill, verification, run)
    return result.skill
  }

  /**
   * 带摘要的完整精炼流程。
   *
   * 只负责生成精炼版本 + changeSummary，**不做回退检查**。
   * 调用方（orchestrator）拿到新版本后应重新验证，
   * 再调用 checkNoRegression 决定是否接受。
   */
  async refineWithSummary(
    skill: GeneratedSkill,
    verification: VerificationResult,
    run: ForgeRun,
  ): Promise<{ skill: GeneratedSkill; changeSummary: RefineChangeSummary }> {
    const iteration = run.currentIteration
    const previousScore = verification.overallScore
    this.log('info',
      `Refining skill (iteration ${iteration}): ${skill.frontmatter.name}, score=${previousScore.toFixed(3)}`
    )

    // Step 1: 识别低分维度与高分维度
    const lowDims = this.getLowScoreDimensions(verification)
    const highDims = this.getHighScoreDimensions(verification)

    if (lowDims.length === 0) {
      this.log('info', 'No low-score dimensions to fix; returning skill unchanged.')
      return {
        skill,
        changeSummary: {
          focusAreas: [],
          suggestionsApplied: 0,
          failurePatternsAddressed: 0,
          dimensionDeltas: this.allDimensionDeltas(verification, verification),
          description: '所有维度已达高分阈值，无需修改。',
          rolledBack: false,
          claimedImprovements: [],
        },
      }
    }

    this.log('info',
      `Focus dimensions: ${lowDims.map(d => `${d.name}(${d.score.toFixed(2)})`).join(', ')}; ` +
      `Protected (high-score): ${highDims.map(d => d.name).join(', ') || 'none'}`
    )

    // Step 2: 构建精准优化 prompt
    const raw = await this.callLLMLow(
      SYSTEM_PROMPTS.refiner,
      this.buildRefinePrompt(skill, verification, run, lowDims, highDims),
    )

    // Step 3: 校验结构
    const refinedSkill = this.validateRefinedSkill(raw, skill)

    const focusAreas = lowDims.map(d => d.name)
    const suggestionsCount = (verification.improvementSuggestions?.length || 0)
    const patternsCount = Object.keys(verification.failurePatterns || {}).length

    const changeSummary: RefineChangeSummary = {
      focusAreas,
      suggestionsApplied: suggestionsCount,
      failurePatternsAddressed: patternsCount,
      dimensionDeltas: this.allDimensionDeltas(verification, verification), // 占位，checkNoRegression 再填
      description: raw.changes || '已针对低分维度做增量优化。',
      rolledBack: false,
      claimedImprovements: raw.improvedDimensions || [],
    }

    this.log('info', `Refinement complete: ${raw.changes || 'changes applied'}`)

    return {
      skill: refinedSkill,
      changeSummary,
    }
  }

  /**
   * 不回退检查：比较新旧验证结果。
   *
   * 若新版本 overallScore < 旧版本，返回旧技能 + 回退标记。
   * 回退时 dimensionDeltas 也用旧值填充（delta 为 0）。
   */
  checkNoRegression(
    originalSkill: GeneratedSkill,
    refinedSkill: GeneratedSkill,
    oldVerification: VerificationResult,
    newVerification: VerificationResult,
    summary: RefineChangeSummary,
  ): RefineResult {
    const oldScore = oldVerification.overallScore
    const newScore = newVerification.overallScore

    // 计算各维度变化
    const dimensionDeltas = this.allDimensionDeltas(oldVerification, newVerification)
    summary.dimensionDeltas = dimensionDeltas

    if (newScore < oldScore) {
      const reason = `整体得分回退：${(oldScore * 100).toFixed(1)}% → ${(newScore * 100).toFixed(1)}%，触发回退。`
      this.log('warn', reason)
      summary.rolledBack = true
      summary.rollbackReason = reason
      // 回退意味着维度变化清零
      summary.dimensionDeltas = this.allDimensionDeltas(oldVerification, oldVerification)
      return {
        skill: originalSkill,
        changeSummary: summary,
        rolledBack: true,
        previousScore: oldScore,
        newScore: oldScore,
      }
    }

    // 额外检查：被标记为"保护"的高分维度是否有明显退化（>0.1）
    const protectedRegressions = dimensionDeltas.filter(d => {
      const before = d.before
      return before >= HIGH_SCORE_THRESHOLD && d.delta < -0.1
    })
    if (protectedRegressions.length > 0) {
      const names = protectedRegressions.map(d => d.name).join('、')
      const reason = `高分维度退化（${names}），触发回退。`
      this.log('warn', reason)
      summary.rolledBack = true
      summary.rollbackReason = reason
      summary.dimensionDeltas = this.allDimensionDeltas(oldVerification, oldVerification)
      return {
        skill: originalSkill,
        changeSummary: summary,
        rolledBack: true,
        previousScore: oldScore,
        newScore: oldScore,
      }
    }

    this.log('info',
      `No regression: ${(oldScore * 100).toFixed(1)}% → ${(newScore * 100).toFixed(1)}%`
    )
    return {
      skill: refinedSkill,
      changeSummary: summary,
      rolledBack: false,
      previousScore: oldScore,
      newScore,
    }
  }

  // ----------------------------------------------------------------
  // 私有辅助
  // ----------------------------------------------------------------

  private getLowScoreDimensions(
    verification: VerificationResult,
  ): Array<{ key: QualityDimension; name: string; score: number }> {
    if (!verification.dimensions) return []
    const entries = Object.entries(verification.dimensions) as Array<[QualityDimension, number]>
    return entries
      .map(([key, score]) => ({
        key,
        name: QUALITY_DIMENSION_LABELS[key] || key,
        score,
      }))
      .filter(d => d.score < HIGH_SCORE_THRESHOLD)
      .sort((a, b) => a.score - b.score) // 分数最低的放前面
  }

  private getHighScoreDimensions(
    verification: VerificationResult,
  ): Array<{ key: QualityDimension; name: string; score: number }> {
    if (!verification.dimensions) return []
    const entries = Object.entries(verification.dimensions) as Array<[QualityDimension, number]>
    return entries
      .map(([key, score]) => ({
        key,
        name: QUALITY_DIMENSION_LABELS[key] || key,
        score,
      }))
      .filter(d => d.score >= HIGH_SCORE_THRESHOLD)
  }

  /** 输出所有维度的 deltas（含高分未动的维度） */
  private allDimensionDeltas(
    oldV: VerificationResult,
    newV: VerificationResult,
  ): Array<{ name: string; key: QualityDimension; before: number; after: number; delta: number }> {
    if (!oldV.dimensions || !newV.dimensions) return []
    const result: Array<{ name: string; key: QualityDimension; before: number; after: number; delta: number }> = []
    for (const key of Object.keys(oldV.dimensions) as QualityDimension[]) {
      const before = oldV.dimensions[key]
      const after = newV.dimensions[key] ?? before
      result.push({
        key,
        name: QUALITY_DIMENSION_LABELS[key] || key,
        before,
        after,
        delta: +(after - before).toFixed(4),
      })
    }
    return result
  }

  private buildRefinePrompt(
    skill: GeneratedSkill,
    verification: VerificationResult,
    run: ForgeRun,
    lowDims: Array<{ key: QualityDimension; name: string; score: number }>,
    highDims: Array<{ key: QualityDimension; name: string; score: number }>,
  ): string {
    const iteration = run.currentIteration

    // 失败详情（只取低分维度相关的失败测试）
    const failures = verification.testResults.filter(r => !r.passed)
    const failureDetails = failures.map((f, i) =>
      `${i + 1}. [${f.testName}] ${f.error || f.output || f.feedback || 'Unknown failure'}` +
      (f.issues && f.issues.length > 0
        ? `\n   问题：${f.issues.map(iss => `- ${iss.description}${iss.suggestion ? ` → 建议：${iss.suggestion}` : ''}`).join('\n         ')}`
        : '')
    ).join('\n')

    // 改进建议（按维度分组，优先列低分维度的建议）
    const suggestionsText = verification.improvementSuggestions && verification.improvementSuggestions.length > 0
      ? verification.improvementSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : '（无显式建议，请根据低分维度自行分析）'

    // 失败模式
    const patternsEntries = verification.failurePatterns
      ? Object.entries(verification.failurePatterns).sort((a, b) => b[1] - a[1])
      : []
    const patternsText = patternsEntries.length > 0
      ? patternsEntries.map(([p, count], i) => `${i + 1}. ${p}（出现 ${count} 次）`).join('\n')
      : '（未识别出共性失败模式）'

    // 低分维度（带为什么低的简述 —— 从该维度下失败的测试里取）
    const lowDimsText = lowDims.map((d, i) => {
      const dimFailures = failures.filter(f => f.category === d.key)
      const brief = dimFailures.length > 0
        ? ` — 主要问题：${dimFailures.slice(0, 2).map(f => f.testName).join('、')}`
        : ''
      return `${i + 1}. ${d.name}：${(d.score * 100).toFixed(1)} 分${brief}`
    }).join('\n')

    // 高分维度（保护名单）
    const highDimsText = highDims.length > 0
      ? highDims.map(d => `- ${d.name}（${(d.score * 100).toFixed(1)} 分）`).join('\n')
      : '（当前无高分保护维度）'

    // 历史迭代记录（避免重复踩坑）
    const historyText = run.iterationHistory && run.iterationHistory.length > 0
      ? run.iterationHistory.map(h =>
          `第 ${h.iteration} 轮：得分 ${h.score.toFixed(3)}，${h.changes}`
        ).join('\n')
      : '（首次迭代）'

    return `## 当前技能
名称: ${skill.frontmatter.name}
描述: ${skill.frontmatter.description}
版本: ${skill.frontmatter.version}

## 当前技能正文
${skill.body.substring(0, 6000)}

## 验证总览
- 总测试数: ${verification.totalTests}
- 通过: ${verification.passedTests}
- 失败: ${verification.failedTests}
- 总体得分: ${(verification.overallScore * 100).toFixed(1)}%

## 需要重点优化的低分维度（按优先级排序，分数越低越优先）
${lowDimsText}

## 已达标的高分维度 —— 严禁修改，避免回退
以下维度表现已经很好，修改时不要触碰对应部分的内容：
${highDimsText}

## 具体改进建议（逐条落实）
${suggestionsText}

## 失败模式（共性问题聚类，一次修一类）
${patternsText}

## 失败测试详情
${failureDetails || '无（全部通过）'}

## 迭代历史
${historyText}

## 当前是第 ${iteration} 轮迭代

## 优化要求
1. **精准修改**：只针对上面列出的低分维度和具体改进建议做修改，高分维度相关内容一字不改
2. **最小增量**：做有针对性的增量修改，不要整段重写，能改一行不改一段
3. **逐条落实建议**：每条改进建议都要在正文中找到对应位置并修改
4. **针对失败模式**：如果有共性失败模式，从根源上修复，而不是只修表面症状
5. **不回退原则**：修改后整体质量必须不低于当前版本
6. **保护高分**：已达标的高分维度相关内容保持原样，不要"改进"已经很好的部分
7. **版本号**：修复问题改 patch（1.0.x），新增内容改 minor（1.x.0）

请输出 JSON 格式：
{
  "frontmatter": {
    "name": "保持原名",
    "description": "修改后的描述（如有）",
    "whenToUse": "修改后的触发条件（如有）",
    "version": "新版本号"
  },
  "body": "修改后的完整 SKILL.md 正文",
  "changes": "本次修改的要点说明（分点列出改了什么、为什么改、对应哪条建议）",
  "improvedDimensions": ["维度英文名1", "维度英文名2"]
}`
  }

  /**
   * 验证优化后的技能结构，做基本的合理性检查。
   */
  private validateRefinedSkill(raw: any, original: GeneratedSkill): GeneratedSkill {
    if (!raw.frontmatter || !raw.body) {
      throw new Error('Refined skill missing frontmatter or body')
    }

    const fm = raw.frontmatter

    // 保持名称不变
    fm.name = original.frontmatter.name

    // 版本号自增兜底
    if (!fm.version || fm.version === original.frontmatter.version) {
      const parts = (original.frontmatter.version || '1.0.0').split('.')
      parts[2] = String(parseInt(parts[2] || '0') + 1)
      fm.version = parts.join('.')
    }

    // body 长度合理性检查
    if (raw.body.length < 50) {
      throw new Error('Refined skill body is too short')
    }

    // 补充缺失的 frontmatter 字段（保持和原结构一致）
    if (!fm.whenToUse) fm.whenToUse = original.frontmatter.whenToUse
    if (!fm.description) fm.description = original.frontmatter.description

    return {
      frontmatter: fm,
      body: raw.body,
    }
  }
}
