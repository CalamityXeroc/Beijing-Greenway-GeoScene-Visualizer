<template>
  <div class="map-toolbar-geoscene" aria-hidden="true"></div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, toRaw } from 'vue'
import GraphicsLayer from '@geoscene/core/layers/GraphicsLayer.js'
import GeoJSONLayer from '@geoscene/core/layers/GeoJSONLayer.js'
import SketchViewModel from '@geoscene/core/widgets/Sketch/SketchViewModel.js'
import Graphic from '@geoscene/core/Graphic.js'
import Point from '@geoscene/core/geometry/Point.js'
import * as geometryEngine from '@geoscene/core/geometry/geometryEngine.js'
import { useGlobalTheme } from '@/utils/useTheme'

const props = defineProps({
  mapManager: {
    type: Object,
    required: true
  },
  layerConfig: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['tool-activated', 'layer-added', 'layer-toggled'])
const { theme: globalTheme, setTheme: setGlobalTheme } = useGlobalTheme()

const activeTool = ref(null)
const showLayerUpload = ref(false)
const customLayers = ref([])
const currentTheme = ref(globalTheme.value)
const drawStyles = reactive({
  point: {
    fillColor: '#4CAF50',
    strokeColor: '#ffffff',
    radius: 7,
    strokeWidth: 2
  },
  line: {
    color: '#2196F3',
    width: 3,
    dash: 'solid'
  },
  polygon: {
    fillColor: '#4CAF50',
    fillOpacity: 0.25,
    strokeColor: '#2E7D32',
    strokeWidth: 2
  }
})

const filteredLayerConfig = computed(() => {
  return props.layerConfig.filter((layer) => {
    return layer.id !== 'wenyu-greenway' &&
      layer.id !== 'huanerhuan-greenway' &&
      layer.id !== 'liangmahe-greenway' &&
      layer.id !== 'changying-greenway' &&
      layer.id !== 'changping42-greenway' &&
      layer.id !== 'lidu-greenway' &&
      layer.id !== 'beiyunhe-greenway' &&
      layer.id !== 'nansha-greenway' &&
      layer.id !== 'aosen-greenway' &&
      layer.id !== 'yingcheng-greenway' &&
      layer.id !== 'sanshan-greenway' &&
      layer.id !== 'chaoyang-greenway'
  })
})

let drawLayer = null
let measureLayer = null
let sketchViewModel = null
let sketchCreateHandle = null
let sketchMode = null
let sketchGeometryType = null
let measureType = null

const getMapManager = () => toRaw(props.mapManager)

const hexToRgba = (hex, opacity = 1) => {
  const h = hex?.startsWith('#') ? hex.slice(1) : hex
  if (!h || h.length !== 6) return `rgba(33, 150, 243, ${opacity})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

const buildPointSymbol = () => {
  const s = drawStyles.point
  return {
    type: 'simple-marker',
    color: hexToRgba(s.fillColor),
    size: Math.max(s.radius * 2, 6),
    outline: {
      color: hexToRgba(s.strokeColor),
      width: s.strokeWidth
    }
  }
}

const buildLineSymbol = () => {
  const s = drawStyles.line
  return {
    type: 'simple-line',
    color: hexToRgba(s.color),
    width: s.width,
    style: s.dash === 'solid' ? 'solid' : 'short-dash'
  }
}

const buildPolygonSymbol = () => {
  const s = drawStyles.polygon
  return {
    type: 'simple-fill',
    color: hexToRgba(s.fillColor, s.fillOpacity),
    outline: {
      color: hexToRgba(s.strokeColor),
      width: s.strokeWidth
    }
  }
}

const buildMeasureSymbol = (type) => {
  if (type === 'length') {
    return {
      type: 'simple-line',
      color: '#2196F3',
      width: 2,
      style: 'dash'
    }
  }

  return {
    type: 'simple-fill',
    color: 'rgba(33, 150, 243, 0.2)',
    outline: {
      color: '#2196F3',
      width: 2,
      style: 'dash'
    }
  }
}

const initDrawLayer = () => {
  drawLayer = new GraphicsLayer({
    id: 'draw-layer',
    title: 'draw-layer',
    listMode: 'hide',
    visible: true
  })
  drawLayer._zIndex = 100
  drawLayer._interactive = false
  getMapManager()?.addLayer('draw-layer', drawLayer)
}

const initMeasureLayer = () => {
  measureLayer = new GraphicsLayer({
    id: 'measure-layer',
    title: 'measure-layer',
    listMode: 'hide',
    visible: true
  })
  measureLayer._zIndex = 101
  measureLayer._interactive = false
  getMapManager()?.addLayer('measure-layer', measureLayer)
}

const setupSketchViewModel = () => {
  const view = getMapManager()?.getView?.()
  if (!view || !drawLayer) return

  sketchViewModel = new SketchViewModel({
    view,
    layer: drawLayer,
    updateOnGraphicClick: false,
    pointSymbol: buildPointSymbol(),
    polylineSymbol: buildLineSymbol(),
    polygonSymbol: buildPolygonSymbol()
  })

  sketchCreateHandle = sketchViewModel.on('create', (event) => {
    if (event.state !== 'complete') return
    if (!activeTool.value) return

    if (sketchMode === 'measure') {
      const value = measureType === 'length'
        ? formatLength(event.graphic.geometry)
        : formatArea(event.graphic.geometry)
      event.graphic.symbol = buildMeasureSymbol(measureType)
      addMeasurementLabel(event.graphic.geometry, value)
      emit('tool-activated', { type: 'measure', subType: measureType, value })
    } else {
      emit('tool-activated', { type: 'draw', subType: activeTool.value })
    }

    queueNextSketch()
  })
}

const queueNextSketch = () => {
  if (!sketchViewModel || !activeTool.value || !sketchGeometryType) return
  requestAnimationFrame(() => {
    if (!sketchViewModel || !activeTool.value || !sketchGeometryType) return
    sketchViewModel.create(sketchGeometryType)
  })
}

const removeCurrentInteraction = () => {
  if (sketchViewModel) {
    sketchViewModel.cancel()
  }
  activeTool.value = null
  sketchMode = null
  sketchGeometryType = null
  measureType = null
}

const activateDrawTool = (type) => {
  if (!sketchViewModel || !drawLayer) return
  if (activeTool.value === type) {
    removeCurrentInteraction()
    return
  }

  removeCurrentInteraction()

  sketchMode = 'draw'
  sketchGeometryType = type === 'point' ? 'point' : type === 'line' ? 'polyline' : 'polygon'
  activeTool.value = type

  sketchViewModel.layer = drawLayer
  sketchViewModel.pointSymbol = buildPointSymbol()
  sketchViewModel.polylineSymbol = buildLineSymbol()
  sketchViewModel.polygonSymbol = buildPolygonSymbol()
  sketchViewModel.create(sketchGeometryType)
}

const activateMeasureTool = (type) => {
  if (!sketchViewModel || !measureLayer) return
  const nextTool = `measure-${type}`
  if (activeTool.value === nextTool) {
    removeCurrentInteraction()
    return
  }

  removeCurrentInteraction()

  sketchMode = 'measure'
  measureType = type
  sketchGeometryType = type === 'length' ? 'polyline' : 'polygon'
  activeTool.value = nextTool

  sketchViewModel.layer = measureLayer
  const symbol = buildMeasureSymbol(type)
  sketchViewModel.polylineSymbol = symbol
  sketchViewModel.polygonSymbol = symbol
  sketchViewModel.create(sketchGeometryType)
}

const formatLength = (geometry) => {
  let length = geometryEngine.geodesicLength(geometry, 'meters')
  if (!Number.isFinite(length)) {
    length = geometryEngine.planarLength(geometry, 'meters')
  }
  if (!Number.isFinite(length)) return '0 m'
  if (length > 1000) {
    return `${Math.round((length / 1000) * 100) / 100} km`
  }
  return `${Math.round(length * 100) / 100} m`
}

const formatArea = (geometry) => {
  let area = geometryEngine.geodesicArea(geometry, 'square-meters')
  if (!Number.isFinite(area)) {
    area = geometryEngine.planarArea(geometry, 'square-meters')
  }
  if (!Number.isFinite(area)) return '0 m²'
  if (area > 10000) {
    return `${Math.round((area / 1000000) * 100) / 100} km²`
  }
  return `${Math.round(area * 100) / 100} m²`
}

const addMeasurementLabel = (geometry, text) => {
  if (!measureLayer || !geometry || !text) return
  let point = null

  if (geometry.type === 'polyline' && geometry.paths?.length) {
    const path = geometry.paths[geometry.paths.length - 1]
    const last = path?.[path.length - 1]
    if (last) {
      point = new Point({
        x: last[0],
        y: last[1],
        spatialReference: geometry.spatialReference
      })
    }
  } else if (geometry.type === 'polygon') {
    point = geometry.extent?.center || geometry.centroid || null
  }

  if (!point) return

  const labelGraphic = new Graphic({
    geometry: point,
    symbol: {
      type: 'text',
      text,
      color: '#000000',
      haloColor: '#ffffff',
      haloSize: 2,
      yoffset: -12,
      font: {
        size: 14,
        family: 'sans-serif',
        weight: 'bold'
      }
    }
  })
  measureLayer.add(labelGraphic)
}

const handleFileUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const geojson = JSON.parse(text)

    const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(blob)
    const layerId = `custom-layer-${Date.now()}`

    const layer = new GeoJSONLayer({
      id: layerId,
      title: file.name,
      url: objectUrl,
      outFields: ['*'],
      renderer: {
        type: 'simple',
        symbol: {
          type: 'simple-line',
          color: '#FF9800',
          width: 2
        }
      },
      visible: true
    })
    layer._objectUrl = objectUrl
    layer._zIndex = 50
    layer._interactive = true

    getMapManager()?.addLayer(layerId, layer)
    customLayers.value.push({
      id: layerId,
      name: file.name.replace('.geojson', '').replace('.json', ''),
      visible: true,
      layer
    })

    await layer.when()
    const extentResult = await layer.queryExtent()
    if (extentResult?.extent) {
      getMapManager()?.fitExtent(extentResult.extent, { padding: [50, 50, 50, 50] })
    }

    emit('layer-added', { name: file.name, layerId })
    showLayerUpload.value = false
    event.target.value = ''
  } catch (error) {
    alert(`文件解析失败: ${error.message}`)
  }
}

const toggleCustomLayer = (index) => {
  const layerItem = customLayers.value[index]
  if (!layerItem?.layer) return
  layerItem.visible = !layerItem.visible
  layerItem.layer.visible = layerItem.visible
}

const removeCustomLayer = (index) => {
  const layerItem = customLayers.value[index]
  if (!layerItem) return

  getMapManager()?.removeLayer(layerItem.id)
  if (layerItem.layer?._objectUrl) {
    URL.revokeObjectURL(layerItem.layer._objectUrl)
    layerItem.layer._objectUrl = null
  }
  customLayers.value.splice(index, 1)
}

const exportMapImage = async () => {
  const view = getMapManager()?.getView?.()
  if (!view) return

  try {
    await view.when()
    const screenshot = await view.takeScreenshot({
      format: 'png',
      quality: 1
    })
    const link = document.createElement('a')
    link.download = `greenway-map-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`
    link.href = screenshot.dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('[导出] 截图失败:', error)
    alert('导出失败：请确认后端服务正在运行（端口 3001）并重试。')
  }
}

const toggleBaseLayer = (layerId, visible) => {
  emit('layer-toggled', { layerId, visible })
}

const switchTheme = (theme) => {
  const manager = getMapManager()
  if (!manager) return
  currentTheme.value = theme
  setGlobalTheme(theme, true)
  manager.setBaseTheme(theme, true)
}

watch(globalTheme, (newTheme) => {
  const manager = getMapManager()
  if (manager && newTheme !== currentTheme.value) {
    currentTheme.value = newTheme
    manager.setBaseTheme(newTheme, false)
  }
})

watch(
  () => [drawStyles.point, drawStyles.line, drawStyles.polygon].map((item) => JSON.stringify(item)).join('|'),
  () => {
    if (!sketchViewModel || sketchMode !== 'draw') return
    sketchViewModel.pointSymbol = buildPointSymbol()
    sketchViewModel.polylineSymbol = buildLineSymbol()
    sketchViewModel.polygonSymbol = buildPolygonSymbol()
  }
)

const clearDrawings = () => {
  if (confirm('确定要清除所有绘制内容吗？')) {
    drawLayer?.removeAll()
    removeCurrentInteraction()
  }
}

const clearMeasurements = () => {
  if (confirm('确定要清除所有测量结果吗？')) {
    measureLayer?.removeAll()
    removeCurrentInteraction()
  }
}

onMounted(() => {
  initDrawLayer()
  initMeasureLayer()
  setupSketchViewModel()
  const manager = getMapManager()
  if (manager && globalTheme.value === 'night') {
    manager.setBaseTheme('night', false)
  }
})

onBeforeUnmount(() => {
  removeCurrentInteraction()
  sketchCreateHandle?.remove?.()
  sketchCreateHandle = null
  sketchViewModel?.destroy?.()
  sketchViewModel = null
})

defineExpose({
  activateDrawTool,
  activateMeasureTool,
  switchTheme,
  toggleBaseLayer,
  clearDrawings,
  clearMeasurements,
  toggleCustomLayer,
  removeCustomLayer,
  handleFileUpload,
  exportMapImage,
  filteredLayerConfig,
  customLayers,
  activeTool,
  currentTheme,
  showLayerUpload,
  drawStyles
})
</script>

<style scoped>
.map-toolbar-geoscene {
  width: 0;
  height: 0;
  overflow: hidden;
}
</style>
