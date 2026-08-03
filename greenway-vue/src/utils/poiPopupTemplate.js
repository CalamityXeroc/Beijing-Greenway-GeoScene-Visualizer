/**
 * POI 设施图层的 GeoScene PopupTemplate 统一构建器
 * - 单点图层：buildPoiPopupTemplate —— 设施详情 + 官方 ActionButton 跳转按钮
 * - 聚合点：buildClusterPopupTemplate —— 异步查询聚合区域内 POI，列出真实名字
 * 用 GeoScene 官方 popup 机制（popupTemplate + actions），替代自写自定义 popup
 */
const GREENWAY_ROUTE_MAP = {
  '温榆河': '/wenyu', '环二环城市绿道': '/huanerhuan', '亮马河绿道': '/liangmahe',
  '常营半马绿道': '/changying', '昌平42绿道': '/changping42', '丽都商圈绿道': '/lidu',
  '北运河绿道': '/beiyunhe', '南沙绿道': '/nansha', '奥林匹克森林公园绿道': '/aosen',
  '营城建都绿道': '/yingcheng', '三山五园绿道': '/sanshan', '朝阳绿道': '/chaoyang',
  '北翼山水绿道': '/beiyi', '东翼大河绿道': '/dongyi', '郊野休闲环绿道': '/jiaoye',
  '西翼山水绿道': '/xiyi', '中心城滨水绿道': '/zhongxincheng'
}

function fmtDist(m) {
  if (!m) return ''
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
}

function poiColor(code) {
  return { '150500': '#1565C0', '150700': '#0277BD', '150900': '#2E7D32',
    '200300': '#4E342E', '060100': '#C62828', '080600': '#6A1B9A',
    '110100': '#E65100', '110200': '#E65100' }[code] || '#999'
}

// 由绿道名得到详情页路由，找不到返回空
export function greenwayRoute(name) {
  return GREENWAY_ROUTE_MAP[name] || ''
}

// 官方 ActionButton 的 id 前缀（跳转按钮）
export const GO_TO_GREENWAY_ACTION = 'poi-go-greenway'

// 聚合点内容：通过 getLayer() 获取图层，异步查询聚合区域内的 POI 真实名字列表
export function buildClusterPopupTemplate(getLayer) {
  const fallback = (n) => `<div class="poi-popup-cluster-hint">${n} 个设施聚合于此，放大地图可查看</div>`
  return {
    title: '设施聚合',
    content: async (event) => {
      const graphic = event?.graphic
      const att = graphic?.attributes || {}
      const layer = typeof getLayer === 'function' ? getLayer() : null
      if (!layer || typeof layer.queryFeatures !== 'function') return fallback(att.cluster_count)
      try {
        const res = await layer.queryFeatures({
          geometry: graphic.geometry,
          distance: 3000,
          units: 'meters',
          spatialRelationship: 'intersects',
          outFields: ['name', 'poi_type', 'greenway_name'],
          returnGeometry: false
        })
        const items = (res.features || []).slice(0, att.cluster_count || 20)
        if (!items.length) return fallback(att.cluster_count)
        const rows = items.map(f => {
          const a = f.attributes
          return `<div class="poi-popup-cluster-item"><i class="poi-dot" style="background:${poiColor(a.poi_type)}"></i><span>${a.name || ''}</span>${a.greenway_name ? `<em>${a.greenway_name}</em>` : ''}</div>`
        }).join('')
        return `<div class="poi-popup-cluster">
          <div class="poi-popup-cluster-head">共 ${items.length} 个设施：</div>
          <div class="poi-popup-cluster-list">${rows}</div>
        </div>`
      } catch (e) {
        return fallback(att.cluster_count)
      }
    }
  }
}

// 单点 PopupTemplate：设施详情 + 官方跳转 ActionButton
export function buildPoiPopupTemplate(facilityConfig) {
  return {
    title: '{name}',
    content: (event) => {
      const g = event?.graphic
      const att = g?.attributes || {}
      const cfg = facilityConfig[att.poi_type] || {}
      const dist = fmtDist(att.distance_m)
      const route = greenwayRoute(att.greenway_name)
      // 用绝对 URL：GeoScene sanitizer 会清空相对 src，导致空图片 → 页面 URL → 损坏图标
      const icon = cfg.icon ? `<img class="poi-popup-icon" src="${window.location.origin}/images/poi/${cfg.icon}" alt=""/>` : ''
      // 用 span + title 做跳转（GeoScene sanitizer 过滤 a[href]/button/data-*，但保留 title/class）
      const btn = route
        ? `<span class="poi-popup-btn" title="${route}">查看绿道详情 →</span>`
        : ''
      return `<div class="poi-popup">
        ${icon}
        <div class="poi-popup-type" style="color:${cfg.color || '#666'}">${cfg.name || att.type_name || ''}</div>
        <div class="poi-popup-name">${att.name || ''}</div>
        ${att.address ? `<div class="poi-popup-addr">📍 ${att.address}</div>` : ''}
        ${dist ? `<div class="poi-popup-dist">📏 距绿道 ${dist}</div>` : ''}
        ${att.greenway_name ? `<div class="poi-popup-gw">🌿 ${att.greenway_name}</div>` : ''}
        ${btn}
      </div>`
    }
  }
}

/**
 * 全局点击委托：点击 popup 内带 data-route 的 span 时跳转对应路由
 * @param {Object} router Vue Router
 * @returns {Function} 清理函数
 */
export function bindPoiPopupNavigation(router) {
  const handler = (e) => {
    const el = e.target?.closest?.('.poi-popup-btn')
    if (!el) return
    const route = el.getAttribute('title')
    if (route && route.startsWith('/') && router) router.push(route)
  }
  document.addEventListener('click', handler)
  return () => document.removeEventListener('click', handler)
}
