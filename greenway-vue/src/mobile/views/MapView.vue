<template>
  <div class="map-view">
    <!-- 地图全屏容器 -->
    <div ref="mapContainer" class="map-container" :class="{ 'night-mode': isDark }" role="application" aria-label="绿道地图"></div>

    <!-- 用户位置标记（CSS 脉冲动画，通过 Overlay 定位） -->
    <div ref="locationMarkerEl" class="location-marker-wrap" style="display:none">
      <span class="location-pulse"></span>
      <span class="location-dot"></span>
    </div>

    <!-- 顶部悬浮搜索栏（悬浮在地图上方） -->
    <div class="top-bar">
      <div class="search-pill" @click="showSearch">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span>搜索绿道、设施…</span>
      </div>
      <button class="poi-fab" :class="{ active: showPoi && zoomOk && anyPoiTypeOn }" @click="onPoiFab" aria-label="设施">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </button>
    </div>

    <!-- 低缩放时提示放大地图查看设施 -->
    <Transition name="fade">
      <div v-if="showPoi && !zoomOk" class="poi-zoom-hint">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        放大地图查看附近设施
      </div>
    </Transition>

    <!-- POI 类型过滤面板（横向滚动 chips） -->
    <Transition name="fade">
      <div v-if="showPoi && poiTypeList.length" class="poi-type-bar">
        <button class="poi-type-chip" :class="{ active: allPoiTypesOn }" @click="toggleAllPoiTypes">全部</button>
        <button
          v-for="t in poiTypeList"
          :key="t.code"
          class="poi-type-chip"
          :class="{ active: poiTypeFilter[t.code], off: !poiTypeFilter[t.code] }"
          :style="poiTypeFilter[t.code] ? { borderColor: t.color, color: t.color } : {}"
          @click="togglePoiType(t.code)"
        >
          <img :src="t.icon" alt="" class="poi-chip-icon" :style="{ opacity: poiTypeFilter[t.code] ? 1 : 0.35 }" />
          {{ t.name }}
        </button>
      </div>
    </Transition>

    <!-- 底部渐变遮罩 + 导航栏 -->
    <div class="bottom-gradient"></div>

    <!-- 绿道信息面板 -->
    <Transition name="trail-sheet">
      <div v-if="selectedTrail" class="trail-sheet">
        <div class="sheet-drag-bar"></div>
        <div class="sheet-row">
          <div class="sheet-color-dot" :style="{ background: selectedTrail.color }"></div>
          <div class="sheet-text">
            <h3 class="sheet-name">{{ selectedTrail.name }}</h3>
            <p v-if="selectedTrail.area" class="sheet-area">{{ selectedTrail.area }}</p>
          </div>
          <button class="sheet-close-btn" @click="selectedTrail = null" aria-label="关闭">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sheet-chips">
          <span v-if="selectedTrail.length" class="s-chip">{{ selectedTrail.length }}km</span>
          <span v-if="selectedTrail.area" class="s-chip">{{ selectedTrail.area }}</span>
          <span v-if="selectedTrail.features" class="s-chip">{{ selectedTrail.features.split('、')[0] }}</span>
        </div>
        <p v-if="selectedTrail.description" class="sheet-desc">{{ selectedTrail.description.length > 80 ? selectedTrail.description.slice(0, 80) + '…' : selectedTrail.description }}</p>
        <button class="sheet-go-btn" @click="goToDetail(selectedTrail.id)">
          查看详情
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </Transition>

    <!-- POI 信息底部弹卡 -->
    <Transition name="trail-sheet">
      <div v-if="selectedPoi" class="trail-sheet poi-sheet">
        <div class="sheet-drag-bar"></div>
        <div class="sheet-row">
          <span class="poi-sheet-icon" :style="{ background: selectedPoi.color }">
            <img :src="poiIconUrl(selectedPoi.poi_type)" alt="" />
          </span>
          <div class="sheet-text">
            <h3 class="sheet-name">{{ selectedPoi.name }}</h3>
            <span class="poi-sheet-type" :style="{ color: selectedPoi.color }">{{ selectedPoi.type_name }}</span>
          </div>
          <button class="sheet-close-btn" @click="selectedPoi = null" aria-label="关闭">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sheet-chips">
          <span v-if="selectedPoi.address" class="s-chip poi-addr">{{ selectedPoi.address }}</span>
          <span v-if="selectedPoi.greenway_name" class="s-chip poi-gw">{{ selectedPoi.greenway_name }}</span>
        </div>
        <button v-if="selectedPoi.greenway_id" class="sheet-go-btn" @click="goToPoiDetail(selectedPoi.greenway_id)">
          查看{{ selectedPoi.greenway_name || '所属绿道' }}详情
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </Transition>

    <MobileBottomNav v-model="activeTab" />
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MobileBottomNav from '../components/MobileBottomNav.vue'
import { fetchGreenways } from '../services/api'
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import Overlay from 'ol/Overlay'
import { Style, Stroke, Icon, Fill, Text } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { useAppTheme } from '../composables/useAppTheme'
import { useLocation } from '../composables/useLocation'
import { fetchPoiFacilities } from '../services/api'
import { POI_TYPE_CONFIG, poiTypeName, poiTypeColor, poiIconUrl } from '../constants/poi'

