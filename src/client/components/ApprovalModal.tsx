/**
 * ApprovalModal —— 人工审核弹窗
 *
 * Gate 6：展示技能详情，用户选择批准/拒绝。
 * 拒绝时有预设理由 + 自定义文本。
 */

import React, { useState } from 'react'
import type { ForgeRun } from '../../types'

interface Props {
  run: ForgeRun
  onApprove: () => void
  onReject: (reasons: string[], customText: string) => void
  onClose: () => void
}

const REJECTION_REASONS = [
  { key: 'quality', label: '质量不达标', desc: '内容太水/不准确/不完整' },
  { key: 'useless', label: '不实用', desc: '场景太窄/日常用不上' },
  { key: 'security', label: '有安全隐患', desc: '危险操作/隐私泄露' },
  { key: 'duplicate', label: '与已有技能重复', desc: '功能重叠' },
  { key: 'unclear', label: '看不懂', desc: '描述含糊/逻辑混乱' },
  { key: 'format', label: '格式有问题', desc: '结构乱/缺字段' },
]

export function ApprovalModal({ run, onApprove, onReject, onClose }: Props) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [customText, setCustomText] = useState('')
  const [showSkillBody, setShowSkillBody] = useState(false)

  const skill = run.generatedSkill
  const verification = run.verificationResult
  const audit = run.auditResult

  const toggleReason = (key: string) => {
    setSelectedReasons(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    )
  }

  const handleReject = () => {
    if (selectedReasons.length === 0 && !customText.trim()) {
      alert('请至少选择一个拒绝理由或填写自定义说明')
      return
    }
    onReject(selectedReasons, customText.trim())
  }

  return (
    <div className="sf-modal-overlay" onClick={onClose}>
      <div className="sf-modal" onClick={e => e.stopPropagation()}>
        <div className="sf-modal-header">
          <h3>🔍 技能审核</h3>
          <button className="sf-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="sf-modal-body">
          {/* 技能基本信息 */}
          <div className="sf-skill-preview">
            <h4>{skill?.frontmatter.name || '未命名技能'}</h4>
            <p className="sf-skill-desc">{skill?.frontmatter.description}</p>
            <div className="sf-skill-when">
              <strong>适用场景：</strong>{skill?.frontmatter.whenToUse}
            </div>
            {skill?.frontmatter.tags && skill.frontmatter.tags.length > 0 && (
              <div className="sf-skill-tags">
                {skill.frontmatter.tags.map((tag, i) => (
                  <span key={i} className="sf-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* 折叠：技能正文 */}
          <div className="sf-collapsible">
            <button
              className="sf-collapse-btn"
              onClick={() => setShowSkillBody(!showSkillBody)}
            >
              {showSkillBody ? '▼' : '▶'} 查看技能正文
            </button>
            {showSkillBody && (
              <div className="sf-skill-body">
                <pre>{skill?.body}</pre>
              </div>
            )}
          </div>

          {/* 验证结果 */}
          {verification && (
            <div className="sf-verification-card">
              <h5>✅ 验证结果</h5>
              <div className="sf-verification-stats">
                <div>
                  <span className="sf-stat-value">{verification.passedTests}/{verification.totalTests}</span>
                  <span className="sf-stat-label">测试通过</span>
                </div>
                <div>
                  <span className="sf-stat-value">{(verification.overallScore * 100).toFixed(0)}%</span>
                  <span className="sf-stat-label">总体得分</span>
                </div>
              </div>
              {verification.failedTests > 0 && (
                <div className="sf-failed-tests">
                  失败的测试：
                  <ul>
                    {verification.testResults
                      .filter(r => !r.passed)
                      .slice(0, 3)
                      .map(r => (
                        <li key={r.testId}>
                          <strong>{r.testName}</strong>
                          {r.error && <span> — {r.error.substring(0, 50)}</span>}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 安全审计结果 */}
          {audit && (
            <div className={`sf-audit-card ${audit.dangers.length > 0 ? 'sf-audit-danger' : audit.warnings.length > 0 ? 'sf-audit-warning' : 'sf-audit-ok'}`}>
              <h5>🛡️ 安全审计</h5>
              {audit.dangers.length > 0 && (
                <div className="sf-audit-dangers">
                  <strong>⚠️ 危险项 ({audit.dangers.length})：</strong>
                  <ul>
                    {audit.dangers.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              {audit.warnings.length > 0 && (
                <div className="sf-audit-warnings">
                  <strong>⚠️ 警告 ({audit.warnings.length})：</strong>
                  <ul>
                    {audit.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {audit.dangers.length === 0 && audit.warnings.length === 0 && (
                <p className="sf-audit-clean">✓ 未发现安全问题</p>
              )}
              {audit.duplicateOf && (
                <p className="sf-audit-duplicate">
                  ⚠️ 可能与现有技能重复（相似度 {(audit.similarityScore! * 100).toFixed(0)}%）
                </p>
              )}
            </div>
          )}

          {/* 锻造信息 */}
          <div className="sf-forge-info">
            <span>来源：{run.triggerMode === 'manual' ? '手动触发' : '自动触发'}</span>
            <span>迭代：{run.currentIteration}/{run.maxIterations}</span>
            <span>ID：{run.id.substring(0, 20)}...</span>
          </div>

          {/* 拒绝理由（默认隐藏，点拒绝按钮时展开） */}
          {selectedReasons.length > 0 || customText ? (
            <div className="sf-rejection-section">
              <h5>❌ 拒绝理由</h5>
              <div className="sf-reason-grid">
                {REJECTION_REASONS.map(reason => (
                  <label
                    key={reason.key}
                    className={`sf-reason-item ${selectedReasons.includes(reason.key) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedReasons.includes(reason.key)}
                      onChange={() => toggleReason(reason.key)}
                    />
                    <div>
                      <div className="sf-reason-label">{reason.label}</div>
                      <div className="sf-reason-desc">{reason.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              <textarea
                className="sf-custom-reason"
                placeholder="自定义拒绝理由（可选）..."
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                rows={2}
              />
            </div>
          ) : null}
        </div>

        <div className="sf-modal-footer">
          <button className="sf-btn sf-btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="sf-btn sf-btn-danger" onClick={handleReject}>
            拒绝
          </button>
          <button className="sf-btn sf-btn-primary" onClick={onApprove}>
            ✓ 批准入库
          </button>
        </div>
      </div>
    </div>
  )
}
