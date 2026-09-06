/**
 * RightSidebar — 右侧挤压式边栏
 * 多 Tab 切换：文件浏览器 / Skill Forge
 * 可拖拽调整宽度
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { FileExplorer } from './FileExplorer.js'
import { ForgePanel } from './ForgePanel.js'
import { api } from '../api.js'

// ============================================================
// 快速设置面板（侧栏内滑出）
// ============================================================

interface QuickSettings {
  clickOutsideToClose: boolean
  squeezeMode: boolean
  autoTrigger: boolean
  injectionMode: 'all' | 'smart'
  enableIntentAware: boolean
  enableRewardLearning: boolean
  enableIncrementalAccumulation: boolean
}

function SettingsPanel({ onClose }: { onClose?: () => void }): React.ReactElement {
  const [config, setConfig] = useState<QuickSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getConfig().then((res: any) => {
      // 从全局状态读取 UI 相关设置
      const globalState = (window as any).__sf_state || {}
      setConfig({
        clickOutsideToClose: globalState.clickOutsideToClose ?? true,
        squeezeMode: globalState.squeezeMode ?? false,
        autoTrigger: res?.autoTrigger ?? true,
        injectionMode: res?.injectionMode ?? 'smart',
        enableIntentAware: res?.enableIntentAware ?? true,
        enableRewardLearning: res?.enableRewardLearning ?? true,
        enableIncrementalAccumulation: res?.enableIncrementalAccumulation ?? true,
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const updateUIConfig = (patch: Partial<QuickSettings>) => {
    setConfig(prev => prev ? { ...prev, ...patch } : prev)
    // 更新全局状态
    const w = window as any
    if (w.__sf_state) {
      Object.assign(w.__sf_state, patch)
    }
    // 通知 listener 更新
    if (w.__sf_notify) {
      w.__sf_notify()
    }
  }

  const updateServerConfig = async (patch: any) => {
    setConfig(prev => prev ? { ...prev, ...patch } : prev)
    try {
      await api.updateConfig(patch)
    } catch (e) {
      console.error('更新配置失败', e)
    }
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) =>
    React.createElement('button', {
      className: `sf-quick-toggle ${checked ? 'on' : ''}`,
      onClick: () => onChange(!checked),
      role: 'switch',
      'aria-checked': checked,
    },
      React.createElement('span', { className: 'sf-quick-toggle-thumb' }),
    )

  if (loading || !config) {
    return React.createElement('div', { className: 'sf-settings-panel' },
      React.createElement('div', { className: 'sf-settings-loading' }, '加载中...'),
    )
  }

  return React.createElement('div', { className: 'sf-settings-panel' },
    // 标题栏
    React.createElement('div', { className: 'sf-settings-header' },
      React.createElement('span', { className: 'sf-settings-title' }, '⚙️ 快速设置'),
      React.createElement('button', {
        className: 'sf-settings-close',
        onClick: onClose,
        title: '关闭',
      }, '×'),
    ),

    // 设置分组
    React.createElement('div', { className: 'sf-settings-body' },

      // 界面
      React.createElement('div', { className: 'sf-settings-group' },
        React.createElement('div', { className: 'sf-settings-group-title' }, '界面'),
        React.createElement('div', { className: 'sf-setting-item' },
          React.createElement('span', { className: 'sf-setting-item-label' }, '点击外部自动关闭'),
          React.createElement(Toggle, {
            checked: config.clickOutsideToClose,
            onChange: (v: boolean) => updateUIConfig({ clickOutsideToClose: v }),
          }),
        ),
        React.createElement('div', { className: 'sf-setting-item' },
          React.createElement('div', { className: 'sf-setting-item-label' },
            React.createElement('span', null, '挤压模式'),
            React.createElement('span', { className: 'sf-setting-item-desc' }, '侧栏挤压主内容区（实验性）'),
          ),
          React.createElement(Toggle, {
            checked: config.squeezeMode,
            onChange: (v: boolean) => updateUIConfig({ squeezeMode: v }),
          }),
        ),
      ),

      // 锻造
      React.createElement('div', { className: 'sf-settings-group' },
        React.createElement('div', { className: 'sf-settings-group-title' }, '锻造'),
        React.createElement('div', { className: 'sf-setting-item' },
          React.createElement('span', { className: 'sf-setting-item-label' }, '自动触发锻造'),
          React.createElement(Toggle, {
            checked: config.autoTrigger,
            onChange: (v: boolean) => updateServerConfig({ autoTrigger: v }),
          }),
        ),
        React.createElement('div', { className: 'sf-setting-item' },
          React.createElement('div', { className: 'sf-setting-item-label' },
            React.createElement('span', null, '增量经验积累'),
            React.createElement('span', { className: 'sf-setting-item-desc' }, '每轮累积痕迹，达阈值触发'),
          ),
          React.createElement(Toggle, {
            checked: config.enableIncrementalAccumulation,
            onChange: (v: boolean) => updateServerConfig({ enableIncrementalAccumulation: v }),
          }),
        ),
      ),

      // 智能召回
      React.createElement('div', { className: 'sf-settings-group' },
        React.createElement('div', { className: 'sf-settings-group-title' }, '智能召回'),
        React.createElement('div', { className: 'sf-setting-item' },
          React.createElement('span', { className: 'sf-setting-item-label' }, '意图感知召回'),
          React.createElement(Toggle, {
            checked: config.enableIntentAware,
            onChange: (v: boolean) => updateServerConfig({ enableIntentAware: v }),
          }),
        ),
        React.createElement('div', { className: 'sf-setting-item' },
          React.createElement('span', { className: 'sf-setting-item-label' }, '奖励驱动进化'),
          React.createElement(Toggle, {
            checked: config.enableRewardLearning,
            onChange: (v: boolean) => updateServerConfig({ enableRewardLearning: v }),
          }),
        ),
        React.createElement('div', { className: 'sf-setting-item' },
          React.createElement('span', { className: 'sf-setting-item-label' }, '注入模式'),
          React.createElement('select', {
            className: 'sf-setting-select',
            value: config.injectionMode,
            onChange: (e: any) => updateServerConfig({ injectionMode: e.target.value }),
          },
            React.createElement('option', { value: 'all' }, '全部注入'),
            React.createElement('option', { value: 'smart' }, '智能匹配'),
          ),
        ),
      ),

      // 更多设置链接
      React.createElement('div', { className: 'sf-settings-footer' },
        React.createElement('span', null, '完整设置 → DSH 设置页'),
      ),
    ),
  )
}

interface RightSidebarProps {
  activeTab: 'files' | 'forge'
  width: number
  onTabChange: (tab: 'files' | 'forge') => void
  onWidthChange: (width: number) => void
  theme?: 'light' | 'dark'
  showSettings?: boolean
  onToggleSettings?: () => void
}

export function RightSidebar({
  activeTab,
  width,
  onTabChange,
  onWidthChange,
  showSettings = false,
  onToggleSettings,
}: RightSidebarProps): React.ReactElement {
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    startX.current = e.clientX
    startWidth.current = width

    const onMove = (ev: MouseEvent) => {
      const delta = startX.current - ev.clientX
      const newWidth = Math.max(280, Math.min(800, startWidth.current + delta))
      onWidthChange(newWidth)
    }
    const onUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width, onWidthChange])

  useEffect(() => {
    if (dragging) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging])

  return React.createElement('aside', {
    className: `sf-right-sidebar ${dragging ? 'dragging' : ''}`,
    style: { width: `${width}px` },
  },
    // 拖拽手柄
    React.createElement('div', {
      className: 'sf-right-drag-handle',
      onMouseDown: handleDragStart,
      title: '拖拽调整宽度',
    }),

    // Tab 栏
    React.createElement('div', { className: 'sf-right-tabs' },
      React.createElement('div', { className: 'sf-right-tabs-left' },
        React.createElement('button', {
          className: `sf-right-tab ${activeTab === 'files' ? 'active' : ''}`,
          onClick: () => onTabChange('files'),
        },
          React.createElement('span', { className: 'sf-tab-icon' }, '📁'),
          React.createElement('span', null, '文件'),
        ),
        React.createElement('button', {
          className: `sf-right-tab ${activeTab === 'forge' ? 'active' : ''}`,
          onClick: () => onTabChange('forge'),
        },
          React.createElement('span', { className: 'sf-tab-icon' }, '🔨'),
          React.createElement('span', null, 'Forge'),
        ),
      ),
      React.createElement('div', { className: 'sf-right-tabs-right' },
        React.createElement('button', {
          className: `sf-settings-gear ${showSettings ? 'active' : ''}`,
          onClick: onToggleSettings,
          title: '设置',
        },
          React.createElement('svg', {
            width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
            stroke: 'currentColor', strokeWidth: 2,
            strokeLinecap: 'round', strokeLinejoin: 'round',
          },
            React.createElement('circle', { cx: 12, cy: 12, r: 3 }),
            React.createElement('path', {
              d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
            }),
          ),
        ),
      ),
    ),

    // Tab 内容
    React.createElement('div', { className: 'sf-right-content' },
      activeTab === 'files' && React.createElement(FileExplorer),
      activeTab === 'forge' && React.createElement(ForgePanel),
      // 设置面板（覆盖在内容上，从顶部滑下）
      showSettings && React.createElement(SettingsPanel, { onClose: onToggleSettings }),
    ),
  )
}
