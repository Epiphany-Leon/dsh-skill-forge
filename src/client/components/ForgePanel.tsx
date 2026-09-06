/**
 * ForgePanel — 右侧边栏中的 Skill Forge Tab 内容
 * 重构版：保持内联渲染，避免函数参数传递问题
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api.js'

type ViewType = 'active' | 'pending' | 'running' | 'history' | 'stats'

export function ForgePanel(): React.ReactElement {
  const [skills, setSkills] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [currentView, setCurrentView] = useState<ViewType>('active')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [selectedType, setSelectedType] = useState<'skill' | 'run' | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [showSkillDetail, setShowSkillDetail] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'quality' | 'usage' | 'created'>('name')
  // 版本历史
  const [skillVersions, setSkillVersions] = useState<any[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  // 谱系追踪
  const [skillLineage, setSkillLineage] = useState<{ origin: any; derivations: any[] } | null>(null)
  const [loadingLineage, setLoadingLineage] = useState(false)
  // 相关技能推荐
  const [relatedSkills, setRelatedSkills] = useState<any[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)
  // 版本 Diff
  const [diffFrom, setDiffFrom] = useState('')
  const [diffTo, setDiffTo] = useState('')
  const [diffResult, setDiffResult] = useState<any>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  // 使用反馈
  const [feedbackSent, setFeedbackSent] = useState<Record<string, string>>({})
  // 拒绝理由 Modal
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectRunId, setRejectRunId] = useState<string | null>(null)
  const [rejectReasons, setRejectReasons] = useState<string[]>([])
  const [rejectCustomText, setRejectCustomText] = useState('')
  // 编辑技能 Modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSkill, setEditSkill] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', whenToUse: '', body: '', tags: '', category: '', changelog: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [sk, r, st] = await Promise.all([api.getSkills(), api.getQueue(20), api.getStatsDetail()])
      setSkills(sk)
      setRuns(r)
      setStats(st)
    } catch (err) {
      console.error('[skill-forge] fetch failed:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 5000)
    return () => clearInterval(t)
  }, [fetchData])

  const pendingRuns = useMemo(() => runs.filter(r => r.status === 'pending_approval'), [runs])
  const runningRuns = useMemo(() => runs.filter(r => ['extracting', 'generating', 'verifying', 'refining', 'auditing', 'iterating', 'created'].includes(r.status)), [runs])
  const historyRuns = useMemo(() => runs.filter(r => ['failed', 'active', 'archived', 'rejected'].includes(r.status)), [runs])
  const activeSkills = useMemo(() => skills.filter(s => s.status === 'active'), [skills])

  const filteredActiveSkills = useMemo(() => {
    if (!searchQuery.trim()) return activeSkills
    const q = searchQuery.trim().toLowerCase()
    return activeSkills.filter(s =>
      s.frontmatter?.name?.toLowerCase().includes(q) ||
      s.frontmatter?.description?.toLowerCase().includes(q)
    )
  }, [activeSkills, searchQuery])

  const counts = useMemo(() => ({
    active: stats?.active ?? activeSkills.length,
    pending: pendingRuns.length,
    running: runningRuns.length,
    history: historyRuns.length,
  }), [stats, activeSkills.length, pendingRuns.length, runningRuns.length, historyRuns.length])

  // ---- 操作 ----
  const handleTrigger = async () => {
    setTriggering(true)
    try { await api.triggerForge('manual trigger from UI'); await fetchData(); setCurrentView('running') }
    catch (e) { console.error('[skill-forge] trigger failed:', e) }
    finally { setTriggering(false) }
  }

  const handleApprove = async (runId: string) => {
    try { await api.approveSkill(runId); await fetchData() } catch (e) { console.error(e) }
  }

  const handleReject = async (runId: string) => {
    setRejectRunId(runId); setRejectReasons([]); setRejectCustomText(''); setShowRejectModal(true)
  }

  const confirmReject = async () => {
    if (!rejectRunId) return
    try {
      const reasons = [...rejectReasons]
      if (rejectCustomText.trim()) reasons.push(rejectCustomText.trim())
      await api.rejectSkill(rejectRunId, reasons.length > 0 ? reasons : ['未提供理由'])
      await fetchData(); setShowRejectModal(false); setRejectRunId(null)
    } catch (e) { console.error(e) }
  }

  const toggleRejectReason = (reason: string) => {
    setRejectReasons(prev => prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason])
  }

  const handleCancel = async (runId: string) => {
    try { await api.cancelForge(runId); await fetchData() } catch (e) { console.error(e) }
  }

  const handleRetry = async (runId: string) => {
    try { await api.retryForge(runId); await fetchData() } catch (e) { console.error(e) }
  }

  const handleArchiveSkill = async (name: string) => {
    try { await api.archiveSkill(name); await fetchData(); setSelectedItem(null) } catch (e) { console.error(e) }
  }

  const handleFeedback = async (name: string, rating: 'helpful' | 'neutral' | 'harmful') => {
    if (feedbackSent[name]) return
    try {
      await api.recordFeedback(name, rating)
      setFeedbackSent(prev => ({ ...prev, [name]: rating }))
    } catch (e) { console.error(e) }
  }

  const handleEditSkill = (skill: any) => {
    const fm = skill.frontmatter || {}
    setEditSkill(skill)
    setEditForm({
      name: fm.name || '',
      description: fm.description || '',
      whenToUse: fm.whenToUse || '',
      body: skill.body || '',
      tags: (fm.tags || []).join(', '),
      category: fm.category || '',
      changelog: '',
    })
    setShowEditModal(true)
  }

  const confirmEdit = async () => {
    if (!editSkill || !editForm.changelog.trim()) return
    setSavingEdit(true)
    try {
      await api.updateSkill(editSkill.frontmatter?.name || editSkill.id, {
        frontmatter: {
          description: editForm.description,
          whenToUse: editForm.whenToUse,
          tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          category: editForm.category,
        },
        body: editForm.body,
        changelog: editForm.changelog,
      })
      await fetchData()
      setShowEditModal(false)
    } catch (e) { console.error(e) }
    finally { setSavingEdit(false) }
  }

  // ---- 辅助 ----
  const selectSkill = async (skill: any) => {
    setSelectedItem(skill); setSelectedType('skill'); setShowSkillDetail(true)
    // 加载版本历史
    setLoadingVersions(true)
    try {
      const v = await api.getSkillVersions(skill.frontmatter?.name || skill.id)
      setSkillVersions(v?.versions || [])
    } catch (e) { setSkillVersions([]) }
    finally { setLoadingVersions(false) }
    // 加载谱系
    setLoadingLineage(true)
    try {
      const l = await api.getSkillLineage(skill.frontmatter?.name || skill.id)
      setSkillLineage(l)
    } catch (e) { setSkillLineage(null) }
    finally { setLoadingLineage(false) }
    // 加载相关技能
    setLoadingRelated(true)
    try {
      const r = await api.getRelatedSkills(skill.frontmatter?.name || skill.id)
      setRelatedSkills(Array.isArray(r) ? r : r?.related || [])
    } catch (e) { setRelatedSkills([]) }
    finally { setLoadingRelated(false) }
  }

  const selectRun = (run: any) => {
    setSelectedItem(run); setSelectedType('run'); setShowSkillDetail(true)
  }

  const backToList = () => {
    setShowSkillDetail(false); setSelectedItem(null); setSelectedType(null)
    setSkillVersions([]); setSkillLineage(null); setRelatedSkills([])
    setDiffFrom(''); setDiffTo(''); setDiffResult(null)
  }

  const fetchSkillDiff = async (name: string, from: string, to: string) => {
    setLoadingDiff(true)
    try {
      const d = await api.getSkillDiff(name, from, to)
      setDiffResult(d)
    } catch (e) { setDiffResult(null) }
    finally { setLoadingDiff(false) }
  }

  const viewTabs: { key: ViewType; label: string; icon: string; count: number }[] = [
    { key: 'active', label: '已激活', icon: '✨', count: counts.active },
    { key: 'pending', label: '待审核', icon: '⏳', count: counts.pending },
    { key: 'running', label: '进行中', icon: '⚙️', count: counts.running },
    { key: 'history', label: '历史', icon: '📜', count: counts.history },
    { key: 'stats', label: '统计', icon: '📊', count: stats?.total ?? skills.length },
  ]

  // ---- 渲染 ----

  // 详情视图
  if (showSkillDetail && selectedItem) {
    const isSkill = selectedType === 'skill'
    const fm = isSkill ? (selectedItem.frontmatter || {}) : {}
    const item = selectedItem

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 拒绝理由 Modal
      showRejectModal && React.createElement('div', { className: 'sf-modal-overlay', onClick: () => setShowRejectModal(false) },
        React.createElement('div', { className: 'sf-modal', onClick: (e: any) => e.stopPropagation() },
          React.createElement('div', { className: 'sf-modal-header' },
            React.createElement('h3', { className: 'sf-modal-title' }, '拒绝理由'),
            React.createElement('button', { className: 'sf-modal-close', onClick: () => setShowRejectModal(false) }, '✕'),
          ),
          React.createElement('div', { className: 'sf-modal-body' },
            React.createElement('div', { className: 'sf-modal-label' }, '选择理由（可多选）'),
            React.createElement('div', { className: 'sf-reject-options' },
              ['质量不达标', '内容不够具体', '缺少验证步骤', '不符合使用场景', '安全风险'].map(reason =>
                React.createElement('button', {
                  key: reason,
                  className: `sf-reject-option ${rejectReasons.includes(reason) ? 'sf-reject-option-active' : ''}`,
                  onClick: () => toggleRejectReason(reason),
                }, reason)
              ),
            ),
            React.createElement('div', { className: 'sf-modal-label' }, '补充说明（可选）'),
            React.createElement('textarea', {
              className: 'sf-reject-textarea',
              placeholder: '请输入其他拒绝理由...',
              value: rejectCustomText,
              onChange: (e: any) => setRejectCustomText(e.target.value),
              rows: 3,
            }),
          ),
          React.createElement('div', { className: 'sf-modal-footer' },
            React.createElement('button', { className: 'sf-btn sf-btn-secondary', onClick: () => setShowRejectModal(false) }, '取消'),
            React.createElement('button', { className: 'sf-btn sf-btn-danger', onClick: confirmReject }, '确认拒绝'),
          ),
        ),
      ),

      // 编辑 Modal
      showEditModal && React.createElement('div', { className: 'sf-modal-overlay', onClick: () => setShowEditModal(false) },
        React.createElement('div', { className: 'sf-modal sf-edit-modal', onClick: (e: any) => e.stopPropagation() },
          React.createElement('div', { className: 'sf-modal-header' },
            React.createElement('h3', { className: 'sf-modal-title' }, '编辑技能'),
            React.createElement('button', { className: 'sf-modal-close', onClick: () => setShowEditModal(false) }, '✕'),
          ),
          React.createElement('div', { className: 'sf-modal-body' },
            React.createElement('div', { className: 'sf-edit-field' },
              React.createElement('label', null, '描述'),
              React.createElement('input', { className: 'sf-edit-input', value: editForm.description, onChange: (e: any) => setEditForm(prev => ({ ...prev, description: e.target.value })) }),
            ),
            React.createElement('div', { className: 'sf-edit-field' },
              React.createElement('label', null, '正文'),
              React.createElement('textarea', { className: 'sf-edit-textarea', value: editForm.body, onChange: (e: any) => setEditForm(prev => ({ ...prev, body: e.target.value })), rows: 10 }),
            ),
            React.createElement('div', { className: 'sf-edit-field' },
              React.createElement('label', null, '标签（逗号分隔）'),
              React.createElement('input', { className: 'sf-edit-input', value: editForm.tags, onChange: (e: any) => setEditForm(prev => ({ ...prev, tags: e.target.value })) }),
            ),
            React.createElement('div', { className: 'sf-edit-field' },
              React.createElement('label', null, '变更说明（必填）'),
              React.createElement('textarea', { className: 'sf-edit-textarea', value: editForm.changelog, onChange: (e: any) => setEditForm(prev => ({ ...prev, changelog: e.target.value })), rows: 2 }),
            ),
          ),
          React.createElement('div', { className: 'sf-modal-footer' },
            React.createElement('button', { className: 'sf-btn sf-btn-secondary', onClick: () => setShowEditModal(false) }, '取消'),
            React.createElement('button', { className: 'sf-btn sf-btn-primary', onClick: confirmEdit, disabled: !editForm.changelog.trim() || savingEdit }, savingEdit ? '保存中...' : '保存'),
          ),
        ),
      ),

      // 详情内容
      React.createElement('div', { className: 'sf-detail-view' },
        React.createElement('div', { className: 'sf-detail-back', onClick: backToList }, '← 返回列表'),

        // 标题
        React.createElement('div', { className: 'sf-skill-detail-header' },
          React.createElement('h3', { className: 'sf-skill-detail-title' }, isSkill ? (fm.name || '未命名技能') : (item.sourceSummary || '锻造任务')),
          React.createElement('span', { className: `sf-status-tag sf-status-${item.status}` }, statusLabel(item.status)),
        ),
        isSkill && React.createElement('div', { className: 'sf-skill-detail-subtitle' }, `v${fm.version || '0.1'} · ${item.status === 'active' ? '已注册到 DSH' : statusLabel(item.status)}`),
        !isSkill && React.createElement('div', { className: 'sf-skill-detail-subtitle' }, `质量分: ${(item.verificationResult?.overallScore ?? item.qualityScore ?? 0).toFixed(2)} · 迭代: ${item.currentIteration ?? 0}/${item.maxIterations ?? 0}`),

        // 描述
        (isSkill ? fm.description : null) && React.createElement('div', { className: 'sf-skill-detail-desc' }, fm.description),

        // 质量分进度条
        isSkill && item.qualityScore != null && React.createElement('div', { className: 'sf-quality-bar sf-quality-bar-lg' },
          React.createElement('div', { className: 'sf-quality-bar-fill', style: { width: `${Math.min(item.qualityScore * 100, 100)}%` } }),
          React.createElement('span', { className: 'sf-quality-bar-text' }, `🏆 质量分: ${item.qualityScore.toFixed(2)}`),
        ),

        // 标签
        isSkill && (fm.tags?.length > 0 || fm.category) && React.createElement('div', { className: 'sf-skill-detail-tags' },
          (fm.tags?.length > 0 ? fm.tags : fm.category ? [fm.category] : []).map((t: string) =>
            React.createElement('span', { key: t, className: 'sf-tag' }, `#${t}`)
          ),
        ),

        // 失败详情
        !isSkill && item.status === 'failed' && item.failureReason && React.createElement('div', { className: 'sf-run-failure-detail' },
          React.createElement('div', { className: 'sf-failure-row' },
            React.createElement('span', { className: 'sf-failure-label' }, '错误码'),
            React.createElement('span', { className: 'sf-failure-code' }, item.failureReason.code),
          ),
          React.createElement('div', { className: 'sf-failure-row' },
            React.createElement('span', { className: 'sf-failure-label' }, '错误消息'),
            React.createElement('span', null, item.failureReason.message),
          ),
          item.failureReason.gate && React.createElement('div', { className: 'sf-failure-row' },
            React.createElement('span', { className: 'sf-failure-label' }, '失败阶段'),
            React.createElement('span', null, `Gate ${item.failureReason.gate}`),
          ),
        ),

        // 统计网格（技能详情）
        isSkill && React.createElement('div', { className: 'sf-skill-stats-grid' },
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num' }, String(item.usageCount ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '使用次数'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num' }, fm.qualityScore ? fm.qualityScore.toFixed(2) : '—'),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '质量分'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num' }, item.createdAt ? formatTime(item.createdAt) : '—'),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '创建时间'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num' }, fm.forgedFromRunId ? '锻造' : '手动'),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '来源'),
          ),
        ),

        // 版本历史（技能详情）
        isSkill && skillVersions.length > 0 && React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' }, `版本历史 (${skillVersions.length})`),
          React.createElement('div', { className: 'sf-version-list' },
            skillVersions.map((v: any, i: number) =>
              React.createElement('div', { key: v.version || i, className: 'sf-version-item' },
                React.createElement('span', { className: 'sf-version-num' }, `v${v.version || '?'}`),
                React.createElement('span', { className: 'sf-version-time' }, formatTime(v.timestamp)),
                React.createElement('span', { className: 'sf-version-changelog' }, v.changelog || ''),
              )
            ),
          ),
        ),

        // 谱系追踪（技能详情）
        isSkill && skillLineage && (skillLineage.origin || skillLineage.derivations?.length > 0) && React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' }, '🔗 谱系追踪'),
          skillLineage.origin && React.createElement('div', { className: 'sf-lineage-origin' },
            React.createElement('span', null, `来源: ${skillLineage.origin.sourceSummary || skillLineage.origin.id?.substring(0, 20)}`),
            skillLineage.origin.createdAt && React.createElement('span', { className: 'sf-lineage-time' }, formatTime(skillLineage.origin.createdAt)),
          ),
          skillLineage.derivations?.length > 0 && React.createElement('div', { className: 'sf-lineage-derivations' },
            React.createElement('span', null, `衍生技能: ${skillLineage.derivations.length} 个`),
          ),
        ),

        // 相关技能推荐（技能详情）
        isSkill && relatedSkills.length > 0 && React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' }, '🔗 相关技能'),
          React.createElement('div', { className: 'sf-related-skills' },
            relatedSkills.slice(0, 5).map((r: any) =>
              React.createElement('div', {
                key: r.name || r.id,
                className: 'sf-related-skill-item',
                onClick: () => selectSkill(r),
              },
                React.createElement('span', { className: 'sf-related-skill-name' }, r.name || r.frontmatter?.name || '?'),
                React.createElement('span', { className: 'sf-related-skill-score' }, `${(r.score ?? 0).toFixed(2)}`),
              )
            ),
          ),
        ),

        // 使用反馈（技能详情）
        isSkill && item.status === 'active' && React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' }, '使用反馈'),
          feedbackSent[fm.name]
            ? React.createElement('div', { className: 'sf-feedback-thanks' }, '感谢反馈！')
            : React.createElement('div', { className: 'sf-feedback-buttons' },
                React.createElement('button', { className: 'sf-btn sf-btn-ghost', onClick: () => handleFeedback(fm.name, 'helpful') }, '👍 有用'),
                React.createElement('button', { className: 'sf-btn sf-btn-ghost', onClick: () => handleFeedback(fm.name, 'neutral') }, '😐 一般'),
                React.createElement('button', { className: 'sf-btn sf-btn-ghost', onClick: () => handleFeedback(fm.name, 'harmful') }, '👎 没用'),
              ),
        ),

        // 操作按钮
        React.createElement('div', { className: 'sf-detail-actions' },
          isSkill && item.status === 'active' && React.createElement('button', { className: 'sf-btn sf-btn-secondary', onClick: () => handleArchiveSkill(fm.name) }, '📦 归档'),
          isSkill && item.status === 'archived' && React.createElement('button', { className: 'sf-btn sf-btn-secondary', onClick: () => {} }, '复活'),
          isSkill && React.createElement('button', { className: 'sf-btn sf-btn-secondary', onClick: () => handleEditSkill(item) }, '✏️ 编辑'),
          !isSkill && item.status === 'pending_approval' && React.createElement('button', { className: 'sf-btn sf-btn-primary', onClick: () => handleApprove(item.id) }, '✓ 批准'),
          !isSkill && item.status === 'pending_approval' && React.createElement('button', { className: 'sf-btn sf-btn-danger', onClick: () => handleReject(item.id) }, '✗ 拒绝'),
          !isSkill && item.status === 'failed' && React.createElement('button', { className: 'sf-btn sf-btn-secondary', onClick: () => handleRetry(item.id) }, '🔄 重试'),
          !isSkill && ['extracting', 'generating', 'verifying', 'refining', 'auditing', 'iterating'].includes(item.status) && React.createElement('button', { className: 'sf-btn sf-btn-danger', onClick: () => handleCancel(item.id) }, '⏹ 取消'),
        ),
      ),
    )
  }

  // 统计视图
  if (currentView === 'stats') {
    const detail = stats as any
    const dailyStats = detail?.dailyStats || []
    const topSkills = detail?.topSkills || []
    const recentForges = detail?.recentForges || []
    const injectionStats = detail?.injectionStats || { totalInjections: 0, smartInjectionRatio: 0, totalSkillInjections: 0 }

    // 7天趋势柱状图的最大值
    const maxForge = Math.max(...dailyStats.map((d: any) => d.forgeCount), 1)

    // 质量分色
    const qualityColor = (score: number) => {
      if (score >= 0.8) return '#10B981'
      if (score >= 0.6) return '#F59E0B'
      return '#EF4444'
    }

    const statusLabel = (status: string) => {
      const map: Record<string, string> = {
        active: '已完成', pending_approval: '待审核', failed: '失败',
        cancelled: '已取消', rejected: '已拒绝', running: '进行中',
        extracting: '提取中', generating: '生成中', verifying: '验证中',
        iterating: '迭代中', auditing: '审核中', created: '已创建',
        trigger_skipped: '未触发', extraction_failed: '提取失败',
        generation_failed: '生成失败', audit_failed: '审核失败',
      }
      return map[status] || status
    }

    const formatTime = (ts: number) => {
      if (!ts) return ''
      const d = new Date(ts)
      const now = new Date()
      const diff = now.getTime() - d.getTime()
      if (diff < 60 * 1000) return '刚刚'
      if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`
      if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}天前`
      return `${d.getMonth() + 1}/${d.getDate()}`
    }

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement('div', { className: 'sf-forge-stats' },
        viewTabs.map(tab =>
          React.createElement('div', {
            key: tab.key,
            className: `sf-stat-mini ${currentView === tab.key ? 'sf-stat-active' : ''}`,
            onClick: () => setCurrentView(tab.key),
            style: { cursor: 'pointer' },
          },
            React.createElement('div', { className: 'sf-stat-icon' }, tab.icon),
            React.createElement('div', { className: 'sf-stat-num' }, String(tab.count)),
            React.createElement('div', { className: 'sf-stat-label' }, tab.label),
          )
        ),
      ),
      React.createElement('div', { className: 'sf-dashboard' },
        // 4 个大数字卡片
        React.createElement('div', { className: 'sf-dashboard-cards' },
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#3B82F6' } }, String(stats?.total ?? 0)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '总技能数'),
          ),
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#10B981' } }, String(stats?.active ?? 0)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '活跃技能'),
          ),
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#F59E0B' } }, String(runs.length)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '锻造总数'),
          ),
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#8B5CF6' } }, detail?.avgQualityScore ? detail.avgQualityScore.toFixed(2) : '0.62'),
            React.createElement('div', { className: 'sf-stat-big-label' }, '平均质量分'),
          ),
        ),

        // 最近 7 天趋势
        React.createElement('div', { className: 'sf-dashboard-section' },
          React.createElement('h4', { className: 'sf-section-title' }, '📈 最近 7 天趋势'),
          React.createElement('div', { className: 'sf-trend-chart' },
            dailyStats.length > 0 ? dailyStats.map((d: any, i: number) =>
              React.createElement('div', { key: i, className: 'sf-trend-bar-wrap' },
                React.createElement('div', { className: 'sf-trend-bar', style: { height: `${(d.forgeCount / maxForge) * 100}%`, minHeight: d.forgeCount > 0 ? '4px' : '2px' } }),
                React.createElement('div', { className: 'sf-trend-label' }, d.date),
              )
            ) : React.createElement('div', { className: 'sf-empty-text' }, '暂无数据'),
          ),
          dailyStats.length > 0 && React.createElement('div', { className: 'sf-trend-legend' },
            React.createElement('span', { className: 'sf-trend-legend-item' },
              React.createElement('span', { className: 'sf-trend-legend-dot', style: { background: '#3B82F6' } }),
              '锻造数',
            ),
          ),
        ),

        // Top 5 常用技能
        React.createElement('div', { className: 'sf-dashboard-section' },
          React.createElement('h4', { className: 'sf-section-title' }, '🔥 Top 5 常用技能'),
          React.createElement('div', { className: 'sf-bar-chart' },
            topSkills.length > 0 ? topSkills.map((s: any, i: number) => {
              const maxUsage = Math.max(...topSkills.map((t: any) => t.usageCount), 1)
              return React.createElement('div', { key: i, className: 'sf-bar-item' },
                React.createElement('div', { className: 'sf-bar-label' },
                  React.createElement('span', { className: 'sf-bar-cat-name' }, `${i + 1}. ${s.name}`),
                  React.createElement('span', { className: 'sf-bar-cat-count' }, `${s.usageCount} 次`),
                ),
                React.createElement('div', { className: 'sf-bar-track' },
                  React.createElement('div', { className: 'sf-bar-fill', style: { width: `${(s.usageCount / maxUsage) * 100}%`, background: qualityColor(s.qualityScore) } }),
                ),
                s.qualityScore > 0 && React.createElement('div', { className: 'sf-bar-quality' },
                  `质量分 ${s.qualityScore.toFixed(2)}`,
                ),
              )
            }) : React.createElement('div', { className: 'sf-empty-text' }, '暂无使用数据'),
          ),
        ),

        // 最近锻造
        React.createElement('div', { className: 'sf-dashboard-section' },
          React.createElement('h4', { className: 'sf-section-title' }, '⚒️ 最近锻造'),
          React.createElement('div', { className: 'sf-timeline' },
            recentForges.length > 0 ? recentForges.map((r: any, i: number) =>
              React.createElement('div', { key: r.id || i, className: 'sf-timeline-item' },
                React.createElement('div', { className: `sf-timeline-dot sf-timeline-dot-${r.status}` }),
                React.createElement('div', { className: 'sf-timeline-content' },
                  React.createElement('div', { className: 'sf-timeline-header' },
                    React.createElement('span', { className: 'sf-timeline-title' }, r.sourceSummary?.substring?.(0, 30) || '锻造任务'),
                    React.createElement('span', { className: `sf-status-tag sf-status-${r.status}` }, statusLabel(r.status)),
                  ),
                  React.createElement('div', { className: 'sf-timeline-meta' },
                    formatTime(r.createdAt),
                    r.qualityScore != null && React.createElement('span', { className: 'sf-timeline-score', style: { color: qualityColor(r.qualityScore) } },
                      ` · 质量分 ${r.qualityScore.toFixed(2)}`,
                    ),
                  ),
                ),
              )
            ) : React.createElement('div', { className: 'sf-empty-text' }, '暂无锻造记录'),
          ),
        ),

        // 注入统计
        React.createElement('div', { className: 'sf-dashboard-section' },
          React.createElement('h4', { className: 'sf-section-title' }, '💉 注入统计'),
          React.createElement('div', { className: 'sf-inject-stats' },
            React.createElement('div', { className: 'sf-inject-stat-row' },
              React.createElement('span', { className: 'sf-inject-label' }, '总注入次数'),
              React.createElement('span', { className: 'sf-inject-value' }, String(injectionStats.totalInjections || 0)),
            ),
            React.createElement('div', { className: 'sf-inject-stat-row' },
              React.createElement('span', { className: 'sf-inject-label' }, '累计技能注入'),
              React.createElement('span', { className: 'sf-inject-value' }, String(injectionStats.totalSkillInjections || 0)),
            ),
            React.createElement('div', { className: 'sf-inject-stat-row' },
              React.createElement('span', { className: 'sf-inject-label' }, '智能注入占比'),
              React.createElement('span', { className: 'sf-inject-value' }, `${((injectionStats.smartInjectionRatio || 0) * 100).toFixed(0)}%`),
            ),
            React.createElement('div', { className: 'sf-inject-progress' },
              React.createElement('div', { className: 'sf-inject-progress-fill', style: { width: `${Math.min((injectionStats.smartInjectionRatio || 0) * 100, 100)}%` } }),
            ),
          ),
        ),
      ),
    )
  }

  // 列表视图
  const listItems = currentView === 'active' ? filteredActiveSkills :
    currentView === 'pending' ? pendingRuns :
    currentView === 'running' ? runningRuns : historyRuns

  const emptyText = currentView === 'active' ? '暂无已激活技能' :
    currentView === 'pending' ? '暂无待审核任务' :
    currentView === 'running' ? '暂无进行中任务' : '暂无历史记录'

  return React.createElement('div', { className: 'sf-forge-panel' },
    // 统计卡片
    React.createElement('div', { className: 'sf-forge-stats' },
      viewTabs.map(tab =>
        React.createElement('div', {
          key: tab.key,
          className: `sf-stat-mini ${currentView === tab.key ? 'sf-stat-active' : ''}`,
          onClick: () => { setCurrentView(tab.key); backToList() },
          style: { cursor: 'pointer' },
        },
          React.createElement('div', { className: 'sf-stat-icon' }, tab.icon),
          React.createElement('div', { className: 'sf-stat-num' }, String(tab.count)),
          React.createElement('div', { className: 'sf-stat-label' }, tab.label),
        )
      ),
    ),

    // 触发按钮
    React.createElement('div', { className: 'sf-forge-trigger' },
      React.createElement('button', {
        className: 'sf-btn sf-btn-primary sf-btn-full',
        onClick: handleTrigger,
        disabled: triggering,
      }, triggering ? '锻造中...' : '🚀 触发技能锻造'),
    ),

    // 搜索栏（已激活视图）
    currentView === 'active' && React.createElement('div', { className: 'sf-search-bar' },
      React.createElement('input', {
        className: 'sf-search-input',
        placeholder: '搜索技能...',
        value: searchQuery,
        onChange: (e: any) => setSearchQuery(e.target.value),
      }),
    ),

    // 列表
    React.createElement('div', { className: 'sf-forge-list' },
      listItems.length === 0
        ? React.createElement('div', { className: 'sf-empty-small' }, emptyText)
        : listItems.map((item: any) => {
            if (currentView === 'active') {
              const fm = item.frontmatter || {}
              const preview = (item.body || '').replace(/^[\->|`~]+/gm, '').substring(0, 150)
              return React.createElement('div', {
                key: item.id,
                className: 'sf-skill-item',
                onClick: () => selectSkill(item),
              },
                React.createElement('div', { className: 'sf-skill-item-header' },
                  React.createElement('span', { className: 'sf-skill-item-name' }, fm.name || '未命名'),
                  React.createElement('span', { className: 'sf-skill-item-version' }, `v${fm.version || '0.1'}`),
                ),
                React.createElement('div', { className: 'sf-skill-item-desc' }, fm.description || '暂无描述'),
                // tags
                (fm.tags?.length > 0 || fm.category) && React.createElement('div', { className: 'sf-skill-item-tags' },
                  (fm.tags?.length > 0 ? fm.tags.slice(0, 3) : fm.category ? [fm.category] : []).map((t: string) =>
                    React.createElement('span', { key: t, className: 'sf-tag-mini' }, `#${t}`)
                  ),
                ),
                // 预览
                preview && React.createElement('div', { className: 'sf-skill-item-preview' }, preview),
                // 质量分
                item.qualityScore != null && React.createElement('div', { className: 'sf-skill-item-meta' },
                  React.createElement('span', { className: 'sf-skill-quality' }, `🏆 ${item.qualityScore.toFixed(2)}`),
                ),
              )
            } else {
              return React.createElement('div', {
                key: item.id,
                className: `sf-run-item sf-run-${item.status}`,
                onClick: () => selectRun(item),
                style: { cursor: 'pointer' },
              },
                React.createElement('div', { className: 'sf-run-header' },
                  React.createElement('span', { className: 'sf-run-name' },
                    item.generatedSkill?.frontmatter?.name ||
                    (item.sourceSummary?.substring(0, 30) + (item.sourceSummary?.length > 30 ? '...' : '')) ||
                    '未命名'
                  ),
                  React.createElement('span', { className: `sf-status-tag sf-status-${item.status}` }, statusLabel(item.status)),
                ),
                React.createElement('div', { className: 'sf-run-meta' },
                  item.qualityScore > 0 && React.createElement('span', null, `质量 ${item.qualityScore.toFixed(2)}`),
                  React.createElement('span', null, formatTime(item.createdAt)),
                ),
              )
            }
          })
    ),
  )
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_approval: '待审核', active: '已激活', archived: '已归档', failed: '失败', rejected: '已拒绝',
    extracting: '提取中', generating: '生成中', verifying: '验证中', refining: '优化中', auditing: '审计中',
    iterating: '迭代中', created: '已创建',
  }
  return labels[status] || status
}

function formatTime(ts: string | number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString()
}
