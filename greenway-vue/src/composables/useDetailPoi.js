/**
 * 详情页 POI 图层 + popup + tooltip + 类型筛选管理
 */
import { reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sessionRef } from '@/utils/sessionRef.js'
import GeoJSONLayer from '@geoscene/core/layers/GeoJSONLayer.js'
import UniqueValueRenderer from '@geoscene/core/renderers/UniqueValueRenderer.js'
import PictureMarkerSymbol from '@geoscene/core/symbols/PictureMarkerSymbol.js'
import { buildPoiPopupTemplate, bindPoiPopupNavigation } from '@/utils/poiPopupTemplate.js'

const FACILITY_CONFIG = {
  '150500': { name: '地铁站', icon: 'subway.svg', color: '#1565C0' },
  '150700': { name: '公交站', icon: 'bus.svg', color: '#0277BD' },
  '150900': { name: '停车场', icon: 'parking.svg', color: '#2E7D32' },
  '200300': { name: '卫生间', icon: 'restroom.svg', color: '#4E342E' },
  '060100': { name: '便利店', icon: 'store.svg', color: '#C62828' },
  '080600': { name: '影剧院', icon: 'cinema.svg', color: '#6A1B9A' },
  '110100': { name: '景点', icon: 'scenic.svg', color: '#E65100' },
  '110200': { name: '景点', icon: 'scenic.svg', color: '#E65100' },
}

// 7 项展示（110100 和 110200 在前端合并为一类）
const POI_TYPE_LIST = [
  { code: '150500', name: '地铁站', icon: 'subway.svg' },
  { code: '150700', name: '公交站', icon: 'bus.svg' },
  { code: '150900', name: '停车场', icon: 'parking.svg' },
  { code: '200300', name: '卫生间', icon: 'restroom.svg' },
  { code: '060100', name: '便利店', icon: 'store.svg' },
  { code: '080600', name: '影剧院', icon: 'cinema.svg' },
  { code: '110100', name: '景点', icon: 'scenic.svg' },
]

const GREENWAY_ROUTE_MAP = {
  '温榆河': '/wenyu', '环二环城市绿道': '/huanerhuan', '亮马河绿道': '/liangmahe',
  '常营半马绿道': '/changying', '昌平42绿道': '/changping42', '丽都商圈绿道': '/lidu',
  '北运河绿道': '/beiyunhe', '南沙绿道': '/nansha', '奥林匹克森林公园绿道': '/aosen',
  '营城建都绿道': '/yingcheng', '三山五园绿道': '/sanshan', '朝阳绿道': '/chaoyang',
  '北翼山水绿道': '/beiyi', '东翼大河绿道': '/dongyi', '郊野休闲环绿道': '/jiaoye',
  '西翼山水绿道': '/xiyi', '中心城滨水绿道': '/zhongxincheng'
}

// 全局持久化：跨详情页共享筛选状态
const _globalFilters = sessionRef('gw_detailPoiFilters', null)

