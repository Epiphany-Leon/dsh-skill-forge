/**
 * InjectionEngine —— 智能技能注入引擎
 *
 * 根据对话上下文，在 token 预算内动态选择最相关的技能注入 DSH。
 * 替代"启动时全部注册"的模式，减少技能污染和 token 消耗。
 *
 * 触发时机：每轮对话开始前（turn/start 事件），基于最近的用户消息做召回。
 *
 * 评分维度（加权和）：
 *   - 验证分 verificationScore   权重 0.3
 *   - 使用频率 usageCount          权重 0.2
 *   - 关键词匹配度 keywordMatch    权重 0.4（意图感知开启且置信度>0.7时降为 0.3）
 *   - 新鲜度 freshness             权重 0.1
 *   - 意图匹配度 intentMatch       权重 0.2（仅意图感知开启且置信度>0.7时启用）
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BaseService } from './BaseService.js'
import {
  SkillStatus,
  type Skill,
  type SkillForgeConfig,
  type IntentType,
  type IntentAnalysisResult,
} from '../types.js'
import type { SkillRegistry } from './SkillRegistry.js'

/** Mimo API 基础地址（Token Plan 中国区） */
const MIMO_BASE_URL = 'https://token-plan-cn.xiaomimimo.com/v1'

/** 排序结果：技能 + 综合得分 + 分项得分 */
export interface RankedSkill {
  skill: Skill
  score: number
  keywordScore: number
  verificationScore: number
  feedbackScore: number
  usageScore: number
  freshnessScore: number
  intentScore: number
  estimatedTokens: number
}

export interface InjectionResult {
  injected: RankedSkill[]
  skipped: RankedSkill[]
  tokenBudget: number
  totalTokens: number
  query: string
  /** 本次是否启用了意图感知 */
  intentAware: boolean
  /** 检测到的意图（若启用） */
  detectedIntent?: IntentAnalysisResult
}

/** 意图关键词映射表：每个意图类型关联一组关键词，用于与技能字段做匹配 */
const INTENT_KEYWORD_MAP: Record<IntentType, string[]> = {
  'debugging': [
    'debug', 'debugging', 'fix', 'bug', 'error', 'issue', 'crash',
    '调试', '修复', '错误', '报错', '崩溃', '问题', '异常',
    'trace', 'stack', '排查', '定位', 'reproduce', '复现',
  ],
  'feature-development': [
    'feature', 'implement', 'build', 'create', 'new', 'add', 'develop',
    '功能', '开发', '新增', '添加', '实现', '做一个', '创建',
    'requirement', '需求', 'enhance', '增强',
  ],
  'refactoring': [
    'refactor', 'refactoring', 'clean', 'cleanup', 'improve', 'optimize',
    '重构', '优化', '清理', '改进', '重写', 'rewrite',
    'restructure', '结构调整', '代码质量', 'code quality',
  ],
  'code-review': [
    'review', 'code review', 'pr', 'pull request', 'review code',
    '代码审查', '评审', '审核', 'reviewer',
    'feedback', '反馈', 'suggestion', '建议',
  ],
  'testing': [
    'test', 'testing', 'unit test', 'integration test', 'e2e',
    '测试', '单元测试', '集成测试', '断言', 'assert',
    'coverage', '覆盖率', 'spec', 'jest', 'vitest',
  ],
  'documentation': [
    'doc', 'docs', 'documentation', 'readme', '注释', '文档',
    'write doc', '写文档', 'explain', '说明', '教程', 'tutorial',
    'guide', '指南', 'api doc', '接口文档',
  ],
  'planning': [
    'plan', 'planning', 'design', '架构', 'architecture',
    '规划', '计划', '方案', '设计', 'outline', '提纲',
    'roadmap', '路线图', 'schedule', '排期',
  ],
  'research': [
    'research', 'investigate', 'study', 'explore', '调研',
    '研究', '调查', '探索', 'compare', '比较', 'evaluate',
    '评估', 'benchmark', '基准测试', 'state of the art',
  ],
  'other': [],
}

export class InjectionEngine extends BaseService {
  private registry: SkillRegistry
  private running: boolean = false

  /** 最近一次注入的技能 ID 集合，用于 diff 计算（只增删变化的） */
  private lastInjectedIds: Set<string> = new Set()

  private onSessionEventBound: (session: any, event: any) => void

