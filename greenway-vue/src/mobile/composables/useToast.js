/**
 * 全局轻提示（Toast）— 替代系统 alert/confirm
 * 手机 App 习惯：底部浮出、自动消失
 */
let container = null

function ensureContainer() {
  if (container) return container
  container = document.createElement('div')
  container.className = 'app-toast-layer'
  container.style.cssText = `
    position: fixed; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    z-index: 9999; pointer-events: none; padding: 0 24px;
  `
  document.body.appendChild(container)
  return container
}

export function toast(message, type = 'info') {
  const el = document.createElement('div')
  el.style.cssText = `
    max-width: 80%; padding: 11px 20px; border-radius: 12px;
    background: rgba(20, 20, 24, 0.92); color: #fff; font-size: 14px;
    line-height: 1.5; text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,0.25);
    opacity: 0; transform: translateY(12px); transition: opacity .25s, transform .25s;
  `
  if (type === 'success') el.style.background = 'rgba(22, 163, 74, 0.96)'
  if (type === 'error') el.style.background = 'rgba(239, 68, 68, 0.96)'
  if (type === 'warning') el.style.background = 'rgba(245, 158, 11, 0.96)'
  el.textContent = message || ''
  ensureContainer().appendChild(el)
  requestAnimationFrame(() => {
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(12px)'
    setTimeout(() => el.remove(), 300)
  }, 2200)
}

/**
 * 确认对话框（替代 window.confirm）
 * @returns {Promise<boolean>} 用户选择
 */
export function confirmDialog({ title = '确认操作', message = '', confirmText = '确定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const mask = document.createElement('div')
    mask.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 9998;
      display: flex; align-items: center; justify-content: center; padding: 32px;
    `
    const box = document.createElement('div')
    box.style.cssText = `
      width: 100%; max-width: 320px; border-radius: 16px; overflow: hidden;
      background: var(--color-surface, #fff); box-shadow: 0 16px 48px rgba(0,0,0,0.25);
    `
    box.innerHTML = `
      <div style="padding: 20px 20px 8px; text-align: center;">
        <div style="font-size: 17px; font-weight: 600; color: var(--color-text-primary, #1c1c1e);">${title}</div>
        ${message ? `<div style="font-size: 14px; color: var(--color-text-secondary, #636366); margin-top: 8px; line-height: 1.5;">${message}</div>` : ''}
      </div>
      <div style="display: flex; border-top: 0.5px solid var(--color-divider, rgba(0,0,0,0.1));">
        <button data-a="cancel" style="flex:1; padding: 14px; border:none; background:none; font-size:16px; color: var(--color-text-secondary, #636366); cursor:pointer;">${cancelText}</button>
        <button data-a="ok" style="flex:1; padding: 14px; border:none; background:none; font-size:16px; font-weight:600; cursor:pointer; ${danger ? 'color: var(--color-error, #ef4444);' : 'color: var(--color-primary, #16a34a);'}">${confirmText}</button>
      </div>
    `
    mask.appendChild(box)
    document.body.appendChild(mask)
    const close = (val) => { mask.remove(); resolve(val) }
    mask.addEventListener('click', (e) => { if (e.target === mask) close(false) })
    box.querySelector('[data-a=cancel]').addEventListener('click', () => close(false))
    box.querySelector('[data-a=ok]').addEventListener('click', () => close(true))
  })
}
