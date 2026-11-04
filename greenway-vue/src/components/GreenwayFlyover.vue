<template>
  <div class="flyover-overlay" v-if="visible">
    <div class="flyover-container">
      <!-- 3D 场景 -->
      <div ref="sceneContainer" class="scene-canvas"></div>

      <!-- 电影感暗角 + 上下渐变，提升画面质感（纯 CSS，不影响性能） -->
      <div class="scene-vignette"></div>

      <!-- 顶部浮动胶囊 -->
      <div class="flyover-topbar">
        <div class="topbar-left">
          <button class="close-btn" @click="emit('close')" title="退出漫游">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
          </button>
          <span class="brand-dot" :style="{ background: greenwayColor }"></span>
          <span class="brand-name">{{ greenwayName }}</span>
          <span class="brand-sub">3D 漫游</span>
          <span class="time-chip" v-if="timeOfDay">{{ timeOfDay }}</span>
        </div>

        <div class="topbar-right">
          <div class="ctrl-group">
            <button class="ctrl-btn" @click="prevWaypoint" :disabled="currentIdx <= 0" title="上一站">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 6l5 5-5 5V6z" fill="currentColor"/></svg>
            </button>
            <button class="ctrl-btn ctrl-play" @click="togglePlay" :title="playing ? '暂停' : '播放'">
              <svg v-if="playing" viewBox="0 0 24 24" width="18" height="18"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>
              <svg v-else viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
            </button>
            <button class="ctrl-btn" @click="nextWaypoint" :disabled="currentIdx >= waypoints.length - 1" title="下一站">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M17 6l-5 5 5 5V6z" fill="currentColor"/></svg>
            </button>
          </div>

          <div class="speed-group">
            <button v-for="s in [0.5, 1, 2]" :key="s" class="speed-item"
                    :class="{ active: speed === s }" @click="speed = s">{{ s }}x</button>
          </div>

          <div class="ctrl-group">
            <button class="ctrl-btn" :class="{ off: !showBuildings }" @click="toggleBuildings" title="三维建筑">
              <svg viewBox="0 0 24 24" width="15" height="15"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="ctrl-btn" :class="{ off: !showLabels }" @click="toggleLabels" title="名称标注">
              <svg viewBox="0 0 24 24" width="15" height="15"><path d="M20 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zM8 9l-3 3 3 3M16 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 左下角场景信息 -->
      <div class="scene-info">
        <div class="si-title">{{ greenwayName }}</div>
        <div class="si-row">
          <span class="si-item"><b>{{ currentIdx + 1 }}</b><i>/{{ waypoints.length }} 站</i></span>
          <span class="si-divider"></span>
          <span class="si-item"><i>航段</i><b>{{ flownKm }}</b><i>/{{ totalKm }} km</i></span>
          <span class="si-divider"></span>
          <span class="si-item">{{ headingText }}</span>
        </div>
      </div>

      <!-- 底部进度 -->
      <div class="progress-wrap">
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
        <div class="progress-meta">
          <span class="pm-pct">{{ progressPct.toFixed(0) }}%</span>
          <span class="pm-hint">空格 播放 / 暂停 · ← → 切换站点</span>
          <span class="pm-km">航段 {{ flownKm }} / {{ totalKm }} km</span>
        </div>
      </div>

      <!-- 信息提示 -->
      <div class="info-tip" v-if="infoTip">{{ infoTip }}</div>

      <!-- 加载中 -->
      <div class="loading-overlay" v-if="loading">
        <div class="loading-spinner"></div>
        <span class="loading-text">正在生成三维场景…</span>
        <span class="loading-sub">{{ greenwayName }}</span>
      </div>

      <!-- 加载失败提示（不静默落到默认中心） -->
      <div class="flyover-error" v-if="!loading && flyoverError">
        <div class="error-icon">⚠️</div>
        <div class="error-msg">{{ flyoverError }}</div>
        <button class="error-close" @click="emit('close')">关闭</button>
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
import Polygon from '@geoscene/core/geometry/Polygon.js'
import Polyline from '@geoscene/core/geometry/Polyline.js'
import SpatialReference from '@geoscene/core/geometry/SpatialReference.js'
import LineSymbol3D from '@geoscene/core/symbols/LineSymbol3D.js'
import PathSymbol3DLayer from '@geoscene/core/symbols/PathSymbol3DLayer.js'
import LineSymbol3DLayer from '@geoscene/core/symbols/LineSymbol3DLayer.js'
import LineStyleMarker3D from '@geoscene/core/symbols/LineStyleMarker3D.js'
import PointSymbol3D from '@geoscene/core/symbols/PointSymbol3D.js'
import IconSymbol3DLayer from '@geoscene/core/symbols/IconSymbol3DLayer.js'
import ObjectSymbol3DLayer from '@geoscene/core/symbols/ObjectSymbol3DLayer.js'
import ExtrudeSymbol3DLayer from '@geoscene/core/symbols/ExtrudeSymbol3DLayer.js'
import PolygonSymbol3D from '@geoscene/core/symbols/PolygonSymbol3D.js'
import LabelSymbol3D from '@geoscene/core/symbols/LabelSymbol3D.js'
import TextSymbol3DLayer from '@geoscene/core/symbols/TextSymbol3DLayer.js'

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
const flyoverError = ref('')
const waypoints = ref([])
const currentIdx = ref(0)
const speed = ref(1)
const infoTip = ref('')
const timeOfDay = ref('')
const showBuildings = ref(true)
const showLabels = ref(true)
const sceneData = ref(null)

