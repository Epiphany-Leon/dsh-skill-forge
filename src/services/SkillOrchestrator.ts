/**
 * SkillOrchestrator —— 技能组合编排器
 *
 * 从「单技能注入」到「多技能编排执行」。
 * 自动识别复杂任务需要的技能组合，生成工作流并指导 Agent 按序执行。
 *
 * 核心组件：
 *   TaskDecomposer  —— 任务分解：把复杂任务拆成多个子任务
 *   WorkflowBuilder —— 工作流构建：为每个子任务匹配最佳技能，生成 DAG
 *   SkillOrchestrator —— 编排器：对外入口，分解→构建→执行/输出
 *
 * 与 InjectionEngine 的关系：
 *   InjectionEngine 做「单轮对话的单技能/多技能召回注入」
 *   SkillOrchestrator 做「复杂任务的多技能工作流产排」
 *   两者互补：Orchestrator 产出的工作流里的技能集合，会通过 InjectionEngine 注入。
 */

import { BaseService } from './BaseService.js'
import {
  SkillStatus,
  type Skill,
  type SkillForgeConfig,
  type IntentAnalysisResult,
} from '../types.js'
import type { SkillRegistry } from './SkillRegistry.js'
import type { InjectionEngine } from './InjectionEngine.js'

// ============================================================
// 类型定义
// ============================================================

/** 子任务 */
export interface SubTask {
  /** 子任务唯一 ID（在工作流内唯一） */
  id: string
  /** 子任务名称（简短） */
  name: string
  /** 子任务详细描述 */
  description: string
  /** 子任务类别（对应技能 category 体系） */
  category?: string
  /** 子任务关键词（用于技能匹配） */
  keywords: string[]
  /** 依赖的子任务 ID 列表（DAG） */
  dependsOn: string[]
  /** 预估复杂度（1-5，影响执行顺序和提示权重） */
  complexity: number
}

/** 技能匹配结果 */
export interface SkillMatch {
  skill: Skill
  /** 匹配得分（0-1） */
  score: number
  /** 各维度得分明细 */
  keywordScore: number
  categoryScore: number
  qualityScore: number
  /** 为什么匹配（简短理由） */
  reason: string
}

/** 工作流节点 */
export interface WorkflowNode {
  subtask: SubTask
  /** 匹配到的技能（若为空则该子任务无对应技能，由 Agent 自行处理） */
  matchedSkill?: SkillMatch
  /** 节点在工作流中的顺序（拓扑排序后的位置） */
  order: number
  /** 节点状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  /** 执行结果摘要（可选） */
  resultSummary?: string
}

/** 工作流 */
export interface SkillWorkflow {
  /** 工作流 ID */
  id: string
  /** 原始任务描述 */
  originalQuery: string
  /** 子任务列表（按拓扑顺序排列） */
  nodes: WorkflowNode[]
  /** 总节点数 */
  totalNodes: number
  /** 匹配到技能的节点数 */
  matchedNodes: number
  /** 未匹配到技能的节点数 */
  unmatchedNodes: number
  /** 工作流整体置信度（0-1，基于子任务分解质量 + 技能匹配质量） */
  confidence: number
  /** 创建时间 */
  createdAt: number
  /** 最近更新时间 */
  updatedAt: number
  /** 当前执行到第几个节点（从 0 开始） */
  currentStep: number
  /** 工作流状态 */
  status: 'created' | 'running' | 'completed' | 'failed'
}

/** 编排结果 */
export interface OrchestrationResult {
  workflow: SkillWorkflow
  /** 需要注入的技能 ID 列表（按相关度排序） */
  skillIdsToInject: string[]
  /** 给 Agent 的执行指南（Markdown 格式） */
  executionGuide: string
  /** 用于注入的技能总 token 估算 */
  estimatedTokens: number
}

// ============================================================
// TaskDecomposer —— 任务分解器
// ============================================================

/**
 * 任务分解器：把复杂任务拆分为多个有依赖关系的子任务。
 *
 * 策略：
 * 1. 快速模式：基于启发式规则的分解（不调用 LLM，响应快）
 * 2. 精确模式：调用 LLM 做深度分解（质量高但耗 token）
 *
 * 当前实现同时支持两种模式，默认先尝试快速模式，
 * 若快速模式分解出的子任务数 < 2，则升级到 LLM 模式。
 */
export class TaskDecomposer extends BaseService {
  private registry: SkillRegistry

