# 配置参考

本文详细列出 dsh-skill-forge 的所有配置项、默认值、取值范围和调优建议。

---

## 配置方式

插件提供两种配置方式，效果完全一致：

### 方式一：DSH 设置界面（推荐）

在 DSH Web 中打开设置 → 找到「Skill Forge」面板 → 可视化调整所有配置项。修改后即时生效，无需重启。

### 方式二：cordis.patch.yml

直接编辑 profile 目录下的 `cordis.patch.yml`，找到 `dsh-skill-forge` 的配置段落：

```yaml
- id: dsh-skill-forge
  name: dsh-skill-forge
  config:
    securityLevel: normal
    autoTrigger: true
    # ... 更多配置
```

修改后执行 `dsh web` 重启生效。

---

## 配置项一览

### 安全与审计

#### `securityLevel`

安全等级，控制安全审计的严格程度。

| 级别 | 说明 |
|------|------|
| `strict` | 最严格，任何危险模式匹配即拒绝入库，重复技能相似度超过 0.6 即拦截 |
| `normal` | 平衡模式，危险模式给出警告，用户手动确认后仍可批准 |
| `permissive` | 宽松模式，只拦截最严重的安全问题，适合调试和个人使用 |
| `auto` | 根据技能数量和环境自动调整，初期宽松、技能数增长后逐步收紧 |

- **类型**：`string`
- **默认值**：`normal`
- **可选值**：`strict` / `normal` / `permissive` / `auto`
- **建议**：个人使用保持 `normal` 即可，团队或生产环境建议 `strict`

#### `customDangerousPatterns`

自定义危险模式列表，支持正则表达式。匹配到的内容会在安全审计阶段标记为危险。

- **类型**：`string[]`
- **默认值**：`[]`
- **示例**：
  ```yaml
  customDangerousPatterns:
    - "rm -rf /"
    - "curl.*\\|.*sh"
    - "eval\\(.*base64_decode"
  ```
- **建议**：团队使用时可以加入组织内部的安全红线规则

---

### 触发与锻造

#### `autoTrigger`

是否启用自动触发锻造。开启后，系统会在每轮对话结束时评估这段对话是否值得锻造。

- **类型**：`boolean`
- **默认值**：`true`
- **建议**：初期建议开启以快速积累技能，技能数量超过 20 个后可以关闭，改为手动触发

#### `triggerThreshold`

自动触发的置信度阈值。Extractor 对对话的可锻造性评分超过此值时，弹出锻造建议。

- **类型**：`number`
- **范围**：`0.1` – `0.95`
- **默认值**：`0.3`
- **调优**：
  - 值越高，触发越谨慎，误报越少，但可能漏掉一些有价值的对话
  - 值越低，触发越频繁，可能产生较多低价值锻造建议
  - 建议从默认值开始，根据实际触发频率调整

#### `maxIterations`

锻造的最大迭代轮数。验证不通过时，Refiner Agent 会尝试迭代优化，超过此轮数仍未通过则标记为失败。

- **类型**：`number`
- **范围**：`0` – `10`
- **默认值**：`3`
- **调优**：
  - 设为 `0` 时跳过迭代，一次验证不通过直接失败
  - 技能质量要求高可以设为 `5`，但锻造耗时会相应增加
  - 大多数场景下 2–3 轮就能达到收敛

#### `verificationPassThreshold`

验证通过率阈值。综合验证得分超过此值才算验证通过，可以进入审计阶段。

- **类型**：`number`
- **范围**：`0.5` – `1.0`
- **默认值**：`0.9`
- **调优**：
  - 设得越高，技能质量越有保证，但迭代轮数和失败率也会上升
  - 快速积累阶段可以降到 `0.75`，后期再逐步提高
  - 生产环境建议保持 `0.9` 及以上

#### `enableIncrementalAccumulation`

是否启用增量式经验累积触发。开启后，系统会按会话累积对话密度信号，达到阈值后触发锻造评估。

