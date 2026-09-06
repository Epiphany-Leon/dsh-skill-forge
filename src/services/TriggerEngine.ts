/**
 * TriggerEngine —— 触发引擎
 *
 * 监听 DSH 的 session 事件流，支持两种触发模式：
 * 1. 增量式经验积累 + 密度阈值触发（默认）：每轮对话提取经验痕迹，
 *    累积到一定密度立即触发锻造，不等会话结束。
 * 2. 会话 idle 兜底触发：5 分钟无新事件时，如果累积密度超过阈值也触发。
 *
 * 事件来源：DSH core 的 `session/event` firehose（全局 ctx.on 订阅）。
 */

import { BaseService } from './BaseService.js'
import {
  TriggerMode,
  type ForgeRun,
  type SkillForgeConfig,
  type ExperienceTrace,
  type TriggerEngineStats,
} from '../types.js'

export interface TriggerEngineDeps {
  /** 触发成功后调用，启动自动锻造流水线 */
  startAutoForge: (sessionIds: string[], summary: string) => Promise<string | null>
}

/** 单会话的经验累积器 */
interface SessionAccumulator {
  sessionId: string
  /** 每轮的经验痕迹（按时间顺序） */
  traces: ExperienceTrace[]
  /** 累积复杂度总分（带时间衰减） */
  cumulativeComplexity: number
  /** 累积工具调用总数 */
  cumulativeToolCalls: number
  /** 迭代轮数（有实质工具调用的轮次） */
  iterationCount: number
  /** 最后一个 turn 的工具名集合，用于检测新方法 */
  lastToolNames: Set<string>
  /** 最后活动时间 */
  lastActivityAt: number
  /** 上一次锻造触发时间（0 表示未触发过） */
  lastForgedAt: number
  /** 上一个 turn 内是否有错误，用于检测 error→fix 模式 */
  lastTurnHadError: boolean
}

export class TriggerEngine extends BaseService {
  private sessionTraces: Map<string, any[]> = new Map()
  private lastActivityAt: Map<string, number> = new Map()
  private sessionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private running: boolean = false
  private deps: TriggerEngineDeps

  /** 会话静默多久后视为「结束」，触发自动评估（毫秒） */
  private readonly sessionIdleMs = 5 * 60 * 1000

  /** 已触发锻造的会话痕迹最长保留时间（毫秒），防止泄漏 */
  private readonly maxTraceAgeMs = 30 * 60 * 1000

  /** 同时存在的最大追踪会话数，超出则丢弃最旧的 */
  private readonly maxTrackedSessions = 50

  /** 密度计算的时间窗口（毫秒）—— 1 小时 */
  private readonly densityWindowMs = 60 * 60 * 1000

  /** 时间衰减半衰期（毫秒）—— 24 小时，超过一半权重 */
  private readonly decayHalfLifeMs = 24 * 60 * 60 * 1000

  // ============================================================
  // 增量式经验积累
  // ============================================================

  /** 每个 session 的经验累积器 */
  private accumulators: Map<string, SessionAccumulator> = new Map()

  /** 统计计数器 */
  private _incrementalTriggers = 0
  private _idleTriggers = 0

  private onSessionEventBound: (session: any, event: any) => void
  private onSessionDisposedBound: (session: any) => void

  constructor(ctx: any, config: SkillForgeConfig, deps: TriggerEngineDeps) {
    super(ctx, config)
    this.deps = deps
    this.onSessionEventBound = this.onSessionEvent.bind(this)
    this.onSessionDisposedBound = this.onSessionDisposed.bind(this)
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    // 订阅 DSH 的 session 事件 firehose
    // 事件签名：(session: Session, event: SessionEvent) => void
    // 来源：@deepseek-ai/dsh-session 的 session/event 事件
    this.ctx.on('session/event', this.onSessionEventBound)

    // 会话结束时立即评估（不需要等空闲超时）
    this.ctx.on('session/disposed', this.onSessionDisposedBound)

    this.log('info', 'Trigger engine started')
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false

    this.ctx.off?.('session/event', this.onSessionEventBound)
    this.ctx.off?.('session/disposed', this.onSessionDisposedBound)

    // 清理所有定时器
    for (const timer of this.sessionTimers.values()) {
      clearTimeout(timer)
    }
    this.sessionTimers.clear()

    this.log('info', 'Trigger engine stopped')
  }

