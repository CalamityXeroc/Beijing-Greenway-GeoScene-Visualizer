/**
 * 分享工具
 * 分享链接使用生产域名（公网可达），而非 window.location.href（本地地址不可用）
 */

import { Capacitor } from '@capacitor/core'

/** 分享链接基址：生产 Web 端（已备案 + HTTPS，nginx 反代） */
export const SHARE_BASE_URL = 'https://wandergreen.cn'

/**
 * 生成绿道详情分享链接
 * @param {string|number} id 绿道 ID
 * @returns {string} 公网可访问的 H5 链接
 */
export const buildShareUrl = (id) => `${SHARE_BASE_URL}/mobile/detail/${encodeURIComponent(id)}`

/**
 * 生成分享文本（链接 + 内容概要，适合复制到微信/QQ）
 * @param {{name?:string, description?:string, introduction?:string, length?:string|number}} trail 绿道数据
 * @param {string|number} id 绿道 ID
 * @returns {{text: string, url: string}}
 */
export const buildShareContent = (trail, id) => {
  const url = buildShareUrl(id)
  const name = trail?.name || '北京绿道'
  // 简介截取 40 字
  const desc = (trail?.description || trail?.introduction || '').trim().replace(/\s+/g, ' ')
  const descShort = desc.length > 40 ? desc.slice(0, 40) + '…' : desc
  const lenText = trail?.length ? `${trail.length} km` : ''
  const text = `【${name}】${descShort ? descShort + '，' : ''}${lenText ? `全长${lenText}，` : ''}快来绿脉伴侣看看这条绿道吧！\n${url}`
  return { text, url }
}

/**
 * 通过系统分享面板分享（原生用 Capacitor Share 插件唤起系统面板，含微信/QQ；
 * Web 用 navigator.share）
 * @param {{title:string, text:string, url?:string}} payload
 * @returns {Promise<boolean>} 是否成功唤起
 */
export const shareViaSystem = async ({ title, text, url }) => {
  // 原生平台：Capacitor Share（Android 系统分享面板，微信/QQ/其他 App）
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text, url, dialogTitle: '分享到' })
      return true
    } catch (e) {
      console.warn('[分享] Capacitor Share 失败，降级 Web Share:', e.message)
    }
  }
  // Web：navigator.share（移动浏览器支持）
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return true
    }
  } catch (e) {
    // 用户取消不报错
  }
  return false
}

/**
 * 复制文本到剪贴板
 * 原生平台用 Capacitor Clipboard（不依赖 WebView 剪贴板权限）；
 * Web 端降级 navigator.clipboard → textarea+execCommand
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export const copyText = async (text) => {
  // 原生平台：Capacitor Clipboard 插件（Android 原生，稳定可靠）
  if (Capacitor.isNativePlatform()) {
    try {
      const { Clipboard } = await import('@capacitor/clipboard')
      await Clipboard.write({ string: text })
      return true
    } catch (e) {
      console.warn('[分享] Capacitor 剪贴板失败，降级 Web:', e.message)
    }
  }
  // Web：navigator.clipboard（需用户手势）
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 继续降级
  }
  // 降级：textarea 选中复制
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
