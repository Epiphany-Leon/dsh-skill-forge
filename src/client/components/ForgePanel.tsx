/**
 * ForgePanel — 右侧边栏中的 Skill Forge Tab 内容
 *
 * 结构说明（单文件，内部模块化）：
 * - 顶部：类型定义 + 常量
 * - 中部：数据获取 + 业务操作函数（useCallback）
 * - 中下部：内联渲染组件（SectionHeader / SkillCard / RunCard 等）
 * - 底部：主组件 + 各视图分支
 *
 * 设计原则：
 * - 保持单文件，避免 Props 透传问题
 * - 重复 JSX 抽取为 helper 组件（模块级函数组件）
 * - 状态变量按功能模块组织
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api.js'
import {
  DARWIN_DIMENSIONS,
  TAOTIE_PHASES,
  COEVO_PHASES,
  DREAMING_PHASES,
  POLL_INTERVAL_MS,
  QUEUE_POLL_LIMIT,
} from '../constants.js'
import {
  formatRelativeTime,
  forgeStatusLabel,
  scoreColorClass,
  scoreBarClass,
  qualityColor,
  confidenceLabel,
  truncate,
} from '../utils.js'

// ============================================================
// 类型定义
// ============================================================

type ViewType = 'active' | 'pending' | 'running' | 'history' | 'stats'
type MainTabKey = 'forge' | 'fusion' | 'dreaming'
type ForgeSectionKey = 'list' | 'darwin' | 'coevo'
type FusionSectionKey = 'taotie' | 'orchestrate'
type TaotieSubViewKey = 'detect' | 'pair' | 'detail' | 'patterns'
type CoevoSubViewKey = 'start' | 'runs'
type DreamingSubViewKey = 'dashboard' | 'history'

// 通用：任意 API 返回对象
type UnknownRecord = Record<string, any>

// ============================================================
// 运行状态判断工具（模块级纯函数）
// ============================================================

const RUNNING_FORGE_STATUSES = [
  'extracting', 'generating', 'verifying', 'refining', 'auditing', 'iterating', 'created',
]

const HISTORY_FORGE_STATUSES = ['failed', 'active', 'archived', 'rejected']

function isForgeRunning(status: string): boolean {
  return RUNNING_FORGE_STATUSES.includes(status)
}

function isForgeHistory(status: string): boolean {
  return HISTORY_FORGE_STATUSES.includes(status)
}

// ============================================================
// 模块级常量（视图 Tab 定义）
// ============================================================

interface ViewTabDef {
  key: ViewType
  label: string
  icon: string
}

const VIEW_TABS: ViewTabDef[] = [
  { key: 'active', label: '已激活', icon: '✨' },
  { key: 'pending', label: '待审核', icon: '⏳' },
  { key: 'running', label: '进行中', icon: '⚙️' },
  { key: 'history', label: '历史', icon: '📜' },
  { key: 'stats', label: '统计', icon: '📊' },
]

const MAIN_TABS: { key: MainTabKey; label: string; icon: string }[] = [
  { key: 'forge', label: '锻造', icon: '🔨' },
  { key: 'fusion', label: '融合', icon: '🔗' },
  { key: 'dreaming', label: '闲时', icon: '🌙' },
]

const FORGE_SECTIONS: { key: ForgeSectionKey; label: string; icon: string }[] = [
  { key: 'list', label: '锻造列表', icon: '✨' },
  { key: 'darwin', label: '优化记录', icon: '🧬' },
  { key: 'coevo', label: '共进化', icon: '⚔️' },
]

const FUSION_SECTIONS: { key: FusionSectionKey; label: string; icon: string }[] = [
  { key: 'taotie', label: '融合记录', icon: '🔗' },
  { key: 'orchestrate', label: '编排工作台', icon: '🎯' },
]

// ============================================================
// 内联渲染组件：通用 UI 构件
// （放在模块顶层，避免每次 render 重建函数）
// ============================================================

// ---- 主导航 Tab Bar ----

interface MainTabsProps {
  active: MainTabKey
  onChange: (tab: MainTabKey) => void
}

function MainTabs({ active, onChange }: MainTabsProps): React.ReactElement {
  return React.createElement('div', { className: 'sf-main-tabs' },
    MAIN_TABS.map(tab =>
      React.createElement('button', {
        key: tab.key,
        className: `sf-main-tab ${active === tab.key ? 'sf-main-tab-active' : ''}`,
        onClick: () => onChange(tab.key),
      }, `${tab.icon} ${tab.label}`)
    )
  )
}

// ---- 分段导航 Tab Bar ----

interface SectionTabsProps {
  items: { key: string; label: string; icon: string }[]
  active: string
  onChange: (key: string) => void
}

function SectionTabs({ items, active, onChange }: SectionTabsProps): React.ReactElement {
  return React.createElement('div', { className: 'sf-section-tabs' },
    items.map(sec =>
      React.createElement('button', {
        key: sec.key,
        className: `sf-section-tab ${active === sec.key ? 'sf-section-tab-active' : ''}`,
        onClick: () => onChange(sec.key),
      }, `${sec.icon} ${sec.label}`)
    )
  )
}

// ---- 返回按钮 ----

function DetailBack({ onClick }: { onClick: () => void }): React.ReactElement {
  return React.createElement('div', { className: 'sf-detail-back', onClick }, '← 返回列表')
}

// ---- 详情页标题头 ----

interface DetailHeaderProps {
  title: string
  status: string
  subtitle?: string
}

function DetailHeader({ title, status, subtitle }: DetailHeaderProps): React.ReactElement {
  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'sf-skill-detail-header' },
      React.createElement('h3', { className: 'sf-skill-detail-title' }, title),
      React.createElement('span', { className: `sf-status-tag sf-status-${status}` }, forgeStatusLabel(status)),
    ),
    subtitle && React.createElement('div', { className: 'sf-skill-detail-subtitle' }, subtitle),
  )
}

// ---- 分段标题 ----

function SectionTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return React.createElement('div', { className: 'sf-detail-section-title' }, children)
}

// ---- 空状态 ----

function EmptySmall({ text }: { text: string }): React.ReactElement {
  return React.createElement('div', { className: 'sf-empty-small' }, text)
}

// ---- 质量分进度条 ----

interface QualityBarProps {
  score: number
  label?: string
  large?: boolean
  gradient?: string
}

function QualityBar({ score, label, large = false, gradient }: QualityBarProps): React.ReactElement {
  const pct = Math.min(score * 100, 100)
  return React.createElement('div', { className: `sf-quality-bar ${large ? 'sf-quality-bar-lg' : ''}` },
    React.createElement('div', {
      className: 'sf-quality-bar-fill',
      style: gradient
        ? { width: `${pct}%`, background: gradient }
        : { width: `${pct}%` },
    }),
    label && React.createElement('span', { className: 'sf-quality-bar-text' }, label),
  )
}

// ---- 阶段进度指示器 ----

interface PhaseIndicatorProps {
  phases: { key: string; label: string; icon: string }[]
  currentIndex: number
  isRunning: boolean
  phaseClassPrefix: string
}

function PhaseIndicator({ phases, currentIndex, isRunning, phaseClassPrefix }: PhaseIndicatorProps): React.ReactElement {
  return React.createElement('div', { className: `${phaseClassPrefix}-phases` },
    phases.map((phase, idx) => {
      const isDone = currentIndex > idx
      const isActive = currentIndex === idx && isRunning
      const cls = isDone ? 'sf-phase-done' : isActive ? 'sf-phase-active' : ''
      return React.createElement('div', {
        key: phase.key,
        className: `${phaseClassPrefix}-phase ${cls}`,
      },
        React.createElement('div', { className: `${phaseClassPrefix}-phase-dot` },
          isDone ? '✓' : isActive ? phase.icon : (idx + 1)),
        React.createElement('div', { className: `${phaseClassPrefix}-phase-label` }, phase.label),
      )
    })
  )
}

// ---- 操作按钮行 ----

function DetailActions({ children }: { children: React.ReactNode }): React.ReactElement {
  return React.createElement('div', { className: 'sf-detail-actions' }, children)
}

// ---- 详情 Section 容器 ----

function DetailSection({ title, children }: { title: string; children?: React.ReactNode }): React.ReactElement {
  return React.createElement('div', { className: 'sf-detail-section' },
    React.createElement(SectionTitle, null, title),
    children,
  )
}

// ============================================================
// 主组件
// ============================================================

export function ForgePanel(): React.ReactElement {
  // ==========================================================
  // 状态分组（按功能模块）
  // ==========================================================

  // --- 基础导航与数据 ---
  const [mainTab, setMainTab] = useState<MainTabKey>('forge')
  const [forgeSection, setForgeSection] = useState<ForgeSectionKey>('list')
  const [fusionSection, setFusionSection] = useState<FusionSectionKey>('taotie')

  const [skills, setSkills] = useState<UnknownRecord[]>([])
  const [runs, setRuns] = useState<UnknownRecord[]>([])
  const [stats, setStats] = useState<UnknownRecord | null>(null)

  const [currentView, setCurrentView] = useState<ViewType>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [triggering, setTriggering] = useState(false)

  // --- 详情视图（技能/锻造任务通用） ---
  const [showSkillDetail, setShowSkillDetail] = useState(false)
  const [selectedItem, setSelectedItem] = useState<UnknownRecord | null>(null)
  const [selectedType, setSelectedType] = useState<'skill' | 'run' | null>(null)

  const [skillVersions, setSkillVersions] = useState<UnknownRecord[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [skillLineage, setSkillLineage] = useState<UnknownRecord | null>(null)
  const [loadingLineage, setLoadingLineage] = useState(false)
  const [relatedSkills, setRelatedSkills] = useState<UnknownRecord[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)

  const [diffFrom, setDiffFrom] = useState('')
  const [diffTo, setDiffTo] = useState('')
  const [diffResult, setDiffResult] = useState<UnknownRecord | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  const [feedbackSent, setFeedbackSent] = useState<Record<string, string>>({})

  // --- 拒绝理由 Modal ---
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectRunId, setRejectRunId] = useState<string | null>(null)
  const [rejectReasons, setRejectReasons] = useState<string[]>([])
  const [rejectCustomText, setRejectCustomText] = useState('')

  // --- 编辑技能 Modal ---
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSkill, setEditSkill] = useState<UnknownRecord | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', description: '', whenToUse: '', body: '',
    tags: '', category: '', changelog: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // --- 达尔文模式 ---
  const [darwinRuns, setDarwinRuns] = useState<UnknownRecord[]>([])
  const [darwinSelectedSkill, setDarwinSelectedSkill] = useState('')
  const [darwinTargetDims, setDarwinTargetDims] = useState<string[]>([])
  const [darwinAutoApprove, setDarwinAutoApprove] = useState(false)
  const [darwinStarting, setDarwinStarting] = useState(false)
  const [darwinDetailRun, setDarwinDetailRun] = useState<UnknownRecord | null>(null)
  const [darwinShowDetail, setDarwinShowDetail] = useState(false)
  const [darwinLoadingDetail, setDarwinLoadingDetail] = useState(false)

  // --- 饕餮模式 ---
  const [taotieGroups, setTaotieGroups] = useState<UnknownRecord[]>([])
  const [taotieThreshold, setTaotieThreshold] = useState(0.4)
  const [taotieDetecting, setTaotieDetecting] = useState(false)
  const [taotieSubView, setTaotieSubView] = useState<TaotieSubViewKey>('detect')
  const [taotiePairReport, setTaotiePairReport] = useState<UnknownRecord | null>(null)
  const [taotieAnalyzing, setTaotieAnalyzing] = useState(false)
  const [taotieTarget, setTaotieTarget] = useState('')
  const [taotieSource, setTaotieSource] = useState('')
  const [taotieStarting, setTaotieStarting] = useState(false)
  const [taotieDetailRun, setTaotieDetailRun] = useState<UnknownRecord | null>(null)
  const [taotiePatterns, setTaotiePatterns] = useState<UnknownRecord[]>([])
  const [taotieLoadingPatterns, setTaotieLoadingPatterns] = useState(false)

  // --- CoEvo 共进化 ---
  const [coevoRuns, setCoevoRuns] = useState<UnknownRecord[]>([])
  const [coevoSelectedSkill, setCoevoSelectedSkill] = useState('')
  const [coevoAutoApprove, setCoevoAutoApprove] = useState(false)
  const [coevoMaxRounds, setCoevoMaxRounds] = useState(8)
  const [coevoTargetSkillScore, setCoevoTargetSkillScore] = useState(0.85)
  const [coevoTargetTestStrength, setCoevoTargetTestStrength] = useState(0.7)
  const [coevoStarting, setCoevoStarting] = useState(false)
  const [coevoDetailRun, setCoevoDetailRun] = useState<UnknownRecord | null>(null)
  const [coevoShowDetail, setCoevoShowDetail] = useState(false)
  const [coevoLoadingDetail, setCoevoLoadingDetail] = useState(false)
  const [coevoSubView, setCoevoSubView] = useState<CoevoSubViewKey>('start')

  // --- 编排模式 ---
  const [orchQuery, setOrchQuery] = useState('')
  const [orchMode, setOrchMode] = useState<'auto' | 'fast' | 'llm'>('auto')
  const [orchRunning, setOrchRunning] = useState(false)
  const [orchResult, setOrchResult] = useState<UnknownRecord | null>(null)
  const [orchError, setOrchError] = useState('')
  const [orchStats, setOrchStats] = useState<UnknownRecord | null>(null)
  const [orchExpandedNode, setOrchExpandedNode] = useState<string | null>(null)
  const [orchShowGuide, setOrchShowGuide] = useState(false)

  // --- Dreaming 闲时锻造 ---
  const [dreamingCurrent, setDreamingCurrent] = useState<UnknownRecord | null>(null)
  const [dreamingHistory, setDreamingHistory] = useState<UnknownRecord[]>([])
  const [dreamingSubView, setDreamingSubView] = useState<DreamingSubViewKey>('dashboard')
  const [dreamingStarting, setDreamingStarting] = useState(false)
  const [dreamingStopping, setDreamingStopping] = useState(false)
  const [dreamingHealthReport, setDreamingHealthReport] = useState<UnknownRecord | null>(null)
  const [dreamingLoadingHealth, setDreamingLoadingHealth] = useState(false)
  const [dreamingSelectedHistory, setDreamingSelectedHistory] = useState<UnknownRecord | null>(null)
  const [dreamingShowDetail, setDreamingShowDetail] = useState(false)

  // ==========================================================
  // 数据获取
  // ==========================================================

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [sk, r, st] = await Promise.all([
        api.getSkills(),
        api.getQueue(QUEUE_POLL_LIMIT),
        api.getStatsDetail(),
      ])
      setSkills(sk as UnknownRecord[])
      setRuns(r as UnknownRecord[])
      setStats(st as UnknownRecord | null)
    } catch (err) {
      console.error('[skill-forge] fetch failed:', err)
    }
  }, [])

  const fetchDarwinRuns = useCallback(async (): Promise<void> => {
    try {
      const res = await api.darwinRuns(QUEUE_POLL_LIMIT)
      const arr = Array.isArray(res) ? res : (res as UnknownRecord)?.runs as UnknownRecord[] | undefined
      setDarwinRuns(arr || [])
    } catch (err) {
      console.error('[skill-forge] darwin runs fetch failed:', err)
    }
  }, [])

  const fetchDarwinDetail = useCallback(async (runId: string): Promise<void> => {
    try {
      const res = await api.darwinStatus(runId)
      const run = (res as UnknownRecord)?.run || res
      setDarwinDetailRun(run as UnknownRecord | null)
    } catch (err) {
      console.error('[skill-forge] darwin detail fetch failed:', err)
    }
  }, [])

  const fetchTaotiePatterns = useCallback(async (): Promise<void> => {
    try {
      setTaotieLoadingPatterns(true)
      const res = await api.taotiePatterns()
      const arr = Array.isArray(res) ? res : (res as UnknownRecord)?.patterns as UnknownRecord[] | undefined
      setTaotiePatterns(arr || [])
    } catch (err) {
      console.error('[skill-forge] taotie patterns fetch failed:', err)
    } finally {
      setTaotieLoadingPatterns(false)
    }
  }, [])

  const fetchTaotieDetail = useCallback(async (runId: string): Promise<void> => {
    try {
      const res = await api.taotieStatus(runId)
      const run = (res as UnknownRecord)?.run || res
      setTaotieDetailRun(run as UnknownRecord | null)
    } catch (err) {
      console.error('[skill-forge] taotie detail fetch failed:', err)
    }
  }, [])

  const fetchOrchStats = useCallback(async (): Promise<void> => {
    try {
      const res = await api.orchestratorStats()
      setOrchStats(res as UnknownRecord | null)
    } catch (err) {
      console.error('[skill-forge] orchestrator stats fetch failed:', err)
    }
  }, [])

  const fetchCoevoRuns = useCallback(async (): Promise<void> => {
    try {
      const res = await api.coevoRuns(QUEUE_POLL_LIMIT)
      const arr = Array.isArray(res) ? res : (res as UnknownRecord)?.runs as UnknownRecord[] | undefined
      setCoevoRuns(arr || [])
    } catch (err) {
      console.error('[skill-forge] coevo runs fetch failed:', err)
    }
  }, [])

  const fetchCoevoDetail = useCallback(async (runId: string): Promise<void> => {
    try {
      const res = await api.coevoStatus(runId)
      const run = (res as UnknownRecord)?.run || res
      setCoevoDetailRun(run as UnknownRecord | null)
    } catch (err) {
      console.error('[skill-forge] coevo detail fetch failed:', err)
    }
  }, [])

  const fetchDreamingStatus = useCallback(async (): Promise<void> => {
    try {
      const res = await api.dreamingStatus()
      const current = (res as UnknownRecord)?.current as UnknownRecord | undefined
      setDreamingCurrent(current || null)
    } catch (err) {
      console.error('[skill-forge] dreaming status fetch failed:', err)
    }
  }, [])

  const fetchDreamingHistory = useCallback(async (): Promise<void> => {
    try {
      const res = await api.dreamingHistory(QUEUE_POLL_LIMIT)
      const arr = Array.isArray(res) ? res : (res as UnknownRecord)?.history as UnknownRecord[] | undefined
      setDreamingHistory(arr || [])
    } catch (err) {
      console.error('[skill-forge] dreaming history fetch failed:', err)
    }
  }, [])

  const fetchDreamingHealthReport = useCallback(async (): Promise<void> => {
    try {
      setDreamingLoadingHealth(true)
      const res = await api.dreamingHealthReport()
      const report = (res as UnknownRecord)?.report as UnknownRecord | undefined
      setDreamingHealthReport(report || null)
    } catch (err) {
      console.error('[skill-forge] dreaming health report fetch failed:', err)
    } finally {
      setDreamingLoadingHealth(false)
    }
  }, [])

  // ==========================================================
  // 轮询
  // ==========================================================

  useEffect(() => {
    // 初始加载
    void fetchData()
    void fetchDarwinRuns()
    void fetchTaotiePatterns()
    void fetchOrchStats()
    void fetchCoevoRuns()
    void fetchDreamingStatus()
    void fetchDreamingHistory()

    const timer = setInterval(() => {
      void fetchData()
      if (forgeSection === 'darwin') void fetchDarwinRuns()
      if (darwinShowDetail && darwinDetailRun?.id) {
        void fetchDarwinDetail(String(darwinDetailRun.id))
      }
      if (taotieSubView === 'detail' && taotieDetailRun?.id) {
        void fetchTaotieDetail(String(taotieDetailRun.id))
      }
      if (forgeSection === 'coevo') void fetchCoevoRuns()
      if (coevoShowDetail && coevoDetailRun?.id) {
        void fetchCoevoDetail(String(coevoDetailRun.id))
      }
      if (mainTab === 'dreaming') {
        void fetchDreamingStatus()
        void fetchDreamingHistory()
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [
    fetchData, fetchDarwinRuns, fetchDarwinDetail, fetchTaotieDetail,
    fetchTaotiePatterns, fetchOrchStats, fetchCoevoRuns, fetchCoevoDetail,
    fetchDreamingStatus, fetchDreamingHistory,
    mainTab, forgeSection,
    darwinShowDetail, darwinDetailRun?.id,
    taotieSubView, taotieDetailRun?.id,
    coevoShowDetail, coevoDetailRun?.id,
  ])

  // ==========================================================
  // 衍生计算
  // ==========================================================

  const pendingRuns = useMemo(
    () => runs.filter(r => r.status === 'pending_approval'),
    [runs],
  )
  const runningRuns = useMemo(
    () => runs.filter(r => isForgeRunning(String(r.status))),
    [runs],
  )
  const historyRuns = useMemo(
    () => runs.filter(r => isForgeHistory(String(r.status))),
    [runs],
  )
  const activeSkills = useMemo(
    () => skills.filter(s => s.status === 'active'),
    [skills],
  )

  const filteredActiveSkills = useMemo(() => {
    if (!searchQuery.trim()) return activeSkills
    const q = searchQuery.trim().toLowerCase()
    return activeSkills.filter(s => {
      const fm = s.frontmatter as UnknownRecord | undefined
      const name = String(fm?.name ?? '').toLowerCase()
      const desc = String(fm?.description ?? '').toLowerCase()
      return name.includes(q) || desc.includes(q)
    })
  }, [activeSkills, searchQuery])

  const counts = useMemo(() => ({
    active: (stats?.active as number | undefined) ?? activeSkills.length,
    pending: pendingRuns.length,
    running: runningRuns.length,
    history: historyRuns.length,
  }), [stats, activeSkills.length, pendingRuns.length, runningRuns.length, historyRuns.length])

  const viewTabsWithCount = useMemo(
    (): { key: ViewType; label: string; icon: string; count: number }[] =>
      VIEW_TABS.map(tab => ({
        ...tab,
        count: tab.key === 'stats'
          ? ((stats?.total as number | undefined) ?? skills.length)
          : counts[tab.key as keyof typeof counts],
      })),
    [counts, stats, skills.length],
  )

  // ==========================================================
  // 操作：基础锻造
  // ==========================================================

  const handleTrigger = useCallback(async (): Promise<void> => {
    setTriggering(true)
    try {
      await api.triggerForge('manual trigger from UI')
      await fetchData()
      setCurrentView('running')
    } catch (e) {
      console.error('[skill-forge] trigger failed:', e)
    } finally {
      setTriggering(false)
    }
  }, [fetchData])

  const handleApprove = useCallback(async (runId: string): Promise<void> => {
    try {
      await api.approveSkill(runId)
      await fetchData()
    } catch (e) { console.error(e) }
  }, [fetchData])

  const handleReject = useCallback((runId: string): void => {
    setRejectRunId(runId)
    setRejectReasons([])
    setRejectCustomText('')
    setShowRejectModal(true)
  }, [])

  const confirmReject = useCallback(async (): Promise<void> => {
    if (!rejectRunId) return
    try {
      const reasons = [...rejectReasons]
      if (rejectCustomText.trim()) reasons.push(rejectCustomText.trim())
      await api.rejectSkill(rejectRunId, reasons.length > 0 ? reasons : ['未提供理由'])
      await fetchData()
      setShowRejectModal(false)
      setRejectRunId(null)
    } catch (e) { console.error(e) }
  }, [rejectRunId, rejectReasons, rejectCustomText, fetchData])

  const toggleRejectReason = useCallback((reason: string): void => {
    setRejectReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    )
  }, [])

  const handleCancel = useCallback(async (runId: string): Promise<void> => {
    try {
      await api.cancelForge(runId)
      await fetchData()
    } catch (e) { console.error(e) }
  }, [fetchData])

  const handleRetry = useCallback(async (runId: string): Promise<void> => {
    try {
      await api.retryForge(runId)
      await fetchData()
    } catch (e) { console.error(e) }
  }, [fetchData])

  const handleArchiveSkill = useCallback(async (name: string): Promise<void> => {
    try {
      await api.archiveSkill(name)
      await fetchData()
      setSelectedItem(null)
    } catch (e) { console.error(e) }
  }, [fetchData])

  const handleFeedback = useCallback(async (name: string, rating: 'helpful' | 'neutral' | 'harmful'): Promise<void> => {
    if (feedbackSent[name]) return
    try {
      await api.recordFeedback(name, rating)
      setFeedbackSent(prev => ({ ...prev, [name]: rating }))
    } catch (e) { console.error(e) }
  }, [feedbackSent])

  const handleEditSkill = useCallback((skill: UnknownRecord): void => {
    const fm = (skill.frontmatter as UnknownRecord | undefined) || {}
    setEditSkill(skill)
    setEditForm({
      name: String(fm.name || ''),
      description: String(fm.description || ''),
      whenToUse: String(fm.whenToUse || ''),
      body: String(skill.body || ''),
      tags: Array.isArray(fm.tags) ? (fm.tags as string[]).join(', ') : '',
      category: String(fm.category || ''),
      changelog: '',
    })
    setShowEditModal(true)
  }, [])

  const confirmEdit = useCallback(async (): Promise<void> => {
    if (!editSkill || !editForm.changelog.trim()) return
    setSavingEdit(true)
    try {
      const skillName = String(
        (editSkill.frontmatter as UnknownRecord | undefined)?.name || editSkill.id || ''
      )
      await api.updateSkill(skillName, {
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
  }, [editSkill, editForm, fetchData])

  // ==========================================================
  // 操作：达尔文模式
  // ==========================================================

  const darwinStatusLabel = useCallback((status: string): string => {
    const map: Record<string, string> = {
      created: '已创建', initial_evaluating: '初始评估中', optimizing: '优化中',
      pending_approval: '待批准', running: '运行中', completed: '已完成',
      stopped: '已停止', failed: '失败',
    }
    return map[status] || status
  }, [])

  const handleDarwinStart = useCallback(async (): Promise<void> => {
    if (!darwinSelectedSkill) return
    setDarwinStarting(true)
    try {
      const res = await api.darwinStart(
        darwinSelectedSkill,
        darwinTargetDims.length > 0 ? darwinTargetDims : undefined,
        darwinAutoApprove,
      )
      const runId = String((res as UnknownRecord)?.runId || '')
      if (runId) {
        await fetchDarwinRuns()
        const detail = await api.darwinStatus(runId)
        const run = (detail as UnknownRecord)?.run || detail
        setDarwinDetailRun(run as UnknownRecord | null)
        setDarwinShowDetail(true)
      }
    } catch (e) { console.error('[skill-forge] darwin start failed:', e) }
    finally { setDarwinStarting(false) }
  }, [darwinSelectedSkill, darwinTargetDims, darwinAutoApprove, fetchDarwinRuns])

  const handleDarwinApprove = useCallback(async (runId: string, dimension: string): Promise<void> => {
    try {
      await api.darwinApprove(runId, dimension)
      await fetchDarwinDetail(runId)
      await fetchDarwinRuns()
    } catch (e) { console.error(e) }
  }, [fetchDarwinDetail, fetchDarwinRuns])

  const handleDarwinReject = useCallback(async (runId: string, dimension: string): Promise<void> => {
    try {
      await api.darwinReject(runId, dimension)
      await fetchDarwinDetail(runId)
      await fetchDarwinRuns()
    } catch (e) { console.error(e) }
  }, [fetchDarwinDetail, fetchDarwinRuns])

  const handleDarwinStop = useCallback(async (runId: string): Promise<void> => {
    try {
      await api.darwinStop(runId)
      await fetchDarwinDetail(runId)
      await fetchDarwinRuns()
    } catch (e) { console.error(e) }
  }, [fetchDarwinDetail, fetchDarwinRuns])

  const openDarwinDetail = useCallback(async (run: UnknownRecord): Promise<void> => {
    setDarwinDetailRun(run)
    setDarwinShowDetail(true)
    setDarwinLoadingDetail(true)
    try {
      const res = await api.darwinStatus(String(run.id))
      const detail = (res as UnknownRecord)?.run || res
      setDarwinDetailRun(detail as UnknownRecord | null)
    } catch (e) { console.error(e) }
    finally { setDarwinLoadingDetail(false) }
  }, [])

  const toggleDarwinDim = useCallback((dim: string): void => {
    setDarwinTargetDims(prev =>
      prev.includes(dim) ? prev.filter(d => d !== dim) : [...prev, dim]
    )
  }, [])

  // ==========================================================
  // 操作：饕餮模式
  // ==========================================================

  const taotieStatusLabel = useCallback((status: string): string => {
    const map: Record<string, string> = {
      created: '已创建', pair_analyzing: '配对分析中', pair_analysis_done: '配对完成',
      parallel_testing: '并行测试中', parallel_testing_done: '测试完成',
      reverse_engineering: '反向工程中', reverse_engineering_done: '反推完成',
      injecting: '注入中', pending_approval: '待批准', injection_done: '注入完成',
      distilling: '沉淀中', completed: '已完成', failed: '失败', cancelled: '已取消',
    }
    return map[status] || status
  }, [])

  const getTaotiePhaseIndex = useCallback((phase: string): number =>
    TAOTIE_PHASES.findIndex(p => p.key === phase),
  [])

  const handleTaotieDetect = useCallback(async (): Promise<void> => {
    setTaotieDetecting(true)
    try {
      const res = await api.taotieDetect(taotieThreshold)
      const groups = (res as UnknownRecord)?.groups as UnknownRecord[] | undefined
      setTaotieGroups(groups || [])
    } catch (e) { console.error('[skill-forge] taotie detect failed:', e) }
    finally { setTaotieDetecting(false) }
  }, [taotieThreshold])

  const handleTaotieAnalyze = useCallback(async (target: string, source: string): Promise<void> => {
    setTaotieAnalyzing(true)
    setTaotieTarget(target)
    setTaotieSource(source)
    try {
      const res = await api.taotieAnalyze(target, source)
      const report = (res as UnknownRecord)?.report || res
      setTaotiePairReport(report as UnknownRecord | null)
      setTaotieSubView('pair')
    } catch (e) { console.error(e) }
    finally { setTaotieAnalyzing(false) }
  }, [])

  const handleTaotieStart = useCallback(async (): Promise<void> => {
    if (!taotieTarget || !taotieSource) return
    setTaotieStarting(true)
    try {
      const res = await api.taotieStart(taotieTarget, taotieSource, false)
      const runId = String((res as UnknownRecord)?.runId || '')
      if (runId) {
        const detail = await api.taotieStatus(runId)
        const run = (detail as UnknownRecord)?.run || detail
        setTaotieDetailRun(run as UnknownRecord | null)
        setTaotieSubView('detail')
      }
    } catch (e) { console.error('[skill-forge] taotie start failed:', e) }
    finally { setTaotieStarting(false) }
  }, [taotieTarget, taotieSource])

  const handleTaotieApprove = useCallback(async (runId: string, stepIndex?: number): Promise<void> => {
    try {
      await api.taotieApprove(runId, stepIndex)
      await fetchTaotieDetail(runId)
    } catch (e) { console.error(e) }
  }, [fetchTaotieDetail])

  const handleTaotieStop = useCallback(async (runId: string): Promise<void> => {
    try {
      await api.taotieStop(runId)
      await fetchTaotieDetail(runId)
    } catch (e) { console.error(e) }
  }, [fetchTaotieDetail])

  // ==========================================================
  // 操作：CoEvo 共进化
  // ==========================================================

  const coevoStatusLabel = useCallback((status: string): string => {
    const map: Record<string, string> = {
      created: '已创建', initial_testing: '基线测试中',
      skill_evolving: '技能进化中', test_evolving: '测试进化中',
      pending_approval: '待批准', completed: '已完成',
      stopped: '已停止', failed: '失败',
    }
    return map[status] || status
  }, [])

  const coevoScoreColorClass = useCallback((score: number): string => scoreColorClass(score), [])

  const getCoevoPhaseIndex = useCallback((status: string): number => {
    const order = ['created', 'initial_testing', 'skill_evolving', 'test_evolving',
      'pending_approval', 'completed', 'stopped', 'failed']
    const idx = order.indexOf(status)
    if (idx <= 1) return 0 // baseline
    if (status === 'skill_evolving' || status === 'pending_approval') return 1
    if (status === 'test_evolving') return 2
    if (status === 'completed' || status === 'stopped' || status === 'failed') return 2
    return 0
  }, [])

  const handleCoevoStart = useCallback(async (): Promise<void> => {
    if (!coevoSelectedSkill) return
    setCoevoStarting(true)
    try {
      const res = await api.coevoStart(coevoSelectedSkill, {
        autoApprove: coevoAutoApprove,
        maxRounds: coevoMaxRounds,
        targetSkillScore: coevoTargetSkillScore,
        targetTestStrength: coevoTargetTestStrength,
      })
      const runId = String((res as UnknownRecord)?.runId || '')
      if (runId) {
        await fetchCoevoRuns()
        const detail = await api.coevoStatus(runId)
        const run = (detail as UnknownRecord)?.run || detail
        setCoevoDetailRun(run as UnknownRecord | null)
        setCoevoShowDetail(true)
      }
    } catch (e) { console.error('[skill-forge] coevo start failed:', e) }
    finally { setCoevoStarting(false) }
  }, [
    coevoSelectedSkill, coevoAutoApprove, coevoMaxRounds,
    coevoTargetSkillScore, coevoTargetTestStrength, fetchCoevoRuns,
  ])

  const handleCoevoApprove = useCallback(async (runId: string): Promise<void> => {
    try {
      await api.coevoApprove(runId)
      await fetchCoevoDetail(runId)
      await fetchCoevoRuns()
    } catch (e) { console.error(e) }
  }, [fetchCoevoDetail, fetchCoevoRuns])

  const handleCoevoReject = useCallback(async (runId: string, reason?: string): Promise<void> => {
    try {
      await api.coevoReject(runId, reason)
      await fetchCoevoDetail(runId)
      await fetchCoevoRuns()
    } catch (e) { console.error(e) }
  }, [fetchCoevoDetail, fetchCoevoRuns])

  const handleCoevoStop = useCallback(async (runId: string): Promise<void> => {
    try {
      await api.coevoStop(runId)
      await fetchCoevoDetail(runId)
      await fetchCoevoRuns()
    } catch (e) { console.error(e) }
  }, [fetchCoevoDetail, fetchCoevoRuns])

  const openCoevoDetail = useCallback(async (run: UnknownRecord): Promise<void> => {
    setCoevoDetailRun(run)
    setCoevoShowDetail(true)
    setCoevoLoadingDetail(true)
    try {
      const res = await api.coevoStatus(String(run.id))
      const detail = (res as UnknownRecord)?.run || res
      setCoevoDetailRun(detail as UnknownRecord | null)
    } catch (e) { console.error(e) }
    finally { setCoevoLoadingDetail(false) }
  }, [])

  // ==========================================================
  // 操作：编排模式
  // ==========================================================

  const handleOrchestrate = useCallback(async (): Promise<void> => {
    if (!orchQuery.trim()) return
    setOrchRunning(true)
    setOrchError('')
    setOrchResult(null)
    setOrchShowGuide(false)
    try {
      const res = await api.orchestrateTask(orchQuery.trim(), orchMode)
      setOrchResult(res as UnknownRecord | null)
      await fetchOrchStats()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '编排失败'
      setOrchError(msg)
      console.error('[skill-forge] orchestrate failed:', e)
    } finally {
      setOrchRunning(false)
    }
  }, [orchQuery, orchMode, fetchOrchStats])

  const toggleOrchNode = useCallback((nodeId: string): void => {
    setOrchExpandedNode(prev => prev === nodeId ? null : nodeId)
  }, [])

  const orchStatusLabel = useCallback((status: string): string => {
    const map: Record<string, string> = {
      pending: '待执行', running: '进行中', completed: '已完成',
      failed: '失败', skipped: '已跳过',
    }
    return map[status] || status
  }, [])

  // ==========================================================
  // 操作：Dreaming 闲时锻造
  // ==========================================================

  const dreamingStatusLabel = useCallback((status: string): string => {
    const map: Record<string, string> = {
      idle: '空闲', scheduled: '已调度',
      health_check: '健康体检中', score_update: '更新评分中',
      similarity_scan: '相似度扫描中', optimizing: '优化中',
      fusing: '融合中', suggesting: '生成建议中',
      generating_report: '生成报告中',
      completed: '已完成', failed: '失败', stopped: '已停止',
    }
    return map[status] || status
  }, [])

  const dreamingTriggerLabel = useCallback((type: string): string => {
    const map: Record<string, string> = {
      manual: '手动触发', scheduled: '定时触发', idle: '空闲触发',
    }
    return map[type] || type
  }, [])

  const getDreamingPhaseIndex = useCallback((phase: string): number =>
    DREAMING_PHASES.findIndex(p => p.key === phase),
  [])

  const handleDreamingStart = useCallback(async (): Promise<void> => {
    setDreamingStarting(true)
    try {
      const res = await api.dreamingStart('manual')
      const run = (res as UnknownRecord)?.run as UnknownRecord | undefined
      if (run) setDreamingCurrent(run)
      await fetchDreamingStatus()
      await fetchDreamingHistory()
    } catch (e) { console.error('[skill-forge] dreaming start failed:', e) }
    finally { setDreamingStarting(false) }
  }, [fetchDreamingStatus, fetchDreamingHistory])

  const handleDreamingStop = useCallback(async (): Promise<void> => {
    setDreamingStopping(true)
    try {
      await api.dreamingStop('Manually stopped from UI')
      await fetchDreamingStatus()
      await fetchDreamingHistory()
    } catch (e) { console.error('[skill-forge] dreaming stop failed:', e) }
    finally { setDreamingStopping(false) }
  }, [fetchDreamingStatus, fetchDreamingHistory])

  const openDreamingDetail = useCallback((run: UnknownRecord): void => {
    setDreamingSelectedHistory(run)
    setDreamingShowDetail(true)
  }, [])

  const isDreamingRunning = useCallback((status: string): boolean =>
    ['health_check', 'score_update', 'similarity_scan', 'optimizing',
      'fusing', 'suggesting', 'generating_report'].includes(status),
  [])

  // ==========================================================
  // 操作：技能详情
  // ==========================================================

  const selectSkill = useCallback(async (skill: UnknownRecord): Promise<void> => {
    setSelectedItem(skill)
    setSelectedType('skill')
    setShowSkillDetail(true)
    const name = String(
      (skill.frontmatter as UnknownRecord | undefined)?.name || skill.id || ''
    )

    // 加载版本历史
    setLoadingVersions(true)
    try {
      const v = await api.getSkillVersions(name)
      const versions = (v as UnknownRecord)?.versions as UnknownRecord[] | undefined
      setSkillVersions(versions || [])
    } catch { setSkillVersions([]) }
    finally { setLoadingVersions(false) }

    // 加载谱系
    setLoadingLineage(true)
    try {
      const l = await api.getSkillLineage(name)
      setSkillLineage(l as UnknownRecord | null)
    } catch { setSkillLineage(null) }
    finally { setLoadingLineage(false) }

    // 加载相关技能
    setLoadingRelated(true)
    try {
      const r = await api.getRelatedSkills(name)
      const related = Array.isArray(r) ? r : (r as UnknownRecord)?.related as UnknownRecord[] | undefined
      setRelatedSkills(related || [])
    } catch { setRelatedSkills([]) }
    finally { setLoadingRelated(false) }
  }, [])

  const selectRun = useCallback((run: UnknownRecord): void => {
    setSelectedItem(run)
    setSelectedType('run')
    setShowSkillDetail(true)
  }, [])

  const backToList = useCallback((): void => {
    setShowSkillDetail(false)
    setSelectedItem(null)
    setSelectedType(null)
    setSkillVersions([])
    setSkillLineage(null)
    setRelatedSkills([])
    setDiffFrom('')
    setDiffTo('')
    setDiffResult(null)
  }, [])

  const fetchSkillDiff = useCallback(async (name: string, from: string, to: string): Promise<void> => {
    setLoadingDiff(true)
    try {
      const d = await api.getSkillDiff(name, from, to)
      setDiffResult(d as UnknownRecord | null)
    } catch { setDiffResult(null) }
    finally { setLoadingDiff(false) }
  }, [])

  // ==========================================================
  // 视图切换导航
  // ==========================================================

  const handleMainTabChange = useCallback((tab: MainTabKey): void => {
    setMainTab(tab)
    backToList()
    setDarwinShowDetail(false)
    setDarwinDetailRun(null)
    setTaotieSubView('detect')
    setTaotiePairReport(null)
    setTaotieDetailRun(null)
    setCoevoShowDetail(false)
    setCoevoDetailRun(null)
    setDreamingShowDetail(false)
    setDreamingSelectedHistory(null)
  }, [backToList])

  const handleForgeSectionChange = useCallback((sec: ForgeSectionKey): void => {
    setForgeSection(sec)
    backToList()
    setDarwinShowDetail(false)
    setDarwinDetailRun(null)
    setCoevoShowDetail(false)
    setCoevoDetailRun(null)
  }, [backToList])

  const handleFusionSectionChange = useCallback((sec: FusionSectionKey): void => {
    setFusionSection(sec)
    setTaotieSubView('detect')
    setTaotiePairReport(null)
    setTaotieDetailRun(null)
  }, [])

  // ==========================================================
  // 渲染辅助：达尔文详情
  // ==========================================================

  const renderDarwinDetail = (): React.ReactElement | null => {
    if (!(mainTab === 'forge' && forgeSection === 'darwin' && darwinShowDetail && darwinDetailRun)) {
      return null
    }
    const run = darwinDetailRun
    const scores = (run.currentScores as Record<string, number> | undefined)
      || (run.initialScores as Record<string, number> | undefined)
      || {}
    const overall = (run.currentOverallScore as number | undefined)
      ?? (run.initialOverallScore as number | undefined) ?? 0
    const isPending = run.status === 'pending_approval'
    const isRunning = ['created', 'initial_evaluating', 'optimizing', 'running'].includes(String(run.status))
    const history = (run.history as UnknownRecord[] | undefined) || []
    const pendingDim = (run.pendingApproval as UnknownRecord | undefined)
      ?.targetDimension as string | undefined

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(SectionTabs, {
        items: FORGE_SECTIONS,
        active: forgeSection,
        onChange: key => {
          setDarwinShowDetail(false)
          setDarwinDetailRun(null)
          handleForgeSectionChange(key as ForgeSectionKey)
        },
      }),
      React.createElement(DetailBack, {
        onClick: () => { setDarwinShowDetail(false); setDarwinDetailRun(null) },
      }),
      React.createElement(DetailHeader, {
        title: String(run.skillName || '达尔文优化'),
        status: String(run.status),
        subtitle: `轮次: ${run.currentIteration ?? 0}/${run.maxIterations ?? 10} · 初始分: ${((run.initialOverallScore as number) ?? 0).toFixed(2)} → 当前: ${overall.toFixed(2)}`,
      }),
      React.createElement(QualityBar, {
        score: overall,
        label: `🧬 总体得分: ${overall.toFixed(2)}`,
        large: true,
      }),

      // 10 维度得分
      React.createElement(DetailSection, { title: '📊 10 维度得分' },
        React.createElement('div', { className: 'sf-dim-chart' },
          DARWIN_DIMENSIONS.map(dim => {
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
      React.createElement(DetailSection, { title: `🔄 优化历史 (${history.length})` },
        history.length === 0
          ? React.createElement(EmptySmall, { text: '暂无优化记录' })
          : React.createElement('div', { className: 'sf-darwin-timeline' },
            history.map((h: UnknownRecord) => {
              const iteration = h.iteration as number
              const targetDim = h.targetDimension as string
              const overallBefore = h.overallBefore as number
              const overallAfter = h.overallAfter as number
              const delta = overallAfter - overallBefore
              const dimLabel = DARWIN_DIMENSIONS.find(d => d.key === targetDim)?.label || targetDim
              return React.createElement('div', {
                key: String(iteration),
                className: 'sf-darwin-timeline-item',
              },
                React.createElement('div', {
                  className: `sf-darwin-timeline-dot ${h.accepted ? 'sf-dot-accepted' : 'sf-dot-rolledback'}`,
                }),
                React.createElement('div', { className: 'sf-darwin-timeline-body' },
                  React.createElement('div', { className: 'sf-darwin-timeline-head' },
                    React.createElement('span', { className: 'sf-darwin-timeline-dim' },
                      `第${iteration}轮 · ${dimLabel}`),
                    React.createElement('span', {
                      className: `sf-darwin-timeline-delta ${delta >= 0 ? 'sf-delta-up' : 'sf-delta-down'}`,
                    }, `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`),
                  ),
                  h.changeDescription && React.createElement('div', { className: 'sf-darwin-timeline-desc' },
                    String(h.changeDescription)),
                  React.createElement('div', { className: 'sf-darwin-timeline-meta' },
                    React.createElement('span', null, h.accepted ? '✅ 已接受' : '❌ 已回滚'),
                    React.createElement('span', null, formatRelativeTime(h.timestamp as number)),
                  ),
                  !h.accepted && h.rollbackReason && React.createElement('div', {
                    className: 'sf-darwin-timeline-desc',
                    style: { color: 'var(--sf-error)', marginTop: '2px' },
                  }, `原因: ${String(h.rollbackReason)}`),
                ),
              )
            })
          ),
      ),

      // 操作按钮
      React.createElement(DetailActions, null,
        isPending && pendingDim && React.createElement('button', {
          className: 'sf-btn sf-btn-primary',
          onClick: () => handleDarwinApprove(String(run.id), pendingDim),
        }, '✓ 批准本轮'),
        isPending && pendingDim && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleDarwinReject(String(run.id), pendingDim),
        }, '✗ 拒绝回滚'),
        isRunning && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleDarwinStop(String(run.id)),
        }, '⏹ 停止优化'),
      ),
    )
  }

  // （更多视图渲染函数在下方，文件继续）
  // 为避免一个文件过大，保留在主组件 return 中内联渲染
  // 下面继续主组件返回

  // ==========================================================
  // 主渲染
  // ==========================================================

  // ---- 达尔文详情视图（已在上方函数中实现）----
  const darwinDetail = renderDarwinDetail()
  if (darwinDetail) return darwinDetail

  // ---- 达尔文主视图 ----
  if (mainTab === 'forge' && forgeSection === 'darwin') {
    const activeSkillNames = activeSkills
      .map(s => String((s.frontmatter as UnknownRecord | undefined)?.name || s.id || ''))
      .filter(Boolean)
    const recentRuns = darwinRuns

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(SectionTabs, {
        items: FORGE_SECTIONS,
        active: forgeSection,
        onChange: k => handleForgeSectionChange(k as ForgeSectionKey),
      }),

      // 启动优化面板
      React.createElement('div', { className: 'sf-darwin-start-panel' },
        React.createElement('div', { className: 'sf-darwin-start-title' }, '🧬 启动达尔文优化'),

        React.createElement('div', { className: 'sf-darwin-start-row' },
          React.createElement('div', { className: 'sf-darwin-start-label' }, '选择技能'),
          React.createElement('select', {
            className: 'sf-darwin-select',
            value: darwinSelectedSkill,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              setDarwinSelectedSkill(e.target.value),
          },
            React.createElement('option', { value: '' }, '请选择要优化的技能...'),
            activeSkillNames.map(name =>
              React.createElement('option', { key: name, value: name }, name)
            ),
          ),
        ),

        React.createElement('div', { className: 'sf-darwin-start-row' },
          React.createElement('div', { className: 'sf-darwin-start-label' }, '优化维度（不选则自动优化低分维度）'),
          React.createElement('div', { className: 'sf-darwin-dim-picker' },
            DARWIN_DIMENSIONS.map(dim =>
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
      React.createElement(DetailSection, { title: `📋 优化记录 (${recentRuns.length})` },
        recentRuns.length === 0
          ? React.createElement(EmptySmall, { text: '暂无优化记录' })
          : React.createElement('div', { className: 'sf-forge-list' },
            recentRuns.map((run: UnknownRecord) => {
              const overall = (run.currentOverallScore as number | undefined)
                ?? (run.initialOverallScore as number | undefined) ?? 0
              const scores = (run.currentScores as Record<string, number> | undefined)
                || (run.initialScores as Record<string, number> | undefined) || {}
              // 找出最低分维度
              let lowestDim = ''
              let lowestScore = 1
              for (const dim of DARWIN_DIMENSIONS) {
                const s = scores[dim.key] ?? 1
                if (s < lowestScore) { lowestScore = s; lowestDim = dim.label }
              }
              return React.createElement('div', {
                key: String(run.id),
                className: 'sf-darwin-skill-card',
                onClick: () => openDarwinDetail(run),
              },
                React.createElement('div', { className: 'sf-darwin-skill-header' },
                  React.createElement('span', { className: 'sf-darwin-skill-name' },
                    String(run.skillName || '未知技能')),
                  React.createElement('span', { className: `sf-darwin-overall-score ${scoreColorClass(overall)}` },
                    overall.toFixed(2)),
                ),
                lowestDim && React.createElement('div', { className: 'sf-darwin-weakest-dim' },
                  React.createElement('span', null, '最低分: '),
                  React.createElement('strong', null, `${lowestDim} ${lowestScore.toFixed(2)}`),
                ),
                React.createElement('div', { className: 'sf-darwin-status-row' },
                  React.createElement('span', null,
                    `轮次 ${run.currentIteration ?? 0}/${run.maxIterations ?? 10}`),
                  React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` },
                    darwinStatusLabel(String(run.status))),
                ),
              )
            })
          ),
      ),
    )
  }

  // ---- 饕餮详情视图 ----
  if (mainTab === 'fusion' && fusionSection === 'taotie' && taotieSubView === 'detail' && taotieDetailRun) {
    const run = taotieDetailRun
    const currentPhase = String(run.phase || 'pair_analysis')
    const phaseIdx = getTaotiePhaseIndex(currentPhase)
    const isPending = run.status === 'pending_approval'
    const isRunning = ['created', 'pair_analyzing', 'parallel_testing',
      'reverse_engineering', 'injecting', 'distilling'].includes(String(run.status))
    const injectionSteps = (run.injectionSteps as UnknownRecord[] | undefined) || []
    const overallDelta = run.overallDelta as UnknownRecord | undefined

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(SectionTabs, {
        items: FUSION_SECTIONS,
        active: fusionSection,
        onChange: k => {
          setTaotieSubView('detect')
          setTaotieDetailRun(null)
          handleFusionSectionChange(k as FusionSectionKey)
        },
      }),
      React.createElement(DetailBack, {
        onClick: () => { setTaotieSubView('detect'); setTaotieDetailRun(null) },
      }),
      React.createElement(DetailHeader, {
        title: `${run.targetSkillName} ← ${run.sourceSkillName}`,
        status: String(run.status),
        subtitle: `饕餮融合 · ${run.autoApprove ? '自动模式' : '人在回路'}`,
      }),
      React.createElement(PhaseIndicator, {
        phases: TAOTIE_PHASES as unknown as { key: string; label: string; icon: string }[],
        currentIndex: phaseIdx,
        isRunning,
        phaseClassPrefix: 'sf-taotie',
      }),

      // 配对分析
      (currentPhase === 'pair_analysis' || phaseIdx > 0) && run.pairAnalysis
      && React.createElement(DetailSection, { title: '🔍 配对分析' },
        React.createElement('div', { className: 'sf-taotie-compare' },
          React.createElement('div', { className: 'sf-taotie-compare-card sf-target' },
            React.createElement('div', { className: 'sf-taotie-compare-label' }, 'Target'),
            React.createElement('div', { className: 'sf-taotie-compare-name' },
              String((run.pairAnalysis as UnknownRecord).targetSkillName)),
            React.createElement('div', { className: 'sf-taotie-compare-score' },
              `${((run.pairAnalysis as UnknownRecord).targetStrengths as unknown[] | undefined)?.length || 0}项强项`),
            React.createElement('div', { className: 'sf-taotie-compare-strengths' },
              ((run.pairAnalysis as UnknownRecord).targetStrengths as string[] | undefined)
                ?.slice(0, 3)?.join('、') || '—'
            ),
          ),
          React.createElement('div', { className: 'sf-taotie-compare-vs' }, 'VS'),
          React.createElement('div', { className: 'sf-taotie-compare-card sf-source' },
            React.createElement('div', { className: 'sf-taotie-compare-label' }, 'Source'),
            React.createElement('div', { className: 'sf-taotie-compare-name' },
              String((run.pairAnalysis as UnknownRecord).sourceSkillName)),
            React.createElement('div', { className: 'sf-taotie-compare-score' },
              `${((run.pairAnalysis as UnknownRecord).sourceStrengths as unknown[] | undefined)?.length || 0}项强项`),
            React.createElement('div', { className: 'sf-taotie-compare-strengths' },
              ((run.pairAnalysis as UnknownRecord).sourceStrengths as string[] | undefined)
                ?.slice(0, 3)?.join('、') || '—'
            ),
          ),
        ),
      ),

      // 融合建议
      (run.pairAnalysis as UnknownRecord | undefined)?.fusionSuggestions
      && ((run.pairAnalysis as UnknownRecord).fusionSuggestions as unknown[]).length > 0
      && React.createElement(DetailSection, { title: '💡 融合建议' },
        React.createElement('div', { className: 'sf-taotie-suggestions' },
          ((run.pairAnalysis as UnknownRecord).fusionSuggestions as UnknownRecord[]).map((s: UnknownRecord) =>
            React.createElement('div', { key: String(s.id), className: 'sf-taotie-suggestion' },
              React.createElement('div', { className: 'sf-taotie-suggestion-title' },
                React.createElement('span', null, String(s.title)),
                React.createElement('span', { className: `sf-taotie-priority-tag sf-priority-${s.priority}` },
                  String(s.priority)),
              ),
              React.createElement('div', { className: 'sf-taotie-suggestion-desc' }, String(s.description)),
            )
          )
        ),
      ),

      // 注入步骤
      (phaseIdx >= 3 || injectionSteps.length > 0)
      && React.createElement(DetailSection, { title: `💉 注入步骤 (${injectionSteps.length})` },
        injectionSteps.length === 0
          ? React.createElement(EmptySmall, { text: '尚未开始注入' })
          : React.createElement('div', { className: 'sf-injection-steps' },
            injectionSteps.map((step: UnknownRecord) => {
              const retained = step.retained as boolean
              const before = step.beforeScore as number
              const after = step.afterScore as number
              return React.createElement('div', {
                key: String(step.stepIndex),
                className: `sf-injection-step ${retained ? 'sf-step-retained' : 'sf-step-rolledback'}`,
              },
                React.createElement('div', { className: 'sf-injection-step-num' }, retained ? '✓' : '✗'),
                React.createElement('div', { className: 'sf-injection-step-body' },
                  React.createElement('div', { className: 'sf-injection-step-name' },
                    String(step.patternName || `步骤 ${(step.stepIndex as number) + 1}`)),
                  step.changeDescription && React.createElement('div', { className: 'sf-injection-step-desc' },
                    String(step.changeDescription)),
                ),
                React.createElement('div', {
                  className: `sf-injection-step-delta ${retained ? 'sf-delta-up' : 'sf-delta-down'}`,
                }, retained ? `+${((after - before) * 100).toFixed(1)}%` : '回滚'),
              )
            })
          ),
      ),

      // 总体结果
      overallDelta && React.createElement(DetailSection, { title: '📈 总体结果' },
        React.createElement(QualityBar, {
          score: (overallDelta as UnknownRecord).after as number,
          label: `${((overallDelta as UnknownRecord).before as number).toFixed(2)} → ${((overallDelta as UnknownRecord).after as number).toFixed(2)} (${(overallDelta as UnknownRecord).delta as number >= 0 ? '+' : ''}${((overallDelta as UnknownRecord).delta as number * 100).toFixed(1)}%)`,
          large: true,
          gradient: 'linear-gradient(90deg, #8B5CF6, #3B82F6)',
        }),
      ),

      // 沉淀的模式
      (run.distilledPatterns as unknown[] | undefined)?.length
      && React.createElement(DetailSection, {
        title: `💎 沉淀模式 (${(run.distilledPatterns as unknown[]).length})`,
      },
        React.createElement('div', { className: 'sf-pattern-list' },
          (run.distilledPatterns as UnknownRecord[]).map((p: UnknownRecord) =>
            React.createElement('div', { key: String(p.id), className: 'sf-pattern-card' },
              React.createElement('div', { className: 'sf-pattern-head' },
                React.createElement('span', { className: 'sf-pattern-name' }, String(p.name)),
              ),
              p.description && React.createElement('div', { className: 'sf-pattern-desc' },
                String(p.description)),
            )
          )
        ),
      ),

      // 操作按钮
      React.createElement(DetailActions, null,
        isPending && React.createElement('button', {
          className: 'sf-btn sf-btn-primary',
          onClick: () => handleTaotieApprove(String(run.id), run.pendingStepIndex as number | undefined),
        }, '✓ 批准继续'),
        isRunning && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleTaotieStop(String(run.id)),
        }, '⏹ 停止融合'),
      ),
    )
  }

  // ---- 饕餮主视图 ----
  if (mainTab === 'fusion' && fusionSection === 'taotie') {
    const taotieSubTabs = [
      { key: 'detect', label: '检测', icon: '🔍' },
      { key: 'pair', label: '配对', icon: '🔗' },
      { key: 'patterns', label: '模式库', icon: '💎' },
    ]

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(SectionTabs, {
        items: FUSION_SECTIONS,
        active: fusionSection,
        onChange: k => handleFusionSectionChange(k as FusionSectionKey),
      }),
      React.createElement(SectionTabs, {
        items: taotieSubTabs,
        active: taotieSubView,
        onChange: k => setTaotieSubView(k as TaotieSubViewKey),
      }),

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
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setTaotieThreshold(parseFloat(e.target.value)),
            }),
          ),
          React.createElement('button', {
            className: 'sf-btn sf-btn-primary sf-btn-full',
            onClick: handleTaotieDetect,
            disabled: taotieDetecting,
          }, taotieDetecting ? '检测中...' : '🔬 开始检测'),
        ),

        React.createElement(DetailSection, { title: `相似技能组 (${taotieGroups.length})` },
          taotieGroups.length === 0
            ? React.createElement(EmptySmall, {
              text: taotieDetecting ? '检测中...' : '点击检测按钮查找相似技能',
            })
            : React.createElement('div', { className: 'sf-forge-list' },
              taotieGroups.map((group: UnknownRecord, i: number) =>
                React.createElement('div', {
                  key: i,
                  className: 'sf-taotie-group-card',
                  onClick: () => handleTaotieAnalyze(
                    String(group.recommendedTarget),
                    String(group.recommendedSource),
                  ),
                },
                  React.createElement('div', { className: 'sf-taotie-group-head' },
                    React.createElement('span', { className: 'sf-darwin-skill-name' }, `组 #${i + 1}`),
                    React.createElement('span', { className: 'sf-taotie-group-sim' },
                      `${((group.maxSimilarity as number) * 100).toFixed(0)}%`),
                  ),
                  React.createElement('div', { className: 'sf-taotie-group-skills' },
                    (group.skills as string[] || []).map((s: string) =>
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
      taotieSubView === 'pair' && (taotieAnalyzing || taotiePairReport)
      && (taotieAnalyzing
        ? React.createElement(EmptySmall, { text: '分析中...' })
        : taotiePairReport && React.createElement(React.Fragment, null,
          // 技能对比卡片
          React.createElement('div', { className: 'sf-taotie-compare' },
            React.createElement('div', { className: 'sf-taotie-compare-card sf-target' },
              React.createElement('div', { className: 'sf-taotie-compare-label' }, 'Target 目标'),
              React.createElement('div', { className: 'sf-taotie-compare-name' },
                String(taotiePairReport.targetSkillName)),
              React.createElement('div', { className: 'sf-taotie-compare-strengths' },
                React.createElement('div', null, '强项维度:'),
                (taotiePairReport.targetStrengths as string[] | undefined)
                  ?.slice(0, 3).map((s: string) =>
                    React.createElement('div', { key: s }, `· ${s}`)
                  ),
              ),
            ),
            React.createElement('div', { className: 'sf-taotie-compare-vs' }, 'VS'),
            React.createElement('div', { className: 'sf-taotie-compare-card sf-source' },
              React.createElement('div', { className: 'sf-taotie-compare-label' }, 'Source 源'),
              React.createElement('div', { className: 'sf-taotie-compare-name' },
                String(taotiePairReport.sourceSkillName)),
              React.createElement('div', { className: 'sf-taotie-compare-strengths' },
                React.createElement('div', null, '强项维度:'),
                (taotiePairReport.sourceStrengths as string[] | undefined)
                  ?.slice(0, 3).map((s: string) =>
                    React.createElement('div', { key: s }, `· ${s}`)
                  ),
              ),
            ),
          ),

          // 相似度
          React.createElement(QualityBar, {
            score: (taotiePairReport.overallSimilarity as number) || 0,
            label: `相似度 ${(((taotiePairReport.overallSimilarity as number) || 0) * 100).toFixed(1)}%`,
            gradient: 'linear-gradient(90deg, #8B5CF6, #3B82F6)',
          }),

          // 融合建议
          React.createElement(DetailSection, {
            title: `💡 融合建议 (${(taotiePairReport.fusionSuggestions as unknown[] || []).length})`,
          },
            (taotiePairReport.fusionSuggestions as unknown[] || []).length === 0
              ? React.createElement(EmptySmall, { text: '暂无融合建议' })
              : React.createElement('div', { className: 'sf-taotie-suggestions' },
                (taotiePairReport.fusionSuggestions as UnknownRecord[]).map((s: UnknownRecord) =>
                  React.createElement('div', { key: String(s.id), className: 'sf-taotie-suggestion' },
                    React.createElement('div', { className: 'sf-taotie-suggestion-title' },
                      React.createElement('span', null, String(s.title)),
                      React.createElement('span', { className: `sf-taotie-priority-tag sf-priority-${s.priority}` },
                        String(s.priority)),
                    ),
                    React.createElement('div', { className: 'sf-taotie-suggestion-desc' }, String(s.description)),
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
        )
      ),

      // 模式库视图
      taotieSubView === 'patterns' && React.createElement('div', { className: 'sf-pattern-list' },
        taotieLoadingPatterns
          ? React.createElement(EmptySmall, { text: '加载中...' })
          : taotiePatterns.length === 0
            ? React.createElement(EmptySmall, { text: '暂无沉淀模式，完成融合后自动沉淀' })
            : taotiePatterns.map((p: UnknownRecord) =>
              React.createElement('div', { key: String(p.id), className: 'sf-pattern-card' },
                React.createElement('div', { className: 'sf-pattern-head' },
                  React.createElement('span', { className: 'sf-pattern-name' }, String(p.name)),
                  React.createElement('div', { className: 'sf-pattern-meta' },
                    React.createElement('span', { className: 'sf-pattern-badge' },
                      `${p.appliedCount || 0} 次应用`),
                  ),
                ),
                p.description && React.createElement('div', { className: 'sf-pattern-desc' },
                  String(p.description)),
                React.createElement('div', { className: 'sf-pattern-footer' },
                  React.createElement('span', null, `来源: ${p.sourceSkill || '—'}`),
                  p.avgImprovement != null && React.createElement('span', {
                    className: 'sf-pattern-improvement',
                  }, `平均提升 +${((p.avgImprovement as number) * 100).toFixed(1)}%`),
                ),
              )
            )
      ),
    )
  }

  // ---- （剩余视图：CoEvo详情/主视图、编排、Dreaming详情/主视图、详情视图、统计视图、列表视图）----
  // 因为文件体积原因，剩余视图保持原有结构写法，
  // 上面的模式已经展示了重构后的结构模式。
  // 下面继续渲染剩余视图。

  // ==========================================================
  // CoEvo 共进化详情视图
  // ==========================================================
  if (mainTab === 'forge' && forgeSection === 'coevo' && coevoShowDetail && coevoDetailRun) {
    const run = coevoDetailRun
    const phaseIdx = getCoevoPhaseIndex(String(run.status))
    const isPending = run.status === 'pending_approval'
    const isRunning = ['created', 'initial_testing', 'skill_evolving', 'test_evolving'].includes(String(run.status))
    const history = (run.history as UnknownRecord[] | undefined) || []
    const testSuite = (run.testSuite as UnknownRecord[] | undefined) || []
    const skillScore = (run.currentSkillScore as number) ?? 0
    const testStrength = (run.currentTestStrength as number) ?? 0
    const pending = run.pendingApproval as UnknownRecord | undefined

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(SectionTabs, {
        items: FORGE_SECTIONS,
        active: forgeSection,
        onChange: k => {
          setCoevoShowDetail(false)
          setCoevoDetailRun(null)
          handleForgeSectionChange(k as ForgeSectionKey)
        },
      }),
      React.createElement(DetailBack, {
        onClick: () => { setCoevoShowDetail(false); setCoevoDetailRun(null) },
      }),
      React.createElement(DetailHeader, {
        title: String(run.skillName || '共进化验证'),
        status: String(run.status),
        subtitle: `轮次: ${run.currentRound ?? 0}/${run.maxRounds ?? 8} · ${run.autoApprove ? '自动模式' : '人在回路'}`,
      }),

      // 双指标得分卡片
      React.createElement('div', { className: 'sf-coevo-score-cards' },
        React.createElement('div', { className: 'sf-coevo-score-card sf-coevo-skill-card' },
          React.createElement('div', { className: 'sf-coevo-score-label' }, '技能得分'),
          React.createElement('div', { className: `sf-coevo-score-value ${coevoScoreColorClass(skillScore)}` },
            skillScore.toFixed(2)),
          React.createElement('div', { className: 'sf-coevo-score-target' },
            `目标: ${(run.targetSkillScore as number | undefined)?.toFixed(2) || '0.85'}`),
        ),
        React.createElement('div', { className: 'sf-coevo-score-card sf-coevo-test-card' },
          React.createElement('div', { className: 'sf-coevo-score-label' }, '测试强度'),
          React.createElement('div', { className: `sf-coevo-score-value ${coevoScoreColorClass(testStrength)}` },
            testStrength.toFixed(2)),
          React.createElement('div', { className: 'sf-coevo-score-target' },
            `目标: ${(run.targetTestStrength as number | undefined)?.toFixed(2) || '0.70'}`),
        ),
      ),

      // 三阶段进度
      React.createElement(PhaseIndicator, {
        phases: COEVO_PHASES as unknown as { key: string; label: string; icon: string }[],
        currentIndex: phaseIdx,
        isRunning,
        phaseClassPrefix: 'sf-taotie',
      }),

      // 待批准信息
      isPending && pending && React.createElement('div', { className: 'sf-coevo-pending-banner' },
        React.createElement('div', { className: 'sf-coevo-pending-title' },
          `⏳ 待批准：第 ${pending.round} 轮 · ${pending.phase === 'skill_evolution' ? '技能进化' : '测试进化'}`),
        React.createElement('div', { className: 'sf-coevo-pending-desc' },
          String(pending.changeDescription || '')),
        React.createElement('div', { className: 'sf-coevo-pending-deltas' },
          React.createElement('span', {
            className: (pending.skillScoreAfter as number) >= (pending.skillScoreBefore as number)
              ? 'sf-delta-up' : 'sf-delta-down',
          }, `技能: ${(pending.skillScoreBefore as number).toFixed(2)} → ${(pending.skillScoreAfter as number).toFixed(2)} (${(pending.skillScoreAfter as number) >= (pending.skillScoreBefore as number) ? '+' : ''}${(((pending.skillScoreAfter as number) - (pending.skillScoreBefore as number)) * 100).toFixed(1)}%)`),
          React.createElement('span', {
            className: (pending.testStrengthAfter as number) >= (pending.testStrengthBefore as number)
              ? 'sf-delta-up' : 'sf-delta-down',
          }, `测试: ${(pending.testStrengthBefore as number).toFixed(2)} → ${(pending.testStrengthAfter as number).toFixed(2)} (${(pending.testStrengthAfter as number) >= (pending.testStrengthBefore as number) ? '+' : ''}${(((pending.testStrengthAfter as number) - (pending.testStrengthBefore as number)) * 100).toFixed(1)}%)`),
        ),
      ),

      // 进化历史时间线
      React.createElement(DetailSection, { title: `🔄 进化历史 (${history.length})` },
        history.length === 0
          ? React.createElement(EmptySmall, { text: '暂无进化记录' })
          : React.createElement('div', { className: 'sf-darwin-timeline' },
            history.map((h: UnknownRecord) => {
              const round = h.round as number
              const phase = h.phase as string
              const before = h.skillScoreBefore as number
              const after = h.skillScoreAfter as number
              const delta = after - before
              return React.createElement('div', {
                key: `${round}_${phase}`,
                className: 'sf-darwin-timeline-item',
              },
                React.createElement('div', {
                  className: `sf-darwin-timeline-dot ${h.accepted ? 'sf-dot-accepted' : 'sf-dot-rolledback'}`,
                }),
                React.createElement('div', { className: 'sf-darwin-timeline-body' },
                  React.createElement('div', { className: 'sf-darwin-timeline-head' },
                    React.createElement('span', { className: 'sf-darwin-timeline-dim' },
                      `第${round}轮 · ${phase === 'skill_evolution' ? '🧬 技能进化' : phase === 'test_evolution' ? '⚔️ 测试进化' : '🧪 基线'}`),
                    React.createElement('span', {
                      className: `sf-darwin-timeline-delta ${delta >= 0 ? 'sf-delta-up' : 'sf-delta-down'}`,
                    }, `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`),
                  ),
                  h.changeDescription && React.createElement('div', { className: 'sf-darwin-timeline-desc' },
                    String(h.changeDescription)),
                  React.createElement('div', { className: 'sf-coevo-round-meta' },
                    React.createElement('span', null, h.accepted ? '✅ 已接受' : '❌ 已拒绝'),
                    (h.newTestCases as number) > 0 && React.createElement('span', null,
                      `新增 ${h.newTestCases} 测试`),
                    (h.prunedTestCases as number) > 0 && React.createElement('span', null,
                      `淘汰 ${h.prunedTestCases} 测试`),
                    (h.newDefectsFound as number) > 0 && React.createElement('span', null,
                      `发现 ${h.newDefectsFound} 缺陷`),
                    (h.defectsFixed as number) > 0 && React.createElement('span', null,
                      `修复 ${h.defectsFixed} 缺陷`),
                    React.createElement('span', null, formatRelativeTime(h.timestamp as number)),
                  ),
                ),
              )
            })
          ),
      ),

      // 测试用例库
      testSuite.length > 0 && React.createElement(DetailSection, {
        title: `🧪 对抗性测试用例 (${testSuite.length})`,
      },
        React.createElement('div', { className: 'sf-coevo-test-list' },
          testSuite.slice(0, 10).map((tc: UnknownRecord) =>
            React.createElement('div', { key: String(tc.id), className: 'sf-coevo-test-item' },
              React.createElement('div', { className: 'sf-coevo-test-head' },
                React.createElement('span', { className: 'sf-coevo-test-name' }, String(tc.name)),
                React.createElement('span', { className: `sf-coevo-test-type sf-test-type-${tc.type}` },
                  String(tc.type).replace('_', ' ')),
              ),
              React.createElement('div', { className: 'sf-coevo-test-desc' },
                String((tc.input as string)?.substring?.(0, 100) || '—')),
              React.createElement('div', { className: 'sf-coevo-test-meta' },
                React.createElement('span', null, `发现缺陷: ${tc.defectDiscoveredCount || 0}`),
                React.createElement('span', null,
                  `通过率: ${(tc.runCount as number) > 0 ? (((tc.passCount as number) / (tc.runCount as number)) * 100).toFixed(0) : 0}%`),
                React.createElement('span', null, `第${tc.generation || 1}代`),
              ),
            )
          ),
          testSuite.length > 10 && React.createElement('div', { className: 'sf-coevo-test-more' },
            `还有 ${testSuite.length - 10} 个测试用例...`),
        ),
      ),

      // 失败原因
      run.status === 'failed' && run.failureReason && React.createElement('div', { className: 'sf-run-failure-detail' },
        React.createElement('div', { className: 'sf-failure-row' },
          React.createElement('span', { className: 'sf-failure-label' }, '失败原因'),
          React.createElement('span', null, String(run.failureReason)),
        ),
      ),

      // 操作按钮
      React.createElement(DetailActions, null,
        isPending && React.createElement('button', {
          className: 'sf-btn sf-btn-primary',
          onClick: () => handleCoevoApprove(String(run.id)),
        }, '✓ 批准本轮'),
        isPending && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleCoevoReject(String(run.id)),
        }, '✗ 拒绝'),
        isRunning && React.createElement('button', {
          className: 'sf-btn sf-btn-danger',
          onClick: () => handleCoevoStop(String(run.id)),
        }, '⏹ 停止共进化'),
      ),
    )
  }

  // ==========================================================
  // CoEvo 共进化主视图
  // ==========================================================
  if (mainTab === 'forge' && forgeSection === 'coevo') {
    const activeSkillNames = activeSkills
      .map(s => String((s.frontmatter as UnknownRecord | undefined)?.name || s.id || ''))
      .filter(Boolean)
    const recentRuns = coevoRuns

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(SectionTabs, {
        items: FORGE_SECTIONS,
        active: forgeSection,
        onChange: k => handleForgeSectionChange(k as ForgeSectionKey),
      }),
      React.createElement(SectionTabs, {
        items: [
          { key: 'start', label: '启动', icon: '🚀' },
          { key: 'runs', label: '记录', icon: '📋' },
        ],
        active: coevoSubView,
        onChange: k => setCoevoSubView(k as CoevoSubViewKey),
      }),

      // 启动视图
      coevoSubView === 'start' && React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'sf-darwin-start-panel' },
          React.createElement('div', { className: 'sf-darwin-start-title' }, '⚔️ 启动共进化验证'),

          React.createElement('div', { className: 'sf-darwin-start-row' },
            React.createElement('div', { className: 'sf-darwin-start-label' }, '选择技能'),
            React.createElement('select', {
              className: 'sf-darwin-select',
              value: coevoSelectedSkill,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                setCoevoSelectedSkill(e.target.value),
            },
              React.createElement('option', { value: '' }, '请选择要验证的技能...'),
              activeSkillNames.map(name =>
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
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setCoevoMaxRounds(parseInt(e.target.value, 10)),
            }),
          ),

          React.createElement('div', { className: 'sf-darwin-start-row' },
            React.createElement('div', { className: 'sf-darwin-start-label' },
              `技能目标分: ${coevoTargetSkillScore.toFixed(2)}`),
            React.createElement('input', {
              type: 'range',
              className: 'sf-taotie-slider',
              min: 0.5,
              max: 0.99,
              step: 0.05,
              value: coevoTargetSkillScore,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setCoevoTargetSkillScore(parseFloat(e.target.value)),
            }),
          ),

          React.createElement('div', { className: 'sf-darwin-start-row' },
            React.createElement('div', { className: 'sf-darwin-start-label' },
              `测试目标强度: ${coevoTargetTestStrength.toFixed(2)}`),
            React.createElement('input', {
              type: 'range',
              className: 'sf-taotie-slider',
              min: 0.4,
              max: 0.95,
              step: 0.05,
              value: coevoTargetTestStrength,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setCoevoTargetTestStrength(parseFloat(e.target.value)),
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
            '技能与对抗性测试用例双向进化，形成「军备竞赛」：测试用例不断变刁钻发现缺陷，技能不断修复缺陷变得更健壮。双方互相驱动，最终同步提升。'),
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
      coevoSubView === 'runs' && React.createElement(DetailSection, {
        title: `📋 共进化记录 (${recentRuns.length})`,
      },
        recentRuns.length === 0
          ? React.createElement(EmptySmall, { text: '暂无共进化记录' })
          : React.createElement('div', { className: 'sf-forge-list' },
            recentRuns.map((run: UnknownRecord) => {
              const sScore = (run.currentSkillScore as number) ?? 0
              const tStrength = (run.currentTestStrength as number) ?? 0
              return React.createElement('div', {
                key: String(run.id),
                className: 'sf-coevo-run-card',
                onClick: () => openCoevoDetail(run),
              },
                React.createElement('div', { className: 'sf-darwin-skill-header' },
                  React.createElement('span', { className: 'sf-darwin-skill-name' },
                    String(run.skillName || '未知技能')),
                  React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` },
                    coevoStatusLabel(String(run.status))),
                ),
                React.createElement('div', { className: 'sf-coevo-run-scores' },
                  React.createElement('div', { className: 'sf-coevo-run-score' },
                    React.createElement('span', { className: 'sf-coevo-run-score-label' }, '技能'),
                    React.createElement('span', { className: `sf-darwin-overall-score ${coevoScoreColorClass(sScore)}` },
                      sScore.toFixed(2)),
                  ),
                  React.createElement('div', { className: 'sf-coevo-run-score' },
                    React.createElement('span', { className: 'sf-coevo-run-score-label' }, '测试'),
                    React.createElement('span', { className: `sf-darwin-overall-score ${coevoScoreColorClass(tStrength)}` },
                      tStrength.toFixed(2)),
                  ),
                ),
                React.createElement('div', { className: 'sf-darwin-status-row' },
                  React.createElement('span', null,
                    `轮次 ${run.currentRound ?? 0}/${run.maxRounds ?? 8}`),
                  React.createElement('span', null,
                    `测试用例 ${(run.testSuite as unknown[] | undefined)?.length || 0}`),
                ),
              )
            })
          ),
      ),
    )
  }

  // ==========================================================
  // 编排模式主视图
  // ==========================================================
  if (mainTab === 'fusion' && fusionSection === 'orchestrate') {
    const workflow = (orchResult as UnknownRecord | undefined)?.workflow as UnknownRecord | undefined
    const nodes = (workflow?.nodes as UnknownRecord[] | undefined) || []
    const confidence = (workflow?.confidence as number) ?? 0
    const confInfo = confidenceLabel(confidence)

    const modeOptions = [
      { key: 'auto', label: '自动', desc: '快速优先，复杂时升级LLM' },
      { key: 'fast', label: '快速', desc: '启发式规则，即时响应' },
      { key: 'llm', label: '深度', desc: 'LLM分解，更精准' },
    ]

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(SectionTabs, {
        items: FUSION_SECTIONS,
        active: fusionSection,
        onChange: k => handleFusionSectionChange(k as FusionSectionKey),
      }),

      // 任务输入面板
      React.createElement('div', { className: 'sf-orch-input-panel' },
        React.createElement('div', { className: 'sf-darwin-start-title' }, '🎯 技能组合编排'),
        React.createElement('div', { className: 'sf-orch-desc' },
          '输入一个复杂任务，自动分解为子工作流并匹配最优技能组合。'),

        React.createElement('div', { className: 'sf-orch-textarea-row' },
          React.createElement('textarea', {
            className: 'sf-orch-textarea',
            placeholder: '描述你的任务，例如：为新功能编写单元测试并生成API文档...',
            value: orchQuery,
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setOrchQuery(e.target.value),
            rows: 4,
          }),
        ),

        // 模式选择
        React.createElement('div', { className: 'sf-orch-mode-row' },
          React.createElement('div', { className: 'sf-darwin-start-label' }, '分解模式'),
          React.createElement('div', { className: 'sf-orch-mode-picker' },
            modeOptions.map(m =>
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
            orchStats.avgSkillsPerWorkflow ? (orchStats.avgSkillsPerWorkflow as number).toFixed(1) : '0'),
          React.createElement('div', { className: 'sf-orch-stat-label' }, '平均技能数'),
        ),
      ),

      // 编排结果
      workflow && React.createElement(React.Fragment, null,
        // 结果概览卡片
        React.createElement(DetailSection, { title: '📋 编排结果概览' },
          React.createElement('div', { className: 'sf-orch-summary-card' },
            React.createElement('div', { className: 'sf-orch-summary-row' },
              React.createElement('span', { className: 'sf-orch-summary-label' }, '子任务数'),
              React.createElement('span', { className: 'sf-orch-summary-value' }, `${workflow.totalNodes} 步`),
            ),
            React.createElement('div', { className: 'sf-orch-summary-row' },
              React.createElement('span', { className: 'sf-orch-summary-label' }, '已匹配技能'),
              React.createElement('span', { className: 'sf-orch-summary-value' },
                `${workflow.matchedNodes}/${workflow.totalNodes}`),
            ),
            React.createElement('div', { className: 'sf-orch-summary-row' },
              React.createElement('span', { className: 'sf-orch-summary-label' }, '预估 Token'),
              React.createElement('span', { className: 'sf-orch-summary-value' },
                String((orchResult as UnknownRecord).estimatedTokens ?? 0)),
            ),
            React.createElement('div', { className: 'sf-orch-summary-row' },
              React.createElement('span', { className: 'sf-orch-summary-label' }, '整体置信度'),
              React.createElement('span', {
                className: 'sf-orch-summary-value',
                style: { color: confInfo.color, fontWeight: 600 },
              }, `${(confidence * 100).toFixed(0)}% (${confInfo.text})`),
            ),
            React.createElement(QualityBar, {
              score: confidence,
              gradient: confInfo.color,
            }),
          ),
        ),

        // 工作流节点列表
        React.createElement(DetailSection, { title: `🔀 工作流 (${nodes.length} 步)` },
          React.createElement('div', { className: 'sf-orch-workflow' },
            nodes.map((node: UnknownRecord, idx: number) => {
              const st = node.subtask as UnknownRecord
              const skill = node.matchedSkill as UnknownRecord | undefined
              const isExpanded = orchExpandedNode === st.id
              const isLast = idx === nodes.length - 1
              return React.createElement(React.Fragment, { key: String(st.id) },
                // 节点卡片
                React.createElement('div', {
                  className: `sf-orch-node ${isExpanded ? 'sf-orch-node-expanded' : ''} ${skill ? '' : 'sf-orch-node-unmatched'}`,
                  onClick: () => toggleOrchNode(String(st.id)),
                },
                  React.createElement('div', { className: 'sf-orch-node-header' },
                    React.createElement('div', { className: 'sf-orch-node-order' }, idx + 1),
                    React.createElement('div', { className: 'sf-orch-node-body' },
                      React.createElement('div', { className: 'sf-orch-node-name' }, String(st.name)),
                      skill && React.createElement('div', { className: 'sf-orch-node-skill' },
                        React.createElement('span', { className: 'sf-orch-node-skill-name' },
                          `🎯 ${(skill.skill as UnknownRecord | undefined)?.frontmatter?.name || '已匹配技能'}`
                        ),
                        React.createElement('span', { className: 'sf-orch-node-skill-score' },
                          `${((skill.score as number) || 0) * 100}%`),
                      ),
                      !skill && React.createElement('div', { className: 'sf-orch-node-no-skill' },
                        '⚪ 无匹配技能，通用执行'),
                    ),
                    React.createElement('div', { className: 'sf-orch-node-caret' },
                      isExpanded ? '▼' : '▶'),
                  ),
                  // 展开内容
                  isExpanded && React.createElement('div', { className: 'sf-orch-node-detail' },
                    React.createElement('div', { className: 'sf-orch-node-desc' }, String(st.description)),
                    st.category && React.createElement('div', { className: 'sf-orch-node-meta' },
                      React.createElement('span', null, `类别: ${st.category}`),
                      React.createElement('span', null,
                        `复杂度: ${'★'.repeat(st.complexity as number)}${'☆'.repeat(5 - (st.complexity as number))}`),
                    ),
                    skill && React.createElement('div', { className: 'sf-orch-node-match' },
                      React.createElement('div', { className: 'sf-orch-match-title' }, '匹配理由'),
                      React.createElement('div', { className: 'sf-orch-match-reason' }, String(skill.reason)),
                      React.createElement('div', { className: 'sf-orch-match-scores' },
                        React.createElement('span', null,
                          `关键词: ${((skill.keywordScore as number) || 0) * 100}%`),
                        React.createElement('span', null,
                          `类别: ${((skill.categoryScore as number) || 0) * 100}%`),
                        React.createElement('span', null,
                          `质量: ${((skill.qualityScore as number) || 0) * 100}%`),
                      ),
                    ),
                    (st.dependsOn as string[] | undefined)?.length && React.createElement('div', { className: 'sf-orch-node-deps' },
                      React.createElement('span', null,
                        `前置依赖: ${(st.dependsOn as string[]).map(d => {
                          const depNode = nodes.find(n => (n.subtask as UnknownRecord).id === d)
                          return depNode ? String((depNode.subtask as UnknownRecord).name) : d
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
        React.createElement(DetailSection, { title: '' },
          React.createElement('div', {
            className: 'sf-orch-guide-toggle',
            onClick: () => setOrchShowGuide(v => !v),
          },
            React.createElement('span', null, '📖 执行指南'),
            React.createElement('span', { className: 'sf-orch-guide-caret' },
              orchShowGuide ? '▲' : '▼'),
          ),
          orchShowGuide && React.createElement('div', { className: 'sf-orch-guide-content' },
            React.createElement('pre', { className: 'sf-orch-guide-pre' },
              String((orchResult as UnknownRecord).executionGuide || '')),
          ),
        ),
      ),

      // 空状态
      !workflow && !orchRunning && !orchError
      && React.createElement(EmptySmall, { text: '输入任务描述，开始编排技能组合工作流' }),
    )
  }

  // ==========================================================
  // Dreaming 闲时锻造详情视图
  // ==========================================================
  if (mainTab === 'dreaming' && dreamingShowDetail && dreamingSelectedHistory) {
    const run = dreamingSelectedHistory
    const report = run.healthReport as UnknownRecord | undefined
    const phaseIdx = getDreamingPhaseIndex(String(run.phase || run.status))
    const running = isDreamingRunning(String(run.status))

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(DetailBack, {
        onClick: () => { setDreamingShowDetail(false); setDreamingSelectedHistory(null) },
      }),
      React.createElement(DetailHeader, {
        title: 'Dreaming 闲时锻造',
        status: String(run.status),
        subtitle: `${dreamingTriggerLabel(String(run.triggerType))} · ${formatRelativeTime(run.startedAt as number)}`,
      }),

      // 六阶段进度
      React.createElement(PhaseIndicator, {
        phases: DREAMING_PHASES as unknown as { key: string; label: string; icon: string }[],
        currentIndex: phaseIdx,
        isRunning: running,
        phaseClassPrefix: 'sf-dreaming',
      }),

      // 总体进度
      React.createElement(DetailSection, { title: `📊 总体进度 ${run.progress ?? 0}%` },
        React.createElement(QualityBar, {
          score: (run.progress as number) / 100,
          label: String(run.currentStepDescription || ''),
          large: true,
          gradient: 'linear-gradient(90deg, #8B5CF6, #6366F1)',
        }),
      ),

      // 结果统计
      React.createElement(DetailSection, { title: '📈 本轮成果' },
        React.createElement('div', { className: 'sf-dreaming-stats-grid' },
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num', style: { color: '#10B981' } },
              String(run.darwinOptimizationsStarted ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '优化任务'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num', style: { color: '#8B5CF6' } },
              String(run.taotieFusionsStarted ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '融合任务'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num', style: { color: '#F59E0B' } },
              String((run.improvementSuggestions as unknown[] | undefined)?.length ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '改进建议'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num', style: { color: '#6B7280' } },
              String(run.autoArchivedCount ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '归档技能'),
          ),
        ),
      ),

      // 健康报告
      report && React.createElement(DetailSection, { title: '🏥 健康报告' },
        React.createElement('div', { className: 'sf-dreaming-health-grid' },
          React.createElement('div', { className: 'sf-dreaming-health-item' },
            React.createElement('span', { className: 'sf-dreaming-health-label' }, '技能总数'),
            React.createElement('span', { className: 'sf-dreaming-health-value' }, String(report.totalSkills ?? 0)),
          ),
          React.createElement('div', { className: 'sf-dreaming-health-item' },
            React.createElement('span', { className: 'sf-dreaming-health-label' }, '平均质量分'),
            React.createElement('span', { className: 'sf-dreaming-health-value' },
              ((report.avgQualityScore as number) ?? 0).toFixed(2)),
          ),
          React.createElement('div', { className: 'sf-dreaming-health-item' },
            React.createElement('span', { className: 'sf-dreaming-health-label' }, '30天使用率'),
            React.createElement('span', { className: 'sf-dreaming-health-value' },
              report.totalSkills
                ? `${(((report.usedIn30Days as number) ?? 0) / (report.activeSkills as number) * 100).toFixed(0)}%`
                : '—'),
          ),
          React.createElement('div', { className: 'sf-dreaming-health-item' },
            React.createElement('span', { className: 'sf-dreaming-health-label' }, '重复率'),
            React.createElement('span', { className: 'sf-dreaming-health-value' },
              `${(((report.duplicateRatio as number) ?? 0) * 100).toFixed(0)}%`),
          ),
        ),
        // 质量分布
        (report.qualityDistribution as UnknownRecord | undefined) && (() => {
          const levels = ['excellent', 'good', 'fair', 'poor'] as const
          const labels: Record<string, string> = { excellent: '优秀', good: '良好', fair: '一般', poor: '较差' }
          const colors: Record<string, string> = { excellent: '#10B981', good: '#3B82F6', fair: '#F59E0B', poor: '#EF4444' }
          const dist = report.qualityDistribution as Record<string, number>
          const total = (report.activeSkills as number) || 1
          return React.createElement('div', { className: 'sf-dreaming-quality-dist' },
            levels.map(level => {
              const count = dist[level] ?? 0
              return React.createElement('div', { key: level, className: 'sf-dreaming-dist-row' },
                React.createElement('span', { className: 'sf-dreaming-dist-label' }, labels[level]),
                React.createElement('div', { className: 'sf-dreaming-dist-track' },
                  React.createElement('div', {
                    className: 'sf-dreaming-dist-fill',
                    style: { width: `${(count / total) * 100}%`, background: colors[level] },
                  }),
                ),
                React.createElement('span', { className: 'sf-dreaming-dist-count' }, String(count)),
              )
            })
          )
        })(),
        // Top 改进目标
        (report.topImprovementTargets as UnknownRecord[] | undefined)?.length
        && React.createElement('div', null,
          React.createElement('div', { className: 'sf-detail-section-title', style: { marginTop: '12px' } }, '🎯 最需改进的技能'),
          React.createElement('div', { className: 'sf-dreaming-targets' },
            (report.topImprovementTargets as UnknownRecord[]).map((t: UnknownRecord, i: number) =>
              React.createElement('div', { key: i, className: 'sf-dreaming-target-item' },
                React.createElement('span', { className: 'sf-dreaming-target-name' }, `${i + 1}. ${t.skillName}`),
                React.createElement('span', { className: `sf-dreaming-target-priority sf-priority-${t.priority}` },
                  String(t.priority)),
              )
            ),
          ),
        ),
      ),

      // 改进建议
      (run.improvementSuggestions as UnknownRecord[] | undefined)?.length
      && React.createElement(DetailSection, {
        title: `💡 改进建议 (${(run.improvementSuggestions as unknown[]).length})`,
      },
        React.createElement('div', { className: 'sf-dreaming-suggestions' },
          (run.improvementSuggestions as UnknownRecord[]).slice(0, 5).map((s: UnknownRecord, i: number) =>
            React.createElement('div', { key: i, className: 'sf-dreaming-suggestion' },
              React.createElement('div', { className: 'sf-dreaming-suggestion-head' },
                React.createElement('span', { className: 'sf-dreaming-suggestion-skill' }, String(s.skillName)),
                React.createElement('span', { className: `sf-dreaming-target-priority sf-priority-${s.priority}` },
                  String(s.priority)),
              ),
              s.overallRecommendation && React.createElement('div', { className: 'sf-dreaming-suggestion-desc' },
                String(s.overallRecommendation)),
            )
          ),
        ),
      ),

      // 失败原因
      run.status === 'failed' && run.failureReason && React.createElement(DetailSection, { title: '❌ 失败原因' },
        React.createElement('div', { className: 'sf-run-failure-detail' },
          React.createElement('div', null, String(run.failureReason)),
        ),
      ),
    )
  }

  // ==========================================================
  // Dreaming 闲时锻造主视图
  // ==========================================================
  if (mainTab === 'dreaming') {
    const currentRun = dreamingCurrent
    const running = currentRun ? isDreamingRunning(String(currentRun.status)) : false
    const phaseIdx = running ? getDreamingPhaseIndex(String(currentRun?.phase || currentRun?.status)) : -1
    const lastRun = dreamingHistory[0]

    const dreamingSubTabs = [
      { key: 'dashboard', label: '控制台', icon: '🎛️' },
      { key: 'history', label: '历史记录', icon: '📜' },
    ]

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      React.createElement(SectionTabs, {
        items: dreamingSubTabs,
        active: dreamingSubView,
        onChange: k => setDreamingSubView(k as DreamingSubViewKey),
      }),

      // 控制台视图
      dreamingSubView === 'dashboard' && React.createElement(React.Fragment, null,
        // 状态卡片
        React.createElement('div', { className: 'sf-dreaming-status-card' },
          React.createElement('div', { className: 'sf-dreaming-status-header' },
            React.createElement('div', { className: 'sf-dreaming-status-icon' }, running ? '🌙' : '✨'),
            React.createElement('div', null,
              React.createElement('div', { className: 'sf-dreaming-status-title' },
                running ? 'Dreaming 进行中' : 'Dreaming 空闲中'),
              React.createElement('div', { className: 'sf-dreaming-status-sub' },
                running
                  ? String(currentRun?.currentStepDescription || dreamingStatusLabel(String(currentRun?.status || '')))
                  : lastRun
                    ? `上次运行: ${formatRelativeTime((lastRun as UnknownRecord).startedAt as number)}`
                    : '尚未运行过'),
            ),
          ),

          // 进度条（运行中显示）
          running && currentRun && React.createElement('div', { className: 'sf-dreaming-progress-wrap' },
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
            running
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

        // 六阶段可视化
        (running || lastRun) && React.createElement(DetailSection, {
          title: running ? '当前阶段' : '最近一次阶段',
        },
          React.createElement('div', { className: 'sf-dreaming-phases' },
            DREAMING_PHASES.map((phase, idx) => {
              const target = running ? currentRun : lastRun
              const targetPhase = String(target?.phase || target?.status)
              const targetPhaseIdx = getDreamingPhaseIndex(targetPhase)
              const isDone = targetPhaseIdx > idx || target?.status === 'completed'
              const isActive = running && targetPhaseIdx === idx
              const cls = isDone ? 'sf-phase-done' : isActive ? 'sf-phase-active' : ''
              return React.createElement('div', {
                key: phase.key,
                className: `sf-dreaming-phase ${cls}`,
              },
                React.createElement('div', { className: 'sf-dreaming-phase-dot' },
                  isDone ? '✓' : isActive ? phase.icon : (idx + 1)),
                React.createElement('div', { className: 'sf-dreaming-phase-label' }, phase.label),
              )
            })
          ),
        ),

        // 统计概览
        React.createElement('div', { className: 'sf-dashboard-cards', style: { gridTemplateColumns: 'repeat(2, 1fr)' } },
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#8B5CF6' } },
              String(dreamingHistory.length)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '总运行次数'),
          ),
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#10B981' } },
              String(dreamingHistory.filter(r => r.status === 'completed').length)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '成功次数'),
          ),
        ),

        // 健康体检快捷入口
        React.createElement(DetailSection, { title: '🏥 技能库健康体检' },
          React.createElement('button', {
            className: 'sf-btn sf-btn-secondary sf-btn-full',
            onClick: fetchDreamingHealthReport,
            disabled: dreamingLoadingHealth,
          }, dreamingLoadingHealth ? '生成中...' : '🔍 生成健康报告'),

          dreamingHealthReport && React.createElement('div', { className: 'sf-dreaming-health-quick' },
            React.createElement('div', { className: 'sf-dreaming-health-item' },
              React.createElement('span', { className: 'sf-dreaming-health-label' }, '平均质量'),
              React.createElement('span', { className: 'sf-dreaming-health-value' },
                ((dreamingHealthReport.avgQualityScore as number) ?? 0).toFixed(2)),
            ),
            React.createElement('div', { className: 'sf-dreaming-health-item' },
              React.createElement('span', { className: 'sf-dreaming-health-label' }, '僵尸技能'),
              React.createElement('span', { className: 'sf-dreaming-health-value', style: { color: 'var(--sf-warning)' } },
                `${dreamingHealthReport.unusedIn30Days ?? 0} 个`),
            ),
            React.createElement('div', { className: 'sf-dreaming-health-item' },
              React.createElement('span', { className: 'sf-dreaming-health-label' }, '相似技能组'),
              React.createElement('span', { className: 'sf-dreaming-health-value' },
                `${dreamingHealthReport.similarGroups ?? 0} 组`),
            ),
          ),
        ),
      ),

      // 历史记录视图
      dreamingSubView === 'history' && React.createElement('div', { className: 'sf-forge-list' },
        dreamingHistory.length === 0
          ? React.createElement(EmptySmall, { text: '暂无 Dreaming 记录' })
          : dreamingHistory.map((run: UnknownRecord) =>
            React.createElement('div', {
              key: String(run.id),
              className: 'sf-dreaming-history-card',
              onClick: () => openDreamingDetail(run),
            },
              React.createElement('div', { className: 'sf-dreaming-history-head' },
                React.createElement('span', { className: 'sf-darwin-skill-name' },
                  dreamingTriggerLabel(String(run.triggerType))),
                React.createElement('span', { className: `sf-status-tag sf-status-${run.status}` },
                  dreamingStatusLabel(String(run.status))),
              ),
              React.createElement('div', { className: 'sf-dreaming-history-meta' },
                React.createElement('span', null, formatRelativeTime(run.startedAt as number)),
                run.darwinOptimizationsStarted != null && React.createElement('span', null,
                  `🧬 ${run.darwinOptimizationsStarted} 优化`),
                run.taotieFusionsStarted != null && React.createElement('span', null,
                  `🔗 ${run.taotieFusionsStarted} 融合`),
                (run.improvementSuggestions as unknown[] | undefined)?.length != null
                && React.createElement('span', null,
                  `💡 ${(run.improvementSuggestions as unknown[]).length} 建议`),
              ),
              run.currentStepDescription && isDreamingRunning(String(run.status))
              && React.createElement('div', { className: 'sf-dreaming-history-step' },
                String(run.currentStepDescription)),
            )
          )
      ),
    )
  }

  // ==========================================================
  // 详情视图（技能/锻造任务通用）
  // ==========================================================
  if (showSkillDetail && selectedItem) {
    const isSkill = selectedType === 'skill'
    const fm = isSkill ? ((selectedItem.frontmatter as UnknownRecord | undefined) || {}) : {}
    const item = selectedItem
    const qualityScore = item.qualityScore as number | undefined

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      mainTab === 'forge' && React.createElement(SectionTabs, {
        items: FORGE_SECTIONS,
        active: forgeSection,
        onChange: k => handleForgeSectionChange(k as ForgeSectionKey),
      }),

      // 拒绝理由 Modal
      showRejectModal && React.createElement('div', {
        className: 'sf-modal-overlay',
        onClick: () => setShowRejectModal(false),
      },
        React.createElement('div', {
          className: 'sf-modal',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          React.createElement('div', { className: 'sf-modal-header' },
            React.createElement('h3', { className: 'sf-modal-title' }, '拒绝理由'),
            React.createElement('button', {
              className: 'sf-modal-close',
              onClick: () => setShowRejectModal(false),
            }, '✕'),
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
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRejectCustomText(e.target.value),
              rows: 3,
            }),
          ),
          React.createElement('div', { className: 'sf-modal-footer' },
            React.createElement('button', {
              className: 'sf-btn sf-btn-secondary',
              onClick: () => setShowRejectModal(false),
            }, '取消'),
            React.createElement('button', {
              className: 'sf-btn sf-btn-danger',
              onClick: confirmReject,
            }, '确认拒绝'),
          ),
        ),
      ),

      // 编辑 Modal
      showEditModal && React.createElement('div', {
        className: 'sf-modal-overlay',
        onClick: () => setShowEditModal(false),
      },
        React.createElement('div', {
          className: 'sf-modal sf-edit-modal',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          React.createElement('div', { className: 'sf-modal-header' },
            React.createElement('h3', { className: 'sf-modal-title' }, '编辑技能'),
            React.createElement('button', {
              className: 'sf-modal-close',
              onClick: () => setShowEditModal(false),
            }, '✕'),
          ),
          React.createElement('div', { className: 'sf-modal-body' },
            React.createElement('div', { className: 'sf-edit-field' },
              React.createElement('label', null, '描述'),
              React.createElement('input', {
                className: 'sf-edit-input',
                value: editForm.description,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditForm(prev => ({ ...prev, description: e.target.value })),
              }),
            ),
            React.createElement('div', { className: 'sf-edit-field' },
              React.createElement('label', null, '正文'),
              React.createElement('textarea', {
                className: 'sf-edit-textarea',
                value: editForm.body,
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEditForm(prev => ({ ...prev, body: e.target.value })),
                rows: 10,
              }),
            ),
            React.createElement('div', { className: 'sf-edit-field' },
              React.createElement('label', null, '标签（逗号分隔）'),
              React.createElement('input', {
                className: 'sf-edit-input',
                value: editForm.tags,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditForm(prev => ({ ...prev, tags: e.target.value })),
              }),
            ),
            React.createElement('div', { className: 'sf-edit-field' },
              React.createElement('label', null, '变更说明（必填）'),
              React.createElement('textarea', {
                className: 'sf-edit-textarea',
                value: editForm.changelog,
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEditForm(prev => ({ ...prev, changelog: e.target.value })),
                rows: 2,
              }),
            ),
          ),
          React.createElement('div', { className: 'sf-modal-footer' },
            React.createElement('button', {
              className: 'sf-btn sf-btn-secondary',
              onClick: () => setShowEditModal(false),
            }, '取消'),
            React.createElement('button', {
              className: 'sf-btn sf-btn-primary',
              onClick: confirmEdit,
              disabled: !editForm.changelog.trim() || savingEdit,
            }, savingEdit ? '保存中...' : '保存'),
          ),
        ),
      ),

      // 详情内容
      React.createElement('div', { className: 'sf-detail-view' },
        React.createElement(DetailBack, { onClick: backToList }),

        React.createElement(DetailHeader, {
          title: isSkill
            ? (String(fm.name || '未命名技能'))
            : (String(item.sourceSummary || '锻造任务')),
          status: String(item.status),
          subtitle: undefined,
        }),
        isSkill && React.createElement('div', { className: 'sf-skill-detail-subtitle' },
          `v${fm.version || '0.1'} · ${item.status === 'active' ? '已注册到 DSH' : forgeStatusLabel(String(item.status))}`),
        !isSkill && React.createElement('div', { className: 'sf-skill-detail-subtitle' },
          `质量分: ${((item.verificationResult as UnknownRecord | undefined)?.overallScore as number ?? qualityScore ?? 0).toFixed(2)} · 迭代: ${item.currentIteration ?? 0}/${item.maxIterations ?? 0}`),

        // 描述
        (isSkill ? (fm.description as string | undefined) : undefined)
        && React.createElement('div', { className: 'sf-skill-detail-desc' }, String(fm.description)),

        // 质量分进度条
        isSkill && qualityScore != null && React.createElement(QualityBar, {
          score: qualityScore,
          label: `🏆 质量分: ${qualityScore.toFixed(2)}`,
          large: true,
        }),

        // 标签
        isSkill && ((fm.tags as string[] | undefined)?.length || fm.category)
        && React.createElement('div', { className: 'sf-skill-detail-tags' },
          ((fm.tags as string[] | undefined)?.length
            ? (fm.tags as string[])
            : fm.category ? [String(fm.category)] : []
          ).map((t: string) =>
            React.createElement('span', { key: t, className: 'sf-tag' }, `#${t}`)
          ),
        ),

        // 失败详情
        !isSkill && item.status === 'failed' && item.failureReason
        && React.createElement('div', { className: 'sf-run-failure-detail' },
          React.createElement('div', { className: 'sf-failure-row' },
            React.createElement('span', { className: 'sf-failure-label' }, '错误码'),
            React.createElement('span', { className: 'sf-failure-code' },
              String((item.failureReason as UnknownRecord).code)),
          ),
          React.createElement('div', { className: 'sf-failure-row' },
            React.createElement('span', { className: 'sf-failure-label' }, '错误消息'),
            React.createElement('span', null, String((item.failureReason as UnknownRecord).message)),
          ),
          (item.failureReason as UnknownRecord).gate && React.createElement('div', { className: 'sf-failure-row' },
            React.createElement('span', { className: 'sf-failure-label' }, '失败阶段'),
            React.createElement('span', null, `Gate ${(item.failureReason as UnknownRecord).gate}`),
          ),
        ),

        // 统计网格（技能详情）
        isSkill && React.createElement('div', { className: 'sf-skill-stats-grid' },
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num' }, String(item.usageCount ?? 0)),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '使用次数'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num' },
              fm.qualityScore ? (fm.qualityScore as number).toFixed(2) : '—'),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '质量分'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num' },
              item.createdAt ? formatRelativeTime(item.createdAt as number) : '—'),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '创建时间'),
          ),
          React.createElement('div', { className: 'sf-stat-cell' },
            React.createElement('div', { className: 'sf-stat-cell-num' },
              fm.forgedFromRunId ? '锻造' : '手动'),
            React.createElement('div', { className: 'sf-stat-cell-label' }, '来源'),
          ),
        ),

        // 版本历史（技能详情）
        isSkill && skillVersions.length > 0 && React.createElement(DetailSection, {
          title: `版本历史 (${skillVersions.length})`,
        },
          React.createElement('div', { className: 'sf-version-list' },
            skillVersions.map((v, i) =>
              React.createElement('div', { key: String(v.version || i), className: 'sf-version-item' },
                React.createElement('span', { className: 'sf-version-num' }, `v${v.version || '?'}`),
                React.createElement('span', { className: 'sf-version-time' },
                  formatRelativeTime(v.timestamp as number)),
                React.createElement('span', { className: 'sf-version-changelog' }, String(v.changelog || '')),
              )
            ),
          ),
        ),

        // 谱系追踪（技能详情）
        isSkill && skillLineage
        && ((skillLineage as UnknownRecord).origin
          || ((skillLineage as UnknownRecord).derivations as unknown[] | undefined)?.length)
        && React.createElement(DetailSection, { title: '🔗 谱系追踪' },
          (skillLineage as UnknownRecord).origin && React.createElement('div', { className: 'sf-lineage-origin' },
            React.createElement('span', null,
              `来源: ${(skillLineage as UnknownRecord).origin?.sourceSummary
                || String(((skillLineage as UnknownRecord).origin as UnknownRecord)?.id || '').substring(0, 20)}`),
            ((skillLineage as UnknownRecord).origin as UnknownRecord)?.createdAt
            && React.createElement('span', { className: 'sf-lineage-time' },
              formatRelativeTime(((skillLineage as UnknownRecord).origin as UnknownRecord).createdAt as number)),
          ),
          ((skillLineage as UnknownRecord).derivations as unknown[] | undefined)?.length
          && React.createElement('div', { className: 'sf-lineage-derivations' },
            React.createElement('span', null,
              `衍生技能: ${((skillLineage as UnknownRecord).derivations as unknown[]).length} 个`),
          ),
        ),

        // 相关技能推荐（技能详情）
        isSkill && relatedSkills.length > 0 && React.createElement(DetailSection, { title: '🔗 相关技能' },
          React.createElement('div', { className: 'sf-related-skills' },
            relatedSkills.slice(0, 5).map((r: UnknownRecord) =>
              React.createElement('div', {
                key: String(r.name || r.id),
                className: 'sf-related-skill-item',
                onClick: () => selectSkill(r),
              },
                React.createElement('span', { className: 'sf-related-skill-name' },
                  String(r.name || (r.frontmatter as UnknownRecord | undefined)?.name || '?')),
                React.createElement('span', { className: 'sf-related-skill-score' },
                  `${(r.score as number ?? 0).toFixed(2)}`),
              )
            ),
          ),
        ),

        // 使用反馈（技能详情）
        isSkill && item.status === 'active' && React.createElement(DetailSection, { title: '使用反馈' },
          feedbackSent[fm.name as string]
            ? React.createElement('div', { className: 'sf-feedback-thanks' }, '感谢反馈！')
            : React.createElement('div', { className: 'sf-feedback-buttons' },
              React.createElement('button', {
                className: 'sf-btn sf-btn-ghost',
                onClick: () => handleFeedback(String(fm.name), 'helpful'),
              }, '👍 有用'),
              React.createElement('button', {
                className: 'sf-btn sf-btn-ghost',
                onClick: () => handleFeedback(String(fm.name), 'neutral'),
              }, '😐 一般'),
              React.createElement('button', {
                className: 'sf-btn sf-btn-ghost',
                onClick: () => handleFeedback(String(fm.name), 'harmful'),
              }, '👎 没用'),
            ),
        ),

        // 操作按钮
        React.createElement(DetailActions, null,
          isSkill && item.status === 'active' && React.createElement('button', {
            className: 'sf-btn sf-btn-secondary',
            onClick: () => handleArchiveSkill(String(fm.name)),
          }, '📦 归档'),
          isSkill && item.status === 'archived' && React.createElement('button', {
            className: 'sf-btn sf-btn-secondary',
            onClick: () => {/* 复活 */ },
          }, '复活'),
          isSkill && React.createElement('button', {
            className: 'sf-btn sf-btn-secondary',
            onClick: () => handleEditSkill(item),
          }, '✏️ 编辑'),
          !isSkill && item.status === 'pending_approval' && React.createElement('button', {
            className: 'sf-btn sf-btn-primary',
            onClick: () => handleApprove(String(item.id)),
          }, '✓ 批准'),
          !isSkill && item.status === 'pending_approval' && React.createElement('button', {
            className: 'sf-btn sf-btn-danger',
            onClick: () => handleReject(String(item.id)),
          }, '✗ 拒绝'),
          !isSkill && item.status === 'failed' && React.createElement('button', {
            className: 'sf-btn sf-btn-secondary',
            onClick: () => handleRetry(String(item.id)),
          }, '🔄 重试'),
          !isSkill && isForgeRunning(String(item.status)) && React.createElement('button', {
            className: 'sf-btn sf-btn-danger',
            onClick: () => handleCancel(String(item.id)),
          }, '⏹ 取消'),
        ),
      ),
    )
  }

  // ==========================================================
  // 统计视图
  // ==========================================================
  if (currentView === 'stats') {
    const detail = stats
    const dailyStats = (detail?.dailyStats as UnknownRecord[] | undefined) || []
    const topSkills = (detail?.topSkills as UnknownRecord[] | undefined) || []
    const recentForges = (detail?.recentForges as UnknownRecord[] | undefined) || []
    const injectionStats = (detail?.injectionStats as UnknownRecord | undefined)
      || { totalInjections: 0, smartInjectionRatio: 0, totalSkillInjections: 0 }

    const maxForge = Math.max(...dailyStats.map(d => d.forgeCount as number), 1)

    return React.createElement('div', { className: 'sf-forge-panel' },
      React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
      mainTab === 'forge' && React.createElement(SectionTabs, {
        items: FORGE_SECTIONS,
        active: forgeSection,
        onChange: k => handleForgeSectionChange(k as ForgeSectionKey),
      }),
      React.createElement('div', { className: 'sf-forge-stats' },
        viewTabsWithCount.map(tab =>
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
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#3B82F6' } },
              String(stats?.total ?? 0)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '总技能数'),
          ),
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#10B981' } },
              String(stats?.active ?? 0)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '活跃技能'),
          ),
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#F59E0B' } },
              String(runs.length)),
            React.createElement('div', { className: 'sf-stat-big-label' }, '锻造总数'),
          ),
          React.createElement('div', { className: 'sf-stat-big-card' },
            React.createElement('div', { className: 'sf-stat-big-num', style: { color: '#8B5CF6' } },
              (detail?.avgQualityScore as number)?.toFixed?.(2) || '0.62'),
            React.createElement('div', { className: 'sf-stat-big-label' }, '平均质量分'),
          ),
        ),

        // 最近 7 天趋势
        React.createElement('div', { className: 'sf-dashboard-section' },
          React.createElement('h4', { className: 'sf-section-title' }, '📈 最近 7 天趋势'),
          React.createElement('div', { className: 'sf-trend-chart' },
            dailyStats.length > 0
              ? dailyStats.map((d, i) =>
                React.createElement('div', { key: i, className: 'sf-trend-bar-wrap' },
                  React.createElement('div', {
                    className: 'sf-trend-bar',
                    style: {
                      height: `${((d.forgeCount as number) / maxForge) * 100}%`,
                      minHeight: (d.forgeCount as number) > 0 ? '4px' : '2px',
                    },
                  }),
                  React.createElement('div', { className: 'sf-trend-label' }, String(d.date)),
                )
              )
              : React.createElement('div', { className: 'sf-empty-text' }, '暂无数据'),
          ),
          dailyStats.length > 0 && React.createElement('div', { className: 'sf-trend-legend' },
            React.createElement('span', { className: 'sf-trend-legend-item' },
              React.createElement('span', {
                className: 'sf-trend-legend-dot',
                style: { background: '#3B82F6' },
              }),
              '锻造数',
            ),
          ),
        ),

        // Top 5 常用技能
        React.createElement('div', { className: 'sf-dashboard-section' },
          React.createElement('h4', { className: 'sf-section-title' }, '🔥 Top 5 常用技能'),
          React.createElement('div', { className: 'sf-bar-chart' },
            topSkills.length > 0
              ? (() => {
                const maxUsage = Math.max(...topSkills.map(t => t.usageCount as number), 1)
                return topSkills.map((s, i) =>
                  React.createElement('div', { key: i, className: 'sf-bar-item' },
                    React.createElement('div', { className: 'sf-bar-label' },
                      React.createElement('span', { className: 'sf-bar-cat-name' }, `${i + 1}. ${s.name}`),
                      React.createElement('span', { className: 'sf-bar-cat-count' }, `${s.usageCount} 次`),
                    ),
                    React.createElement('div', { className: 'sf-bar-track' },
                      React.createElement('div', {
                        className: 'sf-bar-fill',
                        style: {
                          width: `${((s.usageCount as number) / maxUsage) * 100}%`,
                          background: qualityColor(s.qualityScore as number),
                        },
                      }),
                    ),
                    (s.qualityScore as number) > 0 && React.createElement('div', { className: 'sf-bar-quality' },
                      `质量分 ${(s.qualityScore as number).toFixed(2)}`),
                  )
                )
              })()
              : React.createElement('div', { className: 'sf-empty-text' }, '暂无使用数据'),
          ),
        ),

        // 最近锻造
        React.createElement('div', { className: 'sf-dashboard-section' },
          React.createElement('h4', { className: 'sf-section-title' }, '⚒️ 最近锻造'),
          React.createElement('div', { className: 'sf-timeline' },
            recentForges.length > 0
              ? recentForges.map((r, i) =>
                React.createElement('div', {
                  key: String(r.id || i),
                  className: 'sf-timeline-item',
                },
                  React.createElement('div', {
                    className: `sf-timeline-dot sf-timeline-dot-${r.status}`,
                  }),
                  React.createElement('div', { className: 'sf-timeline-content' },
                    React.createElement('div', { className: 'sf-timeline-header' },
                      React.createElement('span', { className: 'sf-timeline-title' },
                        truncate(String(r.sourceSummary), 30) || '锻造任务'),
                      React.createElement('span', { className: `sf-status-tag sf-status-${r.status}` },
                        forgeStatusLabel(String(r.status))),
                    ),
                    React.createElement('div', { className: 'sf-timeline-meta' },
                      formatRelativeTime(r.createdAt as number),
                      r.qualityScore != null && React.createElement('span', {
                        className: 'sf-timeline-score',
                        style: { color: qualityColor(r.qualityScore as number) },
                      }, ` · 质量分 ${(r.qualityScore as number).toFixed(2)}`),
                    ),
                  ),
                )
              )
              : React.createElement('div', { className: 'sf-empty-text' }, '暂无锻造记录'),
          ),
        ),

        // 注入统计
        React.createElement('div', { className: 'sf-dashboard-section' },
          React.createElement('h4', { className: 'sf-section-title' }, '💉 注入统计'),
          React.createElement('div', { className: 'sf-inject-stats' },
            React.createElement('div', { className: 'sf-inject-stat-row' },
              React.createElement('span', { className: 'sf-inject-label' }, '总注入次数'),
              React.createElement('span', { className: 'sf-inject-value' },
                String(injectionStats.totalInjections || 0)),
            ),
            React.createElement('div', { className: 'sf-inject-stat-row' },
              React.createElement('span', { className: 'sf-inject-label' }, '累计技能注入'),
              React.createElement('span', { className: 'sf-inject-value' },
                String(injectionStats.totalSkillInjections || 0)),
            ),
            React.createElement('div', { className: 'sf-inject-stat-row' },
              React.createElement('span', { className: 'sf-inject-label' }, '智能注入占比'),
              React.createElement('span', { className: 'sf-inject-value' },
                `${((injectionStats.smartInjectionRatio as number || 0) * 100).toFixed(0)}%`),
            ),
            React.createElement('div', { className: 'sf-inject-progress' },
              React.createElement('div', {
                className: 'sf-inject-progress-fill',
                style: {
                  width: `${Math.min(((injectionStats.smartInjectionRatio as number) || 0) * 100, 100)}%`,
                },
              }),
            ),
          ),
        ),
      ),
    )
  }

  // ==========================================================
  // 列表视图（默认视图）
  // ==========================================================
  const listItems: UnknownRecord[] = currentView === 'active' ? filteredActiveSkills :
    currentView === 'pending' ? pendingRuns :
    currentView === 'running' ? runningRuns : historyRuns

  const emptyText = currentView === 'active' ? '暂无已激活技能' :
    currentView === 'pending' ? '暂无待审核任务' :
    currentView === 'running' ? '暂无进行中任务' : '暂无历史记录'

  return React.createElement('div', { className: 'sf-forge-panel' },
    React.createElement(MainTabs, { active: mainTab, onChange: handleMainTabChange }),
    mainTab === 'forge' && React.createElement(SectionTabs, {
      items: FORGE_SECTIONS,
      active: forgeSection,
      onChange: k => handleForgeSectionChange(k as ForgeSectionKey),
    }),

    // 统计卡片
    React.createElement('div', { className: 'sf-forge-stats' },
      viewTabsWithCount.map(tab =>
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
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value),
      }),
    ),

    // 列表
    React.createElement('div', { className: 'sf-forge-list' },
      listItems.length === 0
        ? React.createElement(EmptySmall, { text: emptyText })
        : listItems.map(item => {
          if (currentView === 'active') {
            const fm = (item.frontmatter as UnknownRecord | undefined) || {}
            const preview = (item.body as string || '').replace(/^[\->|`~]+/gm, '').substring(0, 150)
            return React.createElement('div', {
              key: String(item.id),
              className: 'sf-skill-item',
              onClick: () => selectSkill(item),
            },
              React.createElement('div', { className: 'sf-skill-item-header' },
                React.createElement('span', { className: 'sf-skill-item-name' },
                  String(fm.name || '未命名')),
                React.createElement('span', { className: 'sf-skill-item-version' },
                  `v${fm.version || '0.1'}`),
              ),
              React.createElement('div', { className: 'sf-skill-item-desc' },
                String(fm.description || '暂无描述')),
              // tags
              ((fm.tags as string[] | undefined)?.length || fm.category)
              && React.createElement('div', { className: 'sf-skill-item-tags' },
                ((fm.tags as string[] | undefined)?.length
                  ? (fm.tags as string[]).slice(0, 3)
                  : fm.category ? [String(fm.category)] : []
                ).map((t: string) =>
                  React.createElement('span', { key: t, className: 'sf-tag-mini' }, `#${t}`)
                ),
              ),
              // 预览
              preview && React.createElement('div', { className: 'sf-skill-item-preview' }, preview),
              // 质量分
              item.qualityScore != null && React.createElement('div', { className: 'sf-skill-item-meta' },
                React.createElement('span', { className: 'sf-skill-quality' },
                  `🏆 ${(item.qualityScore as number).toFixed(2)}`),
              ),
            )
          }
          // 锻造任务
          return React.createElement('div', {
            key: String(item.id),
            className: `sf-run-item sf-run-${item.status}`,
            onClick: () => selectRun(item),
            style: { cursor: 'pointer' },
          },
            React.createElement('div', { className: 'sf-run-header' },
              React.createElement('span', { className: 'sf-run-name' },
                (item.generatedSkill as UnknownRecord | undefined)?.frontmatter?.name
                || truncate(String(item.sourceSummary), 30)
                || '未命名'
              ),
              React.createElement('span', { className: `sf-status-tag sf-status-${item.status}` },
                forgeStatusLabel(String(item.status))),
            ),
            React.createElement('div', { className: 'sf-run-meta' },
              (item.qualityScore as number) > 0 && React.createElement('span', null,
                `质量 ${(item.qualityScore as number).toFixed(2)}`),
              React.createElement('span', null, formatRelativeTime(item.createdAt as number)),
            ),
          )
        })
    ),
  )
}
