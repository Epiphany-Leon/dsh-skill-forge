/**
 * 通用工具函数 —— JSON 解析、响应格式化、错误处理等
 *
 * 所有服务共享的纯函数工具，不含业务逻辑。
 */

import type { ServerResponse } from 'node:http'

// ============================================================
// JSON 安全解析
// ============================================================

/**
 * 容错式 JSON 解析 —— 尝试多种方式从字符串中提取 JSON 对象。
 *
 * 处理常见 LLM 输出格式问题：
 * - Markdown 代码块包裹（```json ... ```）
 * - 前后多余的解释性文字
 * - 末尾未闭合的大括号
 */
export function safeParseJSON<T = unknown>(text: string): T | null {
  if (!text || typeof text !== 'string') return null

  const trimmed = text.trim()
  if (!trimmed) return null

  // 1. 直接尝试
  try {
    return JSON.parse(trimmed) as T
  } catch { /* 继续尝试其他方式 */ }

  // 2. 去除 Markdown 代码块
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1]!.trim()) as T
    } catch { /* 继续 */ }
  }

  // 3. 提取第一个 { ... } 或 [ ... ] 块
  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')
  let start = -1
  let endChar = ''

  if (firstBrace === -1 && firstBracket === -1) return null
  if (firstBrace === -1) {
    start = firstBracket
    endChar = ']'
  } else if (firstBracket === -1) {
    start = firstBrace
    endChar = '}'
  } else if (firstBrace < firstBracket) {
    start = firstBrace
    endChar = '}'
  } else {
    start = firstBracket
    endChar = ']'
  }

  // 从 start 开始找匹配的闭合
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]!
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') depth++
    if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0 && ch === endChar) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1)) as T
        } catch {
          return null
        }
      }
    }
  }

  return null
}

// ============================================================
// HTTP 响应辅助
// ============================================================

/**
 * 统一 JSON 响应格式。
 * 设置 Content-Type 头并发送 JSON 数据。
 */
export function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

/**
 * 统一错误响应格式：{ ok: false, error: string, code?: string }
 */
export function sendError(
  res: ServerResponse,
  error: string | Error,
  status = 500,
  code?: string,
): void {
  const message = error instanceof Error ? error.message : error
  const body: { ok: false; error: string; code?: string } = { ok: false, error: message }
  if (code !== undefined) body.code = code
  sendJson(res, body, status)
}

/**
 * 统一成功响应格式：{ ok: true, ...data }
 */
export function sendOk(res: ServerResponse, data: Record<string, unknown> = {}): void {
  sendJson(res, { ok: true, ...data })
}

/**
 * 405 Method Not Allowed 快捷响应
 */
export function sendMethodNotAllowed(res: ServerResponse): void {
  res.writeHead(405).end()
}

// ============================================================
// 请求体解析
// ============================================================

import type { IncomingMessage } from 'node:http'

/**
 * 读取并解析 JSON 请求体。
 * 解析失败时返回空对象（不抛错）。
 */
export function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8')
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

// ============================================================
// 字符串工具
// ============================================================

/**
 * 转换为 kebab-case 格式（DSH 技能名要求）。
 * 只保留字母、数字、连字符、下划线。
 */
export function toKebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * 截断字符串到指定长度，末尾加省略号。
 */
export function truncate(str: string, maxLen: number, suffix = '...'): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - suffix.length) + suffix
}

// ============================================================
// ID 生成
// ============================================================

/**
 * 生成简短的唯一 ID（基于时间戳 + 随机后缀）。
 * 格式：时间戳36进制 + 随机4字符36进制
 */
export function generateId(prefix = ''): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${prefix}${ts}-${rand}`
}

// ============================================================
// 数值工具
// ============================================================

/**
 * 钳位数值到 [min, max] 范围。
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 将值归一化到 0-1 范围（安全除法，避免除零）。
 */
export function normalize(value: number, max: number): number {
  if (max <= 0) return 0
  return clamp(value / max, 0, 1)
}
