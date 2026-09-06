/**
 * BaseAgent —— 所有 Agent 的基类
 *
 * 直接通过 HTTP 调用 LLM API（OpenAI 兼容格式），
 * 不依赖 DSH 的 ctx.llm 流式基础设施。
 *
 * 提供统一的 LLM 调用、API Key 管理、容错式 JSON 解析。
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BaseService } from '../services/BaseService.js'
import type { SkillForgeConfig } from '../types.js'
import { MIMO_BASE_URL, LLM_REQUEST_TIMEOUT_MS, LLM_DEFAULT_MAX_TOKENS, LLM_DEFAULT_MODEL, DSH_CREDENTIALS_PATH } from '../utils/constants.js'
import { safeParseJSON } from '../utils/helpers.js'

/** LLM 消息结构 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** LLM API 响应中 choices[0].message 的结构 */
interface LlmChoiceMessage {
  content?: string
  role?: string
}

/** LLM API 响应中 choice 的结构 */
interface LlmChoice {
  message?: LlmChoiceMessage
  index?: number
  finish_reason?: string
}

/** LLM API 响应结构（OpenAI 兼容格式） */
interface LlmApiResponse {
  choices?: LlmChoice[]
  id?: string
  model?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export abstract class BaseAgent extends BaseService {
  private apiKeyCache: string | null = null
  private apiKeyResolved = false

  constructor(ctx: unknown, config: SkillForgeConfig) {
    super(ctx, config)
  }

  /**
   * 调用 LLM（OpenAI 兼容 JSON 模式）。
   *
   * @param systemPrompt - System Prompt 内容
   * @param userPrompt - User Prompt 内容
   * @param model - 模型名称，默认 mimo-v2.5-pro
   * @param temperature - 采样温度，默认 0.7
   * @returns 解析后的 JSON 对象
   * @throws 当 API 调用失败或返回空内容时抛出 Error
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    model = LLM_DEFAULT_MODEL,
    temperature = 0.7,
  ): Promise<Record<string, unknown>> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error(
        'MIMO API key not configured. Set XIAOMI_TOKEN_PLAN_CN_API_KEY in DSH Settings → Models → Xiaomi MiMo'
      )
    }

    const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userPrompt },
        ],
        temperature,
        max_tokens: LLM_DEFAULT_MAX_TOKENS,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error')
      throw new Error(`LLM API error: ${response.status} ${text}`)
    }

    const data = (await response.json()) as LlmApiResponse
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('LLM returned empty response')
    }

    return this.parseJSON(content)
  }

  /**
   * 获取 API Key（带缓存，只解析一次）。
   *
   * 解析优先级：
   * 1. 环境变量 MIMO_API_KEY
   * 2. DSH 凭据文件 ~/.dsh/.credentials.yaml 中的 XIAOMI_TOKEN_PLAN_CN_API_KEY
   */
  private getApiKey(): string | null {
    if (this.apiKeyResolved) return this.apiKeyCache

    // 方式1: 环境变量
    if (process.env.MIMO_API_KEY) {
      this.apiKeyCache = process.env.MIMO_API_KEY
      this.apiKeyResolved = true
      return this.apiKeyCache
    }

    // 方式2: 从 DSH 凭据文件读取
    try {
      const credPath = join(homedir(), DSH_CREDENTIALS_PATH)
      const content = readFileSync(credPath, 'utf-8')
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.includes('XIAOMI_TOKEN_PLAN_CN_API_KEY')) {
          const match = line.match(/:\s*(tp-.+)/)
          if (match && match[1]) {
            this.apiKeyCache = match[1]!.trim()
            this.apiKeyResolved = true
            return this.apiKeyCache
          }
        }
      }
    } catch {
      /* 文件不存在或读取失败，静默降级 */
    }

    this.apiKeyResolved = true
    return null
  }

  /**
   * 容错式 JSON 解析。
   *
   * 处理 LLM 输出中常见的格式问题：
   * - Markdown 代码块包裹
   * - 前后多余文字
   * - 提取第一个完整 JSON 块
   *
   * @param text - 待解析的文本
   * @returns 解析后的对象；解析失败时返回包含原始文本的对象
   */
  protected parseJSON(text: string): Record<string, unknown> {
    const parsed = safeParseJSON<Record<string, unknown>>(text)
    if (parsed !== null) return parsed
    // 最后兜底：返回原始文本
    return { rawText: text }
  }

  // ==========================================================
  // 类型安全的辅助方法（从动态 LLM 输出中安全取值）
  // ==========================================================

  /**
   * 安全地将 unknown 值转为 string 数组。
   * 若不是数组或为空，返回空数组；非字符串元素会被 String() 转换。
   */
  protected asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.map(item => String(item))
  }

  /**
   * 安全地取对象的字符串属性。
   */
  protected getString(obj: { [key: string]: unknown }, key: string, fallback = ''): string {
    const v = obj[key]
    return typeof v === 'string' ? v : fallback
  }

  /**
   * 安全地取对象的数字属性。
   */
  protected getNumber(obj: { [key: string]: unknown }, key: string, fallback = 0): number {
    const v = obj[key]
    return typeof v === 'number' ? v : fallback
  }

  /**
   * 安全地取对象的布尔属性。
   */
  protected getBoolean(obj: { [key: string]: unknown }, key: string, fallback = false): boolean {
    const v = obj[key]
    return typeof v === 'boolean' ? v : fallback
  }
}
