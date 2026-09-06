/**
 * dsh-skill-forge — Client 端入口
 *
 * 纯 DOM 注入方案：
 * - 全局顶栏（Hermès 风格）
 * - 右侧挤压式边栏（文件浏览器 / Skill Forge 多 Tab）
 * - 跟随 DSH 原生主题，不自建主题系统
 *
 * @module dsh-skill-forge/client
 */

import React, { useState, useCallback, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { Context } from '@deepseek-ai/cordis'
import { injectStyles } from './style-inject.js'
import { GlobalTopbar } from './components/GlobalTopbar.js'
import { RightSidebar } from './components/RightSidebar.js'
import { ForgeToastContainer } from './components/ForgeToast.js'
import { NAMESPACE } from './constants.js'
import { registerSettingsSection } from './settings-section.js'
import { api } from './api.js'
import { toastStore } from './toast-store.js'

/** 依赖的服务。 */
export const inject = ['slots']

// 全局状态（模块级，因为顶栏和侧栏是两个独立的 React 根）
interface GlobalState {
  rightOpen: boolean
  activeTab: 'files' | 'forge'
  width: number
}

const state: GlobalState = {
  rightOpen: false,
  activeTab: 'forge',
  width: 380,
}

const listeners = new Set<() => void>()

function setState(partial: Partial<GlobalState>) {
  Object.assign(state, partial)
  listeners.forEach(fn => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function apply(ctx: Context): void {
  // 注入样式
  injectStyles()

  // 注册设置页卡片
  registerSettingsSection(ctx)

  // 注入顶栏和侧栏
  injectUI()

  // 输入框旁锻造按钮 — 暂时禁用，排查 UI 消失问题
  // injectInputForgeButton()
  // observeAndInjectButton()
}

/** 定时重试 + MutationObserver 双保险 */
function observeAndInjectButton(): void {
  // 定时重试：DSH SPA 路由变化后输入框可能重新渲染
  const retries = [500, 1000, 2000, 3000, 5000]
  for (const ms of retries) {
    setTimeout(() => {
      if (!document.querySelector('.sf-forge-input-btn')) {
        injectInputForgeButton()
      }
    }, ms)
  }

  // MutationObserver：监听 DOM 变化自动补注入
  try {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.sf-forge-input-btn')) {
        injectInputForgeButton()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    // 5 分钟后停止观察，避免性能问题
    setTimeout(() => observer.disconnect(), 300_000)
  } catch {
    // MutationObserver 不可用时静默失败
  }
}

function injectUI(): void {
  // 创建顶栏容器
  const topbarEl = document.createElement('div')
  topbarEl.id = 'sf-topbar-root'
  document.body.insertBefore(topbarEl, document.body.firstChild)

  // 创建右侧栏容器
  const sidebarEl = document.createElement('div')
  sidebarEl.id = 'sf-rightsidebar-root'
  document.body.appendChild(sidebarEl)

  // 创建 Toast 通知容器
  const toastEl = document.createElement('div')
  toastEl.id = 'sf-toast-root'
  document.body.appendChild(toastEl)

  // 给 DSH 主容器加类名，实现挤压效果
  addLayoutClasses()

  // 渲染顶栏
  const topbarRoot = createRoot(topbarEl)
  topbarRoot.render(React.createElement(TopbarApp))

  // 渲染侧栏
  const sidebarRoot = createRoot(sidebarEl)
  sidebarRoot.render(React.createElement(SidebarApp))

  // 渲染 Toast 容器
  const toastRoot = createRoot(toastEl)
  toastRoot.render(React.createElement(ToastApp))
}

function addLayoutClasses(): void {
  // 顶栏 + 右侧栏通过 fixed 定位实现，不需要修改 DSH 布局
  // 禁用 sf-app-root class 避免 DSH DOM 重建
  return
}

// ============ 输入框旁锻造按钮注入 ============

/** 在发送按钮左侧插入锻造按钮的策略 */
function findSendArea(): HTMLElement | null {
  // 策略 1：找发送按钮（圆形蓝色按钮），在其父容器中注入
  const sendBtns = document.querySelectorAll<HTMLElement>(
    'button[class*="send"], [class*="send-btn"], [class*="send_button"], [class*="submit"]'
  )
  for (const btn of sendBtns) {
    // 排除我们自己注入的按钮
    if (btn.closest('.sf-forge-input-btn')) continue
    // 取发送按钮的父级容器（通常是 flex 容器）
    const parent = btn.parentElement
    if (parent && parent.children.length >= 1) {
      return parent
    }
  }

  // 策略 2：找 textarea / contenteditable 的父容器
  const textareas = document.querySelectorAll<HTMLElement>(
    'textarea, [contenteditable="true"]'
  )
  for (const ta of textareas) {
    if (ta.closest('.sf-forge-input-btn') || ta.closest('[data-skill-forge]')) continue
    // 往上找一层，看有没有包含多个子元素的容器
    const parent = ta.parentElement
    if (parent) {
      return parent
    }
  }

  return null
}

function injectInputForgeButton(): void {
  // 检查是否已注入
  const existing = document.querySelector('.sf-forge-input-btn')
  if (existing) return

  const container = findSendArea()
  if (!container) return

  // 创建锻造按钮
  const btn = document.createElement('button')
  btn.className = 'sf-forge-input-btn sf-injected'
  btn.innerHTML = '🔨'
  btn.title = '锻造技能（基于当前对话）'
  btn.setAttribute('data-skill-forge', 'true')
  btn.addEventListener('click', handleForgeClick)

  // 尝试找到发送按钮，在其前面插入
  const sendBtn = container.querySelector<HTMLElement>(
    'button[class*="send"], [class*="send-btn"], [class*="send_button"], [class*="submit"]'
  )
  if (sendBtn && sendBtn.parentElement === container) {
    container.insertBefore(btn, sendBtn)
  } else {
    // fallback：插入到容器的第一个子元素前
    container.insertBefore(btn, container.firstChild)
  }
}

async function handleForgeClick(): Promise<void> {
  const btn = document.querySelector('.sf-forge-input-btn') as HTMLButtonElement
  if (!btn || btn.classList.contains('sf-forge-loading')) return

  btn.classList.add('sf-forge-loading')
  btn.innerHTML = '⏳'

  try {
    // 先收集当前对话内容作为锻造理由
    const conversationText = collectConversationContext()
    const reason = conversationText
      ? `基于当前对话内容锻造技能：${conversationText.substring(0, 500)}`
      : '用户在对话中主动触发锻造'

    await api.triggerForge(reason)

    // 显示成功 toast
    toastStore.addToast({
      id: `forge-input-${Date.now()}`,
      runId: '',
      skillName: '',
      status: 'info',
      title: '🔨 锻造已触发',
      message: '正在分析对话并生成技能...',
      createdAt: Date.now(),
      actionable: false,
    })
  } catch (err) {
    console.error('[SkillForge] Input forge button error:', err)
    toastStore.addToast({
      id: `forge-input-err-${Date.now()}`,
      runId: '',
      skillName: '',
      status: 'error',
      title: '锻造失败',
      message: err instanceof Error ? err.message : '触发锻造时出错',
      createdAt: Date.now(),
      actionable: false,
    })
  } finally {
    btn.classList.remove('sf-forge-loading')
    btn.innerHTML = '🔨'
  }
}

/** 尝试收集当前对话内容 */
function collectConversationContext(): string {
  try {
    // DeepSeek Chat 的消息容器
    const msgContainers = document.querySelectorAll<HTMLElement>(
      '[class*="message"], [class*="chat-item"], [class*="conversation"]'
    )
    const parts: string[] = []
    for (const container of msgContainers) {
      if (container.closest('[data-skill-forge]')) continue
      // 跳过太小的元素（可能是图标等）
      if (container.textContent && container.textContent.trim().length > 5) {
        parts.push(container.textContent.trim())
      }
      // 收集最近 5 条消息就够了
      if (parts.length >= 5) break
    }
    return parts.join('\n')
  } catch {
    return ''
  }
}

/** 顶栏 React App */
function TopbarApp(): React.ReactElement {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate(n => n + 1))
  }, [])

  const handleToggleFiles = useCallback(() => {
    if (state.activeTab === 'files' && state.rightOpen) {
      setState({ rightOpen: false })
    } else {
      setState({ rightOpen: true, activeTab: 'files' })
    }
    updateLayout()
  }, [])

  const handleToggleForge = useCallback(() => {
    if (state.activeTab === 'forge' && state.rightOpen) {
      setState({ rightOpen: false })
    } else {
      setState({ rightOpen: true, activeTab: 'forge' })
    }
    updateLayout()
  }, [])

  return React.createElement(GlobalTopbar, {
    onToggleFiles: handleToggleFiles,
    onToggleForge: handleToggleForge,
    rightPanelOpen: state.rightOpen,
    activeTab: state.activeTab,
  })
}

