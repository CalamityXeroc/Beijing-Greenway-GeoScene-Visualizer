<template>
  <div class="flyover-overlay" v-if="visible">
    <div class="flyover-container">
      <!-- 3D 场景 -->
      <div ref="sceneContainer" class="scene-canvas"></div>

      <!-- 顶部栏 -->
      <div class="flyover-topbar">
        <div class="topbar-left">
          <button class="btn-icon" @click="emit('close')" title="退出">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
          </button>
          <span class="topbar-title">🎬 {{ greenwayName }} · 3D 漫游</span>
          <span class="time-indicator" v-if="timeOfDay">{{ timeOfDay }}</span>
        </div>
        <div class="topbar-right">
          <span class="waypoint-label">{{ currentIdx + 1 }} / {{ waypoints.length }}</span>
          <button class="btn-icon" @click="prevWaypoint" :disabled="currentIdx <= 0" title="上一个">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 6l5 5-5 5V6z" fill="currentColor"/></svg>
          </button>
          <button class="btn-icon btn-play" @click="togglePlay" title="播放/暂停">
            <svg v-if="playing" viewBox="0 0 24 24" width="20" height="20"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
          </button>
          <button class="btn-icon" @click="nextWaypoint" :disabled="currentIdx >= waypoints.length - 1" title="下一个">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M17 6l-5 5 5 5V6z" fill="currentColor"/></svg>
          </button>
          <select v-model="speed" class="speed-select">
            <option :value="0.5">0.5x</option>
            <option :value="1">1x</option>
            <option :value="2">2x</option>
          </select>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        <div
          v-for="(wp, i) in waypoints"
          :key="i"
          class="progress-dot"
          :class="{ active: i === currentIdx, done: i < currentIdx }"
          :style="{ left: (i / (waypoints.length - 1)) * 100 + '%' }"
        ></div>
      </div>

      <!-- 信息提示 -->
      <div class="info-tip" v-if="infoTip">{{ infoTip }}</div>

      <!-- 加载中 -->
      <div class="loading-overlay" v-if="loading">
        <div class="loading-spinner"></div>
        <span>加载飞行路径...</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { getMapManager } from '@/core/MapManager.js'
import GraphicsLayer from '@geoscene/core/layers/GraphicsLayer.js'
import Graphic from '@geoscene/core/Graphic.js'
import Point from '@geoscene/core/geometry/Point.js'
import Polyline from '@geoscene/core/geometry/Polyline.js'
import SpatialReference from '@geoscene/core/geometry/SpatialReference.js'
import LineSymbol3D from '@geoscene/core/symbols/LineSymbol3D.js'
import PathSymbol3DLayer from '@geoscene/core/symbols/PathSymbol3DLayer.js'
import LineSymbol3DLayer from '@geoscene/core/symbols/LineSymbol3DLayer.js'
import LineStyleMarker3D from '@geoscene/core/symbols/LineStyleMarker3D.js'
import PointSymbol3D from '@geoscene/core/symbols/PointSymbol3D.js'
import IconSymbol3DLayer from '@geoscene/core/symbols/IconSymbol3DLayer.js'
import ObjectSymbol3DLayer from '@geoscene/core/symbols/ObjectSymbol3DLayer.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  greenwayId: { type: Number, default: 0 },
  greenwayName: { type: String, default: '' },
  greenwayColor: { type: String, default: '#4CAF50' }
})

const emit = defineEmits(['close'])

const sceneContainer = ref(null)
const loading = ref(true)
const playing = ref(false)
const waypoints = ref([])
const currentIdx = ref(0)
const speed = ref(1)
const infoTip = ref('')
const timeOfDay = ref('')

let mapManager = null
let flyTimer = null
let resolvedGreenwayId = 0
let greenwayGeometry = null

const progressPct = computed(() => {
  if (waypoints.value.length <= 1) return 0
  return (currentIdx.value / (waypoints.value.length - 1)) * 100
})

// ---- 工具函数 ----

/** 解析 hex 颜色为 [r, g, b, a] 数组 */
function hexToRgba(hex, alpha = 1) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match) return [76, 175, 80, alpha]
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16), alpha]
}

