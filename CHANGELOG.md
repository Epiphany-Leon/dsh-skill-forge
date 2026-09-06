# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2025-09-05

### Added

- **多 Agent 协作锻造流水线**：Extractor → Generator → Verifier → Refiner → SecurityAuditor 六道质量门，完整的技能蒸馏流水线
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

### Changed

- 无（首次发布）

### Fixed

- 无（首次发布）

### Security

- 安全等级四档（strict / normal / permissive / auto），默认 normal 模式平衡自动化与安全性
- 所有自动生成的技能需通过验证 + 审计两道质量门后方可入库