  constructor(ctx: any, config: SkillForgeConfig, registry: SkillRegistry) {
    super(ctx, config)
    this.registry = registry
  }

  /**
   * 分解任务为子任务列表。
   * @param query 原始任务描述
   * @param mode 分解模式：fast 启发式 / llm 深度分解 / auto 自动选择
   */
  async decompose(
    query: string,
    mode: 'fast' | 'llm' | 'auto' = 'auto',
  ): Promise<{ subtasks: SubTask[]; method: 'fast' | 'llm' }> {
    if (mode === 'fast') {
      return { subtasks: this.decomposeFast(query), method: 'fast' }
    }
    if (mode === 'llm') {
      return { subtasks: await this.decomposeLLM(query), method: 'llm' }
    }

    // auto 模式：先快速分解，子任务太少则升级
    const fastResult = this.decomposeFast(query)
    if (fastResult.length >= 2) {
      return { subtasks: fastResult, method: 'fast' }
    }

    try {
      const llmResult = await this.decomposeLLM(query)
      if (llmResult.length >= 2) {
        return { subtasks: llmResult, method: 'llm' }
      }
      return { subtasks: fastResult, method: 'fast' }
    } catch (err) {
      this.log('warn', `LLM decomposition failed, falling back to fast mode: ${(err as Error).message}`)
      return { subtasks: fastResult, method: 'fast' }
    }
  }

  /**
   * 快速模式：基于启发式规则分解。
   *
   * 规则：
   * - 按连接词（然后、接着、最后、然后再、接下来）拆分
   * - 按动词+宾语模式识别阶段性任务
   * - 基于技能库的类别体系做初步分类
   */
  private decomposeFast(query: string): SubTask[] {
    const subtasks: SubTask[] = []

    // 清洗文本
    const cleaned = query.trim().replace(/\s+/g, ' ')

    // 阶段连接词（中文）
    const stageSplitters = [
      '然后', '接着', '最后', '接下来', '之后', '随后', '再然后',
      '第二步', '第三步', '第四步', '第五步',
      '首先', '其次', '再次',
    ]

    // 先试试按显式阶段词分割
    let parts: string[] = [cleaned]
    for (const splitter of stageSplitters) {
      const newParts: string[] = []
      for (const part of parts) {
        const subParts = part.split(new RegExp(`${splitter}[，,]?\\s*`))
        newParts.push(...subParts.filter(p => p.trim().length > 5))
      }
      if (newParts.length > parts.length) {
        parts = newParts
      }
    }

    // 如果没分割出多个部分，判断任务是否天然复杂
    if (parts.length < 2) {
      // 没有明确阶段划分，但可能仍然是复杂任务
      // 基于长度和关键词密度判断
      const isComplex = this.estimateTaskComplexity(query) >= 2
      if (!isComplex) {
        // 简单任务：只有一个子任务
        return [{
          id: 'st_0',
          name: this.extractTaskName(query),
          description: query,
          keywords: this.extractKeywords(query),
          category: this.inferCategory(query),
          dependsOn: [],
          complexity: this.estimateTaskComplexity(query),
        }]
      }

      // 复杂但无显式阶段：用「调研→方案→实现→验证」的通用框架
      return this.buildGenericWorkflow(query)
    }

    // 有显式阶段划分
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!.trim()
      if (part.length < 3) continue

      subtasks.push({
        id: `st_${i}`,
        name: this.extractTaskName(part),
        description: part,
        keywords: this.extractKeywords(part),
        category: this.inferCategory(part),
        dependsOn: i > 0 ? [`st_${i - 1}`] : [],
        complexity: this.estimateTaskComplexity(part),
      })
    }

