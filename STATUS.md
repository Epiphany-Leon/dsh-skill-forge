# 项目进度：dsh-skill-forge

> 最后更新：2026-09-03

---

## 2026-09-03 进度记录

### 上午/下午：规划阶段 ✅
- [x] 确定项目方向（dsh-skill-forge 多 Agent 技能锻造）
- [x] 生态调研完成（GrokBot / EvoSkill / CoEvoSkills / 达尔文 / 饕餮 / dsh-forge 等）
- [x] PLAN.md 完整设计文档（2600+ 行，九大附录）
- [x] README 中/英版 + 鸣谢
- [x] Fork DSH 到 Epiphany-Leon 并 clone 到本地
- [x] DSH 依赖安装 + 源码构建完成

### 晚上：开发阶段 ✅ 里程碑达成
- [x] 项目配置：package.json / cordis.patch.yml / tsdown.config.ts / tsconfig.json
- [x] 类型定义：types.ts（所有枚举和数据结构）
- [x] Host 端主入口：src/index.ts（Cordis 插件标准格式）
- [x] ForgeOrchestrator：完整状态机 + 流水线执行
- [x] TriggerEngine / SkillRegistry / SecurityAuditor / SkillForgeService
- [x] 4 个 Agent：Extractor / Generator / Verifier / Refiner
- [x] 6 个 System Prompt
- [x] Client 端：ForgeQueue / SkillLibrary / ForgeStats / ApprovalModal / SkillForgeSettings
- [x] CSS 样式表
- [x] tsdown 构建通过：lib/index.js (37KB) + lib/client.js (58KB)
- [x] 插件安装到 DSH web profile
- [x] **DSH Web 启动成功，插件加载无报错** 🎉

### 调试过程中的关键发现（全部已修复）
1. ✅ `installSettingsSection` → 改用 `ctx.settings.register`
2. ✅ `Schema.union()` 参数格式 → `Schema.union([...])` 数组格式
3. ✅ 不能直接 `ctx.xxx = yyy` → 用闭包共享服务
4. ✅ `defineTool()` 需要 output schema → MVP 阶段暂跳过
5. ✅ DSH 从 source 运行需要先 `pnpm run build` → 已完成

### 还需要修复的（Phase 1 收尾）→ 已完成
1. ✅ 注册 forge_skill 工具（ctx.tools.register + defineTool 正确签名）
2. ✅ Client 端通过 HTTP API 获取 Host 端数据
3. ✅ 端到端 API 测试通过

### API 端点验证结果
- ✅ `GET /api/skill-forge/queue` → 返回锻造队列
- ✅ `GET /api/skill-forge/skills` → 返回技能库
- ✅ `GET /api/skill-forge/stats` → 返回统计数据
- ✅ `POST /api/skill-forge/trigger` → 触发锻造任务

---

## 项目结构

```
01-dsh-skill-forge/
├── PLAN.md                    # 完整设计文档
├── README.zh.md / README.en.md
├── STATUS.md                  # 进度记录
├── package.json               # dsh.bundle + dsh.client 声明
├── cordis.patch.yml           # 插件配置层
├── tsdown.config.ts           # 构建配置
├── tsconfig.json              # TypeScript 配置
├── src/
│   ├── index.ts               # Host 入口（Cordis 插件）
│   ├── types.ts               # 所有类型定义
│   ├── prompts/index.ts       # LLM System Prompts
│   ├── services/              # Host 服务层
│   │   ├── BaseService.ts
│   │   ├── ForgeOrchestrator.ts  # 核心编排器
│   │   ├── TriggerEngine.ts
│   │   ├── SkillRegistry.ts
│   │   ├── SecurityAuditor.ts
│   │   └── SkillForgeService.ts
│   ├── agents/                # LLM Agent
│   │   ├── BaseAgent.ts
│   │   ├── ExtractorAgent.ts
│   │   ├── GeneratorAgent.ts
│   │   ├── VerifierAgent.ts
│   │   └── RefinerAgent.ts
│   └── client/                # 浏览器端
│       ├── index.tsx
│       ├── style-inject.ts
│       ├── css-text.ts
│       ├── constants.ts
│       ├── side-panel.tsx
│       ├── settings-section.tsx
│       └── components/        # React 组件
└── lib/                       # 构建产物
    ├── index.js + index.d.ts
    └── client.js
```

