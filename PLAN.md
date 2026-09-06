# dsh-skill-forge

> 多 Agent 协作式技能锻造系统 —— 让 Agent 从经验中学习，用工程手段锻造高质量技能。

## 项目定位

DeepSeek Harness (DSH) 插件，将对话经验自动提炼为可验证、可追溯、可复用的 Agent Skills。区别于社区现有方案的"一次性生成"，dsh-skill-forge 构建了一条完整的锻造流水线——提取、生成、验证、迭代、审计、归档，每一步都有工程化的质量门控。

## 核心价值

- **质量可控**：七层质量门 + 迭代式优化，不靠 LLM 自觉
- **安全可信**：四层防御体系，默认不信任自动生成内容
- **深度整合**：嵌入 DSH Web UI，无需切换工具
- **学术根基**：基于 SkillOpt / EvoSkills / SkillsVote 等最新研究工程化落地

## 技术栈

### Host 侧（Node.js + Cordis）
- **运行时**：Node.js >= 22.19.0（对齐 DSH 要求）
- **框架**：Cordis（DSH 插件内核）
- **语言**：TypeScript (strict mode, ESM)
- **包管理**：pnpm
- **结构化校验**：Zod（所有 LLM 输出强制 Schema 校验）
- **存储**：SQLite + FTS5（技能库 + 谱系 + 验证记录）
- **构建**：tsc + tsdown

### Client 侧（React + DSH Slots）
- **框架**：React 18
- **UI 注入**：DSH Slot 机制（`ctx.slots.register`）
- **状态同步**：DSH Session Events + RPC
- **样式**：CSS Modules + CSS Variables（对齐 DSH 主题）

### 外部依赖
- DSH 原生服务：`ctx.llm`、`ctx.tools`、`ctx.sessions`、`ctx.sandbox`、`ctx.skills`
- DSH 子 Agent 机制：用于锻造流水线的各角色 Agent

---

## 系统架构

### 整体分层

```
┌──────────────────────────────────────────────────────────────┐
│                        Client Side                           │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐   │
│  │ Sidebar Panel│  │ In-Conversation  │  │ Settings Panel│   │
│  │ (锻造队列 +   │  │ Notification Card│  │ (安全等级 +   │   │
│  │  技能库 +    │  │                  │  │  触发阈值)    │   │
│  │  统计面板)   │  │                  │  │               │   │
│  └──────┬───────┘  └────────┬─────────┘  └───────┬───────┘   │
└─────────┼───────────────────┼────────────────────┼───────────┘
          │                   │ RPC / Events       │
┌─────────┼───────────────────┼────────────────────┼───────────┐
│         ▼                   ▼                    ▼           │
│                    Host Side (Cordis Plugin)                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                   Forge Orchestrator                 │    │
│  │  - 流水线状态机                                       │    │
│  │  - 任务调度（队列 + 并发控制）                         │    │
│  │  - 事件总线（广播锻造进度到 UI）                       │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │              Forge Pipeline (七层质量门)              │   │
│  │                                                        │   │
│  │  [0] Trigger ──► 值得提炼吗？                         │   │
│  │  [1] Extract ──► 能提取出方法论吗？                    │   │
│  │  [2] Generate ─► SKILL.md 结构完整吗？                │   │
│  │  [3] Verify  ──► 实际能用吗？(沙箱测试)               │   │
│  │  [4] Iterate  ──► 多轮优化(不通过→打回)              │   │
│  │  [5] Audit    ──► 安全吗？(静态扫描+去重)             │   │
│  │  [6] Approve  ──► 用户确认(可配置全自动/手动)         │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │                 Skill Registry                       │   │
│  │  - 版本化存储（SQLite + 文件系统）                    │   │
│  │  - 状态机：pending → active → archived → deprecated  │   │
│  │  - 谱系追踪：来源对话/锻造轮次/验证记录/变更历史      │   │
│  │  - 依赖图谱：技能之间的引用关系                       │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │               Injection Engine                       │   │
│  │  - 上下文感知召回（匹配当前任务 → 相关技能）          │   │
│  │  - Token 预算管理（技能注入不超限）                   │   │
│  │  - 按状态过滤（只注入 active 技能）                   │   │
│  │  - 置信度标注（未验证技能打"实验性"标签）             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 数据流

```
Session Events → Trigger Engine → Extractor → Generator → Verifier
                                                              │
                                                ┌─────────────┘
                                                │ 通过
                                                ▼
                                       Security Audit → Approval
                                                │
                                                ▼
                                       Skill Registry (active)
                                                │
                                                ▼
                              Injection Engine → Next Session
```

---

## 七大质量门详解

### Gate 0: Trigger — 触发判断

**目标**：只在对话值得提炼时才启动锻造，避免浪费 token。

**判断维度**：
- 对话长度（用户消息数 >= 阈值，默认 5）
- 任务复杂度（工具调用数 >= 阈值，默认 3）
- 任务完成度（是否达到了明确的目标状态）
- 新颖性（与已有技能的语义相似度低于阈值）

**工程手段**：
- 结构化评分：LLM 输出 JSON `{worth_forging: bool, score, reason}`，Zod 校验
- 冷却机制：同一会话最多触发 N 次锻造
- 批量触发：对话结束后统一判断，不在对话过程中打断

**失败处理**：
- **从不静默失败**：任何一个 Gate 未通过，都必须产生明确的失败通知，包含失败原因、失败的 Gate 编号、可查看的详情
- **UI 通知**：右侧面板锻造队列中显示失败状态（红色标记），对话内推送失败通知卡片
- **失败原因结构化**：每个 Gate 的失败都有 `failureReason` 字段（代码 + 描述 + 详情）
- **可重试**：失败的 ForgeRun 保留在列表中，用户可以一键重试（从失败的 Gate 处继续，或从头开始）
- **日志完整可查**：点击失败项可以展开查看完整的 LLM 输出、校验错误、原始输入等诊断信息
- **静默失败是 bug**：任何情况下，锻造任务的最终状态必须是明确的 success / failed / cancelled / rejected，不能消失

### Gate 1: Extract — 方法论提取

**目标**：从对话中提炼出结构化的方法论骨架，在生成完整 skill 前先验证"有没有料"。

**输出格式**（强制 JSON Schema）：
```typescript
{
  skillName: string           // kebab-case，全局唯一
  title: string               // 中文标题
  category: string            // 分类：debugging / workflow / tool-use / ...
  description: string         // 一句话描述
  coreIdea: string            // 核心思路
  steps: string[]             // 关键步骤（3-8 步）
  toolsUsed: string[]         // 用到的工具
  prerequisites: string[]     // 前置条件
  difficulty: 'basic' | 'intermediate' | 'advanced'
}
```

**工程手段**：
- Extractor Agent 只读对话历史，不执行任何操作
- 输出强制 Zod 校验，格式错误自动重试（最多 2 次）
- `skillName` 与已有技能库做去重检查

**失败处理**：提取不出清晰方法论 → 丢弃。

### Gate 2: Generate — SKILL.md 生成

**目标**：基于提取的骨架，生成完整规范的 SKILL.md。

**强制结构**（每个字段都必须有）：
```
---
name: skill-name
title: 技能标题
category: debugging
version: 0.1.0
status: pending
forgedFrom: [session-id]
forgedAt: timestamp
---

## 触发条件
什么时候应该使用这个技能。

## 核心思路
这个技能的核心方法论，1-2 段话讲清楚。

## 操作步骤
分步骤操作指南，每步有明确的动作和判断标准。

## 注意事项
常见坑点、边界情况、失败时的回退方案。

## 验证方法
怎么判断这个技能用对了、用好了。

## 相关技能
- related-skill-a：什么关系
- related-skill-b：什么关系
```

**工程手段**：
- 模板化生成，先填骨架再润色内容
- 生成后做字段完整性检查（缺字段 = 不通过）
- Markdown 格式校验（标题层级、列表结构）

**失败处理**：缺字段 → 自动补全提示后重试 1 次，仍失败 → 标记为草稿。

### Gate 3: Verify — 实际验证

**目标**：不是"看起来对"，而是"实际能用"。这是最核心的质量门。

**验证流程**：
1. Verifier Agent 阅读 skill 内容，生成 3 个测试用例
2. 每个测试用例包含：输入条件 + 预期产出 + 验证标准
3. 在隔离沙箱中，让一个独立 Agent 仅凭这个 skill 完成测试任务
3 个测试用例的通过率 >= 阈值（默认 2/3 = 67%）→ 通过

**工程手段**：
- 验证 Agent 工具集最小化（只有 skill 中提到的工具）
- 沙箱隔离：走 `ctx.sandbox.confine`，最严格的 workspace-read 模式
- 验证结果结构化：`{passed: bool, test_cases: [{name, passed, output, error}]}`
- 验证日志完整记录，用于后续迭代优化

**失败处理**：不通过 → 进入迭代优化循环（Gate 4）。

### Gate 4: Iterate — 迭代优化

**目标**：基于验证反馈，增量优化 skill，而不是推倒重写。

借鉴 SkillOpt 的文本空间优化思想：
- 不是重写整个 skill
- 针对验证失败的具体点，做 add/delete/replace 增量编辑
- 每轮优化后重新跑验证
- **严格不回退**：新版本验证分数必须 >= 旧版本才接受

**迭代约束**：
- 最大迭代轮数（默认 3 轮）
- 每轮有 token 预算上限
- 连续两轮无提升 → 提前终止

**失败处理**：达到最大轮数仍不通过 → 标记为 `draft`（草稿），入库但不激活，用户可以手动优化。

### Gate 5: Audit — 安全审计

**目标**：静态扫描 skill 内容，排除安全风险。

**检查项**：
- 危险命令模式：`rm -rf /`、`curl | bash`、密钥泄露正则等
- 越权操作：尝试访问工作区外的路径
- 与现有技能去重：语义相似度 > 阈值 → 标记为变体而非新技能
- 格式炸弹：过大的 skill、嵌套过深的结构

**工程手段**：
- 正则扫描 + 关键词匹配（确定性检查）
- 可选：语义安全评估（LLM 判断是否有潜在危险指令）
- 所有扫描结果结构化记录

**失败处理**：命中危险模式 → 直接拒绝入库，记录拒绝原因。

### Gate 6: Approve — 人工审核

**目标**：人做最终把关（可配置）。

**安全等级决定行为**：
- `strict`：所有自动锻造的 skill 必须人工确认才能激活
- `balanced`（默认）：验证通过率 >= 高阈值（如 100%）且无安全风险 → 自动激活；其余待审核
- `experimental`：全部自动激活，接受风险

**审核界面**：
- 展示 skill 完整内容 + 来源对话摘要 + 验证报告 + 安全扫描结果
- 操作：批准 / 修改后批准 / 拒绝（附原因）/ 要求重新锻造

**拒绝理由采集**：
用户点击"拒绝"时，弹出选择窗口：

1. **预设拒绝理由**（一键选择，可多选）：
   - 📉 **质量不达标** — 内容太水 / 不准确 / 不完整
   - 🎯 **不实用** — 应用场景太窄 / 日常用不上
   - ⚠️ **有安全隐患** — 可能执行危险操作 / 泄露隐私
   - 🔄 **与已有技能重复** — 和现有的 X 技能功能重叠
   - 🤔 **看不懂** — 描述含糊 / 逻辑混乱 / 不知道怎么用
   - 📝 **格式有问题** — 结构乱 / 缺少必要字段

2. **自定义文本框**：用户可以补充具体的改进意见或拒绝原因

3. **拒绝理由的去向**：
   - 结构化记录到 ForgeRun 的 `rejectionReason` 字段
   - 如果用户选择"重新锻造"，拒绝理由直接作为 RefinerAgent 的优化输入
   - 同类拒绝理由积累到阈值后，反哺 TriggerEngine 的质量阈值（如"质量不达标"拒绝多了，就提高生成门的标准）
   - 长期统计用于调整各 Gate 的阈值参数

**失败处理**：用户拒绝 → 记录拒绝原因，用于后续优化触发判断和生成质量。

---

## 四层安全体系

### Layer 1: 生成时安全

- 输出格式白名单：只允许 Markdown + YAML frontmatter
- 危险模式正则扫描（Gate 5 执行）
- 锻造 Agent 工具集最小化（生成阶段不授予文件写入/执行权限）
- 生成的 skill 先写入临时目录，不接触用户技能库

### Layer 2: 验证时安全

- 验证用例在独立沙箱执行（`ctx.sandbox.confine`）
- 验证 Agent 只能访问临时工作目录
- 验证用代码不持久化，跑完即清理
- 验证过程有超时限制，防止无限循环

### Layer 3: 入库时安全

- 所有自动锻造的 skill 默认状态 `pending-review`
- 每个 skill 标记来源：`forged`（自动锻造）/ `manual`（人工编写）
- 完整变更审计日志：谁在什么时候改了什么
- 版本化存储：每个版本完整保存，支持一键回滚
- 哈希去重：内容完全相同的 skill 不重复入库

### Layer 4: 使用时安全

- 技能注入有 token 预算上限（默认占总上下文的 10%）
- `draft` / `pending` 状态的技能不自动注入
- 低置信技能（验证通过率 < 80%）标注 "实验性" 标签
- 所有技能使用计入会话审计日志
- 用户可随时在设置中调整安全等级 / 禁用自动注入

---

## 技能库治理机制

> 技能不是越多越好。当技能库膨胀到一定规模，召回噪音上升、管理成本飙升，反而降低 Agent 效率。本项目内置技能库治理机制，借鉴 **达尔文.skill**（单体优化）和 **饕餮.skill**（跨技能进化）的设计思想。

### 触发条件

当以下任一条件满足时，系统主动提醒用户可以进行技能库治理：

| 触发条件 | 默认阈值 | 说明 |
|---------|---------|------|
| active 技能总数 | 30 个 | 技能过多导致召回噪音上升 |
| 语义相似度聚类数 | ≥ 3 组 | 多个技能做的事高度重叠 |
| 30 天未调用技能占比 | > 40% | 大量技能处于"僵尸"状态 |
| 用户手动触发 | — | 用户主动要求整理技能库 |

### 治理模式一：达尔文优化（单体技能持续进化）

借鉴 **达尔文.skill (alchaincyf/darwin-skill)** 的核心设计——像训练模型一样优化单个技能。

**适用场景**：某个技能质量不高、效果不稳定，需要持续打磨。

**核心机制**：
1. **9 维度评分体系**：对每个技能做质量评估
   - YAML frontmatter 完整性（结构合规）
   - Trigger phrase 质量（触发条件精准度）
   - 结构与层次（可读性）
   - Actionable Specificity（可执行的具体性——禁止"建议/根据情况/自行判断"等模糊措辞）
   - Failure Mechanism Encoding（已知失败路径是否显式编码）
   - 工具调用规范
   - 验证完备性（有没有测试用例）
   - 高风险操作黑名单（破坏性操作是否明确禁止）
   - 跨场景通用性

2. **爬山优化循环**：
   - 每次只改一个维度
   - 修改后用独立 judge agent 评分（避免自评估偏差——SkillLens 研究表明 LLM 自评估准确率只有 46.4%）
   - 分数提升就保留，下降就回滚（git ratchet 机制）
   - 遇到收益递减就自动停止

3. **人在回路**：每个技能优化完成后，暂停等待用户确认再继续下一个

**与锻造系统的关系**：
- 锻造（Forge）= 从 0 到 1 生成新技能
- 达尔文优化 = 从 1 到 N 打磨已有技能
- 两者共享 VerifierAgent 和评分基础设施

### 治理模式二：饕餮融合（跨技能优势吸收）

借鉴 **饕餮.skill (binggandata/bggg-skill-taotie)** 的核心设计——不是简单合并代码，而是理解"为什么好"，把优势渐进式注入。

**适用场景**：两个或多个技能功能重叠，或者一个技能明显比另一个强，想把强的那个的优势吸收到弱的那个里。

**核心流程**（5 阶段）：

```
Phase 1: 配对分析 → Phase 2: 并行测试 → Phase 3: 反向工程
     → Phase 4: 渐进注入 → Phase 5: 模式沉淀
