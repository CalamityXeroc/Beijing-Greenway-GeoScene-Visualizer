<template>
  <div ref="panelRef" class="path-planning-panel" :class="{ 'panel-expanded': !!routeResult }"
       :style="{ left: panelPos.x + 'px', bottom: (20 - panelPos.y) + 'px', cursor: isDragging ? 'grabbing' : '' }">
    <!-- 头部 -->
    <div class="panel-header" @mousedown="onDragStart" :style="{ cursor: 'grab' }">
      <div class="panel-title">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
          <path d="M5 12h4l3 6 5-12 3 6h4"/>
        </svg>
        路径规划
      </div>
      <button class="close-btn" @click="$emit('close')" title="关闭">&#xD7;</button>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-msg" @click="error = null">
      <i class="fas fa-exclamation-circle"></i> {{ error }}
    </div>

    <!-- 出行方式 -->
    <div class="mode-selector">
      <button class="mode-btn" :class="{ active: travelMode === 'walking' }"
              @click="setTravelMode('walking')">
        <i class="fas fa-walking"></i> 步行
      </button>
      <button class="mode-btn" :class="{ active: travelMode === 'bicycling' }"
              @click="setTravelMode('bicycling')">
        <i class="fas fa-biking"></i> 骑行
      </button>
    </div>

    <!-- 起点 -->
    <div class="input-section">
      <div class="input-row">
        <span class="input-label start-label">起点</span>
        <div class="input-wrapper">
          <input class="address-input" type="text"
                 :value="origin?.address || ''"
                 :placeholder="activeInput === 'origin' ? '请点击地图选择起点...' : '输入地址搜索或点击地图选择'"
                 @input="onOriginInput"
                 @focus="searchTarget = 'origin'"
                 @blur="onBlur('origin')" />
          <div v-if="searchTarget === 'origin' && searchResults.length > 0" class="search-dropdown">
            <div v-for="poi in searchResults" :key="poi.name + poi.lng"
                 class="search-item" @mousedown.prevent="selectSearchResult('origin', poi)">
              <i class="fas fa-map-marker-alt search-icon"></i>
              <div>
                <div class="search-item-name">{{ poi.name }}</div>
                <div class="search-item-addr">{{ poi.address }}</div>
              </div>
            </div>
          </div>
        </div>
        <button class="icon-btn" :class="{ active: activeInput === 'origin' }"
                @click="toggleMapPick('origin')" title="从地图选择">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </button>
        <button class="icon-btn" @click="handleGPSLocate('origin')" title="我的位置">
          <i class="fas fa-location-crosshairs"></i>
        </button>
      </div>

      <!-- 终点 -->
      <div class="input-row">
        <span class="input-label end-label">终点</span>
        <div class="input-wrapper">
          <input class="address-input" type="text"
                 :value="destination?.address || ''"
                 :placeholder="activeInput === 'destination' ? '请点击地图选择终点...' : '输入地址搜索或点击地图选择'"
                 @input="onDestInput"
                 @focus="searchTarget = 'destination'"
                 @blur="onBlur('destination')" />
          <div v-if="searchTarget === 'destination' && searchResults.length > 0" class="search-dropdown">
            <div v-for="poi in searchResults" :key="poi.name + poi.lng"
                 class="search-item" @mousedown.prevent="selectSearchResult('destination', poi)">
              <i class="fas fa-map-marker-alt search-icon"></i>
              <div>
                <div class="search-item-name">{{ poi.name }}</div>
                <div class="search-item-addr">{{ poi.address }}</div>
              </div>
            </div>
          </div>
        </div>
        <button class="icon-btn" :class="{ active: activeInput === 'destination' }"
                @click="toggleMapPick('destination')" title="从地图选择">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 途经点 -->
    <div class="waypoints-section">
      <div class="waypoints-header">
        <span class="input-label">途经点</span>
        <button class="add-waypoint-btn" @click="addWaypoint({ lng: 0, lat: 0, address: '' })"
                :disabled="waypointCount >= 5" title="添加途经点（最多5个）">
          <i class="fas fa-plus"></i> 添加
        </button>
      </div>
      <div v-for="(wp, idx) in waypoints" :key="wp.id" class="waypoint-row">
        <span class="wp-index">{{ idx + 1 }}</span>
        <div class="input-wrapper">
          <input class="address-input wp-input" type="text"
                 :value="wp.address || ''"
                 :placeholder="activeInput === wp.id ? '请点击地图选择途经点...' : '搜索或点击地图'"
                 @input="onWaypointInput($event, wp)" />
        </div>
        <button class="icon-btn" :class="{ active: activeInput === wp.id }"
                @click="toggleMapPick(wp.id)" title="从地图选择">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </button>
        <button class="icon-btn icon-btn-del" @click="removeWaypoint(wp.id)" title="删除">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- 规划按钮 -->
    <button class="plan-btn" :disabled="!hasRequired || isPlanning" @click="doPlanRoute">
      <i v-if="isPlanning" class="fas fa-spinner fa-spin"></i>
      <span v-else>开始规划</span>
    </button>

    <!-- 路线结果 -->
    <div v-if="routeResult" class="result-section">
      <div class="result-stats">
        <div class="result-stat">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="12" x2="22" y2="12"/>
          </svg>
          {{ routeInfo.distance }}
        </div>
        <div class="result-stat">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {{ routeInfo.duration }}
        </div>
        <div class="result-stat">
          <i :class="travelMode === 'walking' ? 'fas fa-walking' : 'fas fa-biking'"></i>
          {{ travelMode === 'walking' ? '步行' : '骑行' }}
        </div>
      </div>

      <!-- 步骤列表 -->
      <div class="steps-list" v-if="routeInfo.steps.length > 0">
        <div v-for="(step, i) in routeInfo.steps" :key="i" class="step-item">
          <span class="step-index">{{ i + 1 }}</span>
          <div>
            <span>{{ step.instruction }}</span>
            <span class="step-distance">{{ step.distance }}</span>
          </div>
        </div>
      </div>

      <div class="action-row">
        <button class="action-btn" @click="clearRoute">
          <i class="fas fa-trash-alt"></i> 清除
        </button>
        <button class="action-btn action-btn-retry" @click="doPlanRoute" :disabled="isPlanning">
          <i class="fas fa-redo"></i> 重试
        </button>
      </div>
    </div>
  </div>

  <!-- 登录提示弹窗 -->
  <Teleport to="body">
    <div v-if="showLoginModal" class="login-modal-overlay" @click.self="showLoginModal = false">
      <div class="login-modal">
        <div class="login-modal-icon">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#4CAF50"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h3 class="login-modal-title">请先登录</h3>
        <p class="login-modal-text">登录后可使用路径规划功能</p>
        <div class="login-modal-actions">
          <button class="login-modal-btn cancel" @click="showLoginModal = false">取消</button>
          <button class="login-modal-btn confirm" @click="goToLogin">去登录</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getRouteStore } from '@/stores/route.js'