/** 根据时间返回天空色 */
function getTimeBasedSky() {
  const h = new Date().getHours()
  if (h >= 5 && h < 7)  { timeOfDay.value = '🌅 清晨'; return [30, 25, 40, 1] }   // 深蓝紫
  if (h >= 7 && h < 9)  { timeOfDay.value = '☀️ 早晨'; return [60, 70, 100, 1] }  // 浅蓝
  if (h >= 9 && h < 17) { timeOfDay.value = '☀️ 白天'; return [70, 120, 180, 1] }  // 天蓝
  if (h >= 17 && h < 19){ timeOfDay.value = '🌇 黄昏'; return [100, 60, 40, 1] }   // 暖橙
  if (h >= 19 && h < 20){ timeOfDay.value = '🌆 傍晚'; return [40, 30, 60, 1] }    // 紫蓝
  { timeOfDay.value = '🌙 夜晚'; return [8, 8, 20, 1] }                             // 深夜蓝
}

// ---- 数据加载 ----

async function loadFlyover() {
  try {
    const idParam = props.greenwayId > 0 ? `/${props.greenwayId}` : `/name/${encodeURIComponent(props.greenwayName)}`
    const resp = await fetch(`/api/greenways${idParam}/flyover?maxPoints=45`)
    const data = await resp.json()
    waypoints.value = data.waypoints || []
    resolvedGreenwayId = data.greenwayId || props.greenwayId

    // 加载绿道几何
    if (resolvedGreenwayId) {
      try {
        const detailResp = await fetch(`/api/greenways/${resolvedGreenwayId}`)
        const detail = await detailResp.json()
        greenwayGeometry = detail.data?.geometry || null
      } catch { /* noop */ }
    }
  } catch (e) {
    console.error('[Flyover] 加载失败:', e)
  }
}

// ---- 3D 场景初始化 ----

async function initScene() {
  if (!sceneContainer.value || !props.visible) return
  loading.value = true

  mapManager = getMapManager()
  if (mapManager.getView()) {
    mapManager.destroy()
  }

  const center = waypoints.value.length > 0
    ? [waypoints.value[0].lng, waypoints.value[0].lat]
    : [116.4, 39.9]

  mapManager.init(sceneContainer.value, {
    mode: '3d',
    center,
    controls: false
  })

  const mapInstance = mapManager.getMap()
  if (!mapInstance) return

  // 卫星底图
  const { default: WebTileLayer } = await import('@geoscene/core/layers/WebTileLayer.js')
  const fullExtent = {
    xmin: -20037508.342787, ymin: -20037508.342787,
    xmax: 20037508.342787, ymax: 20037508.342787,
    spatialReference: { wkid: 102100 }
  }
  const basemap = new WebTileLayer({
    urlTemplate: window.location.origin + '/api/tiles/gaode/6/{level}/{col}/{row}',
    title: '高德卫星图', fullExtent, spatialReference: { wkid: 102100 },
    tileInfo: {
      size: [256, 256],
      origin: { x: -20037508.342787, y: 20037508.342787 },
      spatialReference: { wkid: 102100 },
      lods: Array.from({ length: 18 }, (_, i) => ({
        level: i, resolution: 156543.033928 / Math.pow(2, i),
        scale: 591657527.591555 / Math.pow(2, i)
      }))
    }
  })
  basemap._zIndex = 0
  mapInstance.add(basemap)

  // ---- 1. 发光管状路径 ----
  if (greenwayGeometry) {
    createGlowPath(greenwayGeometry)
  }

  // ---- 2. 路径光珠 ----
  if (waypoints.value.length > 0) {
    createWaypointBeads()
  }

  // ---- 3. 飞行轨迹 (初始全未飞状态) ----
  if (greenwayGeometry && waypoints.value.length > 0) {
    updateTrail(currentIdx.value)
  }

  // 等待视图就绪
  const view = mapManager.getView()
  if (view) {
    await new Promise(resolve => {
      const watcher = view.watch('updating', (val) => {
        if (!val) { watcher.remove(); resolve() }
      })
      setTimeout(() => { watcher.remove(); resolve() }, 3000)
    })
  }

  loading.value = false

  // 飞到第一个点
  if (waypoints.value.length > 0) {
    goToWaypoint(0)
  }
}

