# dsh-skill-forge

> 🌏 **English Version** | [English](README.md)


> 多 Agent 协作式技能锻造系统，让 Agent 从对话经验中学习，用工程手段锻造可验证、可追溯、可复用的高质量技能。

[![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-blue)](https://github.com/topics/dsh-plugin)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Cordis](https://img.shields.io/badge/Cordis-powered-purple)](https://github.com/cordiverse/cordis)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ 核心特性

### 七层质量门锻造流水线

从对话触发到技能激活，每一步都有工程化把控。提取、生成、验证、迭代、审计、批准、激活，七道工序层层过滤，最终产出的技能不是「看起来对」，而是「实际能用」。

### 多 Agent 协作体系

六个专职 Agent 各司其职又彼此制衡。Extractor 负责从对话中提炼模式，Generator 负责生成技能草稿，Verifier 负责多维度验证，Refiner 负责基于反馈迭代优化，AdversarialTestGenerator 负责生成对抗性测试用例，Auditor 负责安全与重复检查。每个角色有独立的 system prompt 和评估标准，确保过程透明可控。

### 验证驱动的迭代优化

借鉴 SkillOpt 文本梯度下降的思想，每次锻造都附带完整的验证报告。验证不通过时，Refiner Agent 基于失败模式定位具体问题，做增量改写而非全部重写，保证质量严格不回退。最大迭代轮次可配置，默认三轮内完成收敛。

### 三种进化模式

技能库不会静止不动，三套进化引擎持续推动质量提升：

- **达尔文模式**：单体技能爬山式进化，10 维度评估 + ratchet 严格不回退 + 人在回路。对已有技能做定向优化，低分维度重点突破，高分维度保持不变。
- **饕餮模式**：多技能融合引擎，自动检测高相似度技能对，五阶段融合流程沉淀为模式库，融合失败自动回退。合并相似技能的优势，产出更全面的版本。
- **共进化模式（CoEvo）**：技能与对抗性测试套件双向进化。奇数轮优化技能，偶数轮强化测试，双方互相博弈共同提升，最终产出经过高强度压力测试的技能。

### Dreaming 闲时锻造引擎

系统空闲时自动运行的批量优化引擎。健康体检扫描技能库全貌，低分技能批量调用达尔文优化，相似技能自动饕餮融合，启发式生成改进建议（零 LLM 消耗）。支持手动、定时 cron、空闲检测三种触发方式，永不自动删除，所有变更严格不回退。

### 技能编排器

复杂任务的多技能协作引擎。任务分解支持 fast 关键词匹配和 llm 语义分解两种模式，从技能库中匹配最相关的技能组合，生成执行指导。单任务最多编排 5 个技能，相关度阈值可配置。

### 四层安全防御体系

生成时安全、验证时安全、入库时安全、使用时安全，四道防线覆盖技能全生命周期。默认对自动生成内容持不信任态度，危险模式匹配、重复技能检测、用户手动批准三重保险。所有进化模式默认需要人工批准，不会自动修改激活技能。

### 完整谱系追踪

每个技能都携带完整的家族树。来源对话 ID、锻造轮次记录、每轮验证得分、版本变更日志、使用反馈统计、衍生技能图谱，所有信息可追溯可审计。你随时知道一个技能从哪里来、经过了哪些修改、表现如何。

### 智能召回引擎

五维加权评分（关键词匹配 40%、验证得分 30%、使用频率 10%、新鲜度 10%、反馈得分 10%）+ Token 预算管理，替代启动时全量注册的粗放模式。奖励驱动的权重自调整从显式反馈和隐式反馈中学习，动态优化召回排序。智能注入根据每轮对话上下文动态挑选最相关的技能，在 token 预算内达到最优召回效果。

### 原生 DSH Web 集成

深度嵌入 DSH Web UI，右侧边栏承载锻造队列、技能库、文件浏览器、统计仪表盘与设置面板，顶栏展示锻造状态与快捷操作，Toast 通知实时推送锻造进展并支持一键批准/驳回。不需要切换工具，在对话界面内就能完成从触发到审核的全流程。

---

## 🚀 快速开始

### 前置条件

- DeepSeek Harness (DSH) 0.1.0-rc.5 或更高版本
- Node.js 20+
- 一个已配置的 DSH web profile

### 安装

Skill Forge 通过 DSH profile 的 `package.json` 安装为插件。

#### 从 GitHub 安装（推荐）

在你的 DSH profile 目录下安装插件：

```bash
# 在 DSH profile 目录中（例如 ~/.dsh/profiles/web）
pnpm add dsh-skill-forge@github:Epiphany-Leon/dsh-skill-forge
```

然后编辑 profile 的 `package.json`，在 bundle 列表中启用：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-skill-forge"
      ]
    }
  }
}
```

重启 DSH，右侧边栏会出现 Skill Forge 面板。

#### 本地开发安装

```bash
git clone https://github.com/Epiphany-Leon/dsh-skill-forge.git
cd dsh-skill-forge
pnpm install
pnpm build

