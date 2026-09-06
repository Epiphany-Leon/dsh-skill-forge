/**
 * dsh-skill-forge — Host 端主入口
 *
 * DeepSeek Harness 插件，多 Agent 协作式技能锻造系统。
 *
 * @module dsh-skill-forge
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

import { ForgeOrchestrator, type ForgeDeps } from './services/ForgeOrchestrator.js'
import { TriggerEngine } from './services/TriggerEngine.js'
import { SkillRegistry } from './services/SkillRegistry.js'
import { SecurityAuditor } from './services/SecurityAuditor.js'
import { SkillForgeService, type ServiceDeps } from './services/SkillForgeService.js'
import { InjectionEngine } from './services/InjectionEngine.js'
import { TaotieFusion } from './services/TaotieFusion.js'
import { DarwinOptimizer } from './services/DarwinOptimizer.js'
import { CoEvoOrchestrator } from './services/CoEvoOrchestrator.js'
import { DreamingEngine } from './services/DreamingEngine.js'
import { SkillOrchestrator } from './services/SkillOrchestrator.js'
import { ExtractorAgent } from './agents/ExtractorAgent.js'
import { GeneratorAgent } from './agents/GeneratorAgent.js'
import { VerifierAgent } from './agents/VerifierAgent.js'
import { RefinerAgent } from './agents/RefinerAgent.js'
import { AdversarialTestGenerator } from './agents/AdversarialTestGenerator.js'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, isAbsolute } from 'node:path'
import { exec } from 'node:child_process'
import { FORGE_ROUTES } from './services/routes.js'

/** 插件显示名。 */
export const name = 'dsh-skill-forge'

/** 依赖的服务。 */
export const inject = ['tools', 'llm', 'sessions', 'skills', 'settings', 'webServer', 'workspaceRegistry']

// ============================================================
// 配置定义（Schemastery）
// ============================================================

export interface Config {
  securityLevel: 'strict' | 'normal' | 'permissive' | 'auto'
  autoTrigger: boolean
  triggerThreshold: number
  maxIterations: number
  verificationPassThreshold: number
  skillCountAlertThreshold: number
  tokenBudgetRatio: number
  enableDreaming: boolean
  dreamingSchedule: string
  customDangerousPatterns: string[]
  workspaceRoot: string
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
  // ---- 饕餮模式 ----
  taotieEnabled: boolean
  taotieAutoDetect: boolean
  taotieSimilarityThreshold: number
  taotieMaxInjectionSteps: number
  taotieMinImprovementThreshold: number
  taotieAutoApprove: boolean
  // ---- 达尔文模式 ----
  darwinMaxIterations: number
  darwinHighScoreThreshold: number
  darwinAutoApprove: boolean
  // ---- CoEvo 共进化模式 ----
  coevoEnabled: boolean
  coevoMaxRounds: number
  coevoTargetSkillScore: number
  coevoTargetTestStrength: number
  coevoInitialTestCount: number
  coevoMaxTestCases: number
  coevoTestsPerRound: number
  coevoAutoApprove: boolean
  coevoTestPruneThreshold: number
  // ---- Dreaming 闲时锻造 ----
  dreamingIdleThresholdMinutes: number
  dreamingMaxConcurrentOptimizations: number
  dreamingAutoOptimizeThreshold: number
  dreamingAutoFusion: boolean
  dreamingAutoArchiveDays: number
  dreamingMaxSuggestions: number
  dreamingDarwinAutoApprove: boolean
  dreamingTaotieAutoApprove: boolean
  // ---- 技能编排 ----
  orchestrationEnabled: boolean
  orchestrationDecomposeMode: 'fast' | 'llm' | 'auto'
  orchestrationMatchThreshold: number
  orchestrationMaxSkills: number
}