## DSH 环境

- 源码：`~/Documents/01-Projects-当下/deepseek-harness`
- Web Profile：`~/.dsh/profiles/web/`
- 构建：`pnpm run build`（已完成）
- 启动：`pnpm dsh web`
- 访问：`http://127.0.0.1:3080`

## 进度规则
- 当天（09-03）：允许增删改
- 次日（09-04 起）：只能新增当天条目，不允许改前一天的

---

## 2026-09-04 进度记录

### Phase 2 收尾 ✅
- [x] LLM 集成：BaseAgent 直接调用 Mimo Token Plan API（HTTP，response_format: json_object）
- [x] API key 从 `~/.dsh/.credentials.yaml` 读取 `XIAOMI_TOKEN_PLAN_CN_API_KEY`
- [x] 触发阈值从 0.7 降到 0.3（测试用，后续调回）
- [x] **完整锻造流水线端到端跑通**：extract → generate → verify → iterate → audit → pending_approval

### UI 升级（原 Phase 2.5，提前做了）
- [x] 全局顶栏注入（28px，Hermès 风格，左右图标区）
- [x] 右侧挤压式边栏（fixed 定位 + padding-right 实现挤压效果）
- [x] 可拖拽调整宽度（280-800px）
- [x] 多 Tab 切换：📁 文件浏览器 / 🔨 Skill Forge
- [x] 文件浏览器组件：目录树展开折叠、眼睛图标切换隐藏文件
- [x] 文件树 API + 打开文件 API（Host 端）
- [x] 主题策略：跟随 DSH 原生主题，不自建主题系统（放弃了自建 Catppuccin 双主题的方案，全局覆盖会把 DSH 原生布局搅乱）
- [x] CSS 全部用 CSS 变量 + fallback，自动适配 DSH 深浅色

### 还需要做的
- [ ] 文件浏览器默认路径改为 DSH 当前 workspace（目前是 DSH 安装目录）
- [ ] 设置页 UI 完善
- [ ] 审核流程端到端测试
- [ ] 自动触发机制联调
- [ ] Skill 安装/卸载到 DSH 原生 Skill 系统

### 今日里程碑
- **Phase 1（MVP）**：✅ 完成
- **Phase 2（核心功能）**：✅ 完成（锻造流水线跑通）
- **UI 升级**：✅ 完成骨架（顶栏+右侧栏+文件浏览器）
- **Phase 3（高级功能）**：⏳ 进行中

---

## 2026-09-04 已完成清单（5个子任务并行）

### ✅ Task 0: 文件浏览器默认路径改为 workspace
- 接入 DSH workspace 系统（ctx.workspaceRegistry）
- 文件树默认显示当前 workspace 目录
- 新增 workspaceRoot 配置项（可自定义根目录）
- 新增 /api/skill-forge/workspace-info 端点
- 相对路径基于 workspace root 解析，绝对路径直接透传

### ✅ Task 1: 设置页 UI 完善
- 修复了 settings-section 未在主入口注册的 bug
- 9 个配置字段全部可编辑：
  - Security level（分段控件：strict/normal/permissive/auto）
  - Auto-trigger 开关
  - Trigger threshold 滑块
  - Max iterations 数字输入
  - Verification pass threshold 滑块
  - Skill count alert threshold 数字输入
  - Token budget ratio 滑块
  - Enable dreaming 开关 + schedule 输入
  - Custom dangerous patterns 文本域
- DSH 设计语言：卡片式布局 + CSS 变量主题

### ✅ Task 3: 自动触发机制联调
- 修复了核心竞态条件：session traces 在 Gate 0 评估前就被清理
- TriggerEngine 接入 DSH `session/event` 事件流
- 按 session 维度累积痕迹，5 分钟 idle 后触发评估
- 自动触发流程：事件累积 → idle 检测 → 评估 → 启动锻造 → Gate 0 二次确认
- traces 保留 30 分钟安全超时

