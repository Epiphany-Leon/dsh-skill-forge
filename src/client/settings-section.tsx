/**
 * 设置页注册
 *
 * 在 DSH Settings → Plugins → Configurable 里注册锻造系统配置卡片。
 */

import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { NAMESPACE } from './constants.js'
import { SkillForgeSettings } from './components/SkillForgeSettings.js'

/** 在设置页插件卡片中注册。 */
export function registerSettingsSection(ctx: Context): void {
  ctx.slots?.inject('settings.plugin.item', () =>
    ctx.slots!.register(
      { name: 'settings.plugin.item', id: NAMESPACE, order: 80 },
      () => React.createElement(SkillForgeSettings, null),
    ),
  )
}