export const Config = Schema.object({
  securityLevel: Schema.union([
    Schema.const('strict'),
    Schema.const('normal'),
    Schema.const('permissive'),
    Schema.const('auto'),
  ]).default('normal'),
  autoTrigger: Schema.boolean().default(true),
  triggerThreshold: Schema.number().default(0.3).min(0.1).max(0.95),
  maxIterations: Schema.number().default(3).min(0).max(10),
  verificationPassThreshold: Schema.number().default(0.9).min(0.5).max(1.0),
  skillCountAlertThreshold: Schema.number().default(30).min(10).max(100),
  tokenBudgetRatio: Schema.number().default(0.1).min(0.05).max(0.3),
  enableDreaming: Schema.boolean().default(false),
  dreamingSchedule: Schema.string().default('0 3 * * 0'),
  customDangerousPatterns: Schema.array(Schema.string()).default([]),
  workspaceRoot: Schema.string().default(''),
  injectionMode: Schema.union([
    Schema.const('all'),
    Schema.const('smart'),
  ]).default('all'),
  injectionTokenBudget: Schema.number().default(0).min(0),
  injectionRelevanceThreshold: Schema.number().default(0.2).min(0).max(1),
  enableIncrementalAccumulation: Schema.boolean().default(true),
  densityThreshold: Schema.number().default(2.0).min(0.1).max(10.0),
  minForgingIntervalMinutes: Schema.number().default(30).min(5).max(240),
  idleDensityThreshold: Schema.number().default(0.5).min(0.1).max(1.0),
  enableIntentAware: Schema.boolean().default(true),
  intentAnalysisMinChars: Schema.number().default(20).min(0).max(500),
  enableRewardLearning: Schema.boolean().default(true),
  implicitFeedbackWindow: Schema.number().default(3).min(1).max(10),
  implicitPositiveStep: Schema.number().default(0.1).min(0.01).max(0.5),
  implicitNegativeStep: Schema.number().default(0.15).min(0.01).max(0.5),
  explicitFeedbackMultiplier: Schema.number().default(3).min(1).max(10),
  dailyDecayRate: Schema.number().default(0.05).min(0).max(0.5),
  feedbackScoreWeight: Schema.number().default(0.15).min(0).max(0.5),
  usageScoreWeight: Schema.number().default(0.1).min(0).max(0.5),
  // ---- 饕餮模式 ----
  taotieEnabled: Schema.boolean().default(true),
  taotieAutoDetect: Schema.boolean().default(true),
  taotieSimilarityThreshold: Schema.number().default(0.4).min(0).max(1),
  taotieMaxInjectionSteps: Schema.number().default(5).min(1).max(20),
  taotieMinImprovementThreshold: Schema.number().default(0.02).min(0).max(0.5),
  taotieAutoApprove: Schema.boolean().default(false),
  // ---- 达尔文模式 ----
  darwinMaxIterations: Schema.number().default(10).min(1).max(50),
  darwinHighScoreThreshold: Schema.number().default(0.85).min(0.5).max(1.0),
  darwinAutoApprove: Schema.boolean().default(false),
  // ---- CoEvo 共进化模式 ----
  coevoEnabled: Schema.boolean().default(true),
  coevoMaxRounds: Schema.number().default(8).min(1).max(30),
  coevoTargetSkillScore: Schema.number().default(0.85).min(0.5).max(1.0),
  coevoTargetTestStrength: Schema.number().default(0.7).min(0.3).max(1.0),
  coevoInitialTestCount: Schema.number().default(6).min(3).max(20),
  coevoMaxTestCases: Schema.number().default(20).min(5).max(50),
  coevoTestsPerRound: Schema.number().default(3).min(1).max(10),
  coevoAutoApprove: Schema.boolean().default(false),
  coevoTestPruneThreshold: Schema.number().default(0.9).min(0.5).max(1.0),
  // ---- Dreaming 闲时锻造 ----
  dreamingIdleThresholdMinutes: Schema.number().default(0).min(0).max(480), // 0 = disabled
  dreamingMaxConcurrentOptimizations: Schema.number().default(2).min(1).max(10),
  dreamingAutoOptimizeThreshold: Schema.number().default(0.0).min(0).max(1.0), // 0 = disabled
  dreamingAutoFusion: Schema.boolean().default(false),
  dreamingAutoArchiveDays: Schema.number().default(0).min(0).max(365), // 0 = disabled
  dreamingMaxSuggestions: Schema.number().default(10).min(1).max(50),
  dreamingDarwinAutoApprove: Schema.boolean().default(true),
  dreamingTaotieAutoApprove: Schema.boolean().default(false),
  // ---- 技能编排 ----
  orchestrationEnabled: Schema.boolean().default(true),
  orchestrationDecomposeMode: Schema.union([
    Schema.const('fast'),
    Schema.const('llm'),
    Schema.const('auto'),
  ]).default('auto'),
  orchestrationMatchThreshold: Schema.number().default(0.25).min(0).max(1),
  orchestrationMaxSkills: Schema.number().default(5).min(1).max(20),
})

