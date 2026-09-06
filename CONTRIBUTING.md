# 贡献指南

感谢你对 dsh-skill-forge 的兴趣！欢迎提交 Issue 和 PR。

## 开发环境

### 前置要求
- Node.js >= 22.19.0
- pnpm >= 9
- DeepSeek Harness (DSH) 已安装

### 安装与构建

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 类型检查
pnpm typecheck
```

### 本地调试

```bash
# 安装到 DSH web profile
dsh plugin --profile web add /path/to/dsh-skill-forge

# 启动 DSH Web
dsh web

# 开发模式（监听文件变化）
pnpm build --watch
```

## 项目结构

```
src/
├── index.ts                 # Host 入口（Cordis 插件）
├── types.ts                 # 类型定义
├── prompts/index.ts         # LLM System Prompts
├── agents/                  # Agent 层
│   ├── BaseAgent.ts         # 基类
│   ├── ExtractorAgent.ts    # 方法论提取
│   ├── GeneratorAgent.ts    # Skill 生成
│   ├── VerifierAgent.ts     # 多维度验证
│   └── RefinerAgent.ts      # 迭代优化
├── services/                # 服务层
│   ├── ForgeOrchestrator.ts # 锻造编排器
│   ├── TriggerEngine.ts     # 触发引擎
│   ├── SkillRegistry.ts     # 技能注册表
│   ├── InjectionEngine.ts   # 智能注入引擎
│   ├── SecurityAuditor.ts   # 安全审计
│   └── SkillForgeService.ts # 对外服务
└── client/                  # 浏览器端
    ├── index.tsx            # Client 入口
    ├── css-text.ts          # 样式表
    ├── api.ts               # API 客户端
    └── components/          # React 组件
```

## 代码规范

- TypeScript strict 模式，`pnpm typecheck` 0 错误
- 使用 ESM 模块
- 所有 LLM 输出必须经过 Zod/Schemastery Schema 校验
- 不静默失败：每个 Gate 未通过必须产生明确的失败原因
- 安全第一：默认不信任任何自动生成的内容

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
- [ ] 更新了相关文档（README / CHANGELOG）
- [ ] 不引入破坏性变更（如有，请说明）

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
