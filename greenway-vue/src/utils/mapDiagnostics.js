/**
 * 地图交互诊断工具（仅当 URL 带 ?mapdiag=1 时激活，正常使用完全无影响）
 *
 * 面板会显示：
 *  1. 环境：浏览器 UA、WebGL 渲染器、DPR、视口尺寸
 *  2. 视图：zoom / scale / updating（渲染是否卡住）
 *  3. 图层：每个图层的 loaded / visible / 要素数量（判断数据是否加载）
 *  4. 指针事件：容器上收到的原生 pointermove / pointerdown / click 计数（判断事件是否到达）
 *  5. hitTest：调用次数与命中要素次数（判断拾取是否正常）
 *  6. WebGL 上下文：创建 / 丢失 / 恢复计数
 */

let active = false
let state = null
let panelEl = null
let timer = null

const stats = {
  pointerMove: 0,
  pointerDown: 0,
  click: 0,
  wheel: 0,
  lastEvent: null,
  hitTestCalls: 0,
  hitTestHits: 0,
  lastHitCount: 0,
  lastHitKind: '',
  webglCreated: 0,
  webglLost: 0,
  webglRestored: 0,
  errors: []
}

export const isMapDiagEnabled = () => {
  try {
    return new URLSearchParams(window.location.search).has('mapdiag')
  } catch (_) {
    return false
  }
}

export const recordHitTest = (kind, count) => {
  if (!active) return
  stats.hitTestCalls++
  if (count > 0) stats.hitTestHits++
  stats.lastHitCount = count
  stats.lastHitKind = kind
}

export const recordDiagError = (msg) => {
  if (!active) return
  stats.errors.push(String(msg).slice(0, 120))
  if (stats.errors.length > 6) stats.errors.shift()
}

// WebGL 信息只需探测一次（避免反复创建上下文导致“Too many active WebGL contexts”）
let cachedWebGLInfo = null
const getWebGLInfo = () => {
  if (cachedWebGLInfo !== null) return cachedWebGLInfo
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) {
      cachedWebGLInfo = '无 WebGL'
    } else {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      const r = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'WebGL 可用'
      cachedWebGLInfo = String(r).slice(0, 46)
      // 主动释放探测用上下文
      const lose = gl.getExtension('WEBGL_lose_context')
      if (lose) lose.loseContext()
    }
  } catch (e) {
    cachedWebGLInfo = 'err:' + e.message
  }
  return cachedWebGLInfo
}

const buildPanel = () => {
  const el = document.createElement('div')
  el.id = 'map-diag-panel'
  el.style.cssText = [
    'position:fixed', 'top:70px', 'right:12px', 'z-index:99999',
    'max-width:430px', 'max-height:80vh', 'overflow:auto',
    'background:rgba(15,23,42,.93)', 'color:#e2e8f0',
    'font:11px/1.55 Consolas,Menlo,monospace',
    'padding:10px 12px', 'border-radius:8px',
    'border:1px solid rgba(148,163,184,.4)',
    'white-space:pre-wrap', 'pointer-events:none'
  ].join(';')
  document.body.appendChild(el)
  return el
}

