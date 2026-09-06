/**
 * BaseAgent —— 所有 Agent 的基类
 *
 * 直接通过 HTTP 调用 LLM API（OpenAI 兼容格式），
 * 不依赖 DSH 的 ctx.llm 流式基础设施。
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BaseService } from '../services/BaseService.js'
import type { SkillForgeConfig } from '../types.js'

/** Mimo API 基础地址（Token Plan 中国区） */
const MIMO_BASE_URL = 'https://token-plan-cn.xiaomimimo.com/v1'

export abstract class BaseAgent extends BaseService {
  private apiKeyCache: string | null = null
  private apiKeyResolved = false

  constructor(ctx: any, config: SkillForgeConfig) {
    super(ctx, config)
  }

  /**
   * 调用 LLM（OpenAI 兼容格式）
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    model = 'mimo-v2.5-pro',
    temperature = 0.7,
  ): Promise<any> {
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: temperature,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error')
      throw new Error(`LLM API error: ${response.status} ${text}`)
    }

    const data = await response.json() as any
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('LLM returned empty response')
    }

    return this.parseJSON(content)
  }

  /**
   * 获取 API Key（带缓存）
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
      const credPath = join(homedir(), '.dsh', '.credentials.yaml')
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
    } catch { /* 文件不存在 */ }

    this.apiKeyResolved = true
    return null
  }

  /**
   * 容错式 JSON 解析
   */
  protected parseJSON(text: string): any {
    try { return JSON.parse(text.trim()) } catch { /* 继续 */ }

    const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonBlock && jsonBlock[1]) {
      try { return JSON.parse(jsonBlock[1]!.trim()) } catch { /* 继续 */ }
    }

    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1).trim())
      } catch { /* 继续 */ }
    }

    throw new Error('Failed to parse JSON from LLM response')
  }
}