  // 权重配置（可通过 config 覆盖）
  // 默认：验证分 0.3 / 关键词 0.4 / 反馈分 0.15 / 使用频率 0.1 / 新鲜度 0.05 = 1.0
  // 意图感知开启且置信度达标时：关键词降为 0.3，意图 0.2（总分 1.2 由相对权重决定，这里简单加和）
  private readonly wVerification = 0.3
  private readonly wKeyword = 0.4
  private readonly wKeywordWithIntent = 0.3
  private readonly wIntent = 0.2

  // 反馈驱动权重（从 config 读取，有默认值）
  private get wFeedback(): number { return this.config.feedbackScoreWeight ?? 0.15 }
  private get wUsage(): number { return this.config.usageScoreWeight ?? 0.1 }
  private get wFreshness(): number {
    // 新鲜度补足到 1.0（非意图模式下）
    // verification(0.3) + keyword(0.4) + feedback(0.15) + usage(0.1) = 0.95
    // 剩余 0.05 给新鲜度
    const base = 0.3 + 0.4 + this.wFeedback + this.wUsage
    return Math.max(0, 1.0 - base)
  }

  // 意图分析缓存：sessionId-turnIndex -> 结果
  private intentCache: Map<string, IntentAnalysisResult> = new Map()

  // 统计
  private _intentAwareHits = 0
  private _intentAnalysisCalls = 0
  private _intentAnalysisFailures = 0
  private _totalInjections = 0
  private _totalSkillInjections = 0

  /** 注入事件回调（用于持久化统计） */
  private onInjectionCallback?: (skillCount: number, isIntentAware: boolean) => void

  // ============================================================
  // 隐式反馈观察窗口（奖励驱动进化）
  // ============================================================

  /**
   * 每个会话的观察窗口：注入技能后追踪 N 轮对话，判断反馈信号。
   * sessionId -> { skillName -> remainingTurns }
   */
  private observationWindows: Map<string, Map<string, number>> = new Map()

  /** 负反馈关键词（用户明确表示不满意/要换方向） */
  private readonly negativeKeywords = [
    '不对', '不行', '换个思路', '换个方法', '不是这样', '错了',
    '重来', '重新来', '搞错了', '不对吧', '有问题', '不靠谱',
    'no, that', 'wrong', 'incorrect', 'not right', 'try again',
    'different approach', 'instead', 'not what',
  ]

  /**
   * 为一个会话开启观察窗口：每个被注入的技能都将被追踪 N 轮。
   * 后续轮次中检测用户行为，判断正/负反馈信号。
   */
  private startObservationWindow(sessionId: string, skillNames: string[]): void {
    if (!this.config.enableRewardLearning) return
    if (skillNames.length === 0) return

    const windowSize = this.config.implicitFeedbackWindow ?? 3
    let windows = this.observationWindows.get(sessionId)
    if (!windows) {
      windows = new Map()
      this.observationWindows.set(sessionId, windows)
    }
    for (const name of skillNames) {
      windows.set(name, windowSize)
    }
  }

