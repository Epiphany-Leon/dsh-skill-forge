/**
 * DreamingEngine —— 闲时锻造模式
 *
 * 核心思想：借鉴 Letta (MemGPT) 的 "dreaming" 机制，
 * 在 DSH 空闲时（无对话活动）后台批量回顾和进化技能库。
 *
 * 四件事：
 * 1. 技能库健康体检：扫描所有技能，统计质量/使用/重复情况，生成健康报告
 * 2. 低分技能批量优化：调用 DarwinOptimizer 自动优化评分低于阈值的技能
 * 3. 相似技能自动融合：调用 TaotieFusion 自动融合语义相似的技能组
 * 4. 生成改进建议：对所有技能生成改进建议（不自动修改，只给建议）
 *
 * 触发方式：
 * - 手动触发：用户点击"开始 Dreaming"
 * - 定时触发：基于 cron 表达式（默认每周日凌晨 3 点）
 * - 空闲触发：DSH 无活动一段时间后自动启动
 *
 * 设计原则：
 * - 永不自动删除：所有操作都是归档/优化/建议，铁则
 * - 严格不回退：每一步优化/融合都必须有质量提升才保留
 * - 可中断：用户可以随时停止 Dreaming
 * - 资源友好：并发数受限，不影响正常对话
 */

import { BaseService } from './BaseService.js'
import {
  SkillStatus,
  DreamingStatus,
  DreamingPhase,
  type Skill,
  type SkillForgeConfig,
  type DreamingRun,
  type SkillLibraryHealthReport,
  type SkillImprovementSuggestion,
  type SimilarSkillGroup,
} from '../types.js'
import { DARWIN_DIMENSION_LABELS } from '../types.js'

/** Dreaming 依赖的外部服务 */
export interface DreamingDeps {
  /** 技能库 */
  registry: any
  /** 达尔文优化器 */
  darwin: any
  /** 饕餮融合器 */
  taotie: any
  /** 验证 Agent */
  verifier: any
}

