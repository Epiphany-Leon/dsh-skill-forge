# 贡献指南

感谢你对 dsh-skill-forge 的兴趣！欢迎提交 Issue 和 PR。

## 开发环境

### 前置要求
- Node.js >= 20.0.0
- pnpm >= 9
- DeepSeek Harness (DSH) 0.1.0-rc.5 或更高版本

### 安装与构建

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 类型检查
pnpm typecheck

# 开发模式（监听文件变化自动构建）
pnpm dev
```

### 本地调试

```bash
# 安装到 DSH web profile
dsh plugin --profile web add /path/to/dsh-skill-forge

# 启动 DSH Web
dsh web

# 开发模式（监听文件变化）
pnpm dev
```

## 项目结构

```
src/
├── index.ts                 # Host 入口（Cordis 插件）
├── types.ts                 # 类型定义
├── global.d.ts              # 全局类型声明
├── prompts/index.ts         # LLM System Prompts
├── agents/                  # Agent 层（6 个 Agent）
│   ├── BaseAgent.ts         # 基类
│   ├── ExtractorAgent.ts    # 方法论提取
│   ├── GeneratorAgent.ts    # Skill 生成
│   ├── VerifierAgent.ts     # 多维度验证
│   ├── RefinerAgent.ts      # 迭代优化
│   └── AdversarialTestGenerator.ts  # 对抗性测试生成
├── services/                # 服务层（12 个服务）
│   ├── BaseService.ts       # 服务基类
│   ├── ForgeOrchestrator.ts # 锻造编排器（核心状态机）
│   ├── TriggerEngine.ts     # 触发引擎（增量累积 + idle 检测）
│   ├── SkillRegistry.ts     # 技能注册表（版本化 + 持久化）
│   ├── InjectionEngine.ts   # 智能注入引擎（五维加权 + Token 预算）
│   ├── SecurityAuditor.ts   # 安全审计（危险模式 + 重复检测）
│   ├── SkillForgeService.ts # 对外服务（HTTP API 路由）
│   ├── DarwinOptimizer.ts   # 达尔文模式（单体技能爬山进化）
│   ├── TaotieFusion.ts      # 饕餮模式（多技能融合）
│   ├── CoEvoOrchestrator.ts # 共进化模式（技能与测试双向进化）
│   ├── DreamingEngine.ts    # 闲时锻造（批量优化 + 健康体检）
│   ├── SkillOrchestrator.ts # 技能编排（任务分解 + 多技能组合）
│   └── routes.ts            # HTTP 路由定义
└── client/                  # 浏览器端（React + TypeScript）
    ├── index.tsx            # Client 入口
    ├── css-text.ts          # 样式表
    ├── api.ts               # API 客户端
    ├── constants.ts         # 常量
    ├── side-panel.tsx       # 右侧边栏
    ├── settings-section.tsx # 设置面板注入
    ├── style-inject.ts      # 样式注入
    ├── toast-store.ts       # Toast 状态管理
    └── components/          # React 组件（15+ 组件）
        ├── ForgePanel.tsx       # Forge 主面板
        ├── SkillForgePanel.tsx  # 技能锻造面板
        ├── SkillLibrary.tsx     # 技能库
        ├── ForgeQueue.tsx       # 锻造队列
        ├── ForgeStats.tsx       # 统计卡片
        ├── ApprovalModal.tsx    # 审核弹窗
        ├── FileExplorer.tsx     # 文件浏览器
        ├── RightSidebar.tsx     # 右侧边栏容器
        ├── GlobalTopbar.tsx     # 全局顶栏
        ├── ForgeToast.tsx       # Toast 通知
        ├── ForgeOverlay.tsx     # 覆盖层
        └── SkillForgeSettings.tsx  # 设置面板
```

## 代码规范

- TypeScript strict 模式，`pnpm typecheck` 0 错误
- 使用 ESM 模块
- 所有 LLM 输出必须经过 Schemastery Schema 校验
- 不静默失败：每个 Gate 未通过必须产生明确的失败原因
- 安全第一：默认不信任任何自动生成的内容
- 所有新增服务继承 BaseService
- Agent 类继承 BaseAgent，统一 LLM 调用方式

## 提交 PR

1. Fork 本仓库
2. 创建你的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的改动 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

### PR 检查清单

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm build` 成功
- [ ] 新增代码有相应的注释
- [ ] 更新了相关文档（README / CHANGELOG / docs/）
- [ ] 不引入破坏性变更（如有，请说明）
- [ ] 新增配置项已在 Schemastery Schema 和 docs/configuration.md 中同步

## 报告 Issue

报告 Bug 或提出新功能建议，请通过 [GitHub Issues](https://github.com/Epiphany-Leon/dsh-skill-forge/issues)。

提交 Bug 时请包含：
- 复现步骤
- 预期行为 vs 实际行为
- 环境信息（DSH 版本、Node 版本、操作系统）
- 错误日志或截图

## 讨论与交流

- **GitHub Discussions**：功能建议、架构讨论
- **话题标签**：给相关仓库加 `dsh-plugin` 话题，便于社区发现
- **DSH 官方社群**：参见 DSH 官方 README 的社区入口

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。
