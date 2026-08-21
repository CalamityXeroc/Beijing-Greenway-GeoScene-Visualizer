<template>
  <div ref="mapContainer" class="map-viewer" :style="{ height: height }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick, markRaw } from 'vue'
import { rafThrottle, scheduleIdleTask } from '@/utils/performance'
import { useGlobalTheme } from '@/utils/useTheme'

const POINTER_MOVE_THRESHOLD = 0.75
const TILE_PROXY_TIMEOUT_MS = 6000
const TILE_PROXY_RETRY_COUNT = 4
const TILE_PROXY_RETRY_DELAY_MS = 800
const TILE_PROXY_RECOVERY_INTERVAL_MS = 12000
const TILE_PROXY_RECOVERY_MAX_ATTEMPTS = 18
const TILE_PROXY_RECOVERY_DEBOUNCE_MS = 3000

const hasPointerShifted = (prevPixel, nextPixel) => {
  if (!prevPixel) return true
  return (
    Math.abs(prevPixel[0] - nextPixel[0]) > POINTER_MOVE_THRESHOLD ||
    Math.abs(prevPixel[1] - nextPixel[1]) > POINTER_MOVE_THRESHOLD
  )
}

const STYLE_SIGNATURE_EMPTY = '__default__'

const props = defineProps({
  center: {
    type: Array,
    default: () => [116.3, 39.95]
  },
  zoom: {
    type: Number,
    default: 10
  },
  height: {
    type: String,
    default: '100%'
  },
  baseLayerStyle: {
    type: Number,
    default: 8
  },
  layers: {
    type: Array,
    default: () => []
  },
  interactive: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'map-ready',
  'map-click',
  'feature-click',
  'feature-hover',
  'center-changed',
  'zoom-changed'
])

const mapContainer = ref(null)

let map = null
let view = null
let mapManager = null
let layerManager = null
const loadedLayers = new Map()
const layerIdLookup = new WeakMap()
let clickHandler = null
let pointerMoveHandler = null
let centerWatchHandle = null
let zoomWatchHandle = null
let lastPointerPixel = null
let hoverRequestToken = 0
let tileProxyRecoveryTimer = null
let tileProxyRecoveryAttempts = 0
let lastBaseLayerChange = 0
const deferredLayerConfigs = new Map()
const deferredCreationTasks = new Map()

const { theme: globalTheme } = useGlobalTheme()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const probeTileProxyOnce = async (style) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(`/api/tiles/gaode/${style}/10/843/387`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    })
    const contentType = response.headers.get('content-type') || ''
    return response.ok && contentType.includes('image')
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('[MapViewer] 底图代理探测超时')
    }
    return false
  } finally {
    clearTimeout(timeout)
  }
}

const canUseTileProxy = async (style, retries = TILE_PROXY_RETRY_COUNT) => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      if (await probeTileProxyOnce(style)) {
        return true
      }
    } catch (err) {
      console.error('[MapViewer] canUseTileProxy 异常:', err)
    }
    if (attempt < retries - 1) {
      await sleep(TILE_PROXY_RETRY_DELAY_MS)
    }
  }
  return false
}

const installBaseLayer = (layer) => {
  if (!mapManager || !layer) return

  // 只是添加底图，不删除旧的（除非是明确的替换操作）
  mapManager.addLayer('base', layer)
  loadedLayers.set('base', {
    id: 'base',
    layer,
    type: 'base',
    styleSignature: STYLE_SIGNATURE_EMPTY
  })
  layerIdLookup.set(layer, 'base')
}

const replaceBaseLayer = (layer) => {
  if (!mapManager || !layer) return

  // 真正的替换：先删除旧的，再添加新的
  const existing = loadedLayers.get('base')
  if (existing?.layer) {
    layerIdLookup.delete(existing.layer)
    mapManager.removeLayer('base')
  }

  mapManager.addLayer('base', layer)
  loadedLayers.set('base', {
    id: 'base',
    layer,
    type: 'base',
    styleSignature: STYLE_SIGNATURE_EMPTY
  })
  layerIdLookup.set(layer, 'base')
}

const stopTileProxyRecovery = () => {
  if (tileProxyRecoveryTimer) {
    clearInterval(tileProxyRecoveryTimer)
    tileProxyRecoveryTimer = null
  }
  tileProxyRecoveryAttempts = 0
}