  /**
   * 评估是否值得锻造（Gate 0）
   * 返回 true 表示值得锻造
   */
  async evaluateForgeWorthiness(run: ForgeRun): Promise<boolean> {
    if (!this.config.autoTrigger) return false

    if (run.triggerMode === TriggerMode.MANUAL) {
      return true
    }

    // 自动触发模式：基于工具调用数量 + 置信度阈值做启发式判断
    const sessionIds = run.sourceSessionIds
    const toolCallCount = this.countToolCalls(sessionIds)
    const turnCount = this.countTurns(sessionIds)
    const score = this.computeWorthinessScore(sessionIds)

    this.log('debug', `Worthiness evaluation: toolCalls=${toolCallCount}, turns=${turnCount}, score=${score.toFixed(2)}, threshold=${this.config.triggerThreshold}`)

    if (score < this.config.triggerThreshold) {
      this.log('debug', `Auto-trigger skipped: score ${score.toFixed(2)} below threshold ${this.config.triggerThreshold}`)
      return false
    }

    this.log('info', `Auto-trigger worthiness passed: score=${score.toFixed(2)}`)
    return true
  }

  // ============================================================
  // 统计
  // ============================================================

  /** 获取触发引擎运行时统计 */
  getStats(): TriggerEngineStats {
    return {
      incrementalTriggers: this._incrementalTriggers,
      idleTriggers: this._idleTriggers,
      trackedSessions: this.accumulators.size,
    }
  }

  // ============================================================
  // 事件处理
  // ============================================================

