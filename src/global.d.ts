/**
 * dsh-skill-forge — 全局类型声明
 *
 * 扩展 @deepseek-ai/cordis 的 Context 类型，声明 DSH 运行时注入的服务。
 * 这些服务在运行时由 DSH 宿主环境提供，类型层面通过 module augmentation 声明。
 */

import type { Context as CordisContext, Events } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** DSH Settings 服务（运行时注入） */
    settings?: {
      register?: (name: string, schema: any, options?: any) => void
      update?: (name: string, updates: Record<string, any>) => void
      get?: (name: string) => any
    }
    /** DSH Workspace 注册表（运行时注入） */
    workspaceRegistry?: {
      list?: () => Array<{ id: string; path: string; title: string }>
    }
    /** DSH Web Server 服务（运行时注入） */
    webServer?: {
      register?: (options: { kind: string; path: string; handler: any }) => () => void
    }
    /** DSH Slots 服务（运行时注入，Client 端） */
    slots?: {
      inject: (slotName: string, factory: () => any) => void
      register: (options: { name: string; id: string; order?: number }, render: any) => any
    }
    /** 日志器 */
    logger: {
      info: (...args: any[]) => void
      warn: (...args: any[]) => void
      error: (...args: any[]) => void
      debug?: (...args: any[]) => void
      child?: (namespace: string) => any
    }
    /** 工具注册 */
    tools: {
      register: (tool: any) => void
    }
    /** LLM 服务 */
    llm?: any
    /** Sessions 服务 */
    sessions?: any
    /** Skills 服务 */
    skills?: any
    /** 事件发射 */
    emit?: (event: string, payload?: any) => void
  }

  interface Events {
    ready(this: Context): void | Promise<void>
    dispose(this: Context): void | Promise<void>
  }
}

export {}