    return subtasks
  }

  /**
   * LLM 模式：调用大模型做深度任务分解。
   * 输出结构化的子任务列表，带依赖关系。
   */
  private async decomposeLLM(query: string): Promise<SubTask[]> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error('MIMO API key not configured')
    }

    const systemPrompt = `你是一个任务分解专家。请把用户给出的复杂任务分解为多个有依赖关系的子任务。

分解原则：
1. 每个子任务有明确的目标和产出
2. 子任务之间有清晰的依赖关系（DAG，不是简单的线性顺序）
3. 子任务粒度适中：一个子任务对应一个明确的工作阶段
4. 通常分解为 2-6 个子任务，不要过多也不要过少
5. 每个子任务标注：所属类别、关键词、复杂度
6. 依赖关系用 dependsOn 数组表示（子任务 ID 列表）

支持的子任务类别：
- debugging: 调试、排查错误
- feature-development: 功能开发、实现
- refactoring: 重构、优化
- code-review: 代码审查
- testing: 测试相关
- documentation: 文档、说明
- planning: 规划、设计、方案
- research: 调研、研究、技术选型
- deployment: 部署、上线
- data-processing: 数据处理、分析
- other: 其他

输出严格为 JSON 格式，不要 Markdown：
{
  "subtasks": [
    {
      "id": "st_0",
      "name": "子任务名称（简短）",
      "description": "子任务详细描述",
      "category": "类别",
      "keywords": ["关键词1", "关键词2"],
      "dependsOn": ["st_0"],
      "complexity": 3
    }
  ]
}

complexity 是 1-5 的整数，5 最复杂。
id 必须是 "st_数字" 格式，从 0 开始递增。
dependsOn 是该子任务依赖的前置子任务 ID 列表，第一步的 dependsOn 为空数组。`

    const MIMO_BASE_URL = 'https://token-plan-cn.xiaomimimo.com/v1'
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
        temperature: 0.2,
        max_tokens: 800,
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

    if (!parsed || !Array.isArray(parsed.subtasks)) {
      throw new Error('LLM returned invalid subtask structure')
    }

    // 校验并转换
    const subtasks: SubTask[] = []
    for (const st of parsed.subtasks) {
      if (
        typeof st.id === 'string' &&
        typeof st.name === 'string' &&
        typeof st.description === 'string' &&
        Array.isArray(st.keywords) &&
        Array.isArray(st.dependsOn) &&
        typeof st.complexity === 'number'
      ) {
        subtasks.push({
          id: st.id,
          name: st.name,
          description: st.description,
          category: st.category || 'other',
          keywords: st.keywords.filter((k: unknown) => typeof k === 'string'),
          dependsOn: st.dependsOn.filter((d: unknown) => typeof d === 'string'),
          complexity: Math.max(1, Math.min(5, st.complexity | 0)),
        })
      }
    }

    if (subtasks.length === 0) {
      throw new Error('LLM returned no valid subtasks')
    }

    return subtasks
  }

  /**
   * 构建通用工作流（调研→方案→实现→验证）。
   * 当任务复杂但无法自动切分阶段时使用。
   */
  private buildGenericWorkflow(query: string): SubTask[] {
    const taskName = this.extractTaskName(query)
    const baseKeywords = this.extractKeywords(query)
    const category = this.inferCategory(query)

    return [
      {
        id: 'st_0',
        name: `调研与分析${taskName}`,
        description: `分析任务需求，调研相关技术和方案，明确 ${taskName} 的目标和边界。`,
        keywords: [...baseKeywords, '调研', '分析', '需求', 'research'],
        category: 'research',
        dependsOn: [],
        complexity: 2,
      },
      {
        id: 'st_1',
        name: `制定方案与设计`,
        description: `基于调研结果，制定 ${taskName} 的具体实施方案和技术设计。`,
        keywords: [...baseKeywords, '方案', '设计', '规划', 'planning', 'design'],
        category: 'planning',
        dependsOn: ['st_0'],
        complexity: 3,
      },
      {
        id: 'st_2',
        name: `实现与开发`,
        description: `按照方案，完成 ${taskName} 的具体实现。`,
        keywords: [...baseKeywords, '实现', '开发', '编码', 'development'],
        category,
        dependsOn: ['st_1'],
        complexity: 4,
      },
      {
        id: 'st_3',
        name: `验证与测试`,
        description: `验证 ${taskName} 的实现结果，确保质量达标，修复发现的问题。`,
        keywords: [...baseKeywords, '验证', '测试', 'testing', 'verification'],
        category: 'testing',
        dependsOn: ['st_2'],
        complexity: 2,
      },
    ]
  }

  /** 从文本中提取简短的任务名 */
  private extractTaskName(text: string): string {
    const cleaned = text.trim().replace(/[。！？\.!?]+$/, '')
    if (cleaned.length <= 20) return cleaned
    return cleaned.slice(0, 18) + '…'
  }

  /** 从文本中提取关键词（用于技能匹配） */
  private extractKeywords(text: string): string[] {
    const tokens = new Set<string>()

    // 英文关键词：长度 >= 4 的英文词
    const englishMatches = text.toLowerCase().match(/[a-z]{4,}/g) || []
    for (const t of englishMatches) {
      tokens.add(t)
    }

    // 中文关键词：2-4 字的中文片段
    const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || []
    const stopWords = new Set([
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都',
      '一个', '上', '也', '很', '到', '说', '要', '去', '你',
      '可以', '能', '应该', '需要', '使用', '用', '做', '进行',
      '这个', '那个', '什么', '怎么', '为什么',
    ])
    for (const seg of chineseChars) {
      if (seg.length <= 4) {
        if (!stopWords.has(seg)) tokens.add(seg)
        continue
      }
      for (let i = 0; i <= seg.length - 2; i++) {
        const bi = seg.slice(i, i + 2)
        if (!stopWords.has(bi)) tokens.add(bi)
      }
    }

    return Array.from(tokens).slice(0, 15)
  }

  /** 推断任务类别 */
  private inferCategory(text: string): string {
    const categoryKeywords: Record<string, string[]> = {
      debugging: ['debug', '调试', '报错', '错误', 'bug', '修复', 'crash', '崩溃', '异常', '排查', '定位'],
      'feature-development': ['实现', '开发', '新增', '添加', '功能', '创建', 'build', 'implement', 'feature'],
      refactoring: ['重构', '优化', '清理', 'refactor', '优化代码', 'code quality', '代码质量'],
      testing: ['测试', '单测', '单元测试', 'test', 'testing', '断言', 'assert', 'coverage', '用例'],
      documentation: ['文档', '注释', '说明', 'doc', 'documentation', '写文档', '教程'],
      planning: ['计划', '规划', '方案', '设计', '架构', 'architecture', 'plan', 'design', 'roadmap'],
      research: ['调研', '研究', '技术选型', '比较', 'benchmark', 'research', 'investigate'],
      deployment: ['部署', '上线', '发布', 'deploy', 'deployment', 'release'],
      'data-processing': ['数据', '分析', '统计', '处理', 'database', 'sql', 'etl'],
    }

    let bestCategory = 'other'
    let bestCount = 0

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      let count = 0
      const lowerText = text.toLowerCase()
      for (const kw of keywords) {
        if (lowerText.includes(kw.toLowerCase())) count++
      }
      if (count > bestCount) {
        bestCount = count
        bestCategory = category
      }
    }

    return bestCategory
  }

  /** 估算任务复杂度（1-5） */
  private estimateTaskComplexity(text: string): number {
    const len = text.length
    // 长度维度
    let score = 1
    if (len > 200) score += 1
    if (len > 500) score += 1
    if (len > 1000) score += 1

    // 复杂度信号
    const complexitySignals = [
      '需要', '涉及', '包括', '多个', '各种', '以及', '然后', '接着',
      '首先', '其次', '最后', '步骤', '阶段',
    ]
    const lowerText = text.toLowerCase()
    for (const sig of complexitySignals) {
      if (lowerText.includes(sig)) {
        score += 0.3
        break
      }
    }

    return Math.max(1, Math.min(5, Math.round(score)))
  }

  private apiKeyCache: string | null = null
  private apiKeyResolved = false

  private getApiKey(): string | null {
    if (this.apiKeyResolved) return this.apiKeyCache
    if (process.env.MIMO_API_KEY) {
      this.apiKeyCache = process.env.MIMO_API_KEY
      this.apiKeyResolved = true
      return this.apiKeyCache
    }
    try {
      const { readFileSync, homedir } = (require as any)?.('node:fs') ? (globalThis as any).require : null
      // ESM fallback
      import('node:fs').then(() => {}).catch(() => {})
    } catch { /* ignore */ }
    this.apiKeyResolved = true
    return null
  }

  private parseJSON(text: string): any {
    try { return JSON.parse(text.trim()) } catch { /* continue */ }

    const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonBlock && jsonBlock[1]) {
      try { return JSON.parse(jsonBlock[1]!.trim()) } catch { /* continue */ }
    }

    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1).trim())
      } catch { /* continue */ }
    }

    throw new Error('Failed to parse JSON from LLM response')
  }
}