  /**
   * 观察当前轮次的用户消息与工具调用，判断隐式反馈信号。
   * 返回触发了反馈的技能列表，供调用方决定是否记录。
   */
  private observeImplicitFeedback(
    sessionId: string,
    query: string,
    toolNames: string[],
  ): Array<{ skillName: string; type: 'positive_implicit' | 'negative_implicit' | 'neutral_implicit'; reason: string }> {
    if (!this.config.enableRewardLearning) return []

    const windows = this.observationWindows.get(sessionId)
    if (!windows || windows.size === 0) return []

    const results: Array<{ skillName: string; type: 'positive_implicit' | 'negative_implicit' | 'neutral_implicit'; reason: string }> = []
    const lowerQuery = query.toLowerCase()

    // 检测负反馈关键词（全局判断，对所有观察中的技能生效）
    const hasNegativeSignal = this.negativeKeywords.some(kw => lowerQuery.includes(kw.toLowerCase()))

    for (const [skillName, remaining] of Array.from(windows.entries())) {
      const skill = this.registry.getSkillByName(skillName)
      if (!skill) {
        windows.delete(skillName)
        continue
      }

      const fm = skill.frontmatter
      const skillTokens = new Set([
        ...this.tokenize(fm.name),
        ...this.tokenize(fm.description),
        ...this.tokenize(fm.whenToUse || ''),
        ...(fm.tags || []).flatMap(t => [...this.tokenize(t)]),
      ])
      const queryTokens = this.tokenize(query)

      // 计算重合度
      let overlap = 0
      for (const qt of queryTokens) {
        if (skillTokens.has(qt)) overlap++
      }
      const overlapRatio = skillTokens.size > 0 ? overlap / Math.min(queryTokens.size, skillTokens.size) : 0

      // 工具调用重合：用户调用了技能描述中提到的工具名
      let toolOverlap = 0
      if (toolNames.length > 0) {
        const skillText = (fm.name + ' ' + fm.description + ' ' + (fm.whenToUse || '') + ' ' + skill.body.slice(0, 1000)).toLowerCase()
        for (const tool of toolNames) {
          if (skillText.includes(tool.toLowerCase())) toolOverlap++
        }
      }

      // 判断信号类型
      let signal: 'positive_implicit' | 'negative_implicit' | 'neutral_implicit' = 'neutral_implicit'
      let reason = 'neutral'

      if (hasNegativeSignal) {
        signal = 'negative_implicit'
        reason = 'user expressed dissatisfaction/redirection'
      } else if (toolOverlap > 0) {
        // 用户调用了技能提到的工具 → 正反馈
        signal = 'positive_implicit'
        reason = `used ${toolOverlap} tool(s) mentioned in skill`
      } else if (overlapRatio >= 0.3 && queryTokens.size >= 3) {
        // 用户消息与技能关键词高度重合 → 对话沿技能方向深入
        signal = 'positive_implicit'
        reason = `query overlap ratio ${overlapRatio.toFixed(2)}`
      }

      if (signal !== 'neutral_implicit') {
        results.push({ skillName, type: signal, reason })
      }

      // 剩余轮次减 1
      const newRemaining = remaining - 1
      if (newRemaining <= 0) {
        windows.delete(skillName)
      } else {
        windows.set(skillName, newRemaining)
      }
    }

    // 清理空窗口
    if (windows.size === 0) {
      this.observationWindows.delete(sessionId)
    }

    return results
  }

  /**
   * 从事件中提取本轮调用的工具名列表。
   * 不同 DSH 版本结构不同，做多层 fallback。
   */
  private extractToolNamesFromEvent(event: any): string[] {
    const names: string[] = []
    const data = event.data

    // 常见路径：tools 数组
    if (Array.isArray(data?.tools)) {
      for (const t of data.tools) {
        if (typeof t === 'string') names.push(t)
        else if (t?.name) names.push(t.name)
      }
    }
    // toolCalls 数组
    if (Array.isArray(data?.toolCalls)) {
      for (const tc of data.toolCalls) {
        if (tc?.name) names.push(tc.name)
        else if (tc?.function?.name) names.push(tc.function.name)
      }
    }
    // message.tool_calls (OpenAI 格式)
    if (Array.isArray(data?.message?.tool_calls)) {
      for (const tc of data.message.tool_calls) {
        if (tc?.function?.name) names.push(tc.function.name)
      }
    }

    return [...new Set(names)]
  }

  constructor(ctx: any, config: SkillForgeConfig, registry: SkillRegistry, options?: { onInjection?: (skillCount: number, isIntentAware: boolean) => void }) {
    super(ctx, config)
    this.registry = registry
    this.onInjectionCallback = options?.onInjection
    this.onSessionEventBound = this.onSessionEvent.bind(this)
  }

  // ============================================================
  // 生命周期
  // ============================================================

  async start(): Promise<void> {
    if (this.running) return
    if (this.config.injectionMode !== 'smart') {
      this.log('info', `Injection engine skipped (mode=${this.config.injectionMode})`)
      return
    }

    this.running = true

    // 智能注入模式：先把初始化时全部注册的技能全部注销，
    // 改为按需注入。这样才能真正节省 token。
    const removed = this.registry.unregisterAll()
    this.log('info', `Injection engine started — unregistered ${removed} skills, will inject per-turn`)

    // 订阅 session 事件，在每轮对话开始前做召回
    this.ctx.on('session/event', this.onSessionEventBound)
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false

    this.ctx.off?.('session/event', this.onSessionEventBound)

    // 恢复：重新注册全部激活技能，确保关闭后行为一致
    const activeSkills = this.registry.listSkills(SkillStatus.ACTIVE)
    for (const skill of activeSkills) {
      await this.registry.ensureRegistered(skill.id)
    }
    this.lastInjectedIds.clear()
    this.intentCache.clear()
    this.observationWindows.clear()

    this.log('info', `Injection engine stopped — restored ${activeSkills.length} skills`)
  }

