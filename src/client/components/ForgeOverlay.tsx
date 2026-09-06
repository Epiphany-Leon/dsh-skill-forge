/**
 * ForgeOverlay — 侧边栏按钮点击后弹出的锻造面板
 * 毛玻璃背景 + 居中面板，包含锻造队列、技能库、统计三个 Tab
 */

import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

interface ForgeOverlayProps {
  onClose: () => void
}

export function ForgeOverlay({ onClose }: ForgeOverlayProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'queue' | 'skills' | 'stats'>('queue')
  const [runs, setRuns] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [triggering, setTriggering] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [r, s, st] = await Promise.all([
        api.getQueue(), api.getSkills(), api.getStats(),
      ])
      setRuns(r as any[]); setSkills(s as any[]); setStats(st as any)
    } catch (err) {
      console.error('[skill-forge] fetch failed:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 5000)
    return () => clearInterval(t)
  }, [fetchData])

  const pendingCount = runs.filter(r => r.status === 'pending_approval').length

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      await api.triggerForge('manual trigger from UI')
      await fetchData()
    } catch (e) {
      console.error('[skill-forge] trigger failed:', e)
    } finally {
      setTriggering(false)
    }
  }

  return React.createElement('div', {
    className: 'sf-overlay-backdrop',
    onClick: (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose() },
  },
    React.createElement('div', { className: 'sf-overlay-panel' },
      // Header
      React.createElement('div', { className: 'sf-panel-header' },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement('span', { style: { fontSize: '18px' } }, '🔨'),
          React.createElement('h3', null, 'Skill Forge'),
          pendingCount > 0 && React.createElement('span', { className: 'sf-pending-badge' }, `${pendingCount}`),
        ),
        React.createElement('button', {
          className: 'sf-btn-icon',
          onClick: onClose,
          title: '关闭',
        }, '✕'),
      ),

      // Tab bar
      React.createElement('div', { className: 'sf-tabs' },
        (['queue', 'skills', 'stats'] as const).map(tab =>
          React.createElement('button', {
            key: tab,
            className: `sf-tab ${activeTab === tab ? 'active' : ''}`,
            onClick: () => setActiveTab(tab),
          }, tab === 'queue' ? '锻造队列' : tab === 'skills' ? `技能库 (${skills.length})` : '统计')
        ),
      ),

      // Content
      React.createElement('div', { className: 'sf-tab-content' },
        // Queue tab
        activeTab === 'queue' && React.createElement(React.Fragment, null,
          // Trigger button
          React.createElement('div', { className: 'sf-toolbar' },
            React.createElement('button', {
              className: 'sf-btn sf-btn-primary',
              onClick: handleTrigger,
              disabled: triggering,
            }, triggering ? '触发中...' : '🚀 触发锻造'),
          ),
          runs.length === 0
            ? React.createElement('div', { className: 'sf-empty' },
                React.createElement('p', null, '暂无锻造任务'),
                React.createElement('p', { className: 'sf-empty-hint' }, '点击上方按钮开始首次锻造'),
              )
            : runs.map(r => React.createElement('div', {
                key: r.id,
                className: `sf-queue-item sf-queue-${r.status}`,
              },
                React.createElement('div', { className: 'sf-queue-header' },
                  React.createElement('span', { className: 'sf-queue-title' },
                    r.generatedSkill?.frontmatter?.name || r.sourceSummary?.substring(0, 40) || '未命名'
                  ),
                  React.createElement('span', { className: `sf-status-badge sf-status-${r.status}` },
                    statusLabel(r.status)
                  ),
                ),
                r.sourceSummary && React.createElement('div', { className: 'sf-queue-desc' },
                  r.sourceSummary.substring(0, 80) + (r.sourceSummary.length > 80 ? '...' : '')
                ),
                React.createElement('div', { className: 'sf-queue-meta' },
                  React.createElement('span', null, `轮次 ${r.currentIteration}/${r.maxIterations}`),
                  React.createElement('span', null, `质量 ${r.qualityScore?.toFixed(2) || '—'}`),
                  React.createElement('span', { className: 'sf-time' },
                    new Date(r.createdAt).toLocaleTimeString()
                  ),
                ),
                r.status === 'pending_approval' && React.createElement('div', { className: 'sf-queue-actions' },
                  React.createElement('button', {
                    className: 'sf-btn sf-btn-primary',
                    onClick: async () => { await api.approveSkill(r.id); fetchData() },
                  }, '✓ 批准'),
                  React.createElement('button', {
                    className: 'sf-btn sf-btn-danger',
                    onClick: async () => { await api.rejectSkill(r.id, ['质量不达标']); fetchData() },
                  }, '✗ 拒绝'),
                ),
                r.status === 'failed' && React.createElement('div', { className: 'sf-queue-actions' },
                  React.createElement('button', {
                    className: 'sf-btn sf-btn-secondary',
                    onClick: async () => { await api.retryForge(r.id); fetchData() },
                  }, '🔄 重试'),
                ),
              ))
        ),

        // Skills tab
        activeTab === 'skills' && (
          skills.length === 0
            ? React.createElement('div', { className: 'sf-empty' },
                React.createElement('p', null, '技能库为空'),
              )
            : skills.map(s => React.createElement('div', {
                key: s.id,
                className: 'sf-skill-item',
              },
                React.createElement('div', { className: 'sf-skill-header' },
                  React.createElement('span', { className: 'sf-skill-name' }, s.frontmatter?.name),
                  React.createElement('span', { className: `sf-status-badge sf-status-${s.status}` },
                    statusLabel(s.status)
                  ),
                ),
                s.frontmatter?.description && React.createElement('p', { className: 'sf-skill-desc' },
                  s.frontmatter.description
                ),
                React.createElement('div', { className: 'sf-skill-meta' },
                  React.createElement('span', null, `v${s.version || 1}`),
                  React.createElement('span', null, `调用 ${s.usageCount || 0}次`),
                ),
              ))
        ),

        // Stats tab
        activeTab === 'stats' && stats && React.createElement('div', { className: 'sf-stat-grid' },
          React.createElement('div', { className: 'sf-stat-card' },
            React.createElement('div', { className: 'sf-stat-value' }, String(stats.active)),
            React.createElement('div', { className: 'sf-stat-label' }, '已激活'),
          ),
          React.createElement('div', { className: 'sf-stat-card' },
            React.createElement('div', { className: 'sf-stat-value' }, String(stats.total)),
            React.createElement('div', { className: 'sf-stat-label' }, '总技能'),
          ),
          React.createElement('div', { className: 'sf-stat-card' },
            React.createElement('div', { className: 'sf-stat-value' }, String(stats.totalUsage)),
            React.createElement('div', { className: 'sf-stat-label' }, '总调用'),
          ),
          React.createElement('div', { className: 'sf-stat-card' },
            React.createElement('div', { className: 'sf-stat-value' }, String(runs.length)),
            React.createElement('div', { className: 'sf-stat-label' }, '锻造任务'),
          ),
        ),
      ),
    ),
  )
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_approval: '待审核',
    active: '已激活',
    archived: '已归档',
    failed: '失败',
    extracting: '提取中',
    generating: '生成中',
    verifying: '验证中',
    refining: '优化中',
    auditing: '审计中',
    created: '已创建',
  }
  return labels[status] || status
}
