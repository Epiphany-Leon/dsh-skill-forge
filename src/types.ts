/**
 * dsh-skill-forge — 类型定义
 *
 * 所有核心数据结构的 TypeScript 定义。
 * 与 PLAN 附录 B 的接口设计保持一致。
 */

// ============================================================
// 枚举类型
// ============================================================

/** 锻造任务状态 —— 对应 ForgeRun 状态机 */
export enum ForgeRunStatus {
  CREATED = 'created',
  TRIGGERING = 'triggering',
  TRIGGER_SKIPPED = 'trigger_skipped',
  EXTRACTING = 'extracting',
  EXTRACTION_FAILED = 'extraction_failed',
  GENERATING = 'generating',
  GENERATION_FAILED = 'generation_failed',
  VERIFYING = 'verifying',
  ITERATING = 'iterating',
  AUDITING = 'auditing',
  AUDIT_FAILED = 'audit_failed',
  PENDING_APPROVAL = 'pending_approval',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** 技能状态 —— 对应 Skill 状态机 */
export enum SkillStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DEPRECATED = 'deprecated',
}

/** 安全等级 */
export enum SecurityLevel {
  STRICT = 'strict',
  NORMAL = 'normal',
  PERMISSIVE = 'permissive',
  AUTO = 'auto',
}

/** 触发模式 */
export enum TriggerMode {
  AUTO = 'auto',       // 自动检测触发
  MANUAL = 'manual',   // 用户手动触发
  BATCH = 'batch',     // 批量锻造
}

/** 失败原因代码 */
export enum FailureCode {
  TRIGGER_THRESHOLD_NOT_MET = 'E001',
  EXTRACTION_LLM_ERROR = 'E101',
  EXTRACTION_SCHEMA_INVALID = 'E102',
  GENERATION_LLM_ERROR = 'E201',
  GENERATION_FORMAT_INVALID = 'E202',
  VERIFICATION_TEST_FAILED = 'E301',
  VERIFICATION_TIMEOUT = 'E302',
  ITERATION_MAX_REACHED = 'E401',
  AUDIT_DANGEROUS_PATTERN = 'E501',
  AUDIT_DUPLICATE = 'E502',
  USER_REJECTED = 'E601',
}

// ============================================================
// 核心数据结构
// ============================================================

/** 技能元数据 —— 对应 SKILL.md frontmatter */
export interface SkillFrontmatter {
  name: string
  description: string
  whenToUse: string
  version: string
  tags?: string[]
  author?: string
  source?: 'forged' | 'manual' | 'imported'
  forgedFrom?: string[]  // 来源对话 ID
  /** 分类标签，用于搜索筛选 */
  category?: string
  /** 最近一次验证得分（0-1） */
  qualityScore?: number
  /** 来源锻造记录 ID */
  forgedFromRunId?: string
  /** 使用次数（运行时+持久化） */
  usageCount?: number
  /** 最后使用时间戳 */
  lastUsedAt?: number
  /** 反馈统计：有用次数 */
  feedbackHelpful?: number
  /** 反馈统计：无用次数 */
  feedbackHarmful?: number
  /** 反馈统计：一般次数 */
  feedbackNeutral?: number
  /** 反馈总次数 */
  feedbackCount?: number
  /** 反馈归一化得分（-1 到 1） */
  feedbackScore?: number
  /** 累计正反馈次数（显式 + 隐式） */
  positiveFeedbacks?: number
  /** 累计负反馈次数（显式 + 隐式） */
  negativeFeedbacks?: number
  /** 上次衰减时间戳（用于日衰减） */
  lastDecayAt?: number
}

/** 技能版本历史条目 */
export interface SkillVersionEntry {
  version: string
  timestamp: number
  changelog?: string
  /** 版本文件相对路径（相对于技能目录/versions/） */
  file: string
}