/** 30 天毫秒数 */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export class DreamingEngine extends BaseService {
  private deps: DreamingDeps

  /** 当前运行的 Dreaming 任务（同时只允许一个） */
  private currentRun: DreamingRun | null = null

  /** 历史 Dreaming 运行记录 */
  private history: DreamingRun[] = []

  /** 持久化路径 */
  private storagePath: string = ''

  /** 定时调度定时器（cron 轮询） */
  private scheduleTimer: ReturnType<typeof setInterval> | null = null

  /** 空闲检测定时器 */
  private idleTimer: ReturnType<typeof setTimeout> | null = null

  /** 最后一次会话活动时间戳 */
  private lastActivityAt: number = Date.now()

  /** 是否正在运行（防止重入） */
  private running: boolean = false

  /** 停止标记（用于中断运行中的 Dreaming） */
  private stopRequested: boolean = false

  // ============================================================
  // 生命周期
  // ============================================================

  constructor(ctx: any, config: SkillForgeConfig, deps: DreamingDeps) {
    super(ctx, config)
    this.deps = deps
  }

  /** 初始化：加载历史记录 + 启动定时调度 */
  async initialize(storagePath: string): Promise<void> {
    this.storagePath = `${storagePath}/dreaming`
    const fs = await import('node:fs/promises')
    try {
      await fs.mkdir(this.storagePath, { recursive: true })
    } catch {
      // 已存在
    }

    // 加载历史记录
    try {
      const raw = await fs.readFile(`${this.storagePath}/dreaming-history.json`, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) {
        this.history = data
        this.log('info', `Loaded ${data.length} historical dreaming runs`)
      }
    } catch {
      // 文件不存在，正常
    }

    // 启动定时调度（如果启用）
    if (this.config.enableDreaming) {
      this.startSchedule()
    }

    // 订阅会话活动，用于空闲检测
    this.ctx.on?.('session/event', () => {
      this.lastActivityAt = Date.now()
      this.resetIdleTimer()
    })

    this.log('info', 'Dreaming engine initialized')
  }

  /** 销毁：清理定时器 */
  async dispose(): Promise<void> {
    this.stopSchedule()
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    this.log('info', 'Dreaming engine disposed')
  }

  // ============================================================
  // 公开 API
  // ============================================================

  /**
   * 手动启动 Dreaming
   */
  async startDreaming(triggerType: 'manual' | 'scheduled' | 'idle' = 'manual'): Promise<DreamingRun> {
    if (this.running && this.currentRun) {
      throw new Error('Dreaming is already running')
    }

    const run: DreamingRun = {
      id: `dream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: DreamingStatus.HEALTH_CHECK,
      phase: DreamingPhase.HEALTH_CHECK,
      triggerType,
      startedAt: Date.now(),
      improvementSuggestions: [],
      darwinOptimizationsStarted: 0,
      taotieFusionsStarted: 0,
      autoArchivedCount: 0,
      progress: 0,
      currentStepDescription: 'Starting dreaming session...',
    }

    this.currentRun = run
    this.running = true
    this.stopRequested = false

    this.log('info', `Dreaming started: ${run.id} (trigger=${triggerType})`)

    // 异步执行完整流程
    this.runFullDreaming(run).catch(err => {
      this.log('error', `Dreaming run failed: ${err.message}`)
      run.status = DreamingStatus.FAILED
      run.failureReason = err.message
      run.completedAt = Date.now()
      this.running = false
      this.saveHistory()
    })

    return run
  }

  /**
   * 停止当前运行的 Dreaming
   */
  stopDreaming(reason?: string): boolean {
    if (!this.running || !this.currentRun) return false

    this.stopRequested = true
    this.currentRun.status = DreamingStatus.STOPPED
    this.currentRun.failureReason = reason || 'Manually stopped'
    this.currentRun.completedAt = Date.now()

    this.log('info', `Dreaming stop requested: ${this.currentRun.id}`)
    return true
  }

  /** 获取当前运行状态 */
  getCurrentRun(): DreamingRun | null {
    return this.currentRun
  }

  /** 获取历史记录 */
  getHistory(limit = 20): DreamingRun[] {
    const all = [...this.history]
    if (this.currentRun) {
      all.unshift(this.currentRun)
    }
    return all.slice(0, limit)
  }

  /**
   * 生成技能库健康报告（不启动完整 Dreaming，只做体检）
   */
  async generateHealthReport(): Promise<SkillLibraryHealthReport> {
    return this.runHealthCheck()
  }

  // ============================================================
  // 定时调度
  // ============================================================

  /** 启动 cron 调度（每分钟检查一次是否到点） */
  private startSchedule(): void {
    if (this.scheduleTimer) return

    // 每分钟检查一次 cron 表达式
    this.scheduleTimer = setInterval(() => {
      this.checkSchedule().catch(err => {
        this.log('warn', `Schedule check failed: ${err.message}`)
      })
    }, 60 * 1000)

    this.log('info', `Dreaming schedule started: ${this.config.dreamingSchedule}`)

    // 启动时也重置空闲计时器
    this.resetIdleTimer()
  }

  private stopSchedule(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer)
      this.scheduleTimer = null
    }
  }

  /** 检查是否到了 cron 调度时间 */
  private async checkSchedule(): Promise<void> {
    if (!this.config.enableDreaming) return
    if (this.running) return

    const now = new Date()
    const cron = this.config.dreamingSchedule || '0 3 * * 0'

    if (this.matchCron(now, cron)) {
      this.log('info', 'Scheduled dreaming triggered by cron')
      await this.startDreaming('scheduled')
    }
  }

  /**
   * 极简 cron 匹配（支持 5 段：分 时 日 月 周）
   * 只支持 *、数字、列表（逗号分隔）、范围（a-b）
   * 足够用于 Dreaming 调度，不做完整 cron 解析
   */
  private matchCron(date: Date, cronExpr: string): boolean {
    const parts = cronExpr.trim().split(/\s+/)
    if (parts.length !== 5) return false

    const [minPart, hourPart, dayPart, monthPart, weekPart] = parts as [string, string, string, string, string]
    const minute = date.getMinutes()
    const hour = date.getHours()
    const day = date.getDate()
    const month = date.getMonth() + 1
    // JS getDay(): 0=周日, 1=周一... cron: 0=周日, 1=周一... 一致
    const weekday = date.getDay()

    return (
      this.matchCronField(minute, minPart as string, 0, 59) &&
      this.matchCronField(hour, hourPart as string, 0, 23) &&
      this.matchCronField(day, dayPart as string, 1, 31) &&
      this.matchCronField(month, monthPart as string, 1, 12) &&
      this.matchCronField(weekday, weekPart as string, 0, 6)
    )
  }

  private matchCronField(value: number, expr: string, min: number, max: number): boolean {
    if (expr === '*') return true

    // 列表：a,b,c
    if (expr.includes(',')) {
      return expr.split(',').some(part => this.matchCronField(value, part.trim(), min, max))
    }

    // 范围：a-b
    if (expr.includes('-')) {
      const [startStr, endStr] = expr.split('-')
      const start = parseInt(startStr!, 10)
      const end = parseInt(endStr!, 10)
      if (isNaN(start) || isNaN(end)) return false
      return value >= start && value <= end
    }

    // 单个数字
    const num = parseInt(expr, 10)
    if (isNaN(num)) return false
    return value === num
  }

  // ============================================================
  // 空闲检测
  // ============================================================

  /** 重置空闲计时器（每次有活动时调用） */
  private resetIdleTimer(): void {
    if (!this.config.enableDreaming) return

    const idleMinutes = (this.config as any).dreamingIdleThresholdMinutes ?? 0
    if (idleMinutes <= 0) return // 0 表示禁用空闲触发

    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
    }

    this.idleTimer = setTimeout(() => {
      this.handleIdle().catch(err => {
        this.log('warn', `Idle dreaming trigger failed: ${err.message}`)
      })
    }, idleMinutes * 60 * 1000)
  }

  /** 空闲超时处理 */
  private async handleIdle(): Promise<void> {
    if (this.running) return
    if (!this.config.enableDreaming) return

    this.log('info', 'Idle dreaming triggered')
    await this.startDreaming('idle')
  }

  // ============================================================
  // 核心：完整 Dreaming 流程
  // ============================================================

  private async runFullDreaming(run: DreamingRun): Promise<void> {
    try {
      // Phase 1: 健康体检
      this.updateProgress(run, DreamingStatus.HEALTH_CHECK, DreamingPhase.HEALTH_CHECK, 10, 'Running skill library health check...')
      if (this.stopRequested) { this.finishStopped(run); return }

      const healthReport = await this.runHealthCheck()
      run.healthReport = healthReport
      this.log('info', `Health check complete: ${healthReport.totalSkills} skills, avg quality=${healthReport.avgQualityScore.toFixed(3)}`)

      // Phase 2: 相似度扫描
      this.updateProgress(run, DreamingStatus.SIMILARITY_SCAN, DreamingPhase.SIMILARITY_SCAN, 25, 'Scanning for similar skill groups...')
      if (this.stopRequested) { this.finishStopped(run); return }

      const similarGroups = this.deps.taotie?.detectSimilarSkills?.() ?? []
      this.log('info', `Similarity scan complete: ${similarGroups.length} groups found`)

      // Phase 3: 生成改进建议
      this.updateProgress(run, DreamingStatus.SUGGESTING, DreamingPhase.SUGGESTION, 40, 'Generating improvement suggestions...')
      if (this.stopRequested) { this.finishStopped(run); return }

      const suggestions = await this.generateImprovementSuggestions(healthReport)
      run.improvementSuggestions = suggestions
      this.log('info', `Generated ${suggestions.length} improvement suggestions`)

      // Phase 4: 自动优化低分技能（达尔文模式）
      const autoOptThreshold = (this.config as any).dreamingAutoOptimizeThreshold ?? 0.0
      if (autoOptThreshold > 0) {
        this.updateProgress(run, DreamingStatus.OPTIMIZING, DreamingPhase.OPTIMIZATION, 55, 'Auto-optimizing low-score skills...')
        if (this.stopRequested) { this.finishStopped(run); return }

        const optimized = await this.autoOptimizeLowScoreSkills(healthReport, autoOptThreshold)
        run.darwinOptimizationsStarted = optimized
        this.log('info', `Started ${optimized} Darwin optimization runs`)
      }

      // Phase 5: 自动融合相似技能（饕餮模式）
      const autoFusion = (this.config as any).dreamingAutoFusion ?? false
      if (autoFusion && similarGroups.length > 0) {
        this.updateProgress(run, DreamingStatus.FUSING, DreamingPhase.FUSION, 75, 'Auto-fusing similar skill groups...')
        if (this.stopRequested) { this.finishStopped(run); return }

        const fused = await this.autoFuseSimilarGroups(similarGroups)
        run.taotieFusionsStarted = fused
        this.log('info', `Started ${fused} Taotie fusion runs`)
      }

      // Phase 6: 自动归档僵尸技能
      const autoArchiveDays = (this.config as any).dreamingAutoArchiveDays ?? 0
      if (autoArchiveDays > 0) {
        this.updateProgress(run, DreamingStatus.GENERATING_REPORT, DreamingPhase.REPORT, 90, 'Archiving stale skills...')
        if (this.stopRequested) { this.finishStopped(run); return }

        const archived = await this.autoArchiveStaleSkills(autoArchiveDays)
        run.autoArchivedCount = archived
        this.log('info', `Auto-archived ${archived} stale skills`)
      }

      // 完成
      this.updateProgress(run, DreamingStatus.COMPLETED, DreamingPhase.REPORT, 100, 'Dreaming complete')
      run.completedAt = Date.now()
      this.log('info', `Dreaming complete: ${run.id}`)

    } catch (err) {
      run.status = DreamingStatus.FAILED
      run.failureReason = (err as Error).message
      run.completedAt = Date.now()
      this.log('error', `Dreaming failed: ${(err as Error).message}`)
    } finally {
      this.running = false
      this.saveHistory()
    }
  }

  private finishStopped(run: DreamingRun): void {
    run.status = DreamingStatus.STOPPED
    run.completedAt = Date.now()
    this.log('info', `Dreaming stopped: ${run.id}`)
    this.running = false
    this.saveHistory()
  }

  private updateProgress(
    run: DreamingRun,
    status: DreamingStatus,
    phase: DreamingPhase,
    progress: number,
    description: string,
  ): void {
    run.status = status
    run.phase = phase
    run.progress = progress
    run.currentStepDescription = description
  }

  // ============================================================
  // Phase 1: 健康体检
  // ============================================================

  private async runHealthCheck(): Promise<SkillLibraryHealthReport> {
    const skills: Skill[] = this.deps.registry.listSkills(SkillStatus.ACTIVE)
    const archived: Skill[] = this.deps.registry.listSkills(SkillStatus.ARCHIVED)
    const now = Date.now()

    // 质量分布
    let excellent = 0, good = 0, fair = 0, poor = 0
    let totalQuality = 0
    let usedIn30Days = 0
    let unusedIn30Days = 0

    for (const skill of skills) {
      const qs = skill.verificationScore ?? skill.frontmatter.qualityScore ?? 0
      totalQuality += qs

      if (qs >= 0.85) excellent++
      else if (qs >= 0.7) good++
      else if (qs >= 0.5) fair++
      else poor++

      const lastUsed = skill.lastUsedAt ?? skill.frontmatter.lastUsedAt ?? 0
      const daysSinceUse = (now - lastUsed) / (24 * 60 * 60 * 1000)
      if (lastUsed === 0 || daysSinceUse > 30) {
        unusedIn30Days++
      } else {
        usedIn30Days++
      }
    }

    const totalSkills = skills.length + archived.length
    const avgQuality = skills.length > 0 ? totalQuality / skills.length : 0
    const zombieRatio = skills.length > 0 ? unusedIn30Days / skills.length : 0

    // 相似度检测（用于报告中的重复率）
    const similarGroups = this.deps.taotie?.detectSimilarSkills?.() ?? []
    let duplicatedSkills = 0
    for (const group of similarGroups) {
      duplicatedSkills += group.skills.length
    }
    const duplicateRatio = skills.length > 0 ? Math.min(duplicatedSkills / skills.length, 1) : 0

    // Top 改进目标：质量分最低 + 有一定使用量的技能
    const sortedByQuality = [...skills]
      .sort((a, b) => (a.verificationScore ?? a.frontmatter.qualityScore ?? 0) - (b.verificationScore ?? b.frontmatter.qualityScore ?? 0))

    const topImprovementTargets = sortedByQuality
      .slice(0, 5)
      .map(skill => {
        const score = skill.verificationScore ?? skill.frontmatter.qualityScore ?? 0
        const usageCount = skill.usageCount ?? 0
        let reason = ''
        let priority: 'high' | 'medium' | 'low' = 'medium'

        if (score < 0.5) {
          reason = '质量评分低'
          priority = 'high'
        } else if (score < 0.7) {
          reason = '质量评分中等偏下'
          priority = 'medium'
        } else {
          reason = '有提升空间'
          priority = 'low'
        }

        if (usageCount > 5) {
          reason += `，使用频率高（${usageCount}次）`
          if (priority === 'medium') priority = 'high'
        }

        return {
          skillName: skill.frontmatter.name,
          qualityScore: score,
          reason,
          priority,
        }
      })

    // Top 归档候选：30天以上未使用 + 质量低的
    const staleSkills: Skill[] = skills
      .filter((s: Skill) => {
        const lastUsed = s.lastUsedAt ?? s.frontmatter.lastUsedAt ?? 0
        return lastUsed === 0 || (now - lastUsed) > THIRTY_DAYS_MS
      })
      .sort((a: Skill, b: Skill) => {
        const aUsed = a.lastUsedAt ?? a.frontmatter.lastUsedAt ?? 0
        const bUsed = b.lastUsedAt ?? b.frontmatter.lastUsedAt ?? 0
        return aUsed - bUsed
      })

    const topArchiveCandidates = staleSkills.slice(0, 5).map(skill => {
      const lastUsed = skill.lastUsedAt ?? skill.frontmatter.lastUsedAt ?? 0
      const days = lastUsed === 0 ? 999 : Math.floor((now - lastUsed) / (24 * 60 * 60 * 1000))
      const score = skill.verificationScore ?? skill.frontmatter.qualityScore ?? 0
      let reason = score < 0.5 ? '低质量且长期未使用' : '长期未使用'
      return {
        skillName: skill.frontmatter.name,
        reason,
        daysSinceLastUse: days,
      }
    })

    return {
      totalSkills,
      activeSkills: skills.length,
      archivedSkills: archived.length,
      avgQualityScore: avgQuality,
      qualityDistribution: { excellent, good, fair, poor },
      usedIn30Days,
      unusedIn30Days,
      zombieRatio,
      similarGroups: similarGroups.length,
      duplicateRatio,
      topImprovementTargets,
      topArchiveCandidates,
      generatedAt: now,
    }
  }

  // ============================================================
  // Phase 3: 生成改进建议
  // ============================================================

  private async generateImprovementSuggestions(
    healthReport: SkillLibraryHealthReport,
  ): Promise<SkillImprovementSuggestion[]> {
    const maxSuggestions = (this.config as any).dreamingMaxSuggestions ?? 10
    const allSkills: Skill[] = this.deps.registry.listSkills(SkillStatus.ACTIVE)

    // 按质量分从低到高排序，优先给低分技能生成建议
    const sorted = [...allSkills].sort((a: Skill, b: Skill) =>
      (a.verificationScore ?? a.frontmatter.qualityScore ?? 0) -
      (b.verificationScore ?? b.frontmatter.qualityScore ?? 0)
    )

    const candidates = sorted.slice(0, maxSuggestions)
    const suggestions: SkillImprovementSuggestion[] = []

    for (const skill of candidates) {
      if (this.stopRequested) break

      try {
        const suggestion = await this.generateSingleSuggestion(skill)
        if (suggestion) {
          suggestions.push(suggestion)
        }
      } catch (err) {
        this.log('warn', `Failed to generate suggestion for ${skill.frontmatter.name}: ${(err as Error).message}`)
      }
    }

    return suggestions
  }

  /**
   * 为单个技能生成改进建议
   * 基于启发式规则（不调用 LLM，避免 Dreaming 太慢 / 太耗 token）
   * 如需 LLM 级别建议，可以通过达尔文模式深入优化
   */
  private generateSingleSuggestion(skill: Skill): SkillImprovementSuggestion {
    const score = skill.verificationScore ?? skill.frontmatter.qualityScore ?? 0
    const bodyLength = skill.body?.length ?? 0
    const frontmatter = skill.frontmatter

    const suggestions: SkillImprovementSuggestion['suggestions'] = []

    // 启发式 1: frontmatter 完整性检查
    let fmScore = 0
    let fmMax = 0
    fmMax++; if (frontmatter.description && frontmatter.description.length > 20) fmScore++
    fmMax++; if (frontmatter.whenToUse && frontmatter.whenToUse.length > 10) fmScore++
    fmMax++; if (frontmatter.tags && frontmatter.tags.length > 0) fmScore++
    fmMax++; if (frontmatter.version) fmScore++
    fmMax++; if (frontmatter.category) fmScore++
    const fmRatio = fmMax > 0 ? fmScore / fmMax : 0

    if (fmRatio < 0.8) {
      const missing: string[] = []
      if (!frontmatter.description || frontmatter.description.length <= 20) missing.push('description')
      if (!frontmatter.whenToUse || frontmatter.whenToUse.length <= 10) missing.push('whenToUse')
      if (!frontmatter.tags || frontmatter.tags.length === 0) missing.push('tags')
      if (!frontmatter.version) missing.push('version')
      if (!frontmatter.category) missing.push('category')
      suggestions.push({
        dimension: 'frontmatter_completeness',
        currentScore: fmRatio,
        suggestion: `补齐 frontmatter 字段：${missing.join('、')}`,
        expectedGain: 0.05,
      })
    }

    // 启发式 2: 正文长度 / 结构检查
    if (bodyLength < 500) {
      suggestions.push({
        dimension: 'practicality',
        currentScore: Math.min(1, bodyLength / 1000),
        suggestion: '正文内容过少，建议补充详细操作步骤、注意事项和验证方法',
        expectedGain: 0.1,
      })
    }

    // 启发式 3: 是否有验证方法章节
    const hasVerification = /验证|测试|check|verify/i.test(skill.body || '')
    if (!hasVerification) {
      suggestions.push({
        dimension: 'verification_completeness',
        currentScore: 0.3,
        suggestion: '缺少验证方法章节，建议补充如何确认技能使用正确的判断标准',
        expectedGain: 0.08,
      })
    }

    // 启发式 4: 是否有注意事项/边界情况
    const hasCaveats = /注意|坑|边界|warning|caution|注意事项/i.test(skill.body || '')
    if (!hasCaveats) {
      suggestions.push({
        dimension: 'operationality',
        currentScore: 0.5,
        suggestion: '缺少注意事项和常见坑点，建议补充失败模式和边界情况处理',
        expectedGain: 0.06,
      })
    }

    // 启发式 5: 触发条件清晰度
    const hasTrigger = /触发|什么时候|when to use|使用场景|适用场景/i.test(skill.body || '')
    if (!hasTrigger) {
      suggestions.push({
        dimension: 'trigger_quality',
        currentScore: 0.4,
        suggestion: '缺少明确的触发条件和适用场景描述，建议补充何时应该调用这个技能',
        expectedGain: 0.07,
      })
    }

    // 计算优先级
    let priority: 'high' | 'medium' | 'low' = 'medium'
    const totalExpectedGain = suggestions.reduce((sum, s) => sum + s.expectedGain, 0)
    if (score < 0.6 || totalExpectedGain >= 0.15) priority = 'high'
    else if (score >= 0.8 || totalExpectedGain < 0.05) priority = 'low'

    // 总体建议
    let overallRecommendation = ''
    if (suggestions.length === 0) {
      overallRecommendation = '技能结构完整，建议使用达尔文模式进行深度优化'
    } else {
      overallRecommendation = `建议优先改进 ${suggestions[0]!.suggestion.slice(0, 40)}${suggestions[0]!.suggestion.length > 40 ? '...' : ''}`
    }

    return {
      skillId: skill.id,
      skillName: skill.frontmatter.name,
      currentScore: score,
      suggestions,
      overallRecommendation,
      priority,
      generatedAt: Date.now(),
    }
  }

  // ============================================================
  // Phase 4: 自动优化低分技能
  // ============================================================

  private async autoOptimizeLowScoreSkills(
    healthReport: SkillLibraryHealthReport,
    threshold: number,
  ): Promise<number> {
    if (!this.deps.darwin?.startOptimization) return 0

    const maxConcurrent = (this.config as any).dreamingMaxConcurrentOptimizations ?? 2
    const autoApprove = (this.config as any).dreamingDarwinAutoApprove ?? false

    const skills: Skill[] = this.deps.registry.listSkills(SkillStatus.ACTIVE)
    const lowScoreSkills = skills
      .filter((s: Skill) => {
        const score = s.verificationScore ?? s.frontmatter.qualityScore ?? 0
        return score < threshold && score > 0 // 只优化已有评分的技能
      })
      .sort((a: Skill, b: Skill) => {
        // 优先优化使用频率高的（改进收益更大）
        const aUsage = a.usageCount ?? 0
        const bUsage = b.usageCount ?? 0
        return bUsage - aUsage
      })
      .slice(0, maxConcurrent)

    let started = 0
    for (const skill of lowScoreSkills) {
      if (this.stopRequested) break
      try {
        await this.deps.darwin.startOptimization(
          skill.frontmatter.name,
          undefined, // 自动选择低分维度
          autoApprove,
        )
        started++
      } catch (err) {
        this.log('warn', `Failed to start Darwin optimization for ${skill.frontmatter.name}: ${(err as Error).message}`)
      }
    }

    return started
  }

  // ============================================================
  // Phase 5: 自动融合相似技能组
  // ============================================================

  private async autoFuseSimilarGroups(groups: SimilarSkillGroup[]): Promise<number> {
    if (!this.deps.taotie?.startFusion) return 0
    if (groups.length === 0) return 0

    const autoApprove = (this.config as any).dreamingTaotieAutoApprove ?? false
    const maxConcurrent = (this.config as any).dreamingMaxConcurrentOptimizations ?? 2

    let started = 0
    // 只处理相似度最高的几个组
    const topGroups = groups.slice(0, maxConcurrent)

    for (const group of topGroups) {
      if (this.stopRequested) break
      if (group.skills.length < 2) continue

      try {
        const target = group.recommendedTarget || group.skills[0]!
        const source = group.recommendedSource || group.skills[1]!
        if (target === source) continue

        await this.deps.taotie.startFusion(target, source, autoApprove)
        started++
      } catch (err) {
        this.log('warn', `Failed to start Taotie fusion for group: ${(err as Error).message}`)
      }
    }

    return started
  }

  // ============================================================
  // Phase 6: 自动归档僵尸技能
  // ============================================================

  private async autoArchiveStaleSkills(daysThreshold: number): Promise<number> {
    const skills: Skill[] = this.deps.registry.listSkills(SkillStatus.ACTIVE)
    const now = Date.now()
    const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000

    let archived = 0
    for (const skill of skills) {
      if (this.stopRequested) break

      const lastUsed = skill.lastUsedAt ?? skill.frontmatter.lastUsedAt ?? 0
      // 从未使用过 且 创建超过 threshold 天的也归档
      const age = now - (skill.createdAt ?? now)
      const isStale = (lastUsed > 0 && (now - lastUsed) > thresholdMs)
        || (lastUsed === 0 && age > thresholdMs)

      if (isStale) {
        try {
          await this.deps.registry.archiveSkill(skill.id)
          archived++
        } catch (err) {
          this.log('warn', `Failed to archive skill ${skill.frontmatter.name}: ${(err as Error).message}`)
        }
      }
    }

    return archived
  }

  // ============================================================
  // 持久化
  // ============================================================

  private saveTimeout: any = null

  private saveHistory(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout)
    this.saveTimeout = setTimeout(async () => {
      try {
        const fs = await import('node:fs/promises')
        // 只保留最近 20 条
        const toSave = [...this.history]
        if (this.currentRun) {
          toSave.unshift(this.currentRun)
        }
        const data = toSave.slice(0, 20)
        await fs.writeFile(
          `${this.storagePath}/dreaming-history.json`,
          JSON.stringify(data, null, 2),
          'utf-8',
        )
      } catch (err) {
        this.log('warn', `Failed to save dreaming history: ${(err as Error).message}`)
      }
    }, 500)
  }
}
