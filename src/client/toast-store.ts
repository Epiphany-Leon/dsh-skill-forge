/**
 * ForgeToast — Toast 通知 Store
 *
 * 模块级状态管理：轮询 pending_approval runs，去重后弹 Toast。
 * 不依赖 React Context，任何模块都可以 import 后直接使用。
 */

import { API_BASE, POLL_INTERVAL_MS, TOAST_AUTO_DISMISS_MS, QUEUE_POLL_LIMIT } from './constants.js'

export interface Toast {
  id: string
  runId: string
  skillName: string
  status: 'success' | 'error' | 'info'
  title: string
  message: string
  createdAt: number
  /** 是否需要用户操作（待审核） */
  actionable: boolean
}

/** 最小化的 ForgeRun 结构（仅轮询所需字段） */
interface PolledRun {
  id: string
  status: string
  generatedSkill?: { frontmatter?: { name?: string } }
  sourceSummary?: string
}

interface ToastState {
  toasts: Toast[]
  /** 已经通知过的 runId，避免重复弹 */
  notifiedRuns: Set<string>
  /** 静音模式 */
  muted: boolean
  /** 最近一次检查时间 */
  lastCheckAt: number
  listeners: Set<() => void>
}

const state: ToastState = {
  toasts: [],
  notifiedRuns: new Set(),
  muted: false,
  lastCheckAt: 0,
  listeners: new Set(),
}

// ============ State helpers ============

function emit(): void {
  state.listeners.forEach(fn => fn())
}

function subscribeToast(fn: () => void): () => void {
  state.listeners.add(fn)
  return () => { state.listeners.delete(fn) }
}

function addToast(toast: Toast): void {
  state.toasts = [...state.toasts, toast]
  emit()
  // 非 actionable 的 toast 自动消失
  if (!toast.actionable) {
    setTimeout(() => dismissToast(toast.id), TOAST_AUTO_DISMISS_MS)
  }
}

function dismissToast(id: string): void {
  state.toasts = state.toasts.filter(t => t.id !== id)
  emit()
}

function getToasts(): Toast[] {
  return state.toasts
}

function setMuted(muted: boolean): void {
  state.muted = muted
  emit()
}

function isMuted(): boolean {
  return state.muted
}

// ============ Polling logic ============

let pollTimer: ReturnType<typeof setInterval> | null = null

async function pollPendingRuns(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/queue?limit=${QUEUE_POLL_LIMIT}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return
    const runs = await res.json() as PolledRun[]

    const pendingRuns = runs.filter(r => r.status === 'pending_approval')

    for (const run of pendingRuns) {
      if (state.notifiedRuns.has(run.id)) continue
      if (state.muted) continue

      state.notifiedRuns.add(run.id)
      const skillName =
        run.generatedSkill?.frontmatter?.name ||
        (run.sourceSummary?.substring(0, 30) ?? '') ||
        '未命名技能'

      addToast({
        id: `toast-${run.id}`,
        runId: run.id,
        skillName,
        status: 'success',
        title: '🔨 锻造完成',
        message: `「${skillName}」已完成锻造，等待审核`,
        createdAt: Date.now(),
        actionable: true,
      })
    }

    // 清理不再 pending 的 notified 记录（避免内存膨胀）
    const pendingIds = new Set(pendingRuns.map(r => r.id))
    for (const id of state.notifiedRuns) {
      if (!pendingIds.has(id.replace('toast-', ''))) {
        state.notifiedRuns.delete(id)
      }
    }
  } catch {
    // 静默失败，下次轮询再试
  }
}

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(pollPendingRuns, POLL_INTERVAL_MS)
  // 立即跑一次
  void pollPendingRuns()
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ============ Export API ============

export const toastStore = {
  subscribeToast,
  addToast,
  dismissToast,
  getToasts,
  setMuted,
  isMuted,
  startPolling,
  stopPolling,
  /** 批准后清除对应 toast */
  clearForRun(runId: string): void {
    state.toasts = state.toasts.filter(t => t.runId !== runId)
    state.notifiedRuns.delete(`toast-${runId}`)
    state.notifiedRuns.delete(runId)
    emit()
  },
}