// ============ 视觉层构建 ============

/** 发光管状路径：双层 PathSymbol3DLayer */
function createGlowPath(geometry) {
  if (!geometry || !geometry.coordinates) return

  const mapManager = getMapManager()
  const [r, g, b] = hexToRgba(props.greenwayColor)

  // 构建 Polyline
  const paths = geometry.type === 'MultiLineString'
    ? geometry.coordinates
    : [geometry.coordinates]

  const polyline = new Polyline({
    paths,
    spatialReference: { wkid: 4326 }
  })

  // 构建双层 PathSymbol3DLayer 管道
  const pathSymbol = new LineSymbol3D({
    symbolLayers: [
      // 外层：宽光晕（半透明）
      new PathSymbol3DLayer({
        profile: 'circle',
        width: 30,          // 30m 宽光晕
        height: 8,
        anchor: 'bottom',
        cap: 'round',
        join: 'round',
        profileRotation: 'heading',
        castShadows: false,
        material: { color: [r, g, b, 0.12] }
      }),
      // 中层：中等宽度辉光
      new PathSymbol3DLayer({
        profile: 'circle',
        width: 15,
        height: 5,
        anchor: 'bottom',
        cap: 'round',
        join: 'round',
        profileRotation: 'heading',
        castShadows: false,
        material: { color: [r, g, b, 0.25] }
      }),
      // 内层：明亮核心
      new PathSymbol3DLayer({
        profile: 'circle',
        width: 5,
        height: 3,
        anchor: 'bottom',
        cap: 'round',
        join: 'round',
        profileRotation: 'heading',
        castShadows: true,
        material: { color: [Math.min(r * 1.2, 255), Math.min(g * 1.2, 255), Math.min(b * 1.2, 255), 1] }
      })
    ]
  })

  const pathGraphic = new Graphic({
    geometry: polyline,
    symbol: pathSymbol,
    elevationInfo: { mode: 'relative-to-ground', offset: 3 }
  })

  const glLayer = new GraphicsLayer({
    elevationInfo: { mode: 'relative-to-ground', offset: 3 }
  })
  mapManager.addLayer('glow-path', glLayer)
  glLayer.add(pathGraphic)

  // 起终点标记
  addPathEndMarkers(polyline)
}

/** 路径起终点 3D 标记 */
function addPathEndMarkers(polyline) {
  const mapManager = getMapManager()
  const [r, g, b] = hexToRgba(props.greenwayColor)
  const markerLayer = new GraphicsLayer({
    elevationInfo: { mode: 'relative-to-ground', offset: 5 }
  })

  // 提取首尾坐标
  const pathsArr = polyline.paths
  if (!pathsArr || !pathsArr[0] || pathsArr[0].length < 2) return

  const firstRing = pathsArr[0]
  const startCoord = firstRing[0]
  const endCoord = firstRing[firstRing.length - 1]

  const brightColor = [Math.min(r * 1.3, 255), Math.min(g * 1.3, 255), Math.min(b * 1.3, 255)]

  // 起点：绿色发光球
  markerLayer.add(new Graphic({
    geometry: new Point({ longitude: startCoord[0], latitude: startCoord[1], spatialReference: { wkid: 4326 } }),
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { primitive: 'circle' },
          size: 18, color: [255, 255, 255, 1],
          outline: { color: brightColor, size: 3 }
        }),
        new ObjectSymbol3DLayer({
          resource: { primitive: 'sphere' },
          width: 12, depth: 12, height: 12,
          anchor: 'relative',
          material: { color: [r, g, b, 0.6] }
        })
      ]
    })
  }))

  // 终点：红色三角标记
  markerLayer.add(new Graphic({
    geometry: new Point({ longitude: endCoord[0], latitude: endCoord[1], spatialReference: { wkid: 4326 } }),
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { primitive: 'circle' },
          size: 20, color: [255, 90, 90, 1],
          outline: { color: [255, 255, 255, 1], size: 2 }
        }),
        new ObjectSymbol3DLayer({
          resource: { primitive: 'diamond' },
          width: 10, depth: 10, height: 16,
          anchor: 'relative',
          material: { color: [255, 70, 70, 0.7] }
        })
      ]
    })
  }))

  mapManager.addLayer('path-end-markers', markerLayer)
}