// ============================================================
// WorkflowBuilder —— 工作流构建器
// ============================================================

/**
 * 工作流构建器：为每个子任务匹配最佳技能，生成可执行的工作流。
 *
 * 匹配策略（加权）：
 * - 关键词匹配（与子任务关键词的重合度）：权重 0.5
 * - 类别匹配（子任务类别 vs 技能 category）：权重 0.2
 * - 技能质量分（验证分 + 反馈分）：权重 0.3
 *
 * 依赖处理：
 * - 拓扑排序，确保依赖的子任务在前
 * - 循环依赖检测
 */
export class WorkflowBuilder extends BaseService {
  private registry: SkillRegistry

  constructor(ctx: any, config: SkillForgeConfig, registry: SkillRegistry) {
    super(ctx, config)
    this.registry = registry
  }

  /**
   * 根据子任务列表构建工作流。
   */
  build(query: string, subtasks: SubTask[]): SkillWorkflow {
    const now = Date.now()

    // 1. 为每个子任务匹配最佳技能
    const nodes: WorkflowNode[] = subtasks.map((subtask, index) => {
      const match = this.findBestSkill(subtask)
      return {
        subtask,
        matchedSkill: match || undefined,
        order: index, // 暂时用索引，后面拓扑排序后重新计算
        status: 'pending',
      }
    })

    // 2. 拓扑排序
    const sorted = this.topologicalSort(nodes)

    // 3. 计算工作流整体置信度
    const matchedCount = sorted.filter(n => n.matchedSkill).length
    const avgMatchScore = matchedCount > 0
      ? sorted.reduce((sum, n) => sum + (n.matchedSkill?.score || 0), 0) / matchedCount
      : 0

    const confidence = this.computeWorkflowConfidence(
      subtasks.length,
      matchedCount,
      avgMatchScore,
    )

    const workflow: SkillWorkflow = {
      id: `wf_${now}_${Math.random().toString(36).slice(2, 8)}`,
      originalQuery: query,
      nodes: sorted.map((n, i) => ({ ...n, order: i })),
      totalNodes: sorted.length,
      matchedNodes: matchedCount,
      unmatchedNodes: sorted.length - matchedCount,
      confidence,
      createdAt: now,
      updatedAt: now,
      currentStep: 0,
      status: 'created',
    }

    return workflow
  }