import { useUserAuth } from '@/stores/userAuth'
import { reverseGeocode } from '@/services/gaodeApi.js'
import { saveRouteRecord } from '@/services/routeApi.js'
import { wgs84ToGcj02 } from '@/utils/coordinateTransform'
import Graphic from '@geoscene/core/Graphic.js'
import Polyline from '@geoscene/core/geometry/Polyline.js'
import Point from '@geoscene/core/geometry/Point.js'
import GraphicsLayer from '@geoscene/core/layers/GraphicsLayer.js'
import Extent from '@geoscene/core/geometry/Extent.js'
import { markRaw } from 'vue'

const router = useRouter()
const userAuth = useUserAuth()
const showLoginModal = ref(false)

const emit = defineEmits(['close'])

const {
  state, hasRequired, waypointCount,
  setOrigin, setDestination, addWaypoint, removeWaypoint,
  setTravelMode, setActiveInput,
  handleMapClick, debouncedSearch, planRoute, clearResults,
  clearRoute: _storeClearRoute
} = getRouteStore()

// 本地包装：同时清理状态和地图上的路线图层
function clearRoute() {
  _storeClearRoute()
  clearRouteGraphics()
}

const props = defineProps({
  mapManager: { type: Object, required: true },
  layerManager: { type: Object, required: true }
})