const startTileProxyRecovery = (style) => {
  stopTileProxyRecovery()
  tileProxyRecoveryTimer = setInterval(async () => {
    if (!mapManager || !layerManager) {
      stopTileProxyRecovery()
      return
    }

    const now = Date.now()
    const timeSinceLastChange = now - lastBaseLayerChange
    if (timeSinceLastChange < TILE_PROXY_RECOVERY_DEBOUNCE_MS) {
      return
    }

    tileProxyRecoveryAttempts += 1
    const proxyReady = await canUseTileProxy(style, 1)
    if (proxyReady) {
      lastBaseLayerChange = now
      const proxyLayer = layerManager.createGaodeLayer(style, { useProxy: true })
      replaceBaseLayer(proxyLayer)
      stopTileProxyRecovery()
      console.info('[MapViewer] 底图代理已恢复，已切换为后端代理模式')
      return
    }

    if (tileProxyRecoveryAttempts >= TILE_PROXY_RECOVERY_MAX_ATTEMPTS) {
      stopTileProxyRecovery()
    }
  }, TILE_PROXY_RECOVERY_INTERVAL_MS)
}

onMounted(async () => {
  await nextTick()

  // 确保容器 DOM 干净（防止前一个 map 实例留下的残余 canvas）
  if (mapContainer.value) {
    const staleCanvases = mapContainer.value.querySelectorAll('canvas')
    staleCanvases.forEach(c => c.remove())
  }

  try {
    const MapManagerClass = (await import('@/core/MapManager')).default
    const LayerManagerClass = (await import('@/core/LayerManager')).default

    mapManager = markRaw(new MapManagerClass())
    layerManager = markRaw(new LayerManagerClass())

    map = mapManager.init(mapContainer.value, {
      center: props.center,
      zoom: props.zoom,
      interactive: props.interactive
    })
    view = mapManager.getView()

    if (!view) {
      console.error('[MapViewer] 地图视图创建失败')
      emit('map-ready', null)
      return
    }

    const baseLayer = layerManager.createGaodeLayer(props.baseLayerStyle, { useProxy: true })
    installBaseLayer(baseLayer)
    console.log("[MapViewer] 已装载代理高德底图")

    mapManager.setMapContainer(mapContainer.value)

    const isNight = globalTheme.value === 'night'
    mapContainer.value.classList.toggle('night-mode', isNight)
    if (isNight) applyNightEffect()

    if (props.layers && props.layers.length > 0) {
      await syncLayers(props.layers)
    }

    setupEventListeners()
    emit('map-ready', map)
    console.log('[MapViewer] 地图组件初始化完成（GeoScene）')
  } catch (err) {
    console.error('[MapViewer] 地图初始化失败:', err.message || err)
    // 重试一次（Vite 动态导入可能因导航取消而失败）
    try {
      console.log('[MapViewer] 正在重试初始化...')
      await new Promise(r => setTimeout(r, 500))
      const MapManagerClass = (await import('@/core/MapManager')).default
      const LayerManagerClass = (await import('@/core/LayerManager')).default

      mapManager = markRaw(new MapManagerClass())
      layerManager = markRaw(new LayerManagerClass())

      map = mapManager.init(mapContainer.value, {
        center: props.center,
        zoom: props.zoom,
        interactive: props.interactive
      })
      view = mapManager.getView()

      if (!view) {
        console.error('[MapViewer] 重试失败：视图创建失败')
        emit('map-ready', null)
        return
      }

      const baseLayer = layerManager.createGaodeLayer(props.baseLayerStyle, { useProxy: true })
      installBaseLayer(baseLayer)
      mapManager.setMapContainer(mapContainer.value)

      if (props.layers && props.layers.length > 0) {
        await syncLayers(props.layers)
      }

      setupEventListeners()
      emit('map-ready', map)
      console.log('[MapViewer] 重试初始化成功')
    } catch (retryErr) {
      console.error('[MapViewer] 重试也失败:', retryErr.message || retryErr)
      emit('map-ready', null)
    }
  }
})


// 通过 GeoScene API 对底图应用夜间滤镜（CSS选择器对Canvas渲染无效）
const NIGHT_FILTER = 'grayscale(100%) invert(100%) sepia(100%) hue-rotate(190deg) saturate(400%) brightness(90%) contrast(85%)'
const applyNightEffect = () => {
  const baseRecord = loadedLayers.get('base')
  if (baseRecord?.layer) {
    baseRecord.layer.effect = globalTheme.value === 'night' ? NIGHT_FILTER : ''
  }
}

watch(
  () => props.layers,
  (newLayers = []) => {
    if (!mapManager || !layerManager) return
    syncLayers(newLayers)
  },
  { deep: true }
)

watch(
  () => globalTheme.value,
  (newTheme) => {
    if (!mapContainer.value) return
    mapContainer.value.classList.toggle('night-mode', newTheme === 'night')
    applyNightEffect()
  }
)