  /**
   * 为单个子任务找到最佳匹配的技能。
   * 返回得分最高且超过阈值的技能匹配，没有则返回 null。
   */
  findBestSkill(subtask: SubTask): SkillMatch | null {
    const activeSkills = this.registry.listSkills(SkillStatus.ACTIVE)
    if (activeSkills.length === 0) return null

    const matches: SkillMatch[] = []

    for (const skill of activeSkills) {
      const keywordScore = this.computeKeywordScore(subtask.keywords, skill)
      const categoryScore = this.computeCategoryScore(subtask.category, skill)
      const qualityScore = this.computeQualityScore(skill)

      const score = keywordScore * 0.5 + categoryScore * 0.2 + qualityScore * 0.3

      if (score >= 0.25) {
        matches.push({
          skill,
          score,
          keywordScore,
          categoryScore,
          qualityScore,
          reason: this.generateMatchReason(subtask, skill, keywordScore, categoryScore),
        })
      }
    }

    if (matches.length === 0) return null

    matches.sort((a, b) => b.score - a.score)
    return matches[0] ?? null
  }

  /** 关键词匹配得分 */
  private computeKeywordScore(keywords: string[], skill: Skill): number {
    if (keywords.length === 0) return 0

    const fm = skill.frontmatter
    const skillText = [
      fm.name,
      fm.description,
      fm.whenToUse || '',
      (fm.tags || []).join(' '),
      fm.category || '',
      skill.body.slice(0, 1000),
    ].join(' ').toLowerCase()

    let matched = 0
    for (const kw of keywords) {
      if (skillText.includes(kw.toLowerCase())) matched++
    }

    // 归一化 + 非线性放大：命中 1 个得分低，命中多个快速上升
    const ratio = matched / keywords.length
    return Math.min(ratio * 1.2, 1)
  }

  /** 类别匹配得分 */
  private computeCategoryScore(category: string | undefined, skill: Skill): number {
    if (!category) return 0.3 // 没有类别时给一个中性分

    const skillCategory = skill.frontmatter.category?.toLowerCase() || ''
    const targetCategory = category.toLowerCase()

    // 完全匹配
    if (skillCategory === targetCategory) return 1

    // 宽泛匹配：同大类
    const categoryGroups: Record<string, string[]> = {
      dev: ['debugging', 'feature-development', 'refactoring', 'testing'],
      quality: ['code-review', 'testing', 'refactoring'],
      planning: ['planning', 'research'],
    }

    for (const group of Object.values(categoryGroups)) {
      if (group.includes(targetCategory) && group.includes(skillCategory)) {
        return 0.6
      }
    }

    return 0
  }

