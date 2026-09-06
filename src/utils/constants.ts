/**
 * 常量定义 —— 魔法数字与字符串集中管理
 *
 * 所有服务共享的常量、阈值、默认值集中在这里，
 * 避免在各文件中散落硬编码的魔法数字。
 */

// ============================================================
// 时间常量（毫秒）
// ============================================================

/** 1 秒 */
export const SECOND_MS = 1000

/** 1 分钟 */
export const MINUTE_MS = 60 * SECOND_MS

/** 1 小时 */
export const HOUR_MS = 60 * MINUTE_MS

/** 1 天 */
export const DAY_MS = 24 * HOUR_MS

// ============================================================
// LLM 相关常量
// ============================================================

/** Mimo API 基础地址（Token Plan 中国区） */
export const MIMO_BASE_URL = 'https://token-plan-cn.xiaomimimo.com/v1'

/** LLM API 请求超时时间（毫秒） */
export const LLM_REQUEST_TIMEOUT_MS = 120 * SECOND_MS

/** LLM 默认最大输出 token 数 */
export const LLM_DEFAULT_MAX_TOKENS = 4096

/** LLM 默认模型 */
export const LLM_DEFAULT_MODEL = 'mimo-v2.5-pro'

// ============================================================
// 持久化相关常量
// ============================================================

/** 持久化防抖延迟（毫秒）—— 避免频繁写磁盘 */
export const PERSIST_DEBOUNCE_MS = 2000

/** 历史 forge runs 最大保留条数 */
export const MAX_HISTORICAL_RUNS = 50

/** DSH 凭据文件相对路径（相对于 homedir） */
export const DSH_CREDENTIALS_PATH = '.dsh/.credentials.yaml'

/** 技能存储目录相对路径（相对于 homedir） */
export const SKILL_STORAGE_DIR = '.dsh/skills-forged'

// ============================================================
// 验证/质量阈值
// ============================================================

/** 默认验证通过率阈值（0-1） */
export const DEFAULT_VERIFICATION_PASS_THRESHOLD = 0.8

/** 高分维度阈值（高于此分的维度视为已达标，不再修改） */
export const HIGH_SCORE_DIMENSION_THRESHOLD = 0.9

// ============================================================
// 安全相关常量
// ============================================================

/** 技能 body 最大行数阈值（超过警告，疑似格式炸弹） */
export const SKILL_BODY_MAX_LINES = 500

// ============================================================
// 文件系统常量
// ============================================================

/** 文件树默认最大深度 */
export const FILE_TREE_DEFAULT_MAX_DEPTH = 2

/** 文件树中跳过的目录名 */
export const FILE_TREE_SKIP_DIRS = new Set(['node_modules', '.git'])

// ============================================================
// API 相关常量
// ============================================================

/** HTTP API 基础路径前缀 */
export const API_BASE_PATH = '/api/skill-forge'

/** 默认分页 limit */
export const DEFAULT_PAGE_LIMIT = 20

/** Top N 技能默认数量 */
export const DEFAULT_TOP_SKILLS_COUNT = 10
