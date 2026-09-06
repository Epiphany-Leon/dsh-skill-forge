/**
 * 基础服务类 —— 所有服务的基类
 */

import type { SkillForgeConfig } from '../types.js'

export abstract class BaseService {
  protected ctx: any
  protected config: SkillForgeConfig
  protected logger: any

  constructor(ctx: any, config: SkillForgeConfig) {
    this.ctx = ctx
    this.config = config
    this.logger = ctx.logger?.child?.('skill-forge') || console
  }

  protected log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: any) {
    const fn = this.logger[level] || this.logger.info
    fn(`[${this.constructor.name}] ${message}`, meta)
  }
}