const router = useRouter()
const route = useRoute()
const mapContainer = ref(null)
const locationMarkerEl = ref(null)
let map = null
const mapInstance = shallowRef(null)
let locationOverlay = null
const activeTab = ref('map')
const { isDark } = useAppTheme()
const selectedTrail = ref(null)
const selectedPoi = ref(null)
const { fetchLocation, isLocating, hasLocation, userLocation, locationStatus } = useLocation()

// POI 设施状态
const MIN_POI_ZOOM = 13             // zoom >= 13 才显示 POI（避免低缩放密集）
const showPoi = ref(false)          // 用户是否开启 POI
const zoomOk = ref(false)           // 当前 zoom 是否 >= MIN_POI_ZOOM
const poiLayer = shallowRef(null)   // OL 图层实例
const poiSource = shallowRef(null)  // OL 源
const poiTypeFilter = ref({})       // 类型开关：code -> bool
const poiTypeList = ref([])         // 去重后的类型项 [{code,name,color,icon,count}]

// 是否有任一类型开启
const anyPoiTypeOn = computed(() => poiTypeList.value.some(t => poiTypeFilter.value[t.code]))

const goToDetail = (id) => { if (id) router.push(`/mobile/detail/${id}`) }
const goToPoiDetail = (id) => { if (id) router.push(`/mobile/detail/${id}`) }

// 设施悬浮按钮：切换 POI 图层显示；首次点击加载
const onPoiFab = async () => {
  if (!poiLayer.value) {
    await loadPoiFacilities()
  }
  togglePoi(!showPoi.value)
}

const allPoiTypesOn = computed(() => poiTypeList.value.length > 0 && poiTypeList.value.every(t => poiTypeFilter.value[t.code]))

/* ---- 地图初始化 ---- */
const initMap = () => {
  if (!mapContainer.value) return
  const rect = mapContainer.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    if (!initMap.retryCount) initMap.retryCount = 0
    initMap.retryCount++
    if (initMap.retryCount < 3) {
      setTimeout(() => initMap(), 500)
    }
    return
  }
  initMap.retryCount = 0

  map = new Map({
    target: mapContainer.value,
    layers: [
      new TileLayer({
        className: 'gaode-base-layer',
        source: new XYZ({
          url: 'https://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
          crossOrigin: 'anonymous',
          tileSize: 256
        })
      })
    ],
    view: new View({
      center: fromLonLat([116.4074, 39.9042]),
      zoom: 12
    }),
    controls: []  // 去掉默认 OL 控件
  })

  mapInstance.value = map

  // 设置用户位置 Overlay（HTML 元素，支持 CSS 脉冲动画）
  // 使用 top-left 定位配合 CSS transform: translate(-50%,-50%) 实现居中
  locationOverlay = new Overlay({
    element: locationMarkerEl.value || document.createElement('div'),
    positioning: 'top-left',
    stopEvent: false,
    offset: [0, 0]
  })
  map.addOverlay(locationOverlay)

  loadAllGreenways()
  loadPoiFacilities()

  // 监听缩放：zoom >= MIN_POI_ZOOM 才显示 POI（低缩放隐藏避免密集）
  map.getView().on('change:resolution', () => {
    const z = map.getView().getZoom()
    if (typeof z !== 'number') return
    const ok = z >= MIN_POI_ZOOM
    if (ok !== zoomOk.value) {
      zoomOk.value = ok
      applyPoiVisibility()
    }
  })

  // 地图初始化后自动进行一次静默定位
  locateUser(true)
}