- **类型**：`boolean`
- **默认值**：`true`

#### `densityThreshold`

触发锻造的对话密度阈值。单位时间内的工具调用次数和问题复杂度超过此值时，认为这段对话有锻造价值。

- **类型**：`number`
- **范围**：`0.1` – `10.0`
- **默认值**：`2.0`

#### `minForgingIntervalMinutes`

两次自动锻造之间的最小间隔时间，防止短时间内频繁触发。

- **类型**：`number`
- **范围**：`5` – `240`
- **默认值**：`30`

#### `idleDensityThreshold`

Idle 检测的密度阈值。对话密度低于此值且持续一段时间后，认为对话已结束，触发锻造评估。

- **类型**：`number`
- **范围**：`0.1` – `1.0`
- **默认值**：`0.5`

#### `enableIntentAware`

是否启用意图感知触发。开启后，系统会分析用户消息的意图复杂度，辅助判断锻造价值。

- **类型**：`boolean`
- **默认值**：`true`

#### `intentAnalysisMinChars`

触发意图分析的消息最小字符数。短消息直接跳过意图分析以节省 token。

- **类型**：`number`
- **范围**：`0` – `500`
- **默认值**：`20`

---

### 技能库治理

#### `skillCountAlertThreshold`

技能数量提醒阈值。激活状态的技能数超过此值时，系统会在 UI 中给出提醒，建议清理或归档低质量技能。

- **类型**：`number`
- **范围**：`10` – `100`
- **默认值**：`30`
- **建议**：配合 `injectionMode: 'smart'` 使用时可以放宽到 `50`–`100`

#### `workspaceRoot`

技能库存储根目录。所有锻造的技能文件都保存在此目录下的 `skills/` 子目录中。

- **类型**：`string`
- **默认值**：`''`（空字符串表示使用 DSH 的第一个 workspace 路径）
- **建议**：
  - 默认值适用于大多数情况
  - 如果你想将技能库放在独立的 git 仓库中做版本管理，可以指定仓库路径
  - 路径必须是绝对路径

---

### 智能注入

#### `injectionMode`

技能注入模式。

| 模式 | 说明 |
|------|------|
| `all` | 启动时将所有激活技能全部注册到 DSH，每轮对话都注入 |
| `smart` | 每轮对话前动态计算相关度，按 token 预算选择性注入 |

- **类型**：`string`
- **默认值**：`all`
- **建议**：
  - 技能数少于 10 个时用 `all` 即可，简单可靠
  - 技能数超过 15 个后建议切换到 `smart`

#### `tokenBudgetRatio`

技能注入的 token 预算占总上下文的比例。智能注入模式下生效。

- **类型**：`number`
- **范围**：`0.05` – `0.3`
- **默认值**：`0.1`

#### `injectionTokenBudget`

智能注入时每轮对话的 token 预算上限（字符数估算）。设为 `0` 时根据 `tokenBudgetRatio` 自动计算。

- **类型**：`number`
- **默认值**：`0`

#### `injectionRelevanceThreshold`