  // ============================================================
  // 公开 API：手动触发（也可供外部直接调用）
  // ============================================================

  /**
   * 基于 query 做一次完整的智能注入：
   * 1. 对所有 active 技能评分排序
   * 2. 在 token 预算内选出 top N
   * 3. 与上一轮注入做 diff，只增删变化的技能
   * 4. 记录使用统计
   */
  async injectForQuery(query: string, sessionId?: string, turnIndex?: number): Promise<InjectionResult> {
    const activeSkills = this.registry.listSkills(SkillStatus.ACTIVE)

    // 尝试做意图分析（仅 smart 模式 + 配置开启 + 文本足够长）
    let intentResult: IntentAnalysisResult | undefined
    if (
      this.config.enableIntentAware
      && query.length >= this.config.intentAnalysisMinChars
      && this.config.injectionMode === 'smart'
    ) {
      const cacheKey = sessionId && turnIndex !== undefined ? `${sessionId}-${turnIndex}` : null
      if (cacheKey && this.intentCache.has(cacheKey)) {
        intentResult = this.intentCache.get(cacheKey)
      } else {
        try {
          this._intentAnalysisCalls++
          intentResult = await this.analyzeIntent(query)
          if (cacheKey) {
            this.intentCache.set(cacheKey, intentResult)
          }
        } catch (err) {
          // LLM 调用失败：优雅降级为纯关键词匹配
          this._intentAnalysisFailures++
          this.log('warn', `Intent analysis failed, falling back to keyword-only: ${(err as Error).message}`)
          intentResult = undefined
        }
      }
    }

    // 1. 排序
    const ranked = this.rankSkills(query, activeSkills, intentResult)

    // 统计：意图召回命中（intentAware 开启 + 置信度达标 + 有技能因意图分被注入）
    const useIntent = intentResult && intentResult.confidence > 0.7
    if (useIntent) {
      this._intentAwareHits++
    }

    // 2. 计算 token 预算并选择
    const budget = this.resolveTokenBudget()
    const { selected, skipped, totalTokens } = this.selectForInjection(ranked, budget)

    // 3. 计算 diff 并动态调整注册
    const selectedIds = new Set(selected.map(r => r.skill.id))

    // 需要取消注册的（上一轮有，这一轮没有）
    const toRemove = [...this.lastInjectedIds].filter(id => !selectedIds.has(id))
    for (const id of toRemove) {
      this.registry.ensureUnregistered(id)
    }

    // 需要新增注册的（这一轮有，上一轮没有）
    const toAdd = selected.filter(r => !this.lastInjectedIds.has(r.skill.id))
    for (const r of toAdd) {
      await this.registry.ensureRegistered(r.skill.id)
    }

    // 4. 更新使用统计（被注入即记一次曝光/使用）
    for (const r of selected) {
      this.registry.recordUsage(r.skill.id).catch(() => {})
    }

    // 5. 为新增注入的技能开启隐式反馈观察窗口（仅 reward learning 开启时）
    if (this.config.enableRewardLearning && sessionId && toAdd.length > 0) {
      const newSkillNames = toAdd.map(r => r.skill.frontmatter.name)
      this.startObservationWindow(sessionId, newSkillNames)
    }

    this.lastInjectedIds = selectedIds

    // 更新统计
    this._totalInjections++
    this._totalSkillInjections += selected.length

    // 持久化回调
    if (this.onInjectionCallback) {
      this.onInjectionCallback(selected.length, !!useIntent)
    }

    const result: InjectionResult = {
      injected: selected,
      skipped,
      tokenBudget: budget,
      totalTokens,
      query,
      intentAware: !!useIntent,
      detectedIntent: intentResult,
    }

    this.log('debug',
      `Inject for query: ${selected.length} skills, ${totalTokens}/${budget} tokens ` +
      `(+${toAdd.length}, -${toRemove.length}) ` +
      `intent=${useIntent ? intentResult!.intent : 'off'}`,
    )

    return result
  }

  // ============================================================
  // 意图分析
  // ============================================================

