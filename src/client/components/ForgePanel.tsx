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

  // ---- 达尔文模式 ----
  const [darwinRuns, setDarwinRuns] = useState<any[]>([])
  const [darwinSelectedSkill, setDarwinSelectedSkill] = useState('')
  const [darwinTargetDims, setDarwinTargetDims] = useState<string[]>([])
  const [darwinAutoApprove, setDarwinAutoApprove] = useState(false)
  const [darwinStarting, setDarwinStarting] = useState(false)
  const [darwinDetailRun, setDarwinDetailRun] = useState<any>(null)
  const [darwinShowDetail, setDarwinShowDetail] = useState(false)
  const [darwinLoadingDetail, setDarwinLoadingDetail] = useState(false)

  // ---- 饕餮模式 ----
  const [taotieGroups, setTaotieGroups] = useState<any[]>([])
  const [taotieThreshold, setTaotieThreshold] = useState(0.4)
  const [taotieDetecting, setTaotieDetecting] = useState(false)
  const [taotieSubView, setTaotieSubView] = useState<'detect' | 'pair' | 'detail' | 'patterns'>('detect')
  const [taotiePairReport, setTaotiePairReport] = useState<any>(null)
  const [taotieAnalyzing, setTaotieAnalyzing] = useState(false)
  const [taotieTarget, setTaotieTarget] = useState('')
  const [taotieSource, setTaotieSource] = useState('')
  const [taotieStarting, setTaotieStarting] = useState(false)
  const [taotieDetailRun, setTaotieDetailRun] = useState<any>(null)
  const [taotiePatterns, setTaotiePatterns] = useState<any[]>([])
  const [taotieLoadingPatterns, setTaotieLoadingPatterns] = useState(false)

  // ---- CoEvo 共进化模式 ----
  const [coevoRuns, setCoevoRuns] = useState<any[]>([])
  const [coevoSelectedSkill, setCoevoSelectedSkill] = useState('')
  const [coevoAutoApprove, setCoevoAutoApprove] = useState(false)
  const [coevoMaxRounds, setCoevoMaxRounds] = useState(8)
  const [coevoTargetSkillScore, setCoevoTargetSkillScore] = useState(0.85)
  const [coevoTargetTestStrength, setCoevoTargetTestStrength] = useState(0.7)
  const [coevoStarting, setCoevoStarting] = useState(false)
  const [coevoDetailRun, setCoevoDetailRun] = useState<any>(null)
  const [coevoShowDetail, setCoevoShowDetail] = useState(false)
  const [coevoLoadingDetail, setCoevoLoadingDetail] = useState(false)
  const [coevoSubView, setCoevoSubView] = useState<'start' | 'runs'>('start')

  // ---- 编排模式 ----
  const [orchQuery, setOrchQuery] = useState('')
  const [orchMode, setOrchMode] = useState<'auto' | 'fast' | 'llm'>('auto')
  const [orchRunning, setOrchRunning] = useState(false)
  const [orchResult, setOrchResult] = useState<any>(null)
  const [orchError, setOrchError] = useState('')
  const [orchStats, setOrchStats] = useState<any>(null)
  const [orchExpandedNode, setOrchExpandedNode] = useState<string | null>(null)
  const [orchShowGuide, setOrchShowGuide] = useState(false)

  // ---- Dreaming 闲时锻造 ----
  const [dreamingCurrent, setDreamingCurrent] = useState<any>(null)
  const [dreamingHistory, setDreamingHistory] = useState<any[]>([])
  const [dreamingSubView, setDreamingSubView] = useState<'dashboard' | 'history'>('dashboard')
  const [dreamingStarting, setDreamingStarting] = useState(false)
  const [dreamingStopping, setDreamingStopping] = useState(false)
  const [dreamingHealthReport, setDreamingHealthReport] = useState<any>(null)
  const [dreamingLoadingHealth, setDreamingLoadingHealth] = useState(false)
  const [dreamingSelectedHistory, setDreamingSelectedHistory] = useState<any>(null)
  const [dreamingShowDetail, setDreamingShowDetail] = useState(false)

  // Forge 子 Tab
  const [forgeSubTab, setForgeSubTab] = useState<'forge' | 'darwin' | 'taotie' | 'coevo' | 'orchestrate' | 'dreaming'>('forge')

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

  const fetchDarwinRuns = useCallback(async () => {
    try {
      const res = await api.darwinRuns(20)
      setDarwinRuns(res?.runs || res || [])
    } catch (err) {
      console.error('[skill-forge] darwin runs fetch failed:', err)
    }
  }, [])

  const fetchDarwinDetail = useCallback(async (runId: string) => {
    try {
      const res = await api.darwinStatus(runId)
      setDarwinDetailRun(res?.run || res || null)
    } catch (err) {
      console.error('[skill-forge] darwin detail fetch failed:', err)
    }
  }, [])

  const fetchTaotiePatterns = useCallback(async () => {
    try {
      setTaotieLoadingPatterns(true)
      const res = await api.taotiePatterns()
      setTaotiePatterns(res?.patterns || res || [])
    } catch (err) {
      console.error('[skill-forge] taotie patterns fetch failed:', err)
    } finally {
      setTaotieLoadingPatterns(false)
    }
  }, [])

  const fetchTaotieDetail = useCallback(async (runId: string) => {
    try {
      const res = await api.taotieStatus(runId)
      setTaotieDetailRun(res?.run || res || null)
    } catch (err) {
      console.error('[skill-forge] taotie detail fetch failed:', err)
    }
  }, [])

  const fetchOrchStats = useCallback(async () => {
    try {
      const res = await api.orchestratorStats()
      setOrchStats(res)
    } catch (err) {
      console.error('[skill-forge] orchestrator stats fetch failed:', err)
    }
  }, [])

  const fetchCoevoRuns = useCallback(async () => {
    try {
      const res = await api.coevoRuns(20)
      setCoevoRuns(res?.runs || res || [])
    } catch (err) {
      console.error('[skill-forge] coevo runs fetch failed:', err)
    }
  }, [])

  const fetchCoevoDetail = useCallback(async (runId: string) => {
    try {
      const res = await api.coevoStatus(runId)
      setCoevoDetailRun(res?.run || res || null)
    } catch (err) {
      console.error('[skill-forge] coevo detail fetch failed:', err)
    }
  }, [])

  const fetchDreamingStatus = useCallback(async () => {
    try {
      const res = await api.dreamingStatus()
      setDreamingCurrent(res?.current || null)
    } catch (err) {
      console.error('[skill-forge] dreaming status fetch failed:', err)
    }
  }, [])

  const fetchDreamingHistory = useCallback(async () => {
    try {
      const res = await api.dreamingHistory(20)
      setDreamingHistory(res?.history || res || [])
    } catch (err) {
      console.error('[skill-forge] dreaming history fetch failed:', err)
    }
  }, [])

  const fetchDreamingHealthReport = useCallback(async () => {
    try {
      setDreamingLoadingHealth(true)
      const res = await api.dreamingHealthReport()
      setDreamingHealthReport(res?.report || null)
    } catch (err) {
      console.error('[skill-forge] dreaming health report fetch failed:', err)
    } finally {
      setDreamingLoadingHealth(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchDarwinRuns()
    fetchTaotiePatterns()
    fetchOrchStats()
    fetchCoevoRuns()
    fetchDreamingStatus()
    fetchDreamingHistory()
    const t = setInterval(() => {
      fetchData()
      if (forgeSubTab === 'darwin') fetchDarwinRuns()
      if (darwinShowDetail && darwinDetailRun?.id) fetchDarwinDetail(darwinDetailRun.id)
      if (taotieSubView === 'detail' && taotieDetailRun?.id) fetchTaotieDetail(taotieDetailRun.id)
      if (forgeSubTab === 'coevo') fetchCoevoRuns()
      if (coevoShowDetail && coevoDetailRun?.id) fetchCoevoDetail(coevoDetailRun.id)
      if (forgeSubTab === 'dreaming') {
        fetchDreamingStatus()
        fetchDreamingHistory()
      }
    }, 5000)
    return () => clearInterval(t)
  }, [fetchData, fetchDarwinRuns, fetchDarwinDetail, fetchTaotieDetail, fetchTaotiePatterns, fetchOrchStats, fetchCoevoRuns, fetchCoevoDetail, fetchDreamingStatus, fetchDreamingHistory, forgeSubTab, darwinShowDetail, darwinDetailRun?.id, taotieSubView, taotieDetailRun?.id, coevoShowDetail, coevoDetailRun?.id])

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

  // ---- 达尔文模式操作 ----
  const DARWIN_DIMS: { key: string; label: string }[] = [
    { key: 'structural_completeness', label: '结构完整性' },
    { key: 'logical_consistency', label: '逻辑一致性' },
    { key: 'operationality', label: '可操作性' },
    { key: 'practicality', label: '实用性' },
    { key: 'security', label: '安全性' },
    { key: 'frontmatter_completeness', label: 'Frontmatter' },
    { key: 'trigger_quality', label: '触发质量' },
    { key: 'tool_call_conformity', label: '工具规范' },
    { key: 'verification_completeness', label: '验证完备' },
    { key: 'cross_scenario_versatility', label: '跨场景' },
  ]

  const darwinStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      created: '已创建', initial_evaluating: '初始评估中', optimizing: '优化中',
      pending_approval: '待批准', running: '运行中', completed: '已完成',
      stopped: '已停止', failed: '失败',
    }
    return map[status] || status
  }

  const scoreColorClass = (score: number): string => {
    if (score >= 0.8) return 'sf-darwin-score-high'
    if (score >= 0.6) return 'sf-darwin-score-mid'
    return 'sf-darwin-score-low'
  }

  const scoreBarClass = (score: number): string => {
    if (score >= 0.8) return 'sf-dim-good'
    if (score >= 0.6) return 'sf-dim-mid'
    return 'sf-dim-low'
  }

  const handleDarwinStart = async () => {
    if (!darwinSelectedSkill) return
    setDarwinStarting(true)
    try {
      const res = await api.darwinStart(
        darwinSelectedSkill,
        darwinTargetDims.length > 0 ? darwinTargetDims : undefined,
        darwinAutoApprove,
      )
      const runId = res?.runId
      if (runId) {
        await fetchDarwinRuns()
        const detail = await api.darwinStatus(runId)
        setDarwinDetailRun(detail?.run || detail || null)
        setDarwinShowDetail(true)
      }
    } catch (e) { console.error('[skill-forge] darwin start failed:', e) }
    finally { setDarwinStarting(false) }
  }

  const handleDarwinApprove = async (runId: string, dimension: string) => {
    try {
      await api.darwinApprove(runId, dimension)
      await fetchDarwinDetail(runId)
      await fetchDarwinRuns()
    } catch (e) { console.error(e) }
  }

  const handleDarwinReject = async (runId: string, dimension: string) => {
    try {
      await api.darwinReject(runId, dimension)
      await fetchDarwinDetail(runId)
      await fetchDarwinRuns()
    } catch (e) { console.error(e) }
  }

  const handleDarwinStop = async (runId: string) => {
    try {
      await api.darwinStop(runId)
      await fetchDarwinDetail(runId)
      await fetchDarwinRuns()
    } catch (e) { console.error(e) }
  }

  const openDarwinDetail = async (run: any) => {
    setDarwinDetailRun(run)
    setDarwinShowDetail(true)
    setDarwinLoadingDetail(true)
    try {
      const res = await api.darwinStatus(run.id)
      setDarwinDetailRun(res?.run || res || run)
    } catch (e) { console.error(e) }
    finally { setDarwinLoadingDetail(false) }
  }

  const toggleDarwinDim = (dim: string) => {
    setDarwinTargetDims(prev =>
      prev.includes(dim) ? prev.filter(d => d !== dim) : [...prev, dim]
    )
  }

  // ---- 饕餮模式操作 ----
  const TAOTIE_PHASES: { key: string; label: string; icon: string }[] = [
    { key: 'pair_analysis', label: '配对分析', icon: '🔍' },
    { key: 'parallel_testing', label: '并行测试', icon: '🧪' },
    { key: 'reverse_engineering', label: '反向工程', icon: '🔧' },
    { key: 'progressive_injection', label: '渐进注入', icon: '💉' },
    { key: 'pattern_distillation', label: '模式沉淀', icon: '💎' },
  ]

  const taotieStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      created: '已创建', pair_analyzing: '配对分析中', pair_analysis_done: '配对完成',
      parallel_testing: '并行测试中', parallel_testing_done: '测试完成',
      reverse_engineering: '反向工程中', reverse_engineering_done: '反推完成',
      injecting: '注入中', pending_approval: '待批准', injection_done: '注入完成',
      distilling: '沉淀中', completed: '已完成', failed: '失败', cancelled: '已取消',
    }
    return map[status] || status
  }

  const getPhaseIndex = (phase: string): number => {
    return TAOTIE_PHASES.findIndex(p => p.key === phase)
  }

  const handleTaotieDetect = async () => {
    setTaotieDetecting(true)
    try {
      const res = await api.taotieDetect(taotieThreshold)
      setTaotieGroups(res?.groups || res || [])
    } catch (e) { console.error('[skill-forge] taotie detect failed:', e) }
    finally { setTaotieDetecting(false) }
  }

  const handleTaotieAnalyze = async (target: string, source: string) => {
    setTaotieAnalyzing(true)
    setTaotieTarget(target)
    setTaotieSource(source)
    try {
      const res = await api.taotieAnalyze(target, source)
      setTaotiePairReport(res?.report || res || null)
      setTaotieSubView('pair')
    } catch (e) { console.error(e) }
    finally { setTaotieAnalyzing(false) }
  }

  const handleTaotieStart = async () => {
    if (!taotieTarget || !taotieSource) return
    setTaotieStarting(true)
    try {
      const res = await api.taotieStart(taotieTarget, taotieSource, false)
      const runId = res?.runId
      if (runId) {
        const detail = await api.taotieStatus(runId)
        setTaotieDetailRun(detail?.run || detail || null)
        setTaotieSubView('detail')
      }
    } catch (e) { console.error('[skill-forge] taotie start failed:', e) }
    finally { setTaotieStarting(false) }
  }

  const handleTaotieApprove = async (runId: string, stepIndex?: number) => {
    try {
      await api.taotieApprove(runId, stepIndex)
      await fetchTaotieDetail(runId)
    } catch (e) { console.error(e) }
  }

  const handleTaotieStop = async (runId: string) => {
    try {
      await api.taotieStop(runId)
      await fetchTaotieDetail(runId)
    } catch (e) { console.error(e) }
  }

  // ---- CoEvo 共进化模式操作 ----
  const COEVO_PHASES: { key: string; label: string; icon: string }[] = [
    { key: 'baseline', label: '基线测试', icon: '🧪' },
    { key: 'skill_evolution', label: '技能进化', icon: '🧬' },
    { key: 'test_evolution', label: '测试进化', icon: '⚔️' },
  ]

  const coevoStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      created: '已创建', initial_testing: '基线测试中',
      skill_evolving: '技能进化中', test_evolving: '测试进化中',
      pending_approval: '待批准', completed: '已完成',
      stopped: '已停止', failed: '失败',
    }
    return map[status] || status
  }

  const coevoScoreColorClass = (score: number): string => {
    if (score >= 0.8) return 'sf-darwin-score-high'
    if (score >= 0.6) return 'sf-darwin-score-mid'
    return 'sf-darwin-score-low'
  }

  const getCoevoPhaseIndex = (status: string): number => {
    const order = ['created', 'initial_testing', 'skill_evolving', 'test_evolving', 'pending_approval', 'completed', 'stopped', 'failed']
    const idx = order.indexOf(status)
    if (idx <= 1) return 0 // baseline
    if (status === 'skill_evolving' || (status === 'pending_approval')) return 1
    if (status === 'test_evolving') return 2
    if (status === 'completed' || status === 'stopped' || status === 'failed') return 2
    return 0
  }

  const handleCoevoStart = async () => {
    if (!coevoSelectedSkill) return
    setCoevoStarting(true)
    try {
      const res = await api.coevoStart(coevoSelectedSkill, {
        autoApprove: coevoAutoApprove,
        maxRounds: coevoMaxRounds,
        targetSkillScore: coevoTargetSkillScore,
        targetTestStrength: coevoTargetTestStrength,
      })
      const runId = res?.runId
      if (runId) {
        await fetchCoevoRuns()
        const detail = await api.coevoStatus(runId)
        setCoevoDetailRun(detail?.run || detail || null)
        setCoevoShowDetail(true)
      }
    } catch (e) { console.error('[skill-forge] coevo start failed:', e) }
    finally { setCoevoStarting(false) }
  }

  const handleCoevoApprove = async (runId: string) => {
    try {
      await api.coevoApprove(runId)
      await fetchCoevoDetail(runId)
      await fetchCoevoRuns()
    } catch (e) { console.error(e) }
  }

  const handleCoevoReject = async (runId: string, reason?: string) => {
    try {
      await api.coevoReject(runId, reason)
      await fetchCoevoDetail(runId)
      await fetchCoevoRuns()
    } catch (e) { console.error(e) }
  }

  const handleCoevoStop = async (runId: string) => {
    try {
      await api.coevoStop(runId)
      await fetchCoevoDetail(runId)
      await fetchCoevoRuns()
    } catch (e) { console.error(e) }
  }

  const openCoevoDetail = async (run: any) => {
    setCoevoDetailRun(run)
    setCoevoShowDetail(true)
    setCoevoLoadingDetail(true)
    try {
      const res = await api.coevoStatus(run.id)
      setCoevoDetailRun(res?.run || res || run)
    } catch (e) { console.error(e) }
    finally { setCoevoLoadingDetail(false) }
  }

  // ---- 编排模式操作 ----
  const handleOrchestrate = async () => {
    if (!orchQuery.trim()) return
    setOrchRunning(true)
    setOrchError('')
    setOrchResult(null)
    setOrchShowGuide(false)
    try {
      const res = await api.orchestrateTask(orchQuery.trim(), orchMode)
      setOrchResult(res)
      await fetchOrchStats()
    } catch (e: any) {
      setOrchError(e?.message || '编排失败')
      console.error('[skill-forge] orchestrate failed:', e)
    } finally {
      setOrchRunning(false)
    }
  }

  const toggleOrchNode = (nodeId: string) => {
    setOrchExpandedNode(prev => prev === nodeId ? null : nodeId)
  }

  const orchStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      pending: '待执行', running: '进行中', completed: '已完成', failed: '失败', skipped: '已跳过',
    }
    return map[status] || status
  }

  const orchConfidenceLabel = (conf: number): { text: string; color: string } => {
    if (conf >= 0.8) return { text: '高', color: 'var(--sf-success)' }
    if (conf >= 0.6) return { text: '中', color: 'var(--sf-warning)' }
    return { text: '低', color: 'var(--sf-error)' }
  }

  // ---- Dreaming 闲时锻造操作 ----
  const DREAMING_PHASES: { key: string; label: string; icon: string }[] = [
    { key: 'health_check', label: '健康体检', icon: '🏥' },
    { key: 'similarity_scan', label: '相似度扫描', icon: '🔍' },
    { key: 'suggestion', label: '生成建议', icon: '💡' },
    { key: 'optimization', label: '自动优化', icon: '🧬' },
    { key: 'fusion', label: '自动融合', icon: '🔗' },
    { key: 'report', label: '生成报告', icon: '📊' },
  ]

  const dreamingStatusLabel = (status: string): string => {
    const map: Record<string, string> = {
      idle: '空闲', scheduled: '已调度',
      health_check: '健康体检中', score_update: '更新评分中',
      similarity_scan: '相似度扫描中', optimizing: '优化中',
      fusing: '融合中', suggesting: '生成建议中',
      generating_report: '生成报告中',
      completed: '已完成', failed: '失败', stopped: '已停止',
    }
    return map[status] || status
  }

  const dreamingTriggerLabel = (type: string): string => {
    const map: Record<string, string> = {
      manual: '手动触发', scheduled: '定时触发', idle: '空闲触发',
    }
    return map[type] || type
  }

  const getDreamingPhaseIndex = (phase: string): number => {
    return DREAMING_PHASES.findIndex(p => p.key === phase)
  }

  const handleDreamingStart = async () => {
    setDreamingStarting(true)
    try {
      const res = await api.dreamingStart('manual')
      if (res?.run) {
        setDreamingCurrent(res.run)
      }
      await fetchDreamingStatus()
      await fetchDreamingHistory()
    } catch (e) { console.error('[skill-forge] dreaming start failed:', e) }
    finally { setDreamingStarting(false) }
  }

  const handleDreamingStop = async () => {
    setDreamingStopping(true)
    try {
      await api.dreamingStop('Manually stopped from UI')
      await fetchDreamingStatus()
      await fetchDreamingHistory()
    } catch (e) { console.error('[skill-forge] dreaming stop failed:', e) }
    finally { setDreamingStopping(false) }
  }

  const openDreamingDetail = (run: any) => {
    setDreamingSelectedHistory(run)
    setDreamingShowDetail(true)
  }

  const isDreamingRunning = (status: string): boolean => {
    return ['health_check', 'score_update', 'similarity_scan', 'optimizing', 'fusing', 'suggesting', 'generating_report'].includes(status)
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

  const forgeSubTabs: { key: 'forge' | 'darwin' | 'taotie' | 'coevo' | 'orchestrate' | 'dreaming'; label: string; icon: string }[] = [
    { key: 'forge', label: '锻造', icon: '🔨' },
    { key: 'darwin', label: '优化', icon: '🧬' },
    { key: 'taotie', label: '融合', icon: '🔗' },
    { key: 'coevo', label: '共进化', icon: '⚔️' },
    { key: 'orchestrate', label: '编排', icon: '🎯' },
    { key: 'dreaming', label: '闲时锻造', icon: '🌙' },
  ]

  // ---- 渲染 ----

  // 达尔文模式详情视图
  if (forgeSubTab === 'darwin' && darwinShowDetail && darwinDetailRun) {
    const run = darwinDetailRun
    const scores = run.currentScores || run.initialScores || {}
    const overall = run.currentOverallScore ?? run.initialOverallScore ?? 0
    const isPending = run.status === 'pending_approval'
    const isRunning = ['created', 'initial_evaluating', 'optimizing', 'running'].includes(run.status)
    const history = run.history || []

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => {
              if (tab.key === 'darwin') {
                setDarwinShowDetail(false); setDarwinDetailRun(null)
              } else {
                setForgeSubTab(tab.key); setDarwinShowDetail(false); setDarwinDetailRun(null)
              }
            },
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 返回
      React.createElement('div', { className: 'sf-detail-back', onClick: () => { setDarwinShowDetail(false); setDarwinDetailRun(null) } }, '← 返回列表'),

      // 标题
      React.createElement('div', { className: 'sf-skill-detail-header' },
        React.createElement('h3', { className: 'sf-skill-detail-title' }, run.skillName || '达尔文优化'),
        React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` }, darwinStatusLabel(run.status)),
      ),
      React.createElement('div', { className: 'sf-skill-detail-subtitle' },
        `轮次: ${run.currentIteration ?? 0}/${run.maxIterations ?? 10} · 初始分: ${(run.initialOverallScore ?? 0).toFixed(2)} → 当前: ${overall.toFixed(2)}`
      ),

      // 总体得分进度条
      React.createElement('div', { className: 'sf-quality-bar sf-quality-bar-lg' },
        React.createElement('div', { className: 'sf-quality-bar-fill', style: { width: `${Math.min(overall * 100, 100)}%` } }),
        React.createElement('span', { className: 'sf-quality-bar-text' }, `🧬 总体得分: ${overall.toFixed(2)}`),
      ),

      // 10 维度得分条形图
      React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, '📊 10 维度得分'),
        React.createElement('div', { className: 'sf-dim-chart' },
          DARWIN_DIMS.map(dim => {
            const score = scores[dim.key] ?? 0
            return React.createElement('div', { key: dim.key, className: 'sf-dim-bar-row' },
              React.createElement('div', { className: 'sf-dim-bar-label' }, dim.label),
              React.createElement('div', { className: 'sf-dim-bar-track' },
                React.createElement('div', {
                  className: `sf-dim-bar-fill ${scoreBarClass(score)}`,
                  style: { width: `${Math.min(score * 100, 100)}%` },
                }),
              ),
              React.createElement('div', { className: 'sf-dim-bar-score' }, score.toFixed(2)),
            )
          }),
        ),
      ),

      // 优化历史时间线
      React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `🔄 优化历史 (${history.length})`),
        history.length === 0
          ? React.createElement('div', { className: 'sf-empty-text' }, '暂无优化记录')
          : React.createElement('div', { className: 'sf-darwin-timeline' },
              history.map((h: any) =>
                React.createElement('div', { key: h.iteration, className: 'sf-darwin-timeline-item' },
                  React.createElement('div', { className: `sf-darwin-timeline-dot ${h.accepted ? 'sf-dot-accepted' : 'sf-dot-rolledback'}` }),
                  React.createElement('div', { className: 'sf-darwin-timeline-body' },
                    React.createElement('div', { className: 'sf-darwin-timeline-head' },
                      React.createElement('span', { className: 'sf-darwin-timeline-dim' },
                        `第${h.iteration}轮 · ${DARWIN_DIMS.find(d => d.key === h.targetDimension)?.label || h.targetDimension}`
                      ),
                      React.createElement('span', { className: `sf-darwin-timeline-delta ${(h.overallAfter - h.overallBefore) >= 0 ? 'sf-delta-up' : 'sf-delta-down'}` },
                        `${(h.overallAfter - h.overallBefore) >= 0 ? '+' : ''}${((h.overallAfter - h.overallBefore) * 100).toFixed(1)}%`
                      ),
                    ),
                    h.changeDescription && React.createElement('div', { className: 'sf-darwin-timeline-desc' }, h.changeDescription),
                    React.createElement('div', { className: 'sf-darwin-timeline-meta' },
                      React.createElement('span', null, h.accepted ? '✅ 已接受' : '❌ 已回滚'),
                      React.createElement('span', null, formatTime(h.timestamp)),
                    ),
                    !h.accepted && h.rollbackReason && React.createElement('div', { className: 'sf-darwin-timeline-desc', style: { color: 'var(--sf-error)', marginTop: '2px' } },
                      `原因: ${h.rollbackReason}`
                    ),
                  ),
                )
              )
            ),
      ),

      // 操作按钮
      React.createElement('div', { className: 'sf-detail-actions' },
        isPending && run.pendingApproval && React.createElement('button', {
          className: 'sf-btn sf-btn-primary',
          onClick: () => handleDarwinApprove(run.id, run.pendingApproval!.targetDimension),
        }, '✓ 批准本轮'),
        isPending && run.pendingApproval && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleDarwinReject(run.id, run.pendingApproval!.targetDimension),
        }, '✗ 拒绝回滚'),
        isRunning && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleDarwinStop(run.id),
        }, '⏹ 停止优化'),
      ),
    )
  }

  // 达尔文模式主视图
  if (forgeSubTab === 'darwin') {
    const activeSkillNames = activeSkills.map((s: any) => s.frontmatter?.name || s.id).filter(Boolean)
    const recentRuns = darwinRuns

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => setForgeSubTab(tab.key),
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 启动优化面板
      React.createElement('div', { className: 'sf-darwin-start-panel' },
        React.createElement('div', { className: 'sf-darwin-start-title' }, '🧬 启动达尔文优化'),

        React.createElement('div', { className: 'sf-darwin-start-row' },
          React.createElement('div', { className: 'sf-darwin-start-label' }, '选择技能'),
          React.createElement('select', {
            className: 'sf-darwin-select',
            value: darwinSelectedSkill,
            onChange: (e: any) => setDarwinSelectedSkill(e.target.value),
          },
            React.createElement('option', { value: '' }, '请选择要优化的技能...'),
            activeSkillNames.map((name: string) =>
              React.createElement('option', { key: name, value: name }, name)
            ),
          ),
        ),

        React.createElement('div', { className: 'sf-darwin-start-row' },
          React.createElement('div', { className: 'sf-darwin-start-label' }, '优化维度（不选则自动优化低分维度）'),
          React.createElement('div', { className: 'sf-darwin-dim-picker' },
            DARWIN_DIMS.map(dim =>
              React.createElement('button', {
                key: dim.key,
                className: `sf-darwin-dim-chip ${darwinTargetDims.includes(dim.key) ? 'sf-chip-active' : ''}`,
                onClick: () => toggleDarwinDim(dim.key),
              }, dim.label)
            ),
          ),
        ),

        React.createElement('div', { className: 'sf-darwin-switch-row' },
          React.createElement('div', { className: 'sf-darwin-start-label' }, '自动批准（无人在回路）'),
          React.createElement('button', {
            className: `sf-darwin-switch ${darwinAutoApprove ? 'sf-switch-on' : ''}`,
            onClick: () => setDarwinAutoApprove(v => !v),
            'aria-label': 'toggle auto approve',
          },
            React.createElement('span', { className: 'sf-darwin-switch-thumb' }),
          ),
        ),

        React.createElement('button', {
          className: 'sf-btn sf-btn-primary sf-btn-full',
          onClick: handleDarwinStart,
          disabled: !darwinSelectedSkill || darwinStarting,
        }, darwinStarting ? '启动中...' : '🚀 开始优化'),
      ),

      // 运行列表
      React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `📋 优化记录 (${recentRuns.length})`),
        recentRuns.length === 0
          ? React.createElement('div', { className: 'sf-empty-small' }, '暂无优化记录')
          : React.createElement('div', { className: 'sf-forge-list' },
              recentRuns.map((run: any) => {
                const overall = run.currentOverallScore ?? run.initialOverallScore ?? 0
                const scores = run.currentScores || run.initialScores || {}
                // 找出最低分维度
                let lowestDim = ''
                let lowestScore = 1
                for (const dim of DARWIN_DIMS) {
                  const s = scores[dim.key] ?? 1
                  if (s < lowestScore) { lowestScore = s; lowestDim = dim.label }
                }
                return React.createElement('div', {
                  key: run.id,
                  className: 'sf-darwin-skill-card',
                  onClick: () => openDarwinDetail(run),
                },
                  React.createElement('div', { className: 'sf-darwin-skill-header' },
                    React.createElement('span', { className: 'sf-darwin-skill-name' }, run.skillName || '未知技能'),
                    React.createElement('span', { className: `sf-darwin-overall-score ${scoreColorClass(overall)}` }, overall.toFixed(2)),
                  ),
                  lowestDim && React.createElement('div', { className: 'sf-darwin-weakest-dim' },
                    React.createElement('span', null, '最低分: '),
                    React.createElement('strong', null, `${lowestDim} ${lowestScore.toFixed(2)}`),
                  ),
                  React.createElement('div', { className: 'sf-darwin-status-row' },
                    React.createElement('span', null, `轮次 ${run.currentIteration ?? 0}/${run.maxIterations ?? 10}`),
                    React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` }, darwinStatusLabel(run.status)),
                  ),
                )
              })
            ),
      ),
    )
  }

  // 饕餮模式详情视图
  if (forgeSubTab === 'taotie' && taotieSubView === 'detail' && taotieDetailRun) {
    const run = taotieDetailRun
    const currentPhase = run.phase || 'pair_analysis'
    const phaseIdx = getPhaseIndex(currentPhase)
    const isPending = run.status === 'pending_approval'
    const isRunning = ['created', 'pair_analyzing', 'parallel_testing', 'reverse_engineering', 'injecting', 'distilling'].includes(run.status)
    const injectionSteps = run.injectionSteps || []
    const overallDelta = run.overallDelta

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => {
              if (tab.key === 'taotie') {
                setTaotieSubView('detect'); setTaotieDetailRun(null)
              } else {
                setForgeSubTab(tab.key); setTaotieSubView('detect'); setTaotieDetailRun(null)
              }
            },
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      React.createElement('div', { className: 'sf-detail-back', onClick: () => { setTaotieSubView('detect'); setTaotieDetailRun(null) } }, '← 返回检测'),

      // 标题
      React.createElement('div', { className: 'sf-skill-detail-header' },
        React.createElement('h3', { className: 'sf-skill-detail-title' }, `${run.targetSkillName} ← ${run.sourceSkillName}`),
        React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` }, taotieStatusLabel(run.status)),
      ),
      React.createElement('div', { className: 'sf-skill-detail-subtitle' },
        `饕餮融合 · ${run.autoApprove ? '自动模式' : '人在回路'}`
      ),

      // 五阶段进度指示器
      React.createElement('div', { className: 'sf-taotie-phases' },
        TAOTIE_PHASES.map((phase, idx) => {
          const isDone = phaseIdx > idx
          const isActive = phaseIdx === idx
          const cls = isDone ? 'sf-phase-done' : isActive ? 'sf-phase-active' : ''
          return React.createElement('div', { key: phase.key, className: `sf-taotie-phase ${cls}` },
            React.createElement('div', { className: 'sf-taotie-phase-dot' }, isDone ? '✓' : isActive ? phase.icon : (idx + 1)),
            React.createElement('div', { className: 'sf-taotie-phase-label' }, phase.label),
          )
        }),
      ),

      // 阶段内容：配对分析
      (currentPhase === 'pair_analysis' || phaseIdx > 0) && run.pairAnalysis && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, '🔍 配对分析'),
        React.createElement('div', { className: 'sf-taotie-compare' },
          React.createElement('div', { className: 'sf-taotie-compare-card sf-target' },
            React.createElement('div', { className: 'sf-taotie-compare-label' }, 'Target'),
            React.createElement('div', { className: 'sf-taotie-compare-name' }, run.pairAnalysis.targetSkillName),
            React.createElement('div', { className: 'sf-taotie-compare-score' }, (run.pairAnalysis.targetStrengths?.length || 0) + '项强项'),
            React.createElement('div', { className: 'sf-taotie-compare-strengths' },
              run.pairAnalysis.targetStrengths?.slice(0, 3)?.join('、') || '—'
            ),
          ),
          React.createElement('div', { className: 'sf-taotie-compare-vs' }, 'VS'),
          React.createElement('div', { className: 'sf-taotie-compare-card sf-source' },
            React.createElement('div', { className: 'sf-taotie-compare-label' }, 'Source'),
            React.createElement('div', { className: 'sf-taotie-compare-name' }, run.pairAnalysis.sourceSkillName),
            React.createElement('div', { className: 'sf-taotie-compare-score' }, (run.pairAnalysis.sourceStrengths?.length || 0) + '项强项'),
            React.createElement('div', { className: 'sf-taotie-compare-strengths' },
              run.pairAnalysis.sourceStrengths?.slice(0, 3)?.join('、') || '—'
            ),
          ),
        ),
      ),

      // 阶段内容：融合建议
      run.pairAnalysis?.fusionSuggestions && run.pairAnalysis.fusionSuggestions.length > 0 && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, '💡 融合建议'),
        React.createElement('div', { className: 'sf-taotie-suggestions' },
          run.pairAnalysis.fusionSuggestions.map((s: any) =>
            React.createElement('div', { key: s.id, className: 'sf-taotie-suggestion' },
              React.createElement('div', { className: 'sf-taotie-suggestion-title' },
                React.createElement('span', null, s.title),
                React.createElement('span', { className: `sf-taotie-priority-tag sf-priority-${s.priority}` }, s.priority),
              ),
              React.createElement('div', { className: 'sf-taotie-suggestion-desc' }, s.description),
            )
          )
        ),
      ),

      // 阶段内容：渐进注入步骤
      (phaseIdx >= 3 || injectionSteps.length > 0) && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `💉 注入步骤 (${injectionSteps.length})`),
        injectionSteps.length === 0
          ? React.createElement('div', { className: 'sf-empty-text' }, '尚未开始注入')
          : React.createElement('div', { className: 'sf-injection-steps' },
              injectionSteps.map((step: any) =>
                React.createElement('div', { key: step.stepIndex, className: `sf-injection-step ${step.retained ? 'sf-step-retained' : 'sf-step-rolledback'}` },
                  React.createElement('div', { className: 'sf-injection-step-num' }, step.retained ? '✓' : '✗'),
                  React.createElement('div', { className: 'sf-injection-step-body' },
                    React.createElement('div', { className: 'sf-injection-step-name' }, step.patternName || `步骤 ${step.stepIndex + 1}`),
                    step.changeDescription && React.createElement('div', { className: 'sf-injection-step-desc' }, step.changeDescription),
                  ),
                  React.createElement('div', { className: `sf-injection-step-delta ${step.retained ? 'sf-delta-up' : 'sf-delta-down'}` },
                    step.retained ? `+${((step.afterScore - step.beforeScore) * 100).toFixed(1)}%` : '回滚'
                  ),
                )
              )
            ),
      ),

      // 总体结果
      overallDelta && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, '📈 总体结果'),
        React.createElement('div', { className: 'sf-quality-bar sf-quality-bar-lg' },
          React.createElement('div', {
            className: 'sf-quality-bar-fill',
            style: { width: `${Math.min(overallDelta.after * 100, 100)}%`, background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)' },
          }),
          React.createElement('span', { className: 'sf-quality-bar-text' },
            `${overallDelta.before.toFixed(2)} → ${overallDelta.after.toFixed(2)} (${overallDelta.delta >= 0 ? '+' : ''}${(overallDelta.delta * 100).toFixed(1)}%)`
          ),
        ),
      ),

      // 沉淀的模式
      run.distilledPatterns?.length > 0 && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `💎 沉淀模式 (${run.distilledPatterns.length})`),
        React.createElement('div', { className: 'sf-pattern-list' },
          run.distilledPatterns.map((p: any) =>
            React.createElement('div', { key: p.id, className: 'sf-pattern-card' },
              React.createElement('div', { className: 'sf-pattern-head' },
                React.createElement('span', { className: 'sf-pattern-name' }, p.name),
              ),
              p.description && React.createElement('div', { className: 'sf-pattern-desc' }, p.description),
            )
          )
        ),
      ),

      // 操作按钮
      React.createElement('div', { className: 'sf-detail-actions' },
        isPending && React.createElement('button', {
          className: 'sf-btn sf-btn-primary',
          onClick: () => handleTaotieApprove(run.id, run.pendingStepIndex),
        }, '✓ 批准继续'),
        isRunning && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleTaotieStop(run.id),
        }, '⏹ 停止融合'),
      ),
    )
  }

  // 饕餮模式主视图
  if (forgeSubTab === 'taotie') {
    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => { setForgeSubTab(tab.key); setTaotieSubView('detect'); setTaotiePairReport(null); setTaotieDetailRun(null) },
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 饕餮子视图切换
      React.createElement('div', { className: 'sf-sub-tabs' },
        [
          { key: 'detect', label: '检测', icon: '🔍' },
          { key: 'pair', label: '配对', icon: '🔗' },
          { key: 'patterns', label: '模式库', icon: '💎' },
        ].map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${taotieSubView === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => setTaotieSubView(tab.key as any),
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 检测视图
      taotieSubView === 'detect' && React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'sf-taotie-detect-panel' },
          React.createElement('div', { className: 'sf-darwin-start-title' }, '🔍 相似技能检测'),
          React.createElement('div', { className: 'sf-taotie-slider-row' },
            React.createElement('div', { className: 'sf-taotie-slider-label' },
              React.createElement('span', null, '相似度阈值'),
              React.createElement('span', { className: 'sf-taotie-slider-val' }, taotieThreshold.toFixed(2)),
            ),
            React.createElement('input', {
              type: 'range',
              className: 'sf-taotie-slider',
              min: 0.2,
              max: 0.9,
              step: 0.05,
              value: taotieThreshold,
              onChange: (e: any) => setTaotieThreshold(parseFloat(e.target.value)),
            }),
          ),
          React.createElement('button', {
            className: 'sf-btn sf-btn-primary sf-btn-full',
            onClick: handleTaotieDetect,
            disabled: taotieDetecting,
          }, taotieDetecting ? '检测中...' : '🔬 开始检测'),
        ),

        // 相似技能组列表
        React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' }, `相似技能组 (${taotieGroups.length})`),
          taotieGroups.length === 0
            ? React.createElement('div', { className: 'sf-empty-small' }, taotieDetecting ? '检测中...' : '点击检测按钮查找相似技能')
            : React.createElement('div', { className: 'sf-forge-list' },
                taotieGroups.map((group: any, i: number) =>
                  React.createElement('div', {
                    key: i,
                    className: 'sf-taotie-group-card',
                    onClick: () => handleTaotieAnalyze(group.recommendedTarget, group.recommendedSource),
                  },
                    React.createElement('div', { className: 'sf-taotie-group-head' },
                      React.createElement('span', { className: 'sf-darwin-skill-name' }, `组 #${i + 1}`),
                      React.createElement('span', { className: 'sf-taotie-group-sim' }, `${(group.maxSimilarity * 100).toFixed(0)}%`),
                    ),
                    React.createElement('div', { className: 'sf-taotie-group-skills' },
                      (group.skills || []).map((s: string) =>
                        React.createElement('span', { key: s, className: 'sf-taotie-group-skill' }, s)
                      ),
                    ),
                    React.createElement('div', { className: 'sf-taotie-group-recommend' },
                      React.createElement('span', null, `🎯 目标: ${group.recommendedTarget}`),
                      React.createElement('span', null, `🔗 源: ${group.recommendedSource}`),
                    ),
                  )
                )
              ),
        ),
      ),

      // 配对视图
      taotieSubView === 'pair' && (taotieAnalyzing || taotiePairReport) && React.createElement(React.Fragment, null,
        taotieAnalyzing
          ? React.createElement('div', { className: 'sf-empty-small' }, '分析中...')
          : taotiePairReport && React.createElement(React.Fragment, null,
            // 技能对比卡片
            React.createElement('div', { className: 'sf-taotie-compare' },
              React.createElement('div', { className: 'sf-taotie-compare-card sf-target' },
                React.createElement('div', { className: 'sf-taotie-compare-label' }, 'Target 目标'),
                React.createElement('div', { className: 'sf-taotie-compare-name' }, taotiePairReport.targetSkillName),
                React.createElement('div', { className: 'sf-taotie-compare-strengths' },
                  React.createElement('div', null, '强项维度:'),
                  (taotiePairReport.targetStrengths || []).slice(0, 3).map((s: string) =>
                    React.createElement('div', { key: s }, `· ${s}`)
                  ),
                ),
              ),
              React.createElement('div', { className: 'sf-taotie-compare-vs' }, 'VS'),
              React.createElement('div', { className: 'sf-taotie-compare-card sf-source' },
                React.createElement('div', { className: 'sf-taotie-compare-label' }, 'Source 源'),
                React.createElement('div', { className: 'sf-taotie-compare-name' }, taotiePairReport.sourceSkillName),
                React.createElement('div', { className: 'sf-taotie-compare-strengths' },
                  React.createElement('div', null, '强项维度:'),
                  (taotiePairReport.sourceStrengths || []).slice(0, 3).map((s: string) =>
                    React.createElement('div', { key: s }, `· ${s}`)
                  ),
                ),
              ),
            ),

            // 相似度
            React.createElement('div', { className: 'sf-quality-bar' },
              React.createElement('div', {
                className: 'sf-quality-bar-fill',
                style: { width: `${(taotiePairReport.overallSimilarity || 0) * 100}%`, background: 'linear-gradient(90deg, #8B5CF6, #3B82F6)' },
              }),
              React.createElement('span', { className: 'sf-quality-bar-text' },
                `相似度 ${((taotiePairReport.overallSimilarity || 0) * 100).toFixed(1)}%`
              ),
            ),

            // 融合建议
            React.createElement('div', { className: 'sf-detail-section' },
              React.createElement('div', { className: 'sf-detail-section-title' }, `💡 融合建议 (${(taotiePairReport.fusionSuggestions || []).length})`),
              (taotiePairReport.fusionSuggestions || []).length === 0
                ? React.createElement('div', { className: 'sf-empty-text' }, '暂无融合建议')
                : React.createElement('div', { className: 'sf-taotie-suggestions' },
                    taotiePairReport.fusionSuggestions.map((s: any) =>
                      React.createElement('div', { key: s.id, className: 'sf-taotie-suggestion' },
                        React.createElement('div', { className: 'sf-taotie-suggestion-title' },
                          React.createElement('span', null, s.title),
                          React.createElement('span', { className: `sf-taotie-priority-tag sf-priority-${s.priority}` }, s.priority),
                        ),
                        React.createElement('div', { className: 'sf-taotie-suggestion-desc' }, s.description),
                      )
                    )
                  ),
            ),

            // 启动融合按钮
            React.createElement('button', {
              className: 'sf-btn sf-btn-primary sf-btn-full',
              onClick: handleTaotieStart,
              disabled: taotieStarting,
            }, taotieStarting ? '启动中...' : '🔗 开始融合'),
          ),
      ),

      // 模式库视图
      taotieSubView === 'patterns' && React.createElement('div', { className: 'sf-pattern-list' },
        taotieLoadingPatterns
          ? React.createElement('div', { className: 'sf-empty-small' }, '加载中...')
          : taotiePatterns.length === 0
            ? React.createElement('div', { className: 'sf-empty-small' }, '暂无沉淀模式，完成融合后自动沉淀')
            : taotiePatterns.map((p: any) =>
                React.createElement('div', { key: p.id, className: 'sf-pattern-card' },
                  React.createElement('div', { className: 'sf-pattern-head' },
                    React.createElement('span', { className: 'sf-pattern-name' }, p.name),
                    React.createElement('div', { className: 'sf-pattern-meta' },
                      React.createElement('span', { className: 'sf-pattern-badge' }, `${p.appliedCount || 0} 次应用`),
                    ),
                  ),
                  p.description && React.createElement('div', { className: 'sf-pattern-desc' }, p.description),
                  React.createElement('div', { className: 'sf-pattern-footer' },
                    React.createElement('span', null, `来源: ${p.sourceSkill || '—'}`),
                    p.avgImprovement != null && React.createElement('span', { className: 'sf-pattern-improvement' },
                      `平均提升 +${(p.avgImprovement * 100).toFixed(1)}%`
                    ),
                  ),
                )
              )
      ),
    )
  }

  // CoEvo 共进化详情视图
  if (forgeSubTab === 'coevo' && coevoShowDetail && coevoDetailRun) {
    const run = coevoDetailRun
    const phaseIdx = getCoevoPhaseIndex(run.status)
    const isPending = run.status === 'pending_approval'
    const isRunning = ['created', 'initial_testing', 'skill_evolving', 'test_evolving'].includes(run.status)
    const history = run.history || []
    const testSuite = run.testSuite || []
    const skillScore = run.currentSkillScore ?? 0
    const testStrength = run.currentTestStrength ?? 0

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => {
              if (tab.key === 'coevo') {
                setCoevoShowDetail(false); setCoevoDetailRun(null)
              } else {
                setForgeSubTab(tab.key); setCoevoShowDetail(false); setCoevoDetailRun(null)
              }
            },
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 返回
      React.createElement('div', { className: 'sf-detail-back', onClick: () => { setCoevoShowDetail(false); setCoevoDetailRun(null) } }, '← 返回列表'),

      // 标题
      React.createElement('div', { className: 'sf-skill-detail-header' },
        React.createElement('h3', { className: 'sf-skill-detail-title' }, run.skillName || '共进化验证'),
        React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` }, coevoStatusLabel(run.status)),
      ),
      React.createElement('div', { className: 'sf-skill-detail-subtitle' },
        `轮次: ${run.currentRound ?? 0}/${run.maxRounds ?? 8} · ${run.autoApprove ? '自动模式' : '人在回路'}`
      ),

      // 双指标得分卡片
      React.createElement('div', { className: 'sf-coevo-score-cards' },
        React.createElement('div', { className: 'sf-coevo-score-card sf-coevo-skill-card' },
          React.createElement('div', { className: 'sf-coevo-score-label' }, '技能得分'),
          React.createElement('div', { className: `sf-coevo-score-value ${coevoScoreColorClass(skillScore)}` }, skillScore.toFixed(2)),
          React.createElement('div', { className: 'sf-coevo-score-target' }, `目标: ${run.targetSkillScore?.toFixed(2) || '0.85'}`),
        ),
        React.createElement('div', { className: 'sf-coevo-score-card sf-coevo-test-card' },
          React.createElement('div', { className: 'sf-coevo-score-label' }, '测试强度'),
          React.createElement('div', { className: `sf-coevo-score-value ${coevoScoreColorClass(testStrength)}` }, testStrength.toFixed(2)),
          React.createElement('div', { className: 'sf-coevo-score-target' }, `目标: ${run.targetTestStrength?.toFixed(2) || '0.70'}`),
        ),
      ),

      // 三阶段进度指示器
      React.createElement('div', { className: 'sf-coevo-phases' },
        COEVO_PHASES.map((phase, idx) => {
          const isDone = phaseIdx > idx
          const isActive = phaseIdx === idx
          const cls = isDone ? 'sf-phase-done' : isActive ? 'sf-phase-active' : ''
          return React.createElement('div', { key: phase.key, className: `sf-taotie-phase ${cls}` },
            React.createElement('div', { className: 'sf-taotie-phase-dot' }, isDone ? '✓' : isActive ? phase.icon : (idx + 1)),
            React.createElement('div', { className: 'sf-taotie-phase-label' }, phase.label),
          )
        }),
      ),

      // 待批准信息
      isPending && run.pendingApproval && React.createElement('div', { className: 'sf-coevo-pending-banner' },
        React.createElement('div', { className: 'sf-coevo-pending-title' },
          `⏳ 待批准：第 ${run.pendingApproval.round} 轮 · ${run.pendingApproval.phase === 'skill_evolution' ? '技能进化' : '测试进化'}`
        ),
        React.createElement('div', { className: 'sf-coevo-pending-desc' }, run.pendingApproval.changeDescription || ''),
        React.createElement('div', { className: 'sf-coevo-pending-deltas' },
          React.createElement('span', { className: run.pendingApproval.skillScoreAfter >= run.pendingApproval.skillScoreBefore ? 'sf-delta-up' : 'sf-delta-down' },
            `技能: ${run.pendingApproval.skillScoreBefore.toFixed(2)} → ${run.pendingApproval.skillScoreAfter.toFixed(2)} (${run.pendingApproval.skillScoreAfter >= run.pendingApproval.skillScoreBefore ? '+' : ''}${((run.pendingApproval.skillScoreAfter - run.pendingApproval.skillScoreBefore) * 100).toFixed(1)}%)`
          ),
          React.createElement('span', { className: run.pendingApproval.testStrengthAfter >= run.pendingApproval.testStrengthBefore ? 'sf-delta-up' : 'sf-delta-down' },
            `测试: ${run.pendingApproval.testStrengthBefore.toFixed(2)} → ${run.pendingApproval.testStrengthAfter.toFixed(2)} (${run.pendingApproval.testStrengthAfter >= run.pendingApproval.testStrengthBefore ? '+' : ''}${((run.pendingApproval.testStrengthAfter - run.pendingApproval.testStrengthBefore) * 100).toFixed(1)}%)`
          ),
        ),
      ),

      // 进化历史时间线
      React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `🔄 进化历史 (${history.length})`),
        history.length === 0
          ? React.createElement('div', { className: 'sf-empty-text' }, '暂无进化记录')
          : React.createElement('div', { className: 'sf-darwin-timeline' },
              history.map((h: any) =>
                React.createElement('div', { key: h.round + '_' + h.phase, className: 'sf-darwin-timeline-item' },
                  React.createElement('div', { className: `sf-darwin-timeline-dot ${h.accepted ? 'sf-dot-accepted' : 'sf-dot-rolledback'}` }),
                  React.createElement('div', { className: 'sf-darwin-timeline-body' },
                    React.createElement('div', { className: 'sf-darwin-timeline-head' },
                      React.createElement('span', { className: 'sf-darwin-timeline-dim' },
                        `第${h.round}轮 · ${h.phase === 'skill_evolution' ? '🧬 技能进化' : h.phase === 'test_evolution' ? '⚔️ 测试进化' : '🧪 基线'}`
                      ),
                      React.createElement('span', { className: `sf-darwin-timeline-delta ${(h.skillScoreAfter - h.skillScoreBefore) >= 0 ? 'sf-delta-up' : 'sf-delta-down'}` },
                        `${(h.skillScoreAfter - h.skillScoreBefore) >= 0 ? '+' : ''}${((h.skillScoreAfter - h.skillScoreBefore) * 100).toFixed(1)}%`
                      ),
                    ),
                    h.changeDescription && React.createElement('div', { className: 'sf-darwin-timeline-desc' }, h.changeDescription),
                    React.createElement('div', { className: 'sf-coevo-round-meta' },
                      React.createElement('span', null, h.accepted ? '✅ 已接受' : '❌ 已拒绝'),
                      h.newTestCases > 0 && React.createElement('span', null, `新增 ${h.newTestCases} 测试`),
                      h.prunedTestCases > 0 && React.createElement('span', null, `淘汰 ${h.prunedTestCases} 测试`),
                      h.newDefectsFound > 0 && React.createElement('span', null, `发现 ${h.newDefectsFound} 缺陷`),
                      h.defectsFixed > 0 && React.createElement('span', null, `修复 ${h.defectsFixed} 缺陷`),
                      React.createElement('span', null, formatTime(h.timestamp)),
                    ),
                  ),
                )
              )
            ),
      ),

      // 测试用例库
      testSuite.length > 0 && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `🧪 对抗性测试用例 (${testSuite.length})`),
        React.createElement('div', { className: 'sf-coevo-test-list' },
          testSuite.slice(0, 10).map((tc: any) =>
            React.createElement('div', { key: tc.id, className: 'sf-coevo-test-item' },
              React.createElement('div', { className: 'sf-coevo-test-head' },
                React.createElement('span', { className: 'sf-coevo-test-name' }, tc.name),
                React.createElement('span', { className: `sf-coevo-test-type sf-test-type-${tc.type}` }, tc.type?.replace('_', ' ') || tc.type),
              ),
              React.createElement('div', { className: 'sf-coevo-test-desc' }, tc.input?.substring?.(0, 100) || '—'),
              React.createElement('div', { className: 'sf-coevo-test-meta' },
                React.createElement('span', null, `发现缺陷: ${tc.defectDiscoveredCount || 0}`),
                React.createElement('span', null, `通过率: ${tc.runCount > 0 ? ((tc.passCount / tc.runCount) * 100).toFixed(0) : 0}%`),
                React.createElement('span', null, `第${tc.generation || 1}代`),
              ),
            )
          ),
          testSuite.length > 10 && React.createElement('div', { className: 'sf-coevo-test-more' }, `还有 ${testSuite.length - 10} 个测试用例...`),
        ),
      ),

      // 失败原因
      run.status === 'failed' && run.failureReason && React.createElement('div', { className: 'sf-run-failure-detail' },
        React.createElement('div', { className: 'sf-failure-row' },
          React.createElement('span', { className: 'sf-failure-label' }, '失败原因'),
          React.createElement('span', null, run.failureReason),
        ),
      ),

      // 操作按钮
      React.createElement('div', { className: 'sf-detail-actions' },
        isPending && React.createElement('button', {
          className: 'sf-btn sf-btn-primary',
          onClick: () => handleCoevoApprove(run.id),
        }, '✓ 批准本轮'),
        isPending && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleCoevoReject(run.id),
        }, '✗ 拒绝'),
        isRunning && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleCoevoStop(run.id),
        }, '⏹ 停止共进化'),
      ),
    )
  }

  // CoEvo 共进化主视图
  if (forgeSubTab === 'coevo') {
    const activeSkillNames = activeSkills.map((s: any) => s.frontmatter?.name || s.id).filter(Boolean)
    const recentRuns = coevoRuns

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => setForgeSubTab(tab.key),
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // CoEvo 子视图切换
      React.createElement('div', { className: 'sf-sub-tabs' },
        [
          { key: 'start', label: '启动', icon: '🚀' },
          { key: 'runs', label: '记录', icon: '📋' },
        ].map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${coevoSubView === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => setCoevoSubView(tab.key as any),
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 启动视图
      coevoSubView === 'start' && React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'sf-darwin-start-panel' },
          React.createElement('div', { className: 'sf-darwin-start-title' }, '⚔️ 启动共进化验证'),

          React.createElement('div', { className: 'sf-darwin-start-row' },
            React.createElement('div', { className: 'sf-darwin-start-label' }, '选择技能'),
            React.createElement('select', {
              className: 'sf-darwin-select',
              value: coevoSelectedSkill,
              onChange: (e: any) => setCoevoSelectedSkill(e.target.value),
            },
              React.createElement('option', { value: '' }, '请选择要验证的技能...'),
              activeSkillNames.map((name: string) =>
                React.createElement('option', { key: name, value: name }, name)
              ),
            ),
          ),

          React.createElement('div', { className: 'sf-darwin-start-row' },
            React.createElement('div', { className: 'sf-darwin-start-label' }, `最大轮数: ${coevoMaxRounds}`),
            React.createElement('input', {
              type: 'range',
              className: 'sf-taotie-slider',
              min: 2,
              max: 20,
              step: 1,
              value: coevoMaxRounds,
              onChange: (e: any) => setCoevoMaxRounds(parseInt(e.target.value)),
            }),
          ),

          React.createElement('div', { className: 'sf-darwin-start-row' },
            React.createElement('div', { className: 'sf-darwin-start-label' }, `技能目标分: ${coevoTargetSkillScore.toFixed(2)}`),
            React.createElement('input', {
              type: 'range',
              className: 'sf-taotie-slider',
              min: 0.5,
              max: 0.99,
              step: 0.05,
              value: coevoTargetSkillScore,
              onChange: (e: any) => setCoevoTargetSkillScore(parseFloat(e.target.value)),
            }),
          ),

          React.createElement('div', { className: 'sf-darwin-start-row' },
            React.createElement('div', { className: 'sf-darwin-start-label' }, `测试目标强度: ${coevoTargetTestStrength.toFixed(2)}`),
            React.createElement('input', {
              type: 'range',
              className: 'sf-taotie-slider',
              min: 0.4,
              max: 0.95,
              step: 0.05,
              value: coevoTargetTestStrength,
              onChange: (e: any) => setCoevoTargetTestStrength(parseFloat(e.target.value)),
            }),
          ),

          React.createElement('div', { className: 'sf-darwin-switch-row' },
            React.createElement('div', { className: 'sf-darwin-start-label' }, '自动批准（无人在回路）'),
            React.createElement('button', {
              className: `sf-darwin-switch ${coevoAutoApprove ? 'sf-switch-on' : ''}`,
              onClick: () => setCoevoAutoApprove(v => !v),
              'aria-label': 'toggle auto approve',
            },
              React.createElement('span', { className: 'sf-darwin-switch-thumb' }),
            ),
          ),

          React.createElement('button', {
            className: 'sf-btn sf-btn-primary sf-btn-full',
            onClick: handleCoevoStart,
            disabled: !coevoSelectedSkill || coevoStarting,
          }, coevoStarting ? '启动中...' : '🚀 开始共进化'),
        ),

        // 共进化简介
        React.createElement('div', { className: 'sf-coevo-intro' },
          React.createElement('div', { className: 'sf-coevo-intro-title' }, '💡 什么是共进化验证？'),
          React.createElement('div', { className: 'sf-coevo-intro-text' },
            '技能与对抗性测试用例双向进化，形成「军备竞赛」：测试用例不断变刁钻发现缺陷，技能不断修复缺陷变得更健壮。双方互相驱动，最终同步提升。'
          ),
          React.createElement('div', { className: 'sf-coevo-intro-phases' },
            React.createElement('div', { className: 'sf-coevo-intro-phase' },
              React.createElement('div', { className: 'sf-coevo-intro-icon' }, '🧬'),
              React.createElement('div', null, '技能进化'),
            ),
            React.createElement('div', { className: 'sf-coevo-intro-arrow' }, '⇄'),
            React.createElement('div', { className: 'sf-coevo-intro-phase' },
              React.createElement('div', { className: 'sf-coevo-intro-icon' }, '⚔️'),
              React.createElement('div', null, '测试进化'),
            ),
          ),
        ),
      ),

      // 记录视图
      coevoSubView === 'runs' && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `📋 共进化记录 (${recentRuns.length})`),
        recentRuns.length === 0
          ? React.createElement('div', { className: 'sf-empty-small' }, '暂无共进化记录')
          : React.createElement('div', { className: 'sf-forge-list' },
              recentRuns.map((run: any) => {
                const skillScore = run.currentSkillScore ?? 0
                const testStrength = run.currentTestStrength ?? 0
                return React.createElement('div', {
                  key: run.id,
                  className: 'sf-coevo-run-card',
                  onClick: () => openCoevoDetail(run),
                },
                  React.createElement('div', { className: 'sf-darwin-skill-header' },
                    React.createElement('span', { className: 'sf-darwin-skill-name' }, run.skillName || '未知技能'),
                    React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` }, coevoStatusLabel(run.status)),
                  ),
                  React.createElement('div', { className: 'sf-coevo-run-scores' },
                    React.createElement('div', { className: 'sf-coevo-run-score' },
                      React.createElement('span', { className: 'sf-coevo-run-score-label' }, '技能'),
                      React.createElement('span', { className: `sf-darwin-overall-score ${coevoScoreColorClass(skillScore)}` }, skillScore.toFixed(2)),
                    ),
                    React.createElement('div', { className: 'sf-coevo-run-score' },
                      React.createElement('span', { className: 'sf-coevo-run-score-label' }, '测试'),
                      React.createElement('span', { className: `sf-darwin-overall-score ${coevoScoreColorClass(testStrength)}` }, testStrength.toFixed(2)),
                    ),
                  ),
                  React.createElement('div', { className: 'sf-darwin-status-row' },
                    React.createElement('span', null, `轮次 ${run.currentRound ?? 0}/${run.maxRounds ?? 8}`),
                    React.createElement('span', null, `测试用例 ${run.testSuite?.length || 0}`),
                  ),
                )
              })
            ),
      ),
    )
  }

  // 编排模式主视图
  if (forgeSubTab === 'orchestrate') {
    const workflow = orchResult?.workflow
    const nodes = workflow?.nodes || []
    const confidence = workflow?.confidence ?? 0
    const confInfo = orchConfidenceLabel(confidence)

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => setForgeSubTab(tab.key),
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 任务输入面板
      React.createElement('div', { className: 'sf-orch-input-panel' },
        React.createElement('div', { className: 'sf-darwin-start-title' }, '🎯 技能组合编排'),
        React.createElement('div', { className: 'sf-orch-desc' }, '输入一个复杂任务，自动分解为子工作流并匹配最优技能组合。'),

        React.createElement('div', { className: 'sf-orch-textarea-row' },
          React.createElement('textarea', {
            className: 'sf-orch-textarea',
            placeholder: '描述你的任务，例如：为新功能编写单元测试并生成API文档...',
            value: orchQuery,
            onChange: (e: any) => setOrchQuery(e.target.value),
            rows: 4,
          }),
        ),

        // 模式选择
        React.createElement('div', { className: 'sf-orch-mode-row' },
          React.createElement('div', { className: 'sf-darwin-start-label' }, '分解模式'),
          React.createElement('div', { className: 'sf-orch-mode-picker' },
            [
              { key: 'auto', label: '自动', desc: '快速优先，复杂时升级LLM' },
              { key: 'fast', label: '快速', desc: '启发式规则，即时响应' },
              { key: 'llm', label: '深度', desc: 'LLM分解，更精准' },
            ].map(m =>
              React.createElement('button', {
                key: m.key,
                className: `sf-orch-mode-btn ${orchMode === m.key ? 'sf-orch-mode-active' : ''}`,
                onClick: () => setOrchMode(m.key as 'auto' | 'fast' | 'llm'),
              },
                React.createElement('div', { className: 'sf-orch-mode-label' }, m.label),
                React.createElement('div', { className: 'sf-orch-mode-desc' }, m.desc),
              )
            )
          ),
        ),

        // 错误提示
        orchError && React.createElement('div', { className: 'sf-orch-error' }, `⚠️ ${orchError}`),

        React.createElement('button', {
          className: 'sf-btn sf-btn-primary sf-btn-full',
          onClick: handleOrchestrate,
          disabled: !orchQuery.trim() || orchRunning,
        }, orchRunning ? '编排中...' : '🚀 开始编排'),
      ),

      // 编排统计
      orchStats && React.createElement('div', { className: 'sf-orch-stats-row' },
        React.createElement('div', { className: 'sf-orch-stat-item' },
          React.createElement('div', { className: 'sf-orch-stat-num' }, String(orchStats.totalOrchestrations ?? 0)),
          React.createElement('div', { className: 'sf-orch-stat-label' }, '总编排次数'),
        ),
        React.createElement('div', { className: 'sf-orch-stat-item' },
          React.createElement('div', { className: 'sf-orch-stat-num' }, String(orchStats.multiSkillWorkflows ?? 0)),
          React.createElement('div', { className: 'sf-orch-stat-label' }, '多技能工作流'),
        ),
        React.createElement('div', { className: 'sf-orch-stat-item' },
          React.createElement('div', { className: 'sf-orch-stat-num' },
            orchStats.avgSkillsPerWorkflow ? orchStats.avgSkillsPerWorkflow.toFixed(1) : '0'),
          React.createElement('div', { className: 'sf-orch-stat-label' }, '平均技能数'),
        ),
      ),

      // 编排结果
      workflow && React.createElement(React.Fragment, null,
        // 结果概览卡片
        React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' }, '📋 编排结果概览'),
          React.createElement('div', { className: 'sf-orch-summary-card' },
            React.createElement('div', { className: 'sf-orch-summary-row' },
              React.createElement('span', { className: 'sf-orch-summary-label' }, '子任务数'),
              React.createElement('span', { className: 'sf-orch-summary-value' }, `${workflow.totalNodes} 步`),
            ),
            React.createElement('div', { className: 'sf-orch-summary-row' },
              React.createElement('span', { className: 'sf-orch-summary-label' }, '已匹配技能'),
              React.createElement('span', { className: 'sf-orch-summary-value' }, `${workflow.matchedNodes}/${workflow.totalNodes}`),
            ),
            React.createElement('div', { className: 'sf-orch-summary-row' },
              React.createElement('span', { className: 'sf-orch-summary-label' }, '预估 Token'),
              React.createElement('span', { className: 'sf-orch-summary-value' }, String(orchResult.estimatedTokens ?? 0)),
            ),
            React.createElement('div', { className: 'sf-orch-summary-row' },
              React.createElement('span', { className: 'sf-orch-summary-label' }, '整体置信度'),
              React.createElement('span', { className: 'sf-orch-summary-value', style: { color: confInfo.color, fontWeight: 600 } },
                `${(confidence * 100).toFixed(0)}% (${confInfo.text})`
              ),
            ),
            // 置信度进度条
            React.createElement('div', { className: 'sf-quality-bar' },
              React.createElement('div', {
                className: 'sf-quality-bar-fill',
                style: { width: `${Math.min(confidence * 100, 100)}%`, background: confInfo.color },
              }),
            ),
          ),
        ),

        // 工作流节点列表
        React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' }, `🔀 工作流 (${nodes.length} 步)`),
          React.createElement('div', { className: 'sf-orch-workflow' },
            nodes.map((node: any, idx: number) => {
              const st = node.subtask
              const skill = node.matchedSkill
              const isExpanded = orchExpandedNode === st.id
              const isLast = idx === nodes.length - 1
              return React.createElement(React.Fragment, { key: st.id },
                // 节点卡片
                React.createElement('div', {
                  className: `sf-orch-node ${isExpanded ? 'sf-orch-node-expanded' : ''} ${skill ? '' : 'sf-orch-node-unmatched'}`,
                  onClick: () => toggleOrchNode(st.id),
                },
                  React.createElement('div', { className: 'sf-orch-node-header' },
                    React.createElement('div', { className: 'sf-orch-node-order' }, idx + 1),
                    React.createElement('div', { className: 'sf-orch-node-body' },
                      React.createElement('div', { className: 'sf-orch-node-name' }, st.name),
                      skill && React.createElement('div', { className: 'sf-orch-node-skill' },
                        React.createElement('span', { className: 'sf-orch-node-skill-name' },
                          `🎯 ${skill.skill?.frontmatter?.name || '已匹配技能'}`
                        ),
                        React.createElement('span', { className: 'sf-orch-node-skill-score' },
                          `${(skill.score * 100).toFixed(0)}%`
                        ),
                      ),
                      !skill && React.createElement('div', { className: 'sf-orch-node-no-skill' },
                        '⚪ 无匹配技能，通用执行'
                      ),
                    ),
                    React.createElement('div', { className: 'sf-orch-node-caret' }, isExpanded ? '▼' : '▶'),
                  ),
                  // 展开内容
                  isExpanded && React.createElement('div', { className: 'sf-orch-node-detail' },
                    React.createElement('div', { className: 'sf-orch-node-desc' }, st.description),
                    st.category && React.createElement('div', { className: 'sf-orch-node-meta' },
                      React.createElement('span', null, `类别: ${st.category}`),
                      React.createElement('span', null, `复杂度: ${'★'.repeat(st.complexity)}${'☆'.repeat(5 - st.complexity)}`),
                    ),
                    skill && React.createElement('div', { className: 'sf-orch-node-match' },
                      React.createElement('div', { className: 'sf-orch-match-title' }, '匹配理由'),
                      React.createElement('div', { className: 'sf-orch-match-reason' }, skill.reason),
                      React.createElement('div', { className: 'sf-orch-match-scores' },
                        React.createElement('span', null, `关键词: ${(skill.keywordScore * 100).toFixed(0)}%`),
                        React.createElement('span', null, `类别: ${(skill.categoryScore * 100).toFixed(0)}%`),
                        React.createElement('span', null, `质量: ${(skill.qualityScore * 100).toFixed(0)}%`),
                      ),
                    ),
                    st.dependsOn?.length > 0 && React.createElement('div', { className: 'sf-orch-node-deps' },
                      React.createElement('span', null, `前置依赖: ${st.dependsOn.map((d: string) => {
                        const depNode = nodes.find((n: any) => n.subtask.id === d)
                        return depNode ? depNode.subtask.name : d
                      }).join('、')}`),
                    ),
                  ),
                ),
                // 连接线
                !isLast && React.createElement('div', { className: 'sf-orch-node-connector' }, null),
              )
            })
          ),
        ),

        // 执行指南
        React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', {
            className: 'sf-orch-guide-toggle',
            onClick: () => setOrchShowGuide(v => !v),
          },
            React.createElement('span', null, '📖 执行指南'),
            React.createElement('span', { className: 'sf-orch-guide-caret' }, orchShowGuide ? '▲' : '▼'),
          ),
          orchShowGuide && React.createElement('div', { className: 'sf-orch-guide-content' },
            React.createElement('pre', { className: 'sf-orch-guide-pre' }, orchResult.executionGuide || ''),
          ),
        ),
      ),

      // 空状态
      !workflow && !orchRunning && !orchError && React.createElement('div', { className: 'sf-empty-small' },
        '输入任务描述，开始编排技能组合工作流'
      ),
    )
  }

  // Dreaming 闲时锻造详情视图
  if (forgeSubTab === 'dreaming' && dreamingShowDetail && dreamingSelectedHistory) {
    const run = dreamingSelectedHistory
    const report = run.healthReport
    const phaseIdx = getDreamingPhaseIndex(run.phase || run.status)
    const isRunning = isDreamingRunning(run.status)

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => {
              if (tab.key === 'dreaming') {
                setDreamingShowDetail(false); setDreamingSelectedHistory(null)
              } else {
                setForgeSubTab(tab.key); setDreamingShowDetail(false); setDreamingSelectedHistory(null)
              }
            },
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      React.createElement('div', { className: 'sf-detail-back', onClick: () => { setDreamingShowDetail(false); setDreamingSelectedHistory(null) } }, '← 返回列表'),

      // 标题
      React.createElement('div', { className: 'sf-skill-detail-header' },
        React.createElement('h3', { className: 'sf-skill-detail-title' }, 'Dreaming 闲时锻造'),
        React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` }, dreamingStatusLabel(run.status)),
      ),
      React.createElement('div', { className: 'sf-skill-detail-subtitle' },
        `${dreamingTriggerLabel(run.triggerType)} · ${formatTime(run.startedAt)}`
      ),

      // 六阶段进度指示器
      React.createElement('div', { className: 'sf-dreaming-phases' },
        DREAMING_PHASES.map((phase, idx) => {
          const isDone = phaseIdx > idx
          const isActive = phaseIdx === idx && isRunning
          const cls = isDone ? 'sf-phase-done' : isActive ? 'sf-phase-active' : ''
          return React.createElement('div', { key: phase.key, className: `sf-dreaming-phase ${cls}` },
            React.createElement('div', { className: 'sf-dreaming-phase-dot' }, isDone ? '✓' : isActive ? phase.icon : (idx + 1)),
            React.createElement('div', { className: 'sf-dreaming-phase-label' }, phase.label),
          )
        }),
      ),

      // 总体进度
      React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `📊 总体进度 ${run.progress ?? 0}%`),
        React.createElement('div', { className: 'sf-quality-bar sf-quality-bar-lg' },
          React.createElement('div', {
            className: 'sf-quality-bar-fill',
            style: { width: `${Math.min(run.progress ?? 0, 100)}%`, background: 'linear-gradient(90deg, #8B5CF6, #6366F1)' },
          }),
          React.createElement('span', { className: 'sf-quality-bar-text' }, run.currentStepDescription || ''),
        ),
      ),

      // 结果统计
      React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, '📈 本轮成果'),
        React.createElement('div', { className: 'sf-dreaming-stats-grid' },
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num', style: { color: '#10B981' } }, String(run.darwinOptimizationsStarted ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '优化任务'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num', style: { color: '#8B5CF6' } }, String(run.taotieFusionsStarted ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '融合任务'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num', style: { color: '#F59E0B' } }, String(run.improvementSuggestions?.length ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '改进建议'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num', style: { color: '#6B7280' } }, String(run.autoArchivedCount ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '归档技能'),
          ),
        ),
      ),

      // 健康报告
      report && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, '🏥 健康报告'),
        React.createElement('div', { className: 'sf-dreaming-health-grid' },
          React.createElement('div', { className: 'sf-dreaming-health-item' },
            React.createElement('span', { className: 'sf-dreaming-health-label' }, '技能总数'),
            React.createElement('span', { className: 'sf-dreaming-health-value' }, String(report.totalSkills ?? 0)),
          ),
          React.createElement('div', { className: 'sf-dreaming-health-item' },
            React.createElement('span', { className: 'sf-dreaming-health-label' }, '平均质量分'),
            React.createElement('span', { className: 'sf-dreaming-health-value' }, (report.avgQualityScore ?? 0).toFixed(2)),
          ),
          React.createElement('div', { className: 'sf-dreaming-health-item' },
            React.createElement('span', { className: 'sf-dreaming-health-label' }, '30天使用率'),
            React.createElement('span', { className: 'sf-dreaming-health-value' },
              report.totalSkills ? `${((report.usedIn30Days ?? 0) / report.activeSkills * 100).toFixed(0)}%` : '—'
            ),
          ),
          React.createElement('div', { className: 'sf-dreaming-health-item' },
            React.createElement('span', { className: 'sf-dreaming-health-label' }, '重复率'),
            React.createElement('span', { className: 'sf-dreaming-health-value' }, `${((report.duplicateRatio ?? 0) * 100).toFixed(0)}%`),
          ),
        ),
        // 质量分布
        report.qualityDistribution && React.createElement('div', { className: 'sf-dreaming-quality-dist' },
          ['excellent', 'good', 'fair', 'poor'].map(level => {
            const labels: Record<string, string> = { excellent: '优秀', good: '良好', fair: '一般', poor: '较差' }
            const colors: Record<string, string> = { excellent: '#10B981', good: '#3B82F6', fair: '#F59E0B', poor: '#EF4444' }
            const count = report.qualityDistribution[level] ?? 0
            const total = report.activeSkills || 1
            return React.createElement('div', { key: level, className: 'sf-dreaming-dist-row' },
              React.createElement('span', { className: 'sf-dreaming-dist-label' }, labels[level]),
              React.createElement('div', { className: 'sf-dreaming-dist-track' },
                React.createElement('div', {
                  className: 'sf-dreaming-dist-fill',
                  style: { width: `${(count / total) * 100}%`, background: colors[level] },
                }),
              ),
              React.createElement('span', { className: 'sf-dreaming-dist-count' }, count),
            )
          }),
        ),
        // Top 改进目标
        report.topImprovementTargets?.length > 0 && React.createElement('div', null,
          React.createElement('div', { className: 'sf-detail-section-title', style: { marginTop: '12px' } }, '🎯 最需改进的技能'),
          React.createElement('div', { className: 'sf-dreaming-targets' },
            report.topImprovementTargets.map((t: any, i: number) =>
              React.createElement('div', { key: i, className: 'sf-dreaming-target-item' },
                React.createElement('span', { className: 'sf-dreaming-target-name' }, `${i + 1}. ${t.skillName}`),
                React.createElement('span', { className: `sf-dreaming-target-priority sf-priority-${t.priority}` }, t.priority),
              ),
            ),
          ),
        ),
      ),

      // 改进建议
      run.improvementSuggestions?.length > 0 && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, `💡 改进建议 (${run.improvementSuggestions.length})`),
        React.createElement('div', { className: 'sf-dreaming-suggestions' },
          run.improvementSuggestions.slice(0, 5).map((s: any, i: number) =>
            React.createElement('div', { key: i, className: 'sf-dreaming-suggestion' },
              React.createElement('div', { className: 'sf-dreaming-suggestion-head' },
                React.createElement('span', { className: 'sf-dreaming-suggestion-skill' }, s.skillName),
                React.createElement('span', { className: `sf-dreaming-target-priority sf-priority-${s.priority}` }, s.priority),
              ),
              s.overallRecommendation && React.createElement('div', { className: 'sf-dreaming-suggestion-desc' }, s.overallRecommendation),
            ),
          ),
        ),
      ),

      // 失败原因
      run.status === 'failed' && run.failureReason && React.createElement('div', { className: 'sf-detail-section' },
        React.createElement('div', { className: 'sf-detail-section-title' }, '❌ 失败原因'),
        React.createElement('div', { className: 'sf-run-failure-detail' },
          React.createElement('div', null, run.failureReason),
        ),
      ),
    )
  }

  // Dreaming 闲时锻造主视图
  if (forgeSubTab === 'dreaming') {
    const currentRun = dreamingCurrent
    const isRunning = currentRun && isDreamingRunning(currentRun.status)
    const phaseIdx = isRunning ? getDreamingPhaseIndex(currentRun.phase || currentRun.status) : -1
    const lastRun = dreamingHistory[0]

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => { setForgeSubTab(tab.key); setDreamingShowDetail(false); setDreamingSelectedHistory(null) },
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 子视图切换
      React.createElement('div', { className: 'sf-sub-tabs' },
        [
          { key: 'dashboard', label: '控制台', icon: '🎛️' },
          { key: 'history', label: '历史记录', icon: '📜' },
        ].map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${dreamingSubView === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => setDreamingSubView(tab.key as any),
          }, `${tab.icon} ${tab.label}`)
        )
      ),

      // 控制台视图
      dreamingSubView === 'dashboard' && React.createElement(React.Fragment, null,
        // 状态卡片
        React.createElement('div', { className: 'sf-dreaming-status-card' },
          React.createElement('div', { className: 'sf-dreaming-status-header' },
            React.createElement('div', { className: 'sf-dreaming-status-icon' }, isRunning ? '🌙' : '✨'),
            React.createElement('div', null,
              React.createElement('div', { className: 'sf-dreaming-status-title' },
                isRunning ? 'Dreaming 进行中' : 'Dreaming 空闲中'
              ),
              React.createElement('div', { className: 'sf-dreaming-status-sub' },
                isRunning
                  ? (currentRun.currentStepDescription || dreamingStatusLabel(currentRun.status))
                  : lastRun ? `上次运行: ${formatTime(lastRun.startedAt)}` : '尚未运行过'
              ),
            ),
          ),

          // 进度条（运行中显示）
          isRunning && React.createElement('div', { className: 'sf-dreaming-progress-wrap' },
            React.createElement('div', { className: 'sf-dreaming-progress-bar' },
              React.createElement('div', {
                className: 'sf-dreaming-progress-fill',
                style: { width: `${currentRun.progress ?? 0}%` },
              }),
            ),
            React.createElement('span', { className: 'sf-dreaming-progress-text' }, `${currentRun.progress ?? 0}%`),
          ),

          // 启动/停止按钮
          React.createElement('div', { className: 'sf-dreaming-actions' },
            isRunning
              ? React.createElement('button', {
                  className: 'sf-btn sf-btn-danger sf-btn-full',
                  onClick: handleDreamingStop,
                  disabled: dreamingStopping,
                }, dreamingStopping ? '停止中...' : '⏹ 停止 Dreaming')
              : React.createElement('button', {
                  className: 'sf-btn sf-btn-primary sf-btn-full',
                  onClick: handleDreamingStart,
                  disabled: dreamingStarting,
                }, dreamingStarting ? '启动中...' : '🌙 开始 Dreaming'),
          ),
        ),

        // 六阶段可视化（运行中或最近一次）
        (isRunning || lastRun) && React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' },
            isRunning ? '当前阶段' : '最近一次阶段'
          ),
          React.createElement('div', { className: 'sf-dreaming-phases' },
            DREAMING_PHASES.map((phase, idx) => {
              const targetRun = isRunning ? currentRun : lastRun
              const targetPhaseIdx = getDreamingPhaseIndex(targetRun.phase || targetRun.status)
              const isDone = targetPhaseIdx > idx || targetRun.status === 'completed'
              const isActive = isRunning && targetPhaseIdx === idx
              const cls = isDone ? 'sf-phase-done' : isActive ? 'sf-phase-active' : ''
              return React.createElement('div', { key: phase.key, className: `sf-dreaming-phase ${cls}` },
                React.createElement('div', { className: 'sf-dreaming-phase-dot' }, isDone ? '✓' : isActive ? phase.icon : (idx + 1)),
                React.createElement('div', { className: 'sf-dreaming-phase-label' }, phase.label),
              )
            }),
          ),
        ),

        // 统计概览
        React.createElement('div', { className: 'sf-dashboard-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#8B5CF6' } }, String(dreamingHistory.length)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '总运行次数'),
          ),
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#10B981' } },
              String(dreamingHistory.filter((r: any) => r.status === 'completed').length)
            ),
            React.createElement('div', { className: 'sf-stat-big-label' }, '成功次数'),
          ),
        ),

        // 健康体检快捷入口
        React.createElement('div', { className: 'sf-detail-section' },
          React.createElement('div', { className: 'sf-detail-section-title' }, '🏥 技能库健康体检'),
          React.createElement('button', {
            className: 'sf-btn sf-btn-secondary sf-btn-full',
            onClick: fetchDreamingHealthReport,
            disabled: dreamingLoadingHealth,
          }, dreamingLoadingHealth ? '生成中...' : '🔍 生成健康报告'),

          dreamingHealthReport && React.createElement('div', { className: 'sf-dreaming-health-quick' },
            React.createElement('div', { className: 'sf-dreaming-health-item' },
              React.createElement('span', { className: 'sf-dreaming-health-label' }, '平均质量'),
              React.createElement('span', { className: 'sf-dreaming-health-value' }, (dreamingHealthReport.avgQualityScore ?? 0).toFixed(2)),
            ),
            React.createElement('div', { className: 'sf-dreaming-health-item' },
              React.createElement('span', { className: 'sf-dreaming-health-label' }, '僵尸技能'),
              React.createElement('span', { className: 'sf-dreaming-health-value', style: { color: 'var(--sf-warning)' } },
                `${dreamingHealthReport.unusedIn30Days ?? 0} 个`
              ),
            ),
            React.createElement('div', { className: 'sf-dreaming-health-item' },
              React.createElement('span', { className: 'sf-dreaming-health-label' }, '相似技能组'),
              React.createElement('span', { className: 'sf-dreaming-health-value' },
                `${dreamingHealthReport.similarGroups ?? 0} 组`
              ),
            ),
          ),
        ),
      ),

      // 历史记录视图
      dreamingSubView === 'history' && React.createElement('div', { className: 'sf-forge-list' },
        dreamingHistory.length === 0
          ? React.createElement('div', { className: 'sf-empty-small' }, '暂无 Dreaming 记录')
          : dreamingHistory.map((run: any) =>
              React.createElement('div', {
                key: run.id,
                className: 'sf-dreaming-history-card',
                onClick: () => openDreamingDetail(run),
              },
                React.createElement('div', { className: 'sf-dreaming-history-head' },
                  React.createElement('span', { className: 'sf-darwin-skill-name' }, dreamingTriggerLabel(run.triggerType)),
                  React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` }, dreamingStatusLabel(run.status)),
                ),
                React.createElement('div', { className: 'sf-dreaming-history-meta' },
                  React.createElement('span', null, formatTime(run.startedAt)),
                  run.darwinOptimizationsStarted != null && React.createElement('span', null, `🧬 ${run.darwinOptimizationsStarted} 优化`),
                  run.taotieFusionsStarted != null && React.createElement('span', null, `🔗 ${run.taotieFusionsStarted} 融合`),
                  run.improvementSuggestions?.length != null && React.createElement('span', null, `💡 ${run.improvementSuggestions.length} 建议`),
                ),
                run.currentStepDescription && isDreamingRunning(run.status) && React.createElement('div', { className: 'sf-dreaming-history-step' },
                  run.currentStepDescription
                ),
              )
            )
      ),
    )
  }

  // 详情视图
  if (showSkillDetail && selectedItem) {
    const isSkill = selectedType === 'skill'
    const fm = isSkill ? (selectedItem.frontmatter || {}) : {}
    const item = selectedItem

    return React.createElement('div', { className: 'sf-forge-panel' },
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => { setForgeSubTab(tab.key); backToList() },
          }, `${tab.icon} ${tab.label}`)
        )
      ),

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
      // 子 Tab 栏
      React.createElement('div', { className: 'sf-sub-tabs' },
        forgeSubTabs.map(tab =>
          React.createElement('button', {
            key: tab.key,
            className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
            onClick: () => setForgeSubTab(tab.key),
          }, `${tab.icon} ${tab.label}`)
        )
      ),
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
    // 子 Tab 栏
    React.createElement('div', { className: 'sf-sub-tabs' },
      forgeSubTabs.map(tab =>
        React.createElement('button', {
          key: tab.key,
          className: `sf-sub-tab ${forgeSubTab === tab.key ? 'sf-sub-tab-active' : ''}`,
          onClick: () => { setForgeSubTab(tab.key); backToList() },
        }, `${tab.icon} ${tab.label}`)
      )
    ),
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
