/**
 * SkillForgeSettings —— 设置页组件
 *
 * 在 DSH 设置页中注册的配置面板。
 * 采用 DSH 设计语言：卡片式布局、CSS 变量主题、分层背景、圆润边角。
 *
 * 通过 HTTP API 与后端通信（/skill-forge/config），不依赖 DSH remote bridge。
 */

import React, { useState, useEffect, useCallback } from 'react'
import { SecurityLevel } from '../../types.js'

// ============================================================
// HTTP 请求（轻量封装，不依赖 api.ts 避免循环引用）
// ============================================================

async function apiGetConfig(): Promise<any> {
  const res = await fetch('/skill-forge/config')
  if (!res.ok) throw new Error(`加载配置失败: ${res.status}`)
  return res.json()
}

async function apiUpdateConfig(patch: any): Promise<any> {
  const res = await fetch('/skill-forge/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`保存配置失败: ${res.status}`)
  return res.json()
}

// ============================================================
// 类型
// ============================================================

interface SkillForgeConfig {
  // 安全
  securityLevel: SecurityLevel
  customDangerousPatterns: string[]

  // 自动锻造
  autoTrigger: boolean
  triggerThreshold: number
  maxIterations: number
  verificationPassThreshold: number

  // 技能库
  skillCountAlertThreshold: number
  tokenBudgetRatio: number

  // 闲时锻造
  enableDreaming: boolean
  dreamingSchedule: string

  // 智能注入
  injectionMode: 'all' | 'smart'
  injectionTokenBudget: number
  injectionRelevanceThreshold: number
  usageScoreWeight: number
  feedbackScoreWeight: number

  // 增量积累
  enableIncrementalAccumulation: boolean
  densityThreshold: number
  minForgingIntervalMinutes: number
  idleDensityThreshold: number

  // 意图感知
  enableIntentAware: boolean
  intentAnalysisMinChars: number

  // 奖励驱动
  enableRewardLearning: boolean
  implicitFeedbackWindow: number
  implicitPositiveStep: number
  implicitNegativeStep: number
  explicitFeedbackMultiplier: number
  dailyDecayRate: number

  // 达尔文优化
  darwinMaxIterations: number
  darwinHighScoreThreshold: number
  darwinAutoApprove: boolean

  // 饕餮融合
  taotieAutoDetect: boolean
  taotieSimilarityThreshold: number
  taotieAutoApprove: boolean
}

// ============================================================
// 子组件：切换开关
// ============================================================

function Toggle({
  checked,
  onChange,
  disabled = false,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  id?: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`sf-toggle ${checked ? 'sf-toggle-on' : ''} ${disabled ? 'sf-toggle-disabled' : ''}`}
    >
      <span className="sf-toggle-thumb" />
    </button>
  )
}

