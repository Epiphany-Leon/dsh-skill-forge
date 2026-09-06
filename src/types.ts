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
  /** 饕餮模式：已验证的成功改进模式库 */
  patterns?: Array<{
    id: string
    name: string
    description: string
    effect: string[]
    appliedCount: number
    createdAt: number
  }>
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

// ============================================================
// 达尔文模式：9 维度扩展评估
// ============================================================

/** 达尔文模式评估维度（在基础 5 维度之上扩展为 9 维度） */
export enum DarwinDimension {
  STRUCTURAL_COMPLETENESS = 'structural_completeness',
  LOGICAL_CONSISTENCY = 'logical_consistency',
  OPERATIONALITY = 'operationality',
  PRACTICALITY = 'practicality',
  SECURITY = 'security',
  FRONTMATTER_COMPLETENESS = 'frontmatter_completeness',
  TRIGGER_QUALITY = 'trigger_quality',
  TOOL_CALL_CONFORMITY = 'tool_call_conformity',
  VERIFICATION_COMPLETENESS = 'verification_completeness',
  CROSS_SCENARIO_VERSATILITY = 'cross_scenario_versatility',
}

/** 达尔文维度中文标签 */
export const DARWIN_DIMENSION_LABELS: Record<DarwinDimension, string> = {
  [DarwinDimension.STRUCTURAL_COMPLETENESS]: '结构完整性',
  [DarwinDimension.LOGICAL_CONSISTENCY]: '逻辑一致性',
  [DarwinDimension.OPERATIONALITY]: '可操作性',
  [DarwinDimension.PRACTICALITY]: '实用性',
  [DarwinDimension.SECURITY]: '安全性',
  [DarwinDimension.FRONTMATTER_COMPLETENESS]: 'Frontmatter 完整性',
  [DarwinDimension.TRIGGER_QUALITY]: '触发短语质量',
  [DarwinDimension.TOOL_CALL_CONFORMITY]: '工具调用规范',
  [DarwinDimension.VERIFICATION_COMPLETENESS]: '验证完备性',
  [DarwinDimension.CROSS_SCENARIO_VERSATILITY]: '跨场景通用性',
}

/** 达尔文维度权重（9 维度） */
export const DARWIN_DIMENSION_WEIGHTS: Record<DarwinDimension, number> = {
  [DarwinDimension.STRUCTURAL_COMPLETENESS]: 0.1,
  [DarwinDimension.LOGICAL_CONSISTENCY]: 0.12,
  [DarwinDimension.OPERATIONALITY]: 0.15,
  [DarwinDimension.PRACTICALITY]: 0.15,
  [DarwinDimension.SECURITY]: 0.12,
  [DarwinDimension.FRONTMATTER_COMPLETENESS]: 0.1,
  [DarwinDimension.TRIGGER_QUALITY]: 0.1,
  [DarwinDimension.TOOL_CALL_CONFORMITY]: 0.08,
  [DarwinDimension.VERIFICATION_COMPLETENESS]: 0.08,
  [DarwinDimension.CROSS_SCENARIO_VERSATILITY]: 0.1,
}

/** 达尔文模式运行状态 */
export enum DarwinRunStatus {
  CREATED = 'created',
  INITIAL_EVALUATING = 'initial_evaluating',
  OPTIMIZING = 'optimizing',
  PENDING_APPROVAL = 'pending_approval',
  RUNNING = 'running',
  COMPLETED = 'completed',
  STOPPED = 'stopped',
  FAILED = 'failed',
}

/** 达尔文模式单轮优化历史 */
export interface DarwinOptimizationHistoryEntry {
  /** 轮次（从 1 开始） */
  iteration: number
  /** 本轮优化的目标维度 */
  targetDimension: DarwinDimension
  /** 优化前该维度得分 */
  scoreBefore: number
  /** 优化后该维度得分 */
  scoreAfter: number
  /** 优化前总体得分 */
  overallBefore: number
  /** 优化后总体得分 */
  overallAfter: number
  /** 变更描述 */
  changeDescription: string
  /** 是否被接受（分数提升） */
  accepted: boolean
  /** 回退原因（若未被接受） */
  rollbackReason?: string
  /** 时间戳 */
  timestamp: number
}

