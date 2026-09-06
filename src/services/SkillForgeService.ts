/**
 * SkillForgeService —— 总服务入口
 *
 * 对外统一的服务门面（Facade），聚合各子服务的常用操作。
 * 供外部调用方（如 UI、其他插件）使用，避免直接依赖内部服务类。
 */

import { BaseService } from './BaseService.js'
import type { SkillForgeConfig, ForgeRun, Skill, SkillStatus } from '../types.js'
import type { ForgeOrchestrator } from './ForgeOrchestrator.js'
import type { SkillRegistry } from './SkillRegistry.js'
import type { TaotieFusion } from './TaotieFusion.js'
import type { SkillOrchestrator } from './SkillOrchestrator.js'
import type { DreamingEngine } from './DreamingEngine.js'

/** 服务依赖注入 */
export interface ServiceDeps {
  orchestrator: ForgeOrchestrator
  registry: SkillRegistry
  taotie?: TaotieFusion
  skillOrchestrator?: SkillOrchestrator
  dreaming?: DreamingEngine
}

export class SkillForgeService extends BaseService {
  private deps: ServiceDeps

  constructor(ctx: unknown, config: SkillForgeConfig, deps: ServiceDeps) {
    super(ctx, config)
    this.deps = deps
  }

  // ==========================================================
  // 锻造任务
  // ==========================================================

  /** 获取锻造队列（最近的 N 条） */
  getForgeQueue(limit = 20): ForgeRun[] {
    return this.deps.orchestrator.listRuns(limit)
  }

  /** 手动触发锻造 */
  async triggerForge(reason: string): Promise<{ runId: string; status: string }> {
    return this.deps.orchestrator.startManualForge(reason)
  }

  /** 批准待审核技能 */
  async approveSkill(runId: string): Promise<boolean> {
    return this.deps.orchestrator.approveSkill(runId)
  }

  /** 拒绝待审核技能 */
  async rejectSkill(runId: string, reasons: string[], customText?: string): Promise<boolean> {
    return this.deps.orchestrator.rejectSkill(runId, reasons, customText)
  }

  /** 取消锻造任务 */
  async cancelForge(runId: string): Promise<boolean> {
    return this.deps.orchestrator.cancelForge(runId)
  }

  /** 重试失败的锻造任务 */
  async retryForge(runId: string): Promise<boolean> {
    return this.deps.orchestrator.retryRun(runId)
  }

  // ==========================================================
  // 技能库
  // ==========================================================

  /** 列出所有技能 */
  getSkillLibrary(status?: SkillStatus): Skill[] {
    return this.deps.registry.listSkills(status)
  }

  /** 获取技能库统计 */
  getStats(): ReturnType<SkillRegistry['getStats']> {
    return this.deps.registry.getStats()
  }

  /** 归档技能 */
  async archiveSkill(skillId: string): Promise<boolean> {
    return this.deps.registry.archiveSkill(skillId)
  }

  /** 恢复已归档技能 */
  async unarchiveSkill(skillId: string): Promise<boolean> {
    return this.deps.registry.unarchiveSkill(skillId)
  }

  // ==========================================================
  // 配置
  // ==========================================================

  /** 获取当前配置 */
  getConfig(): SkillForgeConfig {
    return this.config
  }

  /** 更新配置（热更新，浅合并） */
  updateConfig(updates: Partial<SkillForgeConfig>): SkillForgeConfig {
    Object.assign(this.config, updates)
    return this.config
  }

  // ==========================================================
  // 饕餮模式（Taotie Fusion）
  // ==========================================================

  /** 检测相似技能组 */
  detectSimilarSkills(threshold?: number): Array<{ skills: string[]; avgSimilarity: number }> {
    return this.deps.taotie?.detectSimilarSkills(threshold) ?? []
  }

  /** 配对分析两个技能的差异 */
  async analyzePair(targetName: string, sourceName: string): Promise<unknown> {
    if (!this.deps.taotie) throw new Error('Taotie fusion not available')
    return this.deps.taotie.analyzePair(targetName, sourceName)
  }

  /** 启动融合 */
  async startFusion(targetName: string, sourceName: string, autoApprove = false): Promise<unknown> {
    if (!this.deps.taotie) throw new Error('Taotie fusion not available')
    return this.deps.taotie.startFusion(targetName, sourceName, autoApprove)
  }

  /** 获取融合任务状态 */
  getFusionStatus(runId: string): unknown {
    return this.deps.taotie?.getRunStatus(runId)
  }

  /** 列出融合任务 */
  listFusionRuns(limit = 20): unknown[] {
    return this.deps.taotie?.listRuns(limit) ?? []
  }

  /** 批准融合步骤 */
  async approveFusionStep(runId: string, step?: number): Promise<boolean> {
    if (!this.deps.taotie) return false
    return this.deps.taotie.approveStep(runId, step)
  }

  /** 停止融合 */
  stopFusion(runId: string): boolean {
    return this.deps.taotie?.stopRun(runId) ?? false
  }

  /** 获取全局模式库 */
  getGlobalPatterns(): unknown[] {
    return this.deps.taotie?.getGlobalPatterns?.() ?? []
  }
}