/* ---- 加载绿道数据 ---- */
const loadAllGreenways = async () => {
  try {
    const geojson = await fetchGreenways()

    const vectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' })
    })

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => new Style({
        stroke: new Stroke({ color: feature.get('color') || '#2E7D32', width: 4 })
      }),
      zIndex: 10
    })

    map.addLayer(vectorLayer)

    const extent = vectorSource.getExtent()
    if (extent?.length === 4 && !extent.includes(Infinity)) {
      map.getView().fit(extent, { padding: [80, 20, 140, 20], duration: 800 })
    }

    // 点击：优先识别 POI 设施，其次绿道
    map.on('click', (event) => {
      const hitPoi = poiLayer.value?.getVisible() && map.forEachFeatureAtPixel(event.pixel, f => f)
      if (hitPoi) {
        const p = hitPoi.getProperties()
        selectedTrail.value = null
        selectedPoi.value = {
          id: p.id || null,
          name: p.name || '未知设施',
          poi_type: p.poi_type || '',
          type_name: p.type_name || poiTypeName(p.poi_type),
          color: p.color || poiTypeColor(p.poi_type),
          address: p.address || '',
          greenway_id: p.greenway_id || null,
          greenway_name: p.greenway_name || ''
        }
        return
      }
      selectedPoi.value = null
      const feature = map.forEachFeatureAtPixel(event.pixel, f => f)
      if (!feature) { selectedTrail.value = null; return }
      const p = feature.getProperties()
      selectedTrail.value = {
        id: p.id || p.gid || null,
        name: p.name || '未知绿道',
        length: p.length,
        area: p.area || p.district || '',
        color: p.color || '#2E9640',
        description: p.description || p.introduction || '',
        features: p.features || ''
      }
    })

    map.on('pointermove', (event) => {
      map.getTargetElement().style.cursor = map.hasFeatureAtPixel(event.pixel) ? 'pointer' : ''
    })
  } catch (e) {
    console.error('加载绿道失败:', e)
  }
}

/* ---- POI 设施 ---- */
const loadPoiFacilities = async () => {
  try {
    const geojson = await fetchPoiFacilities()
    const features = new GeoJSON().readFeatures(geojson, { featureProjection: 'EPSG:3857' })

    // 统计类型项（去重，按出现顺序）
    const seen = {}
    const list = []
    features.forEach(f => {
      const code = String(f.get('poi_type') || '')
      if (code && !seen[code]) {
        seen[code] = true
        list.push({ code, name: poiTypeName(code), color: poiTypeColor(code), icon: poiIconUrl(code), count: 0 })
      }
      if (seen[code] !== undefined) {
        const item = list.find(x => x.code === code)
        if (item) item.count++
      }
    })
    poiTypeList.value = list
    // 默认全部类型开启
    const init = {}
    list.forEach(t => { init[t.code] = true })
    poiTypeFilter.value = init

    poiSource.value = new VectorSource({ features })
    poiLayer.value = new VectorLayer({
      source: poiSource.value,
      style: poiStyleFunction,
      zIndex: 5,
      visible: false
    })
    map.addLayer(poiLayer.value)
  } catch (e) {
    console.error('加载 POI 设施失败:', e)
  }
}

/* POI 分类图标样式 */
const poiStyleFunction = (feature) => {
  const code = String(feature.get('poi_type') || '')
  const color = poiTypeColor(code)
  const labelColor = isDark.value ? '#e5e7eb' : '#333'
  const haloColor = isDark.value ? 'rgba(0,0,0,0.8)' : '#fff'
  return new Style({
    image: new Icon({
      src: poiIconUrl(code),
      scale: 0.9,
      anchor: [0.5, 1],
      color: color
    }),
    text: new Text({
      text: feature.get('name') || '',
      font: '11px "Noto Sans SC", sans-serif',
      fill: new Fill({ color: labelColor }),
      stroke: new Stroke({ color: haloColor, width: 2 }),
      offsetY: 12,
      overflow: false
    })
  })
}

/* 统一计算 POI 图层可见性：用户开关 && 缩放足够 && 有类型开启 */
const applyPoiVisibility = () => {
  if (!poiLayer.value) return
  const shouldShow = showPoi.value && zoomOk.value && anyPoiTypeOn.value
  poiLayer.value.setVisible(shouldShow)
}

// 任一状态变化都重新计算 POI 可见性（覆盖加载完成/缩放/类型/开关所有路径）
watch([poiLayer, showPoi, zoomOk, anyPoiTypeOn], applyPoiVisibility)

/* 切换 POI 图层显隐（仅设用户开关，实际显隐由 applyPoiVisibility 决定） */
const togglePoi = (v) => {
  showPoi.value = v
  applyPoiVisibility()
  if (v && !selectedPoi.value) selectedTrail.value = null
}

