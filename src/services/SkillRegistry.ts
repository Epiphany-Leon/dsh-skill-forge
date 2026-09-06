/**
 * SkillRegistry —— 技能库管理
 *
 * 管理锻造出的技能的存储、注册、激活、归档。
 * 与 DSH 官方 ctx.skills 深度对接：
 * - 激活的技能通过 ctx.skills.register() 注册为运行时技能
 * - 归档时取消注册
 * - 插件启动时重新加载所有激活状态的技能
 *
 * 功能：
 * - CRUD：activate / list / get / update / delete / archive / unarchive
 * - 版本管理：saveVersionSnapshot / getVersionHistory / getSkillVersion / rollbackToVersion
 * - 使用统计：recordUsage / getTopSkills
 * - 搜索筛选：searchSkills（关键词 + 状态 + 分类 + 排序 + 分页）
 * - 动态注册：ensureRegistered / ensureUnregistered / getRegisteredSkillIds / unregisterAll
 */

import { BaseService } from './BaseService.js'
import {
  SkillStatus,
  type Skill,
  type ForgeRun,
  type SkillFrontmatter,
  type SkillForgeConfig,
  type SkillVersionEntry,
} from '../types.js'

/** 技能排序字段 */
export type SkillSortField = 'name' | 'qualityScore' | 'usageCount' | 'createdAt' | 'updatedAt'

/** 搜索参数 */
export interface SkillSearchOptions {
  status?: SkillStatus
  category?: string
  sortBy?: SkillSortField
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/** DSH 运行时技能注册的 disposer */
type SkillDisposer = () => void

export class SkillRegistry extends BaseService {
  private skills: Map<string, Skill> = new Map()
  /** 技能 ID → DSH runtime 注册 disposer，用于归档/释放时取消注册 */
  private dshDisposers: Map<string, SkillDisposer> = new Map()
  private storagePath: string = ''

  constructor(ctx: any, config: SkillForgeConfig) {
    super(ctx, config)
  }

  private async ensureStoragePath(): Promise<void> {
    if (this.storagePath) return
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd()
    this.storagePath = `${homeDir}/.dsh/skills-forged`
    await this.ensureDir(this.storagePath)
    this.log('info', `Skill registry storage path: ${this.storagePath}`)
  }

  /** 获取存储路径 */
  getStoragePath(): string {
    return this.storagePath
  }

  async initialize(): Promise<void> {
    // 确定存储路径
    await this.ensureStoragePath()

    // 加载已有技能（激活的自动注册到 DSH）
    await this.loadSkills()

    // 如果没有任何技能，创建示例数据（演示用）
    if (this.skills.size === 0) {
      await this.seedDemoData()
      await this.loadSkills()
    }

    this.log('info', `Skill registry initialized: ${this.skills.size} skills loaded (${this.dshDisposers.size} active in DSH)`)
  }

  // ============================================================
  // 技能 CRUD
  // ============================================================

  /**
   * 激活锻造完成的技能
   */
  async activateForgedSkill(run: ForgeRun): Promise<string> {
    const generated = run.generatedSkill
    if (!generated) {
      throw new Error('No generated skill in run')
    }

    // 生成 kebab-case 的技能名（DSH 要求）
    const skillName = this.toKebabCase(generated.frontmatter.name)

    const qualityScore = run.verificationResult?.overallScore ?? generated.qualityScore
    const category = generated.frontmatter.category
      || this.inferCategory(generated.frontmatter.tags || [])

    const skillId = `forged_${Date.now()}`
    const skill: Skill = {
      id: skillId,
      frontmatter: {
        ...generated.frontmatter,
        name: skillName,
        source: 'forged',
        forgedFrom: run.sourceSessionIds,
        version: '1.0.0',
        category,
        qualityScore,
        forgedFromRunId: run.id,
        usageCount: 0,
        feedbackHelpful: 0,
        feedbackHarmful: 0,
        feedbackNeutral: 0,
        feedbackCount: 0,
        feedbackScore: 0,
        positiveFeedbacks: 0,
        negativeFeedbacks: 0,
        lastDecayAt: Date.now(),
      },
      body: generated.body,
      status: SkillStatus.ACTIVE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      forgeRunId: run.id,
      verificationScore: qualityScore,
      usageCount: 0,
      feedbackHelpful: 0,
      feedbackHarmful: 0,
      feedbackNeutral: 0,
      feedbackCount: 0,
      feedbackScore: 0,
      positiveFeedbacks: 0,
      negativeFeedbacks: 0,
      lastDecayAt: Date.now(),
      version: generated.frontmatter.version || '1.0.0',
    }

    // 写入文件系统
    await this.writeSkillToDisk(skill)

    // 写入初始版本（1.0.0）到 versions/ 目录
    await this.saveVersionSnapshot(skill, 'Initial version')

    // 注册到 DSH 技能系统（runtime registration）
    await this.registerSkillWithDSH(skill)

    this.skills.set(skillId, skill)
    this.log('info', `Skill activated: ${skill.frontmatter.name} (${skillId})`)

    return skillId
  }