```

1. **配对分析**：
   - 自动检测语义相似的技能组（基于 embedding 聚类）
   - 向用户呈现"这 N 个技能可能做的是类似的事，要融合吗？"
   - 用户指定目标技能（保留哪个）和参考源（吸收谁的优势）

2. **并行测试**：
   - 生成一组通用测试任务
   - 用 sub-agent 同时跑目标技能 A 和参考源 B
   - 全程追踪：调用链、输出质量、耗时、失败点

3. **反向工程**：
   - 分析 B 比 A 好在哪里：结构优势？方法论优势？工具使用技巧？验证机制？
   - 提炼成可复用的"模式"（pattern），而不是直接复制文字
   - 生成对比报告 + 改进建议列表

4. **渐进注入**：
   - 一次只注入一个改进点
   - 注入后立即验证效果
   - 有提升就保留，回退就撤销
   - 每一步都让用户确认（关键节点人在回路）

5. **模式沉淀**：
   - 成功的改进模式存入"模式库"（pattern library）
   - 下次优化其他技能时，可以直接调用已验证的模式
   - 模式库越用越准，形成学习闭环

**安全机制**：
- 修改前自动快照备份，随时可回滚
- 读取外部技能时检查安全隐患（prompt injection、恶意代码）
- 不自动执行不认识的脚本

### 治理模式三：优胜劣汰（技能库瘦身）

**适用场景**：技能库中有大量长期未使用、重复、或质量差的技能。

**淘汰机制**：
- **冷存储（archive）**：30 天未调用的技能自动标记为 `archived`，移出 active 注入池，但保留文件可随时恢复
- **重复合并建议**：对语义高度相似的技能组，建议用饕餮模式融合为一个更强的技能
- **质量末位提醒**：评分最低的 20% 技能，提醒用户"这些技能质量较差，要不要优化或归档？"
- **永不删除**：所有操作都是软删除/归档，用户可以随时找回——这是铁则

### 治理模式四：批量锻造（Dreaming 闲时进化）

借鉴 Letta (MemGPT) 的 "dreaming" 机制——空闲时批量回顾和整理。

**触发方式**：
- 用户手动触发："整理一下我的技能库"
- 定时触发：每周一次（可配置），在 DSH 空闲时运行
- 阈值触发：技能数量超过阈值时自动提醒

**闲时治理做什么**：
1. 扫描所有技能，更新质量评分
2. 检测语义相似度聚类，找出重复组
3. 对评分低的技能，自动生成一份改进建议（不自动修改，只给建议）
4. 生成技能库健康报告：总数、活跃率、重复率、平均质量分、Top 改进建议

---

## 记忆系统集成框架

> 锻造系统不是孤立存在的。它从 Agent 的记忆中提取经验，生成的技能又反过来增强 Agent 的能力。以下是与记忆系统的完整集成规划。

### 记忆与技能的关系定位

```
原始对话 ──► 记忆系统 ──► 锻造系统 ──► 技能库 ──► Agent 能力提升
  │              │            │            │
  │           事实/偏好    方法论/流程    结构化可复用
  │           记住什么     学会怎么做
  │
  └── 经验是原材料，记忆是仓储，锻造是加工，技能是成品
```

| 维度 | 记忆系统 | 锻造系统（技能） |
|------|---------|----------------|
| **存储内容** | 原子事实、偏好、事件、对话历史 | 结构化方法论、工作流程、最佳实践 |
| **粒度** | 细（一句话、一个偏好） | 粗（完整的解题流程） |
| **形式** | 非结构化/半结构化事实 | 结构化 SKILL.md + frontmatter |
| **触发方式** | 语义检索、实体匹配 | 意图匹配、场景触发、手动调用 |
| **时效性** | 可能过期（"用户在上海"可能变） | 相对稳定（方法论长期有效） |
| **质量要求** | 准确即可 | 需要验证、需要迭代 |

两者是**互补关系**，不是替代关系。记忆系统存"发生了什么"，锻造系统提炼"学会了什么"。

### 集成架构

```
┌─────────────────────────────────────────────────────────┐
│                    DSH Agent Runtime                     │
│                                                          │
│  ┌──────────────┐      ┌──────────────┐                  │
│  │  记忆插件      │      │  锻造系统      │                  │
│  │ (dsh-self-   │      │ (本项目)      │                  │
│  │  improved /   │◄────►│              │                  │
│  │  OpenViking)  │      │              │                  │
│  └──────┬───────┘      └──────┬───────┘                  │
│         │                     │                          │
│         ▼                     ▼                          │
│  ┌──────────────┐      ┌──────────────┐                  │
│  │  记忆存储      │      │  技能库        │                  │
│  │ (事实/偏好)    │      │ (SKILL.md)    │                  │
│  └──────────────┘      └──────────────┘                  │
│                                                          │
│         双向箭头：                                        │
│         1. 锻造系统从记忆中读取对话历史 → 提炼技能        │
│         2. 技能使用结果 → 回写到记忆中                   │
└─────────────────────────────────────────────────────────┘
```

### 数据流方向一：记忆 → 锻造（输入）

锻造系统从记忆系统获取原料，而不是自己存一份对话历史。

**数据接口**：
- **会话历史查询**：获取最近 N 个会话的完整轨迹
- **按时间范围查询**：获取某时间段内的所有对话
- **按话题聚类**：获取相似主题的对话集合（用于触发模式检测）
- **成功/失败标记**：获取任务完成状态（用于失败驱动分析）

**与现有记忆插件的兼容策略**：

| 记忆源 | 接入方式 | 优先级 |
|--------|---------|--------|
| **DSH 官方会话日志** (ctx.sessions) | 直接读取 — 原生 API | P0（默认） |
| **dsh-self-improved** | 读取其 L1/L2 提取结果 | P1 |
| **OpenViking memory plugin** | 读取其记忆条目 | P2 |
| **通用 MCP 记忆服务** (Mem0 等) | MCP 协议接入 | P3 |

**降级策略**：如果没有任何记忆插件，锻造系统直接从 DSH 原生的 session 日志中读取——这是最低依赖，保证插件装上就能用。

### 数据流方向二：锻造 → 记忆（回写）

技能的使用情况和效果应该回写到记忆系统，形成完整闭环。

**回写内容**：
- 技能调用记录（哪个技能在什么时候被调用了）
- 技能使用结果（成功/失败、用户反馈）
- 技能版本变更（什么时候被优化了、优化了什么）
- 锻造事件（什么时候生成了新技能、来源是什么）

**回写的价值**：
1. **增强召回**：记忆系统知道"用户曾经锻造过 X 技能"，在相关对话中可以主动提醒
2. **效果追踪**：可以统计一个技能从生成到现在被调用了多少次、成功率多少
3. **个性化触发**：根据用户的技能使用习惯，调整锻造的触发阈值和偏好

### 技能召回机制

借鉴 Grok Bot 的**描述符驱动自动路由**思想——每个技能的 `whenToUse` 和 `description` 就是它的描述符，Agent 遇到新任务时扫描技能目录，匹配到就加载。

**召回策略**：

| 召回方式 | 触发时机 | 说明 |
|---------|---------|------|
| **显式调用** | 用户直接说"用 X 技能" | 优先级最高 |
| **意图匹配** | 每轮对话开始前 | 用 LLM 判断当前任务是否应该加载某个技能 |
| **上下文注入** | 检测到特定关键词/模式 | 轻量级，基于规则 + embedding 相似度 |
| **主动推荐** | 对话结束/任务开始时 | "我检测到你在做 X，要不要试试 Y 技能？" |

**Token 预算管理**：
- 技能注入有 token 预算上限（默认总上下文的 10%）
- 按优先级排序：高置信 + 高相关 + 高使用率优先
- 超过预算时，低优先级的技能不注入正文，只在 skill catalog 中保留索引

### 闭环系统

最终形成完整的自适应循环：

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  对话经验 ──► 记忆提取 ──► 技能锻造 ──► 技能库       │
│     ▲                                           │   │
│     │                                           ▼   │
│     └──────── 效果反馈 ◄── 技能使用 ◄───────────┘   │
│                                                     │
│              （自适应进化闭环）                      │
└─────────────────────────────────────────────────────┘
```

这个闭环意味着：用得越多，技能越多越好，Agent 能力越强，进而产生更多高质量对话——正向飞轮。

---

## UI 设计

### 嵌入位置（DSH Slot 机制）

| 位置 | Slot 名称 | 内容 | 优先级 |
|------|----------|------|--------|
| 右侧边栏 Tab | `conversation.sidebar` | 锻造队列 + 技能库 + 统计 | P0 |
| 对话内通知卡片 | 对话流中插入 assistant message | "本次对话提炼出 1 个新技能，点击查看" | P1 |
| 设置页面 | Settings 新增分组 | 安全等级 / 触发阈值 / 验证轮数 / 自动注入开关 | P1 |
| 输入框上方 dock | `conversation.input.dock` | 快速锻造按钮 / 锻造状态指示 | P2 |

### 主要界面

#### 1. 锻造队列视图
```
┌─ Skill Forge ────────────────────────┐
│  🔨 锻造中 (2)                        │
│  ┌─────────────────────────────────┐ │
│  │ □ debug-python-import         │ │
│  │   Verifying...  2/3 tests     │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │ □ write-tests-efficiently      │ │
│  │   Generating...                │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ⏳ 待审核 (3)                        │
│  ┌─────────────────────────────────┐ │
│  │ ○ refactor-with-ast            │ │
│  │   Passed: 3/3  ·  点击审核     │ │
│  └─────────────────────────────────┘ │
│  ...                                 │
│                                       │
│  ✅ 今日已锻造 (5)                    │
│  📊 总计: 42 技能 | 78% 通过率        │
└───────────────────────────────────────┘
```

#### 2. 技能库视图
```
┌─ Skill Library ──────────────────────┐
│  🔍 搜索...     [分类 ▾] [状态 ▾]    │
│                                       │
│  ┌────┬───────────────┬──────┬─────┐ │
│  │ 🟢  │ debug-python  │ v1.2  │ ✓  │ │
│  │    │ 高效 Python 调试方法论        │ │
│  ├────┼───────────────┼──────┼─────┤ │
│  │ 🟡  │ write-tests   │ v0.3  │ ⚡ │ │
│  │    │ 测试用例生成与优化            │ │
│  ├────┼───────────────┼──────┼─────┤ │
│  │ ⚪  │ api-design    │ v0.1  │ ⏳ │ │
│  │    │ REST API 设计模式            │ │
│  └────┴───────────────┴──────┴─────┘ │
│                                       │
│  状态: 🟢 活跃  🟡 实验性  ⚪ 待审核  │
└───────────────────────────────────────┘
```

#### 3. 技能详情视图
```
┌─ Skill: debug-python-import ────────┐
│  v1.2.0  🟢 活跃  ·  debug 类        │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ 触发条件 / 核心思路 / 操作步骤... │ │
│  │ (SKILL.md 内容渲染)              │ │
│  └─────────────────────────────────┘ │
│                                       │
│  📊 验证报告                          │
│  最后验证: 2026-09-02  3/3 通过      │
│  历史验证: 5 次验证，平均通过率 87%   │
│                                       │
│  🔗 谱系追踪                          │
│  来源: session-abc123                │
│  锻造轮次: 3 轮                       │
│  版本历史: [v0.1] → [v1.0] → [v1.2] │
│                                       │
│  [重新锻造]  [归档]  [编辑]          │
└───────────────────────────────────────┘
```