  /**
   * 使用轻量 LLM 分析用户消息的意图。
   * temperature: 0.1，输出 JSON 格式。
   */
  async analyzeIntent(query: string): Promise<IntentAnalysisResult> {
    const systemPrompt = `你是一个编程助手意图分类器。请分析用户消息的主要意图，输出 JSON。

支持的意图类型（intent 字段，必须是以下之一）：
- debugging: 调试、排查错误、修复 bug
- feature-development: 开发新功能、实现新需求
- refactoring: 重构、优化代码、清理
- code-review: 代码审查、评审、PR 审查
- testing: 写测试、测试相关
- documentation: 写文档、注释、说明
- planning: 计划、设计、架构、方案
- research: 调研、研究、技术选型、比较评估
- other: 无法归入以上类型

输出格式（纯 JSON，不要 Markdown）：
{
  "intent": "<意图类型>",
  "confidence": <0-1之间的数字>,
  "keywords": ["关键词1", "关键词2", ...]
}

confidence 表示你对分类的确定程度。
keywords 列出 3-8 个与该意图相关的英文/中文关键词，用于后续技能匹配。`

    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('MIMO API key not configured')
    }

    const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.1,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error')
      throw new Error(`LLM API error: ${response.status} ${text}`)
    }

    const data = await response.json() as any
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('LLM returned empty response')
    }

    const parsed = this.parseJSON(content)

    // Zod-style 校验：确保输出符合预期结构
    const validIntents: IntentType[] = [
      'debugging', 'feature-development', 'refactoring', 'code-review',
      'testing', 'documentation', 'planning', 'research', 'other',
    ]
    if (
      typeof parsed !== 'object' || parsed === null
      || typeof parsed.intent !== 'string'
      || !validIntents.includes(parsed.intent as IntentType)
      || typeof parsed.confidence !== 'number'
      || parsed.confidence < 0 || parsed.confidence > 1
      || !Array.isArray(parsed.keywords)
      || !parsed.keywords.every((k: unknown) => typeof k === 'string')
    ) {
      throw new Error('LLM returned invalid intent structure')
    }

    return {
      intent: parsed.intent as IntentType,
      confidence: parsed.confidence,
      keywords: parsed.keywords as string[],
    }
  }

  /**
   * 计算意图匹配得分（0-1）。
   * 比较 intent 与技能的 category / whenToUse / tags 的语义相关度。
   * 使用关键词匹配方式，结合预设意图关键词表 + LLM 返回的关键词。
   */
  private computeIntentScore(intent: IntentAnalysisResult, skill: Skill): number {
    const fm = skill.frontmatter
    const targetText = [
      fm.category || '',
      fm.whenToUse || '',
      (fm.tags || []).join(' '),
      fm.description || '',
    ].join(' ').toLowerCase()

    if (!targetText.trim()) return 0

    // 从两个来源收集匹配关键词：
    // 1. 预设的意图关键词表
    // 2. LLM 返回的关键词
    const presetKeywords = INTENT_KEYWORD_MAP[intent.intent] || []
    const llmKeywords = intent.keywords.map(k => k.toLowerCase())
    const allKeywords = new Set([...presetKeywords, ...llmKeywords])

    if (allKeywords.size === 0) return 0

    let matched = 0
    for (const kw of allKeywords) {
      if (targetText.includes(kw.toLowerCase())) {
        matched++
      }
    }

    // 归一化：命中比例
    return Math.min(matched / allKeywords.size, 1)
  }

  // ============================================================
  // 核心算法：排序 + 选择
  // ============================================================

  /**
   * 对技能按相关性综合排序。
   * 分值范围 0-1，越高越相关。
   * 当 intent 存在且置信度 > 0.7 时，加入意图匹配维度。
   */
  rankSkills(query: string, skills: Skill[], intentResult?: IntentAnalysisResult): RankedSkill[] {
    const queryTokens = this.tokenize(query)
    const useIntent = intentResult && intentResult.confidence > 0.7
    const keywordWeight = useIntent ? this.wKeywordWithIntent : this.wKeyword

    const ranked = skills.map((skill): RankedSkill => {
      const keywordScore = this.computeKeywordScore(queryTokens, skill)
      const verificationScore = skill.verificationScore ?? 0.5
      const feedbackScore = this.computeFeedbackScore(skill)
      const usageScore = this.computeUsageScore(skill.usageCount, skills)
      const freshnessScore = this.computeFreshnessScore(skill)
      const intentScore = useIntent
        ? this.computeIntentScore(intentResult!, skill)
        : 0

      const score = (
        keywordScore * keywordWeight +
        verificationScore * this.wVerification +
        feedbackScore * this.wFeedback +
        usageScore * this.wUsage +
        freshnessScore * this.wFreshness +
        (useIntent ? intentScore * this.wIntent : 0)
      )

      const estimatedTokens = this.estimateTokens(skill)

      return {
        skill,
        score,
        keywordScore,
        verificationScore,
        feedbackScore,
        usageScore,
        freshnessScore,
        intentScore,
        estimatedTokens,
      }
    })

    // 按综合得分降序
    ranked.sort((a, b) => b.score - a.score)
    return ranked
  }

  /**
   * 在 token 预算内选择最相关的技能（贪心：按排序依次放入，直到放不下）。
   * 至少保留 1 个（即使超预算也注入最高分的那个，避免技能为空）。
   */
  selectForInjection(
    ranked: RankedSkill[],
    tokenBudget: number,
  ): { selected: RankedSkill[]; skipped: RankedSkill[]; totalTokens: number } {
    const threshold = this.config.injectionRelevanceThreshold
    const selected: RankedSkill[] = []
    const skipped: RankedSkill[] = []
    let totalTokens = 0

    for (const r of ranked) {
      // 低于相关度阈值直接跳过
      if (r.score < threshold) {
        skipped.push(r)
        continue
      }

      // 预算不够则跳过（第一个除外，保证至少有一个）
      if (selected.length > 0 && totalTokens + r.estimatedTokens > tokenBudget) {
        skipped.push(r)
        continue
      }

      selected.push(r)
      totalTokens += r.estimatedTokens
    }

    return { selected, skipped, totalTokens }
  }

  /**
   * 估算技能占用的 token 数。
   * 简单估算：字符数 / 4（英文约 4 字符 1 token，中文约 2 字 1 token，
   * 取 4 作为保守值，宁少勿多避免超预算）。
   */
  estimateTokens(skill: Skill): number {
    // 正文 + frontmatter 关键字段一起算
    const fm = skill.frontmatter
    const text =
      fm.name + '\n' +
      fm.description + '\n' +
      fm.whenToUse + '\n' +
      (fm.tags?.join(' ') || '') + '\n' +
      skill.body
    return Math.ceil(text.length / 4)
  }

  // ============================================================
  // 事件处理
  // ============================================================

  private onSessionEvent(session: any, event: any): void {
    if (!this.running) return
    if (event.type !== 'turn/start') return

    // 从事件中提取当前轮次的用户输入，作为召回 query
    const query = this.extractQueryFromEvent(event)
    if (!query) return

    // 提取 sessionId 和 turnIndex（用于意图缓存）
    const sessionId = session?.id || session?.sessionId
    const turnIndex = event.data?.turnIndex ?? event.data?.index

    // 1. 先检测隐式反馈（基于上一轮注入的技能，对当前轮次的用户输入做观察）
    if (this.config.enableRewardLearning && sessionId) {
      const toolNames = this.extractToolNamesFromEvent(event)
      const feedbacks = this.observeImplicitFeedback(sessionId, query, toolNames)
      // 异步记录，不阻塞
      for (const fb of feedbacks) {
        this.registry.recordImplicitFeedback(fb.skillName, fb.type, fb.reason).catch(() => {})
      }
    }

    // 2. 再做本轮注入
    this.injectForQuery(query, sessionId, turnIndex).catch(err => {
      this.log('warn', `Injection failed for turn/start: ${(err as Error).message}`)
    })
  }

  /**
   * 从 turn/start 事件中提取用户 query。
   * 不同 DSH 版本 payload 结构可能不同，做多层 fallback。
   */
  private extractQueryFromEvent(event: any): string {
    const data = event.data
    if (!data) return ''

    // 常见路径尝试
    const candidates: string[] = []

    if (typeof data.message?.content === 'string') {
      candidates.push(data.message.content)
    }
    if (data.input && typeof data.input === 'string') {
      candidates.push(data.input)
    }
    if (data.prompt && typeof data.prompt === 'string') {
      candidates.push(data.prompt)
    }
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      const last = data.messages[data.messages.length - 1]
      if (typeof last?.content === 'string') {
        candidates.push(last.content)
      }
    }

    // 返回最长的那个候选
    return candidates.sort((a, b) => b.length - a.length)[0] || ''
  }

  // ============================================================
  // 内部：各维度评分
  // ============================================================

  /**
   * 关键词匹配度（0-1）。
   * 计算 query token 与技能名称/标签/描述/whenToUse/正文的重叠率。
   * 不同字段权重不同：名称和标签权重最高。
   */
  private computeKeywordScore(queryTokens: Set<string>, skill: Skill): number {
    if (queryTokens.size === 0) return 0

    const fm = skill.frontmatter

    // 从技能各字段提取 tokens，按字段重要性加权
    const nameTokens = this.tokenize(fm.name)
    const tagTokens = new Set<string>(
      (fm.tags || []).flatMap(t => [...this.tokenize(t)]),
    )
    const descTokens = this.tokenize(fm.description)
    const whenTokens = this.tokenize(fm.whenToUse)
    // 正文只取前 500 字符做关键词提取，避免全量扫描
    const bodyTokens = this.tokenize(skill.body.slice(0, 500))

    let matched = 0
    for (const qt of queryTokens) {
      let hitWeight = 0
      // 名称命中：权重 3
      if (nameTokens.has(qt)) hitWeight = Math.max(hitWeight, 3)
      // 标签命中：权重 3
      if (tagTokens.has(qt)) hitWeight = Math.max(hitWeight, 3)
      // whenToUse 命中：权重 2
      if (whenTokens.has(qt)) hitWeight = Math.max(hitWeight, 2)
      // 描述命中：权重 1.5
      if (descTokens.has(qt)) hitWeight = Math.max(hitWeight, 1.5)
      // 正文命中：权重 1
      if (bodyTokens.has(qt)) hitWeight = Math.max(hitWeight, 1)

      if (hitWeight > 0) matched += hitWeight
    }

    // 归一化：满分 = queryTokens.size * 3（全部命中名称/标签）
    const maxPossible = queryTokens.size * 3
    return Math.min(matched / maxPossible, 1)
  }

  /**
   * 使用频率得分（0-1）。
   * 基于最大使用次数做归一化，用 log 压缩避免头部过大。
   */
  private computeUsageScore(usageCount: number, allSkills: Skill[]): number {
    if (usageCount <= 0) return 0
    const maxUsage = Math.max(...allSkills.map(s => s.usageCount), 1)
    // log 压缩：0 使用 = 0，最大使用 = 1
    const score = Math.log(usageCount + 1) / Math.log(maxUsage + 1)
    return Math.min(Math.max(score, 0), 1)
  }

  /**
   * 反馈分得分（0-1）。
   * feedbackScore 是 -1 到 1 的连续值，映射到 0-1 作为注入排序权重。
   * 0.0 分对应中性 0.5，-1.0 对应 0（完全不推荐），1.0 对应 1（强烈推荐）。
   */
  private computeFeedbackScore(skill: Skill): number {
    const raw = skill.feedbackScore ?? 0
    // -1..1 → 0..1
    return (raw + 1) / 2
  }

  /**
   * 新鲜度得分（0-1）。
   * 最近 7 天内创建/更新的技能得分高，30 天以上衰减到 0。
   */
  private computeFreshnessScore(skill: Skill): number {
    const now = Date.now()
    const lastUpdate = Math.max(skill.updatedAt, skill.lastUsedAt || 0, skill.createdAt)
    const ageMs = now - lastUpdate

    const dayMs = 24 * 60 * 60 * 1000
    const maxAgeDays = 30

    if (ageMs <= 7 * dayMs) return 1
    if (ageMs >= maxAgeDays * dayMs) return 0

    // 7-30 天线性衰减
    const ageDays = ageMs / dayMs
    return 1 - (ageDays - 7) / (maxAgeDays - 7)
  }

  /**
   * 解析 token 预算。
   * 优先使用 config.injectionTokenBudget（绝对数值），
   * 否则按 tokenBudgetRatio * 上下文窗口估算。
   * 由于拿不到模型的准确上下文窗口，用一个保守默认值 128k 估算。
   */
  private resolveTokenBudget(): number {
    if (this.config.injectionTokenBudget > 0) {
      return this.config.injectionTokenBudget
    }
    const defaultContextWindow = 128_000 // 保守值
    return Math.floor(defaultContextWindow * this.config.tokenBudgetRatio)
  }

  /**
   * 简单分词：转小写 + 按非字母数字分隔 + 去停用词 + 去短词。
   * 中英文混合场景下的粗糙分词，不求精准只求够用。
   */
  private tokenize(text: string): Set<string> {
    if (!text) return new Set()

    const stopWords = new Set([
      // 英文停用词
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'can', 'shall', 'this', 'that',
      'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they',
      'what', 'which', 'who', 'when', 'where', 'why', 'how', 'not', 'no',
      'if', 'then', 'else', 'so', 'than', 'too', 'very', 'just', 'about',
      // 中文停用词（单字/双字常见虚词）
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都',
      '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你',
      '会', '着', '没有', '看', '好', '自己', '这', '那', '他', '她',
      '它', '们', '这个', '那个', '什么', '怎么', '为什么', '哪里',
      '可以', '能', '应该', '需要', '使用', '用', '做', '进行',
    ])

    const tokens = new Set<string>()

    // 英文部分：按非字母数字分隔
    const englishMatches = text.toLowerCase().match(/[a-z0-9]{2,}/g) || []
    for (const t of englishMatches) {
      if (!stopWords.has(t)) {
        tokens.add(t)
      }
    }

    // 中文部分：提取 2-4 字的中文连续片段作为候选
    // （没有中文分词器，用 n-gram 方式提取 2 字词）
    const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || []
    for (const seg of chineseChars) {
      // 整段如果 ≤ 4 字，直接作为一个 token
      if (seg.length <= 4) {
        if (!stopWords.has(seg)) tokens.add(seg)
        continue
      }
      // 更长的做 2-gram 滑动窗口
      for (let i = 0; i <= seg.length - 2; i++) {
        const bi = seg.slice(i, i + 2)
        if (!stopWords.has(bi)) {
          tokens.add(bi)
        }
      }
    }

    return tokens
  }

  // ============================================================
  // LLM 调用辅助（轻量复制自 BaseAgent，避免循环依赖）
  // ============================================================

  private apiKeyCache: string | null = null
  private apiKeyResolved = false

  private getApiKey(): string | null {
    if (this.apiKeyResolved) return this.apiKeyCache

    // 方式1: 环境变量
    if (process.env.MIMO_API_KEY) {
      this.apiKeyCache = process.env.MIMO_API_KEY
      this.apiKeyResolved = true
      return this.apiKeyCache
    }

    // 方式2: 从 DSH 凭据文件读取
    try {
      const credPath = join(homedir(), '.dsh', '.credentials.yaml')
      const content = readFileSync(credPath, 'utf-8')
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.includes('XIAOMI_TOKEN_PLAN_CN_API_KEY')) {
          const match = line.match(/:\s*(tp-.+)/)
          if (match && match[1]) {
            this.apiKeyCache = match[1]!.trim()
            this.apiKeyResolved = true
            return this.apiKeyCache
          }
        }
      }
    } catch { /* 文件不存在 */ }

    this.apiKeyResolved = true
    return null
  }

  private parseJSON(text: string): any {
    try { return JSON.parse(text.trim()) } catch { /* 继续 */ }

    const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonBlock && jsonBlock[1]) {
      try { return JSON.parse(jsonBlock[1]!.trim()) } catch { /* 继续 */ }
    }

    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1).trim())
      } catch { /* 继续 */ }
    }

    throw new Error('Failed to parse JSON from LLM response')
  }

  // ============================================================
  // 状态查询
  // ============================================================

  /** 当前已注入的技能 ID 集合 */
  getInjectedIds(): Set<string> {
    return new Set(this.lastInjectedIds)
  }

  /** 是否在运行中 */
  isRunning(): boolean {
    return this.running
  }

  /** 意图召回命中次数 */
  get intentAwareHits(): number {
    return this._intentAwareHits
  }

  /** 意图分析调用次数 */
  get intentAnalysisCalls(): number {
    return this._intentAnalysisCalls
  }

  /** 意图分析失败次数 */
  get intentAnalysisFailures(): number {
    return this._intentAnalysisFailures
  }

  /** 清空意图缓存 */
  clearIntentCache(): void {
    this.intentCache.clear()
  }

  /**
   * 获取注入引擎统计数据
   */
  getStats(): {
    totalInjections: number
    totalSkillInjections: number
    intentAwareHits: number
    intentAnalysisCalls: number
    intentAnalysisFailures: number
    smartInjectionRatio: number
  } {
    const smartInjectionRatio = this._totalInjections > 0
      ? this._intentAwareHits / this._totalInjections
      : 0
    return {
      totalInjections: this._totalInjections,
      totalSkillInjections: this._totalSkillInjections,
      intentAwareHits: this._intentAwareHits,
      intentAnalysisCalls: this._intentAnalysisCalls,
      intentAnalysisFailures: this._intentAnalysisFailures,
      smartInjectionRatio: Math.round(smartInjectionRatio * 1000) / 1000,
    }
  }
}
