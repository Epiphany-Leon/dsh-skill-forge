/**
 * SkillForgeService —— 总服务入口
 */

import type { SkillForgeConfig } from '../types.js'
import { ForgeOrchestrator } from './ForgeOrchestrator.js'
import { SkillRegistry } from './SkillRegistry.js'

export interface ServiceDeps {
  orchestrator: ForgeOrchestrator
  registry: SkillRegistry
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
}