/** 路径光珠 */
function createWaypointBeads() {
  const mapManager = getMapManager()
  const [r, g, b] = hexToRgba(props.greenwayColor)
  const beadLayer = new GraphicsLayer({
    elevationInfo: { mode: 'relative-to-ground', offset: 8 }
  })

  waypoints.value.forEach((wp, i) => {
    beadLayer.add(new Graphic({
      geometry: new Point({ longitude: wp.lng, latitude: wp.lat, spatialReference: { wkid: 4326 } }),
      symbol: new PointSymbol3D({
        symbolLayers: [
          new IconSymbol3DLayer({
            resource: { primitive: 'circle' },
            size: i === 0 ? 8 : 5,
            color: i === 0 ? [255, 255, 255, 0.9] : [r, g, b, 0.4],
            outline: { color: [r, g, b, 0.3], size: 1 }
          })
        ]
      }),
      attributes: { waypointIndex: i }
    }))
  })

  mapManager.addLayer('waypoint-beads', beadLayer)
}

/** 更新飞行轨迹（切割绿道，分别渲染已飞/未飞） */
function updateTrail(idx) {
  const mapManager = getMapManager()
  const [r, g, b] = hexToRgba(props.greenwayColor)
  if (!greenwayGeometry || !waypoints.value[idx]) return

  // 移除旧轨迹层
  mapManager.removeLayer('trail-flown')
  mapManager.removeLayer('trail-remaining')

  const wp = waypoints.value[idx]
  const splitPoint = [wp.lng, wp.lat]

  // 切割 polyline：提取 geometry 中的 paths
  const paths = greenwayGeometry.type === 'MultiLineString'
    ? [...greenwayGeometry.coordinates]
    : [[...greenwayGeometry.coordinates]]

  // 遍历所有 paths，在 closest segment 处切分
  let minDist = Infinity, bestPathIdx = 0, bestSegIdx = 0
  paths.forEach((ring, pi) => {
    for (let i = 0; i < ring.length - 1; i++) {
      // 点到线段距离
      const d = pointToSegDist(splitPoint, ring[i], ring[i + 1])
      if (d < minDist) { minDist = d; bestPathIdx = pi; bestSegIdx = i }
    }
  })

  // 切割
  const fullRing = paths[bestPathIdx]
  const flownCoords = fullRing.slice(0, bestSegIdx + 1)
  flownCoords.push(splitPoint)

  const remainingCoords = [splitPoint, ...fullRing.slice(bestSegIdx + 1)]

  // 已飞轨迹：亮色实线
  if (flownCoords.length >= 2) {
    const flownLayer = new GraphicsLayer({ elevationInfo: { mode: 'relative-to-ground', offset: 4 } })
    flownLayer.add(new Graphic({
      geometry: new Polyline({ paths: [flownCoords], spatialReference: { wkid: 4326 } }),
      symbol: new LineSymbol3D({
        symbolLayers: [
          new PathSymbol3DLayer({
            profile: 'circle', width: 4, height: 2.5,
            anchor: 'bottom', cap: 'round', join: 'round',
            profileRotation: 'heading',
            material: { color: [Math.min(r * 1.5, 255), Math.min(g * 1.5, 255), Math.min(b * 1.5, 255), 1] }
          })
        ]
      })
    }))
    mapManager.addLayer('trail-flown', flownLayer)
  }

  // 未飞轨迹：暗色残影
  if (remainingCoords.length >= 2) {
    const remLayer = new GraphicsLayer({ elevationInfo: { mode: 'relative-to-ground', offset: 3 } })
    remLayer.add(new Graphic({
      geometry: new Polyline({ paths: [remainingCoords], spatialReference: { wkid: 4326 } }),
      symbol: new LineSymbol3D({
        symbolLayers: [
          new PathSymbol3DLayer({
            profile: 'circle', width: 3, height: 2,
            anchor: 'bottom', cap: 'round', join: 'round',
            profileRotation: 'heading',
            material: { color: [r, g, b, 0.15] }
          })
        ]
      })
    }))
    mapManager.addLayer('trail-remaining', remLayer)
  }
}