  /**
   * 获取所有技能
   */
  listSkills(status?: SkillStatus): Skill[] {
    let skills = Array.from(this.skills.values())
    if (status) {
      skills = skills.filter(s => s.status === status)
    }
    return skills.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 获取单个技能
   */
  getSkill(id: string): Skill | undefined {
    return this.skills.get(id)
  }

  /**
   * 通过名字查找技能
   */
  getSkillByName(name: string): Skill | undefined {
    const normalized = name.toLowerCase()
    return Array.from(this.skills.values()).find(
      s => s.frontmatter.name.toLowerCase() === normalized,
    )
  }

  /**
   * 检测重复技能
   */
  async findDuplicate(frontmatter: SkillFrontmatter): Promise<string | null> {
    const name = this.toKebabCase(frontmatter.name)
    const existing = this.listSkills(SkillStatus.ACTIVE).find(
      s => s.frontmatter.name.toLowerCase() === name.toLowerCase(),
    )
    return existing?.id || null
  }

  /**
   * 更新技能内容（自动保存版本快照）
   */
  async updateSkill(id: string, updates: { frontmatter?: Partial<SkillFrontmatter>; body?: string; bumpLevel?: 'major' | 'minor' | 'patch'; changelog?: string }): Promise<Skill | null> {
    const skill = this.skills.get(id)
    if (!skill) return null

    // 先保存当前版本为快照
    await this.saveVersionSnapshot(skill, updates.changelog)

    if (updates.frontmatter) {
      skill.frontmatter = { ...skill.frontmatter, ...updates.frontmatter }
    }
    if (updates.body !== undefined) {
      skill.body = updates.body
    }

    // 版本号递增
    if (updates.bumpLevel) {
      const newVersion = this.bumpVersion(skill.version, updates.bumpLevel)
      skill.version = newVersion
      skill.frontmatter.version = newVersion
    }

    skill.updatedAt = Date.now()

    // 写回磁盘
    await this.writeSkillToDisk(skill)

    // 如果是激活状态，重新注册到 DSH
    if (skill.status === SkillStatus.ACTIVE) {
      this.unregisterSkillFromDSH(id)
      await this.registerSkillWithDSH(skill)
    }

    this.log('info', `Skill updated: ${skill.frontmatter.name} (${id}) -> v${skill.version}`)
    return skill
  }

  /**
   * 删除技能（磁盘 + 内存 + DSH）
   */
  async deleteSkill(id: string): Promise<boolean> {
    const skill = this.skills.get(id)
    if (!skill) return false

    // 从 DSH 取消注册
    this.unregisterSkillFromDSH(id)

    // 从磁盘删除
    await this.ensureStoragePath()
    const fs = await import('node:fs/promises')
    const skillDir = this.getSkillDir(skill)
    try {
      await fs.rm(skillDir, { recursive: true, force: true })
    } catch (err) {
      this.log('warn', `Failed to delete skill dir: ${(err as Error).message}`)
    }

    // 从内存删除
    this.skills.delete(id)

    this.log('info', `Skill deleted: ${skill.frontmatter.name} (${id})`)
    return true
  }

  /**
   * 归档技能：取消 DSH 注册 + 磁盘重命名
   */
  async archiveSkill(id: string): Promise<boolean> {
    const skill = this.skills.get(id)
    if (!skill) return false

    skill.status = SkillStatus.ARCHIVED
    skill.updatedAt = Date.now()

    // 从 DSH 取消注册
    this.unregisterSkillFromDSH(id)

    // 磁盘重命名（加 .archived_ 前缀，躲过 skill-filesystem 扫描）
    await this.archiveSkillOnDisk(skill)

    this.log('info', `Skill archived: ${skill.frontmatter.name}`)
    return true
  }

  /**
   * 恢复技能：重新注册到 DSH + 磁盘重命名回
   */
  async unarchiveSkill(id: string): Promise<boolean> {
    const skill = this.skills.get(id)
    if (!skill || skill.status !== SkillStatus.ARCHIVED) return false

    skill.status = SkillStatus.ACTIVE
    skill.updatedAt = Date.now()

    // 磁盘重命名回
    await this.unarchiveSkillOnDisk(skill)

    // 重新注册到 DSH
    await this.registerSkillWithDSH(skill)

    this.log('info', `Skill unarchived: ${skill.frontmatter.name}`)
    return true
  }

  // ============================================================
  // 动态注册 / 取消注册（供 InjectionEngine 使用）
  // ============================================================

  /**
   * 动态注册单个技能到 DSH（幂等：已注册则跳过）。
   */
  async ensureRegistered(skillId: string): Promise<boolean> {
    const skill = this.skills.get(skillId)
    if (!skill || skill.status !== SkillStatus.ACTIVE) return false
    if (this.dshDisposers.has(skillId)) return true
    await this.registerSkillWithDSH(skill)
    return this.dshDisposers.has(skillId)
  }

  /**
   * 动态取消注册单个技能（幂等：未注册则跳过）。
   */
  ensureUnregistered(skillId: string): boolean {
    if (!this.dshDisposers.has(skillId)) return false
    this.unregisterSkillFromDSH(skillId)
    return !this.dshDisposers.has(skillId)
  }

  /**
   * 返回当前在 DSH 中已注册的技能 ID 集合。
   */
  getRegisteredSkillIds(): Set<string> {
    return new Set(this.dshDisposers.keys())
  }

  /**
   * 取消注册所有技能（用于切换到智能注入模式前的清理）。
   */
  unregisterAll(): number {
    const count = this.dshDisposers.size
    for (const id of Array.from(this.dshDisposers.keys())) {
      this.unregisterSkillFromDSH(id)
    }
    return count
  }

  // ============================================================
  // 使用统计
  // ============================================================

  /**
   * 记录技能使用：次数+1，更新最后使用时间，并持久化到磁盘
   */
  async recordUsage(id: string): Promise<void> {
    const skill = this.skills.get(id)
    if (!skill) return

    skill.usageCount++
    skill.lastUsedAt = Date.now()
    skill.frontmatter.usageCount = skill.usageCount
    skill.frontmatter.lastUsedAt = skill.lastUsedAt

    // 异步持久化，失败不影响运行
    try {
      await this.writeSkillToDisk(skill)
    } catch (err) {
      this.log('warn', `Failed to persist usage for skill ${id}: ${(err as Error).message}`)
    }
  }

  // ============================================================
  // 使用反馈（奖励驱动进化）
  // ============================================================

  /**
   * 记录技能使用反馈：有用/无用/一般（显式反馈）。
   *
   * 奖励驱动模型：
   * - feedbackScore 是一个 -1 ~ 1 的连续值，通过增量调整而非比例计算
   * - 显式反馈权重 = implicit step * explicitFeedbackMultiplier
   * - 正反馈有上限 1.0，负反馈有下限 -1.0
   * - 每天向 0 回归 dailyDecayRate 比例，避免一次评价永久影响
   */
  async recordFeedback(id: string, feedback: { rating: 'helpful' | 'neutral' | 'harmful'; comment?: string }): Promise<void> {
    const skill = this.skills.get(id)
    if (!skill) return

    // 先做日衰减
    this.applyDailyDecay(skill)

    const multiplier = this.config.explicitFeedbackMultiplier ?? 3
    const posStep = (this.config.implicitPositiveStep ?? 0.1) * multiplier
    const negStep = (this.config.implicitNegativeStep ?? 0.15) * multiplier

    switch (feedback.rating) {
      case 'helpful':
        skill.feedbackHelpful++
        skill.positiveFeedbacks++
        skill.feedbackScore = Math.min(1, skill.feedbackScore + posStep)
        break
      case 'harmful':
        skill.feedbackHarmful++
        skill.negativeFeedbacks++
        skill.feedbackScore = Math.max(-1, skill.feedbackScore - negStep)
        break
      case 'neutral':
        skill.feedbackNeutral++
        // 中性反馈不改变分数
        break
    }
    skill.feedbackCount++
    // 保留三位小数
    skill.feedbackScore = Math.round(skill.feedbackScore * 1000) / 1000

    // 同步到 frontmatter
    this.syncFeedbackToFrontmatter(skill)
    skill.updatedAt = Date.now()

    // 异步持久化
    try {
      await this.writeSkillToDisk(skill)
    } catch (err) {
      this.log('warn', `Failed to persist feedback for skill ${id}: ${(err as Error).message}`)
    }
  }

  /**
   * 记录隐式反馈（根据用户后续行为推断）。
   *
   * feedbackType:
   *   - 'positive_implicit'  正向隐式：用户继续使用技能提到的工具/方法，对话沿技能方向深入
   *   - 'negative_implicit'  负向隐式：用户换方向、说「不对/不行/换个思路」，调用完全不同的工具
   *   - 'neutral_implicit'   中性：继续对话但方向不明
   *
   * context: 可选的上下文信息（如触发信号描述），只用于日志
   */
  async recordImplicitFeedback(
    skillName: string,
    feedbackType: 'positive_implicit' | 'negative_implicit' | 'neutral_implicit',
    context?: string,
  ): Promise<void> {
    if (!this.config.enableRewardLearning) return

    const skill = this.getSkillByName(skillName)
    if (!skill) return

    // 先做日衰减
    this.applyDailyDecay(skill)

    const posStep = this.config.implicitPositiveStep ?? 0.1
    const negStep = this.config.implicitNegativeStep ?? 0.15

    switch (feedbackType) {
      case 'positive_implicit':
        skill.positiveFeedbacks++
        skill.feedbackScore = Math.min(1, skill.feedbackScore + posStep)
        break
      case 'negative_implicit':
        skill.negativeFeedbacks++
        skill.feedbackScore = Math.max(-1, skill.feedbackScore - negStep)
        break
      case 'neutral_implicit':
        // 中性不改变分数，仅计数
        break
    }
    skill.feedbackScore = Math.round(skill.feedbackScore * 1000) / 1000

    this.syncFeedbackToFrontmatter(skill)
    skill.updatedAt = Date.now()

    this.log('debug', `Implicit feedback [${feedbackType}] for ${skillName} (score=${skill.feedbackScore})${context ? ` — ${context}` : ''}`)

    try {
      await this.writeSkillToDisk(skill)
    } catch (err) {
      this.log('warn', `Failed to persist implicit feedback for skill ${skillName}: ${(err as Error).message}`)
    }
  }

  /**
   * 对所有技能应用日衰减（可被外部调用，例如每天触发一次，或在每次访问时懒触发）。
   * 向 0 回归 dailyDecayRate 比例，保守缓慢，避免剧烈波动。
   */
  applyDailyDecayToAll(): number {
    if (!this.config.enableRewardLearning) return 0
    const rate = this.config.dailyDecayRate ?? 0.05
    if (rate <= 0) return 0

    const dayMs = 24 * 60 * 60 * 1000
    const now = Date.now()
    let decayed = 0

    for (const skill of this.skills.values()) {
      const last = skill.lastDecayAt ?? skill.updatedAt ?? now
      const daysPassed = (now - last) / dayMs
      if (daysPassed < 1) continue

      // 每过一天，向 0 回归 rate 比例
      const steps = Math.floor(daysPassed)
      for (let i = 0; i < steps; i++) {
        if (skill.feedbackScore > 0) {
          skill.feedbackScore = Math.max(0, skill.feedbackScore * (1 - rate))
        } else if (skill.feedbackScore < 0) {
          skill.feedbackScore = Math.min(0, skill.feedbackScore * (1 - rate))
        } else {
          break
        }
      }
      skill.feedbackScore = Math.round(skill.feedbackScore * 1000) / 1000
      skill.lastDecayAt = now
      this.syncFeedbackToFrontmatter(skill)
      decayed++
    }

    if (decayed > 0) {
      this.log('info', `Applied daily decay to ${decayed} skills (rate=${rate})`)
    }
    return decayed
  }

  /**
   * 对单个技能应用日衰减（懒触发：在每次更新分数前调用）。
   */
  private applyDailyDecay(skill: Skill): void {
    if (!this.config.enableRewardLearning) return
    const rate = this.config.dailyDecayRate ?? 0.05
    if (rate <= 0) return

    const dayMs = 24 * 60 * 60 * 1000
    const now = Date.now()
    const last = skill.lastDecayAt ?? skill.updatedAt ?? now
    const daysPassed = Math.floor((now - last) / dayMs)
    if (daysPassed < 1) return

    for (let i = 0; i < daysPassed; i++) {
      if (skill.feedbackScore > 0) {
        skill.feedbackScore = Math.max(0, skill.feedbackScore * (1 - rate))
      } else if (skill.feedbackScore < 0) {
        skill.feedbackScore = Math.min(0, skill.feedbackScore * (1 - rate))
      } else {
        break
      }
    }
    skill.feedbackScore = Math.round(skill.feedbackScore * 1000) / 1000
    skill.lastDecayAt = now
  }

  /** 将内存中的反馈字段同步到 frontmatter */
  private syncFeedbackToFrontmatter(skill: Skill): void {
    skill.frontmatter.feedbackHelpful = skill.feedbackHelpful
    skill.frontmatter.feedbackHarmful = skill.feedbackHarmful
    skill.frontmatter.feedbackNeutral = skill.feedbackNeutral
    skill.frontmatter.feedbackCount = skill.feedbackCount
    skill.frontmatter.feedbackScore = skill.feedbackScore
    ;(skill.frontmatter as any).positiveFeedbacks = skill.positiveFeedbacks
    ;(skill.frontmatter as any).negativeFeedbacks = skill.negativeFeedbacks
    ;(skill.frontmatter as any).lastDecayAt = skill.lastDecayAt
  }

  /**
   * 按使用次数排序返回 top N 技能
   */
  getTopSkills(limit = 10): Skill[] {
    return Array.from(this.skills.values())
      .filter(s => s.status === SkillStatus.ACTIVE)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
  }

  // ============================================================
  // 搜索与筛选
  // ============================================================

  /**
   * 搜索与筛选技能
   * 支持关键词搜索（名称/描述/标签/分类）+ 状态/分类筛选 + 多维度排序 + 分页
   */
  searchSkills(query?: string, options: SkillSearchOptions = {}): Skill[] {
    let skills = Array.from(this.skills.values())

    // 状态筛选
    if (options.status) {
      skills = skills.filter(s => s.status === options.status)
    }

    // 分类筛选
    if (options.category) {
      const cat = options.category.toLowerCase()
      skills = skills.filter(s =>
        s.frontmatter.category?.toLowerCase() === cat
      )
    }

    // 关键词搜索（名称/描述/whenToUse/标签/分类）
    if (query && query.trim()) {
      const q = query.trim().toLowerCase()
      skills = skills.filter(s => {
        const name = s.frontmatter.name.toLowerCase()
        const desc = s.frontmatter.description.toLowerCase()
        const whenToUse = s.frontmatter.whenToUse?.toLowerCase() || ''
        const tags = (s.frontmatter.tags || []).join(' ').toLowerCase()
        const category = s.frontmatter.category?.toLowerCase() || ''
        return name.includes(q)
          || desc.includes(q)
          || whenToUse.includes(q)
          || tags.includes(q)
          || category.includes(q)
      })
    }

    // 排序
    const sortBy = options.sortBy || 'updatedAt'
    const sortOrder = options.sortOrder || 'desc'
    const dir = sortOrder === 'asc' ? 1 : -1

    skills.sort((a, b) => {
      let va: string | number = 0
      let vb: string | number = 0
      switch (sortBy) {
        case 'name':
          va = a.frontmatter.name
          vb = b.frontmatter.name
          return dir * (va as string).localeCompare(vb as string)
        case 'qualityScore':
          va = a.verificationScore ?? a.frontmatter.qualityScore ?? 0
          vb = b.verificationScore ?? b.frontmatter.qualityScore ?? 0
          break
        case 'usageCount':
          va = a.usageCount
          vb = b.usageCount
          break
        case 'createdAt':
          va = a.createdAt
          vb = b.createdAt
          break
        case 'updatedAt':
        default:
          va = a.updatedAt
          vb = b.updatedAt
      }
      return dir * ((va as number) - (vb as number))
    })

    // 分页
    if (options.offset) {
      skills = skills.slice(options.offset)
    }
    if (options.limit && options.limit > 0) {
      skills = skills.slice(0, options.limit)
    }

    return skills
  }

  // ============================================================
  // 相关技能推荐
  // ============================================================

  /**
   * 基于 tags/category/description 关键词匹配，返回相关技能列表（排除自身）
   * 权重：同 category 0.4，同 tag 每个 0.2（上限 0.6），description 关键词重叠 0.2
   */
  getRelatedSkills(skillName: string, limit = 5): Array<{ skill: Skill; score: number }> {
    const target = this.getSkillByName(skillName)
    if (!target) return []

    const targetTags = new Set((target.frontmatter.tags || []).map(t => t.toLowerCase()))
    const targetCategory = target.frontmatter.category?.toLowerCase() || ''
    const targetDescWords = new Set(
      (target.frontmatter.description || '').toLowerCase().split(/\s+/).filter(w => w.length > 2)
    )

    const candidates: Array<{ skill: Skill; score: number }> = []

    for (const other of Array.from(this.skills.values())) {
      if (other.frontmatter.name.toLowerCase() === skillName.toLowerCase()) continue

      let score = 0

      // 同 category：+0.4
      const otherCategory = other.frontmatter.category?.toLowerCase() || ''
      if (targetCategory && otherCategory && targetCategory === otherCategory) {
        score += 0.4
      }

      // 相同 tag：每个 +0.2，上限 0.6
      const otherTags = new Set((other.frontmatter.tags || []).map(t => t.toLowerCase()))
      let tagOverlap = 0
      for (const t of targetTags) {
        if (otherTags.has(t)) tagOverlap++
      }
      score += Math.min(tagOverlap * 0.2, 0.6)

      // description 关键词重叠：+0.2（按重叠比例）
      const otherDescWords = new Set(
        (other.frontmatter.description || '').toLowerCase().split(/\s+/).filter(w => w.length > 2)
      )
      if (targetDescWords.size > 0 && otherDescWords.size > 0) {
        let wordOverlap = 0
        for (const w of targetDescWords) {
          if (otherDescWords.has(w)) wordOverlap++
        }
        const overlapRatio = wordOverlap / Math.max(targetDescWords.size, 1)
        score += Math.min(overlapRatio, 1) * 0.2
      }

      if (score > 0) {
        candidates.push({ skill: other, score: Math.round(score * 100) / 100 })
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  // ============================================================
  // 版本管理
  // ============================================================

  /**
   * 获取技能的版本历史列表
   * 返回所有历史版本（版本号 + 时间 + 变更说明），按时间倒序
   */
  async getVersionHistory(skillId: string): Promise<SkillVersionEntry[]> {
    try {
      const skill = this.skills.get(skillId)
      if (!skill) return []

      const skillDir = this.getSkillDir(skill)
      const versionsDir = `${skillDir}/versions`
      const fs = await import('node:fs/promises')

      try {
        await fs.access(versionsDir)
      } catch {
        return [] // 没有版本目录，返回空数组（向后兼容）
      }

      const entries = await fs.readdir(versionsDir, { withFileTypes: true })
      const versionFiles = entries
        .filter(e => e.isFile() && e.name.startsWith('SKILL_v') && e.name.endsWith('.md'))
        .map(e => e.name)

      const result: SkillVersionEntry[] = []
      for (const file of versionFiles) {
        try {
          const version = this.extractVersionFromFilename(file)
          if (!version) continue

          const filePath = `${versionsDir}/${file}`
          const stat = await fs.stat(filePath)
          const content = await fs.readFile(filePath, 'utf-8')
          const parsed = this.parseSkillMarkdown(content)
          const changelog = (parsed?.frontmatter as any)?.changelog
            || this.extractChangelogFromBody(content)

          result.push({
            version,
            timestamp: stat.mtime.getTime(),
            changelog,
            file,
          })
        } catch {
          // 跳过损坏的版本文件
        }
      }

      return result.sort((a, b) => b.timestamp - a.timestamp)
    } catch (err) {
      this.log('warn', `getVersionHistory failed for ${skillId}: ${(err as Error).message}`)
      return []
    }
  }

  /**
   * 获取指定版本的技能内容
   */
  async getSkillVersion(skillId: string, version: string): Promise<SkillFrontmatter & { body: string } | null> {
    try {
      const skill = this.skills.get(skillId)
      if (!skill) return null

      const skillDir = this.getSkillDir(skill)
      const fs = await import('node:fs/promises')
      const versionsDir = `${skillDir}/versions`
      const versionFile = `${versionsDir}/SKILL_v${version}.md`

      try {
        await fs.access(versionFile)
      } catch {
        return null
      }

      const content = await fs.readFile(versionFile, 'utf-8')
      const parsed = this.parseSkillMarkdown(content)
      if (!parsed) return null

      return { ...parsed.frontmatter, body: parsed.body }
    } catch (err) {
      this.log('warn', `getSkillVersion failed for ${skillId} v${version}: ${(err as Error).message}`)
      return null
    }
  }

  /**
   * 回滚到指定版本：
   * - 当前版本先保存为新版本快照（patch 版本号 +1）
   * - 目标版本内容覆盖当前 SKILL.md
   * - 更新内存中的 skill 对象
   * - 重新注册到 DSH
   */
  async rollbackToVersion(skillId: string, version: string, reason?: string): Promise<boolean> {
    try {
      const skill = this.skills.get(skillId)
      if (!skill) return false

      const targetContent = await this.getSkillVersion(skillId, version)
      if (!targetContent) return false

      // 1. 保存当前版本为新的历史快照
      const currentVersion = skill.version || '1.0.0'
      const bumpedVersion = this.bumpVersion(currentVersion, 'patch')
      await this.saveVersionSnapshot(skill, reason || `Rollback to v${version}`)

      // 2. 用目标版本覆盖当前内容
      skill.frontmatter = {
        ...targetContent,
        version: bumpedVersion,
        // 保留累计使用统计
        usageCount: skill.frontmatter.usageCount,
        lastUsedAt: skill.frontmatter.lastUsedAt,
        // 保留累计反馈统计（奖励驱动进化的状态不能被版本回滚冲掉）
        feedbackHelpful: skill.frontmatter.feedbackHelpful,
        feedbackHarmful: skill.frontmatter.feedbackHarmful,
        feedbackNeutral: skill.frontmatter.feedbackNeutral,
        feedbackCount: skill.frontmatter.feedbackCount,
        feedbackScore: skill.frontmatter.feedbackScore,
        positiveFeedbacks: (skill.frontmatter as any).positiveFeedbacks,
        negativeFeedbacks: (skill.frontmatter as any).negativeFeedbacks,
        lastDecayAt: (skill.frontmatter as any).lastDecayAt,
      }
      skill.body = targetContent.body
      skill.version = bumpedVersion
      skill.updatedAt = Date.now()

      // 3. 写入磁盘
      await this.writeSkillToDisk(skill)

      // 4. 重新注册到 DSH
      if (skill.status === SkillStatus.ACTIVE) {
        this.unregisterSkillFromDSH(skill.id)
        await this.registerSkillWithDSH(skill)
      }

      this.log('info', `Skill ${skill.frontmatter.name} rolled back to v${version} (now v${bumpedVersion})`)
      return true
    } catch (err) {
      this.log('warn', `rollbackToVersion failed: ${(err as Error).message}`)
      return false
    }
  }

  // ============================================================
  // 谱系追踪
  // ============================================================

  /**
   * 获取技能的谱系数据：来源 + 衍生关系
   * - origin: 锻造来源（哪个锻造记录、哪些 session 参与）
   * - derivations: 基于相关 session 又锻造出的其他技能
   */
  async getSkillLineage(skillName: string): Promise<{
    origin: { forgeRunId?: string; sourceSessionIds: string[]; sourceSummary: string; createdAt: number } | null
    derivations: Array<{ name: string; forgeRunId?: string; sourceSessionIds: string[]; createdAt: number }>
  }> {
    await this.ensureStoragePath()
    const skill = this.getSkillByName(skillName)
    if (!skill) {
      return { origin: null, derivations: [] }
    }

    // 1. 加载 forge-runs.json 获取来源信息
    let forgeRuns: ForgeRun[] = []
    try {
      const fs = await import('node:fs/promises')
      const runsPath = `${this.storagePath}/forge-runs.json`
      const raw = await fs.readFile(runsPath, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) {
        forgeRuns = data
      }
    } catch {
      // 文件不存在或解析失败，正常
    }

    // 2. 找到创建此技能的锻造记录
    const forgeRunId = skill.frontmatter.forgedFromRunId || skill.forgeRunId
    let origin: {
      forgeRunId?: string
      sourceSessionIds: string[]
      sourceSummary: string
      createdAt: number
    } | null = null

    if (forgeRunId) {
      const run = forgeRuns.find(r => r.id === forgeRunId)
      if (run) {
        origin = {
          forgeRunId: run.id,
          sourceSessionIds: run.sourceSessionIds || [],
          sourceSummary: run.sourceSummary || '',
          createdAt: run.createdAt,
        }
      }
    }

    // 如果没有 forgeRunId，用 forgedFrom 字段作为 session 来源
    if (!origin && skill.frontmatter.forgedFrom?.length) {
      origin = {
        sourceSessionIds: skill.frontmatter.forgedFrom,
        sourceSummary: skill.frontmatter.description || '',
        createdAt: skill.createdAt,
      }
    }

    // 3. 查找衍生技能：其他技能的 forgedFrom 或 forgedFromRunId 与当前技能有关联
    const derivations: Array<{
      name: string
      forgeRunId?: string
      sourceSessionIds: string[]
      createdAt: number
    }> = []

    // 收集当前技能相关的所有 session IDs
    const relatedSessions = new Set<string>(
      (origin?.sourceSessionIds || []).concat(skill.frontmatter.forgedFrom || [])
    )

    // 收集当前技能的 forgeRunId 以排除自身
    const selfRunIds = new Set<string>()
    if (forgeRunId) selfRunIds.add(forgeRunId)

    // 从 forge-runs 中找：相同 session 但产生不同技能的记录
    for (const run of forgeRuns) {
      if (selfRunIds.has(run.id)) continue
      const hasOverlap = run.sourceSessionIds?.some(sid => relatedSessions.has(sid))
      if (hasOverlap && run.generatedSkill?.frontmatter?.name) {
        derivations.push({
          name: run.generatedSkill.frontmatter.name,
          forgeRunId: run.id,
          sourceSessionIds: run.sourceSessionIds || [],
          createdAt: run.createdAt,
        })
      }
    }

    // 也检查内存中的技能（可能不在 forgeRuns 中）
    for (const s of Array.from(this.skills.values())) {
      if (s.frontmatter.name === skillName) continue
      if (s.forgeRunId && selfRunIds.has(s.forgeRunId)) continue
      const sSessions = s.frontmatter.forgedFrom || []
      if (sSessions.some(sid => relatedSessions.has(sid))) {
        // 避免重复（已在 forgeRuns 中找到的）
        if (!derivations.some(d => d.name === s.frontmatter.name)) {
          derivations.push({
            name: s.frontmatter.name,
            forgeRunId: s.forgeRunId,
            sourceSessionIds: sSessions,
            createdAt: s.createdAt,
          })
        }
      }
    }

    return { origin, derivations }
  }

  // ============================================================
  // 统计
  // ============================================================

  /**
   * 获取技能库统计
   */
  getStats(): {
    total: number
    active: number
    archived: number
    totalUsage: number
    last7DaysNew: number
  } {
    const all = Array.from(this.skills.values())
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    return {
      total: all.length,
      active: all.filter(s => s.status === SkillStatus.ACTIVE).length,
      archived: all.filter(s => s.status === SkillStatus.ARCHIVED).length,
      totalUsage: all.reduce((sum, s) => sum + s.usageCount, 0),
      last7DaysNew: all.filter(s => s.createdAt > weekAgo).length,
    }
  }

  /**
   * 详细统计
   */
  getDetailedStats(): {
    total: number
    active: number
    archived: number
    draft: number
    pendingReview: number
    deprecated: number
    avgQualityScore: number
    totalUsage: number
    last7DaysNew: number
    last7DaysForged: number
    categories: string[]
  } {
    const all = Array.from(this.skills.values())
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    const withScore = all.filter(s => typeof s.verificationScore === 'number')
    const avgQualityScore = withScore.length > 0
      ? withScore.reduce((sum, s) => sum + (s.verificationScore ?? 0), 0) / withScore.length
      : 0

    const categoriesSet = new Set<string>()
    for (const s of all) {
      if (s.frontmatter.category) {
        categoriesSet.add(s.frontmatter.category)
      }
      for (const t of s.frontmatter.tags || []) {
        categoriesSet.add(t)
      }
    }

    return {
      total: all.length,
      active: all.filter(s => s.status === SkillStatus.ACTIVE).length,
      archived: all.filter(s => s.status === SkillStatus.ARCHIVED).length,
      draft: all.filter(s => s.status === SkillStatus.DRAFT).length,
      pendingReview: all.filter(s => s.status === SkillStatus.PENDING_REVIEW).length,
      deprecated: all.filter(s => s.status === SkillStatus.DEPRECATED).length,
      avgQualityScore: Math.round(avgQualityScore * 1000) / 1000,
      totalUsage: all.reduce((sum, s) => sum + s.usageCount, 0),
      last7DaysNew: all.filter(s => s.createdAt > weekAgo).length,
      last7DaysForged: all.filter(s => s.updatedAt > weekAgo).length,
      categories: Array.from(categoriesSet).sort(),
    }
  }

  // ============================================================
  // DSH 原生技能系统集成
  // ============================================================

  /**
   * 将技能注册到 DSH 的 ctx.skills 运行时注册表。
   * 使用 ctx.skills.register() —— DSH SkillRegistry 的 runtime skill API。
   */
  private async registerSkillWithDSH(skill: Skill): Promise<void> {
    if (!this.ctx.skills?.register) {
      this.log('warn', `ctx.skills.register not available, cannot register ${skill.frontmatter.name}`)
      return
    }

    const skillDir = `${this.storagePath}/${skill.frontmatter.name}`

    try {
      const disposer = this.ctx.skills.register({
        name: skill.frontmatter.name,
        description: skill.frontmatter.description,
        whenToUse: skill.frontmatter.whenToUse,
        content: skill.body.trim(),
        provider: 'skill-forge',
        source: 'custom' as const,
        resourceBase: { kind: 'directory', path: skillDir },
        invocation: { modelInvocable: true, userInvocable: true },
        metadata: {
          source: 'forged',
          forgedFrom: skill.frontmatter.forgedFrom || [],
          version: skill.version,
          forgeRunId: skill.forgeRunId,
          verificationScore: skill.verificationScore,
          tags: skill.frontmatter.tags || [],
          author: skill.frontmatter.author,
          category: skill.frontmatter.category,
          qualityScore: skill.frontmatter.qualityScore,
        },
      })

      this.dshDisposers.set(skill.id, disposer)
      this.log('info', `Registered skill with DSH: ${skill.frontmatter.name}`)
    } catch (err) {
      this.log('warn', `Failed to register skill with DSH (${skill.frontmatter.name}): ${(err as Error).message}`)
    }
  }

  /**
   * 从 DSH 运行时注册表中移除技能。
   */
  private unregisterSkillFromDSH(skillId: string): void {
    const disposer = this.dshDisposers.get(skillId)
    if (disposer) {
      try {
        disposer()
        this.dshDisposers.delete(skillId)
        this.log('info', `Unregistered skill from DSH: ${skillId}`)
      } catch (err) {
        this.log('warn', `Failed to unregister skill from DSH: ${(err as Error).message}`)
      }
    }
  }

  // ============================================================
  // 内部：文件系统操作
  // ============================================================

  private async ensureDir(path: string): Promise<void> {
    try {
      await import('node:fs/promises').then(fs => fs.mkdir(path, { recursive: true }))
    } catch {
      // 已存在
    }
  }

  private async writeSkillToDisk(skill: Skill): Promise<void> {
    await this.ensureStoragePath()
    const fs = await import('node:fs/promises')
    const skillDir = this.getSkillDir(skill)
    await fs.mkdir(skillDir, { recursive: true })

    const content = this.formatSkillMarkdown(skill)
    await fs.writeFile(`${skillDir}/SKILL.md`, content, 'utf-8')
  }

  private formatSkillMarkdown(skill: Skill): string {
    const fm = skill.frontmatter
    const frontmatter = [
      '---',
      `name: ${fm.name}`,
      `description: ${fm.description}`,
      `whenToUse: ${fm.whenToUse}`,
      `version: ${fm.version || skill.version}`,
      fm.tags?.length ? `tags: [${fm.tags.join(', ')}]` : '',
      fm.author ? `author: ${fm.author}` : '',
      `source: ${fm.source || 'forged'}`,
      fm.forgedFrom?.length ? `forgedFrom: [${fm.forgedFrom.join(', ')}]` : '',
      fm.category ? `category: ${fm.category}` : '',
      fm.qualityScore !== undefined && fm.qualityScore !== null ? `qualityScore: ${fm.qualityScore}` : '',
      fm.forgedFromRunId ? `forgedFromRunId: ${fm.forgedFromRunId}` : '',
      fm.usageCount !== undefined ? `usageCount: ${fm.usageCount}` : '',
      fm.lastUsedAt !== undefined ? `lastUsedAt: ${fm.lastUsedAt}` : '',
      fm.feedbackHelpful !== undefined && fm.feedbackHelpful > 0 ? `feedbackHelpful: ${fm.feedbackHelpful}` : '',
      fm.feedbackHarmful !== undefined && fm.feedbackHarmful > 0 ? `feedbackHarmful: ${fm.feedbackHarmful}` : '',
      fm.feedbackNeutral !== undefined && fm.feedbackNeutral > 0 ? `feedbackNeutral: ${fm.feedbackNeutral}` : '',
      fm.feedbackCount !== undefined && fm.feedbackCount > 0 ? `feedbackCount: ${fm.feedbackCount}` : '',
      fm.feedbackScore !== undefined && fm.feedbackCount !== undefined && fm.feedbackCount > 0 ? `feedbackScore: ${fm.feedbackScore}` : '',
      (fm as any).positiveFeedbacks !== undefined && (fm as any).positiveFeedbacks > 0 ? `positiveFeedbacks: ${(fm as any).positiveFeedbacks}` : '',
      (fm as any).negativeFeedbacks !== undefined && (fm as any).negativeFeedbacks > 0 ? `negativeFeedbacks: ${(fm as any).negativeFeedbacks}` : '',
      (fm as any).lastDecayAt !== undefined ? `lastDecayAt: ${(fm as any).lastDecayAt}` : '',
      (fm as any).changelog ? `changelog: ${(fm as any).changelog}` : '',
      '---',
      '',
    ].filter(Boolean).join('\n')

    return frontmatter + skill.body
  }

  /**
   * 从磁盘加载所有锻造技能，并将激活状态的注册到 DSH。
   */
  private async loadSkills(): Promise<void> {
    try {
      const fs = await import('node:fs/promises')
      const entries = await fs.readdir(this.storagePath, { withFileTypes: true })
        .catch(() => [])

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const isArchived = entry.name.startsWith('.archived_')
        const dirName = isArchived ? entry.name.replace('.archived_', '') : entry.name

        // 跳过非技能目录（隐藏目录等）
        if (!/^[a-z0-9-]+$/.test(dirName)) continue

        try {
          const skillPath = `${this.storagePath}/${entry.name}/SKILL.md`
          const content = await fs.readFile(skillPath, 'utf-8')
          const parsed = this.parseSkillMarkdown(content)
          if (!parsed) continue

          const stat = await fs.stat(skillPath).catch(() => null)
          const mtime = stat?.mtime.getTime() || Date.now()

          const skillId = `forged_${Buffer.from(dirName).toString('hex')}_${Math.random().toString(36).slice(2, 8)}`
          const usageCount = parsed.frontmatter.usageCount ?? 0
          const skill: Skill = {
            id: skillId,
            frontmatter: parsed.frontmatter,
            body: parsed.body,
            status: isArchived ? SkillStatus.ARCHIVED : SkillStatus.ACTIVE,
            createdAt: mtime,
            updatedAt: mtime,
            usageCount,
            lastUsedAt: parsed.frontmatter.lastUsedAt,
            feedbackHelpful: parsed.frontmatter.feedbackHelpful ?? 0,
            feedbackHarmful: parsed.frontmatter.feedbackHarmful ?? 0,
            feedbackNeutral: parsed.frontmatter.feedbackNeutral ?? 0,
            feedbackCount: parsed.frontmatter.feedbackCount ?? 0,
            feedbackScore: parsed.frontmatter.feedbackScore ?? 0,
            positiveFeedbacks: (parsed.frontmatter as any).positiveFeedbacks ?? 0,
            negativeFeedbacks: (parsed.frontmatter as any).negativeFeedbacks ?? 0,
            lastDecayAt: (parsed.frontmatter as any).lastDecayAt,
            version: parsed.frontmatter.version || '1.0.0',
            verificationScore: parsed.frontmatter.qualityScore,
            forgeRunId: parsed.frontmatter.forgedFromRunId,
          }

          this.skills.set(skillId, skill)

          // 激活状态的技能注册到 DSH
          if (skill.status === SkillStatus.ACTIVE) {
            await this.registerSkillWithDSH(skill)
          }
        } catch {
          // 跳过无效的
        }
      }
    } catch (err) {
      this.log('debug', `No existing skills found: ${(err as Error).message}`)
    }
  }

  /**
   * 解析 SKILL.md 的 frontmatter + body
   */
  private parseSkillMarkdown(content: string): { frontmatter: SkillFrontmatter; body: string } | null {
    if (!content.startsWith('---\n')) return null

    const endIdx = content.indexOf('\n---', 4)
    if (endIdx < 0) return null

    const yamlBlock = content.slice(4, endIdx)
    const body = content.slice(endIdx + 4).replace(/^\n/, '')

    // 简单的 YAML frontmatter 解析（MVP，只处理字符串和简单列表）
    const data: Record<string, any> = {}
    for (const line of yamlBlock.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const colonIdx = trimmed.indexOf(':')
      if (colonIdx < 0) continue

      const key = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()

      // 去掉字符串引号
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        data[key] = value.slice(1, -1)
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // 简单数组解析
        data[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      } else if (value === 'true') {
        data[key] = true
      } else if (value === 'false') {
        data[key] = false
      } else {
        data[key] = value
      }
    }

    if (!data.name || !data.description) return null

    return {
      frontmatter: {
        name: data.name,
        description: data.description,
        whenToUse: data.whenToUse || '',
        version: data.version || '1.0.0',
        tags: Array.isArray(data.tags) ? data.tags : undefined,
        author: data.author,
        source: data.source || 'forged',
        forgedFrom: Array.isArray(data.forgedFrom) ? data.forgedFrom : undefined,
        category: data.category || undefined,
        qualityScore: data.qualityScore !== undefined && data.qualityScore !== '' ? Number(data.qualityScore) : undefined,
        forgedFromRunId: data.forgedFromRunId || undefined,
        usageCount: data.usageCount !== undefined && data.usageCount !== '' ? Number(data.usageCount) : undefined,
        lastUsedAt: data.lastUsedAt !== undefined && data.lastUsedAt !== '' ? Number(data.lastUsedAt) : undefined,
        feedbackHelpful: data.feedbackHelpful !== undefined && data.feedbackHelpful !== '' ? Number(data.feedbackHelpful) : undefined,
        feedbackHarmful: data.feedbackHarmful !== undefined && data.feedbackHarmful !== '' ? Number(data.feedbackHarmful) : undefined,
        feedbackNeutral: data.feedbackNeutral !== undefined && data.feedbackNeutral !== '' ? Number(data.feedbackNeutral) : undefined,
        feedbackCount: data.feedbackCount !== undefined && data.feedbackCount !== '' ? Number(data.feedbackCount) : undefined,
        feedbackScore: data.feedbackScore !== undefined && data.feedbackScore !== '' ? Number(data.feedbackScore) : undefined,
        positiveFeedbacks: data.positiveFeedbacks !== undefined && data.positiveFeedbacks !== '' ? Number(data.positiveFeedbacks) : undefined,
        negativeFeedbacks: data.negativeFeedbacks !== undefined && data.negativeFeedbacks !== '' ? Number(data.negativeFeedbacks) : undefined,
        lastDecayAt: data.lastDecayAt !== undefined && data.lastDecayAt !== '' ? Number(data.lastDecayAt) : undefined,
      },
      body,
    }
  }

  private async archiveSkillOnDisk(skill: Skill): Promise<void> {
    await this.ensureStoragePath()
    const fs = await import('node:fs/promises')
    const oldPath = `${this.storagePath}/${skill.frontmatter.name}`
    const newPath = `${this.storagePath}/.archived_${skill.frontmatter.name}`
    try {
      await fs.rename(oldPath, newPath)
    } catch (err) {
      this.log('warn', `Failed to archive skill on disk: ${(err as Error).message}`)
    }
  }

  private async unarchiveSkillOnDisk(skill: Skill): Promise<void> {
    await this.ensureStoragePath()
    const fs = await import('node:fs/promises')
    const oldPath = `${this.storagePath}/.archived_${skill.frontmatter.name}`
    const newPath = `${this.storagePath}/${skill.frontmatter.name}`
    try {
      await fs.rename(oldPath, newPath)
    } catch (err) {
      this.log('warn', `Failed to unarchive skill on disk: ${(err as Error).message}`)
    }
  }

  // ============================================================
  // 内部：版本管理辅助
  // ============================================================

  /**
   * 将当前技能状态保存为版本快照到技能目录下的 versions/ 子目录。
   * 文件名格式：SKILL_v{semver}.md
   * 如该版本文件已存在，跳过（幂等）。
   */
  private async saveVersionSnapshot(skill: Skill, changelog?: string): Promise<void> {
    try {
      const skillDir = this.getSkillDir(skill)
      const versionsDir = `${skillDir}/versions`
      const fs = await import('node:fs/promises')
      await fs.mkdir(versionsDir, { recursive: true })

      const version = skill.version || '1.0.0'
      const versionFile = `${versionsDir}/SKILL_v${version}.md`

      // 如果该版本已存在，跳过（避免重复写入）
      try {
        await fs.access(versionFile)
        return
      } catch {
        // 不存在，继续写入
      }

      // 写入时带 changelog 到 frontmatter
      const fm: SkillFrontmatter & { changelog?: string } = { ...skill.frontmatter, changelog }
      const content = this.formatSkillMarkdown({ ...skill, frontmatter: fm })
      await fs.writeFile(versionFile, content, 'utf-8')

      this.log('debug', `Saved version snapshot ${version} for ${skill.frontmatter.name}`)
    } catch (err) {
      this.log('warn', `Failed to save version snapshot: ${(err as Error).message}`)
    }
  }

  /**
   * 获取技能目录的磁盘路径（考虑归档状态）
   */
  private getSkillDir(skill: Skill): string {
    const base = this.storagePath
    if (skill.status === SkillStatus.ARCHIVED) {
      return `${base}/.archived_${skill.frontmatter.name}`
    }
    return `${base}/${skill.frontmatter.name}`
  }

  /**
   * 对比两个版本的差异，逐行比较
   * 返回 changes 数组，每行标记为 added / removed / unchanged
   */
  async diffVersions(skillId: string, versionA: string, versionB: string): Promise<{
    versionA: string
    versionB: string
    changes: Array<{ type: 'added' | 'removed' | 'unchanged'; line: string; lineNum: number }>
    summary: { added: number; removed: number; unchanged: number }
  }> {
    const contentA = await this.getSkillVersion(skillId, versionA)
    const contentB = await this.getSkillVersion(skillId, versionB)

    if (!contentA && !contentB) {
      return { versionA, versionB, changes: [], summary: { added: 0, removed: 0, unchanged: 0 } }
    }

    const linesA = (contentA ? this.formatVersionContent(contentA) : '').split('\n')
    const linesB = (contentB ? this.formatVersionContent(contentB) : '').split('\n')

    // 简单逐行比较（LCS-based diff）
    const changes = this.computeLineDiff(linesA, linesB)
    const summary = {
      added: changes.filter(c => c.type === 'added').length,
      removed: changes.filter(c => c.type === 'removed').length,
      unchanged: changes.filter(c => c.type === 'unchanged').length,
    }

    return { versionA, versionB, changes, summary }
  }

  /**
   * 将版本内容格式化为纯文本用于 diff 比较
   */
  private formatVersionContent(content: SkillFrontmatter & { body: string }): string {
    const fm = content
    const frontmatter = [
      '---',
      `name: ${fm.name}`,
      `description: ${fm.description}`,
      `whenToUse: ${fm.whenToUse || ''}`,
      `version: ${fm.version || ''}`,
      fm.tags?.length ? `tags: [${fm.tags.join(', ')}]` : '',
      fm.author ? `author: ${fm.author}` : '',
      `source: ${fm.source || 'forged'}`,
      fm.category ? `category: ${fm.category}` : '',
      fm.qualityScore !== undefined && fm.qualityScore !== null ? `qualityScore: ${fm.qualityScore}` : '',
      '---',
      '',
    ].filter(Boolean).join('\n')
    return frontmatter + (content.body || '')
  }

  /**
   * 计算两组行的 diff（简单 LCS 算法）
   */
  private computeLineDiff(
    linesA: string[],
    linesB: string[],
  ): Array<{ type: 'added' | 'removed' | 'unchanged'; line: string; lineNum: number }> {
    // LCS 动态规划
    const m = linesA.length
    const n = linesB.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[])

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (linesA[i - 1] === linesB[j - 1]) {
          dp[i]![j] = dp[i - 1]![j - 1]! + 1
        } else {
          dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
        }
      }
    }

    // 回溯构建 diff
    const result: Array<{ type: 'added' | 'removed' | 'unchanged'; line: string; lineNum: number }> = []
    let i = m
    let j = n
    const temp: typeof result = []

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
        temp.push({ type: 'unchanged', line: linesA[i - 1]!, lineNum: i })
        i--
        j--
      } else if (j > 0 && (i === 0 || (dp[i]![j - 1] ?? 0) >= (dp[i - 1]![j] ?? 0))) {
        temp.push({ type: 'added', line: linesB[j - 1]!, lineNum: j })
        j--
      } else {
        temp.push({ type: 'removed', line: linesA[i - 1]!, lineNum: i })
        i--
      }
    }