const searchTarget = ref(null)
let routeLayer = null

// 暴露属性给模板
const origin = computed(() => state.origin)
const destination = computed(() => state.destination)
const waypoints = computed(() => state.waypoints)
const travelMode = computed(() => state.travelMode)
const routeResult = computed(() => state.routeResult)
const isPlanning = computed(() => state.isPlanning)
const activeInput = computed(() => state.activeInput)
const searchResults = computed(() => state.searchResults)
const error = computed({
  get: () => state.error,
  set: (v) => { state.error = v }
})

// 拖拽状态
const panelRef = ref(null)
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const panelPos = ref({ x: 20, y: 0 }) // left: 20px from left, y offset from bottom

function onDragStart(e) {
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'I') return
  isDragging.value = true
  dragOffset.value = { x: e.clientX - panelPos.value.x, y: e.clientY - panelPos.value.y }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', onDragEnd)
}

function onDrag(e) {
  if (!isDragging.value) return
  // 面板用 bottom 定位：换算成「顶部不低于地图容器顶部 8px」，
  // 否则可以一直往上拖，标题栏跑到屏幕外后就再也拖不回来
  const el = panelRef.value
  const parentH = el?.parentElement?.clientHeight || window.innerHeight
  const panelH = el?.offsetHeight || 0
  const minY = 28 + panelH - parentH
  panelPos.value = {
    x: e.clientX - dragOffset.value.x,
    y: Math.max(minY, e.clientY - dragOffset.value.y)
  }
}

function onDragEnd() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', onDragEnd)
}

function toggleMapPick(inputId) {
  if (activeInput.value === inputId) {
    setActiveInput(null)
    document.body.style.cursor = ''
  } else {
    setActiveInput(inputId)
    document.body.style.cursor = 'crosshair'
  }
}

function onOriginInput(e) {
  searchTarget.value = 'origin'
  debouncedSearch(e.target.value)
}

function onDestInput(e) {
  searchTarget.value = 'destination'
  debouncedSearch(e.target.value)
}

function onWaypointInput(e, wp) {
  searchTarget.value = 'waypoint-' + wp.id
  debouncedSearch(e.target.value)
}

function onBlur(target) {
  setTimeout(() => {
    if (searchTarget.value === target) searchTarget.value = null
  }, 200)
}

function selectSearchResult(target, poi) {
  const point = { lng: poi.lng, lat: poi.lat, address: poi.name }
  if (target === 'origin') setOrigin(point)
  else setDestination(point)
  searchTarget.value = null
  state.searchResults = []
}

async function handleGPSLocate(target) {
  if (!navigator.geolocation) {
    state.error = '您的浏览器不支持定位功能，请手动输入地址'
    return
  }
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 0
      })
    })
    // OSRM 使用 WGS84 路网，但高德底图为 GCJ-02：定位坐标先转 GCJ-02 与底图/后端统一
    // 后端 /api/osrm/route 会将 GCJ-02 转回 WGS-84 匹配路网
    const gcj = wgs84ToGcj02(pos.coords.longitude, pos.coords.latitude)
    const { lng, lat } = gcj
    let address = ''
    try { address = await reverseGeocode(lng, lat) } catch {}
    const point = { lng, lat, address: address || '我的位置' }
    if (target === 'origin') setOrigin(point)
    else setDestination(point)
    state.error = null
  } catch (e) {
    const messages = {
      1: '您拒绝了定位权限，请手动输入地址或允许定位',
      2: '无法获取您的位置信息，请检查网络或手动输入地址',
      3: '定位超时，请重试或手动输入地址'
    }
    state.error = messages[e.code] || '获取位置失败，请重试'
  }
}