/** 达尔文模式运行记录 */
export interface DarwinRun {
  id: string
  skillName: string
  skillId: string
  status: DarwinRunStatus
  /** 目标维度列表；为空表示自动选择所有低分维度 */
  targetDimensions: DarwinDimension[]
  /** 是否自动批准（无人在回路） */
  autoApprove: boolean
  /** 当前轮次（已完成的轮次） */
  currentIteration: number
  /** 最大轮次 */
  maxIterations: number
  /** 高分阈值（达到此分数视为合格） */
  highScoreThreshold: number
  /** 初始 9 维度得分 */
  initialScores: Record<DarwinDimension, number> | null
  /** 当前最新 9 维度得分 */
  currentScores: Record<DarwinDimension, number> | null
  /** 初始总体得分 */
  initialOverallScore: number | null
  /** 当前总体得分 */
  currentOverallScore: number | null
  /** 优化历史（每轮一条） */
  history: DarwinOptimizationHistoryEntry[]
  /** 连续无提升轮数 */
  stagnationCount: number
  /** 待批准的当前轮结果（人在回路模式） */
  pendingApproval?: {
    iteration: number
    targetDimension: DarwinDimension
    scoreBefore: number
    scoreAfter: number
    overallBefore: number
    overallAfter: number
    changeDescription: string
    /** 优化后的技能内容（批准后写入） */
    proposedSkill: GeneratedSkill
    /** 优化后的 9 维度得分 */
    proposedScores: Record<DarwinDimension, number>
    timestamp: number
  }
  createdAt: number
  updatedAt: number
  completedAt?: number
  /** 失败原因 */
  failureReason?: string
  /** 终止原因 */
  stopReason?: string
}

