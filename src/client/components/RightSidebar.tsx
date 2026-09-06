/**
 * RightSidebar — 右侧挤压式边栏
 * 多 Tab 切换：文件浏览器 / Skill Forge
 * 可拖拽调整宽度
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { FileExplorer } from './FileExplorer.js'
import { ForgePanel } from './ForgePanel.js'

interface RightSidebarProps {
  activeTab: 'files' | 'forge'
  width: number
  onTabChange: (tab: 'files' | 'forge') => void
  onWidthChange: (width: number) => void
  theme?: 'light' | 'dark'
}

export function RightSidebar({
  activeTab,
  width,
  onTabChange,
  onWidthChange,
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

    // Tab 内容
    React.createElement('div', { className: 'sf-right-content' },
      activeTab === 'files' && React.createElement(FileExplorer),
      activeTab === 'forge' && React.createElement(ForgePanel),
    ),
  )
}
