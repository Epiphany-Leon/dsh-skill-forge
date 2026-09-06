/**
 * GeneratorAgent —— 生成 Agent
 *
 * Gate 2: 根据提取的方法论生成完整的 SKILL.md。
 */

import { BaseAgent } from './BaseAgent.js'
import type {
  ForgeRun,
  GeneratedSkill,
  SkillFrontmatter,
  SkillForgeConfig,
} from '../types.js'
import { SYSTEM_PROMPTS } from '../prompts/index.js'

export class GeneratorAgent extends BaseAgent {
  constructor(ctx: any, config: SkillForgeConfig) {
    super(ctx, config)
  }

  /**
   * 生成技能
   */
  async generate(run: ForgeRun): Promise<GeneratedSkill> {
    this.log('info', `Generating skill: ${run.extractionResult?.methodName || 'unknown'}`)

    if (!run.extractionResult) {
      throw new Error('No extraction result available')
    }

    const extraction = run.extractionResult

    // 调用 LLM 生成 SKILL.md
    const result = await this.callLLM(
      SYSTEM_PROMPTS.generator,
      `## 方法论提取结果

**方法名称**: ${extraction.methodName}

**核心模式**:
${extraction.corePatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}

**关键步骤**:
${extraction.keySteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**适用场景**:
${extraction.applicableScenarios.map(s => `- ${s}`).join('\n')}

**涉及工具**:
${extraction.toolsUsed.map(t => `- ${t}`).join('\n')}

**对话摘要**: ${run.sourceSummary}

请生成一个完整的 SKILL.md，包含 YAML frontmatter 和正文。输出 JSON 格式：
\`\`\`json
{
  "frontmatter": {
    "name": "技能英文标识名",
    "description": "简短描述（100字以内）",
    "whenToUse": "触发条件描述",
    "version": "1.0.0",
    "tags": ["标签1", "标签2"]
  },
  "body": "SKILL.md 正文（Markdown格式）"
}
\`\`\``,
    )

    const skill = this.validateGeneratedSkill(result)

    this.log('info', `Skill generated: ${skill.frontmatter.name}`)
    return skill
  }

  /**
   * 验证生成的技能
   */
  private validateGeneratedSkill(raw: any): GeneratedSkill {
    if (!raw.frontmatter || !raw.body) {
      throw new Error('Generated skill missing frontmatter or body')
    }

    const fm = raw.frontmatter as SkillFrontmatter

    // 必要字段检查
    if (!fm.name || fm.name.length < 2) {
      throw new Error('Skill name is missing or too short')
    }
    if (!fm.description) {
      throw new Error('Skill description is missing')
    }
    if (!fm.whenToUse) {
      throw new Error('Skill whenToUse is missing')
    }

    // 清理技能名（只允许字母、数字、连字符、下划线）
    fm.name = fm.name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    if (fm.name.length < 2) {
      fm.name = 'forged-skill-' + Date.now().toString(36)
    }

    if (!fm.version) fm.version = '1.0.0'

    // body 最小长度检查
    if (raw.body.length < 100) {
      throw new Error('Skill body is too short')
    }

    return {
      frontmatter: fm,
      body: raw.body,
    }
  }
}
