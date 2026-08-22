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
          <span class="sep"></span>
          <button class="btn-icon layer-toggle" :class="{ off: !showBuildings }"
                  @click="toggleBuildings" title="三维建筑">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="btn-icon layer-toggle" :class="{ off: !showLabels }"
                  @click="toggleLabels" title="名称标注">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M20 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zM8 9l-3 3 3 3M16 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
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
    const resp = await fetch(`/api/greenways${idParam}/flyover?maxPoints=45&scene=1`)
    const data = await resp.json()
    waypoints.value = data.waypoints || []
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
            castShadows: false,
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

  const layer = new GraphicsLayer({ elevationInfo: { mode: 'relative-to-ground', offset: 4 } })
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
    const ok = await loadFlyover()
    // 设置天空时间
    getTimeBasedSky()
    if (ok) await initScene()
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
.sep { width: 1px; height: 20px; background: rgba(255,255,255,.15); margin: 0 2px; }
.layer-toggle { color: #9FE8A0; border-color: rgba(76,175,80,.3); }
.layer-toggle.off { opacity: .35; color: #999; border-color: rgba(255,255,255,.12); }
.layer-toggle.off:hover { opacity: .6; }
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
.flyover-error {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,0,0,.92); z-index: 20; color: #fff; gap: 14px; padding: 20px; text-align: center;
}
.flyover-error .error-icon { font-size: 40px; }
.flyover-error .error-msg { font-size: 15px; color: #eee; max-width: 320px; line-height: 1.6; }
.flyover-error .error-close {
  margin-top: 6px; padding: 8px 26px; border: none; border-radius: 20px;
  background: #43A047; color: #fff; font-size: 14px; cursor: pointer;
}
.flyover-error .error-close:hover { background: #2E7D32; }
</style>