function parseStepsFromRoute(route) {
  if (!route?.paths?.[0]?.steps) return []
  return route.paths[0].steps.map(s => ({
    instruction: s.instruction || '',
    distance: formatDistance(s.distance),
    road: s.road || ''
  }))
}

function parsePolylineFromRoute(route) {
  // OSRM 直接返回 GeoJSON coordinates 数组，无需解析 polyline 字符串
  const path = route?.paths?.[0]
  if (path?.coordinates?.length) return path.coordinates
  // 兼容旧格式：从 steps 中提取 step 级坐标
  const points = []
  if (path?.steps) {
    for (const step of path.steps) {
      if (step.coordinates?.length) {
        points.push(...step.coordinates)
      } else if (step.polyline) {
        // 兼容高德 polyline 字符串
        const coords = step.polyline.split(';').map(p => {
          const [lng, lat] = p.split(',').map(Number)
          return [lng, lat]
        })
        points.push(...coords)
      }
    }
  }
  return points
}

function formatDistance(meters) {
  if (!meters && meters !== 0) return ''
  const m = parseInt(meters)
  if (m >= 1000) return `${(m / 1000).toFixed(1)} 公里`
  return `${m} 米`
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return ''
  const s = parseInt(seconds)
  if (s >= 3600) return `${Math.floor(s / 3600)} 小时 ${Math.floor((s % 3600) / 60)} 分钟`
  if (s >= 60) return `${Math.floor(s / 60)} 分钟`
  return `${s} 秒`
}

const routeInfo = computed(() => {
  const route = state.routeResult
  if (!route) return { distance: '', duration: '', steps: [] }
  const path = route.paths?.[0] || {}
  return {
    distance: formatDistance(path.distance),
    duration: formatDuration(path.duration),
    steps: parseStepsFromRoute(route)
  }
})

function initRouteLayer() {
  if (routeLayer) return
  routeLayer = markRaw(new GraphicsLayer({ visible: true, listMode: 'show' }))
  routeLayer._zIndex = 200
  props.mapManager.addLayer('route-layer', routeLayer)
}

function clearRouteGraphics() {
  if (routeLayer) routeLayer.removeAll()
}

function drawRoute(route, origin, destination, waypoints) {
  initRouteLayer()
  clearRouteGraphics()

  const polylinePoints = parsePolylineFromRoute(route)
  if (polylinePoints.length > 1) {
    const polyline = new Polyline({
      paths: [polylinePoints],
      spatialReference: { wkid: 4326 }
    })
    routeLayer.add(new Graphic({
      geometry: polyline,
      symbol: { type: 'simple-line', color: '#2196F3', width: 4, cap: 'round', join: 'round' }
    }))
  }

  if (origin) {
    routeLayer.add(new Graphic({
      geometry: new Point({ longitude: origin.lng, latitude: origin.lat, spatialReference: { wkid: 4326 } }),
      symbol: { type: 'simple-marker', color: '#4CAF50', size: 12, outline: { color: '#fff', width: 2 } }
    }))
  }
  if (destination) {
    routeLayer.add(new Graphic({
      geometry: new Point({ longitude: destination.lng, latitude: destination.lat, spatialReference: { wkid: 4326 } }),
      symbol: { type: 'simple-marker', color: '#F44336', size: 12, outline: { color: '#fff', width: 2 } }
    }))
  }
  // 过滤无效途经点（未填写的占位 {lng:0,lat:0} 不绘制，避免出现非洲海岸标记）
  const isValid = (p) => p && p.lng > 70 && p.lng < 140 && p.lat > 15 && p.lat < 60 && !(p.lng === 0 && p.lat === 0)
  waypoints?.filter(isValid).forEach((wp, i) => {
    routeLayer.add(new Graphic({
      geometry: new Point({ longitude: wp.lng, latitude: wp.lat, spatialReference: { wkid: 4326 } }),
      symbol: {
        type: 'text', text: String(i + 1), color: '#fff',
        haloColor: '#2196F3', haloSize: 2,
        font: { size: 11, weight: 'bold' }, yoffset: -8
      }
    }))
  })

  const allPts = [origin, destination, ...(waypoints || [])].filter(isValid)
  if (allPts.length > 0) {
    const lngs = allPts.map(p => p.lng)
    const lats = allPts.map(p => p.lat)
    const extent = new Extent({
      xmin: Math.min(...lngs), ymin: Math.min(...lats),
      xmax: Math.max(...lngs), ymax: Math.max(...lats),
      spatialReference: { wkid: 4326 }
    })
    props.mapManager.fitExtent(extent, { padding: [80, 80, 80, 450], maxZoom: 15 })
  }
}