---

## 分阶段路线图

### Phase 0: 环境搭建 & 最小插件（预计 2-3 个碎片块）

**目标**：跑通 DSH 插件开发→安装→调试的完整闭环。

**任务清单**：
- [ ] 安装 DSH 开发环境（从源码运行）
- [ ] 熟悉 Cordis 插件基本结构（name / inject / apply）
- [ ] 搭建 dsh-skill-forge 项目骨架（TypeScript + pnpm）
- [ ] 实现最小插件：注册一个 `forge_hello` 工具
- [ ] 配置 `dsh.bundle` + `cordis.patch.yml`
- [ ] 安装到本地 DSH profile 并验证加载
- [ ] 编写项目 README

**交付物**：可加载的空壳插件 + 开发环境就绪

### Phase 1: 单角色锻造 & 手动确认（预计 3-4 个碎片块）

**目标**：有一条完整但简单的锻造流水线。

**任务清单**：
- [ ] 监听 session 事件，实现触发判断（Gate 0）
- [ ] Extractor Agent：从对话提取结构化方法论（Gate 1）
- [ ] Generator Agent：生成 SKILL.md（Gate 2）
- [ ] Skill Registry 基础版：SQLite 存储 + CRUD
- [ ] 锻造状态机：`forging → pending-review → active / rejected`
- [ ] Client 侧：右侧边栏基础 UI（锻造队列 + 待审核列表）
- [ ] 人工审核界面（批准 / 拒绝）
- [ ] 技能注入：active 状态的技能注入到系统提示

**交付物**：可用的 MVP——对话后能自动生成 skill 草稿，用户审核后入库并生效

### Phase 2: 验证循环 & 迭代优化（预计 4-5 个碎片块）

**目标**：核心质量门落地，锻造质量显著提升。

**任务清单**：
- [ ] Verifier Agent：生成测试用例（Gate 3 上半）
- [ ] 沙箱验证执行：在隔离环境中跑测试用例（Gate 3 下半）
- [ ] 验证结果结构化 + 通过率计算
- [ ] Refiner Agent：基于验证反馈的增量优化（Gate 4）
- [ ] 迭代循环：不通过 → 优化 → 重新验证，最多 N 轮
- [ ] 严格不回退：版本间验证分数对比
- [ ] Security Audit：危险模式扫描 + 去重（Gate 5）
- [ ] 安全等级配置：strict / balanced / experimental
- [ ] UI 更新：验证报告展示 + 锻造进度细化

**交付物**：完整的自动锻造流水线，技能经过验证后入库

### Phase 3: 技能库 & 智能召回（预计 3-4 个碎片块） ✅ 核心完成

**目标**：技能管理和使用体验完善，从"能锻造"到"好用"。

**任务清单**：
- [x] 版本管理完整实现：创建版本、版本列表、版本详情
- [x] 回滚功能：一键回滚到历史版本
- [ ] 谱系追踪：来源会话、锻造记录、衍生技能
- [ ] 技能依赖图谱：相关技能、前置技能、替代技能
- [x] 使用统计：使用次数、最后使用时间、成功率反馈
- [x] 归档/废弃/复活功能
- [x] 实现关键词匹配召回（baseline）
- [x] 实现分类过滤 + 状态过滤
- [x] Token 预算管理：计算注入内容 token 数，控制在预算内
- [x] 置信度排序：验证分数 + 使用频率 + 新鲜度加权
- [ ] 注入点选择：走 DSH 系统提示段还是工具调用前注入
- [x] 技能使用反馈钩子：skill 被使用了 / 没用上 / 帮了倒忙
- [x] 技能搜索：关键词搜索 + 分类筛选 + 状态筛选 + 排序
- [x] 技能卡片：名称、分类、状态徽章、版本、验证分数
- [x] 技能详情页：完整内容 + 版本历史 + 统计网格 + 操作栏
- [ ] 版本对比：相邻版本 diff 展示
- [ ] 谱系可视化：来源 + 衍生技能关系图
- [ ] 技能操作：手动创建 / 编辑 / 归档 / 废弃 / 重新锻造（部分完成）
- [ ] 统计仪表盘：总览统计 / 锻造统计 / 质量趋势 / 分类分布
- [x] 设置面板完善（大部分完成）
- [x] 配置热更新
- [ ] 对话内体验优化（通知卡片等）

**交付物**：产品级的技能管理体验，可日常使用

**当前状态**：核心功能（搜索/版本/智能召回/统计）已完成，谱系追踪/版本diff/统计仪表盘待做

### Phase 4: 产品化 & 发布（预计 2-3 个碎片块）

**目标**：开源发布，社区可用。

**任务清单**：
- [ ] 完善文档：README / 安装指南 / 配置说明 / 架构文档
- [ ] 演示视频 / GIF
- [ ] npm 包发布
- [ ] GitHub 仓库整理（Issue 模板 / PR 模板 / License）
- [ ] 添加 `dsh-plugin` topic
- [ ] 提交到 awesome-dsh-plugin 等社区目录
- [ ] 写一篇介绍博客

**交付物**：正式发布的开源项目

---

## 数据模型

### Skill 表
```sql
CREATE TABLE skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,          -- kebab-case 标识
  title TEXT NOT NULL,                -- 中文标题
  category TEXT NOT NULL,             -- 分类
  description TEXT,                   -- 一句话描述
  content TEXT NOT NULL,              -- SKILL.md 完整内容
  version TEXT NOT NULL DEFAULT '0.1.0',
  status TEXT NOT NULL DEFAULT 'pending', -- pending/active/archived/deprecated/draft
  source TEXT NOT NULL DEFAULT 'forged', -- forged/manual
  verification_score REAL,            -- 最近一次验证通过率 0-1
  verification_count INTEGER DEFAULT 0, -- 累计验证次数
  usage_count INTEGER DEFAULT 0,      -- 使用次数
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);
```

### ForgeRun 表（锻造记录）
```sql
CREATE TABLE forge_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER,                   -- 关联的 skill（可能为 null 如果被拒）
  skill_name TEXT NOT NULL,
  session_id TEXT NOT NULL,           -- 来源会话
  trigger_score REAL,                 -- 触发评分
  status TEXT NOT NULL,               -- forging/succeeded/failed/rejected
  current_gate INTEGER,               -- 当前在第几道质量门
  failure_reason TEXT,                -- 失败原因
  iterations INTEGER DEFAULT 0,       -- 迭代轮数
  final_score REAL,                   -- 最终验证分数
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);
```

### Version 表（版本历史）
```sql
CREATE TABLE skill_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  content TEXT NOT NULL,              -- 该版本的完整 SKILL.md
  verification_score REAL,
  change_summary TEXT,                -- 变更摘要
  forged_by TEXT,                     -- forged/manual/user-id
  created_at INTEGER NOT NULL,
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);
```

### Provenance 表（谱系关联）
```sql
CREATE TABLE skill_provenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,          -- session / skill / manual
  source_id TEXT NOT NULL,            -- 会话 ID 或 父技能 ID
  relationship TEXT,                  -- forged-from / inspired-by / merged-from
  detail TEXT,                        -- 额外说明
  created_at INTEGER NOT NULL,
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);
```

---

## 关键技术决策记录

### ADR-001: 为什么选择 SQLite 而不是纯文件系统？

**决策**：技能元数据用 SQLite 存储，SKILL.md 内容同时写入文件系统（兼容 DSH 原生 skill 机制）。

**理由**：
1. 查询 / 筛选 / 统计需要结构化存储
2. 版本历史和谱系追踪用关系型数据更自然
3. 文件系统的 SKILL.md 保证与 DSH 原生技能系统兼容
4. SQLite 零依赖、单文件、易备份

### ADR-002: 为什么质量门用结构化输出 + Zod 校验？

**决策**：所有 LLM 输出强制走 JSON Schema，Zod 做运行时校验。

**理由**：
1. 质量控制不能靠 LLM "自觉"，必须有确定性的检查机制
2. 格式错误自动重试，减少人工介入
3. Zod 的类型推导可以直接复用在 TypeScript 类型系统中
4. 与学界 SkillOpt / EvoSkills 的方法论一致：结构化编辑 > 自由文本生成

### ADR-003: 为什么 UI 嵌入 DSH 而不单开页面？

**决策**：优先通过 DSH Slot 机制嵌入 Web UI。

**理由**：
1. 用户体验连贯，不用切换上下文
2. 安装成本低，装完插件直接能用
3. DSH 的 slot 机制设计就是为了扩展 UI
4. 如果 slot 不够用，可以降级为独立 tab 或浮动面板

### ADR-004: 为什么默认安全等级是 balanced 而不是 strict？

**决策**：默认 balanced（高置信自动 + 低置信待审核）。

**理由**：
1. strict 模式审核负担太重，用户容易关掉整个功能
2. balanced 在安全和体验之间取平衡
3. 验证通过率 100% + 安全扫描无异常的 skill，自动激活风险可控
4. 用户可以随时调到 strict 或 experimental

---

## 风险与应对

| 风险 | 影响 | 概率 | 应对 |
|------|------|------|------|
| DSH API 变动（开发预览阶段） | 高 | 高 | 封装适配层，隔离对 DSH 内部 API 的直接依赖；紧跟版本更新 |
| 锻造 token 成本过高 | 中 | 中 | 触发门严格把关 + 迭代轮数上限 + token 预算配置 |
| 验证用例质量不稳定 | 高 | 中 | 验证 Agent 给明确的方法论指导 + 多轮生成选最优 + 人工审核兜底 |
| Slot 机制限制多，UI 难做 | 中 | 中 | 先做最简 UI 验证可行性；不行就走 RPC + iframe / 浮动面板方案 |
| 技能召回不准（注入了没用的 skill） | 中 | 中 | 初期简单关键词匹配 + 手动开关；后期语义检索 + 使用反馈优化 |

---

## 附录 A：状态机定义

### A.1 ForgeRun 状态机（锻造任务生命周期）

```
                    ┌─────────────┐
                    │   created   │  创建锻造任务
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ triggering  │  Gate 0: 判断是否值得锻造
                    └──────┬──────┘
                     ┌─────┴─────┐
                     │           │
                  值得          不值得
                     │           │
                     ▼           ▼
                ┌─────────┐  ┌───────┐
                │extracting│  │skipped│  Gate 0 未通过
                └────┬────┘  └───────┘
                     │  Gate 1: 提取方法论
                ┌────┴─────┐
                │          │
             提取成功    提取失败
                │          │
                ▼          ▼
           ┌─────────┐  ┌────────┐
           │generating│  │ failed │  Gate 1 未通过
           └────┬────┘  └────────┘
                │  Gate 2: 生成 SKILL.md
           ┌────┴─────┐
           │          │
        生成成功    生成失败
           │          │
           ▼          ▼
      ┌─────────┐  ┌────────┐
      │verifying│  │ failed │  Gate 2 未通过
      └────┬────┘  └────────┘
           │  Gate 3: 沙箱验证
      ┌────┴──────────┐
      │               │
   通过 >= 阈值     通过率低
      │               │
      ▼          ┌────▼────┐
 ┌─────────┐     │iterating│  Gate 4: 迭代优化（最多 N 轮）
 │auditing │     └────┬────┘
 └────┬────┘          │
      │  Gate 5:      │ 还有迭代次数？
      │ 安全审计    ┌──┴──┐
 ┌────┴───────┐    是    否
 │            │    │     │
 安全      不安全   ▼     ▼
 │            │  重新验证  ┌──────────┐
 ▼            ▼          │  draft   │  达到迭代上限仍不通过
┌──────┐  ┌──────────┐   └──────────┘
│approving│  │ rejected │  Gate 5 未通过
└───┬───┘  └──────────┘
    │  Gate 6: 人工审核
    │  (根据安全等级可能跳过)
 ┌──┴──────┐
 │         │
批准      拒绝
 │         │
 ▼         ▼
┌──────┐  ┌──────────┐
│active│  │ rejected │
└──────┘  └──────────┘
```

**状态列表**：

| 状态 | 说明 | 进入条件 | 可转移到 |
|------|------|----------|----------|
| `created` | 任务已创建，尚未开始 | 新任务入队 | triggering |
| `triggering` | Gate 0：触发判断中 | 任务被调度 | extracting / skipped |
| `skipped` | 不值得锻造，跳过 | Gate 0 未通过 | （终态） |
| `extracting` | Gate 1：方法论提取中 | Gate 0 通过 | generating / failed |
| `generating` | Gate 2：SKILL.md 生成中 | Gate 1 通过 | verifying / failed |
| `verifying` | Gate 3：验证执行中 | Gate 2 通过 | auditing / iterating |
| `iterating` | Gate 4：迭代优化中 | 验证不通过且有剩余迭代次数 | verifying / draft |
| `draft` | 草稿状态（迭代后仍不通过） | 达到最大迭代次数 | （终态，可人工激活） |
| `auditing` | Gate 5：安全审计中 | 验证通过 | approving / rejected |
| `approving` | Gate 6：待人工审核 | 安全审计通过（且安全等级要求人工审核） | active / rejected |
| `active` | 已激活（入库可用） | 审核通过（或自动激活） | archived / deprecated |
| `archived` | 已归档（不再自动注入） | 长期未使用 / 手动归档 | active |
| `deprecated` | 已废弃（标记为不推荐） | 有更好的替代 / 过时 | （终态） |
| `failed` | 锻造失败（生成环节出错） | 提取/生成失败且重试耗尽 | （终态） |
| `rejected` | 被拒绝（安全/审核不通过） | 安全扫描失败 / 人工拒绝 | （终态） |

### A.2 Skill 状态机（技能生命周期）