const getStyleSignature = (styleConfig) => {
  if (!styleConfig) return STYLE_SIGNATURE_EMPTY
  try {
    return JSON.stringify(styleConfig)
  } catch (error) {
    console.warn('[MapViewer] 样式配置无法序列化，将强制刷新图层样式', error)
    return `${STYLE_SIGNATURE_EMPTY}-${Date.now()}`
  }
}

const createLayerFromConfig = (config) => {
  if (!config) return null

  const baseOptions = {
    zIndex: config.zIndex ?? 10,
    visible: config.visible !== false,
    interactive: config.interactive !== false
  }

  if (config.type === 'vector') {
    const layer = layerManager.createVectorLayerFromFeatures([], baseOptions)
    return {
      layer,
      styleSignature: STYLE_SIGNATURE_EMPTY
    }
  }

  const layer = layerManager.createVectorLayerFromGeoJSON({
    url: config.url,
    data: config.data,
    style: config.style || layerManager.getDefaultStyle(),
    zIndex: baseOptions.zIndex,
    visible: baseOptions.visible,
    interactive: baseOptions.interactive
  })

  return {
    layer,
    styleSignature: getStyleSignature(config.style)
  }
}

const applyLayerRuntimeProps = (record, config) => {
  if (!record?.layer || !config) return

  const desiredVisible = config.visible !== false
  if (record.layer.visible !== desiredVisible) {
    record.layer.visible = desiredVisible
  }

  const desiredZ = config.zIndex ?? 10
  if (record.layer._zIndex !== desiredZ) {
    mapManager.setLayerZIndex(record.id, desiredZ)
  }

  const nextStyleSignature = getStyleSignature(config.style)
  if (nextStyleSignature !== record.styleSignature && record.layer.renderer) {
    record.layer.renderer = layerManager.createStyleFunction(config.style || {}, config.data)
    record.styleSignature = nextStyleSignature
  }

  record.layer._interactive = config.interactive !== false
}

const shouldRebuildLayer = (record, config) => {
  if (!record) return true
  return (
    record.type !== (config.type || 'geojson') ||
    record.url !== (config.url || null) ||
    record.dataRef !== (config.data || null)
  )
}

const cleanupLayerRecord = (record) => {
  if (record?.layer?._objectUrl) {
    URL.revokeObjectURL(record.layer._objectUrl)
    record.layer._objectUrl = null
  }
}

const teardownLayer = (layerId) => {
  if (layerId === 'base') return
  cancelDeferredLayer(layerId)
  const record = loadedLayers.get(layerId)
  if (!record) return
  cleanupLayerRecord(record)
  mapManager.removeLayer(layerId)
  layerIdLookup.delete(record.layer)
  loadedLayers.delete(layerId)
}

const cancelDeferredLayer = (layerId) => {
  if (deferredCreationTasks.has(layerId)) {
    deferredCreationTasks.get(layerId)?.cancel?.()
    deferredCreationTasks.delete(layerId)
  }
  deferredLayerConfigs.delete(layerId)
}

const fitLayerExtent = async (layer) => {
  if (!layer?.queryExtent) return
  try {
    await layer.when()
    const result = await layer.queryExtent()
    const extent = result?.extent
    if (extent) {
      mapManager.fitExtent(extent)
    }
  } catch (error) {
    console.warn('[MapViewer] 适配图层范围失败', error)
  }
}

const queueDeferredLayer = (layerId, config) => {
  deferredLayerConfigs.set(layerId, { ...config })
  if (deferredCreationTasks.has(layerId)) return

  const handle = scheduleIdleTask(async () => {
    deferredCreationTasks.delete(layerId)
    const latestConfig = deferredLayerConfigs.get(layerId)
    if (!latestConfig || loadedLayers.has(layerId)) {
      deferredLayerConfigs.delete(layerId)
      return
    }

    const created = createLayerFromConfig(latestConfig)
    if (!created?.layer) {
      deferredLayerConfigs.delete(layerId)
      return
    }

    mapManager.addLayer(layerId, created.layer)
    loadedLayers.set(layerId, {
      id: layerId,
      layer: created.layer,
      type: latestConfig.type || 'geojson',
      url: latestConfig.url || null,
      dataRef: latestConfig.data || null,
      styleSignature: created.styleSignature
    })
    layerIdLookup.set(created.layer, layerId)
    deferredLayerConfigs.delete(layerId)

    if (latestConfig.fitExtent) {
      await fitLayerExtent(created.layer)
    }
  }, { timeout: config.deferTimeout || 1500 })

  deferredCreationTasks.set(layerId, handle)
}