/** 达尔文模式配置项 */
export interface DarwinConfig {
  darwinMaxIterations: number
  darwinHighScoreThreshold: number
  darwinAutoApprove: boolean
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
  // ---- 饕餮模式 ----
  /** 是否启用饕餮模式 */
  taotieEnabled: boolean
  /** 相似技能检测阈值（0-1），高于此分的技能对被视为相似 */
  taotieSimilarityThreshold: number
  /** 每次融合的最大注入步骤数 */
  taotieMaxInjectionSteps: number
  /** 最小提升阈值（0-1），低于此值的注入视为无收益，回滚 */
  taotieMinImprovementThreshold: number
  // ---- 达尔文模式 ----
  /** 达尔文模式最大迭代轮数 */
  darwinMaxIterations: number
  /** 达尔文模式高分阈值（0-1），达到视为该维度合格 */
  darwinHighScoreThreshold: number
  /** 达尔文模式是否自动批准（无人在回路，默认需要人确认） */
  darwinAutoApprove: boolean
  // ---- Dreaming 闲时锻造模式 ----
  /** 空闲多久后触发 Dreaming（分钟），0 表示禁用空闲触发 */
  dreamingIdleThresholdMinutes: number
  /** Dreaming 运行时的最大并发优化任务数 */
  dreamingMaxConcurrentOptimizations: number
  /** Dreaming 中自动启动达尔文优化的最低分阈值（0 = 不自动优化） */
  dreamingAutoOptimizeThreshold: number
  /** Dreaming 中是否自动启动饕餮融合（相似技能组） */
  dreamingAutoFusion: boolean
  /** Dreaming 中自动归档的阈值：多少天未使用则归档（0 = 不自动归档） */
  dreamingAutoArchiveDays: number
  /** Dreaming 生成的改进建议数量上限 */
  dreamingMaxSuggestions: number
  /** Dreaming 模式下达尔文优化是否自动批准（无人在回路） */
  dreamingDarwinAutoApprove: boolean
  /** Dreaming 模式下饕餮融合是否自动批准（无人在回路） */
  dreamingTaotieAutoApprove: boolean
  // ---- CoEvo 共进化模式 ----
  /** 是否启用 CoEvo 共进化验证模式 */
  coevoEnabled: boolean
  /** CoEvo 最大共进化轮数 */
  coevoMaxRounds: number
  /** CoEvo 技能目标质量分（0-1） */
  coevoTargetSkillScore: number
  /** CoEvo 测试套件目标强度（0-1） */
  coevoTargetTestStrength: number
  /** CoEvo 初始生成的对抗性测试用例数量 */
  coevoInitialTestCount: number
  /** CoEvo 最大测试用例数量上限 */
  coevoMaxTestCases: number
  /** CoEvo 每轮测试进化时新增的测试用例数 */
  coevoTestsPerRound: number
  /** CoEvo 是否自动批准 */
  coevoAutoApprove: boolean
  /** CoEvo 测试用例淘汰阈值（通过率高于此值的用例被视为太弱，淘汰） */
  coevoTestPruneThreshold: number
  // ---- 技能编排（Skill Orchestrator） ----
  /** 是否启用技能组合编排（多技能工作流） */
  orchestrationEnabled: boolean
  /** 任务分解模式：fast 启发式 / llm 深度分解 / auto 自动选择 */
  orchestrationDecomposeMode: 'fast' | 'llm' | 'auto'
  /** 技能匹配最低阈值（0-1），低于此分的技能不视为匹配 */
  orchestrationMatchThreshold: number
  /** 编排工作流注入的最大技能数（防止 token 爆炸） */
  orchestrationMaxSkills: number
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
  // 饕餮模式
  taotieEnabled: true,
  taotieSimilarityThreshold: 0.4,
  taotieMaxInjectionSteps: 5,
  taotieMinImprovementThreshold: 0.02,
  // 达尔文模式
  darwinMaxIterations: 10,
  darwinHighScoreThreshold: 0.85,
  darwinAutoApprove: false,
  // Dreaming 闲时锻造
  dreamingIdleThresholdMinutes: 0,
  dreamingMaxConcurrentOptimizations: 2,
  dreamingAutoOptimizeThreshold: 0.0,
  dreamingAutoFusion: false,
  dreamingAutoArchiveDays: 0,
  dreamingMaxSuggestions: 10,
  dreamingDarwinAutoApprove: true,
  dreamingTaotieAutoApprove: false,
  // CoEvo 共进化模式
  coevoEnabled: true,
  coevoMaxRounds: 8,
  coevoTargetSkillScore: 0.85,
  coevoTargetTestStrength: 0.7,
  coevoInitialTestCount: 6,
  coevoMaxTestCases: 20,
  coevoTestsPerRound: 3,
  coevoAutoApprove: false,
  coevoTestPruneThreshold: 0.9,
  // 技能编排
  orchestrationEnabled: true,
  orchestrationDecomposeMode: 'auto',
  orchestrationMatchThreshold: 0.25,
  orchestrationMaxSkills: 5,
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

// ============================================================
// 饕餮模式（Taotie Fusion）—— 跨技能优势吸收融合系统
// ============================================================

/** 饕餮融合运行状态 */
export enum TaotieRunStatus {
  CREATED = 'created',
  PAIR_ANALYZING = 'pair_analyzing',
  PAIR_ANALYSIS_DONE = 'pair_analysis_done',
  PARALLEL_TESTING = 'parallel_testing',
  PARALLEL_TESTING_DONE = 'parallel_testing_done',
  REVERSE_ENGINEERING = 'reverse_engineering',
  REVERSE_ENGINEERING_DONE = 'reverse_engineering_done',
  INJECTING = 'injecting',
  PENDING_APPROVAL = 'pending_approval',
  INJECTION_DONE = 'injection_done',
  DISTILLING = 'distilling',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** 融合阶段标识 */
export enum TaotiePhase {
  PAIR_ANALYSIS = 'pair_analysis',
  PARALLEL_TESTING = 'parallel_testing',
  REVERSE_ENGINEERING = 'reverse_engineering',
  PROGRESSIVE_INJECTION = 'progressive_injection',
  PATTERN_DISTILLATION = 'pattern_distillation',
}

/** 融合模式 —— 从 source 技能中提炼出的可复用优势模式 */
export interface FusionPattern {
  /** 模式唯一标识 */
  id: string
  /** 模式名称（简短描述） */
  name: string
  /** 模式详细描述：它是什么、为什么有效 */
  description: string
  /** 来源技能名称 */
  sourceSkill: string
  /** 该模式主要提升的质量维度 */
  effectDimensions: QualityDimension[]
  /** 该模式已被成功应用的次数 */
  appliedCount: number
  /** 首次提炼时间戳 */
  createdAt: number
  /** 最近一次应用时间戳 */
  lastAppliedAt?: number
  /** 平均提升幅度（0-1，累计 overallScore 提升 / 应用次数） */
  avgImprovement?: number
}

/** 相似技能组 */
export interface SimilarSkillGroup {
  /** 组内技能名称列表 */
  skills: string[]
  /** 组内两两相似度的平均值 */
  avgSimilarity: number
  /** 组内最高相似度 */
  maxSimilarity: number
  /** 推荐作为融合目标的技能名（通常是质量分更高的那个） */
  recommendedTarget: string
  /** 推荐作为融合源的技能名（通常有独特优势的那个） */
  recommendedSource: string
}

/** 配对分析报告 */
export interface PairAnalysisReport {
  targetSkillName: string
  sourceSkillName: string
  /** 整体相似度（0-1） */
  overallSimilarity: number
  /** 各维度相似度 */
  dimensionSimilarity: Record<string, number>
  /** target 的强项维度 */
  targetStrengths: string[]
  /** source 的强项维度 */
  sourceStrengths: string[]
  /** source 优于 target 的维度及差距 */
  sourceAdvantages: Array<{
    dimension: QualityDimension
    label: string
    targetScore: number
    sourceScore: number
    gap: number
  }>
  /** target 优于 source 的维度（保护名单，融合时不触碰） */
  targetAdvantages: Array<{
    dimension: QualityDimension
    label: string
    targetScore: number
    sourceScore: number
    gap: number
  }>
  /** 建议融合的点（按优先级排序） */
  fusionSuggestions: Array<{
    id: string
    title: string
    description: string
    targetDimension: QualityDimension
    priority: 'high' | 'medium' | 'low'
  }>
  /** 结构差异简述 */
  structuralDifferences: string[]
}

/** 并行测试结果 */
export interface ParallelTestResult {
  targetScore: number
  sourceScore: number
  targetDimensions: Record<QualityDimension, number>
  sourceDimensions: Record<QualityDimension, number>
  /** source 胜出的测试项 */
  sourceWinningTests: string[]
  /** target 胜出的测试项 */
  targetWinningTests: string[]
  /** 打平的测试项 */
  tieTests: string[]
}

/** 反向工程结果 */
export interface ReverseEngineeringResult {
  /** 提炼出的可复用模式列表 */
  patterns: Array<{
    id: string
    name: string
    description: string
    /** 模式来源：source 技能中的哪个部分/章节 */
    origin: string
    /** 该模式提升的维度 */
    effectDimensions: QualityDimension[]
    /** 为什么这个模式有效（分析） */
    whyItWorks: string
    /** 注入建议：应该加到 target 的哪个位置 */
    injectionSuggestion: string
  }>
  /** source 技能的方法论优势总结 */
  methodologicalStrengths: string[]
  /** source 技能的工具使用技巧 */
  toolTechniques: string[]
  /** source 技能的验证机制优势 */
  verificationStrengths: string[]
}

/** 单次注入步骤的结果 */
export interface InjectionStepResult {
  stepIndex: number
  patternId: string
  patternName: string
  /** 注入前得分 */
  beforeScore: number
  /** 注入后得分 */
  afterScore: number
  /** 是否保留（有提升则保留，否则回滚） */
  retained: boolean
  /** 回滚原因（若回滚） */
  rollbackReason?: string
  /** 各维度变化 */
  dimensionDeltas: Array<{
    dimension: QualityDimension
    before: number
    after: number
    delta: number
  }>
  /** 注入后技能正文（保留时更新） */
  appliedBody?: string
  /** 注入变更描述 */
  changeDescription: string
}

/** 饕餮融合运行记录 */
export interface TaotieRun {
  id: string
  status: TaotieRunStatus
  /** 当前阶段 */
  phase: TaotiePhase
  targetSkillName: string
  sourceSkillName: string
  /** 是否自动批准（跳过人在回路确认） */
  autoApprove: boolean
  /** 当前等待批准的步骤索引（仅 PENDING_APPROVAL 时有意义） */
  pendingStepIndex?: number