// ============================================================
// 子组件：分段控件
// ============================================================

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string; desc?: string }>
}) {
  return (
    <div className="sf-segmented" role="radiogroup">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`sf-segmented-item ${value === opt.value ? 'sf-segmented-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <span className="sf-segmented-label">{opt.label}</span>
          {opt.desc && <span className="sf-segmented-desc">{opt.desc}</span>}
        </button>
      ))}
    </div>
  )
}

// ============================================================
// 子组件：滑块（带数值显示）
// ============================================================

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  disabled = false,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  formatValue?: (v: number) => string
  disabled?: boolean
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={`sf-slider-wrap ${disabled ? 'sf-slider-disabled' : ''}`}>
      <div className="sf-slider-track" style={{ ['--sf-slider-pos' as any]: `${pct}%` }}>
        <div className="sf-slider-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="sf-slider-input"
        />
      </div>
      <span className="sf-slider-value">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  )
}

// ============================================================
// 子组件：数字输入
// ============================================================

function NumberInput({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  suffix,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  disabled?: boolean
  suffix?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className={`sf-number-input ${disabled ? 'sf-number-disabled' : ''}`}>
      <button
        type="button"
        className="sf-number-btn"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - step))}
        aria-label="减少"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(clamp(v))
        }}
        className="sf-number-field"
      />
      {suffix && <span className="sf-number-suffix">{suffix}</span>}
      <button
        type="button"
        className="sf-number-btn"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + step))}
        aria-label="增加"
      >
        +
      </button>
    </div>
  )
}

// ============================================================
// 子组件：设置行（标签 + 描述 + 控件）
// ============================================================

function SettingRow({
  label,
  description,
  control,
  className = '',
}: {
  label: string
  description?: string
  control: React.ReactNode
  className?: string
}) {
  return (
    <div className={`sf-setting-row ${className}`}>
      <div className="sf-setting-info">
        <span className="sf-setting-label">{label}</span>
        {description && <span className="sf-setting-desc">{description}</span>}
      </div>
      <div className="sf-setting-control">{control}</div>
    </div>
  )
}

// ============================================================
// 子组件：设置分区
// ============================================================

function SettingSection({
  title,
  description,
  icon,
  children,
  collapsed = false,
  defaultCollapsed = false,
}: {
  title: string
  description?: string
  icon?: string
  children: React.ReactNode
  collapsed?: boolean
  defaultCollapsed?: boolean
}) {
  const [isCollapsed, setCollapsed] = useState(defaultCollapsed)
  const actualCollapsed = collapsed !== undefined ? collapsed : isCollapsed

  return (
    <div className={`sf-settings-section ${actualCollapsed ? 'collapsed' : ''}`}>
      <div className="sf-section-header" onClick={() => setCollapsed(!isCollapsed)} style={{ cursor: 'pointer' }}>
        <div className="sf-section-title-wrap">
          {icon && <span className="sf-section-icon">{icon}</span>}
          <h4 className="sf-section-title">{title}</h4>
        </div>
        <span className="sf-section-collapse-icon">
          {actualCollapsed ? '▸' : '▾'}
        </span>
      </div>
      {!actualCollapsed && (
        <div className="sf-section-body">
          {description && <p className="sf-section-desc">{description}</p>}
          {children}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

export function SkillForgeSettings() {
  const [config, setConfig] = useState<SkillForgeConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [patternsText, setPatternsText] = useState('')

  // 加载配置
  useEffect(() => {
    let mounted = true
    const loadConfig = async () => {
      try {
        const cfg = await apiGetConfig()
        if (cfg && mounted) {
          setConfig(cfg)
          setPatternsText((cfg.customDangerousPatterns || []).join('\n'))
          setErrorMsg(null)
        }
      } catch (err: any) {
        console.error('[skill-forge] Failed to load config:', err)
        setErrorMsg(err?.message || '加载配置失败')
      }
    }
    loadConfig()
    return () => { mounted = false }
  }, [])

  // 防抖保存
  const saveConfig = useCallback(async (updates: Partial<SkillForgeConfig>) => {
    if (!config) return
    setConfig(prev => prev ? { ...prev, ...updates } : prev)
    setSaveStatus('saving')
    setSaving(true)
    try {
      await apiUpdateConfig(updates)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (err: any) {
      console.error('[skill-forge] Failed to save config:', err)
      setSaveStatus('error')
      setErrorMsg(err?.message || '保存失败')
    } finally {
      setTimeout(() => setSaving(false), 500)
    }
  }, [config])

  // 自定义危险模式：失焦时保存
  const handlePatternsBlur = () => {
    const patterns = patternsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    saveConfig({ customDangerousPatterns: patterns })
  }

  // 加载失败状态
  if (errorMsg && !config) {
    return (
      <div className="sf-settings-card">
        <div className="sf-settings-error">
          <span className="sf-error-icon">⚠️</span>
          <div className="sf-error-content">
            <h4>配置加载失败</h4>
            <p>{errorMsg}</p>
            <p className="sf-error-hint">
              请确保 Skill Forge 插件已正常启动。
              可在侧栏点击 🔨 Forge 按钮查看插件状态。
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="sf-settings-card">
        <div className="sf-settings-loading">
          <span className="sf-spinner" />
          <span>加载 Skill Forge 设置中...</span>
        </div>
      </div>
    )
  }

  const securityOptions = [
    { value: SecurityLevel.STRICT, label: '严格', desc: '全部人工审核' },
    { value: SecurityLevel.NORMAL, label: '正常', desc: '低风险自动入库' },
    { value: SecurityLevel.PERMISSIVE, label: '宽松', desc: '验证通过即入库' },
    { value: SecurityLevel.AUTO, label: '全自动', desc: '完全不拦截' },
  ]

  const injectionModeOptions = [
    { value: 'all', label: '全部注入', desc: '所有技能都注入' },
    { value: 'smart', label: '智能匹配', desc: '按相关度加权排序' },
  ]

  return (
    <div className="sf-settings-card">
      {/* 卡片头部 */}
      <div className="sf-settings-header">
        <div className="sf-settings-header-text">
          <h3 className="sf-settings-title">
            <span className="sf-settings-icon">🔨</span>
            Skill Forge
          </h3>
          <p className="sf-settings-subtitle">
            多 Agent 协作式技能锻造系统 — 从对话中提炼、验证、进化你的技能库
          </p>
        </div>
        <div className={`sf-settings-save-status sf-save-${saveStatus}`}>
          {saveStatus === 'saving' && <><span className="sf-spinner sf-spinner-sm" />保存中</>}
          {saveStatus === 'saved' && <>✓ 已保存</>}
          {saveStatus === 'error' && <>⚠ 保存失败</>}
        </div>
      </div>

      {/* 功能概览 */}
      <div className="sf-settings-overview">
        <div className="sf-overview-item">
          <span className="sf-overview-icon">🧬</span>
          <div className="sf-overview-text">
            <span className="sf-overview-label">达尔文优化</span>
            <span className="sf-overview-desc">10 维度爬山，自动优化单体技能</span>
          </div>
        </div>
        <div className="sf-overview-item">
          <span className="sf-overview-icon">🔗</span>
          <div className="sf-overview-text">
            <span className="sf-overview-label">饕餮融合</span>
            <span className="sf-overview-desc">跨技能优势融合，沉淀通用模式</span>
          </div>
        </div>
        <div className="sf-overview-item">
          <span className="sf-overview-icon">🧠</span>
          <div className="sf-overview-text">
            <span className="sf-overview-label">智能召回</span>
            <span className="sf-overview-desc">意图感知 + 奖励驱动 + 增量积累</span>
          </div>
        </div>
      </div>

      <div className="sf-settings-body">

        {/* ===== 安全与质量 ===== */}
        <SettingSection title="安全与质量" icon="🛡️" description="控制技能生成和注入的安全策略">
          <SettingRow
            label="安全等级"
            description="技能锻造完成后的审核严格程度"
            control={
              <SegmentedControl
                value={config.securityLevel}
                onChange={v => saveConfig({ securityLevel: v as SecurityLevel })}
                options={securityOptions}
              />
            }
          />
          <SettingRow
            label="验证通过阈值"
            description="测试用例通过率达到此值视为验证通过"
            control={
              <Slider
                value={config.verificationPassThreshold}
                min={0.5}
                max={1.0}
                step={0.05}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ verificationPassThreshold: v })}
              />
            }
          />
          <SettingRow
            label="最大迭代轮数"
            description="验证失败后最多重试优化的次数"
            control={
              <NumberInput
                value={config.maxIterations}
                min={0}
                max={10}
                onChange={v => saveConfig({ maxIterations: v })}
              />
            }
          />
          <SettingRow
            label="Token 预算占比"
            description="锻造系统可使用的 Token 占会话总预算的比例"
            control={
              <Slider
                value={config.tokenBudgetRatio}
                min={0.05}
                max={0.3}
                step={0.05}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ tokenBudgetRatio: v })}
              />
            }
          />
        </SettingSection>

        {/* ===== 自动锻造 ===== */}
        <SettingSection title="自动锻造" icon="⚡" description="对话过程中自动检测可锻造的技能">
          <SettingRow
            label="启用自动锻造"
            description="对话过程中自动检测是否值得锻造为技能"
            control={
              <Toggle
                checked={config.autoTrigger}
                onChange={v => saveConfig({ autoTrigger: v })}
              />
            }
          />
          <SettingRow
            label="触发置信度阈值"
            description="高于此置信度的对话才会自动触发锻造"
            control={
              <Slider
                value={config.triggerThreshold}
                min={0.1}
                max={0.95}
                step={0.05}
                disabled={!config.autoTrigger}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ triggerThreshold: v })}
              />
            }
          />
          <SettingRow
            label="增量经验积累"
            description="每轮对话累积痕迹，达到密度阈值才触发锻造"
            control={
              <Toggle
                checked={config.enableIncrementalAccumulation}
                onChange={v => saveConfig({ enableIncrementalAccumulation: v })}
              />
            }
          />
          <SettingRow
            label="触发密度阈值"
            description="累积痕迹密度达到此值时触发锻造"
            control={
              <Slider
                value={config.densityThreshold}
                min={0.3}
                max={0.9}
                step={0.05}
                disabled={!config.enableIncrementalAccumulation}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ densityThreshold: v })}
              />
            }
          />
          <SettingRow
            label="最短锻造间隔"
            description="两次自动锻造之间的最小时间间隔"
            control={
              <NumberInput
                value={config.minForgingIntervalMinutes}
                min={5}
                max={120}
                suffix="分钟"
                disabled={!config.autoTrigger}
                onChange={v => saveConfig({ minForgingIntervalMinutes: v })}
              />
            }
          />
        </SettingSection>

        {/* ===== 智能注入 ===== */}
        <SettingSection title="智能注入" icon="🎯" description="技能如何被召回并注入到对话中">
          <SettingRow
            label="注入模式"
            description="全部注入所有技能，或智能匹配相关技能"
            control={
              <SegmentedControl
                value={config.injectionMode}
                onChange={v => saveConfig({ injectionMode: v as 'all' | 'smart' })}
                options={injectionModeOptions}
              />
            }
          />
          <SettingRow
            label="意图感知召回"
            description="先分析任务意图，再按意图类型加权匹配技能"
            control={
              <Toggle
                checked={config.enableIntentAware}
                disabled={config.injectionMode !== 'smart'}
                onChange={v => saveConfig({ enableIntentAware: v })}
              />
            }
          />
          <SettingRow
            label="最小分析字符数"
            description="任务描述至少多少字符才触发意图分析"
            control={
              <NumberInput
                value={config.intentAnalysisMinChars}
                min={20}
                max={500}
                suffix="字符"
                disabled={!config.enableIntentAware || config.injectionMode !== 'smart'}
                onChange={v => saveConfig({ intentAnalysisMinChars: v })}
              />
            }
          />
          <SettingRow
            label="相关度阈值"
            description="相关度低于此值的技能不注入"
            control={
              <Slider
                value={config.injectionRelevanceThreshold}
                min={0}
                max={0.8}
                step={0.05}
                disabled={config.injectionMode !== 'smart'}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ injectionRelevanceThreshold: v })}
              />
            }
          />
          <SettingRow
            label="使用频率权重"
            description="使用频率在智能注入评分中的占比"
            control={
              <Slider
                value={config.usageScoreWeight}
                min={0}
                max={0.5}
                step={0.05}
                disabled={config.injectionMode !== 'smart'}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ usageScoreWeight: v })}
              />
            }
          />
        </SettingSection>

        {/* ===== 奖励驱动进化 ===== */}
        <SettingSection title="奖励驱动进化" icon="🏆" description="根据用户使用效果自动调整技能召回权重" defaultCollapsed>
          <SettingRow
            label="启用奖励学习"
            description="通过隐式反馈和显式反馈自动优化技能排序"
            control={
              <Toggle
                checked={config.enableRewardLearning}
                onChange={v => saveConfig({ enableRewardLearning: v })}
              />
            }
          />
          <SettingRow
            label="隐式反馈观察窗口"
            description="技能注入后追踪多少轮对话判断效果"
            control={
              <NumberInput
                value={config.implicitFeedbackWindow}
                min={1}
                max={10}
                suffix="轮"
                disabled={!config.enableRewardLearning}
                onChange={v => saveConfig({ implicitFeedbackWindow: v })}
              />
            }
          />
          <SettingRow
            label="正反馈调整幅度"
            description="每次正反馈增加的反馈分数"
            control={
              <Slider
                value={config.implicitPositiveStep}
                min={0.01}
                max={0.5}
                step={0.01}
                disabled={!config.enableRewardLearning}
                formatValue={v => `+${v.toFixed(2)}`}
                onChange={v => saveConfig({ implicitPositiveStep: v })}
              />
            }
          />
          <SettingRow
            label="负反馈调整幅度"
            description="每次负反馈减少的反馈分数"
            control={
              <Slider
                value={config.implicitNegativeStep}
                min={0.01}
                max={0.5}
                step={0.01}
                disabled={!config.enableRewardLearning}
                formatValue={v => `-${v.toFixed(2)}`}
                onChange={v => saveConfig({ implicitNegativeStep: v })}
              />
            }
          />
          <SettingRow
            label="显式反馈权重倍数"
            description="用户手动点赞/点踩是隐式反馈的多少倍"
            control={
              <NumberInput
                value={config.explicitFeedbackMultiplier}
                min={1}
                max={10}
                suffix="x"
                disabled={!config.enableRewardLearning}
                onChange={v => saveConfig({ explicitFeedbackMultiplier: v })}
              />
            }
          />
          <SettingRow
            label="每日衰减比例"
            description="每天向 0 回归的比例，避免一次评价永久影响"
            control={
              <Slider
                value={config.dailyDecayRate}
                min={0}
                max={0.5}
                step={0.01}
                disabled={!config.enableRewardLearning}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ dailyDecayRate: v })}
              />
            }
          />
          <SettingRow
            label="反馈分权重"
            description="反馈分在智能注入评分中的占比"
            control={
              <Slider
                value={config.feedbackScoreWeight}
                min={0}
                max={0.5}
                step={0.05}
                disabled={config.injectionMode !== 'smart' || !config.enableRewardLearning}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ feedbackScoreWeight: v })}
              />
            }
          />
        </SettingSection>

        {/* ===== 达尔文优化 ===== */}
        <SettingSection title="达尔文优化" icon="🧬" description="单体技能的爬山式自动优化系统" defaultCollapsed>
          <SettingRow
            label="最大优化轮数"
            description="单轮达尔文优化的最大迭代次数"
            control={
              <NumberInput
                value={config.darwinMaxIterations}
                min={1}
                max={20}
                suffix="轮"
                onChange={v => saveConfig({ darwinMaxIterations: v })}
              />
            }
          />
          <SettingRow
            label="高分阈值"
            description="所有维度达到此分数视为优化完成"
            control={
              <Slider
                value={config.darwinHighScoreThreshold}
                min={0.6}
                max={0.99}
                step={0.05}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ darwinHighScoreThreshold: v })}
              />
            }
          />
          <SettingRow
            label="自动批准优化"
            description="分数提升的优化自动应用，无需人工确认"
            control={
              <Toggle
                checked={config.darwinAutoApprove}
                onChange={v => saveConfig({ darwinAutoApprove: v })}
              />
            }
          />
        </SettingSection>

        {/* ===== 饕餮融合 ===== */}
        <SettingSection title="饕餮融合" icon="🔗" description="跨技能优势融合与模式沉淀" defaultCollapsed>
          <SettingRow
            label="自动检测可融合技能"
            description="自动检测技能库中可以融合的相似技能对"
            control={
              <Toggle
                checked={config.taotieAutoDetect}
                onChange={v => saveConfig({ taotieAutoDetect: v })}
              />
            }
          />
          <SettingRow
            label="相似度阈值"
            description="语义相似度高于此值的技能对被视为可融合"
            control={
              <Slider
                value={config.taotieSimilarityThreshold}
                min={0.3}
                max={0.95}
                step={0.05}
                disabled={!config.taotieAutoDetect}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ taotieSimilarityThreshold: v })}
              />
            }
          />
          <SettingRow
            label="自动批准融合"
            description="融合验证通过后自动应用，无需人工确认"
            control={
              <Toggle
                checked={config.taotieAutoApprove}
                onChange={v => saveConfig({ taotieAutoApprove: v })}
              />
            }
          />
        </SettingSection>

        {/* ===== 闲时锻造 ===== */}
        <SettingSection title="闲时锻造（Dreaming）" icon="🌙" description="定时批量回顾和整理技能库" defaultCollapsed>
          <SettingRow
            label="启用闲时锻造"
            description="定时批量回顾和整理技能库，发现潜在模式"
            control={
              <Toggle
                checked={config.enableDreaming}
                onChange={v => saveConfig({ enableDreaming: v })}
              />
            }
          />
          <SettingRow
            label="调度时间"
            description="cron 表达式，默认每周日凌晨 3 点"
            control={
              <input
                type="text"
                value={config.dreamingSchedule}
                disabled={!config.enableDreaming}
                onChange={e => saveConfig({ dreamingSchedule: e.target.value })}
                className="sf-text-input"
                placeholder="0 3 * * 0"
                spellCheck={false}
              />
            }
          />
        </SettingSection>

        {/* ===== 技能库管理 ===== */}
        <SettingSection title="技能库管理" icon="📚" defaultCollapsed>
          <SettingRow
            label="技能数量提醒阈值"
            description="技能数量达到此值时发出整理提醒"
            control={
              <NumberInput
                value={config.skillCountAlertThreshold}
                min={10}
                max={200}
                suffix="个"
                onChange={v => saveConfig({ skillCountAlertThreshold: v })}
              />
            }
          />
          <SettingRow
            label="注入 Token 预算"
            description="每次注入技能最多使用的 Token 数"
            control={
              <NumberInput
                value={config.injectionTokenBudget}
                min={500}
                max={10000}
                step={500}
                suffix="token"
                onChange={v => saveConfig({ injectionTokenBudget: v })}
              />
            }
          />
          <SettingRow
            label="闲置触发密度阈值"
            description="对话闲置时，痕迹密度达到此值也会触发锻造"
            control={
              <Slider
                value={config.idleDensityThreshold}
                min={0.2}
                max={0.8}
                step={0.05}
                disabled={!config.enableIncrementalAccumulation}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
                onChange={v => saveConfig({ idleDensityThreshold: v })}
              />
            }
          />
        </SettingSection>

        {/* ===== 自定义危险模式 ===== */}
        <SettingSection title="自定义危险模式" icon="⚠️" description="每行一个正则模式，命中的技能将被标记为高危" defaultCollapsed>
          <textarea
            value={patternsText}
            onChange={e => setPatternsText(e.target.value)}
            onBlur={handlePatternsBlur}
            className="sf-textarea"
            placeholder={'rm -rf /\ndelete.*database\neval\\(.*\\)'}
            rows={6}
            spellCheck={false}
          />
        </SettingSection>

      </div>

      {/* 底部信息 */}
      <div className="sf-settings-footer">
        <span className="sf-footer-text">
          更多功能和使用说明请访问{' '}
          <a href="https://github.com/Epiphany-Leon/dsh-skill-forge" target="_blank" rel="noopener noreferrer">
            GitHub 仓库
          </a>
        </span>
      </div>
    </div>
  )
}