async function syncLayers(layersConfig = []) {
  const targetIds = new Set()

  for (let index = 0; index < layersConfig.length; index += 1) {
    const config = layersConfig[index]
    if (!config) continue

    const layerId = config.id || `layer-${index}`
    targetIds.add(layerId)

    const existingRecord = loadedLayers.get(layerId)
    if (!existingRecord && config.defer) {
      queueDeferredLayer(layerId, config)
      continue
    } else if (!config.defer) {
      cancelDeferredLayer(layerId)
    }

    if (shouldRebuildLayer(existingRecord, config)) {
      teardownLayer(layerId)

      if (config.defer) {
        queueDeferredLayer(layerId, config)
        continue
      }

      const created = createLayerFromConfig(config)
      if (!created?.layer) {
        console.warn('[MapViewer] 图层创建失败，已跳过', config)
        continue
      }

      mapManager.addLayer(layerId, created.layer)
      loadedLayers.set(layerId, {
        id: layerId,
        layer: created.layer,
        type: config.type || 'geojson',
        url: config.url || null,
        dataRef: config.data || null,
        styleSignature: created.styleSignature
      })
      layerIdLookup.set(created.layer, layerId)

      if (config.fitExtent) {
        await fitLayerExtent(created.layer)
      }
    } else {
      applyLayerRuntimeProps(existingRecord, config)
    }
  }

  loadedLayers.forEach((record, id) => {
    if (id === 'base') return
    if (id.startsWith('geoscene-')) return // GeoScene 服务图层由外部 addLayer 管理，不随 layerConfig 清理
    if (!targetIds.has(id)) {
      teardownLayer(id)
    }
  })

  deferredLayerConfigs.forEach((_, id) => {
    if (!targetIds.has(id)) {
      cancelDeferredLayer(id)
    }
  })
}

const pickFeaturesFromHitTest = (hitResult) => {
  const featuresWithLayers = []
  const results = hitResult?.results || []

  for (let i = 0; i < results.length; i += 1) {
    const item = results[i]
    const feature = item?.graphic
    const layer = feature?.layer || item?.layer
    if (!feature || !layer) continue
    if (layer.visible === false || layer._interactive === false) continue

    const layerId = layerIdLookup.get(layer) || layer._layerId || layer.id || null
    featuresWithLayers.push({
      feature,
      layer,
      layerId
    })
  }

  return featuresWithLayers
}

function setupEventListeners() {
  if (!mapManager || !view) return

  clickHandler = async (evt) => {
    const pixel = [evt.x, evt.y]
    emit('map-click', {
      coordinate: evt.mapPoint ? mapManager.toLonLat(evt.mapPoint) : null,
      pixel
    })

    try {
      const hitResult = await view.hitTest(evt)
      const featuresWithLayers = pickFeaturesFromHitTest(hitResult)
      if (featuresWithLayers.length > 0) {
        emit('feature-click', {
          features: featuresWithLayers.map((f) => f.feature),
          featuresWithLayers,
          coordinate: evt.mapPoint ? mapManager.toLonLat(evt.mapPoint) : null,
          pixel
        })
      }
    } catch (error) {
      console.warn('[MapViewer] click hitTest 失败', error)
    }
  }
  mapManager.on('click', clickHandler)

  let lastHoverKey = null
  pointerMoveHandler = rafThrottle(async (evt) => {
    if (!view) return
    const pixel = [evt.x, evt.y]
    const pointerMoved = hasPointerShifted(lastPointerPixel, pixel)

    hoverRequestToken += 1
    const currentToken = hoverRequestToken

    try {
      const hitResult = await view.hitTest(evt)
      if (currentToken !== hoverRequestToken) return

      const featuresWithLayers = pickFeaturesFromHitTest(hitResult)
      const hasFeature = featuresWithLayers.length > 0
      view.container.style.cursor = hasFeature ? 'pointer' : ''

      if (hasFeature) {
        const topFeature = featuresWithLayers[0]
        const layerId = topFeature.layerId || 'unknown'
        const featureKey = topFeature.feature?.uid || topFeature.feature?.attributes?.OBJECTID || Date.now()
        const hoverKey = `${layerId}-${featureKey}`

        if (hoverKey !== lastHoverKey || pointerMoved) {
          lastHoverKey = hoverKey
          lastPointerPixel = [pixel[0], pixel[1]]

          emit('feature-hover', {
            features: featuresWithLayers.map((f) => f.feature),
            featuresWithLayers,
            coordinate: evt.mapPoint ? mapManager.toLonLat(evt.mapPoint) : null,
            pixel
          })
        }
      } else if (lastHoverKey !== null) {
        lastHoverKey = null
        lastPointerPixel = [pixel[0], pixel[1]]
        emit('feature-hover', {
          features: [],
          featuresWithLayers: [],
          coordinate: evt.mapPoint ? mapManager.toLonLat(evt.mapPoint) : null,
          pixel
        })
      } else if (pointerMoved) {
        lastPointerPixel = [pixel[0], pixel[1]]
      }
    } catch (error) {
      console.warn('[MapViewer] pointermove hitTest 失败', error)
    }
  })

  mapManager.on('pointer-move', pointerMoveHandler)

  centerWatchHandle = view.watch('center', () => {
    emit('center-changed', mapManager.getCenter())
  })

  zoomWatchHandle = view.watch('zoom', () => {
    emit('zoom-changed', view.zoom)
  })
}

