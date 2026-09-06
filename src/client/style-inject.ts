/**
 * 样式注入器
 */

import cssText from './css-text.js'

let injected = false

export function injectStyles(): void {
  if (injected) return
  injected = true

  const style = document.createElement('style')
  style.setAttribute('data-skill-forge', 'true')
  style.textContent = cssText
  document.head.appendChild(style)
}
