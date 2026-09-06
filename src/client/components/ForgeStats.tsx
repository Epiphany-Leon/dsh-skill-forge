/**
 * ForgeStats —— 统计面板组件
 */

import React from 'react'
import type { Skill, ForgeRun } from '../../types'

interface Props {
  skills: Skill[]
  runs: ForgeRun[]
}

export function ForgeStats({ skills, runs }: Props) {
  const totalSkills = skills.length
  const activeSkills = skills.filter(s => s.status === 'active').length
  const archivedSkills = skills.filter(s => s.status === 'archived').length
  const totalUsage = skills.reduce((sum, s) => sum + s.usageCount, 0)

  const successRate = runs.length > 0
    ? (runs.filter(r => r.status === 'active' || r.status === 'pending_approval').length / runs.length * 100).toFixed(1)
    : '0.0'

  const avgIterations = runs.filter(r => r.currentIteration > 0).length > 0
    ? (runs.reduce((sum, r) => sum + r.currentIteration, 0) / runs.filter(r => r.currentIteration > 0).length).toFixed(1)
    : '0'

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentSkills = skills.filter(s => s.createdAt > weekAgo).length
  const recentRuns = runs.filter(r => r.createdAt > weekAgo).length

  return (
    <div className="sf-stats">
      <div className="sf-stat-grid">
        <div className="sf-stat-card">
          <div className="sf-stat-value">{activeSkills}</div>
          <div className="sf-stat-label">已激活技能</div>
        </div>
        <div className="sf-stat-card">
          <div className="sf-stat-value">{totalSkills}</div>
          <div className="sf-stat-label">总技能数</div>
        </div>
        <div className="sf-stat-card">
          <div className="sf-stat-value">{totalUsage}</div>
          <div className="sf-stat-label">总调用次数</div>
        </div>
        <div className="sf-stat-card">
          <div className="sf-stat-value">{successRate}%</div>
          <div className="sf-stat-label">锻造成功率</div>
        </div>
      </div>

      <div className="sf-stat-section">
        <h4>本周数据</h4>
        <div className="sf-stat-row">
          <span>新增技能</span>
          <span className="sf-stat-accent">+{recentSkills}</span>
        </div>
        <div className="sf-stat-row">
          <span>锻造任务</span>
          <span className="sf-stat-accent">{recentRuns} 次</span>
        </div>
        <div className="sf-stat-row">
          <span>平均迭代轮数</span>
          <span className="sf-stat-accent">{avgIterations} 轮</span>
        </div>
      </div>

      <div className="sf-stat-section">
        <h4>技能状态分布</h4>
        <div className="sf-stat-row">
          <span>已激活</span>
          <span>{activeSkills}</span>
        </div>
        <div className="sf-stat-row">
          <span>已归档</span>
          <span>{archivedSkills}</span>
        </div>
        <div className="sf-stat-row">
          <span>草稿/待审核</span>
          <span>{totalSkills - activeSkills - archivedSkills}</span>
        </div>
      </div>

      {archivedSkills > 5 && (
        <div className="sf-stat-tip">
          💡 已归档技能较多，可以考虑用<strong>饕餮融合</strong>将同类技能合并优化
        </div>
      )}

      {activeSkills > 30 && (
        <div className="sf-stat-tip sf-stat-warning">
          ⚠️ 活跃技能超过 30 个，可能影响召回效果。建议整理或使用达尔文优化提升质量。
        </div>
      )}
    </div>
  )
}