  /** 配对分析结果 */
  pairAnalysis?: PairAnalysisReport
  /** 并行测试结果 */
  parallelTest?: ParallelTestResult
  /** 反向工程结果 */
  reverseEngineering?: ReverseEngineeringResult
  /** 渐进注入步骤记录 */
  injectionSteps: InjectionStepResult[]
  /** 最终整体得分变化 */
  overallDelta?: {
    before: number
    after: number
    delta: number
  }
  /** 成功提炼并存入模式库的模式列表 */
  distilledPatterns: FusionPattern[]

  createdAt: number
  updatedAt: number
  completedAt?: number
  /** 失败原因 */
  failureReason?: string
}

// ============================================================
// Dreaming 闲时锻造模式
// ============================================================

/** Dreaming 运行状态 */
export enum DreamingStatus {
  IDLE = 'idle',
  SCHEDULED = 'scheduled',
  HEALTH_CHECK = 'health_check',
  SCORE_UPDATE = 'score_update',
  SIMILARITY_SCAN = 'similarity_scan',
  OPTIMIZING = 'optimizing',
  FUSING = 'fusing',
  SUGGESTING = 'suggesting',
  GENERATING_REPORT = 'generating_report',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STOPPED = 'stopped',
}

/** Dreaming 阶段标识 */
export enum DreamingPhase {
  HEALTH_CHECK = 'health_check',
  SCORE_UPDATE = 'score_update',
  SIMILARITY_SCAN = 'similarity_scan',
  OPTIMIZATION = 'optimization',
  FUSION = 'fusion',
  SUGGESTION = 'suggestion',
  REPORT = 'report',
}

/** 技能健康检查结果 */
export interface SkillHealthResult {
  skillId: string
  skillName: string
  qualityScore: number
  usageCount: number
  daysSinceLastUse: number
  feedbackScore: number
  isStale: boolean
  isLowQuality: boolean
  isUnused: boolean
}

/** 技能库健康报告 */
export interface SkillLibraryHealthReport {
  /** 技能总数 */
  totalSkills: number
  /** 活跃技能数（status = active） */
  activeSkills: number
  /** 归档技能数 */
  archivedSkills: number
  /** 平均质量分（0-1） */
  avgQualityScore: number
  /** 质量分布：各分段数量 */
  qualityDistribution: { excellent: number; good: number; fair: number; poor: number }
  /** 30 天内使用过的技能数 */
  usedIn30Days: number
  /** 30 天未使用的技能数（僵尸技能） */
  unusedIn30Days: number
  /** 僵尸技能占比（0-1） */
  zombieRatio: number
  /** 重复/相似技能组数 */
  similarGroups: number
  /** 重复技能占比（0-1） */
  duplicateRatio: number
  /** Top 5 最需改进的技能 */
  topImprovementTargets: Array<{
    skillName: string
    qualityScore: number
    reason: string
    priority: 'high' | 'medium' | 'low'
  }>
  /** Top 5 建议归档的技能 */
  topArchiveCandidates: Array<{
    skillName: string
    reason: string
    daysSinceLastUse: number
  }>
  /** 生成时间戳 */
  generatedAt: number
}

/** 技能改进建议 */
export interface SkillImprovementSuggestion {
  skillId: string
  skillName: string
  /** 当前质量分 */
  currentScore: number
  /** 建议改进的维度及原因 */
  suggestions: Array<{
    dimension: string
    currentScore: number
    suggestion: string
    expectedGain: number
  }>
  /** 总体建议 */
  overallRecommendation: string
  /** 优先级 */
  priority: 'high' | 'medium' | 'low'
  /** 生成时间 */
  generatedAt: number
}

/** Dreaming 运行记录 */
export interface DreamingRun {
  id: string
  status: DreamingStatus
  /** 当前阶段 */
  phase: DreamingPhase
  /** 触发方式：manual（手动）/ scheduled（定时）/ idle（空闲触发） */
  triggerType: 'manual' | 'scheduled' | 'idle'
  /** 开始时间 */
  startedAt: number
  /** 结束时间 */
  completedAt?: number
  /** 健康报告（完成时生成） */
  healthReport?: SkillLibraryHealthReport
  /** 技能改进建议列表 */
  improvementSuggestions: SkillImprovementSuggestion[]
  /** 本轮启动的达尔文优化任务数 */
  darwinOptimizationsStarted: number
  /** 本轮启动的饕餮融合任务数 */
  taotieFusionsStarted: number
  /** 本轮自动归档的技能数 */
  autoArchivedCount: number
  /** 失败原因 */
  failureReason?: string
  /** 阶段进度（0-100） */
  progress: number
  /** 当前阶段的描述 */
  currentStepDescription?: string
}

/** Dreaming 模式配置（并入 SkillForgeConfig） */
export interface DreamingConfig {
  /** 是否启用闲时锻造 */
  enableDreaming: boolean
  /** 闲时锻造调度 cron 表达式 */
  dreamingSchedule: string
  /** 空闲多久后触发 Dreaming（分钟），0 表示禁用空闲触发 */
  dreamingIdleThresholdMinutes: number
  /** Dreaming 运行时的最大并发优化任务数 */
  dreamingMaxConcurrentOptimizations: number
  /** Dreaming 中自动启动达尔文优化的最低分阈值（低于此分的技能会被自动优化） */
  dreamingAutoOptimizeThreshold: number
  /** Dreaming 中是否自动启动饕餮融合（相似技能组） */
  dreamingAutoFusion: boolean
  /** Dreaming 中自动归档的阈值：多少天未使用则归档（0 = 不自动归档） */
  dreamingAutoArchiveDays: number
  /** Dreaming 生成的改进建议数量上限 */
  dreamingMaxSuggestions: number
  /** Dreaming 模式下达尔文优化是否自动批准（无人在回路） */
  dreamingDarwinAutoApprove: boolean
  /** Dreaming 模式下饕餮融合是否自动批准（无人在回路） */
  dreamingTaotieAutoApprove: boolean
}

// ============================================================
// CoEvo 共进化验证模式
// ============================================================

/** CoEvo 运行状态 */
export enum CoEvoRunStatus {
  CREATED = 'created',
  INITIAL_TESTING = 'initial_testing',
  SKILL_EVOLVING = 'skill_evolving',
  TEST_EVOLVING = 'test_evolving',
  PENDING_APPROVAL = 'pending_approval',
  COMPLETED = 'completed',
  STOPPED = 'stopped',
  FAILED = 'failed',
}

/** CoEvo 阶段标识 */
export enum CoEvoPhase {
  /** 初始基线测试 */
  BASELINE = 'baseline',
  /** 技能进化轮 */
  SKILL_EVOLUTION = 'skill_evolution',
  /** 测试用例进化轮 */
  TEST_EVOLUTION = 'test_evolution',
}

/** 对抗性测试用例类型 */
export enum AdversarialTestType {
  /** 边界 case：极端输入、零值、超大值、空值等 */
  EDGE_CASE = 'edge_case',
  /** 反例：违反直觉但有效的输入 */
  COUNTEREXAMPLE = 'counterexample',
  /** 模糊测试：随机/混乱输入，测试鲁棒性 */
  FUZZ = 'fuzz',
  /** 越权/安全边界：测试安全防护的完整性 */
  SECURITY_BOUNDARY = 'security_boundary',
  /** 跨场景迁移：把技能用到非预期场景中 */
  CROSS_SCENARIO = 'cross_scenario',
  /** 矛盾输入：自相矛盾的指令，测试处理能力 */
  CONTRADICTORY = 'contradictory',
}

/** 对抗性测试用例 */
export interface AdversarialTestCase {
  id: string
  name: string
  /** 测试类型 */
  type: AdversarialTestType
  /** 所属质量维度 */
  dimension: QualityDimension
  /** 测试输入描述（用于喂给 Verifier 或直接执行） */
  input: string
  /** 为什么这个用例具有挑战性（生成时的 rationale） */
  challengeRationale: string
  /** 预期技能表现（用于评估测试用例的质量） */
  expectedDifficulty: 'easy' | 'medium' | 'hard' | 'extreme'
  /** 该用例已发现的缺陷次数（发现问题越多，保留价值越高） */
  defectDiscoveredCount: number
  /** 该用例被技能通过的次数（通过率越低，挑战价值越高） */
  passCount: number
  /** 该用例被执行的总次数 */
  runCount: number
  /** 进化代数（第几次演化出的版本） */
  generation: number
  /** 父用例 ID（从上一代哪个用例演化而来） */
  parentId?: string
  /** 创建时间戳 */
  createdAt: number
  /** 最后一次执行时间戳 */
  lastRunAt?: number
}

/** CoEvo 单轮历史 */
export interface CoEvoRound {
  /** 轮次号（从 1 开始） */
  round: number
  /** 本阶段 */
  phase: CoEvoPhase
  /** 进化前技能整体得分 */
  skillScoreBefore: number
  /** 进化后技能整体得分 */
  skillScoreAfter: number
  /** 进化前测试套件强度（0-1，越能发现问题越强） */
  testSuiteStrengthBefore: number
  /** 进化后测试套件强度 */
  testSuiteStrengthAfter: number
  /** 本轮新增的对抗性测试用例数 */
  newTestCases: number
  /** 本轮淘汰的弱测试用例数 */
  prunedTestCases: number
  /** 本轮发现的新缺陷数 */
  newDefectsFound: number
  /** 本轮修复的缺陷数 */
  defectsFixed: number
  /** 变更描述 */
  changeDescription: string
  /** 是否被接受（人在回路模式） */
  accepted?: boolean
  /** 时间戳 */
  timestamp: number
}

/** CoEvo 运行记录 */
export interface CoEvoRun {
  id: string
  skillName: string
  skillId: string
  status: CoEvoRunStatus
  /** 是否自动批准（无人在回路） */
  autoApprove: boolean
  /** 当前轮次 */
  currentRound: number
  /** 最大轮数 */
  maxRounds: number
  /** 技能目标质量分（达到此分且测试套件也足够强时结束） */
  targetSkillScore: number
  /** 测试套件目标强度（0-1） */
  targetTestStrength: number
  /** 初始测试用例数量 */
  initialTestCaseCount: number
  /** 最大测试用例数量（防止爆炸） */
  maxTestCases: number