  /** 技能质量得分 */
  private computeQualityScore(skill: Skill): number {
    const verificationScore = skill.verificationScore ?? 0.5
    const feedbackScore = (skill.feedbackScore + 1) / 2 // -1..1 → 0..1
    return verificationScore * 0.6 + feedbackScore * 0.4
  }

  /** 生成匹配理由 */
  private generateMatchReason(
    subtask: SubTask,
    skill: Skill,
    keywordScore: number,
    categoryScore: number,
  ): string {
    const reasons: string[] = []

    if (keywordScore >= 0.5) {
      reasons.push('关键词高度匹配')
    } else if (keywordScore >= 0.25) {
      reasons.push('关键词部分匹配')
    }

    if (categoryScore >= 0.8) {
      reasons.push('类别完全一致')
    } else if (categoryScore >= 0.5) {
      reasons.push('同属一大类')
    }

    if (reasons.length === 0) {
      reasons.push('质量分达标')
    }

    return reasons.join('、')
  }

  /**
   * 拓扑排序：根据 dependsOn 关系排序。
   * 检测循环依赖，若有则退化为线性顺序并记录警告。
   */
  private topologicalSort(nodes: WorkflowNode[]): WorkflowNode[] {
    const nodeMap = new Map(nodes.map(n => [n.subtask.id, n]))
    const inDegree = new Map<string, number>()

    // 初始化入度
    for (const node of nodes) {
      inDegree.set(node.subtask.id, node.subtask.dependsOn.length)
    }

    const result: WorkflowNode[] = []
    const queue: string[] = []

    // 找到所有入度为 0 的节点
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(id)
    }

    while (queue.length > 0) {
      const id = queue.shift()!
      const node = nodeMap.get(id)
      if (node) result.push(node)

      // 更新相邻节点的入度
      for (const [otherId, otherNode] of nodeMap.entries()) {
        if (otherNode.subtask.dependsOn.includes(id)) {
          const newDegree = (inDegree.get(otherId) || 1) - 1
          inDegree.set(otherId, newDegree)
          if (newDegree === 0 && !queue.includes(otherId)) {
            queue.push(otherId)
          }
        }
      }
    }

    // 如果结果数量不等于节点总数，说明有循环依赖
    if (result.length !== nodes.length) {
      this.log('warn', `Cyclic dependency detected in workflow, falling back to linear order (${result.length}/${nodes.length} sorted)`)
      return nodes.map((n, i) => ({ ...n, order: i }))
    }

    return result
  }

  /** 计算工作流整体置信度 */
  private computeWorkflowConfidence(
    totalSubtasks: number,
    matchedCount: number,
    avgMatchScore: number,
  ): number {
    if (totalSubtasks === 0) return 0

    const coverage = matchedCount / totalSubtasks
    // 覆盖率权重 0.4，平均匹配质量权重 0.6
    return coverage * 0.4 + avgMatchScore * 0.6
  }
}

// ============================================================
// SkillOrchestrator —— 技能编排器主类
// ============================================================

/**
 * 技能编排器：对外暴露的统一入口。
 *
 * 主要功能：
 * 1. orchestrate(query) —— 对一个任务做完整编排，生成工作流 + 注入建议
 * 2. getExecutionGuide(workflow) —— 生成给 Agent 的执行指南（Markdown）
 * 3. injectWorkflowSkills(workflow) —— 通过 InjectionEngine 注入工作流相关技能
 *
 * 使用场景：
 * - 复杂任务到达时，先编排再执行
 * - 用户手动调用「技能组合规划」功能
 */
export class SkillOrchestrator extends BaseService {
  private registry: SkillRegistry
  private injectionEngine: InjectionEngine | null = null
  private decomposer: TaskDecomposer
  private builder: WorkflowBuilder

  /** 运行时工作流缓存（sessionId -> workflow） */
  private workflows: Map<string, SkillWorkflow> = new Map()

  /** 统计 */
  private stats = {
    totalOrchestrations: 0,
    multiSkillWorkflows: 0,
    avgSkillsPerWorkflow: 0,
    totalSkillsMatched: 0,
  }