// ============================================================
// 类型化事件声明
// ============================================================

declare module '@deepseek-ai/cordis' {
  interface Events {
    'skill-forge/status-changed': (payload: { runId: string; status: string; prevStatus: string }) => void
    'skill-forge/completed': (payload: { runId: string; skillId: string }) => void
    'skill-forge/failed': (payload: { runId: string; reason: any }) => void
  }
}

// ============================================================
// 插件主体
// ============================================================

export function apply(ctx: Context, config: Config) {
  // ---- 注册 settings 命名空间 ----
  ctx.settings?.register?.(name, Config, {
    description: 'Skill Forge — 多 Agent 协作式技能锻造系统',
  })

  /**
   * 解析当前文件浏览器的根目录。
   * 优先级：config.workspaceRoot > DSH 第一个 workspace > process.cwd()
   */
  function resolveWorkspaceRoot(): string {
    if (config.workspaceRoot && config.workspaceRoot.trim() !== '') {
      return config.workspaceRoot
    }
    const workspaces = ctx.workspaceRegistry?.list?.()
    const first = workspaces?.[0]
    if (first) {
      return first.path
    }
    return process.cwd()
  }

  // ---- 创建服务（闭包里共享） ----
  const registry = new SkillRegistry(ctx, config)
  const auditor = new SecurityAuditor(ctx, config)
  auditor.setRegistry(registry)
  const extractor = new ExtractorAgent(ctx, config)
  const generator = new GeneratorAgent(ctx, config)
  const verifier = new VerifierAgent(ctx, config)
  const refiner = new RefinerAgent(ctx, config)
  let orchestrator: ForgeOrchestrator
  const trigger = new TriggerEngine(ctx, config, {
    startAutoForge: (sessionIds, summary) => orchestrator.startAutoForge(sessionIds, summary),
  })
  orchestrator = new ForgeOrchestrator(ctx, config, {
    registry, auditor, extractor, generator, verifier, refiner, trigger,
  } as ForgeDeps)
  const injection = new InjectionEngine(ctx, config, registry, {
    onInjection: (skillCount, isIntentAware) => {
      orchestrator.recordInjection(skillCount, isIntentAware)
    },
  })
  const taotie = new TaotieFusion(ctx, config, registry, verifier)
  const darwin = new DarwinOptimizer(ctx, config, {
    registry,
    verifier,
    refiner,
  })
  const adversarial = new AdversarialTestGenerator(ctx, config)
  const coevo = new CoEvoOrchestrator(ctx, config, {
    registry,
    verifier,
    refiner,
    adversarial,
  })
  const dreaming = new DreamingEngine(ctx, config, {
    registry,
    darwin,
    taotie,
    verifier,
  })
  const skillOrchestrator = new SkillOrchestrator(ctx, config, registry, {
    injectionEngine: injection,
  })
  const service = new SkillForgeService(ctx, config, {
    orchestrator, registry, taotie, dreaming, skillOrchestrator,
  } as ServiceDeps)

  // ---- 注册 forge_skill 工具 ----
  ctx.tools.register(defineTool({
    name: 'forge_skill',
    description: 'Manually trigger skill forging from the current conversation. Use when the user asks to forge/save/distill a skill from this session, or when you detect a reusable pattern worth preserving.',
    parameters: {
      reason: {
        type: 'string',
        required: true,
        description: 'Why this conversation should be forged into a skill',
      },
    },
    output: {
      schema: { type: 'json' } as any,
      render(_args: unknown, value: unknown): Array<{ type: 'text'; text: string }> {
        return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }]
      },
    },
    async execute(args: { reason: string }) {
      const result = await orchestrator.startManualForge(args.reason)
      return JSON.stringify(result)
    },
  }))

  // ---- 注册 orchestrate_skills 工具 ----
  ctx.tools.register(defineTool({
    name: 'orchestrate_skills',
    description: 'Compose a multi-skill workflow for a complex task. Analyzes the task, breaks it into subtasks, matches each subtask to the best available skill, and generates an execution guide. Use when a task requires multiple skills working together in sequence.',
    parameters: {
      task: {
        type: 'string',
        required: true,
        description: 'The complex task to orchestrate a skill workflow for',
      },
      mode: {
        type: 'string',
        description: 'Decomposition mode: fast (heuristic), llm (deep analysis), or auto (default)',
      },
    },
    output: {
      schema: { type: 'json' } as any,
      render(_args: unknown, value: unknown): Array<{ type: 'text'; text: string }> {
        return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }]
      },
    },
    async execute(args: { task: string; mode?: string }) {
      const mode = (args.mode || 'auto') as 'fast' | 'llm' | 'auto'
      const result = await skillOrchestrator.orchestrate(args.task, { mode })
      // 自动注入匹配到的技能
      if (result.skillIdsToInject.length > 0) {
        await skillOrchestrator.injectWorkflowSkills(result.workflow)
      }
      return JSON.stringify({
        workflowId: result.workflow.id,
        totalSteps: result.workflow.totalNodes,
        matchedSkills: result.workflow.matchedNodes,
        unmatchedSteps: result.workflow.unmatchedNodes,
        confidence: result.workflow.confidence,
        estimatedTokens: result.estimatedTokens,
        executionGuide: result.executionGuide,
        matchedSkillNames: result.workflow.nodes
          .filter(n => n.matchedSkill)
          .map(n => n.matchedSkill!.skill.frontmatter.name),
      })
    },
  }))

  // ---- 注册 HTTP API 路由（Host ↔ Client 数据桥接） ----
  const routeHandlers: Record<string, any> = {
    '/api/skill-forge/queue': (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      const url = new URL(req.url!, `http://${req.headers.host}`)
      const limit = parseInt(url.searchParams.get('limit') || '20')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(orchestrator.listRuns(limit)))
    },
    '/api/skill-forge/skills': (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const q = url.searchParams.get('search') || url.searchParams.get('q') || undefined
        const status = url.searchParams.get('status') as any || undefined
        const category = url.searchParams.get('category') || undefined
        const sortBy = (url.searchParams.get('sort') || url.searchParams.get('sortBy')) as any || undefined
        const sortOrder = url.searchParams.get('sortOrder') as any || undefined
        const limit = url.searchParams.get('limit')
        const offset = url.searchParams.get('offset')
        const result = registry.searchSkills(q, {
          status,
          category,
          sortBy,
          sortOrder,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/skills/top': (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const limit = parseInt(url.searchParams.get('limit') || '10')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(registry.getTopSkills(limit)))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/stats': (_req: any, res: any) => {
      try {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(registry.getStats()))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/stats/detail': (_req: any, res: any) => {
      try {
        const base = registry.getDetailedStats()
        const allRuns = orchestrator.listRuns(100)

        // 最近 7 天日统计
        const dayMs = 24 * 60 * 60 * 1000
        const now = Date.now()
        const dailyStats: Array<{
          date: string
          forgeCount: number
          newSkills: number
          usageCount: number
        }> = []
        for (let i = 6; i >= 0; i--) {
          const dayStart = new Date(now - i * dayMs)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = dayStart.getTime() + dayMs
          const dateStr = `${dayStart.getMonth() + 1}/${dayStart.getDate()}`
          const forgeCount = allRuns.filter(r => r.createdAt >= dayStart.getTime() && r.createdAt < dayEnd).length
          const newSkills = registry.listSkills().filter(s => s.createdAt >= dayStart.getTime() && s.createdAt < dayEnd).length
          // 当天使用次数：粗略用 lastUsedAt 估算
          const usageCount = registry.listSkills().filter(s => s.lastUsedAt && s.lastUsedAt >= dayStart.getTime() && s.lastUsedAt < dayEnd).length
          dailyStats.push({ date: dateStr, forgeCount, newSkills, usageCount })
        }

        // Top 5 常用技能
        const topSkills = registry.getTopSkills(5).map(s => ({
          name: s.frontmatter.name,
          usageCount: s.usageCount,
          qualityScore: s.verificationScore ?? s.frontmatter.qualityScore ?? 0,
        }))

        // 最近 5 次锻造
        const recentForges = allRuns.slice(0, 5).map(r => ({
          id: r.id,
          status: r.status,
          qualityScore: r.qualityScore ?? r.verificationResult?.overallScore ?? null,
          createdAt: r.createdAt,
          sourceSummary: r.sourceSummary,
        }))

        // 注入统计：优先用 orchestrator 持久化的数据，
        // 合并 injection engine 的当前会话数据
        const persistentInj = orchestrator.getInjectionStats?.() || {
          totalInjections: 0,
          intentAwareHits: 0,
          smartInjectionRatio: 0,
          totalSkillInjections: 0,
        }
        const runtimeInj = injection?.getStats?.() || {
          totalInjections: 0,
          intentAwareHits: 0,
          smartInjectionRatio: 0,
          totalSkillInjections: 0,
        }
        const totalInjections = persistentInj.totalInjections + runtimeInj.totalInjections
        const totalAwareHits = persistentInj.intentAwareHits + runtimeInj.intentAwareHits
        const totalSkillInj = persistentInj.totalSkillInjections + runtimeInj.totalSkillInjections
        const injStats = {
          totalInjections,
          intentAwareHits: totalAwareHits,
          totalSkillInjections: totalSkillInj,
          smartInjectionRatio: totalInjections > 0 ? totalAwareHits / totalInjections : 0,
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          ...base,
          dailyStats,
          topSkills,
          recentForges,
          injectionStats: injStats,
        }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/stats/trigger': (_req: any, res: any) => {
      try {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(trigger.getStats()))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/trigger': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const result = await orchestrator.startManualForge(body.reason || 'Manual forge')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e) {
        console.error('[skill-forge] trigger error:', e)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/approve': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const ok = await orchestrator.approveSkill(body.runId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/reject': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const ok = await orchestrator.rejectSkill(body.runId, body.reasons || [], body.customText)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/cancel': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const ok = await orchestrator.cancelForge(body.runId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/retry': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const ok = await orchestrator.retryRun(body.runId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/archive': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const ok = await registry.archiveSkill(body.skillId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/unarchive': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const ok = await registry.unarchiveSkill(body.skillId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 技能详情
    '/api/skill-forge/skill-detail': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const name = url.searchParams.get('name') || ''
        if (!name) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'name is required' })); return }
        const skill = registry.getSkillByName(name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(skill))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 技能版本列表
    '/api/skill-forge/skill-versions': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const name = url.searchParams.get('name') || ''
        if (!name) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'name is required' })); return }
        const skill = registry.getSkillByName(name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        const history = await registry.getVersionHistory(skill.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ versions: history }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 指定版本内容
    '/api/skill-forge/skill-version': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const name = url.searchParams.get('name') || ''
        const version = url.searchParams.get('version') || ''
        if (!name || !version) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'name and version are required' })); return }
        const skill = registry.getSkillByName(name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        const content = await registry.getSkillVersion(skill.id, version)
        if (!content) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Version not found' })); return }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(content))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 回滚版本
    '/api/skill-forge/skill-rollback': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const name = body.name
        const version = body.version
        if (!name || !version) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'name and version are required' })); return }
        const skill = registry.getSkillByName(name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        const ok = await registry.rollbackToVersion(skill.id, version, body.reason)
        if (!ok) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Rollback failed' })); return }
        const updated = registry.getSkill(skill.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, skill: updated }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 取消归档（复活）
    '/api/skill-forge/skill-unarchive': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const skill = registry.getSkillByName(body.name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        const ok = await registry.unarchiveSkill(skill.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 重新锻造
    '/api/skill-forge/skill-reforge': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const skill = registry.getSkillByName(body.name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        const result = await (orchestrator as any).reforgeSkill?.(skill.id, body.reason)
        if (!result) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Reforge failed' })); return }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 记录使用
    '/api/skill-forge/skill-usage': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const skill = registry.getSkillByName(body.name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        await registry.recordUsage(skill.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, usageCount: (skill as any).usageCount }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 记录使用反馈
    '/api/skill-forge/skill-feedback': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const skill = registry.getSkillByName(body.name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        if (!body.rating || !['helpful', 'neutral', 'harmful'].includes(body.rating)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'rating must be helpful, neutral, or harmful' }))
          return
        }
        await registry.recordFeedback(skill.id, { rating: body.rating, comment: body.comment })
        const updated = registry.getSkill(skill.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          ok: true,
          feedbackCount: updated?.feedbackCount ?? 0,
          feedbackHelpful: updated?.feedbackHelpful ?? 0,
          feedbackHarmful: updated?.feedbackHarmful ?? 0,
          feedbackNeutral: updated?.feedbackNeutral ?? 0,
          feedbackScore: updated?.feedbackScore ?? 0,
        }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 更新技能
    '/api/skill-forge/skill-update': async (req: any, res: any) => {
      if (req.method !== 'PUT') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const skill = registry.getSkillByName(body.name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        const updated = await registry.updateSkill(skill.id, {
          frontmatter: body.frontmatter,
          body: body.body,
          changelog: body.changelog,
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, skill: updated }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 删除技能
    '/api/skill-forge/skill-delete': async (req: any, res: any) => {
      if (req.method !== 'DELETE') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const name = url.searchParams.get('name') || ''
        if (!name) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'name is required' })); return }
        const skill = registry.getSkillByName(name)
        if (!skill) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Skill not found' })); return }
        const ok = await registry.deleteSkill(skill.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // ============================================================
    // 饕餮模式（Taotie Fusion）
    // ============================================================
    '/api/skill-forge/taotie-detect': (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const thresholdParam = url.searchParams.get('threshold')
        const threshold = thresholdParam ? parseFloat(thresholdParam) : undefined
        const groups = taotie.detectSimilarSkills(threshold)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ groups }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/taotie-analyze': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { target, source } = body
        if (!target || !source) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'target and source are required' }))
          return
        }
        const report = await taotie.analyzePair(target, source)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ report }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/taotie-start': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { target, source, autoApprove } = body
        if (!target || !source) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'target and source are required' }))
          return
        }
        const result = await taotie.startFusion(target, source, autoApprove ?? false)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/taotie-status': (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const runId = url.searchParams.get('runId')
        if (!runId) {
          const limit = parseInt(url.searchParams.get('limit') || '20')
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ runs: taotie.listRuns(limit) }))
          return
        }
        const run = taotie.getRunStatus(runId)
        if (!run) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Run not found' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ run }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/taotie-approve': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { runId, step, stepIndex } = body
        if (!runId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'runId is required' }))
          return
        }
        // 同时兼容 step 和 stepIndex 参数名
        const stepValue = step !== undefined ? step : stepIndex
        const ok = await taotie.approveStep(runId, stepValue)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/taotie-stop': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { runId } = body
        if (!runId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'runId is required' }))
          return
        }
        const ok = taotie.stopRun(runId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/taotie-patterns': (_req: any, res: any) => {
      if (_req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const patterns = taotie.getGlobalPatterns()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ patterns }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/config': async (req: any, res: any) => {
      if (req.method === 'GET') {
        try {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(config))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
        return
      }
      // PUT — 更新配置（热更新）
      if (req.method === 'PUT') {
        try {
          const body = await readBody(req)
          // 浅合并到 config 对象
          let changed = false
          for (const key of Object.keys(body)) {
            if (key in config) {
              (config as any)[key] = body[key]
              changed = true
            }
          }
          if (changed) {
            // 通知 settings 更新
            ctx.settings?.update?.(name, body)
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: changed, config }))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
        return
      }
      res.writeHead(405).end()
    },
    '/api/skill-forge/file-tree': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const rootPath = resolveWorkspaceRoot()
        // 如果 body.path 是绝对路径则直接用，否则相对 workspaceRoot 解析
        const basePath = body.path && body.path !== '.'
          ? isAbsolute(body.path)
            ? body.path
            : resolve(rootPath, body.path)
          : rootPath
        const showHidden = body.showHidden || false
        const tree = buildFileTree(basePath, showHidden, 2)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ tree, basePath, rootPath }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/open-file': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const rootPath = resolveWorkspaceRoot()
        const filePath = isAbsolute(body.path)
          ? body.path
          : resolve(rootPath, body.path)
        if (!existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'File not found' }))
          return
        }
        // macOS: open in default app
        exec(`open "${filePath.replace(/"/g, '\\"')}"`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 版本 diff 对比
    '/api/skill-forge/skill-diff': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const name = url.searchParams.get('name') || ''
        const from = url.searchParams.get('from') || ''
        const to = url.searchParams.get('to') || ''
        if (!name || !from || !to) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'name, from, and to are required' }))
          return
        }
        const skill = registry.getSkillByName(name)
        if (!skill) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Skill not found' }))
          return
        }
        const diff = await registry.diffVersions(skill.id, from, to)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(diff))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 谱系追踪
    '/api/skill-forge/skill-lineage': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const name = url.searchParams.get('name') || ''
        if (!name) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'name is required' })); return }
        const lineage = await registry.getSkillLineage(name)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(lineage))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 相关技能推荐
    '/api/skill-forge/skill-related': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const name = url.searchParams.get('name') || ''
        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'name is required' }))
          return
        }
        const limit = parseInt(url.searchParams.get('limit') || '5')
        const related = registry.getRelatedSkills(name, limit)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(related))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/workspace-info': (_req: any, res: any) => {
      const rootPath = resolveWorkspaceRoot()
      const workspaces = ctx.workspaceRegistry?.list?.() ?? []
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        rootPath,
        workspaces: workspaces.map((w: any) => ({
          id: w.id,
          path: w.path,
          title: w.title,
        })),
        configWorkspaceRoot: config.workspaceRoot || '',
      }))
    },
    // ============================================================
    // 达尔文模式（Darwin Mode）—— 单体技能爬山优化系统
    // ============================================================
    '/api/skill-forge/darwin-start': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { skillName, targetDimensions, autoApprove } = body
        if (!skillName) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'skillName is required' }))
          return
        }
        const result = await darwin.startOptimization(
          skillName,
          Array.isArray(targetDimensions) ? targetDimensions : undefined,
          typeof autoApprove === 'boolean' ? autoApprove : undefined,
        )
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/darwin-status': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const runId = url.searchParams.get('runId')
        if (!runId) {
          // 返回最近运行列表
          const limit = parseInt(url.searchParams.get('limit') || '20')
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ runs: darwin.listRuns(limit) }))
          return
        }
        const run = darwin.getRun(runId)
        if (!run) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Run not found' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ run }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/darwin-approve': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { runId, dimension } = body
        if (!runId || !dimension) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'runId and dimension are required' }))
          return
        }
        const ok = await darwin.approveRound(runId, dimension)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/darwin-reject': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { runId, dimension, reason } = body
        if (!runId || !dimension) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'runId and dimension are required' }))
          return
        }
        const ok = await darwin.rejectRound(runId, dimension, reason)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/darwin-stop': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { runId, reason } = body
        if (!runId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'runId is required' }))
          return
        }
        const ok = darwin.stopRun(runId, reason)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/darwin-runs': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ runs: darwin.listRuns(limit) }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // ============================================================
    // CoEvo 共进化验证模式
    // ============================================================
    '/api/skill-forge/coevo-start': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { skillName, autoApprove, maxRounds, targetSkillScore, targetTestStrength } = body
        if (!skillName) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'skillName is required' }))
          return
        }
        const result = await coevo.startCoEvolution(skillName, {
          autoApprove: typeof autoApprove === 'boolean' ? autoApprove : undefined,
          maxRounds: typeof maxRounds === 'number' ? maxRounds : undefined,
          targetSkillScore: typeof targetSkillScore === 'number' ? targetSkillScore : undefined,
          targetTestStrength: typeof targetTestStrength === 'number' ? targetTestStrength : undefined,
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/coevo-status': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const runId = url.searchParams.get('runId')
        if (!runId) {
          const limit = parseInt(url.searchParams.get('limit') || '20')
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ runs: coevo.listRuns(limit) }))
          return
        }
        const run = coevo.getRun(runId)
        if (!run) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Run not found' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ run }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/coevo-approve': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { runId } = body
        if (!runId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'runId is required' }))
          return
        }
        const ok = await coevo.approveRound(runId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/coevo-reject': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { runId, reason } = body
        if (!runId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'runId is required' }))
          return
        }
        const ok = await coevo.rejectRound(runId, reason)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/coevo-stop': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const { runId, reason } = body
        if (!runId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'runId is required' }))
          return
        }
        const ok = coevo.stopRun(runId, reason)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/coevo-runs': async (req: any, res: any) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ runs: coevo.listRuns(limit) }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // 技能编排
    '/api/skill-forge/orchestrate': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const task = body.task || body.query || ''
        if (!task) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'task is required' }))
          return
        }
        const mode = (body.mode || 'auto') as 'fast' | 'llm' | 'auto'
        const result = await skillOrchestrator.orchestrate(task, { mode })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          workflow: result.workflow,
          skillIdsToInject: result.skillIdsToInject,
          executionGuide: result.executionGuide,
          estimatedTokens: result.estimatedTokens,
        }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/orchestrator/stats': (_req: any, res: any) => {
      try {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(skillOrchestrator.getStats()))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    // ============================================================
    // Dreaming 闲时锻造模式
    // ============================================================
    '/api/skill-forge/dreaming/start': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const triggerType = (body.triggerType as 'manual' | 'scheduled' | 'idle') || 'manual'
        const run = await dreaming.startDreaming(triggerType)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ run }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/dreaming/stop': async (req: any, res: any) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      try {
        const body = await readBody(req)
        const ok = dreaming.stopDreaming(body?.reason)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/dreaming/status': (_req: any, res: any) => {
      try {
        const current = dreaming.getCurrentRun()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ current }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/dreaming/history': (_req: any, res: any) => {
      try {
        const url = new URL(_req.url!, `http://${_req.headers.host}`)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const history = dreaming.getHistory(limit)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ history }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
    '/api/skill-forge/dreaming/health-report': async (_req: any, res: any) => {
      if (_req.method !== 'GET') { res.writeHead(405).end(); return }
      try {
        const report = await dreaming.generateHealthReport()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ report }))
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    },
  }

  for (const { path: routePath, kind } of FORGE_ROUTES) {
    const handler = routeHandlers[routePath]
    if (!handler) continue
    ctx.webServer?.register?.({
      kind,
      path: routePath,
      handler,
    })
  }

  // ---- 启动 ----
  // Web 模式下立即初始化（不等待 ready 事件，确保技能数据立即可用）
  const initPromise = (async () => {
    try {
      await registry.initialize()
      await orchestrator.initialize(registry.getStoragePath())
      await darwin.initialize(registry.getStoragePath())
      await coevo.initialize(registry.getStoragePath())
      await dreaming.initialize(registry.getStoragePath())
      await trigger.start()
      await injection.start()
      ctx.logger.info('[skill-forge] Plugin initialized')
    } catch (err) {
      ctx.logger.error('[skill-forge] Init failed:', err)
    }
  })()

  ctx.on('ready', async () => {
    await initPromise
    ctx.logger.info('[skill-forge] Ready event received')
  })

  ctx.on('dispose', async () => {
    await trigger.stop()
    await injection.stop()
    await dreaming.dispose()
    ctx.logger.info('[skill-forge] Plugin disposed')
  })
}

/** 读取请求体 */
function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8')
        resolve(body ? JSON.parse(body) : {})
      } catch { resolve({}) }
    })
  })
}

/** 构建文件树 */
function buildFileTree(
  dirPath: string,
  showHidden: boolean,
  maxDepth: number,
): Array<{ name: string; type: 'file' | 'directory'; path: string; children?: any[] }> {
  if (maxDepth <= 0) return []

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    const result: any[] = []

    for (const entry of entries) {
      if (!showHidden && entry.name.startsWith('.')) continue
      if (entry.name === 'node_modules' || entry.name === '.git') continue

      const fullPath = join(dirPath, entry.name)
      const item: any = {
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
      }

      if (entry.isDirectory() && maxDepth > 1) {
        try {
          item.children = buildFileTree(fullPath, showHidden, maxDepth - 1)
        } catch {
          item.children = []
        }
      }

      result.push(item)
    }

    // 目录在前，文件在后，按名称排序
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return result
  } catch {
    return []
  }
}