    temp.reverse()
    let lineNum = 0
    for (const item of temp) {
      lineNum++
      result.push({ ...item, lineNum })
    }

    return result
  }

  /**
   * 从版本文件名提取版本号
   * 例如 SKILL_v1.2.3.md → 1.2.3
   */
  private extractVersionFromFilename(filename: string): string | null {
    const match = filename.match(/^SKILL_v(\d+\.\d+\.\d+)\.md$/)
    return match ? (match[1] ?? null) : null
  }

  /**
   * 从版本文件正文中提取 changelog（首行 # 注释或第一段）
   * 回退方案：如果 frontmatter 没有 changelog 字段
   */
  private extractChangelogFromBody(content: string): string | undefined {
    const bodyStart = content.indexOf('\n---', 4)
    if (bodyStart < 0) return undefined
    const body = content.slice(bodyStart + 4).replace(/^\n+/, '')
    const firstLine = body.split('\n').find(l => l.trim())
    if (firstLine) {
      const clean = firstLine.replace(/^#+\s*/, '').trim()
      return clean.length > 0 ? clean.slice(0, 200) : undefined
    }
    return undefined
  }

  /**
   * semver 版本号递增
   */
  private bumpVersion(version: string, level: 'major' | 'minor' | 'patch'): string {
    const parts = version.split('.').map(n => parseInt(n, 10))
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
      return '1.0.0'
    }
    const major = parts[0] ?? 0
    const minor = parts[1] ?? 0
    const patch = parts[2] ?? 0
    switch (level) {
      case 'major':
        return `${major + 1}.0.0`
      case 'minor':
        return `${major}.${minor + 1}.0`
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`
    }
  }

  /**
   * 从标签推断技能分类
   */
  private inferCategory(tags: string[]): string | undefined {
    if (!tags || tags.length === 0) return undefined
    const categoryMap: Record<string, string> = {
      'code-review': 'engineering',
      'engineering': 'engineering',
      'debugging': 'engineering',
      'data': 'data',
      'analysis': 'data',
      'workflow': 'productivity',
      'productivity': 'productivity',
      'quality': 'engineering',
      'writing': 'writing',
      'research': 'research',
      'devops': 'devops',
    }
    for (const tag of tags) {
      const cat = categoryMap[tag.toLowerCase()]
      if (cat) return cat
    }
    const firstTag = tags[0]
    return firstTag ? firstTag.toLowerCase() : undefined
  }

  // ============================================================
  // 工具函数
  // ============================================================

  /**
   * 将任意名称转换为 DSH 要求的 kebab-case 格式。
   * DSH 技能名必须匹配 /^[a-z0-9]+(?:-[a-z0-9]+)*$/
   */
  private toKebabCase(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  /**
   * 创建演示数据（首次安装时用）
   * 包含 3 个不同状态的技能
   */
  private async seedDemoData(): Promise<void> {
    const fs = await import('node:fs/promises')
    const base = this.storagePath

    this.log('info', 'Seeding demo skills for first-run demonstration')

    const demoSkills = [
      {
        name: 'data-analysis-workflow',
        status: 'active',
        frontmatter: `name: data-analysis-workflow
version: 1.2.0
source: forged
category: data
qualityScore: 0.92
description: Systematic data analysis workflow — cleaning, exploration, visualization, insights.
whenToUse: When analyzing a dataset to produce actionable insights and reports
forgedFrom:
  - session_demo_001
tags:
  - data
  - analysis
  - workflow`,
        body: `# Data Analysis Workflow

A systematic, repeatable approach to analyzing datasets from raw data to actionable insights.

## Phases

### 1. Data Loading & Inspection
- Load the dataset with appropriate libraries
- Check shape, dtypes, and basic structure
- Identify missing values and anomalies
- Generate summary statistics

### 2. Data Cleaning
- Handle missing values (impute or remove based on context)
- Remove duplicate records
- Fix incorrect data types
- Normalize/standardize where needed

### 3. Exploratory Analysis
- Univariate distributions
- Bivariate relationships
- Correlation matrix and patterns
- Group comparisons and segmentation

### 4. Visualization
- Distribution plots (histograms, box plots)
- Relationship plots (scatter, heatmaps)
- Summary charts and dashboards
- Storytelling order for presentation

### 5. Insight Generation
- Summarize key findings (3-5 bullet points)
- Formulate data-backed recommendations
- Identify next steps and follow-up questions
- Prepare executive summary format

## Quality Checklist
- [ ] Every claim has a number backing it
- [ ] Visualizations have clear labels
- [ ] Assumptions are explicitly stated
- [ ] Limitations are documented
`,
      },
      {
        name: 'code-review-checklist',
        status: 'active',
        frontmatter: `name: code-review-checklist
version: 1.0.0
source: forged
category: engineering
qualityScore: 0.88
description: Comprehensive code review checklist covering correctness, performance, security, and style.
whenToUse: When reviewing code changes, pull requests, or doing quality audits
forgedFrom:
  - session_demo_002
tags:
  - code-review
  - quality
  - engineering`,
        body: `# Code Review Checklist

## Correctness
- [ ] Logic matches the stated requirements
- [ ] Edge cases and boundary conditions handled
- [ ] Error handling is complete and appropriate
- [ ] No off-by-one errors in loops or indices
- [ ] State transitions are valid and complete

## Performance
- [ ] No obvious O(n²) where O(n) suffices
- [ ] Unnecessary allocations removed in hot paths
- [ ] Caching applied where appropriate
- [ ] N+1 query patterns eliminated
- [ ] Memory growth is bounded

## Security
- [ ] Input validation present at trust boundaries
- [ ] No injection vulnerabilities (SQL, command, XSS)
- [ ] Authorization checks at the right layer
- [ ] Secrets and credentials handled correctly
- [ ] Sensitive data properly redacted in logs

## Style & Maintainability
- [ ] Follows project conventions and patterns
- [ ] Clear, intention-revealing naming
- [ ] Comments explain *why*, not *what*
- [ ] Functions have a single clear purpose
- [ ] No commented-out code or dead code
- [ ] Tests cover the important cases

## Architecture
- [ ] Changes respect existing boundaries
- [ ] Dependencies flow in the right direction
- [ ] No unintended coupling introduced
- [ ] Public APIs are minimal and well-defined
`,
      },
      {
        name: 'legacy-debugging-pattern',
        status: 'archived',
        frontmatter: `name: legacy-debugging-pattern
version: 0.8.0
source: forged
category: engineering
qualityScore: 0.65
description: Legacy debugging methodology — archived, superseded by newer approach.
whenToUse: ARCHIVED — use current debugging skill instead
forgedFrom:
  - session_demo_003
tags:
  - debugging
  - archived`,
        body: `# Legacy Debugging Pattern

**ARCHIVED — this is an older version, kept for reference only.**

## Old Methodology
(...replaced by newer, more systematic approach...)
`,
      },
    ]

    for (const demo of demoSkills) {
      const dirName = demo.status === 'archived' ? `.archived_${demo.name}` : demo.name
      const dirPath = `${base}/${dirName}`
      try {
        await fs.mkdir(dirPath, { recursive: true })
        await fs.writeFile(
          `${dirPath}/SKILL.md`,
          `---\n${demo.frontmatter}\n---\n\n${demo.body}\n`
        )
      } catch (err) {
        this.log('warn', `Failed to seed demo skill ${demo.name}: ${(err as Error).message}`)
      }
    }

    this.log('info', `Seeded ${demoSkills.length} demo skills`)
  }
}