```
 pending-review ──approve──▶ active ──archive──▶ archived
      │                      │  ▲                    │
      │                      │  │                    │
   reject                 use ─┘                 unarchive
      │                      │                    │
      ▼                      ▼                    │
   rejected             deprecated ◀──────────────┘
                            ▲
                            │
                       mark-deprecated
```

**状态说明**：

| 状态 | 自动注入 | 可见性 | 说明 |
|------|---------|--------|------|
| `pending-review` | ❌ | 待审核列表 | 刚锻造完成，等待人工确认 |
| `active` | ✅ | 技能库主列表 | 正常可用，参与自动召回 |
| `archived` | ❌ | 归档列表 | 历史技能，可恢复 |
| `deprecated` | ❌（仅标记） | 带废弃标记 | 有更好替代，不推荐使用 |
| `draft` | ❌ | 草稿列表 | 迭代未通过，半成品 |
| `rejected` | ❌ | 拒绝历史 | 审核/安全不通过 |

---

## 附录 B：核心模块接口设计

### B.1 ForgeOrchestrator（锻造调度器）

```typescript
// 锻造调度器 —— 管理锻造任务的入队、调度、状态流转

interface ForgeOrchestrator {
  // 入队一个新的锻造任务
  enqueue(sessionId: string, options?: ForgeOptions): Promise<ForgeRun>;

  // 获取锻造任务状态
  getRun(runId: string): Promise<ForgeRun | null>;

  // 列出锻造任务（支持筛选和分页）
  listRuns(filter?: ForgeRunFilter): Promise<ForgeRun[]>;

  // 取消一个进行中的锻造任务
  cancelRun(runId: string): Promise<void>;

  // 获取当前队列状态（进行中数 / 等待中数 / 今日完成数）
  getQueueStats(): Promise<QueueStats>;

  // 事件：锻造状态变更（UI 订阅更新）
  on(event: 'run-updated', handler: (run: ForgeRun) => void): () => void;
}

interface ForgeOptions {
  // 强制触发（跳过 Gate 0 判断）
  force?: boolean;
  // 锻造优先级
  priority?: 'low' | 'normal' | 'high';
  // 指定从哪条消息之前的对话提取
  upToMessageId?: string;
}

interface ForgeRunFilter {
  status?: ForgeRunStatus | ForgeRunStatus[];
  sessionId?: string;
  skillName?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'completed_at';
  sortOrder?: 'asc' | 'desc';
}
```

### B.2 TriggerEngine（触发引擎）

```typescript
// Gate 0: 判断对话是否值得提炼 skill

interface TriggerEngine {
  // 评估一个会话是否值得锻造
  evaluate(sessionId: string): Promise<TriggerEvaluation>;
}

interface TriggerEvaluation {
  worthForging: boolean;
  score: number;          // 0-100
  reason: string;
  dimensions: {
    conversationLength: number;     // 用户消息数
    toolCallComplexity: number;     // 工具调用复杂度
    taskCompletion: number;         // 任务完成度
    noveltyScore: number;           // 与已有技能的新颖性（越低越新颖）
  };
  suggestedSkillName?: string;      // 建议的技能名（可选）
  suggestedCategory?: string;       // 建议的分类
}
```

### B.3 ExtractorAgent（提取 Agent）

```typescript
// Gate 1: 从对话中提取结构化方法论骨架

interface ExtractorAgent {
  extract(sessionId: string): Promise<ExtractionResult>;
}

interface ExtractionResult {
  success: boolean;
  skillName: string;
  title: string;
  category: string;
  description: string;
  coreIdea: string;
  steps: string[];
  toolsUsed: string[];
  prerequisites: string[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
  keyInsights: string[];      // 关键洞见
  failureReason?: string;     // 提取失败的原因
}
```

### B.4 GeneratorAgent（生成 Agent）

```typescript
// Gate 2: 基于提取的骨架生成完整 SKILL.md

interface GeneratorAgent {
  generate(extraction: ExtractionResult): Promise<GenerationResult>;
}

interface GenerationResult {
  success: boolean;
  content: string;           // 完整的 SKILL.md 内容
  frontmatter: {             // YAML frontmatter 解析结果
    name: string;
    title: string;
    category: string;
    version: string;
    status: string;
  };
  validation: {
    hasAllRequiredSections: boolean;
    missingSections: string[];
    markdownValid: boolean;
    frontmatterValid: boolean;
  };
  failureReason?: string;
}
```

### B.5 VerifierAgent（验证 Agent）

```typescript
// Gate 3: 生成测试用例并在沙箱中验证

interface VerifierAgent {
  // 生成测试用例
  generateTests(skillContent: string): Promise<TestCase[]>;

  // 执行验证（在沙箱中运行测试）
  runVerification(
    skillContent: string,
    testCases: TestCase[]
  ): Promise<VerificationResult>;
}

interface TestCase {
  id: string;
  name: string;
  description: string;
  input: string;             // 给 Agent 的任务描述
  expectedOutput: string;    // 预期产出描述
  verificationCriteria: string; // 判断通过的标准
  difficulty: 'easy' | 'medium' | 'hard';
}

interface VerificationResult {
  totalTests: number;
  passedTests: number;
  passRate: number;          // 0-1
  testResults: TestResult[];
  overallAssessment: string; // 总体评估
  failurePatterns: string[]; // 失败模式总结（用于迭代优化）
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  output: string;
  error?: string;
  durationMs: number;
}
```

### B.6 RefinerAgent（优化 Agent）

```typescript
// Gate 4: 基于验证反馈迭代优化 skill（SkillOpt 思想）

interface RefinerAgent {
  refine(
    currentSkill: string,
    verificationResult: VerificationResult,
    iteration: number
  ): Promise<RefinementResult>;
}

interface RefinementResult {
  success: boolean;
  newContent: string;        // 优化后的 SKILL.md
  edits: Edit[];             // 做了哪些修改（增量编辑）
  rationale: string;         // 修改理由
  expectedImprovement: string; // 预期改进点
}

interface Edit {
  type: 'add' | 'delete' | 'replace';
  section: string;           // 修改的章节
  oldText?: string;
  newText?: string;
  reason: string;
}
```

### B.7 SecurityAuditor（安全审计器）

```typescript
// Gate 5: 静态安全扫描 + 去重

interface SecurityAuditor {
  audit(skillContent: string, skillName: string): Promise<AuditResult>;
}

interface AuditResult {
  passed: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  findings: AuditFinding[];
  duplicateCheck: DuplicateCheckResult;
}

interface AuditFinding {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'dangerous-command' | 'credential-leak' | 'path-traversal' | 'format-issue' | 'other';
  message: string;
  location?: {
    line: number;
    snippet: string;
  };
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarSkills: SimilarSkill[];
}

interface SimilarSkill {
  skillId: number;
  skillName: string;
  similarity: number;       // 0-1
  relationship: 'duplicate' | 'variant' | 'related';
}
```

### B.8 SkillRegistry（技能注册库）

```typescript
// 技能存储、版本管理、谱系追踪

interface SkillRegistry {
  // CRUD
  createSkill(data: SkillCreate): Promise<Skill>;
  getSkill(id: number): Promise<Skill | null>;
  getSkillByName(name: string): Promise<Skill | null>;
  listSkills(filter?: SkillFilter): Promise<Skill[]>;
  updateSkill(id: number, data: SkillUpdate): Promise<Skill>;
  updateStatus(id: number, status: SkillStatus): Promise<Skill>;

  // 版本管理
  getVersions(skillId: number): Promise<SkillVersion[]>;
  getVersion(versionId: number): Promise<SkillVersion | null>;
  rollbackToVersion(skillId: number, versionId: number): Promise<Skill>;
  createVersion(skillId: number, data: VersionCreate): Promise<SkillVersion>;

  // 谱系
  getProvenance(skillId: number): Promise<ProvenanceEntry[]>;
  addProvenance(skillId: number, entry: ProvenanceCreate): Promise<void>;
  getDerivedSkills(skillId: number): Promise<Skill[]>;

  // 使用统计
  incrementUsage(skillId: number): Promise<void>;
  recordVerification(skillId: number, score: number): Promise<void>;
}
```

### B.9 InjectionEngine（注入引擎）

```typescript
// 上下文感知的技能召回与注入

interface InjectionEngine {
  // 获取当前会话应该注入的技能
  getSkillsForContext(
    sessionId: string,
    currentTurn: TurnContext
  ): Promise<InjectedSkill[]>;

  // 计算注入内容的总 token 数
  estimateTokens(skills: InjectedSkill[]): number;

  // 技能使用反馈（用于优化召回排序）
  recordUsage(skillId: number, sessionId: string, outcome: 'used' | 'ignored' | 'harmful'): void;
}

interface InjectedSkill {
  skillId: number;
  skillName: string;
  title: string;
  content: string;
  relevanceScore: number;    // 相关性评分
  confidence: 'high' | 'medium' | 'low';
  source: 'auto-injected' | 'user-activated' | 'always-on';
}

interface TurnContext {
  userMessage: string;
  recentMessages: Message[];
  activeTools: string[];
  currentGoal?: string;
}
```

### B.10 事件定义

```typescript
// ForgeOrchestrator 发出的事件（UI 侧订阅以更新界面）

type ForgeEvent =
  | { type: 'run-created'; run: ForgeRun }
  | { type: 'run-status-changed'; runId: string; status: ForgeRunStatus; prevStatus: ForgeRunStatus }
  | { type: 'gate-progress'; runId: string; gate: number; gateName: string; progress: number }
  | { type: 'verification-update'; runId: string; testIndex: number; totalTests: number; passed: boolean }
  | { type: 'iteration-update'; runId: string; iteration: number; maxIterations: number; score: number }
  | { type: 'run-completed'; run: ForgeRun; skill?: Skill }
  | { type: 'run-failed'; run: ForgeRun; reason: string }
  | { type: 'run-cancelled'; runId: string };

// SkillRegistry 发出的事件
type SkillEvent =
  | { type: 'skill-created'; skill: Skill }
  | { type: 'skill-updated'; skill: Skill }
  | { type: 'skill-status-changed'; skillId: number; status: SkillStatus }
  | { type: 'skill-version-created'; skillId: number; version: SkillVersion };
```

---

## 附录 C：LLM Prompt 草案

> 以下为各 Agent 的 System Prompt 草案，实际开发中会根据效果迭代调整。

### C.1 Trigger Evaluator（触发判断）

**Role**: 对话价值评估专家

**Task**: 评估一段 AI 对话是否值得提炼为一个可复用的 Agent Skill。

**Evaluation Dimensions**:
1. **对话长度**：用户消息数量是否足够（< 3 条通常不值得）
2. **任务复杂度**：涉及多少工具调用、多少步骤的推理
3. **任务完成度**：对话是否达到了明确的目标状态
4. **新颖性**：这段对话的方法论是否是独特的，还是已有技能覆盖了

**Output Format (JSON ONLY)**:
```json
{
  "worth_forging": true,
  "score": 75,
  "reason": "对话展示了一套完整的 Python 调试流程，涉及多步推理和工具组合使用",
  "dimensions": {
    "conversation_length": 8,
    "tool_call_complexity": 7,
    "task_completion": 9,
    "novelty_score": 3
  },
  "suggested_skill_name": "debug-python-import-issues",
  "suggested_category": "debugging"
}
```

**Rules**:
- 只输出 JSON，不要任何其他文本
- `score` 是 0-100 的整数，>=60 才建议锻造
- `novelty_score` 越低表示越新颖（与已有技能重叠少）
- `suggested_skill_name` 使用 kebab-case 格式

### C.2 Method Extractor（方法论提取）

**Role**: 方法论提炼专家

**Task**: 从一段 AI 对话中，提炼出结构化的方法论骨架。你的目标是找出这段对话中 Agent 使用的**核心思路和操作步骤**，而不是具体的代码或答案。

**What to extract**:
- **skill_name**: 技能唯一标识（kebab-case，英文）
- **title**: 技能的中文标题（简洁有力）
- **category**: 分类（debugging / workflow / tool-use / research / writing / refactoring / testing / other）
- **description**: 一句话描述这个技能是做什么的
- **core_idea**: 核心思路，1-2 段话讲清楚方法论的本质
- **steps**: 关键步骤列表（3-8 步，每步是动作+判断标准）
- **tools_used**: 用到的工具名称列表
- **prerequisites**: 使用前需要满足的前置条件
- **difficulty**: basic / intermediate / advanced
- **key_insights**: 3-5 条关键洞见

**Output Format (JSON ONLY)**:
```json
{
  "success": true,
  "skill_name": "example-skill",
  "title": "示例技能",
  "category": "debugging",
  "description": "一句话描述",
  "core_idea": "核心思路...",
  "steps": ["步骤 1...", "步骤 2..."],
  "tools_used": ["bash", "read_file"],
  "prerequisites": ["前提条件 1"],
  "difficulty": "intermediate",
  "key_insights": ["洞见 1"]
}
```

**Rules**:
- 只输出 JSON
- 提炼的是**方法论**，不是具体问题的答案
- 步骤要有可操作性，不是空话
- 如果对话太零散、提炼不出清晰的方法论，返回 `success: false` 和原因

### C.3 Skill Generator（SKILL.md 生成）

**Role**: 技能文档撰写专家

**Task**: 基于已提取的方法论骨架，生成一份完整、规范、高质量的 SKILL.md 文档。

**Skill Template**:
```markdown
---
name: {{skill_name}}
title: {{title}}
category: {{category}}
version: 0.1.0
status: pending
forged_from: []
forged_at: {{timestamp}}
---

## 触发条件
什么时候应该使用这个技能。描述清楚适用场景和判断信号。

## 核心思路
这个技能的核心方法论，1-2 段话讲清楚本质。为什么这个方法有效。

## 操作步骤
分步骤操作指南，每步有明确的动作和判断标准。用有序列表。
1. 第一步：做什么，怎么判断完成了
2. 第二步：...

## 注意事项
- 常见坑点和陷阱
- 边界情况怎么处理
- 失败时的回退方案

## 验证方法
怎么判断这个技能用对了、用好了。有哪些成功信号。

## 相关技能
- related-skill-a：什么关系（前置/补充/替代）
- related-skill-b：...
```

