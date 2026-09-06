/**
 * 文件浏览器组件 — 显示当前工作区文件树
 * 支持：展开/折叠目录、眼睛图标切换隐藏文件、点击打开文件
 */

import React, { useState, useEffect, useCallback } from 'react'

interface FileNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: FileNode[]
}

interface FileExplorerProps {
  workspacePath?: string
}

export function FileExplorer({ workspacePath = '.' }: FileExplorerProps): React.ReactElement {
  const [showHidden, setShowHidden] = useState(false)
  const [tree, setTree] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['.']))
  const [loading, setLoading] = useState(true)

  // 从 Host 端获取文件树
  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch('/api/skill-forge/file-tree', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({ path: workspacePath, showHidden }),
      })
      if (res.ok) {
        const data = await res.json()
        setTree(data.tree || [])
      }
    } catch (e) {
      console.error('[skill-forge] file tree fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [workspacePath, showHidden])

  useEffect(() => { fetchTree() }, [fetchTree])

  const toggleExpand = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const openFile = async (path: string) => {
    try {
      await fetch('/api/skill-forge/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
    } catch (e) {
      console.error('[skill-forge] open file failed:', e)
    }
  }

  return React.createElement('div', { className: 'sf-file-explorer' },
    // 工具栏：显示隐藏文件切换
    React.createElement('div', { className: 'sf-explorer-toolbar' },
      React.createElement('span', { className: 'sf-explorer-title' }, '文件'),
      React.createElement('button', {
        className: `sf-icon-btn ${showHidden ? 'active' : ''}`,
        onClick: () => setShowHidden(!showHidden),
        title: showHidden ? '隐藏隐藏文件' : '显示隐藏文件',
      },
        React.createElement('svg', {
          width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        },
          showHidden
            ? React.createElement(React.Fragment, null,
                React.createElement('path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' }),
                React.createElement('line', { x1: 1, y1: 1, x2: 23, y2: 23 }),
              )
            : React.createElement(React.Fragment, null,
                React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
                React.createElement('circle', { cx: 12, cy: 12, r: 3 }),
              ),
        ),
      ),
    ),

    // 文件树
    React.createElement('div', { className: 'sf-explorer-tree' },
      loading
        ? React.createElement('div', { className: 'sf-loading' }, '加载中...')
        : tree.length === 0
          ? React.createElement('div', { className: 'sf-empty' }, '无文件')
          : renderTree(tree, expanded, toggleExpand, openFile, showHidden),
    ),
  )
}

function renderTree(
  nodes: FileNode[],
  expanded: Set<string>,
  onToggle: (path: string) => void,
  onOpen: (path: string) => void,
  showHidden: boolean,
  depth = 0,
): React.ReactNode {
  // 过滤隐藏文件
  const filtered = showHidden ? nodes : nodes.filter(n => !n.name.startsWith('.'))

  return filtered.map(node =>
    React.createElement('div', { key: node.path, className: 'sf-tree-node' },
      React.createElement('div', {
        className: `sf-tree-item ${node.type === 'directory' ? 'is-dir' : 'is-file'}`,
        style: { paddingLeft: `${depth * 16 + 8}px` },
        onClick: () => node.type === 'directory' ? onToggle(node.path) : onOpen(node.path),
      },
        node.type === 'directory' && React.createElement('span', {
          className: `sf-tree-caret ${expanded.has(node.path) ? 'expanded' : ''}`,
        }, '▸'),
        node.type === 'file' && React.createElement('span', { className: 'sf-tree-caret' }, ''),
        React.createElement('span', { className: 'sf-tree-icon' },
          node.type === 'directory' ? '📁' : '📄',
        ),
        React.createElement('span', { className: 'sf-tree-name' }, node.name),
      ),
      node.type === 'directory' && expanded.has(node.path) && node.children &&
        renderTree(node.children, expanded, onToggle, onOpen, showHidden, depth + 1),
    )
  )
}