  /** 当前技能得分 */
  currentSkillScore: number | null
  /** 当前测试套件强度 */
  currentTestStrength: number | null

  /** 当前活跃的对抗性测试用例库 */
  testSuite: AdversarialTestCase[]

  /** 进化历史 */
  history: CoEvoRound[]

  /** 连续无提升轮数（技能和测试都没进展时结束） */
  stagnationCount: number

  /** 待批准的当前轮结果 */
  pendingApproval?: {
    round: number
    phase: CoEvoPhase
    skillScoreBefore: number
    skillScoreAfter: number
    testStrengthBefore: number
    testStrengthAfter: number
    changeDescription: string
    /** 进化后的技能内容（批准后写入） */
    proposedSkill?: GeneratedSkill
    /** 进化后的测试套件 */
    proposedTestSuite: AdversarialTestCase[]
    /** 新增测试用例 */
    newTestCases: AdversarialTestCase[]
    timestamp: number
  }

  createdAt: number
  updatedAt: number
  completedAt?: number
  failureReason?: string
  stopReason?: string
}

/** CoEvo 模式配置 */
export interface CoEvoConfig {
  /** 是否启用 CoEvo 模式 */
  coevoEnabled: boolean
  /** CoEvo 最大共进化轮数 */
  coevoMaxRounds: number
  /** 技能目标质量分（0-1） */
  coevoTargetSkillScore: number
  /** 测试套件目标强度（0-1） */
  coevoTargetTestStrength: number
  /** 初始生成的对抗性测试用例数量 */
  coevoInitialTestCount: number
  /** 最大测试用例数量上限 */
  coevoMaxTestCases: number
  /** 每轮测试进化时新增的测试用例数 */
  coevoTestsPerRound: number
  /** CoEvo 是否自动批准 */
  coevoAutoApprove: boolean
  /** 测试用例淘汰阈值（通过率高于此值的用例被视为太弱，淘汰） */
  coevoTestPruneThreshold: number
}