  constructor(
    ctx: any,
    config: SkillForgeConfig,
    registry: SkillRegistry,
    options?: { injectionEngine?: InjectionEngine },
  ) {
    super(ctx, config)
    this.registry = registry
    this.injectionEngine = options?.injectionEngine || null
    this.decomposer = new TaskDecomposer(ctx, config, registry)
    this.builder = new WorkflowBuilder(ctx, config, registry)
  }

  /** 绑定 InjectionEngine（若构造时未提供） */
  setInjectionEngine(engine: InjectionEngine): void {
    this.injectionEngine = engine
  }

  // ============================================================
  // 核心 API
  // ============================================================

  /**
   * 对一个任务做完整编排。
   *
   * 流程：
   * 1. 任务分解 → 得到子任务列表
   * 2. 工作流构建 → 为每个子任务匹配技能，做拓扑排序
   * 3. 生成执行指南 + 注入建议
   */
  async orchestrate(query: string, options?: {
    mode?: 'fast' | 'llm' | 'auto'
    sessionId?: string
  }): Promise<OrchestrationResult> {
    const mode = options?.mode || 'auto'

    this.log('info', `Orchestrating task: ${query.slice(0, 80)}${query.length > 80 ? '…' : ''}`)

    // Step 1: 任务分解
    const { subtasks, method } = await this.decomposer.decompose(query, mode)
    this.log('debug', `Decomposed into ${subtasks.length} subtasks (method=${method})`)

    // Step 2: 构建工作流
    const workflow = this.builder.build(query, subtasks)
    this.log('debug', `Workflow built: ${workflow.matchedNodes}/${workflow.totalNodes} matched, confidence=${workflow.confidence.toFixed(2)}`)

    // Step 3: 缓存工作流
    if (options?.sessionId) {
      this.workflows.set(options.sessionId, workflow)
    }

    // Step 4: 更新统计
    this.stats.totalOrchestrations++
    if (workflow.matchedNodes >= 2) {
      this.stats.multiSkillWorkflows++
    }
    this.stats.totalSkillsMatched += workflow.matchedNodes
    this.stats.avgSkillsPerWorkflow = this.stats.totalSkillsMatched / this.stats.totalOrchestrations

    // Step 5: 生成执行指南
    const executionGuide = this.generateExecutionGuide(workflow)

    // Step 6: 计算需要注入的技能
    const skillIdsToInject = workflow.nodes
      .filter(n => n.matchedSkill)
      .sort((a, b) => (b.matchedSkill!.score) - (a.matchedSkill!.score))
      .map(n => n.matchedSkill!.skill.id)

    // 去重
    const uniqueIds = [...new Set(skillIdsToInject)]

    // 估算 token
    const estimatedTokens = uniqueIds.reduce((sum, id) => {
      const skill = this.registry.getSkill(id)
      if (!skill) return sum
      return sum + this.estimateSkillTokens(skill)
    }, 0)

    return {
      workflow,
      skillIdsToInject: uniqueIds,
      executionGuide,
      estimatedTokens,
    }
  }

  /**
   * 为一个会话注入工作流所需的技能。
   * 委托给 InjectionEngine 执行实际的动态注册。
   */
  async injectWorkflowSkills(
    workflow: SkillWorkflow,
    sessionId?: string,
  ): Promise<{ injected: string[]; skipped: string[]; totalTokens: number }> {
    const skillIds = [...new Set(
      workflow.nodes
        .filter(n => n.matchedSkill)
        .map(n => n.matchedSkill!.skill.id)
    )]

    const injected: string[] = []
    const skipped: string[] = []
    let totalTokens = 0

    for (const id of skillIds) {
      const skill = this.registry.getSkill(id)
      if (!skill) {
        skipped.push(id)
        continue
      }

      const ok = await this.registry.ensureRegistered(id)
      if (ok) {
        injected.push(id)
        totalTokens += this.estimateSkillTokens(skill)
        this.registry.recordUsage(id).catch(() => {})
      } else {
        skipped.push(id)
      }
    }

    this.log('info', `Workflow skill injection: ${injected.length} injected, ${skipped.length} skipped, ${totalTokens} tokens`)
    return { injected, skipped, totalTokens }
  }

  /**
   * 获取当前会话的工作流（若存在）。
   */
  getWorkflow(sessionId: string): SkillWorkflow | undefined {
    return this.workflows.get(sessionId)
  }

