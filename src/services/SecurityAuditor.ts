/**
 * SecurityAuditor —— 安全审计
 *
 * 静态扫描生成的技能，排除安全风险。
 */

import { BaseService } from './BaseService.js'
import type {
  GeneratedSkill,
  ForgeRun,
  AuditResult,
  SkillForgeConfig,
} from '../types.js'

export class SecurityAuditor extends BaseService {
  // 危险命令模式（匹配命令行/脚本中的危险操作）
  private dangerousPatterns: RegExp[] = [
    /rm\s+-rf\s+[\/~]/i,              // rm -rf / 或 rm -rf ~
    /mkfs\.\w+/i,                       // 格式化磁盘
    /dd\s+if=.*\s+of=\/dev\//i,         // dd 写磁盘设备
    /curl\s+.*\|\s*(?:bash|sh|zsh)/i,   // curl | bash  管道执行
    /wget\s+.*\|\s*(?:bash|sh|zsh)/i,   // wget | bash
    /eval\s+\$\(/i,                     // eval 执行
    /sudo\s+rm/i,                       // sudo rm
    /chmod\s+777\s+\//i,                // 全局可写系统文件
    /chown\s+-R\s+.*\s+\//i,            // 递归改系统文件所有者
    />\s*\/dev\/sda/i,                  // 写入磁盘设备
    /:()\{ :\|:& \};:/,                 // fork bomb
    /base64\s+.*\|\s*(?:bash|sh)/i,     // base64 解码后执行
  ]

  // 敏感信息泄露模式
  private leakPatterns: RegExp[] = [
    /sk-[A-Za-z0-9]{20,}/,              // OpenAI style API key
    /AKIA[0-9A-Z]{16}/,                 // AWS access key
    /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, // 私钥
    /ghp_[A-Za-z0-9]{36}/,              // GitHub personal token
    /AIza[0-9A-Za-z\-_]{35}/,           // Google API key
  ]

  // 用于重复检测的 registry 引用
  private registry: any

  constructor(ctx: any, config: SkillForgeConfig) {
    super(ctx, config)
    // registry 在 initialize 之后设置
    this.registry = null
  }

  /** 注入 registry 引用（在 apply 里创建后调用） */
  setRegistry(registry: any): void {
    this.registry = registry
  }

  /**
   * 审计技能内容
   */
  async audit(skill: GeneratedSkill, run: ForgeRun): Promise<AuditResult> {
    const warnings: string[] = []
    const dangers: string[] = []
    const fullContent = skill.body + '\n' + skill.frontmatter.description + '\n' + skill.frontmatter.whenToUse

    // 1. 危险命令模式扫描
    for (const pattern of this.dangerousPatterns) {
      const matches = fullContent.match(pattern)
      if (matches) {
        dangers.push(`Dangerous command pattern: ${matches[0].substring(0, 80)}`)
      }
    }

    // 2. 敏感信息泄露扫描
    for (const pattern of this.leakPatterns) {
      if (pattern.test(fullContent)) {
        warnings.push('Potential sensitive information detected')
        break
      }
    }

    // 3. 自定义危险模式
    for (const customPattern of this.config.customDangerousPatterns) {
      try {
        const regex = new RegExp(customPattern, 'i')
        if (regex.test(fullContent)) {
          dangers.push(`Custom dangerous pattern matched: ${customPattern.substring(0, 50)}`)
        }
      } catch {
        // 无效正则，跳过
      }
    }

    // 4. 格式炸弹检查
    const bodyLines = skill.body.split('\n').length
    if (bodyLines > 500) {
      warnings.push(`Skill body is very long (${bodyLines} lines) — may be a format bomb`)
    }

    // 5. 重复检测
    let duplicateOf: string | undefined
    let similarityScore: number | undefined

    try {
      const dupId = await this.registry?.findDuplicate(skill.frontmatter)
      if (dupId) {
        duplicateOf = dupId
        similarityScore = 1.0  // MVP: 精确匹配
        warnings.push('Skill with same name already exists')
      }
    } catch (err) {
      this.log('debug', `Duplicate check failed: ${(err as Error).message}`)
    }

    // 6. 必要字段检查
    if (!skill.frontmatter.name || skill.frontmatter.name.length < 3) {
      dangers.push('Skill name is missing or too short')
    }
    if (!skill.frontmatter.description) {
      warnings.push('Skill description is empty')
    }
    if (!skill.frontmatter.whenToUse) {
      warnings.push('Skill whenToUse is empty — will not be discoverable')
    }

    const passed = dangers.length === 0

    this.log('debug', `Audit complete: passed=${passed}, dangers=${dangers.length}, warnings=${warnings.length}`)

    return {
      passed,
      warnings,
      dangers,
      duplicateOf,
      similarityScore,
    }
  }

  /**
   * 安全等级评估（用于人工审核决策）
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
}