let mapManager = null
let flyTimer = null
let resolvedGreenwayId = 0
let greenwayGeometry = null

const progressPct = computed(() => {
  if (waypoints.value.length <= 1) return 0
  return (currentIdx.value / (waypoints.value.length - 1)) * 100
})

// ---- 里程与朝向（供底部信息展示）----

/** 相邻航点累计里程（公里），预计算一次 */
const legDistances = computed(() => {
  const wps = waypoints.value
  const out = []
  for (let i = 0; i < wps.length - 1; i += 1) {
    out.push(haversineDist(wps[i].lat, wps[i].lng, wps[i + 1].lat, wps[i + 1].lng) / 1000)
  }
  return out
})

const totalKm = computed(() => {
  const sum = legDistances.value.reduce((a, b) => a + b, 0)
  return sum >= 100 ? Math.round(sum) : Math.round(sum * 10) / 10
})

const flownKm = computed(() => {
  const sum = legDistances.value.slice(0, currentIdx.value).reduce((a, b) => a + b, 0)
  return sum >= 100 ? Math.round(sum) : Math.round(sum * 10) / 10
})

/** 当前朝向（八方位） */
const headingText = computed(() => {
  const wp = waypoints.value[currentIdx.value]
  if (!wp) return ''
  const h = ((wp.heading || 0) % 360 + 360) % 360
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return `朝${dirs[Math.round(h / 45) % 8]}`
})

// ---- 工具函数 ----

/** 解析 hex 颜色为 [r, g, b, a] 数组 */
function hexToRgba(hex, alpha = 1) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match) return [76, 175, 80, alpha]
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16), alpha]
}