/* 类型过滤：勾选/取消某类型 */
const togglePoiType = (code) => {
  if (poiTypeFilter.value[code] === undefined) poiTypeFilter.value[code] = true
  poiTypeFilter.value = { ...poiTypeFilter.value, [code]: !poiTypeFilter.value[code] }
  applyPoiTypeFilter()
}

/* 全部开启 / 全部关闭 */
const setAllPoiTypes = (on) => {
  const next = {}
  poiTypeList.value.forEach(t => { next[t.code] = on })
  poiTypeFilter.value = next
  applyPoiTypeFilter()
}

/* "全部" chip：当前全开则全关，否则全开 */
const toggleAllPoiTypes = () => setAllPoiTypes(!allPoiTypesOn.value)

/* 根据类型过滤条件更新图层 */
const applyPoiTypeFilter = () => {
  if (!poiSource.value || !poiLayer.value) return
  const filter = poiTypeFilter.value
  const anyOn = poiTypeList.value.some(t => filter[t.code])
  applyPoiVisibility()
  if (!anyOn) return
  // 动态过滤：用 style 隐藏不符合类型的要素（OL 无 layer filter，用 style 控制显示）
  poiLayer.value.setStyle((feature) => {
    const code = String(feature.get('poi_type') || '')
    return filter[code] ? poiStyleFunction(feature) : null
  })
  // 标记未渲染的类型以清空选中
  if (selectedPoi.value && !filter[String(selectedPoi.value.poi_type)]) {
    selectedPoi.value = null
  }
}

/* 定位到某 POI（搜索/类型跳转用） */
const locatePoi = (poi) => {
  togglePoi(true)
  selectedPoi.value = poi
  if (poi.lng != null && poi.lat != null) {
    map?.getView().animate({ center: fromLonLat([poi.lng, poi.lat]), zoom: 15, duration: 500 })
  }
}

/* ---- 定位 ---- */
const locateUser = async (silent = false) => {
  await fetchLocation(silent)
  if (userLocation.value) {
    const coord = fromLonLat([userLocation.value.lng, userLocation.value.lat])
    // 更新位置标记 Overlay 的地理坐标
    if (locationOverlay) {
      locationOverlay.setPosition(coord)
      if (locationMarkerEl.value) locationMarkerEl.value.style.display = 'block'
    }
    // 仅手动点击时才移动视图（silent 为自动启动时不移动到位置）
    if (!silent) {
      map?.getView().animate({ center: coord, zoom: 15, duration: 500 })
    }
  }
}

const showSearch = () => router.push('/mobile/poi-search')

onMounted(async () => {
  await nextTick()
  setTimeout(initMap, 300)
})

// 从搜索页跳转定位 POI：/mobile/map?poi={json}
watch(() => route.query.poi, (val) => {
  if (!val || typeof val !== 'string') return
  try {
    const poi = JSON.parse(val)
    if (poi && (poi.lng != null || poi.id != null)) {
      // 等待地图就绪
      const waitMap = setInterval(() => {
        if (map) {
          clearInterval(waitMap)
          locatePoi(poi)
        }
      }, 200)
      setTimeout(() => clearInterval(waitMap), 8000)
    }
  } catch (e) {
    console.error('解析 poi query 失败:', e)
  }
}, { immediate: true })

onUnmounted(() => { map?.dispose() })
</script>

<style scoped>
.map-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 地图全屏 */
.map-container {
  position: absolute;
  inset: 0;
  background: #e8f0e8;
}