**Rules**:
- 严格按照模板结构生成，每个章节都要有内容
- 语言是中文（除了 name 字段）
- 内容要具体、可操作，不要空话套话
- Markdown 格式正确，标题层级清晰
- frontmatter 字段完整且格式正确

### C.4 Test Case Generator（验证用例生成）

**Role**: 测试用例设计专家

**Task**: 给定一个 Agent Skill 的内容，设计 3 个测试用例来验证这个技能是否真的有效。

**Test Case Requirements**:
- 每个测试用例是一个独立的小任务，Agent 需要运用这个技能来完成
- 测试用例要覆盖技能的核心步骤
- 难度递增：easy → medium → hard
- 每个测试用例有明确的验证标准（怎么算通过）
- 测试环境是一个隔离的沙箱，只有基本工具可用

**Output Format (JSON ONLY)**:
```json
{
  "test_cases": [
    {
      "id": "test-1",
      "name": "测试用例名称",
      "description": "简要描述",
      "input": "给 Agent 的任务描述，就像用户真实提问一样",
      "expected_output": "预期产出的描述",
      "verification_criteria": "判断通过的具体标准，要可量化可验证",
      "difficulty": "easy"
    }
  ]
}
```

**Rules**:
- 只输出 JSON
- 恰好 3 个测试用例
- 测试用例要真实可信，像真实用户会提的问题
- 验证标准要具体，不能是"结果合理"这种模糊描述

### C.5 Verification Evaluator（验证结果评估）

**Role**: 测试结果评估专家

**Task**: 给定测试用例和 Agent 的实际执行结果，判断测试是否通过。

**Input**:
- 测试用例描述 + 验证标准
- Agent 的完整执行过程（工具调用 + 输出）

**What to evaluate**:
1. Agent 是否使用了目标技能的方法论
2. 任务是否完成
3. 产出质量如何
4. 过程中有什么问题

**Output Format (JSON ONLY)**:
```json
{
  "passed": true,
  "score": 85,
  "summary": "总体评估...",
  "criteria_met": ["标准 1", "标准 2"],
  "criteria_missed": ["标准 3"],
  "skill_usage": {
    "used_correctly": true,
    "steps_followed": ["step1", "step2"],
    "steps_skipped": ["step4"],
    "deviations": ["偏离说明"]
  },
  "failure_pattern": "（如果失败，属于什么模式）",
  "improvement_suggestion": "具体的改进建议"
}
```

### C.6 Skill Refiner（迭代优化）

**Role**: 技能优化专家（SkillOpt 方法论执行者）

**Task**: 基于验证结果，对技能进行增量优化。你的目标是**只改有问题的部分**，不要重写整个技能。

**Input**:
- 当前的 SKILL.md 完整内容
- 验证结果（哪些测试通过了，哪些失败了，失败模式是什么）
- 当前迭代轮次

**Optimization Strategy**:
1. 先定位问题：哪个章节/哪一步导致了失败
2. 做最小化修改：只改需要改的地方
3. 遵循 SkillOpt 原则：增量编辑、可回溯、严格不回退
4. 每处修改都要有明确的理由

**Output Format (JSON ONLY)**:
```json
{
  "success": true,
  "new_content": "完整的修改后 SKILL.md 内容",
  "edits": [
    {
      "type": "replace",
      "section": "操作步骤",
      "old_text": "原来的步骤描述...",
      "new_text": "修改后的步骤描述...",
      "reason": "原步骤缺少边界情况处理，导致测试 2 失败"
    }
  ],
  "rationale": "总体修改理由...",
  "expected_improvement": "预期能修复测试 2 的失败，提升通过率到 3/3"
}
```

**Rules**:
- 只输出 JSON
- 编辑数量控制在 1-5 处（太多说明方向错了）
- 不修改已通过测试覆盖的内容
- `new_content` 必须是完整有效的 SKILL.md

### C.7 Security Scanner（安全扫描辅助）

**Role**: 安全审计助手

**Task**: 检查一份 SKILL.md 中是否包含安全风险内容。

**Check Categories**:
1. **危险命令**: rm -rf /、curl | bash、mkfs、dd if=/dev/...
2. **凭据泄露模式**: API key、password、secret、token 的正则模式
3. **路径遍历**: 尝试访问工作区外路径（../、/etc/、/root/）
4. **越权操作**: 修改系统配置、安装软件、修改其他用户文件
5. **内容炸弹**: 过大的文件、无限循环指令、递归炸弹

**Output Format (JSON ONLY)**:
```json
{
  "risk_level": "none",
  "findings": [
    {
      "severity": "warning",
      "category": "dangerous-command",
      "message": "包含 rm -rf 命令",
      "line": 42,
      "snippet": "rm -rf ./temp"
    }
  ]
}
```

**Rules**:
- 只输出 JSON
- `risk_level`: none / low / medium / high / critical
- 注意区分真风险和示例代码中的风险（示例代码风险等级低一级）

---

---

## 附录 D：项目目录结构

```
dsh-skill-forge/
├── README.zh.md                     # 中文简介
├── README.en.md                     # 英文简介
├── PLAN.md                          # 完整规划文档
│
├── package.json                     # 包配置 + dsh.bundle 声明
├── tsconfig.json                    # TypeScript 配置
├── pnpm-lock.yaml
│
├── cordis.patch.yml                 # DSH bundle patch 文件（插件注册入口）
│
├── src/
│   ├── index.ts                     # 插件主入口（name + inject + apply）
│   ├── config.ts                    # 配置 Schema + 默认值
│   ├── types.ts                     # 全局类型定义（状态枚举、接口）
│   │
│   ├── orchestrator/                # 锻造调度器
│   │   ├── index.ts                 # ForgeOrchestrator 实现
│   │   ├── state-machine.ts         # 状态机逻辑
│   │   └── queue.ts                 # 任务队列 + 并发控制
│   │
│   ├── gates/                       # 七大质量门
│   │   ├── 00-trigger/              # Gate 0: 触发判断
│   │   │   ├── engine.ts            # 触发引擎
│   │   │   └── prompt.ts            # Trigger Evaluator Prompt
│   │   ├── 01-extract/              # Gate 1: 方法论提取
│   │   │   ├── extractor.ts
│   │   │   └── prompt.ts
│   │   ├── 02-generate/             # Gate 2: SKILL.md 生成
│   │   │   ├── generator.ts
│   │   │   ├── template.ts          # SKILL.md 模板
│   │   │   └── prompt.ts
│   │   ├── 03-verify/               # Gate 3: 沙箱验证
│   │   │   ├── verifier.ts
│   │   │   ├── test-runner.ts       # 测试执行器（沙箱）
│   │   │   └── prompt.ts
│   │   ├── 04-refine/               # Gate 4: 迭代优化
│   │   │   ├── refiner.ts
│   │   │   ├── diff.ts              # diff 工具
│   │   │   └── prompt.ts
│   │   ├── 05-audit/                # Gate 5: 安全审计
│   │   │   ├── auditor.ts
│   │   │   ├── patterns.ts          # 危险模式正则
│   │   │   └── dedup.ts             # 去重检查
│   │   └── 06-approve/              # Gate 6: 人工审核
│   │       └── approval.ts          # 审核逻辑（安全等级判断）
│   │
│   ├── registry/                    # 技能注册库
│   │   ├── index.ts                 # SkillRegistry 实现
│   │   ├── db.ts                    # SQLite 连接 + schema 初始化
│   │   ├── migrations/              # 数据库迁移
│   │   │   └── 001_init.sql
│   │   ├── skill-store.ts           # skill CRUD
│   │   ├── version-store.ts         # 版本管理
│   │   └── provenance-store.ts      # 谱系追踪
│   │
│   ├── injection/                   # 注入引擎
│   │   ├── index.ts                 # InjectionEngine 实现
│   │   ├── retriever.ts             # 技能召回（关键词 + 简单语义）
│   │   └── token-budget.ts          # Token 预算管理
│   │
│   ├── llm/                         # LLM 调用封装
│   │   ├── client.ts                # 基于 ctx.llm 的调用封装
│   │   ├── structured-output.ts     # 结构化输出 + Zod 校验 + 重试
│   │   └── sub-agent.ts             # 子 Agent 调用封装
│   │
│   ├── events/                      # 事件总线
│   │   ├── index.ts                 # 事件定义 + 类型
│   │   └── bus.ts                   # 事件总线实现
│   │
│   ├── utils/                       # 工具函数
│   │   ├── markdown.ts              # Markdown 解析/校验
│   │   ├── yaml.ts                  # YAML frontmatter 解析
│   │   ├── zod.ts                   # Zod 辅助函数
│   │   └── logger.ts                # 日志封装
│   │
│   └── client/                      # Client 侧（Web UI）
│       ├── index.ts                 # Client 插件入口
│       ├── slots.ts                 # Slot 注册
│       ├── rpc.ts                   # Host <-> Client RPC
│       │
│       ├── components/              # React 组件
│       │   ├── ForgePanel/          # 锻造面板（侧边栏 tab）
│       │   │   ├── index.tsx
│       │   │   ├── ForgeQueue.tsx   # 锻造队列
│       │   │   ├── PendingList.tsx  # 待审核列表
│       │   │   ├── StatsCard.tsx    # 统计卡片
│       │   │   └── styles.css
│       │   ├── SkillLibrary/        # 技能库
│       │   │   ├── index.tsx
│       │   │   ├── SkillCard.tsx
│       │   │   ├── SkillDetail.tsx
│       │   │   ├── SearchBar.tsx
│       │   │   └── VersionHistory.tsx
│       │   ├── NotificationCard/    # 对话内通知卡片
│       │   │   └── index.tsx
│       │   ├── SettingsPanel/       # 设置面板
│       │   │   ├── index.tsx
│       │   │   ├── SecurityLevel.tsx
│       │   │   └── Thresholds.tsx
│       │   └── common/              # 通用组件
│       │       ├── StatusBadge.tsx
│       │       ├── ProgressBar.tsx
│       │       └── EmptyState.tsx
│       │
│       ├── hooks/                   # React Hooks
│       │   ├── useForgeQueue.ts
│       │   ├── useSkillLibrary.ts
│       │   └── useForgeEvents.ts
│       │
│       ├── store/                   # 客户端状态
│       │   └── forge-store.ts       # 锻造相关状态
│       │
│       └── styles/                  # 全局样式
│           ├── variables.css        # CSS 变量（对齐 DSH 主题）
│           └── globals.css
│
├── scripts/                         # 脚本
│   ├── build.sh                     # 构建脚本
│   └── dev.sh                       # 开发模式（watch + 自动 reload）
│
├── tests/                           # 测试
│   ├── unit/                        # 单元测试
│   │   ├── gates/
│   │   ├── registry/
│   │   └── utils/
│   └── fixtures/                    # 测试数据
│       ├── sample-session.json
│       └── sample-skill.md
│
└── assets/                          # 静态资源
    └── icon.svg
```

### 目录设计原则

1. **Host / Client 分离**：`src/` 下大部分是 Host 侧（Node.js），`src/client/` 是 Browser 侧（React），二者通过 RPC 通信
2. **按领域组织**：每个质量门一个目录，内部逻辑 + prompt 放在一起，方便维护
3. **可渐进式开发**：目录结构对应路线图阶段，Phase 1 只需要 gates/00-02 + registry 基础版
4. **可测试性**：每个模块独立导出，方便单元测试

---

## 附录 E：配置项设计

### E.1 配置 Schema

```typescript
interface SkillForgeConfig {
  // ===== 触发设置 =====
  trigger: {
    enabled: boolean;           // 是否自动触发锻造
    minConversationTurns: number; // 最少对话轮数（用户消息数）
    minToolCalls: number;       // 最少工具调用数
    minScoreThreshold: number;  // 最低触发评分（0-100）
    maxForgingPerSession: number; // 单个会话最多锻造次数
    cooldownMinutes: number;    // 两次锻造之间的冷却时间（分钟）
  };

  // ===== 质量门设置 =====
  gates: {
    verification: {
      enabled: boolean;         // 是否启用验证
      numTestCases: number;     // 测试用例数量
      passThreshold: number;    // 通过阈值（0-1，如 0.67 = 2/3）
      sandboxMode: 'workspace-read' | 'workspace-write' | 'full-access';
      testTimeoutMs: number;    // 单个测试超时
    };

    iteration: {
      maxIterations: number;    // 最大迭代轮数
      improvementThreshold: number; // 最小提升幅度（低于此值则停止）
      maxEditsPerIteration: number; // 每轮最多编辑处数
    };

    security: {
      enabled: boolean;         // 是否启用安全审计
      autoRejectRiskLevel: 'critical' | 'high' | 'medium' | 'low'; // 高于此等级自动拒绝
      enableDuplicateCheck: boolean; // 是否启用去重检查
      duplicateThreshold: number; // 去重相似度阈值（0-1）
    };
  };

  // ===== 安全等级 =====
  securityLevel: 'strict' | 'balanced' | 'experimental';
  // strict:       全部人工审核
  // balanced:     高置信（100% 通过 + 无安全风险）自动激活，其余待审核
  // experimental: 全部自动激活

  // ===== 技能注入设置 =====
  injection: {
    enabled: boolean;           // 是否自动注入技能
    maxSkillsPerTurn: number;   // 每回合最多注入技能数
    tokenBudgetPercent: number; // 技能注入占总 token 预算的百分比
    minConfidence: 'high' | 'medium' | 'low'; // 最低置信度
    injectMode: 'auto' | 'manual' | 'always-on'; // 注入模式
  };

  // ===== 存储设置 =====
  storage: {
    dataDir: string;            // 数据目录（默认 ~/.dsh/skill-forge/）
    skillFilesDir: string;      // SKILL.md 文件存储目录（默认在 DSH skills 目录下）
    databasePath: string;       // SQLite 数据库路径
    maxVersionsPerSkill: number; // 每个技能最多保留版本数
  };

  // ===== UI 设置 =====
  ui: {
    showNotificationCards: boolean; // 是否显示对话内通知卡片
    autoOpenPanelOnNew: boolean;    // 有新锻造时自动打开面板
    defaultView: 'queue' | 'library' | 'stats'; // 默认视图
  };

  // ===== 高级设置 =====
  advanced: {
    llmModelForForging?: string;   // 锻造用模型（默认同主模型）
    llmModelForVerification?: string; // 验证用模型（可选择更强的模型）
    maxConcurrentForging: number;  // 最大并发锻造任务数
    enableTelemetry: boolean;      // 是否启用使用统计（本地）
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}
```

