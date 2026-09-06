/**
 * 基础服务类 —— 所有服务的基类
 *
 * 提供统一的日志、配置访问、ctx 引用。
 * 所有具体服务类都继承自此类。
 */

import type { SkillForgeConfig } from '../types.js'

/** 日志级别 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/** 兼容 DSH logger 与 console 的最小日志接口 */
export interface MinimalLogger {
  info: (msg: string, meta?: unknown) => void
  warn: (msg: string, meta?: unknown) => void
  error: (msg: string, meta?: unknown) => void
  debug: (msg: string, meta?: unknown) => void
  child?: (name: string) => MinimalLogger
}

/**
 * 适配 DSH logger 的最小接口。
 * DSH 的 ctx.logger 是完整 Logger 实例，
 * 这里只声明我们实际用到的方法以减少 any 依赖。
 */
export interface DshLogger {
  info(msg: string, meta?: unknown): void
  warn(msg: string, meta?: unknown): void
  error(msg: string, meta?: unknown): void
  debug(msg: string, meta?: unknown): void
  child?(name: string): DshLogger
}

/** 适配 console 作为 fallback logger */
function createConsoleLogger(): MinimalLogger {
  return {
    info: (msg, meta) => meta !== undefined ? console.log(msg, meta) : console.log(msg),
    warn: (msg, meta) => meta !== undefined ? console.warn(msg, meta) : console.warn(msg),
    error: (msg, meta) => meta !== undefined ? console.error(msg, meta) : console.error(msg),
    debug: (msg, meta) => meta !== undefined ? console.debug(msg, meta) : console.debug(msg),
  }
}

export abstract class BaseService {
  /** DSH 上下文对象（保持 any，因为 cordis Context 类型复杂且来自外部依赖） */
  protected ctx: any
  /** 插件配置 */
  protected config: SkillForgeConfig
  /** 日志实例（带服务名前缀） */
  protected logger: MinimalLogger

  constructor(ctx: any, config: SkillForgeConfig) {
    this.ctx = ctx
    this.config = config
    // 优先使用 DSH logger，fallback 到 console
    const baseLogger = ctx.logger
    const childLogger = baseLogger?.child?.('skill-forge')
    this.logger = childLogger ?? baseLogger ?? createConsoleLogger()
  }

  /**
   * 输出带服务名前缀的日志。
   * 自动从 this.constructor.name 取服务类名。
   */
  protected log(level: LogLevel, message: string, meta?: unknown): void {
    const fn = this.logger[level] ?? this.logger.info
    fn(`[${this.constructor.name}] ${message}`, meta)
  }
}