export function useDetailPoi(greenwayName) {
  const router = useRouter()
  const layerId = `detail-facilities-${greenwayName}`

  // 每个实例初始化时 merge 全局缓存中的状态
  const initFilters = () => {
    const defaults = Object.fromEntries(Object.keys(FACILITY_CONFIG).map(k => [k, true]))
    const cached = _globalFilters.value
    return cached ? { ...defaults, ...cached } : { ...defaults }
  }
  const poiTypeFilters = reactive(initFilters())

  const poiTypeList = POI_TYPE_LIST

  const popup = reactive({
    visible: false, poiName: '', poiTypeName: '', poiSvg: '',
    poiColor: '#666', poiAddress: '', poiDistance: '', poiGreenway: '',
    position: { x: 0, y: 0 }
  })

  const tooltip = reactive({
    visible: false, title: '', data: { type: '', distance: '' },
    position: { x: 0, y: 0 }
  })

  const tooltipStyle = computed(() => ({
    left: `${tooltip.position.x + 15}px`,
    top: `${tooltip.position.y + 15}px`
  }))

  const popupStyle = computed(() => ({
    left: `${popup.position.x}px`,
    top: `${popup.position.y}px`
  }))

  // 同步持久化筛选状态 + 更新渲染器
  function applyTypeFilters(mapManager) {
    _globalFilters.value = { ...poiTypeFilters }
    if (!mapManager) return
    const layer = mapManager.getLayer(layerId)
    if (!layer?.renderer || layer.renderer.type !== 'unique-value') return
    const newInfos = Object.entries(FACILITY_CONFIG)
      .filter(([code]) => poiTypeFilters[code])
      .map(([code, cfg]) => ({
        value: code,
        symbol: new PictureMarkerSymbol({ url: `/images/poi/${cfg.icon}`, width: '24px', height: '24px' })
      }))
    layer.renderer.uniqueValueInfos = newInfos
  }

  function togglePoiType(code, checked) {
    poiTypeFilters[code] = checked
    if (code === '110100') poiTypeFilters['110200'] = checked
    if (code === '110200') poiTypeFilters['110100'] = checked
  }

  function toggleAllPoiTypes(checked) {
    Object.keys(poiTypeFilters).forEach(k => { poiTypeFilters[k] = checked })
  }

  // 自动同步渲染器
  watch(() => ({ ...poiTypeFilters }), () => { applyTypeFilters(_mm) }, { deep: true })

  // 搜索半径
  const _radiusKey = `gw_detailPoiRadius_${greenwayName}`
  const radius = sessionRef(_radiusKey, 1000)

  // 保存 mapManager 引用供 renderer 更新用
  let _mm = null
  let _blobUrl = null

  function loadPoiLayer(mapManager) {
    if (!mapManager) return
    _mm = mapManager
    // 绑定 popup 内"查看绿道详情"按钮的全局点击委托（composable 创建时绑定）
    if (!_navBound) {
      _unbindNav = bindPoiPopupNavigation(router)
      _navBound = true
    }

    const encoded = encodeURIComponent(greenwayName)
    const url = `/api/greenways/name/${encoded}/nearby-facilities/geojson?radius=${radius.value}`
    _doLoad(url, mapManager)
  }

  function _doLoad(url, mapManager) {
    fetch(url)
      .then(r => r.json())
      .then(geojson => {
        if (!geojson.features) return
        if (!_mm?.getView) return

        // 先清理旧图层
        const old = mapManager.getLayer(layerId)
        if (old?._objectUrl) { URL.revokeObjectURL(old._objectUrl) }
        if (old) mapManager.removeLayer(layerId)

        if (geojson.features.length === 0) { console.log(`[useDetailPoi] ${greenwayName}: 0 POI (radius=${radius.value}m)`); return }

        const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' })
        _blobUrl = URL.createObjectURL(blob)

        const uniqueValueInfos = Object.entries(FACILITY_CONFIG)
          .filter(([code]) => poiTypeFilters[code])
          .map(([code, cfg]) => ({
            value: code,
            symbol: new PictureMarkerSymbol({ url: `/images/poi/${cfg.icon}`, width: '24px', height: '24px' })
          }))

        const layer = new GeoJSONLayer({
          id: layerId, title: '附近设施', url: _blobUrl, visible: true,
          outFields: ['id', 'name', 'poi_type', 'type_name', 'distance_m', 'greenway_id', 'greenway_name', 'address'],
          minScale: 0, maxScale: 0,
          renderer: new UniqueValueRenderer({ field: 'poi_type', uniqueValueInfos }),
          // 统一 GeoScene popup：单点详情 + 跳转按钮
          popupTemplate: buildPoiPopupTemplate(FACILITY_CONFIG)
        })
        layer._zIndex = 250
        layer.listMode = 'hide'
        layer._objectUrl = _blobUrl

        _mm.addLayer(layerId, layer)
        console.log(`[useDetailPoi] ${greenwayName}: ${geojson.features.length} 个 POI (radius=${radius.value}m)`)
      })
      .catch(e => { console.error(`[useDetailPoi] ${greenwayName} 加载失败:`, e.message) })
  }

  function changeRadius(val) {
    radius.value = val
    if (!_mm) return
    const encoded = encodeURIComponent(greenwayName)
    _doLoad(`/api/greenways/name/${encoded}/nearby-facilities/geojson?radius=${val}`, _mm)
  }

  function onFeatureClick({ featuresWithLayers }) {
    for (const item of (featuresWithLayers || [])) {
      if (item.layerId === layerId) {
        const attr = item.feature?.attributes || {}
        // UI 统一交给 GeoScene popup，这里只做埋点
        popup.visible = false
        tooltip.visible = false
        fetch('/api/poi/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poi_id: attr.id, poi_name: attr.name, poi_type: attr.poi_type, greenway_id: attr.greenway_id }) }).catch(() => {})
        return
      }
    }
  }

  function onFeatureHover({ featuresWithLayers, pixel }) {
    if (popup.visible) return
    for (const item of (featuresWithLayers || [])) {
      if (item.layerId === layerId) {
        const attr = item.feature?.attributes || {}
        tooltip.title = attr.name || ''
        tooltip.data = {
          type: attr.type_name || '',
          distance: attr.distance_m
            ? (attr.distance_m < 1000 ? attr.distance_m + 'm' : (attr.distance_m / 1000).toFixed(1) + 'km')
            : ''
        }
        tooltip.position = { x: pixel[0], y: pixel[1] }
        tooltip.visible = true
        return
      }
    }
    tooltip.visible = false
  }

  function closePopup() {
    popup.visible = false
  }

  function goToPoiGreenway() {
    const name = popup.poiGreenway
    closePopup()
    if (!name) return
    const path = GREENWAY_ROUTE_MAP[name]
    if (path) router.push(path)
  }

  // popup 内官方 ActionButton 的 trigger-action 跳转（loadPoiLayer 拿到 view 时绑定）
  let _unbindNav = () => {}
  let _navBound = false

  function cleanupPoi(mapManager) {
    if (!mapManager) return
    const layer = mapManager.getLayer(layerId)
    if (layer?._objectUrl) { URL.revokeObjectURL(layer._objectUrl) }
    if (_blobUrl) { URL.revokeObjectURL(_blobUrl); _blobUrl = null }
    mapManager.removeLayer(layerId)
    _mm = null
    _unbindNav?.()
    _unbindNav = null
    _navBound = false
  }

  return {
    popup, tooltip, tooltipStyle, popupStyle,
    poiTypeFilters, poiTypeList, radius, togglePoiType, toggleAllPoiTypes, applyTypeFilters,
    loadPoiLayer, changeRadius, onFeatureClick, onFeatureHover, closePopup, goToPoiGreenway, cleanupPoi,
    FACILITY_CONFIG
  }
}
