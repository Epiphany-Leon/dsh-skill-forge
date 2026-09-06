/**
 * 右侧面板注册 — 使用 sidebar.footer.action 按钮 + overlay 面板
 */

import React, { useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { NAMESPACE } from './constants.js'
import { ForgeOverlay } from './components/ForgeOverlay.js'

export function registerSidePanel(ctx: Context): void {
  ctx.slots?.inject('sidebar.footer.action', () =>
    ctx.slots!.register(
      { name: 'sidebar.footer.action', id: NAMESPACE, order: 20 },
      SidebarButton,
    ),
  )
}

let togglePanel: (() => void) | null = null

function SidebarButton({ wide }: { wide?: boolean }): React.ReactElement {
  const [open, setOpen] = useState(false)
  togglePanel = () => setOpen(prev => !prev)

  return React.createElement(React.Fragment, null,
    React.createElement('button', {
      type: 'button',
      className: 'sf-sidebar-btn',
      onClick: () => setOpen(!open),
      title: 'Skill Forge',
    },
      React.createElement('span', { style: { fontSize: '16px' } }, '🔨'),
      wide === false ? null : React.createElement('span', null, 'Skill Forge'),
    ),
    open && React.createElement(ForgeOverlay, { onClose: () => setOpen(false) }),
  )
}
