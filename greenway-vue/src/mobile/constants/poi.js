/**
 * POI 设施类型配置（移动端）
 * 对齐 Web 端 FACILITY_CONFIG（GreenwayOverview.vue）
 */
export const POI_TYPE_CONFIG = {
  '150500': { name: '地铁站', icon: 'subway.svg', color: '#1565C0' },
  '150700': { name: '公交站', icon: 'bus.svg', color: '#0277BD' },
  '150900': { name: '停车场', icon: 'parking.svg', color: '#2E7D32' },
  '200300': { name: '卫生间', icon: 'restroom.svg', color: '#4E342E' },
  '060100': { name: '便利店', icon: 'store.svg', color: '#C62828' },
  '080600': { name: '影剧院', icon: 'cinema.svg', color: '#6A1B9A' },
  '110100': { name: '景点', icon: 'scenic.svg', color: '#E65100' },
  '110200': { name: '景点', icon: 'scenic.svg', color: '#E65100' }
}

/** 返回某类型的展示名，未知类型回退为原始 code */
export function poiTypeName(code) {
  return POI_TYPE_CONFIG[code]?.name || '设施'
}

/** 返回某类型的颜色，未知回退灰色 */
export function poiTypeColor(code) {
  return POI_TYPE_CONFIG[code]?.color || '#999'
}

/** 返回某类型的图标 URL（Capacitor 内相对路径即可） */
export function poiIconUrl(code) {
  const icon = POI_TYPE_CONFIG[code]?.icon || 'scenic.svg'
  return `/images/poi/${icon}`
}
