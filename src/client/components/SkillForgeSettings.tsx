/**
 * SkillForgeSettings —— 设置页组件
 *
 * 在 DSH 设置页中注册的配置面板。
 * 采用 DSH 设计语言：卡片式布局、CSS 变量主题、分层背景、圆润边角。
 */

import React, { useState, useEffect, useCallback } from 'react'
import { SecurityLevel } from '../../types.js'

// ============================================================
// 类型
// ============================================================

interface SkillForgeConfig {
  securityLevel: SecurityLevel
  autoTrigger: boolean
  triggerThreshold: number
  maxIterations: number
  verificationPassThreshold: number
  skillCountAlertThreshold: number
  tokenBudgetRatio: number
  enableDreaming: boolean
  dreamingSchedule: string
  customDangerousPatterns: string[]
  injectionMode: 'all' | 'smart'
  injectionTokenBudget: number
  injectionRelevanceThreshold: number
  enableIncrementalAccumulation: boolean
  densityThreshold: number
  minForgingIntervalMinutes: number
  idleDensityThreshold: number
  enableIntentAware: boolean
  intentAnalysisMinChars: number
  enableRewardLearning: boolean
  implicitFeedbackWindow: number
  implicitPositiveStep: number
  implicitNegativeStep: number
  explicitFeedbackMultiplier: number
  dailyDecayRate: number
  feedbackScoreWeight: number
  usageScoreWeight: number
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
// 主组件
// ============================================================

export function SkillForgeSettings() {
  const [config, setConfig] = useState<SkillForgeConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [patternsText, setPatternsText] = useState('')

  // 加载配置
  useEffect(() => {
    let mounted = true
    const loadConfig = async () => {
      try {
        // @ts-expect-error DSH runtime bridge
        const cfg = await window.dsh?.remote?.skillForge?.getConfig?.()
        if (cfg && mounted) {
          setConfig(cfg)
          setPatternsText((cfg.customDangerousPatterns || []).join('\n'))
        }
      } catch (err) {
        console.error('[skill-forge] Failed to load config:', err)
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
      // @ts-expect-error DSH runtime bridge
      await window.dsh?.remote?.skillForge?.updateConfig?.(updates)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1200)
    } catch (err) {
      console.error('[skill-forge] Failed to save config:', err)
      setSaveStatus('error')
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

  if (!config) {
    return (
      <div className="sf-settings-card">
        <div className="sf-settings-loading">
          <span className="sf-spinner" />
          <span>加载设置中...</span>
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

  return (
    <div className="sf-settings-card">
      {/* 卡片头部 */}
      <div className="sf-settings-header">
        <div className="sf-settings-header-text">
          <h3 className="sf-settings-title">
            <span className="sf-settings-icon">🔨</span>
            Skill Forge
          </h3>
          <p className="sf-settings-subtitle">多 Agent 协作式技能锻造系统配置</p>
        </div>
        <div className={`sf-settings-save-status sf-save-${saveStatus}`}>
          {saveStatus === 'saving' && <><span className="sf-spinner sf-spinner-sm" />保存中</>}
          {saveStatus === 'saved' && <>✓ 已保存</>}
          {saveStatus === 'error' && <>⚠ 保存失败</>}
        </div>
      </div>

      <div className="sf-settings-body">
        {/* ===== 安全等级 ===== */}
        <div className="sf-settings-section">
          <div className="sf-section-header">
            <h4 className="sf-section-title">安全等级</h4>
            <span className="sf-section-desc">控制自动生成技能的审核严格程度</span>
          </div>
          <div className="sf-section-body">
            <SegmentedControl
              value={config.securityLevel}
              onChange={v => saveConfig({ securityLevel: v as SecurityLevel })}
              options={securityOptions}
            />
          </div>
        </div>

        {/* ===== 自动触发 ===== */}
        <div className="sf-settings-section">
          <div className="sf-section-header">
            <h4 className="sf-section-title">自动触发</h4>
          </div>
          <div className="sf-section-body">
            <SettingRow
              label="启用自动锻造"
              description="对话结束时自动检测是否值得锻造为技能"
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
          </div>
        </div>

        {/* ===== 迭代优化 ===== */}
        <div className="sf-settings-section">
          <div className="sf-section-header">
            <h4 className="sf-section-title">迭代优化</h4>
          </div>
          <div className="sf-section-body">
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
          </div>
        </div>

        {/* ===== 技能库 ===== */}
        <div className="sf-settings-section">
          <div className="sf-section-header">
            <h4 className="sf-section-title">技能库</h4>
          </div>
          <div className="sf-section-body">
            <SettingRow
              label="技能数量提醒阈值"
              description="技能数量达到此值时发出整理提醒"
              control={
                <NumberInput
                  value={config.skillCountAlertThreshold}
                  min={10}
                  max={100}
                  suffix="个"
                  onChange={v => saveConfig({ skillCountAlertThreshold: v })}
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
          </div>
        </div>

        {/* ===== 闲时锻造 ===== */}
        <div className="sf-settings-section">
          <div className="sf-section-header">
            <h4 className="sf-section-title">闲时锻造（Dreaming）</h4>
          </div>
          <div className="sf-section-body">
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
          </div>
        </div>

        {/* ===== 奖励驱动进化 ===== */}
        <div className="sf-settings-section">
          <div className="sf-section-header">
            <h4 className="sf-section-title">奖励驱动进化</h4>
            <span className="sf-section-desc">根据用户使用效果自动调整技能召回权重</span>
          </div>
          <div className="sf-section-body">
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
          </div>
        </div>

        {/* ===== 自定义危险模式 ===== */}
        <div className="sf-settings-section">
          <div className="sf-section-header">
            <h4 className="sf-section-title">自定义危险模式</h4>
            <span className="sf-section-desc">每行一个正则模式，命中的技能将被标记为高危</span>
          </div>
          <div className="sf-section-body">
            <textarea
              value={patternsText}
              onChange={e => setPatternsText(e.target.value)}
              onBlur={handlePatternsBlur}
              className="sf-textarea"
              placeholder={'rm -rf /\ndelete.*database\neval\\(.*\\)'}
              rows={5}
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
