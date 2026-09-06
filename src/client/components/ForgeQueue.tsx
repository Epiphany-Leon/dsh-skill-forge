/**
 * ForgeQueue —— 锻造队列组件
 */

import React from 'react'
import { api } from '../api.js'
import { forgeStatusLabel, forgeStatusColor, formatRelativeTime } from '../utils.js'

interface ForgeQueueRun {
  id: string
  status: string
  currentIteration: number
  maxIterations: number
  createdAt: number
  sourceSummary?: string
  failureReason?: { message: string }
  generatedSkill?: { frontmatter?: { name?: string } }
}

interface ForgeQueueProps {
  runs: ForgeQueueRun[]
  onRefresh: () => void
}

export function ForgeQueue({ runs, onRefresh }: ForgeQueueProps): React.ReactElement {
  if (runs.length === 0) {
    return React.createElement('div', { className: 'sf-empty' },
      React.createElement('p', null, '暂无锻造任务'),
      React.createElement('p', { className: 'sf-empty-hint' }, '对 Agent 说「把这次对话炼成技能」即可开始'),
    )
  }

  const handleApprove = async (runId: string): Promise<void> => {
    await api.approveSkill(runId)
    onRefresh()
  }

  const handleRetry = async (runId: string): Promise<void> => {
    await api.retryForge(runId)
    onRefresh()
  }

  return React.createElement('div', { className: 'sf-queue' },
    ...runs.map((run): React.ReactElement => {
      const skillName = run.generatedSkill?.frontmatter?.name
        || (run.sourceSummary?.substring(0, 30) ?? '')
        || '未命名技能'
      const statusColor = forgeStatusColor(run.status)

      return React.createElement('div', { key: run.id, className: 'sf-queue-item' },
        React.createElement('div', { className: 'sf-queue-header' },
          React.createElement('span', { className: 'sf-queue-title' }, skillName),
          React.createElement('span', {
            className: 'sf-status-dot',
            style: { backgroundColor: statusColor },
          }),
        ),
        React.createElement('div', { className: 'sf-queue-meta' },
          React.createElement('span', {
            className: 'sf-status-label',
            style: { color: statusColor },
          }, forgeStatusLabel(run.status)),
          run.currentIteration > 0 && React.createElement('span', { className: 'sf-iteration' },
            `迭代 ${run.currentIteration}/${run.maxIterations}`),
          React.createElement('span', { className: 'sf-time' },
            formatRelativeTime(run.createdAt)),
        ),
        run.failureReason && React.createElement('div', { className: 'sf-failure-reason' },
          run.failureReason.message),
        React.createElement('div', { className: 'sf-queue-actions' },
          run.status === 'pending_approval' && React.createElement('button', {
            className: 'sf-btn sf-btn-primary',
            onClick: () => handleApprove(run.id),
          }, '批准'),
          run.status === 'failed' && React.createElement('button', {
            className: 'sf-btn sf-btn-secondary',
            onClick: () => handleRetry(run.id),
          }, '重试'),
        ),
      )
    })
  )
}