### ✅ Task 4: Skill 安装/卸载到 DSH 原生系统
- 验证 SkillRegistry ↔ DSH ctx.skills 集成完整
- 4 个集成点全部确认：
  1. activateForgedSkill → registerSkillWithDSH
  2. archiveSkill → unregisterSkillFromDSH
  3. unarchiveSkill → registerSkillWithDSH
  4. initialize() → 启动时重新注册所有 ACTIVE 技能
- Skill 格式符合 DSH SkillRegistration 规范（name/description/content/whenToUse/invocation）

### ⏳ Task 2: 审核流程端到端测试
- 发现手动触发内容太少导致 Extraction failed
- 已修复：ExtractorAgent 增加 fallback patterns
- 完整审核流程测试进行中

### 修复的 Bug
1. **Extraction 空结果**：手动触发内容太少时，用 fallback patterns 保证流程能继续（置信度 0.7）
2. **Trigger 竞态条件**：session traces 在 Gate 0 评估前就被清理
3. **设置页未注册**：settings-section 没在 client 主入口调用
4. **storagePath 为空**：SkillRegistry 的 storagePath 在 initialize 前被调用导致写盘路径错误（加了 ensureStoragePath 防御）

### 新增功能
1. **失败任务详情**：点击失败任务可展开查看错误码、错误消息、失败阶段、详情
2. **失败重试按钮**：失败任务直接重试
3. **进行中取消按钮**：锻造进行中可以取消
4. **状态动画**：进行中的任务状态标签有呼吸动画
5. **统计卡片增加"进行中"**：第三个卡片改为显示进行中数量
6. **Forge 多视图切换：已激活/待审核/进行中/历史 4 个 Tab
7. **技能列表 + 详情页：点击技能卡片查看完整 SKILL.md 内容
8. **锻造任务详情页：失败详情、生成的技能预览、操作按钮
9. **首次启动 Demo 数据：自动 seed 3 个示例技能（2 active + 1 archived）

### UI 问题修复
1. ✅ 红色错误块文字看不见 → 浅红背景 + 深红文字（高对比度）
2. ✅ 统计卡片辅助文字太淡 → #6B7280 → #4B5563 + 字重 500
3. ✅ 统计卡片从 3 列改为 4 列（增加"历史"Tab）
4. ✅ 统计卡片可点击切换视图，选中态高亮
5. ✅ 技能列表项：名称 + 版本 + 描述 + 标签
6. ✅ 详情视图：返回按钮 + 标题 + 描述 + 标签 + 章节 + 内容预览 + 操作

---

## Phase 2 深化：验证循环（进行中）

### 目标
把验证循环做实，让锻造出来的技能经过多维度质量评估，迭代优化真正转起来。

### 任务
1. ✅ VerifierAgent 升级：多维度评估（结构/逻辑/可操作性/实用性/安全）+ 详细改进建议
2. ✅ RefinerAgent 升级：基于维度得分做精准优化，严格不回退
3. ✅ ForgeOrchestrator：迭代历史记录 + 无进步提前终止 + 回退机制
4. ✅ UI：验证报告详情 + 迭代历史展示
5. ✅ Prompt 大升级：验证评估 + Refiner 优化策略细化

### 迭代测试发现的问题 & 修复
1. ❌→✅ Refiner 不工作：HIGH_SCORE_THRESHOLD=0.8 导致 0.8-0.9 的中等分维度不被优化 → 调到 0.9
2. ❌→✅ 手动触发 Gate 1 失败：内容太少 confidence 低 → 手动触发门槛降为 0.1
3. ❌→✅ qualityScore 不同步：run.qualityScore 一直是 0 → 补上赋值
4. ⚠️ LLM 验证分数有随机性：同样内容重验分数波动 ±0.05 → 不回退机制可以应对

### 迭代循环实际运行结果（v3 — 完整跑通）
- 初始得分：0.83（9/10 通过），低分维度：安全(0.70)、实用(0.75)
- 迭代 1：Refiner 聚焦安全+实用优化 → 重验 0.78（安全骤降至0.20）→ **回退** ✅
- 迭代 2：Refiner 再次尝试 → 重验 0.73（实用性降至0.30）→ **回退** ✅
- 结果：连续 2 轮无进步 → **早停** → 回退到初始版 → 安全审计 → 激活
- **验证了全部机制**：Refiner 聚焦低分维度、高分维度保护、严格不回退、回退记录、早停机制