/** 技能实体 */
export interface Skill {
  id: string
  frontmatter: SkillFrontmatter
  body: string           // SKILL.md 正文
  status: SkillStatus
  createdAt: number
  updatedAt: number
  forgeRunId?: string    // 关联的锻造任务
  verificationScore?: number
  usageCount: number
  lastUsedAt?: number
  /** 反馈统计：有用次数 */
  feedbackHelpful: number
  /** 反馈统计：无用次数 */
  feedbackHarmful: number
  /** 反馈统计：一般次数 */
  feedbackNeutral: number
  /** 反馈总次数 */
  feedbackCount: number
  /** 反馈归一化得分（-1 到 1） */
  feedbackScore: number
  /** 累计正反馈次数（显式 + 隐式） */
  positiveFeedbacks: number
  /** 累计负反馈次数（显式 + 隐式） */
  negativeFeedbacks: number
  /** 上次衰减时间戳（用于日衰减） */
  lastDecayAt?: number
  parentSkillId?: string // 版本化：父技能 ID
  version: string
}

/** 失败原因 */
export interface FailureReason {
  code: FailureCode | string
  message: string
  detail?: string
  gate: number  // 失败在第几道质量门
}

/** 锻造任务 —— 对应 ForgeRun */
export interface ForgeRun {
  id: string
  status: ForgeRunStatus
  triggerMode: TriggerMode
  sourceSessionIds: string[]
  sourceSummary: string

  // 各阶段产物
  extractionResult?: ExtractionResult
  generatedSkill?: GeneratedSkill
  verificationResult?: VerificationResult
  auditResult?: AuditResult
  rejectionReason?: RejectionReason

  // 迭代信息
  currentIteration: number
  maxIterations: number
  iterationHistory: { iteration: number; score: number; changes: string }[]

  // 时间戳
  createdAt: number
  updatedAt: number
  completedAt?: number

  // 最终质量得分（验证通过后的 overallScore 快照）
  qualityScore?: number

  // 失败信息
  failureReason?: FailureReason
}

/** 提取结果 */
export interface ExtractionResult {
  methodName: string
  corePatterns: string[]
  keySteps: string[]
  applicableScenarios: string[]
  toolsUsed: string[]
  confidence: number
}

/** 生成的技能草稿 */
export interface GeneratedSkill {
  frontmatter: SkillFrontmatter
  body: string
  qualityScore?: number
}

/** 质量评估维度 */
export enum QualityDimension {
  STRUCTURAL_COMPLETENESS = 'structural_completeness',
  LOGICAL_CONSISTENCY = 'logical_consistency',
  OPERATIONALITY = 'operationality',
  PRACTICALITY = 'practicality',
  SECURITY = 'security',
}

/** 质量维度中文映射 */
export const QUALITY_DIMENSION_LABELS: Record<QualityDimension, string> = {
  [QualityDimension.STRUCTURAL_COMPLETENESS]: '结构完整性',
  [QualityDimension.LOGICAL_CONSISTENCY]: '逻辑一致性',
  [QualityDimension.OPERATIONALITY]: '可操作性',
  [QualityDimension.PRACTICALITY]: '实用性',
  [QualityDimension.SECURITY]: '安全性',
}

/** 质量维度权重 */
export const QUALITY_DIMENSION_WEIGHTS: Record<QualityDimension, number> = {
  [QualityDimension.STRUCTURAL_COMPLETENESS]: 0.15,
  [QualityDimension.LOGICAL_CONSISTENCY]: 0.2,
  [QualityDimension.OPERATIONALITY]: 0.25,
  [QualityDimension.PRACTICALITY]: 0.25,
  [QualityDimension.SECURITY]: 0.15,
}

/** 单个测试问题 */
export interface TestIssue {
  severity: 'critical' | 'major' | 'minor' | 'info'
  description: string
  location?: string
  suggestion?: string
}