  private onSessionEvent(session: any, event: any): void {
    if (!this.running || !this.config.autoTrigger) return

    const sessionId = session?.id
    if (!sessionId) return

    // 只处理有意义的事件类型
    const trackedTypes = new Set([
      'turn/start',
      'turn/end',
      'user/message',
      'assistant/message',
      'tool/call',
      'tool/result',
      'step/end',
    ])
    if (!trackedTypes.has(event.type)) return

    // 累积原始痕迹（保留给旧评分逻辑使用）
    let traces = this.sessionTraces.get(sessionId) || []
    traces.push({
      type: event.type,
      data: event.data,
      time: event.time || Date.now(),
    })
    this.sessionTraces.set(sessionId, traces)
    this.lastActivityAt.set(sessionId, Date.now())

    // 增量式经验积累：turn/end 时提取本轮经验痕迹
    if (this.config.enableIncrementalAccumulation && event.type === 'turn/end') {
      this.extractAndAccumulate(sessionId, traces)
    }

    // 重置空闲定时器
    const existing = this.sessionTimers.get(sessionId)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.handleSessionIdle(sessionId).catch(e =>
        this.log('error', `Session idle handler failed: ${(e as Error).message}`),
      )
    }, this.sessionIdleMs)
    this.sessionTimers.set(sessionId, timer)

    // 控制内存：超过最大会话数时丢弃最旧的
    if (this.sessionTraces.size > this.maxTrackedSessions) {
      let oldestId: string | null = null
      let oldestTime = Infinity
      for (const [id, time] of this.lastActivityAt.entries()) {
        if (time < oldestTime) {
          oldestTime = time
          oldestId = id
        }
      }
      if (oldestId) {
        this.cleanupSession(oldestId)
      }
    }
  }

  /**
   * 会话销毁时立即评估（如果尚未评估）
   * 比等待 5 分钟空闲超时更快触发锻造
   */
  private onSessionDisposed(session: any): void {
    if (!this.running || !this.config.autoTrigger) return

    const sessionId = session?.id
    if (!sessionId) return

    // 如果有正在等待的空闲定时器，立即触发评估
    const timer = this.sessionTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.sessionTimers.delete(sessionId)
      this.handleSessionIdle(sessionId).catch(e =>
        this.log('error', `Session disposed handler failed: ${(e as Error).message}`),
      )
    }
  }

  // ============================================================
  // 增量式经验积累 — 核心逻辑
  // ============================================================

  /**
   * 从当前轮的痕迹中提取经验信号，并累积到会话累积器。
   * 提取后检查密度阈值，超过则立即触发锻造。
   */
  private extractAndAccumulate(sessionId: string, allTraces: any[]): void {
    const acc = this.getOrCreateAccumulator(sessionId)

    // 找到当前轮（最后一个 turn/start 之后的所有事件）
    const lastTurnStartIdx = this.findLastTurnStartIndex(allTraces)
    const turnTraces = lastTurnStartIdx >= 0
      ? allTraces.slice(lastTurnStartIdx)
      : allTraces

    const trace = this.extractTurnTrace(turnTraces, acc)
    acc.traces.push(trace)
    acc.cumulativeComplexity += trace.complexityScore
    acc.cumulativeToolCalls += trace.toolCallsCount
    if (trace.toolCallsCount > 0) {
      acc.iterationCount += 1
    }
    acc.lastActivityAt = trace.timestamp
    acc.lastTurnHadError = trace.hasErrorFix

    // 更新本轮使用的工具名集合（用于下一轮判断 hasNewApproach）
    const turnToolNames = new Set(
      turnTraces
        .filter((t: any) => t.type === 'tool/call')
        .map((t: any) => t.data?.name)
        .filter(Boolean),
    )
    acc.lastToolNames = turnToolNames

    // 计算当前密度（带时间衰减）
    const density = this.computeCurrentDensity(acc)

    this.log('debug',
      `Turn trace extracted for ${sessionId}: ` +
      `toolCalls=${trace.toolCallsCount}, ` +
      `complexity=${trace.complexityScore.toFixed(2)}, ` +
      `density=${density.toFixed(2)}/${this.config.densityThreshold}`,
    )

    // 密度阈值触发：立即触发锻造（带冷却检查）
    if (density >= this.config.densityThreshold) {
      const cooldownMs = this.config.minForgingIntervalMinutes * 60 * 1000
      const timeSinceLastForge = Date.now() - acc.lastForgedAt
      if (acc.lastForgedAt === 0 || timeSinceLastForge >= cooldownMs) {
        this.triggerIncrementalForge(sessionId, acc, density).catch(e =>
          this.log('error', `Incremental forge failed: ${(e as Error).message}`),
        )
      } else {
        this.log('debug',
          `Density threshold met but in cooldown for ${sessionId}: ` +
          `${(timeSinceLastForge / 60000).toFixed(1)}min / ${this.config.minForgingIntervalMinutes}min`,
        )
      }
    }
  }

  /** 获取或创建会话累积器 */
  private getOrCreateAccumulator(sessionId: string): SessionAccumulator {
    let acc = this.accumulators.get(sessionId)
    if (!acc) {
      acc = {
        sessionId,
        traces: [],
        cumulativeComplexity: 0,
        cumulativeToolCalls: 0,
        iterationCount: 0,
        lastToolNames: new Set(),
        lastActivityAt: Date.now(),
        lastForgedAt: 0,
        lastTurnHadError: false,
      }
      this.accumulators.set(sessionId, acc)
    }
    return acc
  }

  /** 找到最后一个 turn/start 事件的索引 */
  private findLastTurnStartIndex(traces: any[]): number {
    for (let i = traces.length - 1; i >= 0; i--) {
      if (traces[i]?.type === 'turn/start') return i
    }
    return -1
  }

  /**
   * 从单轮痕迹中提取经验信号
   */
  private extractTurnTrace(turnTraces: any[], acc: SessionAccumulator): ExperienceTrace {
    const toolCalls = turnTraces.filter((t: any) => t.type === 'tool/call')
    const toolCallsCount = toolCalls.length

    // 是否有错误（tool/result 带 error）
    const toolErrors = turnTraces.filter(
      (t: any) => t.type === 'tool/result' && t.data?.error,
    )
    const hasError = toolErrors.length > 0

    // has_error_fix：上一轮有错误，本轮有工具调用（尝试修复）
    const hasErrorFix = acc.lastTurnHadError && toolCallsCount > 0

    // has_new_approach：本轮使用了之前没见过的工具
    const currentToolNames = new Set(
      toolCalls.map((t: any) => t.data?.name).filter(Boolean),
    )
    let hasNewApproach = false
    if (acc.lastToolNames.size > 0 && currentToolNames.size > 0) {
      for (const name of currentToolNames) {
        if (!acc.lastToolNames.has(name)) {
          hasNewApproach = true
          break
        }
      }
    }

    // has_iteration：本轮有工具调用且之前也有过迭代（持续优化）
    const hasIteration = toolCallsCount > 0 && acc.iterationCount >= 1

    // 复杂度评分（0-1）
    const complexityScore = this.computeTurnComplexity(
      toolCallsCount,
      currentToolNames.size,
      hasError,
      hasNewApproach,
      hasIteration,
    )

    return {
      toolCallsCount,
      hasErrorFix,
      hasNewApproach,
      hasIteration,
      complexityScore,
      timestamp: Date.now(),
    }
  }

  /**
   * 计算单轮复杂度得分（0-1）
   * 维度：工具调用数、工具多样性、错误调试、新方法尝试、迭代深度
   */
  private computeTurnComplexity(
    toolCallsCount: number,
    toolDiversity: number,
    hasError: boolean,
    hasNewApproach: boolean,
    hasIteration: boolean,
  ): number {
    // 工具调用数量分（0-0.4）
    const countScore = Math.min(toolCallsCount / 10, 1) * 0.4
    // 工具多样性分（0-0.25）
    const diversityScore = Math.min(toolDiversity / 4, 1) * 0.25
    // 错误调试加分（0-0.15）
    const errorScore = hasError ? 0.15 : 0
    // 新方法加分（0-0.1）
    const newApproachScore = hasNewApproach ? 0.1 : 0
    // 迭代加分（0-0.1）
    const iterationScore = hasIteration ? 0.1 : 0

    return Math.min(
      countScore + diversityScore + errorScore + newApproachScore + iterationScore,
      1,
    )
  }

  /**
   * 计算当前经验密度（复杂度分 / 小时）
   * 带时间衰减：24 小时前的痕迹权重减半
   */
  private computeCurrentDensity(acc: SessionAccumulator): number {
    const now = Date.now()
    const windowStart = now - this.densityWindowMs
    let weightedSum = 0

    for (const trace of acc.traces) {
      if (trace.timestamp < windowStart) continue
      const ageMs = now - trace.timestamp
      // 指数衰减：weight = 0.5 ^ (age / halfLife)
      const weight = Math.pow(0.5, ageMs / this.decayHalfLifeMs)
      weightedSum += trace.complexityScore * weight
    }

    // 密度 = 加权复杂度总分 / 时间窗口（小时）
    const windowHours = this.densityWindowMs / (60 * 60 * 1000)
    return weightedSum / windowHours
  }

  /**
   * 增量触发锻造
   */
  private async triggerIncrementalForge(
    sessionId: string,
    acc: SessionAccumulator,
    density: number,
  ): Promise<void> {
    this.log('info',
      `Incremental trigger for ${sessionId}: density=${density.toFixed(2)}, ` +
      `iterations=${acc.iterationCount}, toolCalls=${acc.cumulativeToolCalls}`,
    )

    const traces = this.sessionTraces.get(sessionId) || []
    const toolCallCount = traces.filter((t: any) => t.type === 'tool/call').length
    const turnCount = traces.filter((t: any) => t.type === 'turn/end').length
    const summary = this.buildSummary(sessionId, traces, toolCallCount, turnCount)

    try {
      const runId = await this.deps.startAutoForge([sessionId], summary)
      if (runId) {
        this.log('info', `Incremental forge started: ${runId}`)
        this._incrementalTriggers += 1
        acc.lastForgedAt = Date.now()
        // 触发后不清空痕迹，继续累积下一轮（用于多次锻造）
        // 但清掉已处理过的老旧痕迹，避免内存膨胀
        if (acc.traces.length > 50) {
          acc.traces = acc.traces.slice(-20)
        }
      } else {
        this.log('debug', 'Incremental forge rejected by orchestrator')
      }
    } catch (e) {
      this.log('error', `Incremental forge failed: ${(e as Error).message}`)
    }
  }

  // ============================================================
  // idle 触发（兜底）
  // ============================================================

  /**
   * 会话空闲超时处理：评估是否值得锻造，值得则启动自动锻造
   */
  private async handleSessionIdle(sessionId: string): Promise<void> {
    this.sessionTimers.delete(sessionId)

    const traces = this.sessionTraces.get(sessionId) || []
    if (traces.length === 0) return

    const toolCallCount = traces.filter((t: any) => t.type === 'tool/call').length
    const turnCount = traces.filter((t: any) => t.type === 'turn/end').length
    const score = this.computeWorthinessScore([sessionId])

    this.log('debug',
      `Session ${sessionId} idle — toolCalls=${toolCallCount}, turns=${turnCount}, score=${score.toFixed(2)}`,
    )

    // 增量模式下，idle 触发作为兜底：密度超过 idleDensityThreshold 才触发
    if (this.config.enableIncrementalAccumulation) {
      const acc = this.accumulators.get(sessionId)
      if (acc) {
        const density = this.computeCurrentDensity(acc)
        this.log('debug',
          `Session ${sessionId} idle density check: density=${density.toFixed(2)}, ` +
          `idleThreshold=${this.config.idleDensityThreshold}`,
        )
        if (density < this.config.idleDensityThreshold) {
          this.log('debug',
            `Session ${sessionId} skipped on idle: density ${density.toFixed(2)} below idle threshold ${this.config.idleDensityThreshold}`,
          )
          this.cleanupSession(sessionId)
          return
        }
      }
    } else {
      // 非增量模式：沿用原阈值逻辑
      if (score < this.config.triggerThreshold) {
        this.log('debug', `Session ${sessionId} skipped: score ${score.toFixed(2)} below threshold`)
        this.cleanupSession(sessionId)
        return
      }

      // 工具调用太少的会话没有锻造价值（纯闲聊）
      if (toolCallCount < 3 || turnCount < 2) {
        this.log('debug', `Session ${sessionId} skipped: too few tool calls (${toolCallCount}) or turns (${turnCount})`)
        this.cleanupSession(sessionId)
        return
      }
    }

    // 构建摘要
    const summary = this.buildSummary(sessionId, traces, toolCallCount, turnCount)

    this.log('info', `Auto-triggering forge for session ${sessionId} — score=${score.toFixed(2)}`)

    try {
      const runId = await this.deps.startAutoForge([sessionId], summary)
      if (runId) {
        this.log('info', `Auto forge started: ${runId}`)
        this._idleTriggers += 1
        // 保留痕迹，由流水线在 Gate 0 评估后调用 cleanupSessions 清理
        // 设置最长保留时间作为安全网，防止流水线异常导致泄漏
        setTimeout(() => this.cleanupSession(sessionId), this.maxTraceAgeMs).unref()
      } else {
        this.log('debug', 'Auto forge rejected by orchestrator (autoTrigger disabled or pipeline declined)')
        this.cleanupSession(sessionId)
      }
    } catch (e) {
      this.log('error', `Auto forge failed: ${(e as Error).message}`)
      this.cleanupSession(sessionId)
    }
  }

  // ============================================================
  // 评分与摘要
  // ============================================================

  /**
   * 启发式计算锻造价值分数（0-1）
   * 维度：工具调用数量、工具多样性、轮次深度、是否有错误重试模式
   */
  private computeWorthinessScore(sessionIds: string[]): number {
    const allTraces = sessionIds.flatMap(id => this.sessionTraces.get(id) || [])
    if (allTraces.length === 0) return 0

    const toolCalls = allTraces.filter((t: any) => t.type === 'tool/call')
    const toolCount = toolCalls.length
    const toolNames = new Set(toolCalls.map((t: any) => t.data?.name).filter(Boolean))
    const toolDiversity = toolNames.size
    const turnCount = allTraces.filter((t: any) => t.type === 'turn/end').length
    const toolErrors = allTraces.filter((t: any) => t.type === 'tool/result' && t.data?.error).length

    // 归一化各维度（0-1）
    const toolCountScore = Math.min(toolCount / 10, 1) // 10+ 个工具调用满分
    const diversityScore = Math.min(toolDiversity / 4, 1) // 4+ 种不同工具满分
    const depthScore = Math.min(turnCount / 5, 1) // 5+ 轮满分
    const errorScore = toolErrors > 0 && toolErrors < 5 ? 0.15 : 0 // 有少量错误说明有调试价值

    // 加权
    const score = (
      toolCountScore * 0.35 +
      diversityScore * 0.30 +
      depthScore * 0.25 +
      errorScore
    )

    return Math.min(Math.max(score, 0), 1)
  }

  private buildSummary(sessionId: string, traces: any[], toolCallCount: number, turnCount: number): string {
    const toolCalls = traces.filter((t: any) => t.type === 'tool/call')
    const toolNames = [...new Set(toolCalls.map((t: any) => t.data?.name).filter(Boolean))]
    const userMessages = traces
      .filter((t: any) => t.type === 'user/message')
      .map((t: any) => {
        const content = t.data?.message?.content
        if (typeof content === 'string') return content.slice(0, 100)
        if (Array.isArray(content)) return content.map((c: any) => c.text || '').join(' ').slice(0, 100)
        return ''
      })
      .filter(Boolean)

    const firstUserMsg = userMessages[0] || '(no user message captured)'

    return [
      `Auto-forged from session ${sessionId}`,
      `Turns: ${turnCount}, Tool calls: ${toolCallCount}`,
      `Tools used: ${toolNames.join(', ') || '(none)'}`,
      `Initial prompt: ${firstUserMsg}`,
    ].join(' | ')
  }

  private countToolCalls(sessionIds: string[]): number {
    return sessionIds.reduce((sum, id) => {
      const traces = this.sessionTraces.get(id) || []
      return sum + traces.filter((t: any) => t.type === 'tool/call').length
    }, 0)
  }

  private countTurns(sessionIds: string[]): number {
    return sessionIds.reduce((sum, id) => {
      const traces = this.sessionTraces.get(id) || []
      return sum + traces.filter((t: any) => t.type === 'turn/end').length
    }, 0)
  }

  private cleanupSession(sessionId: string): void {
    this.sessionTraces.delete(sessionId)
    this.lastActivityAt.delete(sessionId)
    this.accumulators.delete(sessionId)
    const t = this.sessionTimers.get(sessionId)
    if (t) { clearTimeout(t); this.sessionTimers.delete(sessionId) }
  }

  /**
   * 获取会话的工具调用统计
   */
  getSessionStats(sessionId: string): { toolCalls: number; turns: number; score: number } {
    const traces = this.sessionTraces.get(sessionId) || []
    return {
      toolCalls: traces.filter((t: any) => t.type === 'tool/call').length,
      turns: traces.filter((t: any) => t.type === 'turn/end').length,
      score: this.computeWorthinessScore([sessionId]),
    }
  }

  /** 获取会话的增量经验累积统计 */
  getSessionAccumulation(sessionId: string): {
    cumulativeComplexity: number
    cumulativeToolCalls: number
    iterationCount: number
    density: number
    traceCount: number
    lastForgedAt: number
  } | null {
    const acc = this.accumulators.get(sessionId)
    if (!acc) return null
    return {
      cumulativeComplexity: acc.cumulativeComplexity,
      cumulativeToolCalls: acc.cumulativeToolCalls,
      iterationCount: acc.iterationCount,
      density: this.computeCurrentDensity(acc),
      traceCount: acc.traces.length,
      lastForgedAt: acc.lastForgedAt,
    }
  }

  /** 获取当前正在追踪的会话数 */
  getTrackedSessionCount(): number {
    return this.sessionTraces.size
  }

  /**
   * 由流水线在 Gate 0 评估完成后调用，清理会话痕迹。
   * 自动锻造的会话痕迹在评估期间需要保留，评估完成后由此方法清理。
   */
  cleanupSessions(sessionIds: string[]): void {
    for (const id of sessionIds) {
      this.cleanupSession(id)
    }
  }
}