async function doPlanRoute() {
  if (!userAuth.isLoggedIn.value) {
    showLoginModal.value = true
    return
  }
  await planRoute(async (route, origin, destination, waypoints) => {
    drawRoute(route, origin, destination, waypoints)
    // 自动保存路径规划记录
    try {
      const path = route.paths?.[0] || {}
      await saveRouteRecord({
        user_id: userAuth.currentUser.value?.id,
        origin,
        destination,
        waypoints: waypoints || [],
        travel_mode: state.travelMode,
        distance: parseInt(path.distance) || 0,
        duration: parseInt(path.duration) || 0
      })
    } catch (e) {
      console.warn('[路径规划] 记录保存失败:', e.message)
    }
  })
}

function goToLogin() {
  showLoginModal.value = false
  router.push('/login?redirect=/map')
}

// 当 activeInput 变化时，更新光标样式
watch(activeInput, (val) => {
  document.body.style.cursor = val ? 'crosshair' : ''
})

// 起/终点变化时立即在地图上显示标记
watch([() => state.origin, () => state.destination], ([o, d]) => {
  initRouteLayer()
  // 清除旧的起终点标记（保留路线折线）
  if (routeLayer) {
    const existing = [...routeLayer.graphics]
    existing.forEach(g => {
      const sym = g.symbol
      if (sym?.type === 'simple-marker' || sym?.type === 'text') routeLayer.remove(g)
    })
  }
  if (o?.lng && o?.lat) {
    routeLayer.add(new Graphic({
      geometry: new Point({ longitude: o.lng, latitude: o.lat, spatialReference: { wkid: 4326 } }),
      symbol: { type: 'simple-marker', color: '#4CAF50', size: 12, outline: { color: '#fff', width: 2 } }
    }))
  }
  if (d?.lng && d?.lat) {
    routeLayer.add(new Graphic({
      geometry: new Point({ longitude: d.lng, latitude: d.lat, spatialReference: { wkid: 4326 } }),
      symbol: { type: 'simple-marker', color: '#F44336', size: 12, outline: { color: '#fff', width: 2 } }
    }))
  }
})

onBeforeUnmount(() => {
  document.body.style.cursor = ''
  if (routeLayer) {
    props.mapManager.removeLayer('route-layer')
    routeLayer = null
  }
})
</script>

<style scoped>
.path-planning-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 380px;
  max-height: calc(100vh - 140px);
  background: var(--card-bg, rgba(255,255,255,0.95));
  border: 1px solid var(--card-border, rgba(0,0,0,0.08));
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 1500;
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  background: linear-gradient(135deg, rgba(76,175,80,0.06), rgba(33,150,243,0.06));
  border-radius: 14px 14px 0 0;
  flex-shrink: 0;
}

.panel-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #2c3e50);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title svg { color: #4CAF50; }