/** 验证结果 */
export interface VerificationResult {
  totalTests: number
  passedTests: number
  failedTests: number
  testResults: TestResult[]
  overallScore: number
  passed: boolean
  /** 各维度得分（维度 -> 得分 0-1） */
  dimensions: Record<QualityDimension, number>
  /** 改进建议列表 */
  improvementSuggestions: string[]
  /** 失败模式分类（模式名 -> 出现次数） */
  failurePatterns: Record<string, number>
}

/** 单个测试结果 */
export interface TestResult {
  testId: string
  testName: string
  /** 所属质量维度 */
  category: QualityDimension
  passed: boolean
  /** 该测试项得分（0-1） */
  score: number
  output?: string
  error?: string
  duration: number
  /** 评估反馈 */
  feedback?: string
  /** 发现的问题列表 */
  issues: TestIssue[]
}

/** 审计结果 */
export interface AuditResult {
  passed: boolean
  warnings: string[]
  dangers: string[]
  duplicateOf?: string  // 重复的技能 ID
  similarityScore?: number
}

/** 拒绝理由 */
export interface RejectionReason {
  presetReasons: string[]   // 预设原因的 key
  customText?: string
  timestamp: number
}

// ============================================================
// 配置
// ============================================================

/** 插件配置 */
export interface SkillForgeConfig {
  /** 安全等级 */
  securityLevel: 'strict' | 'normal' | 'permissive' | 'auto'
  /** 是否启用自动触发 */
  autoTrigger: boolean
  /** 自动触发的置信度阈值（0-1） */
  triggerThreshold: number
  /** 最大迭代轮数 */
  maxIterations: number
  /** 验证通过率阈值（0-1） */
  verificationPassThreshold: number
  /** 技能数量提醒阈值 */
  skillCountAlertThreshold: number
  /** Token 预算占比（0-1） */
  tokenBudgetRatio: number
  /** 技能注入模式：all = 全部注册（兼容旧行为），smart = 智能动态注入 */
  injectionMode: 'all' | 'smart'
  /** 智能注入时每轮对话的 token 预算上限（字符数估算，0 = 按 ratio 自动计算） */
  injectionTokenBudget: number
  /** 智能注入的最低相关度阈值（0-1），低于此分的技能不注入 */
  injectionRelevanceThreshold: number
  /** 是否启用闲时锻造 */
  enableDreaming: boolean
  /** 闲时锻造调度（cron 表达式） */
  dreamingSchedule: string
  /** 自定义危险模式列表 */
  customDangerousPatterns: string[]
  /** 是否启用增量式经验积累（默认 true） */
  enableIncrementalAccumulation: boolean
  /** 密度阈值（复杂度分/小时），超过则立即触发锻造 */
  densityThreshold: number
  /** 同一会话两次锻造之间的最小间隔（分钟） */
  minForgingIntervalMinutes: number
  /** idle 触发兜底时的最低密度阈值（0-1） */
  idleDensityThreshold: number
  /** 是否启用意图感知召回 */
  enableIntentAware: boolean
  /** 意图分析的最小字符数，低于此值不分析以节省 token */
  intentAnalysisMinChars: number
  /** 是否启用奖励驱动的技能进化（隐式反馈 + 权重自调整） */
  enableRewardLearning: boolean
  /** 隐式反馈观察窗口（轮数），技能注入后追踪多少轮对话判断效果 */
  implicitFeedbackWindow: number
  /** 隐式反馈正反馈调整幅度（每次 +值，上限 1.0） */
  implicitPositiveStep: number
  /** 隐式反馈负反馈调整幅度（每次 -值，下限 -1.0） */
  implicitNegativeStep: number
  /** 显式反馈是隐式反馈的倍数（用户手动点赞权重更高） */
  explicitFeedbackMultiplier: number
  /** 每日衰减比例（向 0 回归的比例，0-1） */
  dailyDecayRate: number
  /** 反馈分在智能注入评分中的权重 */
  feedbackScoreWeight: number
  /** 使用频率在智能注入评分中的权重 */
  usageScoreWeight: number
}