/** 点到线段距离 */
function pointToSegDist(pt, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(pt[0] - a[0], pt[1] - a[1])
  let t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy))
}

/** 更新光珠状态 */
function updateWaypointBeads(idx) {
  const mapManager = getMapManager()
  const [r, g, b] = hexToRgba(props.greenwayColor)
  const beads = mapManager.getLayer('waypoint-beads')
  if (!beads) return

  beads.graphics.forEach((graphic) => {
    const i = graphic.attributes?.waypointIndex
    if (i === undefined) return
    const iconLayer = graphic.symbol?.symbolLayers?.getItemAt?.(0)
    if (!iconLayer) return

    if (i < idx) {
      // 已飞过：暗灰
      iconLayer.size = 3
      iconLayer.color = [60, 60, 60, 0.4]
      iconLayer.outline = { color: [60, 60, 60, 0.2], size: 0.5 }
    } else if (i === idx) {
      // 当前位置：白亮大号
      iconLayer.size = 10
      iconLayer.color = [255, 255, 255, 1]
      iconLayer.outline = { color: [r, g, b, 0.8], size: 2 }
    } else {
      // 未来：半透明
      iconLayer.size = 4
      iconLayer.color = [r, g, b, 0.25]
      iconLayer.outline = { color: [r, g, b, 0.15], size: 0.8 }
    }
  })
}

// ============ 相机控制 ============

function goToWaypoint(idx) {
  if (!mapManager || idx >= waypoints.value.length) return
  currentIdx.value = idx
  const wp = waypoints.value[idx]

  // 计算相机参数
  const cam = computeCameraParams(idx)

  mapManager.flyTo([wp.lng, wp.lat], cam.heading, cam.tilt, cam.altitude, 2000 / speed.value)

  // 更新轨迹 + 光珠
  updateTrail(idx)
  updateWaypointBeads(idx)
}

/** 根据转弯角度和站距计算最佳相机参数 */
function computeCameraParams(idx) {
  const wp = waypoints.value[idx]
  let heading = wp.heading || 0
  let tilt = 65
  let altitude = 200

  // 根据下一站距离调整高度（开阔感）
  if (idx < waypoints.value.length - 1) {
    const next = waypoints.value[idx + 1]
    const dist = haversineDist(wp.lat, wp.lng, next.lat, next.lng)
    // 距离越远飞越高（150m ~ 500m）
    altitude = Math.min(500, Math.max(100, dist * 0.6))
    heading = bearing(wp.lat, wp.lng, next.lat, next.lng)

    // 转弯时增大 tilt（更俯视）来增强 banking 感
    if (idx > 0) {
      const prev = waypoints.value[idx - 1]
      const prevHeading = bearing(prev.lat, prev.lng, wp.lat, wp.lng)
      const turnAngle = angleDiff(prevHeading, heading)
      if (turnAngle > 20) {
        tilt = 55  // 更俯视
        altitude = Math.max(altitude * 1.2, 250)  // 转弯飞高一点
      }
    }
  }

  return { heading, tilt, altitude }
}

function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
    - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function angleDiff(a, b) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

// ---- 播放控制 ----

function togglePlay() {
  playing.value = !playing.value
  if (playing.value) autoPlay()
  else clearTimeout(flyTimer)
}

function autoPlay() {
  if (!playing.value) return
  if (currentIdx.value >= waypoints.value.length - 1) {
    playing.value = false
    infoTip.value = '✅ 漫游结束'
    return
  }
  const delay = 2500 / speed.value
  flyTimer = setTimeout(() => {
    if (playing.value) { nextWaypoint(); autoPlay() }
  }, delay)
}

