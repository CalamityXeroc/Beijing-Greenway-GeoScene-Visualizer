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
        </div>
        <div class="topbar-right">
          <span class="waypoint-label">{{ currentIdx + 1 }} / {{ waypoints.length }}</span>
          <button class="btn-icon" @click="prevWaypoint" :disabled="currentIdx <= 0" title="上一个">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 6l5 5-5 5V6z" fill="currentColor"/></svg>
          </button>
          <button class="btn-icon btn-play" @click="togglePlay" title="暂停/继续">
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

      <!-- POI 卡片 -->
      <div class="poi-card" v-if="currentPoi">
        <div class="poi-name">{{ currentPoi.name }}</div>
        <div class="poi-desc">{{ currentPoi.description }}</div>
      </div>

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
import { getLayerManager } from '@/core/LayerManager.js'
import GeoJSONLayer from '@geoscene/core/layers/GeoJSONLayer.js'
import GraphicsLayer from '@geoscene/core/layers/GraphicsLayer.js'
import Graphic from '@geoscene/core/Graphic.js'
import Point from '@geoscene/core/geometry/Point.js'
import Polyline from '@geoscene/core/geometry/Polyline.js'

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
const currentPoi = ref(null)
const pois = ref([])

let mapManager = null
let flyTimer = null
let resolvedGreenwayId = 0

const progressPct = computed(() => {
  if (waypoints.value.length <= 1) return 0
  return (currentIdx.value / (waypoints.value.length - 1)) * 100
})

// 加载飞行路径
async function loadFlyover() {
  try {
    const idParam = props.greenwayId > 0 ? `/${props.greenwayId}` : `/name/${encodeURIComponent(props.greenwayName)}`
    const resp = await fetch(`/api/greenways${idParam}/flyover`)
    const data = await resp.json()
    waypoints.value = data.waypoints || []
    resolvedGreenwayId = data.greenwayId || props.greenwayId

    // 加载 POI
    if (resolvedGreenwayId) {
      try {
        const detailResp = await fetch(`/api/greenways/${resolvedGreenwayId}`)
        const detail = await detailResp.json()
        pois.value = detail.data?.points_of_interest || []
      } catch { /* POI 加载失败不碍事 */ }
    }
  } catch (e) {
    console.error('[Flyover] 加载失败:', e)
  }
}