智能注入的最低相关度阈值。综合评分低于此值的技能不会被注入。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.2`

---

### 奖励学习与反馈

#### `enableRewardLearning`

是否启用奖励驱动的技能权重自调整。开启后，用户反馈会动态调整技能的召回权重。

- **类型**：`boolean`
- **默认值**：`true`

#### `implicitFeedbackWindow`

隐式反馈的观察窗口（回合数）。在这个窗口内，如果用户继续深入对话，视为正反馈；如果转向其他话题，视为负反馈。

- **类型**：`number`
- **范围**：`1` – `10`
- **默认值**：`3`

#### `implicitPositiveStep`

每次隐式正反馈的权重增加量。

- **类型**：`number`
- **范围**：`0.01` – `0.5`
- **默认值**：`0.1`

#### `implicitNegativeStep`

每次隐式负反馈的权重减少量。

- **类型**：`number`
- **范围**：`0.01` – `0.5`
- **默认值**：`0.15`

#### `explicitFeedbackMultiplier`

显式反馈的乘数。显式反馈（用户手动点赞/点踩）的权重变化是隐式反馈的这个倍数。

- **类型**：`number`
- **范围**：`1` – `10`
- **默认值**：`3`

#### `dailyDecayRate`

日衰减率。每天对所有技能的使用频率做一次衰减，防止老技能长期占据高权重。

- **类型**：`number`
- **范围**：`0` – `0.5`
- **默认值**：`0.05`

#### `feedbackScoreWeight`

反馈得分在智能注入五维评分中的权重。

- **类型**：`number`
- **范围**：`0` – `0.5`
- **默认值**：`0.15`

#### `usageScoreWeight`

使用频率在智能注入五维评分中的权重。

- **类型**：`number`
- **范围**：`0` – `0.5`
- **默认值**：`0.1`

> 注：智能注入五维评分权重总和为 1.0，其余维度权重固定：关键词匹配 40%、验证得分 30%、新鲜度 10%。

---

### 达尔文模式（单体技能进化）

#### `darwinMaxIterations`

达尔文模式的最大迭代轮数。每轮对技能做一次变异和验证，连续无进步则停止。

- **类型**：`number`
- **默认值**：`10`

#### `darwinHighScoreThreshold`

达尔文模式的高分阈值。达到此分数以上的维度不再优化，聚焦低分维度。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.9`

#### `darwinAutoApprove`

达尔文模式进化后的技能是否自动批准。关闭时需要人工确认。

- **类型**：`boolean`
- **默认值**：`false`

---

### 饕餮模式（技能融合）

#### `taotieEnabled`

是否启用饕餮模式（技能融合）。

- **类型**：`boolean`
- **默认值**：`true`

#### `taotieAutoDetect`

是否自动检测可融合的技能对。开启后，系统会定期扫描技能库，发现高相似度的技能对并建议融合。

- **类型**：`boolean`
- **默认值**：`true`

#### `taotieSimilarityThreshold`

技能融合的相似度阈值。两个技能相似度超过此值时被认为有融合潜力。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.4`

#### `taotieMaxInjectionSteps`

饕餮模式的最大融合步骤数。

- **类型**：`number`
- **默认值**：`5`

#### `taotieMinImprovementThreshold`

融合后质量提升的最小阈值。低于此值则认为融合没有价值，回退到原技能。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.05`

#### `taotieAutoApprove`

饕餮模式融合后的技能是否自动批准。

- **类型**：`boolean`
- **默认值**：`false`

---

### 共进化模式（CoEvo）

#### `coevoEnabled`

是否启用共进化模式。开启后，技能和对抗性测试套件双向进化。

- **类型**：`boolean`
- **默认值**：`true`

#### `coevoMaxRounds`

共进化的最大轮数。奇数轮进化技能，偶数轮进化测试套件。

- **类型**：`number`
- **默认值**：`10`

#### `coevoTargetSkillScore`

共进化的目标技能得分。达到此分数后技能侧停止进化。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.9`

#### `coevoTargetTestStrength`

共进化的目标测试强度。达到此值后测试侧停止进化。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.85`

#### `coevoInitialTestCount`

初始生成的对抗性测试用例数量。

- **类型**：`number`
- **默认值**：`5`

#### `coevoMaxTestCases`

测试套件的最大用例数量。超过此数量后，淘汰最弱的用例。

- **类型**：`number`
- **默认值**：`20`

#### `coevoTestsPerRound`

每轮进化新增的测试用例数量。

- **类型**：`number`
- **默认值**：`3`

#### `coevoAutoApprove`

共进化完成后的技能是否自动批准。

- **类型**：`boolean`
- **默认值**：`false`

#### `coevoTestPruneThreshold`