### E.2 默认配置

```typescript
const DEFAULT_CONFIG: SkillForgeConfig = {
  trigger: {
    enabled: true,
    minConversationTurns: 5,
    minToolCalls: 3,
    minScoreThreshold: 60,
    maxForgingPerSession: 3,
    cooldownMinutes: 10,
  },
  gates: {
    verification: {
      enabled: true,
      numTestCases: 3,
      passThreshold: 0.67,
      sandboxMode: 'workspace-read',
      testTimeoutMs: 120000,
    },
    iteration: {
      maxIterations: 3,
      improvementThreshold: 0.1,
      maxEditsPerIteration: 5,
    },
    security: {
      enabled: true,
      autoRejectRiskLevel: 'high',
      enableDuplicateCheck: true,
      duplicateThreshold: 0.85,
    },
  },
  securityLevel: 'balanced',
  injection: {
    enabled: true,
    maxSkillsPerTurn: 5,
    tokenBudgetPercent: 10,
    minConfidence: 'medium',
    injectMode: 'auto',
  },
  storage: {
    dataDir: '~/.dsh/skill-forge/',
    skillFilesDir: '~/.dsh/skills/forged/',
    databasePath: '~/.dsh/skill-forge/skills.db',
    maxVersionsPerSkill: 20,
  },
  ui: {
    showNotificationCards: true,
    autoOpenPanelOnNew: false,
    defaultView: 'queue',
  },
  advanced: {
    maxConcurrentForging: 2,
    enableTelemetry: true,
    logLevel: 'info',
  },
};
```

### E.3 配置加载机制

1. **默认值**：内置 DEFAULT_CONFIG
2. **用户配置**：从 DSH settings 读取（`ctx.settings` 或本地 YAML 文件）
3. **会话级覆盖**：每个会话可以通过 `/forge-config` 命令临时调整
4. **热更新**：配置变更后，正在进行的锻造不受影响，新锻造使用新配置

---

## 附录 F：Phase 0-1 任务拆分清单

### Phase 0：环境搭建 & 最小插件

**目标**：跑通 DSH 插件开发→安装→调试的完整闭环。
**预估时间**：2-3 个碎片块

#### 0.1 DSH 开发环境就绪
- [ ] 确认 Node.js 版本 >= 22.19.0
- [ ] 确认 pnpm 已安装（Corepack 启用）
- [ ] `cd deepseek-harness && pnpm install` 安装依赖
- [ ] `pnpm run build` 构建（或至少构建核心包）
- [ ] `pnpm dsh web` 启动 Web UI，确认 http://127.0.0.1:3080 可访问
- [ ] 配置 API Key，确认能正常对话

#### 0.2 插件项目骨架
- [ ] 在插件目录执行 `pnpm init`
- [ ] 安装 TypeScript + 类型包
- [ ] 配置 tsconfig.json（strict mode, ESM）
- [ ] 安装 DSH 相关依赖（`@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools` 等）
- [ ] 创建 `src/index.ts`（最小插件：name + apply，console.log 打印加载信息）
- [ ] 创建 `cordis.patch.yml`（注册插件行）
- [ ] 在 `package.json` 中声明 `dsh.bundle.patch`

#### 0.3 安装 & 验证
- [ ] 通过 `dsh plugin --profile web add /path/to/dsh-skill-forge` 安装本地插件
- [ ] 启动 DSH Web，检查控制台日志确认插件已加载
- [ ] 尝试触发插件功能（注册一个工具，在对话中调用）
- [ ] 验证插件卸载后干净无残留

#### 0.4 开发体验
- [ ] 配置 watch 模式（tsc --watch）
- [ ] 配置 HMR 或自动 reload 流程
- [ ] 写一个最简单的测试
- [ ] 完善 .gitignore
- [ ] 初始化 git 仓库

### Phase 1：单角色锻造 & 手动确认（MVP）

**目标**：有一条完整但简单的锻造流水线——对话后自动生成 skill 草稿，用户审核后入库。
**预估时间**：3-4 个碎片块

#### 1.1 事件监听 & 触发判断（Gate 0）
- [ ] 学习 DSH session 事件系统
- [ ] 监听 `session/turn-stopped` 或等价事件
- [ ] 实现基础的触发判断（简单规则：对话长度 + 工具调用数，先不用 LLM）
- [ ] 触发后创建 ForgeRun 记录，状态为 extracting
- [ ] 事件总线雏形：锻造状态变更事件

#### 1.2 数据库 & SkillRegistry 基础版
- [ ] 安装 better-sqlite3 或等价库
- [ ] 设计并初始化数据库 schema（skills / forge_runs / skill_versions 表）
- [ ] 实现 SkillRegistry 的基础 CRUD
- [ ] 实现 ForgeRun 的创建/更新/查询

#### 1.3 Extractor Agent（Gate 1）
- [ ] 封装 LLM 调用（基于 DSH 原生 `ctx.llm` 或子 Agent）
- [ ] 实现结构化输出 + Zod 校验 + 自动重试
- [ ] 编写 Extractor Prompt
- [ ] 从会话历史提取方法论骨架
- [ ] 校验失败 → 重试 → 仍失败 → ForgeRun 状态 failed

#### 1.4 Generator Agent（Gate 2）
- [ ] 编写 SKILL.md 模板
- [ ] 编写 Generator Prompt
- [ ] 生成完整 SKILL.md
- [ ] 字段完整性检查（frontmatter + 各章节）
- [ ] 生成成功 → ForgeRun 状态移至 approving（Gate 6 直接进入审核）
- [ ] 生成失败 → 重试 → 仍失败 → failed

#### 1.5 Host 侧审核接口
- [ ] 实现 approve / reject 方法
- [ ] approve → 写入 skill 到文件系统 + 数据库 + 状态 active
- [ ] reject → 记录拒绝原因 + 状态 rejected
- [ ] 技能写入到 DSH 原生 skills 目录，确认能被 DSH 技能系统识别

#### 1.6 Client 侧基础 UI
- [ ] 学习 DSH Slot 机制和 Client 插件开发
- [ ] 注册侧边栏 tab（"Skill Forge"）
- [ ] 实现 Host <-> Client RPC 通信
- [ ] 锻造队列组件：进行中 + 待审核 + 已完成
- [ ] 待审核列表 + 批准/拒绝按钮
- [ ] 技能库基础列表（展示已激活的技能）
- [ ] 样式对齐 DSH 主题（CSS variables）

#### 1.7 MVP 验证
- [ ] 端到端测试：发起一段对话 → 自动触发锻造 → 生成 skill → 人工审核 → 入库
- [ ] 验证技能注入：新的对话中能否看到并使用锻造出来的技能
- [ ] 验证卸载干净：插件卸载后无残留
- [ ] 修复发现的 bug
- [ ] 更新 README，写 MVP 使用说明

---

---

## 附录 G：Phase 2-4 任务拆分清单

### Phase 2：验证循环 & 迭代优化

**目标**：核心质量门落地——验证+迭代循环，锻造出来的技能是真正能用的。
**预估时间**：4-5 个碎片块

#### 2.1 VerifierAgent — 测试用例生成（Gate 3 上半）
- [ ] 编写 Test Case Generator Prompt
- [ ] 实现测试用例生成逻辑
- [ ] 测试用例 Schema 定义 + Zod 校验
- [ ] 用例质量检查：覆盖度评估、难度分布是否合理
- [ ] 失败重试：生成质量不好 → 重新生成

#### 2.2 沙箱测试执行器（Gate 3 下半）
- [ ] 研究 DSH 沙箱机制（`ctx.sandbox.confine`）
- [ ] 设计测试执行环境：临时工作目录 + 最小工具集
- [ ] 实现测试执行器：启动一个子 Agent，给它注入待测 skill，让它完成测试任务
- [ ] 测试超时控制 + 资源限制
- [ ] 测试结果收集：完整的执行轨迹 + 最终产出

#### 2.3 验证评估（Verification Evaluator）
- [ ] 编写 Verification Evaluator Prompt
- [ ] 实现评估逻辑：对比测试用例的验证标准 vs 实际执行结果
- [ ] 结构化输出：passed / score / failure_pattern / improvement_suggestion
- [ ] 多测试用例汇总：计算总通过率、失败模式分析
- [ ] 验证报告持久化：存到数据库，关联 ForgeRun

#### 2.4 RefinerAgent — 迭代优化（Gate 4）
- [ ] 编写 Skill Refiner Prompt（SkillOpt 方法论）
- [ ] 实现增量编辑逻辑：add / delete / replace 三种编辑类型
- [ ] 编辑验证：修改后的内容格式仍然有效
- [ ] 严格不回退：新版本验证分数必须 >= 旧版本才接受
- [ ] 迭代循环控制：最大轮数 + 最小提升幅度 + 无提升提前终止

#### 2.5 SecurityAuditor — 安全审计（Gate 5）
- [ ] 实现危险命令模式扫描（正则）
- [ ] 实现凭据泄露模式扫描（API key / password / token 等）
- [ ] 实现路径遍历检测
- [ ] 实现格式检查：文件大小、结构完整性
- [ ] 实现去重检查：与已有技能的语义相似度比较
- [ ] 审计结果结构化 + 分级（none / low / medium / high / critical）
- [ ] 自动拒绝逻辑：风险等级超过阈值 → 直接 rejected

#### 2.6 锻造流水线整合
- [ ] 把 Gate 3/4/5 串进 ForgeOrchestrator 的状态机
- [ ] 迭代循环的状态管理：iterating → verifying → iterating ...
- [ ] 失败路径处理：验证超时、LLM 调用失败、沙箱错误
- [ ] 锻造进度细化：每个质量门的子进度
- [ ] 事件细化：verification-update / iteration-update 事件

#### 2.7 UI — 验证报告 & 锻造详情
- [ ] 锻造任务详情页：展示每一步的状态和结果
- [ ] 验证报告展示：每个测试用例的通过/失败、耗时、输出
- [ ] 版本对比：迭代前后 skill 内容的 diff 展示
- [ ] 安全审计结果展示：风险项列表
- [ ] 失败的锻造也可以查看（为什么失败、卡在哪一步）

#### 2.8 Phase 2 验证
- [ ] 端到端测试：一个有明确方法论的对话 → 完整锻造流程 → 产出可验证的技能
- [ ] 验证迭代优化效果：初始不通过 → 经过几轮优化后通过率提升
- [ ] 验证安全审计：故意构造有风险的 skill → 确认被拦截
- [ ] 性能测试：一次完整锻造的 token 消耗、耗时
- [ ] 更新文档

### Phase 3：技能库 & 智能召回

**目标**：技能管理和使用体验完善，从"能锻造"到"好用"。
**预估时间**：3-4 个碎片块

#### 3.1 SkillRegistry 完善
- [ ] 版本管理完整实现：创建版本、版本列表、版本详情
- [ ] 回滚功能：一键回滚到历史版本
- [ ] 谱系追踪：来源会话、锻造记录、衍生技能
- [ ] 技能依赖图谱：相关技能、前置技能、替代技能
- [ ] 使用统计：使用次数、最后使用时间、成功率反馈
- [ ] 归档/废弃/复活功能

#### 3.2 InjectionEngine — 智能召回
- [ ] 实现关键词匹配召回（baseline）
- [ ] 实现分类过滤 + 状态过滤
- [ ] Token 预算管理：计算注入内容 token 数，控制在预算内
- [ ] 置信度排序：验证分数 + 使用频率 + 新鲜度加权
- [ ] 注入点选择：走 DSH 系统提示段还是工具调用前注入
- [ ] 技能使用反馈钩子：skill 被使用了 / 没用上 / 帮了倒忙

#### 3.3 UI — 技能库完善
- [ ] 技能搜索：关键词搜索 + 分类筛选 + 状态筛选 + 排序
- [ ] 技能卡片：名称、分类、状态徽章、版本、验证分数
- [ ] 技能详情页：完整内容 + 版本历史 + 谱系图 + 使用统计
- [ ] 版本历史：时间线展示，可对比相邻版本 diff
- [ ] 谱系可视化：来源 + 衍生技能关系图
- [ ] 技能操作：手动创建 / 编辑 / 归档 / 废弃 / 重新锻造

#### 3.4 UI — 统计仪表盘
- [ ] 总览统计：总技能数、活跃数、待审核、草稿、归档
- [ ] 锻造统计：本周锻造数、成功率、平均迭代轮次、平均耗时
- [ ] 质量趋势：验证通过率变化曲线
- [ ] 分类分布：各分类技能数量饼图
- [ ] Token 统计：锻造消耗 token 趋势
- [ ] 失败原因分布：最常失败的质量门和原因

