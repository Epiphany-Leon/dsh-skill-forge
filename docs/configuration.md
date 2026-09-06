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

---

### 技能库治理

#### `skillCountAlertThreshold`

技能数量提醒阈值。激活状态的技能数超过此值时，系统会在 UI 中给出提醒，建议清理或归档低质量技能。

- **类型**：`number`
- **范围**：`10` – `100`
- **默认值**：`30`
- **建议**：配合 `injectionMode: 'smart'` 使用时可以放宽到 `50`–`100`，智能注入会自动筛选

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
  - 技能数超过 15 个后建议切换到 `smart`，减少 token 消耗和技能污染
  - 切换到 `smart` 后观察几天效果，再调整相关阈值

#### `tokenBudgetRatio`

技能注入的 token 预算占总上下文的比例。智能注入模式下，用于注入技能的 token 不超过总预算的这个比例。

- **类型**：`number`
- **范围**：`0.05` – `0.3`
- **默认值**：`0.1`
- **调优**：
  - 设高一点可以注入更多技能，但留给对话的 token 会减少
  - 设低一点节省 token，但可能漏掉一些相关度不那么高的有用技能
  - 长任务场景建议 `0.05`–`0.1`，短问答场景可以到 `0.15`–`0.2`

#### `injectionTokenBudget`

智能注入时每轮对话的 token 预算上限（字符数估算）。

- **类型**：`number`
- **默认值**：`0`
- **说明**：
  - 值为 `0` 时，系统根据 `tokenBudgetRatio` 和模型上下文窗口自动计算
  - 设为具体数值时，覆盖自动计算结果，直接以此值为上限
  - 单位为字符数（粗略估算 token 数，约 1 token = 4 字符）

#### `injectionRelevanceThreshold`

智能注入的最低相关度阈值。综合评分低于此值的技能不会被注入，即使 token 预算还有剩余。

- **类型**：`number`
- **范围**：`0` – `1`
- **默认值**：`0.2`
- **调优**：
  - 设高一点，注入的技能更少但更精准
  - 设低一点，注入的技能更多但可能引入噪音
  - 建议从默认值开始，观察注入效果后微调

---

### 闲时锻造

#### `enableDreaming`

是否启用闲时锻造（Dreaming 模式）。开启后，系统会在配置的时间段自动扫描历史对话，批量锻造技能。

- **类型**：`boolean`
- **默认值**：`false`
- **建议**：
  - 有大量历史对话想批量提炼时开启
  - 个人日常使用通常不需要
  - 开启后注意控制频率，避免消耗过多 API token

#### `dreamingSchedule`

闲时锻造的调度时间，使用 cron 表达式。

- **类型**：`string`
- **默认值**：`0 3 * * 0`（每周日凌晨 3 点）
- **格式**：标准 5 位 cron 表达式 `分 时 日 月 周`
- **常用示例**：
  - `0 2 * * *` — 每天凌晨 2 点
  - `0 3 * * 0` — 每周日凌晨 3 点
  - `0 */6 * * *` — 每 6 小时
  - `30 1 * * 6` — 每周六凌晨 1:30
- **建议**：选在你通常不使用 DSH 的时间段，避免影响正常对话

---

## 完整配置示例

以下是一个面向「重度使用者」的配置示例，开启智能注入、提高质量门槛、启用闲时锻造：

```yaml
- id: dsh-skill-forge
  name: dsh-skill-forge
  config:
    securityLevel: strict
    autoTrigger: false
    triggerThreshold: 0.5
    maxIterations: 5
    verificationPassThreshold: 0.92
    skillCountAlertThreshold: 50
    tokenBudgetRatio: 0.12
    injectionMode: smart
    injectionTokenBudget: 0
    injectionRelevanceThreshold: 0.25
    enableDreaming: true
    dreamingSchedule: "0 2 * * 0"
    customDangerousPatterns:
      - "rm -rf /"
      - "> /dev/sda"
    workspaceRoot: "/Users/yourname/skills-repo"
```

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
| `tokenBudgetRatio` | 下一轮对话生效 |
| `injectionMode` | 即时生效（重新计算注入列表） |
| `injectionTokenBudget` | 下一轮对话生效 |
| `injectionRelevanceThreshold` | 下一轮对话生效 |
| `enableDreaming` | 即时生效 |
| `dreamingSchedule` | 即时生效（重新注册定时器） |
| `customDangerousPatterns` | 下一次审计时生效 |
| `workspaceRoot` | 需要重启 DSH |

绝大多数配置修改后即时生效，无需重启 DSH。`workspaceRoot` 涉及文件系统路径变更，修改后需要重启才能生效。