# 链接到本地 DSH profile
cd ~/.dsh/profiles/web
pnpm add dsh-skill-forge@link:/path/to/dsh-skill-forge
# 然后在 package.json 的 dsh.profile.bundles 中添加 "dsh-skill-forge"
```

### 启动

```bash
# 启动 DSH Web
dsh web

# 打开浏览器访问 DSH，右侧边栏会出现 Skill Forge 面板
```

### 第一次锻造

1. 在 DSH 中进行一段对话，完成一个可复用的任务
2. 点击右侧边栏的「锻造技能」按钮，或直接使用 `forge_skill` 工具
3. 填写锻造理由，确认开始
4. 等待锻造流水线完成（通常 30 秒到 2 分钟）
5. 在审核弹窗中检查生成的技能，批准或驳回
6. 批准后的技能自动入库，后续对话中会被智能召回

更详细的步骤指南见 [docs/quickstart.md](docs/quickstart.md)。

---

## ⚙️ 配置说明

插件安装后可通过 DSH 设置界面调整配置，也可直接修改 profile 的 `cordis.patch.yml`。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `securityLevel` | `strict` / `normal` / `permissive` / `auto` | `normal` | 安全等级，控制安全审计的严格程度 |
| `autoTrigger` | `boolean` | `true` | 是否启用自动触发锻造 |
| `triggerThreshold` | `number` (0.1-0.95) | `0.3` | 自动触发的置信度阈值 |
| `maxIterations` | `number` (0-10) | `3` | 锻造最大迭代轮数 |
| `verificationPassThreshold` | `number` (0.5-1.0) | `0.9` | 验证通过率阈值 |
| `skillCountAlertThreshold` | `number` (10-100) | `30` | 技能数量提醒阈值 |
| `tokenBudgetRatio` | `number` (0.05-0.3) | `0.1` | 技能注入的 token 预算占比 |
| `injectionMode` | `all` / `smart` | `all` | 技能注入模式，all 为全部注册，smart 为智能动态注入 |
| `injectionTokenBudget` | `number` | `0` | 智能注入每轮 token 预算上限（0 为自动计算） |
| `injectionRelevanceThreshold` | `number` (0-1) | `0.2` | 智能注入最低相关度阈值 |
| `enableDreaming` | `boolean` | `false` | 是否启用闲时锻造 |
| `dreamingSchedule` | `string` | `0 3 * * 0` | 闲时锻造的 cron 表达式 |
| `customDangerousPatterns` | `string[]` | `[]` | 自定义危险模式列表 |
| `workspaceRoot` | `string` | `''` | 技能库存储根目录，为空则使用 DSH 第一个 workspace |

完整配置说明见 [docs/configuration.md](docs/configuration.md)。

---

## 🏗️ 架构概览

```
                     ┌──────────────────────────────────────────────────┐
                     │                 DSH Web UI                       │
                     │  右侧边栏 · 顶栏 · Toast · 设置面板 · 审核弹窗   │
                     └──────────┬───────────────────┬───────────────────┘
                                │ HTTP API          │ 事件订阅
                                ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Host 端（Cordis 插件）                          │
│                                                                             │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────────────┐   │
│  │ TriggerEngine│───▶│ ForgeOrchestrator│───▶│    SkillRegistry         │   │
│  │  触发引擎     │    │   编排器         │    │    技能库（版本化）       │   │
│  └──────────────┘    └────────┬────────┘    └────────────┬─────────────┘   │
│                               │                          │                 │
│             ┌─────────────────┼──────────────────┐       │                 │
│             ▼                 ▼                  ▼       ▼                 │
│     ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  ┌────────────┐  │
│     │ Extractor   │   │ Generator    │   │ Verifier     │  │  Auditor   │  │
│     │ 提取 Agent   │   │ 生成 Agent   │   │ 验证 Agent    │  │  审计器    │  │
│     └─────────────┘   └──────┬───────┘   └──────┬───────┘  └────────────┘  │
│                               │                  │                          │
│                               ▼                  │                          │
│                        ┌──────────────┐          │                          │
│                        │ Refiner      │──────────┘                          │
│                        │ 迭代 Agent    │  验证反馈 → 增量改写               │
│                        └──────────────┘                                     │
│                                                                             │
│  ┌─────────────────┐     ┌──────────────────┐                               │
│  │ InjectionEngine │     │ SecurityAuditor  │                               │
│  │ 智能注入引擎     │     │  安全审计器       │                               │
│  └─────────────────┘     └──────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 锻造流水线

