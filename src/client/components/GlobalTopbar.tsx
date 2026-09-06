/**
 * 全局顶栏组件 — Hermès 风格
 * 跟随 DSH 原生主题，不自建主题系统
 */

import React from 'react'

interface GlobalTopbarProps {
  onToggleFiles: () => void
  onToggleForge: () => void
  rightPanelOpen: boolean
  activeTab: 'files' | 'forge'
}

export function GlobalTopbar({
  onToggleFiles,
  onToggleForge,
  rightPanelOpen,
  activeTab,
}: GlobalTopbarProps): React.ReactElement {
  return React.createElement('div', { className: 'sf-topbar' },
    // 左侧：窗口控制区占位（macOS 风格）
    React.createElement('div', { className: 'sf-topbar-left' },
      React.createElement('div', { className: 'sf-topbar-traffic' },
        React.createElement('span', { className: 'sf-dot sf-dot-red' }),
        React.createElement('span', { className: 'sf-dot sf-dot-yellow' }),
        React.createElement('span', { className: 'sf-dot sf-dot-green' }),
      ),
    ),

    // 中间留白
    React.createElement('div', { className: 'sf-topbar-center' }),

    // 右侧：全局功能图标
    React.createElement('div', { className: 'sf-topbar-right' },
      // 文件浏览器
      React.createElement('button', {
        className: `sf-topbar-icon-btn ${rightPanelOpen && activeTab === 'files' ? 'active' : ''}`,
        onClick: onToggleFiles,
        title: '文件浏览器',
        'data-sf-toggle-sidebar': 'files',
      },
        React.createElement('svg', {
          width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        },
          React.createElement('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' }),
        ),
      ),
      // Skill Forge
      React.createElement('button', {
        className: `sf-topbar-icon-btn ${rightPanelOpen && activeTab === 'forge' ? 'active' : ''}`,
        onClick: onToggleForge,
        title: 'Skill Forge',
        'data-sf-toggle-sidebar': 'forge',
      },
        React.createElement('svg', {
          width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        },
          React.createElement('path', { d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' }),
        ),
      ),
    ),
  )
}