#### 3.5 设置面板完善
- [ ] 安全等级切换：strict / balanced / experimental
- [ ] 触发阈值配置：对话长度、工具调用数、评分阈值
- [ ] 验证配置：测试用例数、通过阈值、最大迭代轮数
- [ ] 注入配置：是否自动注入、最大技能数、Token 预算
- [ ] 存储配置：数据目录、最大版本数
- [ ] 高级设置：锻造用模型、并发数、日志级别
- [ ] 配置实时生效（热更新）

#### 3.6 对话内体验优化
- [ ] 通知卡片：锻造完成后在对话中弹出通知
- [ ] 快捷操作：通知卡片上直接点批准/拒绝
- [ ] 技能引用：对话中提到某个 skill 时显示预览卡片
- [ ] 锻造按钮：输入框旁的快捷锻造按钮（手动触发）
- [ ] 锻造状态指示：正在锻造时的小图标/进度条

#### 3.7 Phase 3 验证
- [ ] 技能库功能完整测试：CRUD + 搜索 + 筛选 + 排序
- [ ] 技能注入验证：新对话中相关技能被正确注入
- [ ] 回滚功能验证：回滚到旧版本后内容正确
- [ ] 统计数据准确性验证
- [ ] 性能测试：技能库有 100+ 技能时的搜索/查询响应速度

### Phase 4：产品化 & 发布

**目标**：开源发布，社区可用。
**预估时间**：2-3 个碎片块

#### 4.1 代码质量
- [ ] 代码审查：清理临时代码、TODO、console.log
- [ ] 类型检查：TypeScript strict 模式无错误
- [ ] Lint：配置 ESLint + 修复问题
- [ ] 单元测试：核心模块（状态机、注册表、安全审计）覆盖率 > 70%
- [ ] 集成测试：端到端测试脚本
- [ ] CI/CD：GitHub Actions（lint + type-check + test）

#### 4.2 文档完善
- [ ] README 中文完整版：功能介绍、特性、安装、使用、配置、架构
- [ ] README 英文完整版
- [ ] 快速开始指南：5 分钟上手
- [ ] 配置参考文档：所有配置项的详细说明
- [ ] 常见问题 FAQ
- [ ] 贡献指南：如何开发、如何提交 PR
- [ ] 架构文档：系统架构图 + 各模块说明
- [ ] CHANGELOG.md

#### 4.3 演示材料
- [ ] 项目 Logo / 图标
- [ ] README 头图 / banner
- [ ] 演示 GIF：锻造流程 + 技能库 + 验证报告
- [ ] 演示视频（可选）：5 分钟完整演示
- [ ] 示例技能：几个手工打造的高质量示例 skill

#### 4.4 发布准备
- [ ] npm 包准备：package.json 字段完善、版本号
- [ ] 构建脚本：tsc + 产物清理 + 打包
- [ ] .npmignore 配置
- [ ] License 文件（MIT）
- [ ] GitHub 仓库设置：描述、话题标签、社区规范
- [ ] Issue 模板 / PR 模板
- [ ] 代码仓库初始化 & 首次提交

#### 4.5 社区发布
- [ ] 发布到 npm
- [ ] GitHub Release（v0.1.0）
- [ ] 添加 `dsh-plugin` topic
- [ ] 提交到 awesome-dsh-plugin 等社区目录
- [ ] 提交到 dsh-plugin.org / dshbase 等插件站
- [ ] 在 DSH Discord / GitHub Discussions 宣传
- [ ] 写一篇介绍博客 / 推文

#### 4.6 发布后
- [ ] 收集社区反馈
- [ ] 修复发现的 bug
- [ ] 规划 v0.2.0 功能
- [ ] 建立社区沟通渠道

---

## 附录 H：关键技术实现细节

### H.1 LLM 调用策略

#### 结构化输出保障
所有 LLM 输出**必须**通过 Zod Schema 校验，不接受自由文本。

**三层保障**：
1. **Prompt 层**：明确要求输出 JSON，给出完整的 JSON Schema 示例
2. **解析层**：JSON.parse + Zod validate，失败自动重试
3. **修复层**：连续 2 次解析失败 → 调用修复 LLM，给它错误信息让它修正输出

**重试策略**：
- 最多重试 3 次
- 每次重试附带之前的错误信息
- 3 次都失败 → 返回明确的错误，不静默降级

#### 模型选择策略
| 任务 | 模型选择 | 理由 |
|------|---------|------|
| 触发判断 | 快速模型（如 V3-flash） | 任务简单，省成本 |
| 方法论提取 | 主模型 | 需要理解对话，复杂度中等 |
| 技能生成 | 主模型 | 核心输出，质量要求高 |
| 测试用例生成 | 主模型 | 需要创造力和严谨性 |
| 验证评估 | 主模型 / 更强模型 | 判断性工作，越强越准 |
| 迭代优化 | 主模型 / 更强模型 | 需要精准定位问题 |
| 安全扫描 | 快速模型 + 正则 | 大部分靠正则，LLM 只做辅助 |

> 配置项 `advanced.llmModelForVerification` 允许用户指定验证用更强的模型。

#### Token 预算控制
- 每次锻造预估 token 消耗：触发判断 ≈ 2k + 提取 ≈ 8k + 生成 ≈ 6k + 验证 × 3 ≈ 30k + 迭代 × N ≈ 可变
- 配置项 `trigger.minScoreThreshold` 间接控制频率，从而控制总成本
- 锻造队列 + 并发上限防止 token 爆发

### H.2 子 Agent 调用方式

锻造流水线中的各角色 Agent 通过 **DSH 原生子 Agent 机制** 实现，而非直接调用 LLM API。

**原因**：
1. 复用 DSH 的工具调用、会话管理、沙箱机制
2. 验证阶段需要执行代码/操作，子 Agent 天然支持
3. 继承 DSH 的模型配置、凭据管理

**子 Agent 配置**：
- Proposer / Extractor / Generator：工具集最小化（只有读权限）
- Verifier：沙箱模式下的完整工具集（workspace-read）
- Refiner：只有文件编辑权限（改 skill 文件）
- 所有子 Agent 走独立会话，不污染主对话

### H.3 沙箱验证实现方案

```
┌─────────────────────────────────────────────┐
│          验证沙箱环境                        │
│                                             │
│  ┌─────────────┐    ┌────────────────────┐  │
│  │ 临时工作目录 │    │  验证子 Agent      │  │
│  │ (测试用文件)  │◀───┤  - 注入待测 skill │  │
│  │             │    │  - 最小工具集      │  │
│  │ test-input/ │    │  - workspace-read  │  │
│  │ expected/   │    │    模式            │  │
│  └─────────────┘    └──────────┬─────────┘  │
│                                │            │
│                       ┌────────▼─────────┐  │
│                       │  执行轨迹采集     │  │
│                       │  - 工具调用记录    │  │
│                       │  - 输出快照       │  │
│                       │  - 耗时统计       │  │
│                       └────────┬─────────┘  │
│                                │            │
│                       ┌────────▼─────────┐  │
│                       │  Verification    │  │
│                       │  Evaluator       │  │
│                       │  (评估结果)       │  │
│                       └──────────────────┘  │
│                                             │
│  生命周期：创建 → 执行 → 评估 → 销毁        │
│  所有数据不落盘到主工作区                    │
└─────────────────────────────────────────────┘
```

**沙箱隔离级别**：
- 默认 `workspace-read` 模式（只能读临时目录，不能修改主工作区）
- 某些技能验证需要写权限 → 只在临时目录写，验证完即销毁
- 网络访问：默认关闭，需要时可配置开启

### H.4 技能注入机制

#### 注入点选择
走 DSH 的**系统提示段**（system prompt section）机制，通过 `ctx.systemPrompt` 注册一个 section。

**优势**：
- 是 DSH 官方扩展点，稳定
- 技能内容始终在上下文中，模型不会"忘了用"
- Token 计算走 DSH 原生机制

#### 注入策略
```
每次新回合开始前：
1. 分析当前用户消息 + 最近对话上下文
2. 从技能库中检索相关技能（关键词 + 分类匹配）
3. 按置信度排序（验证分数 + 使用频率 + 新鲜度）
4. 按顺序加入注入列表，直到接近 Token 预算上限
5. 生成 "Available Skills" 系统提示段
```

#### Token 预算控制
- 默认占用总上下文的 10%（可配置）
- 每个技能有预估 token 数（生成后缓存）
- 预算不够时优先塞高置信度技能
- 至少保留 1 个技能的空间（如果预算真的很小）

### H.5 增量编辑（SkillOpt 实现）

借鉴 SkillOpt 论文的文本空间优化思想：

#### 编辑原语
三种原子编辑操作：
1. **add**：在指定 section 末尾添加内容
2. **delete**：删除指定 section 中的某段内容
3. **replace**：替换指定 section 中的某段内容

#### 编辑约束
- 每轮最多编辑 5 处（可配置）
- 只修改验证失败涉及的章节，不碰已验证通过的部分
- 每次编辑必须有明确的理由（关联到具体的测试失败）
- 编辑后必须通过格式校验（frontmatter 完整、Markdown 有效）

#### 严格不回退
```
每轮迭代后：
1. 重新跑全部测试用例
2. 比较新版本 vs 旧版本的通过率
3. 新版本 >= 旧版本 → 接受，继续下一轮
4. 新版本 < 旧版本 → 拒绝，回退到上一版
5. 连续 2 轮无提升 → 停止迭代
```

### H.6 谱系追踪实现

每个技能带完整的谱系信息：

```
Skill: debug-python-import
├── 来源
│   ├── 锻造自: session-abc123
│   ├── 锻造轮次: 3 轮
│   └── 初始触发时间: 2026-09-03
│
├── 版本历史
│   ├── v0.1.0 (draft) — 初始生成，验证 1/3 通过
│   ├── v0.1.1 (draft) — 优化步骤 2，验证 2/3 通过
│   ├── v0.2.0 (active) — 重构核心思路，验证 3/3 通过
│   └── v0.2.1 (active) — 补充注意事项，验证 3/3 通过
│
├── 衍生技能
│   ├── debug-python-dependencies（基于本技能扩展）
│   └── debug-python-env（分支变体）
│
└── 相关技能
    ├── python-project-setup（前置技能）
    └── debug-general（补充/替代）
```

**数据模型**：
- `skill_provenance` 表记录所有谱系关系
- 类型：forged-from（锻造自）/ derived-from（衍生自）/ related-to（相关）
- 支持图谱查询：找一个技能的所有上下游

### H.7 去重检测

#### 两层去重
1. **精确去重**：skill 内容哈希相同 → 完全重复，直接拒绝
2. **语义去重**：语义相似度 > 阈值 → 标记为变体，用户决定是否入库

#### 语义相似度实现（渐进式）
- **Phase 1-2**：关键词重叠度 + 标题相似度（简单快速，无额外依赖）
- **Phase 3+**：可选引入本地 embedding 模型（如 bge-small）做语义相似度
- 配置项控制：阈值可调，可关闭语义去重

### H.8 事件驱动架构

整个系统基于事件驱动，各模块之间通过事件总线通信，不直接依赖。

```
ForgeOrchestrator ──事件──▶ UI (实时更新)
       │
       ├──事件──▶ SkillRegistry (状态变更)
       │
       └──事件──▶ Logger / Telemetry
```

**事件类型**（见附录 B.10）：
- 锻造生命周期事件：created / status-changed / completed / failed / cancelled
- 进度事件：gate-progress / verification-update / iteration-update
- 技能变更事件：skill-created / skill-updated / skill-status-changed
- 系统事件：config-changed / error

**优势**：
- 模块解耦，方便测试
- UI 订阅事件即可实时更新，不需要轮询
- 容易扩展（加个新功能只需要监听事件）

### H.9 错误处理策略

每一层都有明确的错误处理和降级路径：

| 层级 | 错误类型 | 处理方式 |
|------|---------|----------|
| LLM 调用 | 网络超时 / 速率限制 | 指数退避重试（最多 3 次），仍失败则锻造失败 |
| LLM 输出 | 格式错误 / Schema 校验失败 | 自动重试（附带错误信息），3 次失败则锻造失败 |
| 沙箱执行 | 超时 / 崩溃 | 标记为测试失败，计入验证结果 |
| 数据库 | 写入失败 | 回滚事务，记录错误，锻造失败 |
| 文件系统 | 写入失败 | 回滚，记录错误，锻造失败 |
| UI 通信 | RPC 失败 | 降级为轮询，或显示错误提示 |

**设计原则**：
- 失败要有明确的状态，不能静默挂起
- 用户能看到失败原因
- 所有失败都计入统计，用于后续优化

### H.10 性能优化点

1. **锻造并发控制**：默认最多 2 个并发锻造任务，防止资源耗尽
2. **数据库索引**：skills(name) / forge_runs(status, created_at) / skill_versions(skill_id)
3. **Token 预估缓存**：每个技能的 token 数算一次缓存起来
4. **懒加载**：技能列表只加载元数据，点详情才加载完整内容
5. **事件合并**：频繁的进度事件做节流（比如最多 500ms 更新一次 UI）
6. **验证并行**：同一个 skill 的多个测试用例并行执行

---

---

## 附录 I：开源生态调研报告

> 系统调研 GrokBot、记忆系统、多 Agent 调度、Skill 自进化等相关开源项目，评估对本项目的可借鉴性。

### I.1 GrokBot 与多 Agent 调度

#### GrokBot（xAI）—— 不开源，但架构设计极具参考价值