.close-btn {
  background: none; border: none; cursor: pointer;
  color: var(--text-secondary, #555); font-size: 1.3rem;
  padding: 2px 8px; border-radius: 6px; line-height: 1;
  transition: all 0.15s;
}
.close-btn:hover { background: rgba(244,67,54,0.1); color: #D32F2F; }

.mode-selector {
  display: flex; gap: 8px; padding: 12px 16px; flex-shrink: 0;
}

.mode-btn {
  flex: 1; padding: 8px; border-radius: 8px;
  border: 1.5px solid var(--border-color, #e0e0e0);
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #2c3e50);
  cursor: pointer; font-size: 0.85rem; font-weight: 500;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all 0.2s;
}
.mode-btn:hover { border-color: #4CAF50; background: rgba(76,175,80,0.06); }
.mode-btn.active {
  border-color: #4CAF50; background: rgba(76,175,80,0.12);
  color: #2E7D32; font-weight: 600;
}

.input-section { padding: 0 16px; flex-shrink: 0; }

.input-row {
  display: flex; gap: 6px; align-items: center; margin-bottom: 10px;
}

.input-label {
  font-size: 0.78rem; font-weight: 700; width: 36px; flex-shrink: 0;
  text-align: center; border-radius: 6px; padding: 3px 0; color: #fff;
}
.start-label { background: #4CAF50; }
.end-label { background: #F44336; }

.input-wrapper { flex: 1; position: relative; }

.address-input {
  width: 100%; padding: 7px 10px; border: 1.5px solid var(--border-color, #e0e0e0);
  border-radius: 8px; background: var(--bg-primary, #fff);
  color: var(--text-primary, #2c3e50); font-size: 0.82rem; outline: none;
  transition: border-color 0.2s; box-sizing: border-box;
}
.address-input:focus { border-color: #4CAF50; }

.icon-btn {
  width: 30px; height: 30px; border: 1.5px solid var(--border-color, #e0e0e0);
  border-radius: 8px; background: var(--bg-primary, #fff);
  color: var(--text-secondary, #555); cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: all 0.15s;
}
.icon-btn:hover { border-color: #4CAF50; color: #4CAF50; background: rgba(76,175,80,0.06); }
.icon-btn.active { border-color: #4CAF50; background: #4CAF50; color: #fff; }
.icon-btn-del:hover { border-color: #F44336; color: #F44336; background: rgba(244,67,54,0.06); }

.search-dropdown {
  position: absolute; top: 100%; left: 0; right: 0;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  max-height: 180px; overflow-y: auto; z-index: 1600; margin-top: 2px;
}

.search-item {
  padding: 8px 10px; cursor: pointer; display: flex; align-items: flex-start; gap: 8px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.search-item:hover { background: rgba(76,175,80,0.06); }
.search-item:last-child { border-bottom: none; }

.search-icon { color: #4CAF50; margin-top: 2px; flex-shrink: 0; }
.search-item-name { font-size: 0.82rem; color: var(--text-primary, #2c3e50); font-weight: 500; }
.search-item-addr { font-size: 0.72rem; color: var(--text-tertiary, #888); margin-top: 1px; }

.waypoints-section { padding: 4px 16px; flex-shrink: 0; }

.waypoints-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}

.add-waypoint-btn {
  background: none; border: 1.5px dashed var(--border-color, #e0e0e0);
  border-radius: 6px; padding: 4px 10px; cursor: pointer;
  font-size: 0.78rem; color: var(--text-secondary, #555);
  display: flex; align-items: center; gap: 4px; transition: all 0.15s;
}
.add-waypoint-btn:hover:not(:disabled) {
  border-color: #4CAF50; color: #4CAF50;
}
.add-waypoint-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.waypoint-row {
  display: flex; gap: 4px; align-items: center; margin-bottom: 6px;
}

.wp-index {
  width: 22px; height: 22px; border-radius: 50%; background: #2196F3;
  color: #fff; font-size: 0.7rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.wp-input { font-size: 0.8rem; padding: 5px 8px; }

.plan-btn {
  margin: 12px 16px; padding: 10px; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #4CAF50, #66BB6A);
  color: #fff; font-size: 0.95rem; font-weight: 600; cursor: pointer;
  transition: all 0.2s; box-shadow: 0 4px 12px rgba(76,175,80,0.3);
  display: flex; align-items: center; justify-content: center; gap: 6px;
  flex-shrink: 0;
}
.plan-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #388E3C, #4CAF50);
  transform: translateY(-1px); box-shadow: 0 6px 16px rgba(76,175,80,0.4);
}
.plan-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg {
  margin: 8px 16px 0; padding: 8px 12px;
  background: rgba(244,67,54,0.08); border: 1px solid rgba(244,67,54,0.15);
  border-radius: 8px; color: #D32F2F; font-size: 0.8rem; cursor: pointer;
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}

.result-section {
  border-top: 1px solid var(--border-color, #e0e0e0);
  padding: 12px 16px; flex-shrink: 0;
}

.result-stats { display: flex; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }

.result-stat {
  display: flex; align-items: center; gap: 4px;
  font-size: 0.82rem; color: var(--text-primary, #2c3e50); font-weight: 500;
}
.result-stat svg, .result-stat i { color: #4CAF50; }

.steps-list { max-height: 180px; overflow-y: auto; margin-bottom: 10px; }

.step-item {
  display: flex; gap: 8px; padding: 5px 0;
  border-bottom: 1px solid rgba(0,0,0,0.04); font-size: 0.78rem;
  color: var(--text-secondary, #555); line-height: 1.4;
}
.step-item:last-child { border-bottom: none; }

.step-index {
  color: #2196F3; font-weight: 700; flex-shrink: 0; min-width: 18px;
}

.step-distance { color: var(--text-tertiary, #888); margin-left: 6px; font-size: 0.72rem; }

.action-row { display: flex; gap: 8px; }

.action-btn {
  flex: 1; padding: 7px; border: 1.5px solid var(--border-color, #e0e0e0);
  border-radius: 8px; background: var(--bg-primary, #fff);
  color: var(--text-primary, #2c3e50); cursor: pointer;
  font-size: 0.82rem; display: flex; align-items: center; justify-content: center; gap: 4px;
  transition: all 0.15s;
}
.action-btn:hover { background: rgba(0,0,0,0.04); }
.action-btn-retry:hover { border-color: #2196F3; color: #2196F3; background: rgba(33,150,243,0.06); }
.login-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.login-modal {
  background: var(--card-bg, #fff); border-radius: 16px; padding: 32px 36px;
  text-align: center; max-width: 380px; width: 90%;
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
}
.login-modal-icon { margin-bottom: 12px; }
.login-modal-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary, #2c3e50); margin: 0 0 8px; }
.login-modal-text { font-size: 0.85rem; color: var(--text-secondary, #555); margin: 0 0 24px; }
.login-modal-actions { display: flex; gap: 12px; justify-content: center; }
.login-modal-btn {
  padding: 10px 28px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none;
}
.login-modal-btn.cancel { background: var(--bg-secondary, #f5f5f5); color: var(--text-secondary, #555); }
.login-modal-btn.cancel:hover { background: var(--bg-tertiary, #eee); }
.login-modal-btn.confirm { background: linear-gradient(135deg, #4CAF50, #66BB6A); color: #fff; box-shadow: 0 4px 12px rgba(76,175,80,0.3); }
.login-modal-btn.confirm:hover { background: linear-gradient(135deg, #388E3C, #4CAF50); }

/* 手机端：面板全宽，避免溢出屏幕 */
@media (max-width: 480px) {
  .path-planning-panel {
    width: calc(100vw - 16px);
    left: 8px !important;
    bottom: 8px;
    max-height: calc(100vh - 100px);
  }
}
</style>
