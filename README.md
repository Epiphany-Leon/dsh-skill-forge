# dsh-skill-forge

> 🌏 **中文文档** | [中文版](README.zh.md)


> Multi-Agent collaborative skill forging system for DeepSeek Harness. Distills conversational experience into verifiable, traceable, reusable Agent Skills through engineering-grade quality control.

[![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-blue)](https://github.com/topics/dsh-plugin)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Cordis](https://img.shields.io/badge/Cordis-powered-purple)](https://github.com/cordiverse/cordis)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Features

### Seven-Layer Forge Pipeline

Each skill passes through seven quality gates before activation: trigger, extract, generate, verify, iterate, audit, and approve. The final output meets practical usability standards instead of surface-level correctness.

### Multi-Agent Collaboration

Six specialized agents work in a coordinated pipeline. The Extractor distills patterns from conversations. The Generator drafts skill documents. The Verifier runs multi-dimensional validation. The Refiner performs incremental optimization based on feedback. The Adversarial Test Generator creates challenging test cases for co-evolution. The Auditor handles security and duplication checks. Each role carries independent prompts and evaluation criteria for full transparency.

### Verification-Driven Iteration

Built on the insight of SkillOpt-style textual gradient descent. When verification fails, the Refiner Agent locates specific issues from failure patterns and applies targeted rewrites instead of full regeneration. The system enforces non-regressive quality across iterations, with a configurable maximum round count (three by default).

### Three Evolutionary Modes

Three evolution engines continuously improve the skill library:

- **Darwin Mode**: Hill-climbing optimization for individual skills, with 10-dimension evaluation, ratchet-style non-regression, and human-in-the-loop approval.
- **Taotie Mode (Fusion)**: Five-stage cross-skill fusion that merges similar skills into stronger ones, with pattern library沉淀 of successful fusion patterns.
- **CoEvo Mode**: Co-evolution where skills and adversarial test suites evolve in alternating rounds, pushing both sides toward higher quality.

### Dreaming Engine

Off-peak batch optimization that runs during idle time. The engine performs health checks on the skill library, batch-optimizes low-scoring skills, auto-fuses similar skills, and generates improvement suggestions. Three trigger modes are supported: manual, cron schedule, and idle detection. All changes follow strict non-regression and never auto-delete.

### Skill Orchestration

Complex task decomposition and multi-skill workflow composition. The orchestrator breaks tasks into subtasks (fast keyword matching or LLM-based semantic decomposition), matches relevant skills from the library, and generates execution guidance. Supports up to 5 skills per task with configurable relevance thresholds.

### Four-Layer Security Defense

Security coverage spans the full skill lifecycle: generation-time, verification-time, storage-time, and usage-time safety. Auto-generated content receives default distrust. Dangerous pattern matching, duplicate detection, and manual approval form three layers of guardrails. All evolutionary modes default to human-in-the-loop approval.

### Full Provenance Tracking

Every skill carries a complete family tree: source conversation IDs, forge round records, per-round verification scores, version changelogs, usage feedback statistics, and lineage graphs (derived skills, related skills). Full auditability lets you trace where a skill came from, how it evolved, and how it performs.

### Smart Recall Engine

Five-dimensional weighted scoring combines verification score, usage frequency, keyword match, freshness, and feedback score with token budget management. Smart injection replaces the blanket registration approach by dynamically selecting the most relevant skills per conversation turn. Reward-driven weight auto-adjustment learns from both explicit and implicit user feedback.

### Native DSH Web Integration

Deeply embedded in the DSH Web UI. A right sidebar hosts the forge queue, skill library, file browser, statistics dashboard, and settings. A top bar shows forge status with quick actions. Toast notifications push real-time progress updates with one-click approve/reject. The entire workflow from trigger to approval completes inside the conversation interface.

---

## 🚀 Quick Start

### Prerequisites

- DeepSeek Harness (DSH) 0.1.0-rc.5 or higher
- Node.js 20+
- A configured DSH web profile

### Installation

Skill Forge is installed as a DSH plugin via your profile's `package.json`.

#### Install from GitHub (recommended)

Add the plugin to your DSH profile:

```bash
# In your DSH profile directory (e.g. ~/.dsh/profiles/web)
pnpm add dsh-skill-forge@github:Epiphany-Leon/dsh-skill-forge
```

Then edit your profile's `package.json` to enable the bundle:

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

Restart DSH — the Skill Forge panel appears in the right sidebar.

#### Local development

```bash
git clone https://github.com/Epiphany-Leon/dsh-skill-forge.git
cd dsh-skill-forge
pnpm install
pnpm build

# Link to your DSH profile
cd ~/.dsh/profiles/web
pnpm add dsh-skill-forge@link:/path/to/dsh-skill-forge
# Then add "dsh-skill-forge" to dsh.profile.bundles in package.json
```

### Run

```bash
# Start DSH Web
dsh web

# Open DSH in your browser. The Skill Forge panel appears in the right sidebar.
```

### First Forge

1. Have a conversation in DSH that completes a reusable task.
2. Click "Forge Skill" in the right sidebar, or use the `forge_skill` tool directly.
3. Provide a forging reason and confirm.
4. Wait for the pipeline to complete (typically 30 seconds to 2 minutes).
5. Review the generated skill in the approval modal and approve or reject it.
6. Approved skills enter the registry automatically and become available for smart recall.

See [docs/quickstart.md](docs/quickstart.md) for a detailed walkthrough (Chinese).

---

## ⚙️ Configuration

Adjust settings through the DSH settings UI, or edit the profile `cordis.patch.yml` directly.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `securityLevel` | `strict` / `normal` / `permissive` / `auto` | `normal` | Security audit strictness |
| `autoTrigger` | `boolean` | `true` | Enable automatic forge triggering |
| `triggerThreshold` | `number` (0.1–0.95) | `0.3` | Confidence threshold for auto-trigger |
| `maxIterations` | `number` (0–10) | `3` | Maximum forge iteration rounds |
| `verificationPassThreshold` | `number` (0.5–1.0) | `0.9` | Verification pass threshold |
| `tokenBudgetRatio` | `number` (0.05–0.3) | `0.1` | Token budget share for skill injection |
| `injectionMode` | `all` / `smart` | `all` | Skill injection mode: full registration or smart dynamic injection |
| `injectionRelevanceThreshold` | `number` (0–1) | `0.2` | Minimum relevance for smart injection |
| `enableDreaming` | `boolean` | `false` | Enable off-peak batch forging |
| `dreamingSchedule` | `string` | `0 3 * * 0` | Cron schedule for off-peak forging |
| `customDangerousPatterns` | `string[]` | `[]` | Custom dangerous pattern list |
| `workspaceRoot` | `string` | `''` | Skill library storage root (uses first DSH workspace if empty) |

Full configuration reference: [docs/configuration.md](docs/configuration.md) (Chinese).

---

## 🏗️ Architecture

```
Session Events → [Trigger] → [Extract] → [Generate] → [Verify] → [Audit] → [Approve] → Registry
                                                     ↓         ↑
                                                  [Refine] ───┘
```

### Project Layout

```
dsh-skill-forge/
├── src/
│   ├── index.ts              # Host entry (Cordis plugin)
│   ├── types.ts              # Global type definitions
│   ├── prompts/              # Agent System Prompts
│   ├── services/             # Host services (12 modules)
│   │   ├── ForgeOrchestrator.ts   # Core orchestrator
│   │   ├── TriggerEngine.ts       # Incremental trigger engine
│   │   ├── SkillRegistry.ts       # Versioned skill registry
│   │   ├── InjectionEngine.ts     # Smart injection engine
│   │   ├── SecurityAuditor.ts     # Security auditor
│   │   ├── SkillForgeService.ts   # Public service + HTTP routes
│   │   ├── DarwinOptimizer.ts     # Darwin mode - hill climbing
│   │   ├── TaotieFusion.ts        # Taotie mode - skill fusion
│   │   ├── CoEvoOrchestrator.ts   # CoEvo mode - co-evolution
│   │   ├── DreamingEngine.ts      # Dreaming mode - batch optimize
│   │   └── SkillOrchestrator.ts   # Skill orchestration
│   ├── agents/               # LLM Agents (6 roles)
│   │   ├── ExtractorAgent.ts
│   │   ├── GeneratorAgent.ts
│   │   ├── VerifierAgent.ts
│   │   ├── RefinerAgent.ts
│   │   └── AdversarialTestGenerator.ts
│   └── client/               # React client (15+ components)
│       ├── index.tsx
│       └── components/       # UI components
├── docs/                     # Documentation
│   ├── quickstart.md
│   ├── configuration.md
│   └── faq.md
├── cordis.patch.yml          # DSH plugin configuration
├── tsdown.config.ts          # Build configuration
├── CHANGELOG.md              # Release notes
├── STATUS.md                 # Project progress tracking
├── CONTRIBUTING.md           # Contribution guide
└── package.json
```

---

## 📋 Roadmap

- [x] **Phase 0**: Environment setup and minimal plugin skeleton
- [x] **Phase 1**: Single-role forging and manual approval (MVP)
- [x] **Phase 2**: Verification loop and iterative optimization (core quality gates)
- [x] **Phase 3**: Skill library governance and smart recall
- [x] **Phase 4**: Productization and open-source release (current)
- [x] **Phase 5**: Skill evolution and self-improvement
  - [x] Reward-driven skill weight auto-adjustment
  - [x] Incremental experience accumulation trigger
  - [x] Skill fusion (TaoTie mode) — 5-stage cross-skill advantage fusion
  - [x] Single skill hill-climbing optimization (Darwin mode) — 10-dimension evaluation
- [x] **Phase 6**: Multi-agent collaboration deepening
  - [x] Co-evolutionary verification (CoEvo mode) — skills vs adversarial test cases, double-loop evolution
  - [x] Dreaming mode — batch optimization, auto-fusion, and health check during idle time
  - [x] Skill orchestration — multi-skill workflow decomposition, matching, and execution guide generation

---

## 🤝 Contributing

Contributions of code, documentation, and feedback are welcome.

```bash
# Clone
git clone https://github.com/Epiphany-Leon/dsh-skill-forge.git
cd dsh-skill-forge

# Install and build
pnpm install
pnpm build

# Type check
pnpm typecheck

# Install into local DSH profile for testing
dsh plugin --profile web add .
```

---

## 🙏 Acknowledgments

This project builds on ideas from several pioneering projects and research papers.

- **[EvoSkill](https://github.com/sentient-agi/EvoSkill)** — Failure-driven skill discovery framework. Its three-agent architecture and frontier selection mechanism inform the forge pipeline design.
- **[CoEvoSkills](https://github.com/Zhang-Henry/CoEvoSkills)** — Co-evolutionary skill generation framework. The surrogate verifier concept inspired the unsupervised verification mode.
- **[darwin.skill](https://github.com/alchaincyf/darwin-skill)** — Single-skill optimization system with multi-dimensional scoring and hill-climbing loops.
- **[dsh-forge](https://github.com/activeing123/dsh-forge)** — One of the earliest self-forging skill plugins in the DSH ecosystem.
- **[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** — The runtime platform, built on Cordis with a plugin-first architecture.

Full acknowledgments (in Chinese) are in the [Chinese README](README.zh.md).

---

## 📄 License

MIT © Epiphany-Leon