```
对话事件 → [触发] → [提取] → [生成] → [验证] ──通过──▶ [审计] → [批准] → 入库激活
                                  │                ▲
                                  └──失败──▶[迭代]──┘
```

### 项目结构

```
dsh-skill-forge/
├── src/
│   ├── index.ts              # Host 入口（Cordis 插件主文件）
│   ├── types.ts              # 全局类型定义
│   ├── global.d.ts           # 全局类型声明
│   ├── prompts/              # Agent System Prompts
│   ├── services/             # Host 服务层（12 个模块）
│   │   ├── BaseService.ts    # 服务基类
│   │   ├── ForgeOrchestrator.ts   # 核心编排器
│   │   ├── TriggerEngine.ts       # 增量式触发引擎
│   │   ├── SkillRegistry.ts       # 技能库管理（版本化）
│   │   ├── InjectionEngine.ts     # 智能注入引擎
│   │   ├── SecurityAuditor.ts     # 安全审计
│   │   ├── SkillForgeService.ts   # 对外服务 + HTTP 路由
│   │   ├── DarwinOptimizer.ts     # 达尔文模式（爬山进化）
│   │   ├── TaotieFusion.ts        # 饕餮模式（技能融合）
│   │   ├── CoEvoOrchestrator.ts   # CoEvo 共进化模式
│   │   ├── DreamingEngine.ts      # Dreaming 闲时锻造
│   │   └── SkillOrchestrator.ts   # 技能编排器
│   ├── agents/               # LLM Agent（6 个角色）
│   │   ├── BaseAgent.ts
│   │   ├── ExtractorAgent.ts
│   │   ├── GeneratorAgent.ts
│   │   ├── VerifierAgent.ts
│   │   ├── RefinerAgent.ts
│   │   └── AdversarialTestGenerator.ts
│   └── client/               # 浏览器端 React 组件（15+ 组件）
│       ├── index.tsx         # Client 入口
│       ├── components/       # UI 组件
│       ├── api.ts            # API 客户端
│       ├── toast-store.ts    # Toast 状态管理
│       └── style-inject.ts   # CSS 注入
├── docs/                     # 文档
│   ├── quickstart.md         # 快速上手
│   ├── configuration.md      # 配置参考
│   └── faq.md                # 常见问题
├── cordis.patch.yml          # DSH 插件配置层
├── tsdown.config.ts          # 构建配置
├── CHANGELOG.md              # 变更日志
├── STATUS.md                 # 项目进度记录
├── CONTRIBUTING.md           # 贡献指南
├── package.json
└── README.zh.md / README.md
```

---

## 📖 使用指南

### 触发锻造

**自动触发**：开启 `autoTrigger` 后，系统会监听每轮对话的结束事件，自动评估是否满足锻造条件。置信度超过阈值时弹出锻造建议，用户可选择确认或忽略。

**手动触发**：在对话中直接告诉 Agent「把这个方法存成技能」，Agent 会调用 `forge_skill` 工具启动锻造流程。也可通过右侧边栏的「锻造当前对话」按钮手动触发。

**批量锻造**：在技能库面板选择「闲时锻造」，系统会在配置的时间段（默认每周日凌晨 3 点）扫描历史对话，批量提取可锻造的模式。

### 审核技能

锻造完成后进入待审核状态，审核弹窗会展示：

- 技能 frontmatter（名称、描述、适用场景、标签等）
- 技能正文预览
- 验证报告（各维度得分、失败用例、改进建议）
- 安全审计结果（危险模式警告、重复检测）
- 来源对话摘要

确认无误后点击批准，技能进入激活状态并立即生效。驳回时可选择预设原因或填写自定义理由，系统会将驳回原因记录到锻造历史中。

### 管理技能库

技能库面板支持：

- 搜索、按分类筛选、按状态筛选
- 按质量分、使用次数、新鲜度排序
- 查看技能详情与版本历史
- 回滚到历史版本
- 归档/复活、删除
- 手动编辑技能内容
- 基于已有技能重新锻造（reforge）

### 智能召回

