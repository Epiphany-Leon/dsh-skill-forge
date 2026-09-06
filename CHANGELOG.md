# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-09-06

### Added

- **达尔文模式（Darwin Optimizer）**：单体技能爬山式进化，10 维度评估 + 迭代优化 + ratchet 严格不回退 + 人在回路确认
- **饕餮模式（Taotie Fusion）**：多技能融合引擎，5 阶段融合流程 + 模式沉淀库 + 相似度自动检测 + 严格不回退
- **共进化模式（CoEvo）**：技能与测试套件双向进化，AdversarialTestGenerator 生成 6 类对抗性测试，双循环交替进化
- **Dreaming 闲时锻造引擎**：技能库健康体检 + 低分技能批量优化 + 相似技能自动融合 + 改进建议生成，支持手动/cron/空闲三种触发
- **技能编排器（SkillOrchestrator）**：任务分解 + 多技能组合执行，支持 fast/llm/auto 三种分解模式
- **奖励驱动的技能权重自调整**：显式反馈 + 隐式反馈双轨学习，日衰减机制防止旧技能权重僵化
- **增量式经验积累触发**：对话密度累积 + idle 检测 + 意图感知，更精准地识别可锻造对话
- **AdversarialTestGenerator Agent**：6 种对抗性测试类型（边界/反例/fuzz/安全边界/跨场景/矛盾）
- **设置页大升级**：7 大分组 + 可折叠 + 功能概览，改用 HTTP API 热更新
- **UI 交互优化**：侧栏设置齿轮 + 快速设置面板 + 点击外部收起侧栏 + 挤压模式（实验性）
- **HTTP API 扩展**：新增 Darwin / Taotie / CoEvo / Dreaming / SkillOrchestrator 共 20+ 端点
- **持久化扩展**：coevo-runs.json 共进化记录 + forge-runs.json 字段扩展

### Changed

- 触发引擎升级为增量式累积，从单次判断改为多信号累积评估
- 智能召回评分新增反馈得分维度，从四维变为五维加权
- 配置项从 14 个扩展到 50+，按功能模块分组管理
- 安全审计增加达尔文/饕餮/共进化模式下的专项检查
- README 功能列表同步更新至 v0.3.0 完整能力集

### Fixed

- 修复锻造中取消任务后的状态残留问题
- 修复智能注入模式下 token 预算计算偏差
- 修复版本回退后质量分不同步的问题
- 修复技能编辑后版本历史排序错误

### Security

- 达尔文/饕餮/共进化模式默认需要人工批准，不自动修改激活技能
- Dreaming 模式永不自动删除技能，所有变更均可回退
- 共进化测试套件运行在隔离上下文中，不影响主对话安全

## [0.2.0] — 2026-09-05

### Added

- **技能库 CRUD 完整实现**：搜索、筛选、排序、分页，支持多字段模糊搜索
- **版本管理系统**：版本历史列表、版本内容查看、回滚到任意版本、版本 diff 对比（LCS 算法）
- **谱系追踪**：技能来源锻造记录 + 衍生技能图谱 + 相关技能推荐
- **智能召回引擎（InjectionEngine）**：四维加权评分（关键词 40% + 验证分 30% + 使用频率 20% + 新鲜度 10%）+ Token 预算贪心算法 + all/smart 双模式
- **统计仪表盘**：5th Tab 展示大数字卡片 + 圆环成功率 + 7 天趋势 + 分类分布
- **ForgeToast 对话内通知**：5 秒轮询 + 右下角 Toast + 一键批准/拒绝 + 静音功能
- **拒绝理由 Modal**：5 个预设选项 + 自由文本输入
- **技能编辑功能**：直接编辑技能内容，自动生成新版本
- **使用反馈闭环**：有用/一般/无用三级反馈，实时更新技能评分
- **Forge Run 持久化**：forge-runs.json 文件存储，防抖写入，启动时自动加载
- **12 个新 HTTP API**：skill-detail / skill-versions / skill-diff / skill-lineage / stats-detail / config 热更新等
- **自动触发机制联调**：接入 DSH session/event 事件流，5 分钟 idle 后触发评估
- **Skill 注册到 DSH 原生系统**：激活/归档/反归档自动同步到 ctx.skills
- **文件浏览器接入 DSH workspace**：默认显示当前 workspace 目录，支持自定义根目录
- **设置页 UI 完善**：9 个配置字段全部可编辑，DSH 设计语言卡片式布局

### Changed

- Forge 面板从 2 个 Tab 扩展为 5 个 Tab（队列/技能库/统计/文件/设置）
- 验证阈值从 0.9 调整为 0.8，提高一次通过率
- Verifier / Refiner temperature 从 0.7 降到 0.3，减少随机波动
- 迭代循环增加无进步早停机制（连续 2 轮无提升自动停止）

### Fixed

- 修复 Extractor 空结果导致锻造失败的问题（增加 fallback patterns）
- 修复 Trigger 竞态条件：session traces 在 Gate 0 评估前被清理
- 修复设置页未在 client 主入口注册的 bug
- 修复 SkillRegistry storagePath 在 initialize 前被调用的空路径问题
- 修复 RefinerAgent 递归调用自身的 bug（callLLMLow → callLLM）
- 修复 UI 正则表达式转义导致的侧栏崩溃
- 修复 UI 修改 DSH 根节点 class 触发的重渲染闪烁

### Security

- 增加技能编辑的版本快照机制，每次修改均可回退
- 增加重复技能检测的相似度阈值分级（strict 0.6 / normal 0.8）

## [0.1.0] — 2025-09-05

### Added

- **多 Agent 协作锻造流水线**：Extractor → Generator → Verifier → Refiner → SecurityAuditor 六道质量门
- **ForgeOrchestrator 编排器**：统一调度各 Agent，管理 ForgeRun 状态机，支持自动/手动/批量三种触发模式
- **TriggerEngine 自动触发引擎**：基于对话轮次、工具调用密度、问题复杂度等多维信号自动评估锻造价值
- **SkillRegistry 技能注册表**：本地文件系统持久化，支持版本化、搜索、归档、回滚、反馈统计
- **InjectionEngine 技能注入引擎**：all / smart 两种模式，smart 模式下根据对话上下文动态注入相关技能
- **SecurityAuditor 安全审计**：危险模式检测、重复技能检测、代码执行风险评估
- **Client 端 UI**：全局顶栏入口、右侧边栏（文件浏览器 + Forge 面板）、Toast 通知、设置配置卡片
- **HTTP API**：29 个 REST 端点，覆盖技能管理、锻造控制、文件浏览、统计数据等全部功能
- **forge_skill 工具**：LLM 可直接调用的工具，基于当前对话手动触发锻造
- **闲时锻造 (Dreaming)**：cron 调度，从历史对话中批量挖掘可复用技能
- **Schemastery 配置定义**：完整的运行时配置 schema，支持 DSH Settings UI 可视化编辑
- **cordis.patch.yml**：Cordis 补丁定义，声明对 DSH 宿主的扩展点

### Security

- 安全等级四档（strict / normal / permissive / auto），默认 normal 模式平衡自动化与安全性
- 所有自动生成的技能需通过验证 + 审计两道质量门后方可入库
