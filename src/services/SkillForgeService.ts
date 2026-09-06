/**
 * SkillForgeService —— 总服务入口
 */

import type { SkillForgeConfig } from '../types.js'
import { ForgeOrchestrator } from './ForgeOrchestrator.js'
import { SkillRegistry } from './SkillRegistry.js'
import type { TaotieFusion } from './TaotieFusion.js'
import type { SkillOrchestrator } from './SkillOrchestrator.js'

export interface ServiceDeps {
  orchestrator: ForgeOrchestrator
  registry: SkillRegistry
  taotie?: TaotieFusion
  skillOrchestrator?: SkillOrchestrator
  dreaming?: any
}

export class SkillForgeService {
  private ctx: any
  private config: SkillForgeConfig
  private deps: ServiceDeps

  constructor(ctx: any, config: SkillForgeConfig, deps: ServiceDeps) {
    this.ctx = ctx
    this.config = config
    this.deps = deps
  }

  getForgeQueue(limit = 20) {
    return this.deps.orchestrator.listRuns(limit)
  }

  getSkillLibrary(status?: string) {
    return this.deps.registry.listSkills(status as any)
  }

  getStats() {
    return this.deps.registry.getStats()
  }

  async triggerForge(reason: string) {
    return this.deps.orchestrator.startManualForge(reason)
  }

  async approveSkill(runId: string) {
    return this.deps.orchestrator.approveSkill(runId)
  }

  async rejectSkill(runId: string, reasons: string[], customText?: string) {
    return this.deps.orchestrator.rejectSkill(runId, reasons, customText)
  }

  async cancelForge(runId: string) {
    return this.deps.orchestrator.cancelForge(runId)
  }

  async retryForge(runId: string) {
    return this.deps.orchestrator.retryRun(runId)
  }

  async archiveSkill(skillId: string) {
    return this.deps.registry.archiveSkill(skillId)
  }

  async unarchiveSkill(skillId: string) {
    return this.deps.registry.unarchiveSkill(skillId)
  }

  getConfig(): SkillForgeConfig {
    return this.config
  }

  updateConfig(updates: Partial<SkillForgeConfig>): SkillForgeConfig {
    Object.assign(this.config, updates)
    return this.config
  }

  // ---- 饕餮模式 ----

  detectSimilarSkills(threshold?: number) {
    return this.deps.taotie?.detectSimilarSkills(threshold) ?? []
  }

  async analyzePair(targetName: string, sourceName: string) {
    if (!this.deps.taotie) throw new Error('Taotie fusion not available')
    return this.deps.taotie.analyzePair(targetName, sourceName)
  }

  async startFusion(targetName: string, sourceName: string, autoApprove = false) {
    if (!this.deps.taotie) throw new Error('Taotie fusion not available')
    return this.deps.taotie.startFusion(targetName, sourceName, autoApprove)
  }

  getFusionStatus(runId: string) {
    return this.deps.taotie?.getRunStatus(runId)
  }

  listFusionRuns(limit = 20) {
    return this.deps.taotie?.listRuns(limit) ?? []
  }

  async approveFusionStep(runId: string, step?: number) {
    if (!this.deps.taotie) return false
    return this.deps.taotie.approveStep(runId, step)
  }

  stopFusion(runId: string) {
    return this.deps.taotie?.stopRun(runId) ?? false
  }

  getGlobalPatterns() {
    return this.deps.taotie?.getGlobalPatterns() ?? []
  }

  // ---- 技能编排（Skill Orchestrator） ----

  async orchestrateTask(task: string, mode?: 'fast' | 'llm' | 'auto') {
    if (!this.deps.skillOrchestrator) throw new Error('Skill orchestrator not available')
    return this.deps.skillOrchestrator.orchestrate(task, { mode })
  }

  getOrchestratorStats() {
    return this.deps.skillOrchestrator?.getStats() ?? null
  }

  // ---- Dreaming 闲时锻造 ----

  async startDreaming(triggerType: 'manual' | 'scheduled' | 'idle' = 'manual') {
    if (!this.deps.dreaming) throw new Error('Dreaming engine not available')
    return this.deps.dreaming.startDreaming(triggerType)
  }

  stopDreaming(reason?: string) {
    if (!this.deps.dreaming) return false
    return this.deps.dreaming.stopDreaming(reason)
  }

  getDreamingStatus() {
    if (!this.deps.dreaming) return null
    return this.deps.dreaming.getCurrentRun()
  }

  getDreamingHistory(limit = 20) {
    if (!this.deps.dreaming) return []
    return this.deps.dreaming.getHistory(limit)
  }

  async getDreamingHealthReport() {
    if (!this.deps.dreaming) throw new Error('Dreaming engine not available')
    return this.deps.dreaming.generateHealthReport()
  }
}