function nextWaypoint() {
  if (currentIdx.value < waypoints.value.length - 1) {
    goToWaypoint(currentIdx.value + 1)
  }
}

function prevWaypoint() {
  if (currentIdx.value > 0) goToWaypoint(currentIdx.value - 1)
}

// ---- 生命周期 ----

watch(() => props.visible, async (v) => {
  if (v) {
    document.body.style.overflow = 'hidden'
    await loadFlyover()
    // 设置天空时间
    getTimeBasedSky()
    await initScene()
  } else {
    document.body.style.overflow = ''
    playing.value = false
    clearTimeout(flyTimer)
    clearTimeout(window._tipTimer)
    if (mapManager) mapManager.destroy()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  playing.value = false
  clearTimeout(flyTimer)
  clearTimeout(window._tipTimer)
  if (mapManager) mapManager.destroy()
})
</script>

<style scoped>
.flyover-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999; background: #000;
}
.flyover-container {
  width: 100%; height: 100%; position: relative;
}
.scene-canvas {
  width: 100%; height: 100%;
}
.flyover-topbar {
  position: absolute; top: 0; left: 0; right: 0; height: 56px;
  background: linear-gradient(180deg, rgba(0,0,0,.85) 0%, transparent 100%);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; z-index: 10;
}
.topbar-left, .topbar-right {
  display: flex; align-items: center; gap: 10px;
}
.topbar-title {
  color: #fff; font-size: 1.1em; font-weight: 600;
}
.time-indicator {
  color: #ffd54f; font-size: 0.8em; background: rgba(255,255,255,.08);
  padding: 2px 8px; border-radius: 10px;
}
.waypoint-label {
  color: #aaa; font-size: .85em; font-variant-numeric: tabular-nums;
}
.btn-icon {
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15);
  border-radius: 8px; color: #fff; padding: 6px 8px; cursor: pointer;
  display: flex; align-items: center; transition: all .2s;
}
.btn-icon:hover { background: rgba(255,255,255,.18); transform: scale(1.05); }
.btn-icon:disabled { opacity: .25; cursor: default; transform: none; }
.btn-play { padding: 8px 12px; background: rgba(76,175,80,.15); border-color: rgba(76,175,80,.25); }
.btn-play:hover { background: rgba(76,175,80,.25); }
.speed-select {
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15);
  border-radius: 8px; color: #fff; padding: 4px 6px; font-size: .85em; cursor: pointer;
}
.speed-select option { background: #1a1a2e; color: #fff; }

.progress-track {
  position: absolute; bottom: 60px; left: 20px; right: 20px;
  height: 4px; background: rgba(255,255,255,.08); border-radius: 2px; z-index: 10;
}
.progress-fill {
  height: 100%; background: linear-gradient(90deg, #4CAF50, #69F0AE);
  border-radius: 2px; transition: width .6s ease;
  box-shadow: 0 0 10px rgba(76,175,80,.4);
}
.progress-dot {
  position: absolute; top: -5px; width: 14px; height: 14px; border-radius: 50%;
  background: rgba(255,255,255,.15); border: 2px solid rgba(255,255,255,.06);
  transform: translateX(-50%); transition: all .4s ease;
}
.progress-dot.active {
  background: #fff; border-color: #4CAF50;
  box-shadow: 0 0 14px rgba(76,175,80,.7), 0 0 28px rgba(76,175,80,.3);
}
.progress-dot.done { background: rgba(76,175,80,.4); border-color: rgba(76,175,80,.2); }

.info-tip {
  position: absolute; top: 80px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,.8); color: #fff; padding: 8px 20px;
  border-radius: 20px; font-size: .9em; z-index: 10;
  animation: poiIn .3s ease;
  pointer-events: none;
}

.loading-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,0,0,.92); z-index: 20; color: #fff; gap: 16px;
}
.loading-spinner {
  width: 40px; height: 40px; border: 3px solid rgba(255,255,255,.12);
  border-top-color: #4CAF50; border-radius: 50%; animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