/* ---- 用户位置标记 ---- */
.location-marker-wrap {
  position: relative;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.location-dot {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #007aff;
  border: 2.5px solid #fff;
  box-shadow: 0 2px 8px rgba(0,122,255,0.5);
  z-index: 2;
  width: 100%;
  height: 100%;
}
.location-pulse {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  background: rgba(0,122,255,0.2);
  animation: location-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;
}
@keyframes location-pulse {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50%       { opacity: 0;   transform: scale(2.2); }
}


@keyframes spin { to { transform: rotate(360deg); } }

/* 夜间模式滤镜 */
.map-container.night-mode :deep(.gaode-base-layer) {
  filter: grayscale(100%) invert(100%) sepia(100%)
          hue-rotate(190deg) saturate(400%) brightness(88%) contrast(85%) !important;
}
.map-container.night-mode :deep(.ol-layer:not(.gaode-base-layer)) {
  filter: brightness(1.3) drop-shadow(0 0 6px rgba(100, 220, 140, 0.5));
}

/* 顶部悬浮搜索栏 + 设施按钮（flex 并列，避免重叠） */
.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: max(14px, calc(var(--safe-top) + 10px)) 16px 10px;
  z-index: var(--z-float);
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-pill {
  pointer-events: auto;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  background: var(--color-surface);
  border-radius: 22px;
  box-shadow: var(--shadow-lg);
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  cursor: pointer;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.theme-light .search-pill { background: rgba(255,255,255,0.92); }
.theme-dark  .search-pill { background: rgba(44,44,46,0.92); }
.search-pill:active { transform: scale(0.97); }

/* 设施悬浮按钮（flex 项，与搜索 pill 并列） */
.poi-fab {
  pointer-events: auto;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  color: var(--color-primary);
  cursor: pointer;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  transition: transform var(--transition-fast), background var(--transition-fast);
}
.theme-light .poi-fab { background: rgba(255,255,255,0.92); }
.theme-dark  .poi-fab { background: rgba(44,44,46,0.92); }
.poi-fab.active { background: var(--color-primary); color: #fff; }
.poi-fab:active { transform: scale(0.92); }

/* POI 类型过滤 chips 栏（底部导航上方） */
.poi-type-bar {
  position: absolute;
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 12px);
  left: 0; right: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 12px 8px;
  z-index: var(--z-overlay);
  pointer-events: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.poi-type-bar::-webkit-scrollbar { display: none; }
.poi-type-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  box-shadow: var(--shadow-1);
  transition: all var(--transition-fast);
}
.poi-type-chip.off { opacity: 0.55; }
.poi-type-chip.active { font-weight: var(--font-weight-semibold); }
.poi-chip-icon { width: 15px; height: 15px; object-fit: contain; }

/* 低缩放提示条（底部导航上方） */
.poi-zoom-hint {
  position: absolute;
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 64px);
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  background: rgba(0,0,0,0.7);
  color: #fff;
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  z-index: var(--z-overlay);
  pointer-events: none;
  box-shadow: var(--shadow-lg);
}

/* POI 底部弹卡 */
.poi-sheet-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  flex: 0 0 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.poi-sheet-icon img { width: 20px; height: 20px; object-fit: contain; filter: brightness(0) invert(1); }
.poi-sheet-type {
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  margin-top: 2px;
}
.poi-sheet .poi-addr { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.poi-sheet .poi-gw { background: var(--color-surface-2); }



/* 底部渐变遮罩（平滑过渡到底部导航） */
.bottom-gradient {
  position: absolute;
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) - 1px);
  left: 0;
  right: 0;
  height: 48px;
  background: linear-gradient(to top, var(--color-surface) 0%, transparent 100%);
  opacity: 0.6;
  pointer-events: none;
  z-index: calc(var(--z-fixed) - 1);
}

/* 绿道信息面板 */
.trail-sheet {
  position: absolute;
  left: 0; right: 0;
  bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px));
  z-index: var(--z-overlay);
  border-radius: 20px 20px 0 0;
  padding: 8px 16px 16px;
}

.theme-light .trail-sheet {
  background: rgba(255, 255, 255, 0.82);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
}
.theme-dark .trail-sheet {
  background: rgba(28, 28, 30, 0.82);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -4px 24px rgba(0,0,0,0.3);
}
.sheet-drag-bar {
  width: 36px; height: 4px;
  background: var(--color-surface-3);
  border-radius: 2px;
  margin: 0 auto 12px;
}
.sheet-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
.sheet-color-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  flex: 0 0 12px;
  margin-top: 4px;
}
.sheet-text { flex: 1; min-width: 0; }
.sheet-name {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.3;
}
.sheet-area {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 2px 0 0;
}
.sheet-close-btn {
  flex: 0 0 40px;
  width: 40px; height: 40px;
  border-radius: 50%; border: none;
  background: var(--color-surface-2);
  color: var(--color-text-tertiary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.sheet-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-bottom: 8px;
}
.s-chip {
  padding: 4px 10px;
  background: var(--color-surface-2);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}
.sheet-desc {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 12px;
}
.sheet-go-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 46px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-full);
  font-size: var(--text-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.sheet-go-btn:active { opacity: 0.82; }
.sheet-go-btn:disabled { background: var(--color-surface-3); color: var(--color-text-tertiary); }

/* 面板出入场动画 */
.trail-sheet-enter-active, .trail-sheet-leave-active {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.28s ease;
}
.trail-sheet-enter-from, .trail-sheet-leave-to { transform: translateY(100%); opacity: 0; }

/* chips 栏淡入淡出 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
