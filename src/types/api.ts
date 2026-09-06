/**
 * 通用 API 类型定义 —— HTTP 请求/响应、工具参数等
 *
 * 所有 HTTP API 路由共享的类型定义。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** 标准 API 请求处理器类型 */
export type ApiHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>

/** 路由定义 */
export interface RouteDefinition {
  kind: 'exact' | 'prefix'
  path: string
  handler: ApiHandler
}

/** 标准 API 错误响应体 */
export interface ApiErrorResponse {
  ok: false
  error: string
  code?: string
}

/** 标准 API 成功响应体 */
export interface ApiSuccessResponse<T = unknown> {
  ok: true
  data?: T
}

/** 带 ok 字段的布尔响应 */
export interface ApiOkResponse {
  ok: boolean
}

/** 技能搜索查询参数（从 URL query string 解析） */
export interface SkillSearchQuery {
  q?: string
  status?: string
  category?: string
  sortBy?: string
  sortOrder?: string
  limit?: string
  offset?: string
}

/** 分页结果 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