测试用例淘汰阈值。强度低于此值的测试用例会被淘汰。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.3`

---

### Dreaming 闲时锻造

#### `enableDreaming`

是否启用闲时锻造。

- **类型**：`boolean`
- **默认值**：`false`

#### `dreamingSchedule`

闲时锻造的 cron 调度表达式。

- **类型**：`string`
- **默认值**：`0 3 * * 0`（每周日凌晨 3 点）
- **格式**：标准 5 位 cron 表达式 `分 时 日 月 周`

#### `dreamingIdleThresholdMinutes`

空闲触发的阈值（分钟）。DSH 空闲超过此时间后自动触发闲时锻造（如果配置了空闲触发）。

- **类型**：`number`
- **默认值**：`30`

#### `dreamingMaxConcurrentOptimizations`

闲时锻造的最大并发优化任务数。

- **类型**：`number`
- **默认值**：`2`

#### `dreamingAutoOptimizeThreshold`

自动优化的质量分阈值。质量分低于此值的技能会被自动优化。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.7`

#### `dreamingAutoFusion`

闲时锻造时是否自动执行技能融合。

- **类型**：`boolean`
- **默认值**：`true`

#### `dreamingAutoArchiveDays`

自动归档的天数阈值。超过此天数未被使用的低质量技能会被建议归档。

- **类型**：`number`
- **默认值**：`30`

#### `dreamingMaxSuggestions`

每次闲时锻造生成的改进建议最大数量。

- **类型**：`number`
- **默认值**：`10`

#### `dreamingDarwinAutoApprove`

闲时锻造中达尔文模式优化后的技能是否自动批准。

- **类型**：`boolean`
- **默认值**：`false`

#### `dreamingTaotieAutoApprove`

闲时锻造中饕餮模式融合后的技能是否自动批准。

- **类型**：`boolean`
- **默认值**：`false`

---

### 技能编排

#### `orchestrationEnabled`

是否启用技能编排。开启后，复杂任务会自动分解为多个子任务，分别调用不同技能。

- **类型**：`boolean`
- **默认值**：`true`

#### `orchestrationDecomposeMode`

任务分解模式。

| 模式 | 说明 |
|------|------|
| `fast` | 基于关键词快速匹配，零 LLM 消耗 |
| `llm` | 使用 LLM 做语义分解，更精准但消耗 token |
| `auto` | 简单任务用 fast，复杂任务用 llm |

- **类型**：`string`
- **默认值**：`auto`

#### `orchestrationMatchThreshold`

技能匹配的最低相关度阈值。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.3`

#### `orchestrationMaxSkills`

单个任务最多编排的技能数量。

- **类型**：`number`
- **默认值**：`5`

---

## 配置变更生效说明

| 配置项 | 生效时机 |
|--------|----------|
| `securityLevel` | 下一次审计时生效 |
| `autoTrigger` | 即时生效 |
| `triggerThreshold` | 即时生效 |
| `maxIterations` | 下一次锻造开始时生效 |
| `verificationPassThreshold` | 下一次验证时生效 |
| `skillCountAlertThreshold` | 即时生效 |
| `workspaceRoot` | 重启后生效 |
| `injectionMode` | 即时生效（重新计算注入列表） |
| `tokenBudgetRatio` | 下一轮对话生效 |
| `injectionTokenBudget` | 下一轮对话生效 |
| `injectionRelevanceThreshold` | 下一轮对话生效 |
| `enableDreaming` | 即时生效 |
| `dreamingSchedule` | 即时生效（重新注册定时器） |
| `customDangerousPatterns` | 下一次审计时生效 |
| `enableRewardLearning` | 即时生效 |
| `taotieEnabled` | 即时生效 |
| `darwinMaxIterations` | 下一次达尔文优化时生效 |
| `coevoEnabled` | 即时生效 |
| `orchestrationEnabled` | 即时生效 |