// 初始化 3D 场景
async function initScene() {
  if (!sceneContainer.value || !props.visible) return
  loading.value = true

  mapManager = getMapManager()
  // 如果已有实例先销毁
  if (mapManager.getView()) {
    mapManager.destroy()
  }

  mapManager.init(sceneContainer.value, {
    mode: '3d',
    center: waypoints.value.length > 0
      ? [waypoints.value[0].lng, waypoints.value[0].lat]
      : [116.4, 39.9],
    controls: false
  })

  // 底图：WebTileLayer + fullExtent（SceneView local模式必需！）
  const mapInstance = mapManager.getMap()
  if (mapInstance) {
    const { default: WebTileLayer } = await import('@geoscene/core/layers/WebTileLayer.js')
    // 关键：SceneView local模式必须设fullExtent，否则不加载瓦片！
    const fullExtent = {
      xmin: -20037508.342787, ymin: -20037508.342787,
      xmax: 20037508.342787, ymax: 20037508.342787,
      spatialReference: { wkid: 102100 }
    }
    const basemap = new WebTileLayer({
      urlTemplate: window.location.origin + '/api/tiles/gaode/6/{level}/{col}/{row}',
      title: '高德卫星图',
      fullExtent,
      spatialReference: { wkid: 102100 },
      tileInfo: {
        size: [256, 256],
        origin: { x: -20037508.342787, y: 20037508.342787 },
        spatialReference: { wkid: 102100 },
        lods: Array.from({ length: 18 }, (_, i) => ({
          level: i,
          resolution: 156543.033928 / Math.pow(2, i),
          scale: 591657527.591555 / Math.pow(2, i)
        }))
      }
    })
    basemap._zIndex = 0
    mapInstance.add(basemap)
  }

  const layerManager = getLayerManager()

  // 添加绿道线图层（贴地）
  const gid = resolvedGreenwayId || props.greenwayId
  const greenwayUrl = `/api/greenways/${gid}`
  const resp = await fetch(greenwayUrl)
  const data = await resp.json()
  if (data.data?.geometry) {
    const geoJsonData = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: data.data.geometry,
        properties: { name: props.greenwayName }
      }]
    }
    const glLayer = layerManager.createVectorLayerFromGeoJSON({
      data: geoJsonData,
      style: { lineColor: props.greenwayColor, lineWidth: 3 },
      zIndex: 10,
      elevationInfo: { mode: 'on-the-ground' }
    })
    if (glLayer.elevationInfo !== undefined) {
      glLayer.elevationInfo = { mode: 'on-the-ground' }
    }
    mapManager.addLayer('greenway-line', glLayer)
  }

  // 添加 POI 标记
  if (pois.value.length > 0) {
    const gLayer = new GraphicsLayer({ elevationInfo: { mode: 'on-the-ground' } })
    pois.value.forEach((poi, i) => {
      const pt = new Point({
        longitude: poi.geometry.coordinates[0],
        latitude: poi.geometry.coordinates[1],
        spatialReference: { wkid: 4326 }
      })
      gLayer.add(new Graphic({
        geometry: pt,
        symbol: {
          type: 'point-3d',
          symbolLayers: [{
            type: 'icon',
            resource: { primitive: 'circle' },
            size: 12,
            color: props.greenwayColor,
            outline: { color: '#fff', size: 1 }
          }]
        }
      }))
    })
    mapManager.addLayer('poi-markers', gLayer)
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

// 飞到指定站点
function goToWaypoint(idx) {
  if (!mapManager || idx >= waypoints.value.length) return
  currentIdx.value = idx
  const wp = waypoints.value[idx]
  mapManager.flyTo([wp.lng, wp.lat], wp.heading || 0, 60, wp.altitude || 200, 2000 / speed.value)

  // 检查附近 POI
  checkNearbyPoi(wp)
  // 发出音效感（不实现，留作扩展点）
}

// 检测附近 POI
function checkNearbyPoi(wp) {
  const threshold = 0.005 // ~500m
  const nearby = pois.value.find(poi => {
    const dx = poi.geometry.coordinates[0] - wp.lng
    const dy = poi.geometry.coordinates[1] - wp.lat
    return Math.sqrt(dx * dx + dy * dy) < threshold
  })
  currentPoi.value = nearby || null
  if (nearby) {
    // 3 秒后自动隐藏 POI 卡片
    clearTimeout(window._poiTimer)
    window._poiTimer = setTimeout(() => { currentPoi.value = null }, 4000)
  }
}

// 播放控制
function togglePlay() {
  playing.value = !playing.value
  if (playing.value) {
    autoPlay()
  } else {
    clearTimeout(flyTimer)
  }
}

function autoPlay() {
  if (!playing.value) return
  if (currentIdx.value >= waypoints.value.length - 1) {
    playing.value = false
    return
  }
  const delay = 2500 / speed.value
  flyTimer = setTimeout(() => {
    if (playing.value) {
      nextWaypoint()
      autoPlay()
    }
  }, delay)
}

function nextWaypoint() {
  if (currentIdx.value < waypoints.value.length - 1) {
    goToWaypoint(currentIdx.value + 1)
  }
}

function prevWaypoint() {
  if (currentIdx.value > 0) {
    goToWaypoint(currentIdx.value - 1)
  }
}

// 监听 visible
watch(() => props.visible, async (v) => {
  if (v) {
    document.body.style.overflow = 'hidden'
    await loadFlyover()
    await initScene()
  } else {
    document.body.style.overflow = ''
    playing.value = false
    clearTimeout(flyTimer)
    if (mapManager) mapManager.destroy()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  playing.value = false
  clearTimeout(flyTimer)
  clearTimeout(window._poiTimer)
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
  background: linear-gradient(180deg, rgba(0,0,0,.8) 0%, transparent 100%);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; z-index: 10;
}
.topbar-left, .topbar-right {
  display: flex; align-items: center; gap: 10px;
}
.topbar-title {
  color: #fff; font-size: 1.1em; font-weight: 600;
}
.waypoint-label {
  color: #aaa; font-size: .85em; font-variant-numeric: tabular-nums;
}
.btn-icon {
  background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2);
  border-radius: 6px; color: #fff; padding: 6px 8px; cursor: pointer;
  display: flex; align-items: center; transition: background .2s;
}
.btn-icon:hover { background: rgba(255,255,255,.2); }
.btn-icon:disabled { opacity: .3; cursor: default; }
.btn-play { padding: 8px 12px; }
.speed-select {
  background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2);
  border-radius: 6px; color: #fff; padding: 4px 6px; font-size: .85em;
}

.progress-track {
  position: absolute; bottom: 60px; left: 20px; right: 20px;
  height: 4px; background: rgba(255,255,255,.15); border-radius: 2px; z-index: 10;
}
.progress-fill {
  height: 100%; background: #4CAF50; border-radius: 2px; transition: width .5s;
}
.progress-dot {
  position: absolute; top: -4px; width: 12px; height: 12px; border-radius: 50%;
  background: rgba(255,255,255,.3); border: 2px solid rgba(255,255,255,.1);
  transform: translateX(-50%); transition: all .3s;
}
.progress-dot.active { background: #4CAF50; border-color: #fff; box-shadow: 0 0 8px rgba(76,175,80,.5); }
.progress-dot.done { background: rgba(76,175,80,.5); border-color: rgba(76,175,80,.3); }

.poi-card {
  position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,.85); border: 1px solid rgba(76,175,80,.4);
  border-radius: 12px; padding: 16px 24px; z-index: 10;
  animation: poiIn .3s ease;
  max-width: 360px; text-align: center;
}
.poi-name { color: #4CAF50; font-size: 1.1em; font-weight: 600; margin-bottom: 4px; }
.poi-desc { color: #aaa; font-size: .9em; }
@keyframes poiIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } }

.loading-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,0,0,.9); z-index: 20; color: #fff; gap: 16px;
}
.loading-spinner {
  width: 40px; height: 40px; border: 3px solid rgba(255,255,255,.2);
  border-top-color: #4CAF50; border-radius: 50%; animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
