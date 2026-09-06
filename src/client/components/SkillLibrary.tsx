/**
 * SkillLibrary —— 技能库组件
 */

import React, { useState } from 'react'
import type { Skill, SkillStatus } from '../../types'

interface Props {
  skills: Skill[]
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
}

const STATUS_LABELS: Record<SkillStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  active: '已激活',
  archived: '已归档',
  deprecated: '已弃用',
}

export function SkillLibrary({ skills, onArchive, onUnarchive }: Props) {
  const [filter, setFilter] = useState<'all' | SkillStatus>('all')
  const [search, setSearch] = useState('')

  const filtered = skills.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false
    if (search && !s.frontmatter.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.frontmatter.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (skills.length === 0) {
    return (
      <div className="sf-empty">
        <p>技能库为空</p>
        <p className="sf-empty-hint">锻造出的技能会出现在这里</p>
      </div>
    )
  }

  return (
    <div className="sf-skills">
      <div className="sf-skills-toolbar">
        <input
          type="text"
          className="sf-search"
          placeholder="搜索技能..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="sf-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as SkillStatus | 'all')}
        >
          <option value="all">全部 ({skills.length})</option>
          <option value="active">已激活 ({skills.filter(s => s.status === 'active').length})</option>
          <option value="archived">已归档 ({skills.filter(s => s.status === 'archived').length})</option>
          <option value="draft">草稿 ({skills.filter(s => s.status === 'draft').length})</option>
        </select>
      </div>

      <div className="sf-skill-list">
        {filtered.map((skill) => (
          <div key={skill.id} className="sf-skill-item">
            <div className="sf-skill-header">
              <span className="sf-skill-name">{skill.frontmatter.name}</span>
              <span className={`sf-skill-status sf-status-${skill.status}`}>
                {STATUS_LABELS[skill.status]}
              </span>
            </div>
            <p className="sf-skill-desc">{skill.frontmatter.description}</p>
            <div className="sf-skill-meta">
              <span>v{skill.version}</span>
              <span>调用 {skill.usageCount} 次</span>
              {skill.verificationScore !== undefined && (
                <span>验证分 {(skill.verificationScore * 100).toFixed(0)}%</span>
              )}
            </div>
            {skill.frontmatter.tags && skill.frontmatter.tags.length > 0 && (
              <div className="sf-skill-tags">
                {skill.frontmatter.tags.map((tag, i) => (
                  <span key={i} className="sf-tag">{tag}</span>
                ))}
              </div>
            )}
            <div className="sf-skill-actions">
              {skill.status === 'active' ? (
                <button className="sf-btn sf-btn-ghost" onClick={() => onArchive(skill.id)}>
                  归档
                </button>
              ) : skill.status === 'archived' ? (
                <button className="sf-btn sf-btn-secondary" onClick={() => onUnarchive(skill.id)}>
                  恢复
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
