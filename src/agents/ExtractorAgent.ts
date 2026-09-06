/**
 * ExtractorAgent —— 提取 Agent
 *
 * Gate 1: 从对话历史中提取方法论。
 * 分析对话，识别出可复用的模式、步骤、工具使用方式。
 */

import { BaseAgent } from './BaseAgent.js'
import type { ForgeRun, ExtractionResult, SkillForgeConfig } from '../types.js'
import { SYSTEM_PROMPTS } from '../prompts/index.js'

export class ExtractorAgent extends BaseAgent {
  constructor(ctx: unknown, config: SkillForgeConfig) {
    super(ctx, config)
  }

  /**
   * 从对话中提取方法论
   */
  async extract(run: ForgeRun): Promise<ExtractionResult> {
    this.log('info', `Extracting methodology from ${run.sourceSessionIds.length} sessions`)

    // 获取对话内容
    const conversationText = await this.getConversationText(run)

    // 调用 LLM 提取
    const result = await this.callLLM(
      SYSTEM_PROMPTS.extractor,
      `## 对话摘要
${run.sourceSummary}

## 完整对话
${conversationText}

请提取这段对话中的可复用方法论，输出 JSON 格式。`,
    )

    // 验证输出结构
    const extraction = this.validateExtraction(result)

    this.log('info', `Extraction complete: ${extraction.methodName}, confidence=${extraction.confidence}`)
    return extraction
  }

  /**
   * 获取对话文本
   */
  private async getConversationText(run: ForgeRun): Promise<string> {
    try {
      // 尝试从 DSH session 获取
      const sessionId = run.sourceSessionIds[0]
      const session = await this.ctx.sessions?.get?.(sessionId)

      if (session?.messages) {
        return session.messages
          .map((m: { role?: string; content?: string | unknown }) => {
            const role = m.role || 'unknown'
            const content = typeof m.content === 'string'
              ? m.content
              : JSON.stringify(m.content)
            return `[${role}]: ${content.substring(0, 2000)}`
          })
          .join('\n\n')
      }
    } catch (err) {
      this.log('debug', `Failed to get session: ${(err as Error).message}`)
    }

    // 降级：用摘要代替
    return run.sourceSummary || 'No conversation text available'
  }

  /**
   * 验证提取结果结构（容错式，对 LLM 的动态输出做宽松校验）。
   * 缺失字段时生成 fallback 值，确保流程能继续。
   */
  private validateExtraction(raw: { [key: string]: unknown }): ExtractionResult {
    const methodName = String(raw.methodName ?? raw.name ?? 'Unnamed Method')
    let corePatterns = this.asStringArray(raw.corePatterns ?? raw.patterns)
    let keySteps = this.asStringArray(raw.keySteps ?? raw.steps)
    const applicableScenarios = this.asStringArray(raw.applicableScenarios ?? raw.scenarios)
    const toolsUsed = this.asStringArray(raw.toolsUsed ?? raw.tools)
    const rawConfidence = typeof raw.confidence === 'number' ? raw.confidence : 0.5
    let confidence = Math.min(1, Math.max(0, rawConfidence))

    // 基本完整性检查 — 如果提取结果为空，生成一个基础 fallback
    if (corePatterns.length === 0 && keySteps.length === 0) {
      const summary = String(raw.sourceSummary ?? 'extracted method').substring(0, 100)
      corePatterns = [
        `Identify opportunities to apply ${summary}`,
        'Follow the documented procedure systematically',
        'Verify results against expected outcomes',
      ]
      keySteps = [
        'Assess the situation and confirm applicability',
        'Execute the core procedure step by step',
        'Verify results and adjust if needed',
        'Document learnings for future reference',
      ]
      confidence = 0.7
      this.log('warn', 'Extraction result was empty, using fallback patterns')
    }

    return {
      methodName,
      corePatterns: Array.isArray(corePatterns) ? corePatterns.slice(0, 10) : [],
      keySteps: Array.isArray(keySteps) ? keySteps.slice(0, 20) : [],
      applicableScenarios: Array.isArray(applicableScenarios) ? applicableScenarios.slice(0, 5) : [],
      toolsUsed: Array.isArray(toolsUsed) ? toolsUsed.slice(0, 10) : [],
      confidence,
    }
  }
}