/** 朝向平滑：对 bearing 序列做圆周加权平均，消除转弯处的方向突变 */
function smoothWaypointHeadings(list) {
  if (!Array.isArray(list) || list.length < 2) return
  const raw = list.map(w => w.heading || 0)
  list.forEach((w, i) => {
    let sx = 0, sy = 0
    for (let k = -1; k <= 1; k += 1) {
      const j = Math.min(raw.length - 1, Math.max(0, i + k))
      const rad = (raw[j] * Math.PI) / 180
      const weight = k === 0 ? 2 : 1
      sx += Math.cos(rad) * weight
      sy += Math.sin(rad) * weight
    }
    w.heading = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360
  })
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
    const resp = await fetch(`/api/greenways${idParam}/flyover?maxPoints=45&scene=1`)
    const data = await resp.json()
    waypoints.value = data.waypoints || []
    // 对朝向做一次圆周滑动平均：转弯处不会出现方向突变
    smoothWaypointHeadings(waypoints.value)
    resolvedGreenwayId = data.greenwayId || props.greenwayId
    sceneData.value = {
      buildings: data.buildings || [],
      pois: data.pois || []
    }

    // 加载绿道几何
    if (resolvedGreenwayId) {
      try {
        const detailResp = await fetch(`/api/greenways/${resolvedGreenwayId}`)
        const detail = await detailResp.json()
        greenwayGeometry = detail.data?.geometry || null
      } catch { /* noop */ }
    }

    // 空航点：提示错误而不是静默跳到默认中心（北京市中心）
    if (waypoints.value.length === 0) {
      flyoverError.value = '未找到该绿道的飞行路径，请稍后重试'
      loading.value = false
      return false
    }
    flyoverError.value = ''
    return true
  } catch (e) {
    console.error('[Flyover] 加载失败:', e)
    flyoverError.value = '飞行路径加载失败，请稍后重试'
    loading.value = false
    return false
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
      lods: Array.from({ length: 19 }, (_, i) => ({
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

  // ---- 2.5 场景增强：真三维建筑 + 名称标注 ----
  if (sceneData.value) {
    createBuildingsLayer()
    createPoiLabelsLayer()
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

  // 入场：先置身高空俯视，再俯冲到首站，比直接出现更有仪式感
  if (waypoints.value.length > 0) {
    const first = waypoints.value[0]
    const cam = computeCameraParams(0)
    try {
      await mapManager.getView().goTo({
        position: [first.lng, first.lat, 2600],
        heading: cam.heading,
        tilt: 42
      }, { duration: 0 })
      await new Promise((r) => setTimeout(r, 260))
    } catch (e) { /* 入场动画失败不影响主流程 */ }
    goToWaypoint(0)
    // 首段飞行开始后采样帧率，必要时自动降级
    setTimeout(() => { autoTunePerformance() }, 8000)
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
        width: 46,          // 外层宽光晕
        height: 14,
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
        width: 26,
        height: 9,
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
        width: 10,
        height: 5,
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
    elevationInfo: { mode: 'relative-to-ground', offset: 10 }
  })

  const glLayer = new GraphicsLayer({
    elevationInfo: { mode: 'relative-to-ground', offset: 10 }
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
    elevationInfo: { mode: 'relative-to-ground', offset: 14 }
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
      verticalOffset: { screenLength: 22, maxWorldLength: 400, minWorldLength: 20 },
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
        }),
        new TextSymbol3DLayer({
          text: '起点',
          size: 13,
          font: { family: 'Microsoft YaHei', weight: 'bold' },
          material: { color: [255, 255, 255, 1] },
          halo: { color: [18, 52, 22, 0.92], size: 2.6 }
        })
      ]
    })
  }))

  // 终点：红色三角标记
  markerLayer.add(new Graphic({
    geometry: new Point({ longitude: endCoord[0], latitude: endCoord[1], spatialReference: { wkid: 4326 } }),
    symbol: new PointSymbol3D({
      verticalOffset: { screenLength: 22, maxWorldLength: 400, minWorldLength: 20 },
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
        }),
        new TextSymbol3DLayer({
          text: '终点',
          size: 13,
          font: { family: 'Microsoft YaHei', weight: 'bold' },
          material: { color: [255, 255, 255, 1] },
          halo: { color: [70, 20, 20, 0.92], size: 2.6 }
        })
      ]
    })
  }))

  mapManager.addLayer('path-end-markers', markerLayer)
}

/** 真三维建筑：ExtrudeSymbol3DLayer 挤出（高度=面积估算），带名称标注 */
function createBuildingsLayer() {
  const mapManager = getMapManager()
  const hour = new Date().getHours()
  const isNight = hour >= 19 || hour < 5
  const buildings = sceneData.value?.buildings || []
  if (!buildings.length) return

  // 建筑类型 → 颜色（白天暖色调，夜晚自动调暗成城市夜景）
  const BCOLORS = {
    apartments: '#DFC9A3', house: '#EAD9BC', residential: '#E8D5B7',
    commercial: '#B8C6D8', retail: '#C3CFDD', office: '#A9BDD0',
    industrial: '#C8C3B7', warehouse: '#C8C3B7', garage: '#CFCABF', garages: '#CFCABF',
    school: '#C5D8B4', university: '#C5D8B4', hospital: '#D8C4C6',
    church: '#D2C2D8', train_station: '#9FB8C9', stadium: '#BCD4C4',
    default: '#D6CFC3'
  }
  const shade = (hex, f) => {
    const m = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (!m) return [214, 207, 195, 1]
    return [
      Math.round(parseInt(m[1], 16) * f), Math.round(parseInt(m[2], 16) * f),
      Math.round(parseInt(m[3], 16) * f), 1
    ]
  }

  const layer = new GraphicsLayer({ elevationInfo: { mode: 'relative-to-ground' } })

  buildings.forEach(b => {
    const color = shade(BCOLORS[b.type] || BCOLORS.default, isNight ? 0.42 : 1)
    const ringSets = b.rings || []
    if (!ringSets.length) return
    layer.add(new Graphic({
      geometry: new Polygon({ rings: ringSets, spatialReference: { wkid: 4326 } }),
      attributes: { name: b.name || '' },
      symbol: new PolygonSymbol3D({
        symbolLayers: [
          new ExtrudeSymbol3DLayer({
            size: b.height || 12,
            material: { color },
            castShadows: true,
            edges: { type: 'solid', color: [0, 0, 0, isNight ? 0.5 : 0.25], size: 0.6 }
          })
        ]
      })
    }))
  })

  // 建筑名称用显式标注层（scene-building-names）渲染，此处不再用 labelingInfo
  mapManager.addLayer('scene-buildings', layer)
  createBuildingNamesLayer(layer)
}

