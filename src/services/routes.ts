/**
 * HTTP API 路由 —— Host ↔ Client 数据桥接
 *
 * 注册 loopback-only HTTP 端点，供 Client 端面板获取锻造数据。
 * 模式：dsh-skill-hub 使用了类似的 HTTP API 桥接方式。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { exec } from 'node:child_process'
import type { ForgeOrchestrator } from './ForgeOrchestrator.js'
import type { SkillRegistry } from './SkillRegistry.js'
import type { TaotieFusion } from './TaotieFusion.js'

interface ApiDeps {
  orchestrator: ForgeOrchestrator
  registry: SkillRegistry
  taotie?: TaotieFusion
  getConfig?: () => any
  updateConfig?: (updates: Record<string, any>) => boolean
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8')
        resolve(body ? JSON.parse(body) : {})
      } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

export function registerForgeRoutes(deps: ApiDeps): { unregister: () => void } {
  const { orchestrator, registry, getConfig, updateConfig } = deps

  const routes: Array<{ kind: 'exact' | 'prefix'; path: string; handler: any }> = [
    // GET /api/skill-forge/queue — 获取锻造队列
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/queue',
      handler: (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return }
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        json(res, orchestrator.listRuns(limit))
      },
    },

    // GET /api/skill-forge/skills — 获取技能库（支持搜索筛选）
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/skills',
      handler: (req: IncomingMessage, res: ServerResponse) => {
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
          json(res, result)
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // GET /api/skill-forge/skills/top — Top N 高频技能
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/skills/top',
      handler: (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return }
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`)
          const limit = parseInt(url.searchParams.get('limit') || '10')
          json(res, registry.getTopSkills(limit))
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // GET /api/skill-forge/skills/:name — 技能详情 / 版本 / 操作（统一前缀路由）
    {
      kind: 'prefix' as const,
      path: '/api/skill-forge/skills/',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url!, `http://${req.headers.host}`)
          const path = url.pathname.replace('/api/skill-forge/skills/', '')
          const parts = path.split('/').filter(Boolean)
          const method = req.method || 'GET'

          // 至少需要一个 name 段
          if (parts.length === 0) {
            json(res, { error: 'Skill name is required' }, 400)
            return
          }

          const name = decodeURIComponent(parts[0] || '')
          const sub = parts[1]
          const sub2 = parts[2]

          // ===== GET /api/skill-forge/skills/:name — 技能详情 =====
          if (parts.length === 1 && method === 'GET') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            json(res, skill)
            return
          }

          // ===== PUT /api/skill-forge/skills/:name — 更新技能 =====
          if (parts.length === 1 && method === 'PUT') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            const body = await parseBody(req)
            const updated = await registry.updateSkill(skill.id, {
              frontmatter: body.frontmatter,
              body: body.body,
            })
            json(res, { ok: true, skill: updated })
            return
          }

          // ===== DELETE /api/skill-forge/skills/:name — 删除技能 =====
          if (parts.length === 1 && method === 'DELETE') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            const ok = await registry.deleteSkill(skill.id)
            json(res, { ok })
            return
          }

          // ===== GET /api/skill-forge/skills/:name/versions — 版本列表 =====
          if (parts.length === 2 && sub === 'versions' && method === 'GET') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            const history = await registry.getVersionHistory(skill.id)
            json(res, { versions: history })
            return
          }

          // ===== GET /api/skill-forge/skills/:name/versions/:version — 指定版本详情 =====
          if (parts.length >= 3 && sub === 'versions' && method === 'GET') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            const version = decodeURIComponent(parts.slice(2).join('/'))
            const content = await registry.getSkillVersion(skill.id, version)
            if (!content) {
              json(res, { error: 'Version not found' }, 404)
              return
            }
            json(res, content)
            return
          }

          // ===== POST /api/skill-forge/skills/:name/rollback — 回滚版本 =====
          if (parts.length === 2 && sub === 'rollback' && method === 'POST') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            const body = await parseBody(req)
            if (!body.version) {
              json(res, { error: 'version is required' }, 400)
              return
            }
            const ok = await registry.rollbackToVersion(skill.id, body.version, body.reason)
            if (!ok) {
              json(res, { error: 'Rollback failed' }, 500)
              return
            }
            const updated = registry.getSkill(skill.id)
            json(res, { ok: true, skill: updated })
            return
          }

          // ===== POST /api/skill-forge/skills/:name/unarchive — 取消归档 =====
          if (parts.length === 2 && sub === 'unarchive' && method === 'POST') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            const ok = await registry.unarchiveSkill(skill.id)
            json(res, { ok })
            return
          }

          // ===== POST /api/skill-forge/skills/:name/reforge — 重新锻造 =====
          if (parts.length === 2 && sub === 'reforge' && method === 'POST') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            const body = await parseBody(req)
            const result = await orchestrator.reforgeSkill?.(skill.id, body.reason)
            if (!result) {
              json(res, { error: 'Reforge failed' }, 500)
              return
            }
            json(res, result)
            return
          }

          // ===== POST /api/skill-forge/skills/:name/usage — 记录使用 =====
          if (parts.length === 2 && sub === 'usage' && method === 'POST') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            await registry.recordUsage(skill.id)
            json(res, { ok: true, usageCount: skill.usageCount })
            return
          }

          // ===== POST /api/skill-forge/skills/:name/feedback — 记录使用反馈 =====
          if (parts.length === 2 && sub === 'feedback' && method === 'POST') {
            const skill = registry.getSkillByName(name)
            if (!skill) {
              json(res, { error: 'Skill not found' }, 404)
              return
            }
            const body = await parseBody(req)
            if (!body.rating || !['helpful', 'neutral', 'harmful'].includes(body.rating)) {
              json(res, { error: 'rating must be helpful, neutral, or harmful' }, 400)
              return
            }
            await registry.recordFeedback(skill.id, { rating: body.rating, comment: body.comment })
            const updated = registry.getSkill(skill.id)
            json(res, {
              ok: true,
              feedbackCount: updated?.feedbackCount ?? 0,
              feedbackHelpful: updated?.feedbackHelpful ?? 0,
              feedbackHarmful: updated?.feedbackHarmful ?? 0,
              feedbackNeutral: updated?.feedbackNeutral ?? 0,
              feedbackScore: updated?.feedbackScore ?? 0,
            })
            return
          }

          // 404 — 路径不匹配
          json(res, { error: 'Not found' }, 404)
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // GET /api/skill-forge/stats — 获取统计
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/stats',
      handler: (_req: IncomingMessage, res: ServerResponse) => {
        try {
          json(res, registry.getStats())
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // GET /api/skill-forge/stats/detail — 详细统计
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/stats/detail',
      handler: (_req: IncomingMessage, res: ServerResponse) => {
        try {
          json(res, registry.getDetailedStats())
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/trigger — 手动触发锻造
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/trigger',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const result = await orchestrator.startManualForge(body.reason || 'Manual forge')
          json(res, result)
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/approve — 批准技能
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/approve',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const ok = await orchestrator.approveSkill(body.runId)
          json(res, { ok })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/reject — 拒绝技能
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/reject',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const ok = await orchestrator.rejectSkill(body.runId, body.reasons || [], body.customText)
          json(res, { ok })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/cancel — 取消锻造
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/cancel',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const ok = await orchestrator.cancelForge(body.runId)
          json(res, { ok })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/retry — 重试锻造
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/retry',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const ok = await orchestrator.retryRun(body.runId)
          json(res, { ok })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/archive — 归档技能
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/archive',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const ok = await registry.archiveSkill(body.skillId)
          json(res, { ok })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/unarchive — 恢复技能
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/unarchive',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const ok = await registry.unarchiveSkill(body.skillId)
          json(res, { ok })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // GET /api/skill-forge/config — 获取配置
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/config',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          try {
            const config = getConfig?.() || {}
            json(res, config)
          } catch (e) {
            json(res, { error: (e as Error).message }, 500)
          }
          return
        }
        if (req.method === 'PUT') {
          try {
            const body = await parseBody(req)
            const ok = updateConfig?.(body) ?? false
            if (!ok) {
              json(res, { error: 'Failed to update config' }, 500)
              return
            }
            const config = getConfig?.() || {}
            json(res, { ok: true, config })
          } catch (e) {
            json(res, { error: (e as Error).message }, 500)
          }
          return
        }
        res.writeHead(405).end()
      },
    },

    // POST /api/skill-forge/file-tree — 获取文件树
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/file-tree',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const basePath = resolve(process.cwd(), body.path || '.')
          const showHidden = body.showHidden || false
          const tree = buildFileTree(basePath, showHidden, 2)
          json(res, { tree, basePath })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/open-file — 打开文件
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/open-file',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          const body = await parseBody(req)
          const filePath = resolve(process.cwd(), body.path)
          if (!existsSync(filePath)) {
            json(res, { ok: false, error: 'File not found' }, 404)
            return
          }
          // macOS: open in default app
          exec(`open "${filePath.replace(/"/g, '\\"')}"`)
          json(res, { ok: true })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // ============================================================
    // 饕餮模式（Taotie Fusion）—— 跨技能优势吸收融合系统
    // ============================================================

    // GET /api/skill-forge/taotie-detect — 检测相似技能组
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/taotie-detect',
      handler: (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return }
        try {
          if (!deps.taotie) { json(res, { error: 'Taotie fusion not available' }, 503); return }
          const url = new URL(req.url!, `http://${req.headers.host}`)
          const thresholdParam = url.searchParams.get('threshold')
          const threshold = thresholdParam ? parseFloat(thresholdParam) : undefined
          const groups = deps.taotie.detectSimilarSkills(threshold)
          json(res, { groups })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/taotie-analyze — 配对分析
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/taotie-analyze',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          if (!deps.taotie) { json(res, { error: 'Taotie fusion not available' }, 503); return }
          const body = await parseBody(req)
          const { target, source } = body
          if (!target || !source) {
            json(res, { error: 'target and source are required' }, 400)
            return
          }
          const report = await deps.taotie.analyzePair(target, source)
          json(res, { report })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/taotie-start — 启动融合
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/taotie-start',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          if (!deps.taotie) { json(res, { error: 'Taotie fusion not available' }, 503); return }
          const body = await parseBody(req)
          const { target, source, autoApprove } = body
          if (!target || !source) {
            json(res, { error: 'target and source are required' }, 400)
            return
          }
          const result = await deps.taotie.startFusion(target, source, autoApprove ?? false)
          json(res, result)
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // GET /api/skill-forge/taotie-status — 查看融合进度
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/taotie-status',
      handler: (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return }
        try {
          if (!deps.taotie) { json(res, { error: 'Taotie fusion not available' }, 503); return }
          const url = new URL(req.url!, `http://${req.headers.host}`)
          const runId = url.searchParams.get('runId')
          if (!runId) {
            // 返回最近的运行列表
            const limit = parseInt(url.searchParams.get('limit') || '20')
            json(res, { runs: deps.taotie.listRuns(limit) })
            return
          }
          const run = deps.taotie.getRunStatus(runId)
          if (!run) {
            json(res, { error: 'Run not found' }, 404)
            return
          }
          json(res, { run })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/taotie-approve — 批准当前步骤继续
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/taotie-approve',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          if (!deps.taotie) { json(res, { error: 'Taotie fusion not available' }, 503); return }
          const body = await parseBody(req)
          const { runId, step } = body
          if (!runId) {
            json(res, { error: 'runId is required' }, 400)
            return
          }
          const ok = await deps.taotie.approveStep(runId, step)
          json(res, { ok })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // POST /api/skill-forge/taotie-stop — 停止融合
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/taotie-stop',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.writeHead(405).end(); return }
        try {
          if (!deps.taotie) { json(res, { error: 'Taotie fusion not available' }, 503); return }
          const body = await parseBody(req)
          const { runId } = body
          if (!runId) {
            json(res, { error: 'runId is required' }, 400)
            return
          }
          const ok = deps.taotie.stopRun(runId)
          json(res, { ok })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },

    // GET /api/skill-forge/taotie-patterns — 获取全局模式库
    {
      kind: 'exact' as const,
      path: '/api/skill-forge/taotie-patterns',
      handler: (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') { res.writeHead(405).end(); return }
        try {
          if (!deps.taotie) { json(res, { error: 'Taotie fusion not available' }, 503); return }
          const patterns = deps.taotie.getGlobalPatterns()
          json(res, { patterns })
        } catch (e) {
          json(res, { error: (e as Error).message }, 500)
        }
      },
    },
  ]

  // 注册路由（需要 ctx.webServer 的引用）
  // 这些路由会在 apply 函数里通过 ctx.webServer.register 注册
  return {
    unregister: () => {
      // 路由注册的 disposer 在 apply 里管理
    },
  }
}

/** 路由定义常量，供 apply 函数使用 */
export const FORGE_ROUTES = [
  { kind: 'exact' as const, path: '/api/skill-forge/queue' },
  { kind: 'exact' as const, path: '/api/skill-forge/skills' },
  { kind: 'exact' as const, path: '/api/skill-forge/skills/top' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-detail' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-versions' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-version' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-rollback' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-unarchive' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-reforge' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-usage' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-feedback' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-update' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-delete' },
  { kind: 'exact' as const, path: '/api/skill-forge/stats' },
  { kind: 'exact' as const, path: '/api/skill-forge/stats/detail' },
  { kind: 'exact' as const, path: '/api/skill-forge/stats/trigger' },
  { kind: 'exact' as const, path: '/api/skill-forge/trigger' },
  { kind: 'exact' as const, path: '/api/skill-forge/approve' },
  { kind: 'exact' as const, path: '/api/skill-forge/reject' },
  { kind: 'exact' as const, path: '/api/skill-forge/cancel' },
  { kind: 'exact' as const, path: '/api/skill-forge/retry' },
  { kind: 'exact' as const, path: '/api/skill-forge/archive' },
  { kind: 'exact' as const, path: '/api/skill-forge/unarchive' },
  { kind: 'exact' as const, path: '/api/skill-forge/config' },
  { kind: 'exact' as const, path: '/api/skill-forge/file-tree' },
  { kind: 'exact' as const, path: '/api/skill-forge/open-file' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-lineage' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-diff' },
  { kind: 'exact' as const, path: '/api/skill-forge/skill-related' },
  { kind: 'exact' as const, path: '/api/skill-forge/workspace-info' },
  // 饕餮模式
  { kind: 'exact' as const, path: '/api/skill-forge/taotie-detect' },
  { kind: 'exact' as const, path: '/api/skill-forge/taotie-analyze' },
  { kind: 'exact' as const, path: '/api/skill-forge/taotie-start' },
  { kind: 'exact' as const, path: '/api/skill-forge/taotie-status' },
  { kind: 'exact' as const, path: '/api/skill-forge/taotie-approve' },
  { kind: 'exact' as const, path: '/api/skill-forge/taotie-stop' },
  { kind: 'exact' as const, path: '/api/skill-forge/taotie-patterns' },
  // 达尔文模式
  { kind: 'exact' as const, path: '/api/skill-forge/darwin-start' },
  { kind: 'exact' as const, path: '/api/skill-forge/darwin-status' },
  { kind: 'exact' as const, path: '/api/skill-forge/darwin-approve' },
  { kind: 'exact' as const, path: '/api/skill-forge/darwin-reject' },
  { kind: 'exact' as const, path: '/api/skill-forge/darwin-stop' },
  { kind: 'exact' as const, path: '/api/skill-forge/darwin-runs' },
  // 技能编排
  { kind: 'exact' as const, path: '/api/skill-forge/orchestrate' },
  { kind: 'exact' as const, path: '/api/skill-forge/orchestrator/stats' },
  // Dreaming 闲时锻造
  { kind: 'exact' as const, path: '/api/skill-forge/dreaming/start' },
  { kind: 'exact' as const, path: '/api/skill-forge/dreaming/stop' },
  { kind: 'exact' as const, path: '/api/skill-forge/dreaming/status' },
  { kind: 'exact' as const, path: '/api/skill-forge/dreaming/history' },
  { kind: 'exact' as const, path: '/api/skill-forge/dreaming/health-report' },
]

/**
 * 构建文件树
 * @param dirPath 目录路径
 * @param showHidden 是否显示隐藏文件
 * @param maxDepth 最大深度
 */
function buildFileTree(dirPath: string, showHidden: boolean, maxDepth: number): Array<{
  name: string
  type: 'file' | 'directory'
  path: string
  children?: any[]
}> {
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
