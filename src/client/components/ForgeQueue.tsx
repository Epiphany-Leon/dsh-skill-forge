/**
 * ForgeQueue —— 锻造队列组件
 */

import React from 'react'
import { api } from '../api.js'
import type { ForgeRun } from '../../types'

interface Props {
  runs: ForgeRun[]
  onRefresh: () => void
}

const STATUS_LABELS: Record<string, string> = {
  created: '已创建', triggering: '评估中', trigger_skipped: '跳过',
  extracting: '提取中', extraction_failed: '提取失败',
  generating: '生成中', generation_failed: '生成失败',
  verifying: '验证中', iterating: '迭代中', auditing: '审计中',
  audit_failed: '审计未通过', pending_approval: '待审核',
  rejected: '已拒绝', active: '已激活', failed: '失败', cancelled: '已取消',
}

const STATUS_COLORS: Record<string, string> = {
  created: '#94a3b8', triggering: '#60a5fa', trigger_skipped: '#94a3b8',
  extracting: '#60a5fa', extraction_failed: '#f87171',
  generating: '#a78bfa', generation_failed: '#f87171',
  verifying: '#fbbf24', iterating: '#f59e0b', auditing: '#fb923c',
  audit_failed: '#f87171', pending_approval: '#22c55e',
  rejected: '#ef4444', active: '#10b981', failed: '#ef4444', cancelled: '#94a3b8',
}

export function ForgeQueue({ runs, onRefresh }: Props) {
  if (runs.length === 0) {
    return React.createElement('div', { className: 'sf-empty' },
      React.createElement('p', null, '暂无锻造任务'),
      React.createElement('p', { className: 'sf-empty-hint' }, '对 Agent 说「把这次对话炼成技能」即可开始'),
    )
  }

  return React.createElement('div', { className: 'sf-queue' },
    ...runs.map((run) =>
      React.createElement('div', { key: run.id, className: 'sf-queue-item' },
        React.createElement('div', { className: 'sf-queue-header' },
          React.createElement('span', { className: 'sf-queue-title' },
            run.generatedSkill?.frontmatter.name || run.sourceSummary?.substring(0, 30) || '未命名技能'),
          React.createElement('span', {
            className: 'sf-status-dot',
            style: { backgroundColor: STATUS_COLORS[run.status] || '#94a3b8' },
          }),
        ),
        React.createElement('div', { className: 'sf-queue-meta' },
          React.createElement('span', {
            className: 'sf-status-label',
            style: { color: STATUS_COLORS[run.status] || '#94a3b8' },
          }, STATUS_LABELS[run.status] || run.status),
          run.currentIteration > 0 && React.createElement('span', { className: 'sf-iteration' },
            `迭代 ${run.currentIteration}/${run.maxIterations}`),
          React.createElement('span', { className: 'sf-time' },
            new Date(run.createdAt).toLocaleTimeString()),
        ),
        run.failureReason && React.createElement('div', { className: 'sf-failure-reason' },
          run.failureReason.message),
        React.createElement('div', { className: 'sf-queue-actions' },
          run.status === 'pending_approval' && React.createElement('button', {
            className: 'sf-btn sf-btn-primary',
            onClick: async () => { await api.approveSkill(run.id); onRefresh() },
          }, '批准'),
          run.status === 'failed' && React.createElement('button', {
            className: 'sf-btn sf-btn-secondary',
            onClick: async () => { await api.retryForge(run.id); onRefresh() },
          }, '重试'),
        ),
      )
    )
  )
}
