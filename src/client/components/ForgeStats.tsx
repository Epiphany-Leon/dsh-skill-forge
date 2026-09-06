/**
 * ForgeStats —— 统计面板组件
 */

import React from 'react'

interface StatsSkill {
  status: string
  usageCount: number
  createdAt: number
}

interface StatsRun {
  status: string
  currentIteration: number
  createdAt: number
}

interface ForgeStatsProps {
  skills: StatsSkill[]
  runs: StatsRun[]
}

export function ForgeStats({ skills, runs }: ForgeStatsProps): React.ReactElement {
  const totalSkills = skills.length
  const activeSkills = skills.filter(s => s.status === 'active').length
  const archivedSkills = skills.filter(s => s.status === 'archived').length
  const totalUsage = skills.reduce((sum, s) => sum + s.usageCount, 0)

  const successRate = runs.length > 0
    ? (runs.filter(r => r.status === 'active' || r.status === 'pending_approval').length / runs.length * 100).toFixed(1)
    : '0.0'

  const validRuns = runs.filter(r => r.currentIteration > 0)
  const avgIterations = validRuns.length > 0
    ? (runs.reduce((sum, r) => sum + r.currentIteration, 0) / validRuns.length).toFixed(1)
    : '0'

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentSkills = skills.filter(s => s.createdAt > weekAgo).length
  const recentRuns = runs.filter(r => r.createdAt > weekAgo).length

  return React.createElement('div', { className: 'sf-stats' },
    React.createElement('div', { className: 'sf-stat-grid' },
      React.createElement('div', { className: 'sf-stat-card' },
        React.createElement('div', { className: 'sf-stat-value' }, String(activeSkills)),
        React.createElement('div', { className: 'sf-stat-label' }, '已激活技能'),
      ),
      React.createElement('div', { className: 'sf-stat-card' },
        React.createElement('div', { className: 'sf-stat-value' }, String(totalSkills)),
        React.createElement('div', { className: 'sf-stat-label' }, '总技能数'),
      ),
      React.createElement('div', { className: 'sf-stat-card' },
        React.createElement('div', { className: 'sf-stat-value' }, String(totalUsage)),
        React.createElement('div', { className: 'sf-stat-label' }, '总调用次数'),
      ),
      React.createElement('div', { className: 'sf-stat-card' },
        React.createElement('div', { className: 'sf-stat-value' }, `${successRate}%`),
        React.createElement('div', { className: 'sf-stat-label' }, '锻造成功率'),
      ),
    ),

    React.createElement('div', { className: 'sf-stat-section' },
      React.createElement('h4', null, '本周数据'),
      React.createElement('div', { className: 'sf-stat-row' },
        React.createElement('span', null, '新增技能'),
        React.createElement('span', { className: 'sf-stat-accent' }, `+${recentSkills}`),
      ),
      React.createElement('div', { className: 'sf-stat-row' },
        React.createElement('span', null, '锻造任务'),
        React.createElement('span', { className: 'sf-stat-accent' }, `${recentRuns} 次`),
      ),
      React.createElement('div', { className: 'sf-stat-row' },
        React.createElement('span', null, '平均迭代轮数'),
        React.createElement('span', { className: 'sf-stat-accent' }, `${avgIterations} 轮`),
      ),
    ),

    React.createElement('div', { className: 'sf-stat-section' },
      React.createElement('h4', null, '技能状态分布'),
      React.createElement('div', { className: 'sf-stat-row' },
        React.createElement('span', null, '已激活'),
        React.createElement('span', null, String(activeSkills)),
      ),
      React.createElement('div', { className: 'sf-stat-row' },
        React.createElement('span', null, '已归档'),
        React.createElement('span', null, String(archivedSkills)),
      ),
      React.createElement('div', { className: 'sf-stat-row' },
        React.createElement('span', null, '草稿/待审核'),
        React.createElement('span', null, String(totalSkills - activeSkills - archivedSkills)),
      ),
    ),

    archivedSkills > 5 && React.createElement('div', { className: 'sf-stat-tip' },
      '💡 已归档技能较多，可以考虑用',
      React.createElement('strong', null, '饕餮融合'),
      '将同类技能合并优化',
    ),

    activeSkills > 30 && React.createElement('div', { className: 'sf-stat-tip sf-stat-warning' },
      '⚠️ 活跃技能超过 30 个，可能影响召回效果。建议整理或使用达尔文优化提升质量。',
    ),
  )
}
