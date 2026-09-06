# dsh-skill-forge 发布宣传材料

> 2026-09-06，v0.1.0 首发

---

## 一、项目一句话介绍

**dsh-skill-forge** — 让 Agent 从对话经验中自动锻造高质量技能。

不是「生成一篇 skill 文档」，而是一条完整的锻造流水线：提取 → 生成 → 验证 → 迭代 → 审计 → 激活，每一步都有工程化质量门控。

---

## 二、核心卖点（7 个）

### 1. 七层质量门，不靠 LLM 自觉
从「值不值得提炼」到「能不能通过沙箱测试」，7 道关卡层层过滤。不合格的打回迭代，连续两轮无进步就早停。

### 2. 多 Agent 协作锻造
Extractor 提炼方法论、Generator 生成 skill、Verifier 多维度评估、Refiner 精准优化、Auditor 安全扫描。各角色各司其职，不是一个 Agent 全包。

### 3. 验证驱动迭代优化
验证不通过？不是重来，是 Refiner 针对低分维度增量优化。严格不回退——新版本分数必须 >= 旧版本才接受。

### 4. 四层安全防御体系
生成时最小权限、验证时沙箱隔离、入库时版本审计、使用时 Token 预算。默认不信任任何自动生成内容。

### 5. 技能谱系全链路追踪
每个技能都能追溯：从哪次对话来的、经过几轮迭代、每次验证结果如何、和哪些技能相关。不是黑箱。

### 6. 意图感知智能召回
不是把所有技能塞进上下文，而是先分析当前任务意图，再召回最相关的技能。四维加权 + Token 预算，精准不浪费。

### 7. 原生 DSH UI 集成
右侧边栏 + 顶栏 + Toast 通知，完全嵌入 DSH Web 界面。不用切工具，锻造进度、技能库、统计数据一目了然。

---

## 三、发布文案（各平台）

### GitHub README 开头（英文）

> **dsh-skill-forge** — Multi-Agent collaborative skill forging system for DeepSeek Harness.
>
> Distill conversational experience into verifiable, traceable, reusable Agent Skills — with a 7-stage quality pipeline, not a single prompt.
>
> [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
> [![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-blue)](https://github.com/deepseek-ai/dsh)
> [![Version](https://img.shields.io/npm/v/dsh-skill-forge)](https://www.npmjs.com/package/dsh-skill-forge)

### 小红书文案（中文，偏感性）

**标题**：让 AI 从你的对话里「长出」技能 🌱

每次和 AI 协作解决了一个难问题，转头就忘？
下次遇到类似的，又要从头讲一遍？

做了一个 DSH 插件叫 **dsh-skill-forge**，
它会自动从你的对话历史里提炼方法论，
经过 7 道质量关卡的锻造，变成可以复用的 Agent Skill。

不是那种「生成一篇文档」的花架子，
是真的会：
🔨 提取核心思路
🔨 生成完整 skill
🔨 沙箱验证测试
🔨 迭代优化（改坏了自动回退）
🔨 安全审计
🔨 自动注入下一次对话

像一个专属铁匠铺，
把每一次成功的经验都锻造成一把好用的工具。

v0.1.0 刚发布，开源免费。
DeepSeek Harness 用户可以直接装。

#AI工具 #Agent #DSH #技能锻造 #效率工具 #开源项目

### 朋友圈/即刻文案（中文，短平快）

写了个 DSH 插件：dsh-skill-forge
让 Agent 从对话经验里自动锻造高质量技能。

7 层质量门 · 多 Agent 协作 · 验证驱动迭代 · 四层安全防御 · 谱系追踪 · 意图感知召回 · 原生 UI 集成

v0.1.0 已发布，MIT 开源。

---

## 四、技术亮点（面向开发者）

- **工程化质量控制**：Zod 强制 Schema 校验 + 状态机 + 失败可重试 + 完整审计日志
- **奖励驱动进化**：技能使用后通过隐式反馈自动调整召回权重，用得好的排前面
- **增量经验积累**：不是等对话结束才判断，每轮都在积累经验痕迹，密度够了就触发锻造
- **纯 TypeScript**：strict 模式 0 错误，ESM 输出，tree-shakable
- **零额外依赖**：运行时只依赖 cordis + schemstery，轻量接入

---

## 五、致谢

灵感来源：
- SkillOpt（文本空间技能优化）
- EvoSkills（进化式技能发现）
- Darwin.skill（单体技能爬山优化）
- Taotie.skill（跨技能优势吸收）
- MemoraX Code（长期记忆系统）

基于 DeepSeek Harness 插件生态开发。