**结论**：Grok Bot 本身不是开源项目（xAI 只开源了 Grok Build 编码 Agent CLI，见 [xai-org/grok-build](https://github.com/xai-org/grok-build)，26k★，Rust 写的 TUI 编码 Agent）。Grok Bot 的多 Agent 调度系统是闭源的，但其架构设计对本项目有重要借鉴意义。

**Grok Bot 多 Agent 架构核心设计**：

1. **描述符驱动的自动路由**：每个 Agent 有 name + title + description 三个描述符。description 不仅是介绍，更是"技能清单"。当一个 Agent 遇到超出自身范围的任务时，它扫描其他 Agent 的 description，匹配到就自动转发任务。
   - **借鉴点**：我们的技能库召回完全可以用同样的思路——每个 SKILL.md 的 `whenToUse` 字段就是它的"描述符"，Agent 遇到新任务时扫描技能目录的 description 做匹配，命中就加载。

2. **Chief of Staff 模式（总调度 + 专家分工）**：用户只跟一个"参谋长"Agent 对话，由它来分发给各个专家 Agent。用户不需要在多个窗口之间切换，也不需要手动复制上下文。
   - **借鉴点**：我们的 Forge Orchestrator 就是这个角色——用户看到的是"锻造系统"，背后是 Proposer/Verifier/Refiner 多个 Agent 协作。Orchestrator 对外只暴露一个统一接口。

3. **共享上下文 + 独立记忆**：所有 Agent 共享一套插件/凭据连接（比如 GitHub 只授权一次，所有 Agent 都能用），但每个 Agent 维护自己的角色设定、偏好和历史总结。
   - **借鉴点**：我们的多个锻造 Agent 共享 DSH 的工具上下文和 LLM 配置，但每个 Agent 有独立的 System Prompt 和角色设定。技能库是全局共享的。

4. **云端常驻 + 异步执行**：每个 Agent 跑在独立的云端实例上，可以在用户设备关机后继续运行定时任务和触发器。
   - **借鉴点**：我们的锻造流水线是后台异步的（对话结束后仍可继续运行），可以借鉴这个"后台常驻 Agent"的设计思路。

5. **Agent-to-Agent 交接契约**：7 个问题的 handoff contract——交接时必须传递任务背景、当前进度、约束条件、预期产出等结构化信息。
   - **借鉴点**：我们的 ForgeContext 就是这个交接契约的结构化实现——每个 Agent 之间通过结构化对象传递信息，而不是靠自然语言自由传递。

#### 开源多 Agent 调度框架对比

| 框架 | Stars | 调度范式 | 核心抽象 | 对本项目的借鉴价值 |
|------|-------|---------|---------|-------------------|
| **LangGraph** | ~37k | 图状态机 | 节点 + 边 + 共享状态 | ⭐⭐⭐⭐⭐ 最贴近我们的 ForgePipeline DAG 设计；checkpoint/持久化/human-in-the-loop 都是我们需要的 |
| **CrewAI** | ~55k | 角色团队 | Agent(role/goal/backstory) + Task | ⭐⭐⭐ 角色定义方式可以参考；但调度太"魔法"，缺少显式控制 |
| **Microsoft Agent Framework** | 新兴 | 多模式统一 | sequential/concurrent/handoff/group chat | ⭐⭐⭐ 微软官方，AutoGen 后继；MCP 原生支持 |
| **AutoGen / AG2** | ~50k | 对话式 Actor | 消息传递 + GroupChat | ⭐⭐ 微软已转向 MAF；对话式调度不适合锻造流水线 |
| **OpenAgents** | 新兴 | 持久化网络 | Agent 网络 + MCP/A2A 协议 | ⭐⭐ 思路超前，但生态不成熟 |

**关键洞察**：
- LangGraph 的**图状态机模型**是最适合我们锻造流水线的——每道质量门就是一个节点，状态在节点间流转，checkpoint 让锻造任务可以暂停/恢复/重放。
- 但我们不需要真的引入 LangGraph 作为依赖——DSH 的 Cordis 插件架构本身就有事件驱动 + 服务注入的能力，我们用原生 TS 实现一个简化版的 DAG 调度器就够了。
- **最值得抄的是 LangGraph 的设计思想，不是它的代码**。

### I.2 记忆系统开源生态

#### 主流记忆框架对比

| 项目 | Stars | 记忆类型 | 架构 | 对本项目的借鉴价值 |
|------|-------|---------|------|-------------------|
| **Mem0** | ~48k | 语义事实 + 知识图谱 | ADD-only 提取 + 多信号检索 | ⭐⭐⭐ 事实提取管线可以参考；但我们存的是 skill 不是 fact，粒度不同 |
| **Letta (MemGPT)** | ~18k | OS 式分层内存（core/archival/recall） | 虚拟上下文管理 + "做梦"阶段 | ⭐⭐⭐⭐ "dreaming"背景整理机制非常适合我们——夜间批量整理最近对话提炼技能 |
| **Zep / Graphiti** | ~12k | 时序知识图谱 | 时间维度 + 图谱推理 | ⭐⭐ 时序模型对我们不重要 |
| **A-MEM** | 新兴 | Zettelkasten 式动态索引 | NeurIPS 2025 | ⭐⭐ 学术前沿，落地性弱 |
| **Supermemory** | 新兴 | 纯向量 + 超快检索 | MCP Server 模式 | ⭐ 开箱即用的 MCP 形态 |

**对本项目的启示**：

1. **Letta 的 "dreaming" 机制** = 我们的**后台批量锻造**。Letta 在空闲时间用子 Agent 回顾近期对话，把经验写回长期记忆。我们的 Forge 也应该有一个"闲时锻造"模式——用户不活跃时，批量扫描近期对话，提炼候选技能。

2. **Mem0 v3 的 ADD-only 策略** = 我们的**技能版本化**。Mem0 不再做 UPDATE/DELETE，而是所有新事实都追加，靠检索排序来决定哪条生效。我们的技能也应该是版本化的——永远不删除旧版本，新版改进了就激活新版，旧版保留在历史里可以回滚。

3. **我们和通用记忆系统的本质区别**：
   - 通用记忆存的是**原子事实**（"用户喜欢深色模式"）
   - 我们存的是**结构化技能**（"如何调试 Python 内存泄漏的完整流程"）
   - 粒度差了一个数量级，所以不能直接套用记忆框架的架构，但核心思想（提取→存储→召回→演进）是相通的。

### I.3 Skill 自进化开源项目

#### 直接相关项目

| 项目 | Stars | 核心思路 | 技术栈 | 与本项目的关系 |
|------|-------|---------|--------|---------------|
| **EvoSkill** (sentient-agi) | **1.2k** | 从失败轨迹中发现技能，进化式迭代，git 分支管理版本 | Python + Claude Code/Codex | **最强竞品（学术向）**——三 Agent 架构(Executor/Proposer/Skill Builder)，失败驱动，验证集评估，前沿选择（frontier selection）保持多样性 |
| **CoEvoSkills** (Zhang-Henry) | 63 | 生成器 + 代理解法器协同进化，不需要 ground truth | Python + Claude Code/Codex | **学术前沿**——Surrogate Verifier 思路很新：验证器本身也在进化，不需要标准答案就能给反馈 |
| **dsh-forge** (activeing123) | 小 | 从对话轨迹中检测重复模式，自动锻造技能 | TypeScript + DSH | **最直接竞品**——已经在 DSH 上做了技能自锻造，但只有单 LLM 蒸馏，没有多 Agent 验证循环，没有质量门 |
| **dsh-self-improved** (madage) | 小 | L0→L1→L2→L3 分层记忆提取 + 技能合成 | TypeScript + DSH | 相关但偏记忆架构，技能合成是附属功能 |
| **dsh-skill-hub** (cheshireez) | 11 | GUI 技能管理（浏览/开关/诊断/市场） | TypeScript + DSH | **互补而非竞争**——它做技能管理，我们做技能生成；可以考虑未来对接 |
| **dsh-plugin-kit** (OneZero-Y) | 小 | 用 7 个技能来指导 Agent 开发 DSH 插件 | Skill 集合 | 有趣的"用技能造插件"思路——我们的 Forge 也可以锻造"锻造技能的技能" |

#### EvoSkill 深度分析（最值得借鉴的架构）

**五阶段循环**：
```
Execute → Analyze Failures → Build Skill → Evaluate → Select
   ↑                                                    │
   └────────────────────────────────────────────────────┘
```

**核心机制（我们应该借鉴的）**：

1. **失败驱动搜索（Failure-Driven Search）**：
   - 不是凭空想技能，而是从真实的执行失败轨迹中找能力缺口
   - **我们的借鉴**：TriggerEngine 不只看"成功了 N 次"，也看"失败了 N 次但最后成功了"——这种磕磕绊绊的成功最值得提炼成技能

2. **反馈记忆（Feedback Memory）**：
   - Proposer 能看到之前所有试过什么、哪些提高了分数、哪些倒退了
   - 避免在死胡同里打转
   - **我们的借鉴**：ForgeRun 的历史记录不仅是审计日志，也是下一轮迭代的输入——RefinerAgent 能看到之前所有尝试的失败原因

3. **前沿选择（Frontier Selection）**：
   - 不只保留一个最优配置，而是维护 top-N 多样性前沿
   - 不同前沿成员可以作为不同变异的父代，防止早熟收敛
   - **我们的借鉴**：技能库中同一个任务领域可以有多个版本/变体的技能并存，Agent 可以选择最合适的，而不是只有一个"标准答案"

4. **Git 分支管理进化历史**：
   - 每个候选配置存一个 git branch，完全可复现
   - **我们的借鉴**：每个技能版本就是一个独立的文件版本，配合 DSH 的文件系统技能 Provider，天然支持版本化

**EvoSkill 的局限（我们可以超越的点）**：
- 需要 ground truth 答案做验证（CoEvoSkills 解决了这个问题）
- 只面向编码任务，不面向通用对话
- 是离线批量进化，不是在线实时积累
- 没有安全审计机制

#### dsh-forge 深度分析（最直接的社区竞品）

**当前实现的流水线**：
```
session/event → trace accumulation → pattern detection (≥2 同类成功)
→ LLM distillation → write SKILL.md → ctx.skills.register
```

**dsh-forge 的优点**：
- 已经跑通了 DSH 上的端到端闭环
- 有 Web 端的 forge 面板（furnace panel）
- 有 Agent 可见的 forge_skill 工具（Agent 自己可以触发锻造）
- 用 DSH 官方技能格式，无缝接入

**dsh-forge 的薄弱点（我们的差异化空间）**：
1. **单步生成，无验证**：一次 LLM 调用直接产出 SKILL.md，没有验证环节，不知道生成的技能好不好用
2. **无迭代优化**：生成了就完事了，没有多轮 refine 的机制
3. **触发条件简单**：只看"同一意图成功了 2 次以上"，粒度很粗
4. **无安全机制**：生成的技能直接注册，没有审核、没有沙箱验证
5. **无技能库管理**：生成了就堆在目录里，没有分类、没有召回优化、没有使用统计

**我们的代际差异**：dsh-forge 是"单步蒸馏"（M0 级），我们是"七门锻造流水线"（M2-M3 级）。中间差了两个数量级的质量控制深度。

### I.4 综合借鉴清单

按对本项目的价值排序：

| 优先级 | 借鉴来源 | 借鉴内容 | 落地方式 |
|-------|---------|---------|---------|
| **P0** | EvoSkill | 失败驱动 + 验证驱动 + 前沿选择 | 核心锻造方法论 |
| **P0** | LangGraph | 图状态机 + checkpoint + HITL | ForgePipeline 架构设计 |
| **P0** | Grok Bot | 描述符路由 + Chief of Staff + 交接契约 | 技能召回机制 + Orchestrator 设计 |
| **P1** | CoEvoSkills | Surrogate Verifier（代理解法器） | Phase 4 高级验证模式 |
| **P1** | Letta | Dreaming 闲时整理机制 | 后台批量锻造 + 夜间任务 |
| **P1** | Mem0 | ADD-only + 检索排序 | 技能版本化策略 |
| **P2** | dsh-skill-hub | GUI 技能管理的交互模式 | UI 设计参考 |
| **P2** | dsh-forge | DSH 插件开发的工程实践 | 开发避坑 |
| **P2** | CrewAI | 角色定义的表述方式 | Agent Prompt 编写 |
| **P3** | dsh-plugin-kit | 用技能指导造插件的 meta 思路 | Phase 4 自举进阶 |

### I.5 差异化定位再确认

调研完整个生态后，我们的项目定位更清晰了：

```
                通用框架层
  ┌──────────────────────────────────┐
  │  LangGraph / CrewAI / AutoGen    │  ← 太通用，不针对技能生成
  └──────────────────────────────────┘

                学术研究层
  ┌──────────────────────────────────┐
  │  EvoSkill / CoEvoSkills          │  ← 最前沿但只面向编码任务、离线批量
  └──────────────────────────────────┘

                社区插件层
  ┌──────────────────────────────────┐
  │  dsh-forge / dsh-self-improved   │  ← 已有但只有单步生成，无质量控制
  └──────────────────────────────────┘

                      ↓ 我们的位置

         ▼▼▼  DSH 原生 + 工程化质量控制 ▼▼▼
  ┌───────────────────────────────────────────┐
  │  dsh-skill-forge                          │
  │  · 七门锻造流水线（工程化质量控制）        │
  │  · 多 Agent 协作（不是单步 LLM 蒸馏）     │
  │  · DSH 深度集成（slot UI + 事件驱动）     │
  │  · 四层安全体系（默认不信任）             │
  │  · 实时在线积累（边用边学）                │
  └───────────────────────────────────────────┘
```

**一句话定位**：DSH 生态中第一个工程级别的技能锻造系统——把学术界（EvoSkill/CoEvoSkills）的质量控制方法论，工程化落地到 DSH 平台上，做一个用户每天都能用的、从对话经验中自动学习的 Agent。

---

## 项目元信息

- **项目代号**：dsh-skill-forge
- **创建时间**：2026-09-03
- **状态**：Phase 0 — 规划中
- **技术栈**：TypeScript + Cordis + React + SQLite
- **目标平台**：DeepSeek Harness (DSH) Web Profile
- **License**：MIT
