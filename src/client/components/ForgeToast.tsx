/**
 * ForgeToast — 对话内通知卡片
 *
 * 固定在右下角的 Toast 通知容器。
 * 监听 toast-store 的变化，自动渲染 Toast。
 * 待审核的 Toast 有「查看详情」「直接批准」「静音」按钮。
 */

import React, { useState, useEffect, useCallback } from 'react'
import { toastStore, type Toast } from '../toast-store.js'
import { api } from '../api.js'

// ============ 单个 Toast 卡片 ============

interface ToastCardProps {
  toast: Toast
  onDismiss: (id: string) => void
  onViewDetail: (runId: string) => void
}

function ToastCard({ toast, onDismiss, onViewDetail }: ToastCardProps): React.ReactElement {
  const [approving, setApproving] = useState(false)
  const [opacity, setOpacity] = useState(1)

  const handleApprove = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    setApproving(true)
    try {
      // 乐观更新：先关 toast，再调 API
      onDismiss(toast.id)
      toastStore.clearForRun(toast.runId)
      await api.approveSkill(toast.runId)
    } catch (err) {
      console.error('[forge-toast] approve failed:', err)
      toastStore.addToast({
        ...toast,
        id: `toast-retry-${Date.now()}`,
        status: 'error',
        title: '❌ 批准失败',
        message: `「${toast.skillName}」批准失败，请重试`,
        actionable: false,
        createdAt: Date.now(),
      })
    } finally {
      setApproving(false)
    }
  }, [toast, onDismiss])

  const handleViewDetail = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDismiss(toast.id)
    onViewDetail(toast.runId)
  }, [toast, onDismiss, onViewDetail])

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpacity(0)
    setTimeout(() => onDismiss(toast.id), 200)
  }, [toast, onDismiss])

  // actionable 的 toast 在 30 秒后自动消失
  useEffect(() => {
    if (!toast.actionable) return
    const timer = setTimeout(() => {
      setOpacity(0)
      setTimeout(() => onDismiss(toast.id), 200)
    }, 30000)
    return () => clearTimeout(timer)
  }, [toast.actionable, toast.id, onDismiss])

  const typeClass =
    toast.status === 'success' ? 'sf-toast-success' :
    toast.status === 'error' ? 'sf-toast-error' :
    'sf-toast-info'

  return React.createElement('div', {
    className: `sf-toast ${typeClass}`,
    style: {
      opacity,
      transition: 'opacity 0.2s ease',
    },
  },
    // 标题行
    React.createElement('div', { className: 'sf-toast-header' },
      React.createElement('span', { className: 'sf-toast-title' }, toast.title),
      React.createElement('button', {
        className: 'sf-toast-close',
        onClick: handleDismiss,
        title: '关闭',
      }, '×'),
    ),
    // 消息
    React.createElement('div', { className: 'sf-toast-message' }, toast.message),
    // 操作按钮
    toast.actionable && React.createElement('div', { className: 'sf-toast-actions' },
      React.createElement('button', {
        className: 'sf-btn sf-btn-ghost sf-btn-sm',
        onClick: handleViewDetail,
      }, '📋 查看详情'),
      React.createElement('button', {
        className: 'sf-btn sf-btn-primary sf-btn-sm',
        onClick: handleApprove,
        disabled: approving,
      }, approving ? '⏳ 处理中...' : '✓ 批准'),
    ),
  )
}

// ============ Toast 容器 ============

interface ForgeToastContainerProps {
  onNavigateToRun: (runId: string) => void
}

export function ForgeToastContainer({ onNavigateToRun }: ForgeToastContainerProps): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [muted, setMutedState] = useState(false)

  useEffect(() => {
    // 启动轮询
    toastStore.startPolling()

    // 订阅 toast 变化
    const unsub = toastStore.subscribeToast(() => {
      setToasts([...toastStore.getToasts()])
      setMutedState(toastStore.isMuted())
    })

    return () => {
      unsub()
    }
  }, [])

  const handleDismiss = useCallback((id: string) => {
    toastStore.dismissToast(id)
  }, [])

  const handleViewDetail = useCallback((runId: string) => {
    onNavigateToRun(runId)
  }, [onNavigateToRun])

  const handleToggleMute = useCallback(() => {
    toastStore.setMuted(!toastStore.isMuted())
  }, [])

  if (toasts.length === 0) {
    return React.createElement('div', { style: { display: 'none' } })
  }

  return React.createElement('div', { className: 'sf-toast-container' },
    // 静音按钮
    React.createElement('button', {
      className: `sf-toast-mute-btn ${muted ? 'sf-toast-muted' : ''}`,
      onClick: handleToggleMute,
      title: muted ? '取消静音' : '静音通知',
    }, muted ? '🔕' : '🔔'),
    // Toast 卡片
    toasts.map(t =>
      React.createElement(ToastCard, {
        key: t.id,
        toast: t,
        onDismiss: handleDismiss,
        onViewDetail: handleViewDetail,
      })
    ),
  )
}