/** 建筑名称显式标注：TextSymbol3D 浮于建筑上方（渲染确定，自动面向相机） */
function createBuildingNamesLayer(buildingLayer) {
  const mapManager = getMapManager()
  const buildings = sceneData.value?.buildings || []
  const named = buildings.filter(b => b.name && b.rings && b.rings.length)
  if (!named.length) return

  // 只标注重要建筑（按高度/面积降序前 120 个），避免密集城区文字糊屏
  const top = [...named].sort((a, b) => (b.height || 0) - (a.height || 0)).slice(0, 120)

  const layer = new GraphicsLayer({
    elevationInfo: { mode: 'relative-to-ground' },
    // 标注随建筑层一起显隐（保留在 toggleLabels 中统一控制）
  })

  top.forEach(b => {
    // 质心（外环平均）
    const ring = b.rings[0]
    if (!ring || ring.length < 2) return
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length
    layer.add(new Graphic({
      geometry: new Point({ longitude: cx, latitude: cy, spatialReference: { wkid: 4326 } }),
      symbol: new PointSymbol3D({
        verticalOffset: {
          screenLength: 40,            // 距建筑顶 40px（随屏幕距离缩放）
          maxWorldLength: 350,         // 最近时不超过 350m
          minWorldLength: 15           // 最远时不少于 15m
        },
        symbolLayers: [new TextSymbol3DLayer({
          text: b.name,
          size: 13,
          font: { family: 'Microsoft YaHei', weight: 'bold' },
          material: { color: [255, 255, 255, 1] },
          halo: { color: [15, 35, 15, 0.88], size: 2.5 }
        })]
      })
    }))
  })

  mapManager.addLayer('scene-building-names', layer)
}

/** POI 名称标注：分类彩色圆点 + 名称（地铁/公交/景点/公园/餐饮等） */
function createPoiLabelsLayer() {
  const mapManager = getMapManager()
  const hour = new Date().getHours()
  const isNight = hour >= 19 || hour < 5
  const pois = sceneData.value?.pois || []
  if (!pois.length) return

  const PCOLORS = {
    '150500': '#1E88E5',  // 地铁
    '150700': '#43A047',  // 公交
    '060100': '#F57C00',  // 景点
    '110200': '#7CB342',  // 公园
    '110100': '#E53935',  // 餐饮
    default: '#757575'
  }

  const layer = new GraphicsLayer({ elevationInfo: { mode: 'relative-to-ground', offset: 12 } })
  const seen = new Set()

  pois.forEach(p => {
    if (seen.has(p.name)) return
    seen.add(p.name)
    const color = PCOLORS[p.type] || PCOLORS.default
    layer.add(new Graphic({
      geometry: new Point({ longitude: p.lng, latitude: p.lat, spatialReference: { wkid: 4326 } }),
      attributes: { name: p.name },
      symbol: new PointSymbol3D({
        symbolLayers: [
          new IconSymbol3DLayer({
            resource: { primitive: 'circle' },
            size: 7,
            color: isNight ? [80, 110, 160, 0.95] : color,
            outline: { color: [255, 255, 255, 0.9], size: 1.2 }
          })
        ]
      })
    }))
  })

  layer.labelingInfo = [{
    labelExpressionInfo: { expression: '$feature.name' },
    labelPlacement: 'above-center',
    symbol: new LabelSymbol3D({
      symbolLayers: [new TextSymbol3DLayer({
        text: '',
        size: 13,
        font: { family: 'Microsoft YaHei', weight: 'bold' },
        material: { color: [255, 255, 255, 1] },
        halo: { color: [25, 50, 25, 0.85], size: 2.5 }
      })],
      verticalOffset: { screenLength: 18, maxWorldLength: 200, minWorldLength: 10 }
    })
  }]

  mapManager.addLayer('scene-poi-labels', layer)
}

