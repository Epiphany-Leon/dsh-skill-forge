/**
 * 共享常量
 */

export const NAMESPACE = 'dsh-skill-forge'
export const DISPLAY_NAME = 'Skill Forge'
export const API_BASE = '/api/skill-forge'

// 侧栏默认宽度
export const DEFAULT_SIDEBAR_WIDTH = 380
export const MIN_SIDEBAR_WIDTH = 280
export const MAX_SIDEBAR_WIDTH = 800

// 轮询间隔
export const POLL_INTERVAL_MS = 5000
export const QUEUE_POLL_LIMIT = 20
export const TOAST_AUTO_DISMISS_MS = 8000

// 质量分阈值
export const QUALITY_HIGH_THRESHOLD = 0.8
export const QUALITY_MID_THRESHOLD = 0.6

// 达尔文模式 10 维度
export const DARWIN_DIMENSIONS = [
  { key: 'structural_completeness', label: '结构完整性' },
  { key: 'logical_consistency', label: '逻辑一致性' },
  { key: 'operationality', label: '可操作性' },
  { key: 'practicality', label: '实用性' },
  { key: 'security', label: '安全性' },
  { key: 'frontmatter_completeness', label: 'Frontmatter' },
  { key: 'trigger_quality', label: '触发质量' },
  { key: 'tool_call_conformity', label: '工具规范' },
  { key: 'verification_completeness', label: '验证完备' },
  { key: 'cross_scenario_versatility', label: '跨场景' },
] as const

// 饕餮模式阶段
export const TAOTIE_PHASES = [
  { key: 'pair_analysis', label: '配对分析', icon: '🔍' },
  { key: 'parallel_testing', label: '并行测试', icon: '🧪' },
  { key: 'reverse_engineering', label: '反向工程', icon: '🔧' },
  { key: 'progressive_injection', label: '渐进注入', icon: '💉' },
  { key: 'pattern_distillation', label: '模式沉淀', icon: '💎' },
] as const

// CoEvo 共进化阶段
export const COEVO_PHASES = [
  { key: 'baseline', label: '基线测试', icon: '🧪' },
  { key: 'skill_evolution', label: '技能进化', icon: '🧬' },
  { key: 'test_evolution', label: '测试进化', icon: '⚔️' },
] as const

// Dreaming 闲时锻造阶段
export const DREAMING_PHASES = [
  { key: 'health_check', label: '健康体检', icon: '🏥' },
  { key: 'similarity_scan', label: '相似度扫描', icon: '🔍' },
  { key: 'suggestion', label: '生成建议', icon: '💡' },
  { key: 'optimization', label: '自动优化', icon: '🧬' },
  { key: 'fusion', label: '自动融合', icon: '🔗' },
  { key: 'report', label: '生成报告', icon: '📊' },
] as const

// 拒绝理由预设
export const REJECTION_REASONS = [
  { key: 'quality', label: '质量不达标', desc: '内容太水/不准确/不完整' },
  { key: 'useless', label: '不实用', desc: '场景太窄/日常用不上' },
  { key: 'security', label: '有安全隐患', desc: '危险操作/隐私泄露' },
  { key: 'duplicate', label: '与已有技能重复', desc: '功能重叠' },
  { key: 'unclear', label: '看不懂', desc: '描述含糊/逻辑混乱' },
  { key: 'format', label: '格式有问题', desc: '结构乱/缺字段' },
] as const