将 `injectionMode` 设为 `smart` 即启用智能注入模式。系统会在每轮对话开始前，基于用户最新消息计算所有激活技能的相关度评分，按 token 预算从高到低依次注入，直到预算用尽。

评分维度与权重：

| 维度 | 权重 | 说明 |
|------|------|------|
| 关键词匹配 | 40% | 技能内容与用户消息的词汇重合度 |
| 验证得分 | 30% | 最近一次验证的综合得分 |
| 使用频率 | 10% | 历史使用次数的归一化值 |
| 新鲜度 | 10% | 最近使用时间的衰减值 |
| 反馈得分 | 10% | 显式 + 隐式反馈的归一化得分 |

---

## ❓ 常见问题

完整 FAQ 见 [docs/faq.md](docs/faq.md)。

---

## 🗺️ 路线图

- [x] **Phase 0**：环境搭建与最小插件骨架
- [x] **Phase 1**：单角色锻造与手动确认（MVP）
- [x] **Phase 2**：验证循环与迭代优化（核心质量门）
- [x] **Phase 3**：技能库治理与智能召回
- [x] **Phase 4**：产品化与开源发布
- [x] **Phase 5**：技能进化与自我完善
  - [x] 奖励驱动的技能权重自调整
  - [x] 增量式经验积累触发
  - [x] 技能融合（饕餮模式）— 五阶段跨技能优势融合
  - [x] 单体技能爬山优化（达尔文模式）— 10 维度评估
- [x] **Phase 6**：多 Agent 协作深化
  - [x] 共进化验证（CoEvo 模式）— 技能 vs 对抗性测试用例双循环进化
  - [x] Dreaming 闲时锻造 — 批量优化 + 自动融合 + 健康体检
  - [x] 技能编排 — 多技能任务分解、匹配与执行指导生成

---

## 🤝 贡献指南

欢迎贡献代码、文档或反馈。

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 开启 Pull Request

### 开发环境

```bash
# 克隆仓库
git clone https://github.com/Epiphany-Leon/dsh-skill-forge.git
cd dsh-skill-forge

# 安装依赖
pnpm install

# 构建
pnpm build

# 类型检查
pnpm typecheck

# 安装到本地 DSH profile 进行测试
dsh plugin --profile web add .
```

---

## 🙏 鸣谢

本项目站在巨人的肩膀上，以下项目和研究提供了重要的灵感和方法论参考。

### 架构与方法论

- **[EvoSkill](https://github.com/sentient-agi/EvoSkill)** — 失败驱动的技能发现框架，其三 Agent 架构、前沿选择和反馈记忆机制是锻造流水线的重要思想来源。
- **[CoEvoSkills](https://github.com/Zhang-Henry/CoEvoSkills)** — 技能生成器与代理解法器协同进化框架，Surrogate Verifier 思路启发了无监督验证模式。
- **[达尔文.skill](https://github.com/alchaincyf/darwin-skill)** — 单体技能优化系统，其 9 维度评分体系、爬山优化循环和 git ratchet 机制被技能库治理模块借鉴。
- **[饕餮.skill](https://github.com/binggandata/bggg-skills/tree/main/bggg-skill-taotie)** — 跨技能进化引擎，反向工程分析和渐进式注入的思路启发了融合进化模式。

### 社区参考

- **[dsh-forge](https://github.com/activeing123/dsh-forge)** — DSH 生态中最早的技能自锻造插件之一，验证了从对话轨迹中提炼技能的可行性。
- **[dsh-skill-hub](https://github.com/cheshireez/dsh-skill-hub)** — DSH GUI 技能管理插件，UI 交互模式和技能目录管理方式提供了重要参考。
- **[dsh-self-improved](https://github.com/madage/dsh-self-improved)** — DSH 长期记忆与自进化插件，分层记忆提取架构启发了触发与提取设计。

### 学术引用

- Alzubi et al. (2026). EvoSkill: Automated Skill Discovery for Multi-Agent Systems. [arXiv:2603.02766](https://arxiv.org/abs/2603.02766)
- Zhang et al. (2026). CoEvoSkills: Self-Evolving Agent Skills via Co-Evolutionary Verification. [arXiv:2604.01687](https://arxiv.org/abs/2604.01687) (COLM 2026)
- Shani et al. (2025). SkillOpt: Automated Skill Optimization via Textual Gradient Descent. [arXiv:2511.08173](https://arxiv.org/abs/2511.08173)

> 注：本项目与上述项目均无官方关联，鸣谢仅表示灵感和方法论上的参考。所有引用的项目版权归其各自作者所有。

---

## 📄 License

MIT © Epiphany-Leon