/** 切换三维建筑层可见性 */
function toggleBuildings() {
  showBuildings.value = !showBuildings.value
  const layer = mapManager?.getLayer?.('scene-buildings')
  if (layer) layer.visible = showBuildings.value
}

/** 切换名称标注层可见性（建筑名 + POI 名） */
function toggleLabels() {
  showLabels.value = !showLabels.value
  const b = mapManager?.getLayer?.('scene-building-names')
  const p = mapManager?.getLayer?.('scene-poi-labels')
  if (b) b.visible = showLabels.value
  if (p) p.visible = showLabels.value
}

/** 路径光珠 */
function createWaypointBeads() {
  const mapManager = getMapManager()
  const [r, g, b] = hexToRgba(props.greenwayColor)
  const beadLayer = new GraphicsLayer({
    elevationInfo: { mode: 'relative-to-ground', offset: 16 }
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
    const flownLayer = new GraphicsLayer({ elevationInfo: { mode: 'relative-to-ground', offset: 12 } })
    flownLayer.add(new Graphic({
      geometry: new Polyline({ paths: [flownCoords], spatialReference: { wkid: 4326 } }),
      symbol: new LineSymbol3D({
        symbolLayers: [
          new PathSymbol3DLayer({
            profile: 'circle', width: 8, height: 4,
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
    const remLayer = new GraphicsLayer({ elevationInfo: { mode: 'relative-to-ground', offset: 10 } })
    remLayer.add(new Graphic({
      geometry: new Polyline({ paths: [remainingCoords], spatialReference: { wkid: 4326 } }),
      symbol: new LineSymbol3D({
        symbolLayers: [
          new PathSymbol3DLayer({
            profile: 'circle', width: 6, height: 3,
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

/** 结束收尾：拉高并回望来路，形成完整收束感 */
function pullUpToOverview() {
  if (!mapManager || waypoints.value.length === 0) return
  const last = waypoints.value[waypoints.value.length - 1]
  const cam = computeCameraParams(waypoints.value.length - 1)
  mapManager.flyTo(
    [last.lng, last.lat],
    (cam.heading + 150) % 360,
    38,
    3200,
    2800 / speed.value
  )
}

/**
 * 低性能设备自动降级：
 * 飞行开始后采样帧率，低于 30fps 时关阴影、隐藏建筑名标注，
 * 避免核显机器出现明显卡顿（观感优先于特效）。
 */
async function autoTunePerformance() {
  const view = mapManager?.getView?.()
  if (!view) return
  const fps = await new Promise((resolve) => {
    let frames = 0
    const t0 = performance.now()
    const tick = () => {
      frames += 1
      if (performance.now() - t0 < 2000) requestAnimationFrame(tick)
      else resolve(Math.round(frames / ((performance.now() - t0) / 1000)))
    }
    requestAnimationFrame(tick)
  })
  console.info(`[3D漫游] 实测帧率 ${fps}fps`)
  if (fps >= 25) return
  console.warn(`[3D漫游] 帧率偏低(${fps}fps)，自动降级渲染`)
  try {
    if (view.environment?.lighting) view.environment.lighting.directShadowsEnabled = false
  } catch (e) { /* 忽略 */ }
  const namesLayer = mapManager?.getLayer?.('scene-building-names')
  if (namesLayer) namesLayer.visible = false
  showLabels.value = false
  infoTip.value = '已自动切换为性能模式'
  clearTimeout(window._tipTimer)
  window._tipTimer = setTimeout(() => { infoTip.value = '' }, 2600)
}

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
  let tilt = 62
  let altitude = 900

  // 根据下一站距离调整高度：相机高度需与可用影像层级（最高 18 级）匹配，
  // 原先 100–500m 需要 19–20 级影像，实际取不到，画面必然发糊
  if (idx < waypoints.value.length - 1) {
    const next = waypoints.value[idx + 1]
    const dist = haversineDist(wp.lat, wp.lng, next.lat, next.lng)
    altitude = Math.min(1400, Math.max(800, dist * 1.6))
    heading = bearing(wp.lat, wp.lng, next.lat, next.lng)

    // 转弯时增大 tilt（更俯视）来增强 banking 感
    if (idx > 0) {
      const prev = waypoints.value[idx - 1]
      const prevHeading = bearing(prev.lat, prev.lng, wp.lat, wp.lng)
      const turnAngle = angleDiff(prevHeading, heading)
      if (turnAngle > 20) {
        tilt = 55  // 更俯视
        altitude = Math.max(altitude * 1.15, 1000)  // 转弯飞高一点
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
    pullUpToOverview()
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

// ---- 键盘快捷键：空格播放/暂停，左右切站，Esc 退出 ----
function onKeydown(e) {
  if (!props.visible) return
  if (e.code === 'Space') {
    e.preventDefault()
    togglePlay()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    nextWaypoint()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prevWaypoint()
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

watch(() => props.visible, async (v) => {
  if (v) {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeydown)
    const ok = await loadFlyover()
    // 设置天空时间
    getTimeBasedSky()
    if (ok) await initScene()
  } else {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onKeydown)
    playing.value = false
    clearTimeout(flyTimer)
    clearTimeout(window._tipTimer)
    if (mapManager) mapManager.destroy()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
  playing.value = false
  clearTimeout(flyTimer)
  clearTimeout(window._tipTimer)
  if (mapManager) mapManager.destroy()
})
</script>

<style scoped>
.flyover-overlay {
  position: fixed; inset: 0;
  z-index: 9999; background: #000;
}
.flyover-container {
  width: 100%; height: 100%; position: relative; overflow: hidden;
}
.scene-canvas {
  width: 100%; height: 100%;
}

/* ── 电影感暗角 ── */
.scene-vignette {
  position: absolute; inset: 0; z-index: 5; pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,.34) 100%),
    linear-gradient(180deg, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 76%, rgba(0,0,0,.55) 100%);
}

/* ── 顶部浮动胶囊 ── */
.flyover-topbar {
  position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
  z-index: 10;
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  padding: 8px 12px 8px 10px;
  max-width: min(1080px, calc(100% - 40px));
  background: rgba(14, 22, 18, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
}
.topbar-left, .topbar-right { display: flex; align-items: center; gap: 10px; }

.close-btn {
  width: 30px; height: 30px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; cursor: pointer;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.82);
  transition: all .18s ease;
}
.close-btn:hover { background: rgba(255, 90, 90, 0.22); border-color: rgba(255, 120, 120, 0.4); color: #fff; }

.brand-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 10px currentColor;
}
.brand-name {
  color: #fff; font-size: 0.94rem; font-weight: 700; letter-spacing: .01em;
  white-space: nowrap;
}
.brand-sub {
  color: rgba(255, 255, 255, 0.42); font-size: 0.76rem; font-weight: 500;
  padding-left: 2px; white-space: nowrap;
}
.time-chip {
  color: #FFD54F; font-size: 0.74rem;
  background: rgba(255, 213, 79, 0.12);
  border: 1px solid rgba(255, 213, 79, 0.22);
  padding: 3px 9px; border-radius: 999px; white-space: nowrap;
}

/* 控制按钮组 */
.ctrl-group {
  display: flex; align-items: center; gap: 4px;
  padding: 3px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.ctrl-btn {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%; cursor: pointer;
  background: transparent; color: rgba(255, 255, 255, 0.78);
  transition: all .18s ease;
}
.ctrl-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.14); color: #fff; }
.ctrl-btn:disabled { opacity: .26; cursor: default; }
.ctrl-btn.off { opacity: .3; }
.ctrl-play {
  background: #2E7D32; color: #fff;
  box-shadow: 0 2px 12px rgba(46, 125, 50, 0.5);
}
.ctrl-play:hover:not(:disabled) { background: #388E3C; }

/* 速度分段控件 */
.speed-group {
  display: flex; align-items: center; gap: 2px;
  padding: 3px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.speed-item {
  min-width: 40px; height: 26px;
  border: none; border-radius: 999px; cursor: pointer;
  background: transparent; color: rgba(255, 255, 255, 0.6);
  font-size: 0.76rem; font-weight: 600; font-variant-numeric: tabular-nums;
  transition: all .18s ease;
}
.speed-item:hover { color: #fff; }
.speed-item.active {
  background: rgba(255, 255, 255, 0.92); color: #14301a;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.28);
}

/* ── 左下角场景信息卡 ── */
.scene-info {
  position: absolute; left: 22px; bottom: 96px; z-index: 10;
  padding: 11px 15px;
  border-radius: 14px;
  background: rgba(14, 22, 18, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  pointer-events: none;
}
.si-title {
  color: #fff; font-size: 0.88rem; font-weight: 700; margin-bottom: 6px;
  letter-spacing: .01em;
}
.si-row { display: flex; align-items: center; gap: 10px; }
.si-item {
  display: inline-flex; align-items: baseline; gap: 2px;
  color: rgba(255, 255, 255, 0.55); font-size: 0.74rem; white-space: nowrap;
}
.si-item b {
  color: #9FE8A0; font-size: 0.92rem; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.si-item i { font-style: normal; }
.si-divider { width: 1px; height: 12px; background: rgba(255, 255, 255, 0.14); }

/* ── 底部进度 ── */
.progress-wrap {
  position: absolute; left: 22px; right: 22px; bottom: 26px; z-index: 10;
}
.progress-track {
  position: relative; height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.35);
}
.progress-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #2E7D32, #69F0AE);
  transition: width .6s cubic-bezier(.4, 0, .2, 1);
  box-shadow: 0 0 12px rgba(105, 240, 174, 0.55);
}
.progress-dot {
  position: absolute; top: 50%; width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  transform: translate(-50%, -50%);
  transition: all .4s ease;
}
.progress-dot.done { background: rgba(105, 240, 174, 0.5); border-color: rgba(105, 240, 174, 0.3); }
.progress-dot.active {
  width: 15px; height: 15px;
  background: #fff; border-color: #69F0AE;
  box-shadow: 0 0 0 4px rgba(105, 240, 174, 0.18), 0 0 16px rgba(105, 240, 174, 0.8);
}

.progress-meta {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 9px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}
.pm-pct { color: #9FE8A0; font-weight: 700; font-size: 0.8rem; }
.pm-hint { color: rgba(255, 255, 255, 0.3); }
.pm-km { color: rgba(255, 255, 255, 0.55); }

/* ── 提示气泡 ── */
.info-tip {
  position: absolute; top: 84px; left: 50%; transform: translateX(-50%);
  background: rgba(14, 22, 18, 0.8); color: #fff; padding: 8px 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px; font-size: 0.84rem; z-index: 10;
  backdrop-filter: blur(10px);
  animation: tipIn .28s ease;
  pointer-events: none;
}
@keyframes tipIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ── 加载 / 错误 ── */
.loading-overlay {
  position: absolute; inset: 0; z-index: 20;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  background: radial-gradient(ellipse at 50% 40%, #16241b 0%, #070c09 70%);
  color: #fff;
}
.loading-spinner {
  width: 44px; height: 44px;
  border: 3px solid rgba(105, 240, 174, 0.16);
  border-top-color: #69F0AE;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 0.92rem; color: rgba(255, 255, 255, 0.86); letter-spacing: .02em; }
.loading-sub { font-size: 0.78rem; color: rgba(255, 255, 255, 0.38); }

.flyover-error {
  position: absolute; inset: 0; z-index: 20;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, #24161a 0%, #0a0608 70%);
  color: #fff; gap: 14px; padding: 20px; text-align: center;
}
.flyover-error .error-icon { font-size: 40px; }
.flyover-error .error-msg { font-size: 15px; color: #eee; max-width: 320px; line-height: 1.6; }
.flyover-error .error-close {
  margin-top: 6px; padding: 8px 26px; border: none; border-radius: 999px;
  background: #43A047; color: #fff; font-size: 14px; cursor: pointer;
}
.flyover-error .error-close:hover { background: #2E7D32; }
</style>
