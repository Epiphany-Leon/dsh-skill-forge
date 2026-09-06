/**
 * 前端工具函数
 *
 * 集中存放通用的纯函数工具：时间格式化、状态标签映射、分数色阶等。
 * 所有函数均为纯函数，无副作用。
 */

import type { ReactNode } from 'react'

// ============================================================
// 时间格式化
// ============================================================

/**
 * 相对时间格式化：刚刚 / X分钟前 / X小时前 / X天前 / M/D
 * @param ts 时间戳（毫秒）或 ISO 字符串
 */
export function formatRelativeTime(ts: number | string): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ============================================================
// 状态标签映射（通用锻造状态）
// ============================================================

const FORGE_STATUS_LABELS: Record<string, string> = {
  pending_approval: '待审核',
  active: '已激活',
  archived: '已归档',
  failed: '失败',
  rejected: '已拒绝',
  extracting: '提取中',
  generating: '生成中',
  verifying: '验证中',
  refining: '优化中',
  auditing: '审计中',
  iterating: '迭代中',
  created: '已创建',
  triggering: '评估中',
  trigger_skipped: '未触发',
  extraction_failed: '提取失败',
  generation_failed: '生成失败',
  audit_failed: '审核失败',
  cancelled: '已取消',
}

/** 锻造状态 → 中文标签 */
export function forgeStatusLabel(status: string): string {
  return FORGE_STATUS_LABELS[status] ?? status
}

/** 锻造状态 → 语义色值（16 进制） */
export function forgeStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending_approval: '#22c55e',
    active: '#10b981',
    archived: '#6b7280',
    failed: '#ef4444',
    rejected: '#ef4444',
    extracting: '#60a5fa',
    generating: '#a78bfa',
    verifying: '#fbbf24',
    refining: '#f59e0b',
    auditing: '#fb923c',
    iterating: '#f59e0b',
    created: '#94a3b8',
    triggering: '#60a5fa',
    trigger_skipped: '#94a3b8',
    extraction_failed: '#f87171',
    generation_failed: '#f87171',
    audit_failed: '#f87171',
    cancelled: '#94a3b8',
  }
  return map[status] ?? '#94a3b8'
}

// ============================================================
// 分数色阶
// ============================================================

/** 根据分数返回颜色 class 名（高分绿 / 中分黄 / 低分红） */
export function scoreColorClass(score: number): string {
  if (score >= 0.8) return 'sf-score-high'
  if (score >= 0.6) return 'sf-score-mid'
  return 'sf-score-low'
}

/** 根据分数返回进度条 class 名 */
export function scoreBarClass(score: number): string {
  if (score >= 0.8) return 'sf-dim-good'
  if (score >= 0.6) return 'sf-dim-mid'
  return 'sf-dim-low'
}

/** 根据分数返回颜色值 */
export function qualityColor(score: number): string {
  if (score >= 0.8) return '#10B981'
  if (score >= 0.6) return '#F59E0B'
  return '#EF4444'
}

// ============================================================
// 置信度分级
// ============================================================

export interface ConfidenceInfo {
  text: string
  color: string
}

export function confidenceLabel(conf: number): ConfidenceInfo {
  if (conf >= 0.8) return { text: '高', color: 'var(--sf-success)' }
  if (conf >= 0.6) return { text: '中', color: 'var(--sf-warning)' }
  return { text: '低', color: 'var(--sf-error)' }
}

// ============================================================
// 列表安全渲染
// ============================================================

/** 安全的数组 map：空数组/undefined/null 返回 fallback */
export function renderList<T>(
  items: T[] | null | undefined,
  render: (item: T, index: number) => ReactNode,
  fallback: ReactNode = null,
): ReactNode {
  if (!items || items.length === 0) return fallback
  return items.map(render)
}

// ============================================================
// 文本截断
// ============================================================

/** 截断文本到指定长度，超出加省略号 */
export function truncate(text: string | undefined | null, maxLen: number): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + '...'
}

// ============================================================
// 轮询间隔常量
// ============================================================

export const POLL_INTERVAL_MS = 5000
export const QUEUE_POLL_LIMIT = 20