  /**
   * 更新工作流节点状态（用于执行过程中的进度跟踪）。
   */
  updateNodeStatus(
    sessionId: string,
    nodeIndex: number,
    status: WorkflowNode['status'],
    resultSummary?: string,
  ): boolean {
    const workflow = this.workflows.get(sessionId)
    if (!workflow || nodeIndex < 0 || nodeIndex >= workflow.nodes.length) {
      return false
    }

    const node = workflow.nodes[nodeIndex]!
    node.status = status
    if (resultSummary) {
      node.resultSummary = resultSummary
    }

    // 更新当前步骤指针
    if (status === 'running' && nodeIndex >= workflow.currentStep) {
      workflow.currentStep = nodeIndex
    }
    if (status === 'completed' && nodeIndex >= workflow.currentStep) {
      workflow.currentStep = Math.min(nodeIndex + 1, workflow.totalNodes - 1)
    }

    // 更新整体状态
    const allCompleted = workflow.nodes.every(n => n.status === 'completed' || n.status === 'skipped')
    const anyFailed = workflow.nodes.some(n => n.status === 'failed')
    const anyRunning = workflow.nodes.some(n => n.status === 'running')

    if (allCompleted) {
      workflow.status = 'completed'
    } else if (anyFailed) {
      workflow.status = 'failed'
    } else if (anyRunning || workflow.currentStep > 0) {
      workflow.status = 'running'
    }

    workflow.updatedAt = Date.now()
    return true
  }

  /**
   * 生成给 Agent 的执行指南（Markdown 格式）。
   * 这份指南会被注入到对话上下文中，指导 Agent 按工作流执行。
   */
  generateExecutionGuide(workflow: SkillWorkflow): string {
    const lines: string[] = []

    lines.push('## 🎯 技能组合执行指南')
    lines.push('')
    lines.push(`> 本任务已自动分解为 ${workflow.totalNodes} 个子任务，其中 ${workflow.matchedNodes} 个匹配到了专用技能。`)
    lines.push(`> 整体置信度：${(workflow.confidence * 100).toFixed(0)}%`)
    lines.push('')

    lines.push('### 执行顺序')
    lines.push('')

    for (let i = 0; i < workflow.nodes.length; i++) {
      const node = workflow.nodes[i]!
      const st = node.subtask
      const skill = node.matchedSkill

      const stepNum = i + 1
      const skillInfo = skill
        ? `**[已匹配技能]** ${skill.skill.frontmatter.name}（匹配度 ${(skill.score * 100).toFixed(0)}% — ${skill.reason}）`
        : '*[无专用技能，按通用方法执行]*'

      lines.push(`**第 ${stepNum} 步：${st.name}**`)
      lines.push(`- 描述：${st.description}`)
      lines.push(`- 类别：${st.category || '未分类'}｜复杂度：${'★'.repeat(st.complexity)}${'☆'.repeat(5 - st.complexity)}`)
      lines.push(`- ${skillInfo}`)
      if (st.dependsOn.length > 0) {
        const depNames = st.dependsOn.map(depId => {
          const depNode = workflow.nodes.find(n => n.subtask.id === depId)
          return depNode ? depNode.subtask.name : depId
        }).join('、')
        lines.push(`- 前置依赖：${depNames}`)
      }
      lines.push('')
    }

    lines.push('### 执行原则')
    lines.push('')
    lines.push('1. **按顺序执行**：严格按照上面的步骤顺序推进，完成前置依赖后再进入下一步')
    lines.push('2. **优先使用技能**：每一步优先使用匹配到的技能中描述的方法，不要自己随意发挥')
    lines.push('3. **逐步验证**：每完成一步，确认该步目标已达成再继续')
    lines.push('4. **灵活调整**：若某一步发现前置假设错误，可以回溯调整，但需记录原因')
    lines.push('5. **产出汇总**：全部完成后，给出最终产出和各步骤的执行摘要')
    lines.push('')

    return lines.join('\n')
  }

  /** 获取编排器统计 */
  getStats() {
    return { ...this.stats }
  }

  // ============================================================
  // 内部工具方法
  // ============================================================

  private estimateSkillTokens(skill: Skill): number {
    const fm = skill.frontmatter
    const text =
      fm.name + '\n' +
      fm.description + '\n' +
      fm.whenToUse + '\n' +
      (fm.tags?.join(' ') || '') + '\n' +
      skill.body
    return Math.ceil(text.length / 4)
  }
}