/** 默认配置 */
export const DEFAULT_CONFIG: SkillForgeConfig = {
  securityLevel: 'normal',
  autoTrigger: true,
  triggerThreshold: 0.7,
  maxIterations: 3,
  verificationPassThreshold: 0.9,
  skillCountAlertThreshold: 30,
  tokenBudgetRatio: 0.1,
  injectionMode: 'all',
  injectionTokenBudget: 0,
  injectionRelevanceThreshold: 0.2,
  enableDreaming: false,
  dreamingSchedule: '0 3 * * 0',  // 每周日凌晨 3 点
  customDangerousPatterns: [],
  enableIncrementalAccumulation: true,
  densityThreshold: 2.0,
  minForgingIntervalMinutes: 30,
  idleDensityThreshold: 0.5,
  enableIntentAware: true,
  intentAnalysisMinChars: 20,
  enableRewardLearning: true,
  implicitFeedbackWindow: 3,
  implicitPositiveStep: 0.1,
  implicitNegativeStep: 0.15,
  explicitFeedbackMultiplier: 3,
  dailyDecayRate: 0.05,
  feedbackScoreWeight: 0.15,
  usageScoreWeight: 0.1,
}

// ============================================================
// 事件定义
// ============================================================

/** 锻造事件类型 */
export enum ForgeEventType {
  FORGE_STARTED = 'forge:started',
  FORGE_STATUS_CHANGED = 'forge:status-changed',
  FORGE_COMPLETED = 'forge:completed',
  FORGE_FAILED = 'forge:failed',
  SKILL_FORGED = 'skill:forged',
  SKILL_APPROVED = 'skill:approved',
  SKILL_REJECTED = 'skill:rejected',
  SKILL_ARCHIVED = 'skill:archived',
}

/** 锻造事件 payload */
export interface ForgeEventMap {
  [ForgeEventType.FORGE_STARTED]: { runId: string; mode: TriggerMode }
  [ForgeEventType.FORGE_STATUS_CHANGED]: { runId: string; status: ForgeRunStatus; prevStatus: ForgeRunStatus }
  [ForgeEventType.FORGE_COMPLETED]: { runId: string; skillId: string }
  [ForgeEventType.FORGE_FAILED]: { runId: string; reason: FailureReason }
  [ForgeEventType.SKILL_FORGED]: { skillId: string; runId: string }
  [ForgeEventType.SKILL_APPROVED]: { skillId: string }
  [ForgeEventType.SKILL_REJECTED]: { skillId: string; reason: RejectionReason }
  [ForgeEventType.SKILL_ARCHIVED]: { skillId: string }
}

// ============================================================
// 增量式经验积累
// ============================================================

/** 单轮对话的经验痕迹（turn/end 时提取） */
export interface ExperienceTrace {
  /** 本轮工具调用数 */
  toolCallsCount: number
  /** 是否有报错→修复的模式 */
  hasErrorFix: boolean
  /** 是否尝试了新的方法/思路（基于工具多样性变化粗判） */
  hasNewApproach: boolean
  /** 是否有多轮迭代优化（连续多轮且工具调用持续） */
  hasIteration: boolean
  /** 本轮复杂度评分（0-1） */
  complexityScore: number
  /** 时间戳 */
  timestamp: number
}

/** 触发引擎运行时统计 */
export interface TriggerEngineStats {
  /** 增量触发次数（密度阈值触发） */
  incrementalTriggers: number
  /** idle 触发次数 */
  idleTriggers: number
  /** 当前追踪的会话数 */
  trackedSessions: number
}

// ============================================================
// 意图识别
// ============================================================

/** 意图类型 */
export type IntentType =
  | 'debugging'
  | 'feature-development'
  | 'refactoring'
  | 'code-review'
  | 'testing'
  | 'documentation'
  | 'planning'
  | 'research'
  | 'other'

/** 意图分析结果 */
export interface IntentAnalysisResult {
  intent: IntentType
  confidence: number
  keywords: string[]
}
