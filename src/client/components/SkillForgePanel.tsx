/**
 * SkillForgePanel —— 右侧面板主组件
 */

import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

export function SkillForgePanel() {
  const [activeTab, setActiveTab] = useState<'queue' | 'skills' | 'stats'>('queue')
  const [runs, setRuns] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)

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

  return React.createElement('div', { className: 'sf-panel' },
    React.createElement('div', { className: 'sf-panel-header' },
      React.createElement('h3', null, '🔨 Skill Forge'),
      pendingCount > 0 && React.createElement('span', { className: 'sf-pending-badge' }, `${pendingCount} 待审核`),
    ),
    React.createElement('div', { className: 'sf-tabs' },
      (['queue', 'skills', 'stats'] as const).map(tab =>
        React.createElement('button', {
          key: tab,
          className: `sf-tab ${activeTab === tab ? 'active' : ''}`,
          onClick: () => setActiveTab(tab),
        }, tab === 'queue' ? '锻造队列' : tab === 'skills' ? `技能库 (${skills.length})` : '统计')
      )
    ),
    React.createElement('div', { className: 'sf-tab-content' },
      activeTab === 'queue' && React.createElement('div', { className: 'sf-empty' },
        runs.length === 0
          ? React.createElement('p', null, '暂无锻造任务')
          : runs.map(r => React.createElement('div', { key: r.id, className: 'sf-queue-item' },
            React.createElement('div', { className: 'sf-queue-header' },
              React.createElement('span', { className: 'sf-queue-title' },
                r.generatedSkill?.frontmatter?.name || r.sourceSummary?.substring(0, 30) || '未命名'),
              React.createElement('span', {
                className: 'sf-status-dot',
                style: { backgroundColor: r.status === 'pending_approval' ? '#22c55e' : r.status === 'active' ? '#10b981' : '#94a3b8' },
              }),
            ),
            React.createElement('div', { className: 'sf-queue-meta' },
              React.createElement('span', null, r.status),
              React.createElement('span', { className: 'sf-time' }, new Date(r.createdAt).toLocaleTimeString()),
            ),
            r.status === 'pending_approval' && React.createElement('div', { className: 'sf-queue-actions' },
              React.createElement('button', {
                className: 'sf-btn sf-btn-primary',
                onClick: async () => { await api.approveSkill(r.id); fetchData() },
              }, '批准'),
              React.createElement('button', {
                className: 'sf-btn sf-btn-ghost',
                onClick: async () => { await api.rejectSkill(r.id, ['质量不达标']); fetchData() },
              }, '拒绝'),
            ),
          ))
      ),
      activeTab === 'skills' && React.createElement('div', { className: 'sf-empty' },
        skills.length === 0
          ? React.createElement('p', null, '技能库为空')
          : skills.map(s => React.createElement('div', { key: s.id, className: 'sf-skill-item' },
            React.createElement('div', { className: 'sf-skill-header' },
              React.createElement('span', { className: 'sf-skill-name' }, s.frontmatter?.name),
              React.createElement('span', { className: `sf-skill-status sf-status-${s.status}` }, s.status),
            ),
            React.createElement('p', { className: 'sf-skill-desc' }, s.frontmatter?.description),
          ))
      ),
      activeTab === 'stats' && stats && React.createElement('div', null,
        React.createElement('div', { className: 'sf-stat-grid' },
          React.createElement('div', { className: 'sf-stat-card' },
            React.createElement('div', { className: 'sf-stat-value' }, String(stats.active)),
            React.createElement('div', { className: 'sf-stat-label' }, '已激活技能')),
          React.createElement('div', { className: 'sf-stat-card' },
            React.createElement('div', { className: 'sf-stat-value' }, String(stats.total)),
            React.createElement('div', { className: 'sf-stat-label' }, '总技能数')),
          React.createElement('div', { className: 'sf-stat-card' },
            React.createElement('div', { className: 'sf-stat-value' }, String(stats.totalUsage)),
            React.createElement('div', { className: 'sf-stat-label' }, '总调用')),
          React.createElement('div', { className: 'sf-stat-card' },
            React.createElement('div', { className: 'sf-stat-value' }, String(runs.length)),
            React.createElement('div', { className: 'sf-stat-label' }, '锻造任务')),
        )
      ),
    ),
  )
}