defineExpose({
  getMap: () => map,
  getMapManager: () => mapManager,
  getLayerManager: () => layerManager,
  setCenter: (lonLat, zoom) => mapManager?.setCenter(lonLat, zoom),
  fitExtent: (extent, options) => mapManager?.fitExtent(extent, options),
  addLayer: (id, layer, meta = {}) => {
    if (!mapManager || !layer) return
    mapManager.addLayer(id, layer)
    loadedLayers.set(id, {
      id,
      layer,
      type: meta.type || 'custom',
      url: meta.url || null,
      dataRef: meta.dataRef || null,
      styleSignature: STYLE_SIGNATURE_EMPTY
    })
    layerIdLookup.set(layer, id)
  },
  removeLayer: (id) => {
    if (!mapManager) return
    teardownLayer(id)
  },
  setLayerVisibility: (id, visible) => {
    const record = loadedLayers.get(id)
    if (record?.layer) {
      record.layer.visible = visible
    } else {
      mapManager?.setLayerVisibility(id, visible)
    }
  }
})

onBeforeUnmount(() => {
  stopTileProxyRecovery()
  if (mapManager) {
    if (clickHandler) {
      mapManager.un('click', clickHandler)
    }
    if (pointerMoveHandler) {
      mapManager.un('pointer-move', pointerMoveHandler)
    }
    centerWatchHandle?.remove?.()
    zoomWatchHandle?.remove?.()
    mapManager.destroy()
  }

  loadedLayers.forEach((record) => cleanupLayerRecord(record))
  loadedLayers.clear()
  deferredLayerConfigs.clear()
  deferredCreationTasks.forEach((task) => task?.cancel?.())
  deferredCreationTasks.clear()
  console.log('[MapViewer] 组件卸载')
})
</script>

<style scoped>
.map-viewer {
  width: 100%;
  position: relative;
  border-radius: 0;
  overflow: hidden;
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  -webkit-transform: translateZ(0);
  -moz-transform: translateZ(0);
  -ms-transform: translateZ(0);
  -o-transform: translateZ(0);
}

:deep(.geoscene-ui .geoscene-component) {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:deep(.geoscene-ui .geoscene-widget--button) {
  background: transparent;
  transition: all 0.2s ease;
}

:deep(.geoscene-ui .geoscene-widget--button:hover) {
  background: rgba(33, 150, 243, 0.1);
}

:deep(.geoscene-zoom) {
  top: 1rem;
  left: auto;
  right: 1rem;
}

:deep(.geoscene-attribution) {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

.map-viewer.night-mode {
  transition: filter 0.5s ease-in-out;
  background-color: #020918;
}

.map-viewer.night-mode :deep(.geoscene-layer[data-layer-id='gaode-base-layer']) {
  filter: grayscale(100%) invert(100%) sepia(100%) hue-rotate(190deg) saturate(400%) brightness(90%) contrast(85%) !important;
}

.map-viewer.night-mode :deep(.geoscene-layer:not([data-layer-id='gaode-base-layer'])) {
  filter: brightness(1.2) drop-shadow(0 0 5px rgba(132, 237, 132, 0.6));
}

.map-viewer.night-mode :deep(.geoscene-ui .geoscene-component) {
  background: rgba(16, 35, 60, 0.9);
  color: #c7d2e6;
  border: 1px solid rgba(50, 100, 180, 0.3);
}

.map-viewer.night-mode :deep(.geoscene-ui .geoscene-widget--button) {
  color: #c7d2e6;
  background: rgba(20, 40, 70, 0.8);
}

.map-viewer.night-mode :deep(.geoscene-ui .geoscene-widget--button:hover) {
  background: rgba(40, 80, 140, 0.9);
}
</style>
