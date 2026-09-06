/**
 * API Client —— 从浏览器端调用 Host 端的 HTTP API
 */

const API_BASE = '/api/skill-forge'

async function request(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  // 队列
  getQueue: (limit = 20) => request(`/queue?limit=${limit}`),

  // 技能列表（支持搜索筛选）
  getSkills: (params?: { search?: string; status?: string; category?: string; sort?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.status) qs.set('status', params.status)
    if (params?.category) qs.set('category', params.category)
    if (params?.sort) qs.set('sort', params.sort)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const qsStr = qs.toString()
    return request(`/skills${qsStr ? `?${qsStr}` : ''}`)
  },

  // 技能详情
  getSkillDetail: (name: string) => request(`/skill-detail?name=${encodeURIComponent(name)}`),

  // 版本历史
  getSkillVersions: (name: string) => request(`/skill-versions?name=${encodeURIComponent(name)}`),

  // 指定版本内容
  getSkillVersion: (name: string, version: string) =>
    request(`/skill-version?name=${encodeURIComponent(name)}&version=${encodeURIComponent(version)}`),

  // 统计
  getStats: () => request('/stats'),
  getStatsDetail: () => request('/stats/detail'),

  // 锻造
  triggerForge: (reason: string) => request('/trigger', { method: 'POST', body: JSON.stringify({ reason }) }),
  approveSkill: (runId: string) => request('/approve', { method: 'POST', body: JSON.stringify({ runId }) }),
  rejectSkill: (runId: string, reasons: string[], customText?: string) =>
    request('/reject', { method: 'POST', body: JSON.stringify({ runId, reasons, customText }) }),
  cancelForge: (runId: string) => request('/cancel', { method: 'POST', body: JSON.stringify({ runId }) }),
  retryForge: (runId: string) => request('/retry', { method: 'POST', body: JSON.stringify({ runId }) }),

  // 技能操作
  archiveSkill: (name: string) => request('/archive', { method: 'POST', body: JSON.stringify({ name }) }),
  unarchiveSkill: (name: string) => request('/skill-unarchive', { method: 'POST', body: JSON.stringify({ name }) }),
  rollbackSkill: (name: string, version: string, reason?: string) =>
    request('/skill-rollback', { method: 'POST', body: JSON.stringify({ name, version, reason }) }),
  deleteSkill: (name: string) =>
    request(`/skill-delete?name=${encodeURIComponent(name)}`, { method: 'DELETE' }),
  reforgeSkill: (name: string, reason?: string) =>
    request('/skill-reforge', { method: 'POST', body: JSON.stringify({ name, reason }) }),
  updateSkill: (name: string, data: { frontmatter?: any; body?: string; changelog?: string }) =>
    request('/skill-update', { method: 'PUT', body: JSON.stringify({ name, ...data }) }),
  recordUsage: (name: string) =>
    request('/skill-usage', { method: 'POST', body: JSON.stringify({ name }) }),

  // 使用反馈
  recordFeedback: (name: string, rating: 'helpful' | 'neutral' | 'harmful', comment?: string) =>
    request('/skill-feedback', { method: 'POST', body: JSON.stringify({ name, rating, comment }) }),

  // 版本 diff 对比
  getSkillDiff: (name: string, from: string, to: string) =>
    request(`/skill-diff?name=${encodeURIComponent(name)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  // 谱系追踪
  getSkillLineage: (name: string) => request(`/skill-lineage?name=${encodeURIComponent(name)}`),

  // 相关技能推荐
  getRelatedSkills: (name: string, limit = 5) =>
    request(`/skill-related?name=${encodeURIComponent(name)}&limit=${limit}`),

  // 配置
  getConfig: () => request('/config'),
  updateConfig: (config: any) => request('/config', { method: 'PUT', body: JSON.stringify(config) }),

  // 文件
  getFileTree: (path: string, showHidden: boolean) =>
    request('/file-tree', { method: 'POST', body: JSON.stringify({ path, showHidden }) }),
  openFile: (path: string) =>
    request('/open-file', { method: 'POST', body: JSON.stringify({ path }) }),
  getWorkspaceInfo: () => request('/workspace-info'),

  // ===== 达尔文模式 =====
  darwinStart: (skillName: string, targetDimensions?: string[], autoApprove?: boolean) =>
    request('/darwin-start', { method: 'POST', body: JSON.stringify({ skillName, targetDimensions, autoApprove }) }),
  darwinStatus: (runId: string) =>
    request(`/darwin-status?runId=${encodeURIComponent(runId)}`),
  darwinApprove: (runId: string, dimension: string) =>
    request('/darwin-approve', { method: 'POST', body: JSON.stringify({ runId, dimension }) }),
  darwinReject: (runId: string, dimension: string, reason?: string) =>
    request('/darwin-reject', { method: 'POST', body: JSON.stringify({ runId, dimension, reason }) }),
  darwinStop: (runId: string) =>
    request('/darwin-stop', { method: 'POST', body: JSON.stringify({ runId }) }),
  darwinRuns: (limit = 20) =>
    request(`/darwin-runs?limit=${limit}`),

  // ===== 饕餮模式 =====
  taotieDetect: (threshold?: number) =>
    request(`/taotie-detect${threshold !== undefined ? `?threshold=${threshold}` : ''}`),
  taotieAnalyze: (target: string, source: string) =>
    request('/taotie-analyze', { method: 'POST', body: JSON.stringify({ target, source }) }),
  taotieStart: (target: string, source: string, autoApprove?: boolean) =>
    request('/taotie-start', { method: 'POST', body: JSON.stringify({ target, source, autoApprove }) }),
  taotieStatus: (runId: string) =>
    request(`/taotie-status?runId=${encodeURIComponent(runId)}`),
  taotieApprove: (runId: string, stepIndex?: number) =>
    request('/taotie-approve', { method: 'POST', body: JSON.stringify({ runId, stepIndex }) }),
  taotieStop: (runId: string) =>
    request('/taotie-stop', { method: 'POST', body: JSON.stringify({ runId }) }),
  taotiePatterns: () =>
    request('/taotie-patterns'),

  // ===== CoEvo 共进化模式 =====
  coevoStart: (skillName: string, options?: { autoApprove?: boolean; maxRounds?: number; targetSkillScore?: number; targetTestStrength?: number }) =>
    request('/coevo-start', { method: 'POST', body: JSON.stringify({ skillName, ...options }) }),
  coevoStatus: (runId: string) =>
    request(`/coevo-status?runId=${encodeURIComponent(runId)}`),
  coevoApprove: (runId: string) =>
    request('/coevo-approve', { method: 'POST', body: JSON.stringify({ runId }) }),
  coevoReject: (runId: string, reason?: string) =>
    request('/coevo-reject', { method: 'POST', body: JSON.stringify({ runId, reason }) }),
  coevoStop: (runId: string, reason?: string) =>
    request('/coevo-stop', { method: 'POST', body: JSON.stringify({ runId, reason }) }),
  coevoRuns: (limit = 20) =>
    request(`/coevo-runs?limit=${limit}`),

  // ===== 技能编排 =====
  orchestrateTask: (query: string, mode?: 'fast' | 'llm' | 'auto') =>
    request('/orchestrate', { method: 'POST', body: JSON.stringify({ task: query, mode }) }),
  orchestratorStats: () =>
    request('/orchestrator/stats'),

  // ===== Dreaming 闲时锻造 =====
  dreamingStart: (triggerType: 'manual' | 'scheduled' | 'idle' = 'manual') =>
    request('/dreaming/start', { method: 'POST', body: JSON.stringify({ triggerType }) }),
  dreamingStop: (reason?: string) =>
    request('/dreaming/stop', { method: 'POST', body: JSON.stringify({ reason }) }),
  dreamingStatus: () =>
    request('/dreaming/status'),
  dreamingHistory: (limit = 20) =>
    request(`/dreaming/history?limit=${limit}`),
  dreamingHealthReport: () =>
    request('/dreaming/health-report'),
}