/** 侧栏 React App */
function SidebarApp(): React.ReactElement {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    return subscribe(() => forceUpdate(n => n + 1))
  }, [])

  const handleTabChange = useCallback((tab: 'files' | 'forge') => {
    setState({ activeTab: tab })
  }, [])

  const handleWidthChange = useCallback((width: number) => {
    setState({ width })
    updateLayout()
  }, [])

  if (!state.rightOpen) {
    return React.createElement('div', { style: { display: 'none' } })
  }

  return React.createElement(RightSidebar, {
    activeTab: state.activeTab,
    width: state.width,
    onTabChange: handleTabChange,
    onWidthChange: handleWidthChange,
  })
}

/** Toast 通知 App — 独立 React 根，管理 Toast 生命周期 */
function ToastApp(): React.ReactElement {
  const handleNavigateToRun = useCallback((runId: string) => {
    // 打开侧栏 + 切换到 forge tab
    setState({ rightOpen: true, activeTab: 'forge' })
    updateLayout()
    // 触发自定义事件让 ForgePanel 滚动到对应 run
    const event = new CustomEvent('sf-navigate-to-run', { detail: { runId } })
    window.dispatchEvent(event)
  }, [])

  return React.createElement(ForgeToastContainer, {
    onNavigateToRun: handleNavigateToRun,
  })
}

/** 更新布局：根据侧栏宽度调整主内容区 */
function updateLayout(): void {
  const root = document.querySelector('.sf-app-root') as HTMLElement
  if (!root) return

  if (state.rightOpen) {
    root.style.paddingRight = `${state.width}px`
    document.body.classList.add('sf-sidebar-open')
  } else {
    root.style.paddingRight = '0px'
    document.body.classList.remove('sf-sidebar-open')
  }
}