const render = (ctx) => {
  if (!panelEl) return
  const { view, container, getLayers } = ctx
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge ' + (ua.match(/Edg\/([\d.]+)/) || [])[1]
    : /Chrome\//.test(ua) ? 'Chrome ' + (ua.match(/Chrome\/([\d.]+)/) || [])[1]
    : ua.slice(0, 40)

  const lines = []
  lines.push('=== 地图交互诊断 (mapdiag) ===')
  lines.push(`浏览器: ${browser}`)
  lines.push(`WebGL: ${getWebGLInfo()}`)
  lines.push(`DPR: ${window.devicePixelRatio} | 视口: ${window.innerWidth}x${window.innerHeight}`)
  lines.push(`UA: ...${ua.slice(-60)}`)

  // 视图状态
  if (view) {
    try {
      const c = view.center
      lines.push('')
      lines.push(`视图: zoom=${view.zoom?.toFixed?.(2)} scale=${view.scale?.toFixed?.(0)} updating=${view.updating} suspended=${view.suspended || false}`)
      lines.push(`中心: ${c ? `${c.longitude.toFixed(4)},${c.latitude.toFixed(4)}` : '?'} | 容器: ${container ? `${container.clientWidth}x${container.clientHeight}` : '无'}`)
      const canvas = container?.querySelector('canvas')
      lines.push(`画布: ${canvas ? `${canvas.width}x${canvas.height} css:${canvas.clientWidth}x${canvas.clientHeight}` : '无'}`)
    } catch (e) {
      lines.push('视图状态读取失败: ' + e.message)
    }
  } else {
    lines.push('')
    lines.push('❌ 视图不存在！')
  }

  // 图层状态
  lines.push('')
  lines.push('--- 图层 ---')
  try {
    const layers = getLayers ? getLayers() : []
    if (!layers.length) {
      lines.push('(无图层记录)')
    }
    layers.forEach((l) => {
      const feats = l.featureCount !== undefined ? `要素=${l.featureCount}` : ''
      const flag = l.loaded === false ? '❌未加载' : '✅'
      lines.push(`${flag} ${String(l.id).slice(0, 30)} type=${l.type || '?'} ${feats} vis=${l.visible}`)
    })
  } catch (e) {
    lines.push('图层读取失败: ' + e.message)
  }

  // 交互统计
  lines.push('')
  lines.push('--- 事件与拾取 ---')
  lines.push(`指针事件: move=${stats.pointerMove} down=${stats.pointerDown} click=${stats.click} wheel=${stats.wheel}`)
  if (stats.lastEvent) {
    lines.push(`最后事件: ${stats.lastEvent.type} btn=${stats.lastEvent.button} type=${stats.lastEvent.pointerType || '-'} trusted=${stats.lastEvent.isTrusted} (${stats.lastEvent.x},${stats.lastEvent.y})`)
  }
  lines.push(`hitTest: 调用=${stats.hitTestCalls} 命中=${stats.hitTestHits} 最近命中=${stats.lastHitCount}(${stats.lastHitKind})`)
  lines.push(`WebGL上下文: 创建=${stats.webglCreated} 丢失=${stats.webglLost} 恢复=${stats.webglRestored}`)
  if (stats.errors.length) {
    lines.push('')
    lines.push('--- 错误 ---')
    stats.errors.forEach((e) => lines.push('⚠ ' + e))
  }

  // 结论提示
  lines.push('')
  lines.push('--- 判读 ---')
  if (stats.pointerMove === 0) {
    lines.push('⚠ 指针事件未到达地图容器（可能是上层遮挡或浏览器输入问题）')
  } else if (stats.hitTestCalls > 0 && stats.hitTestHits === 0) {
    lines.push('⚠ 事件正常但 hitTest 从未命中（拾取/渲染问题，请截图此面板）')
  } else if (stats.hitTestHits > 0) {
    lines.push('✓ hitTest 正常工作（若界面仍无反应，问题在事件回调链）')
  } else {
    lines.push('… 请在地图上悬浮/点击绿道后查看')
  }

  panelEl.textContent = lines.join('\n')
}

export const initMapDiag = (ctx) => {
  if (!isMapDiagEnabled()) return
  if (active) {
    // 视图可能重建，更新上下文
    state = ctx
    return
  }
  active = true
  state = ctx
  panelEl = buildPanel()

  const { container } = ctx
  if (container) {
    // 原生事件计数（capture 阶段，不干扰应用逻辑）
    const count = (kind) => (e) => {
      if (kind === 'pointermove') stats.pointerMove++
      else if (kind === 'pointerdown') stats.pointerDown++
      else if (kind === 'click') stats.click++
      else if (kind === 'wheel') stats.wheel++
      stats.lastEvent = { type: e.type, button: e.button, pointerType: e.pointerType, isTrusted: e.isTrusted, x: Math.round(e.clientX), y: Math.round(e.clientY) }
    }
    ;['pointermove', 'pointerdown', 'click', 'wheel'].forEach((k) => {
      container.addEventListener(k, count(k), { capture: true, passive: true })
    })

    // WebGL 上下文丢失监听（对所有 canvas）
    const observeCanvas = () => {
      container.querySelectorAll('canvas').forEach((c) => {
        if (c.__diagObserved) return
        c.__diagObserved = true
        // 不调用 getContext（会与地图已有上下文冲突），只监听事件
        c.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          stats.webglLost++
        })
        c.addEventListener('webglcontextrestored', () => { stats.webglRestored++ })
        stats.webglCreated++
      })
    }
    observeCanvas()

    // 定时刷新面板 + 探测 canvas 变化
    timer = setInterval(() => {
      observeCanvas()
      render(state)
    }, 800)
    render(state)
  }

  // 便于外部脚本读取
  window.__mapDiagStats = stats
  console.log('[mapdiag] 地图诊断已开启（面板右上角，不遮挡操作）')
}