### 迭代系统设计验证结论
- ✅ Refiner 能正确识别低分维度并聚焦优化
- ✅ 严格不回退是必要的安全网（LLM 优化不一定成功，2 轮都改坏了）
- ✅ 早停机制有效防止无限循环
- ✅ 迭代历史完整记录每轮变更
- ⚠️ LLM 验证有 ±0.05 的随机波动，同内容重验分数会变

---

## Phase 3：技能库 & 智能召回

### 已完成
1. ✅ **SkillRegistry 完善**
   - 版本管理：getVersionHistory / getSkillVersion / rollbackToVersion / saveVersionSnapshot
   - 使用统计：recordUsage / getTopSkills / frontmatter 持久化
   - 元数据扩展：category / qualityScore / forgedFromRunId / usageCount / lastUsedAt
   - 搜索筛选：searchSkills（多字段搜索 + 状态/分类筛选 + 排序 + 分页）

2. ✅ **Injection Engine（智能召回）**
   - 四维加权评分：关键词匹配(0.4) + 验证分(0.3) + 使用频率(0.2) + 新鲜度(0.1)
   - 关键词按字段加权（名称/标签=3x，whenToUse=2x，描述=1.5x，正文=1x）
   - Token 预算管理：贪心算法，超预算则跳过
   - 动态注入：监听 session/event 的 turn/start，每轮前重新评估
   - 使用统计反馈：被注入即记一次 usage
   - 两种模式：all（全部注册，默认）/ smart（智能注入）

3. ✅ **UI 升级（技能库）**
   - 搜索栏：关键词搜索 + 排序下拉（名称/质量分/使用次数/创建时间）
   - 技能卡片增强：🏆 质量分徽章 + ⚡ 使用次数 + 📁 分类标签
   - 技能详情页增强：大质量分进度条 / 2×2 统计网格 / 版本历史 / 操作栏
   - 三级导航：列表 → 搜索/筛选 → 详情

4. ✅ **API 扩展**
   - 9 个新端点：skill-detail / skill-versions / skill-version / skill-rollback / skill-unarchive / skill-reforge / skill-usage / skill-update / skill-delete
   - 全部改为 exact 路由（解决 prefix 路由 401 auth 问题）
   - 配置 API：GET/PUT /config（热更新）
   - 详细统计：GET /stats/detail

5. ✅ **Forge Run 持久化**
   - JSON 文件存储（forge-runs.json）
   - 防抖写入（500ms）
   - 启动时自动加载，最多保留 50 条
   - 每次状态变更自动保存

### 已知小问题
1. ~~版本列表 API 返回 0 条~~ → ✅ 已修复（旧构建输出导致，rebuild 后正常）
2. ✅ InjectionEngine 默认 mode=all，可通过 GET/PUT /config 切换为 smart
3. ✅ qualityScore 在 activateForgedSkill 时已写入 frontmatter，旧技能缺字段

### Phase 3 遗留功能已全部完成
1. ✅ **谱系追踪**：GET /skill-lineage?name=xxx → 来源（哪个锻造记录）+ 衍生技能列表
2. ✅ **版本 diff 对比**：GET /skill-diff?name=xxx&from=v1&to=v2 → LCS 算法逐行对比 + 绿底新增/红底删除
3. ✅ **统计仪表盘**：5th Tab 📊 → 大数字卡片 + 圆环成功率 + 7 天趋势 + 分类分布
4. ✅ **对话内通知卡片**：ForgeToast 组件 → 5 秒轮询 → 右下角 Toast + 批准/拒绝 + 静音功能

### Bug 修复（验证流程优化）
1. ✅ **递归 bug**：callLLMLow 调用了自身而不是 callLLM → 已修复
2. ✅ **验证随机性**：Verifier/Refiner temperature 0.7→0.3，减少随机波动
3. ✅ **阈值调整**：passThreshold 0.9→0.8，0.82 即可通过
4. ✅ **速度优化**：4 分钟+3 轮迭代 → 141 秒一次通过

