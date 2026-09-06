/**
 * SecurityAuditor —— 安全审计
 *
 * 静态扫描生成的技能，排除安全风险。
 * 包含危险命令检测、敏感信息泄露扫描、重复检测等。
 */

import { BaseService } from './BaseService.js'
import type {
  GeneratedSkill,
  ForgeRun,
  AuditResult,
  SkillForgeConfig,
  SkillFrontmatter,
} from '../types.js'
import { SKILL_BODY_MAX_LINES } from '../utils/constants.js'

/** Registry 最小接口（只声明审计用到的方法，避免循环依赖） */
export interface AuditRegistry {
  findDuplicate(frontmatter: SkillFrontmatter): Promise<string | null>
}

/** 单个危险模式条目 */
interface DangerPattern {
  name: string
  regex: RegExp
  severity: 'danger' | 'warning'
}

export class SecurityAuditor extends BaseService {
  /** 危险命令模式列表（高风险） */
  private readonly dangerousPatterns: DangerPattern[] = [
    { name: 'rm -rf system', regex: /rm\s+-rf\s+[\\/~]/i, severity: 'danger' },
    { name: 'mkfs format', regex: /mkfs\.\w+/i, severity: 'danger' },
    { name: 'dd disk write', regex: /dd\s+if=.*\s+of=\/dev\//i, severity: 'danger' },
    { name: 'curl pipe shell', regex: /curl\s+.*\|\s*(?:bash|sh|zsh)/i, severity: 'danger' },
    { name: 'wget pipe shell', regex: /wget\s+.*\|\s*(?:bash|sh|zsh)/i, severity: 'danger' },
    { name: 'eval execution', regex: /eval\s+\$\(/i, severity: 'danger' },
    { name: 'sudo rm', regex: /sudo\s+rm/i, severity: 'danger' },
    { name: 'chmod 777 system', regex: /chmod\s+777\s+\//i, severity: 'danger' },
    { name: 'chown -R system', regex: /chown\s+-R\s+.*\s+\//i, severity: 'danger' },
    { name: 'disk device write', regex: />\s*\/dev\/sda/i, severity: 'danger' },
    { name: 'fork bomb', regex: /:()\{ :\|:& \};:/, severity: 'danger' },
    { name: 'base64 pipe shell', regex: /base64\s+.*\|\s*(?:bash|sh)/i, severity: 'danger' },
  ]

  /** 敏感信息泄露模式列表 */
  private readonly leakPatterns: DangerPattern[] = [
    { name: 'OpenAI API key', regex: /sk-[A-Za-z0-9]{20,}/, severity: 'warning' },
    { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/, severity: 'warning' },
    { name: 'Private key', regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, severity: 'warning' },
    { name: 'GitHub token', regex: /ghp_[A-Za-z0-9]{36}/, severity: 'warning' },
    { name: 'Google API key', regex: /AIza[0-9A-Za-z\-_]{35}/, severity: 'warning' },
  ]

  /** 重复检测用的 registry 引用（通过 setRegistry 注入） */
  private registry: AuditRegistry | null = null

  constructor(ctx: unknown, config: SkillForgeConfig) {
    super(ctx, config)
  }

  /** 注入 registry 引用（在 apply 里创建后调用） */
  setRegistry(registry: AuditRegistry): void {
    this.registry = registry
  }

  /**
   * 审计技能内容。
   *
   * 执行 6 项检查：
   * 1. 危险命令模式扫描
   * 2. 敏感信息泄露扫描
   * 3. 自定义危险模式（用户配置）
   * 4. 格式炸弹检查（body 超长）
   * 5. 重复技能检测
   * 6. 必要字段完整性检查
   */
  async audit(skill: GeneratedSkill, run: ForgeRun): Promise<AuditResult> {
    const warnings: string[] = []
    const dangers: string[] = []
    const fullContent = this.buildFullContent(skill)

    // 1. 危险命令模式扫描
    this.scanPatterns(fullContent, this.dangerousPatterns, dangers, warnings)

    // 2. 敏感信息泄露扫描（只要命中一次就加一条警告）
    const leakHit = this.leakPatterns.some(p => p.regex.test(fullContent))
    if (leakHit) {
      warnings.push('Potential sensitive information detected')
    }

    // 3. 自定义危险模式（来自用户配置）
    this.scanCustomPatterns(fullContent, dangers)

    // 4. 格式炸弹检查
    const bodyLines = skill.body.split('\n').length
    if (bodyLines > SKILL_BODY_MAX_LINES) {
      warnings.push(`Skill body is very long (${bodyLines} lines) — may be a format bomb`)
    }

    // 5. 重复检测
    const duplicateResult = await this.checkDuplicate(skill.frontmatter)
    if (duplicateResult.duplicateOf) {
      warnings.push('Skill with same name already exists')
    }

    // 6. 必要字段完整性检查
    this.validateRequiredFields(skill, dangers, warnings)

    const passed = dangers.length === 0

    this.log('debug', `Audit complete: passed=${passed}, dangers=${dangers.length}, warnings=${warnings.length}`)

    return {
      passed,
      warnings,
      dangers,
      duplicateOf: duplicateResult.duplicateOf,
      similarityScore: duplicateResult.similarityScore,
    }
  }

  /**
   * 评估技能风险等级（用于人工审核决策）。
   * 基于关键词出现频率做粗粒度评估。
   */
  assessRiskLevel(skill: GeneratedSkill): 'low' | 'medium' | 'high' {
    const fullContent = skill.body.toLowerCase()

    const highRiskKeywords = ['delete', 'remove', 'format', 'overwrite', 'sudo', 'root']
    const mediumRiskKeywords = ['install', 'download', 'execute', 'shell', 'terminal']

    let highCount = 0
    let mediumCount = 0

    for (const kw of highRiskKeywords) {
      if (fullContent.includes(kw)) highCount++
    }
    for (const kw of mediumRiskKeywords) {
      if (fullContent.includes(kw)) mediumCount++
    }

    if (highCount >= 2) return 'high'
    if (highCount >= 1 || mediumCount >= 3) return 'medium'
    return 'low'
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  /** 构建用于扫描的完整内容字符串 */
  private buildFullContent(skill: GeneratedSkill): string {
    return `${skill.body}\n${skill.frontmatter.description}\n${skill.frontmatter.whenToUse}`
  }

  /** 扫描一组模式，按 severity 分别加入 dangers / warnings */
  private scanPatterns(
    content: string,
    patterns: DangerPattern[],
    dangers: string[],
    warnings: string[],
  ): void {
    for (const pattern of patterns) {
      const matches = content.match(pattern.regex)
      if (matches && matches[0]) {
        const snippet = matches[0].substring(0, 80)
        const msg = `${pattern.name}: ${snippet}`
        if (pattern.severity === 'danger') {
          dangers.push(msg)
        } else {
          warnings.push(msg)
        }
      }
    }
  }

  /** 扫描用户自定义危险模式 */
  private scanCustomPatterns(content: string, dangers: string[]): void {
    for (const customPattern of this.config.customDangerousPatterns) {
      try {
        const regex = new RegExp(customPattern, 'i')
        if (regex.test(content)) {
          const display = customPattern.substring(0, 50)
          dangers.push(`Custom dangerous pattern matched: ${display}`)
        }
      } catch {
        // 无效正则，静默跳过
      }
    }
  }

  /** 检查是否有重复技能 */
  private async checkDuplicate(frontmatter: SkillFrontmatter): Promise<{
    duplicateOf?: string
    similarityScore?: number
  }> {
    try {
      const dupId = await this.registry?.findDuplicate(frontmatter)
      if (dupId) {
        return { duplicateOf: dupId, similarityScore: 1.0 }
      }
    } catch (err) {
      this.log('debug', `Duplicate check failed: ${(err as Error).message}`)
    }
    return {}
  }

  /** 验证技能必要字段完整性 */
  private validateRequiredFields(
    skill: GeneratedSkill,
    dangers: string[],
    warnings: string[],
  ): void {
    if (!skill.frontmatter.name || skill.frontmatter.name.length < 3) {
      dangers.push('Skill name is missing or too short')
    }
    if (!skill.frontmatter.description) {
      warnings.push('Skill description is empty')
    }
    if (!skill.frontmatter.whenToUse) {
      warnings.push('Skill whenToUse is empty — will not be discoverable')
    }
  }
}