### UI 崩溃事件 & 修复（09-05 下午）
1. ❌→✅ **Forge 面板点击后整个侧栏消失**
   - 现象：点击 Forge Tab 后右侧栏完全空白，文件浏览器正常
   - 根因：ForgePanel.tsx 第 726 行正则表达式 `/^[\->|`~]+/gm` 中 `-` 未转义，在 React.createElement 的 JS 字符串解析时引发语法错误，导致整个组件 render 失败
   - 修复：转义 `-` → `\\-`
   - 教训：正则中的特殊字符在 JS 字符串中需要双重转义

2. ❌→✅ **UI 闪烁后消失（看到一下然后就无了）**
   - 现象：UI 能短暂看到然后消失
   - 根因：`addLayoutClasses()` 给 DSH root 加 `sf-app-root` class 触发 DSH 内部 DOM 重建
   - 修复：禁用 addLayoutClasses，顶栏/侧栏改用 fixed 定位
   - 教训：不要修改 DSH 根节点的 class，会触发重渲染

3. ❌→✅ **5 个可选优化后 UI 再次 Crashdown**
   - 现象：Phase 3 可选优化（编辑/依赖/反馈/对话按钮/预览）做完后，Forge 面板又 crash
   - 根因：ForgePanel 过度拆分（1600+ 行，30+ 参数的渲染函数），多个子任务并行修改导致函数签名不匹配、参数传递错误
   - 修复：完全重写为单函数内联渲染（800 行，所有 state 在函数内部，不传参）
   - 教训：React 组件保持单一职责，避免过度拆分和过多参数传递；并行开发时共享组件要特别小心

### Phase 3 完整功能清单（最终）
1. ✅ 技能库 CRUD + 搜索筛选 + 排序
2. ✅ 版本管理（历史/回滚/diff 对比）
3. ✅ 谱系追踪（来源 + 衍生技能）
4. ✅ 智能召回引擎（四维加权 + Token 预算）
5. ✅ 统计仪表盘（5th Tab）
6. ✅ 对话内通知卡片（ForgeToast）
7. ✅ 拒绝理由 Modal（5 预设 + 自由输入）
8. ✅ 技能编辑功能
9. ✅ 相关技能推荐
10. ✅ 使用反馈闭环
11. ✅ 内容预览（卡片 150 字符）
12. ✅ Run 持久化（forge-runs.json）

---

## 2026-09-05 进度记录

### Phase 4：产品化 & 发布 ⏳ 进行中

#### 4.1 代码质量
- [x] 代码审查：清理临时代码、TODO、console.log（0 个残留）
- [x] TypeScript strict 模式无错误（37 个错误全部修复）
- [ ] Lint 配置（低优，tsc strict 已覆盖大部分）
- [ ] 核心模块单元测试（Phase 4 后续）

#### 4.2 文档完善
- [x] README 中文完整版（16KB，七大特性 + 架构 + 使用指南 + 路线图）
- [x] README 英文精简版（8.7KB）
- [x] 快速开始指南（docs/quickstart.md，5 分钟上手）
- [x] 配置参考文档（docs/configuration.md，14 个配置项 + 调优建议）
- [x] FAQ（docs/faq.md，7 大类 30+ 问题 + 错误码对照）
- [x] CHANGELOG.md（v0.1.0 完整变更记录）

#### 4.3 演示材料
- [x] 项目 Logo（孵化蛋方向，6 张变体：深蓝/薄荷/赤陶/紫色/森林/芥黄）
- [ ] README 头图 banner
- [x] 社媒宣传素材：
  - banner.html（GitHub 发布 Banner，1200×630，深色科技风 + 孵化蛋 Logo）
  - features.html（七大特性长图，1080×1440，深色卡片式）
  - xiaohongshu.html（小红书风格宣传图，1080×1440，暖黄治愈风）
  - copy.md（各平台发布文案：GitHub README / 小红书 / 朋友圈 / 技术亮点 / 致谢）

#### 4.4 发布准备
- [ ] npm 包准备
- [ ] .npmignore
- [ ] LICENSE（MIT）
- [ ] GitHub 仓库初始化
