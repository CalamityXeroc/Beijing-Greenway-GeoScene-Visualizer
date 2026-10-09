/**
 * MapManager - 地图核心管理器（GeoScene 实现）
 */

import GeoSceneMap from '@geoscene/core/Map.js'
import MapView from '@geoscene/core/views/MapView.js'
import SceneView from '@geoscene/core/views/SceneView.js'
import Camera from '@geoscene/core/Camera.js'
import Extent from '@geoscene/core/geometry/Extent.js'
import Point from '@geoscene/core/geometry/Point.js'
import * as webMercatorUtils from '@geoscene/core/geometry/support/webMercatorUtils.js'
import { toRaw } from 'vue'

class MapManager {
  constructor() {
    this._mapInstance = null
    this._viewInstance = null
    this._layersMap = new Map()
    this._controlsMap = new Map()
    this._interactionsMap = new Map()
    this._eventHandles = new Map()
    this._mapContainer = null
    this._mode = '2d'  // '2d' | '3d'
  }

  init(target, options = {}) {
    const defaultOptions = {
      center: [116.5, 40],
      zoom: 10,
      minZoom: 3,
      maxZoom: 19
    }

    const config = { ...defaultOptions, ...options }
    this._mode = config.mode || '2d'

    const hour3d = new Date().getHours()
    let groundColor3d = '#333333'
    if (hour3d >= 19 || hour3d < 5)        groundColor3d = '#0a0a14'
    else if (hour3d >= 5 && hour3d < 7)    groundColor3d = '#1a1a2e'
    else if (hour3d >= 17 && hour3d < 19)  groundColor3d = '#1a2018'

    this._mapInstance = new GeoSceneMap({
      layers: [],
      ground: this._mode === '3d' ? { surfaceColor: groundColor3d } : undefined
    })

    if (this._mode === '3d') {
      // 根据时间计算天空颜色（清晨/白天/黄昏/夜晚）
      const hour = new Date().getHours()
      let skyColor
      if (hour >= 5 && hour < 7)        { skyColor = [30, 25, 40, 1] }      // 清晨深蓝紫
      else if (hour >= 7 && hour < 9)   { skyColor = [60, 70, 100, 1] }      // 早晨浅蓝
      else if (hour >= 9 && hour < 17)  { skyColor = [70, 120, 180, 1] }    // 白天天蓝
      else if (hour >= 17 && hour < 19) { skyColor = [100, 60, 40, 1] }     // 黄昏暖橙
      else if (hour >= 19 && hour < 20) { skyColor = [40, 30, 60, 1] }      // 傍晚紫蓝
      else                              { skyColor = [8, 8, 20, 1] }         // 夜晚深蓝

      this._viewInstance = new SceneView({
        container: target,
        map: this._mapInstance,
        camera: {
          position: [config.center[0], config.center[1], 500],
          heading: 0,
          tilt: 60
        },
        constraints: {
          altitude: { min: 50, max: 20000 },
          clipDistance: { near: 1, far: 100000 }
        },
        ui: {
          components: config.controls === false ? [] : ['zoom', 'navigation-toggle']
        },
        viewingMode: 'global',
        qualityProfile: 'high',
        environment: {
          starsEnabled: hour >= 19 || hour < 5,
          atmosphereEnabled: true,
          atmosphere: { quality: 'high' },
          lighting: {
            type: 'virtual',
            directShadowsEnabled: false,
            ambientOcclusionEnabled: false,
            waterReflectionEnabled: false
          }
        },
        background: { color: skyColor },
        alphaCompositingEnabled: true,
      })
      console.log('[MapManager] 3D SceneView 初始化完成')
    } else {
      this._viewInstance = new MapView({
        container: target,
        map: this._mapInstance,
        center: config.center,
        zoom: config.zoom,
        constraints: {
          minZoom: config.minZoom,
          maxZoom: config.maxZoom,
          rotationEnabled: false
        },
        ui: {
          components: config.controls === false ? [] : ['zoom', 'attribution']
        }
      })
      console.log('[MapManager] 2D MapView 初始化完成')
    }

    if (config.interactive === false) {
      this._disableInteractions()
    }

    return this._mapInstance
  }

  _disableInteractions() {
    if (!this._viewInstance?.navigation) return
    this._viewInstance.navigation.mouseWheelZoomEnabled = false
    this._viewInstance.navigation.browserTouchPanEnabled = false
    this._viewInstance.navigation.momentumEnabled = false
  }

  _ensureEventBucket(type) {
    if (!this._eventHandles.has(type)) {
      this._eventHandles.set(type, new Map())
    }
    return this._eventHandles.get(type)
  }

  _reorderLayersByZIndex() {
    const mapInstance = toRaw(this._mapInstance)
    if (!mapInstance) return
    const ordered = [...this._layersMap.entries()]
      .map(([id, layer]) => ({
        id,
        layer,
        z: Number.isFinite(layer?._zIndex) ? layer._zIndex : 10
      }))
      .sort((a, b) => a.z - b.z)

    ordered.forEach((item, idx) => {
      mapInstance.reorder(toRaw(item.layer), idx)
    })
  }

  getMap() {
    return toRaw(this._mapInstance)
  }

  getView() {
    return toRaw(this._viewInstance)
  }

  addLayer(id, layer) {
    const mapInstance = toRaw(this._mapInstance)
    const rawLayer = toRaw(layer)
    if (!rawLayer || !mapInstance) return

    if (this._layersMap.has(id)) {
      console.warn(`[MapManager] 图层 ${id} 已存在`)
      return
    }

    rawLayer.id = rawLayer.id || id
    rawLayer._layerId = id
    rawLayer._zIndex = Number.isFinite(rawLayer._zIndex) ? rawLayer._zIndex : 10

    this._layersMap.set(id, rawLayer)
    mapInstance.add(rawLayer)
    this._reorderLayersByZIndex()
    console.log(`[MapManager] 添加图层: ${id}`)
  }

  removeLayer(id) {
    const mapInstance = toRaw(this._mapInstance)
    const layer = toRaw(this._layersMap.get(id))
    if (!layer || !mapInstance) return

    mapInstance.remove(layer)
    if (layer._objectUrl) {
      URL.revokeObjectURL(layer._objectUrl)
      layer._objectUrl = null
    }
    this._layersMap.delete(id)
    console.log(`[MapManager] 移除图层: ${id}`)
  }

  setLayerVisibility(id, visible) {
    const layer = toRaw(this._layersMap.get(id))
    if (layer) {
      layer.visible = visible
    }
  }

  setLayerZIndex(id, zIndex) {
    const layer = toRaw(this._layersMap.get(id))
    if (!layer) return
    layer._zIndex = zIndex
    this._reorderLayersByZIndex()
  }

  getLayer(id) {
    return toRaw(this._layersMap.get(id))
  }

  toLonLat(point) {
    if (!point) return null
    if (point.spatialReference?.isWGS84) {
      return [point.longitude, point.latitude]
    }

    if (point.spatialReference?.isWebMercator) {
      const p = webMercatorUtils.webMercatorToGeographic(point)
      return [p.longitude, p.latitude]
    }

    return [point.x, point.y]
  }

  getCenter() {
    return this.toLonLat(this._viewInstance?.center)
  }

  setCenter(lonLat, zoom) {
    if (!this._viewInstance) return

    const target = {
      center: lonLat
    }

    if (zoom !== undefined) {
      target.zoom = zoom
    }

    this._viewInstance.goTo(target, { duration: 0 }).catch((error) => {
      console.warn('[MapManager] 设置中心点失败', error)
    })
  }

  fitExtent(extent, options = {}) {
    if (!this._viewInstance || !extent) return

    const defaultOptions = {
      padding: [50, 50, 50, 50],
      duration: 500,
      maxZoom: 16
    }
    const config = { ...defaultOptions, ...options }

    let targetExtent = extent
    if (Array.isArray(extent) && extent.length === 4) {
      targetExtent = new Extent({
        xmin: extent[0],
        ymin: extent[1],
        xmax: extent[2],
        ymax: extent[3],
        spatialReference: { wkid: 3857 }
      })
    }

    if (!targetExtent?.xmin && targetExtent?.x !== undefined && targetExtent?.y !== undefined) {
      const point = targetExtent.spatialReference
        ? targetExtent
        : new Point({ x: targetExtent.x, y: targetExtent.y, spatialReference: { wkid: 4326 } })
      this._viewInstance.goTo({ target: point, zoom: config.maxZoom }, { duration: config.duration }).catch(() => {})
      return
    }

    this._viewInstance
      .goTo(
        {
          target: targetExtent
        },
        {
          duration: config.duration,
          padding: config.padding,
          maxZoom: config.maxZoom
        }
      )
      .catch((error) => {
        console.warn('[MapManager] 适配范围失败', error)
      })
  }

  on(type, handler) {
    const viewInstance = toRaw(this._viewInstance)
    if (!viewInstance || typeof handler !== 'function') return null
    const handle = viewInstance.on(type, handler)
    const bucket = this._ensureEventBucket(type)
    bucket.set(handler, handle)
    return handle
  }

  un(type, handler) {
    const bucket = this._eventHandles.get(type)
    if (!bucket) return
    const handle = bucket.get(handler)
    if (handle) {
      handle.remove()
      bucket.delete(handler)
    }
  }

  destroy() {
    const viewInstance = toRaw(this._viewInstance)
    if (viewInstance) {
      // 先清理容器中的 canvas（防止残留 DOM）
      try {
        const container = viewInstance.container
        if (container) {
          const canvases = container.querySelectorAll('canvas')
          canvases.forEach(c => {
            // 主动释放 WebGL 上下文（不等 GC），避免多地困累积触发
            // 浏览器 "Too many active WebGL contexts" 而将地图上下文丢弃
            try {
              const gl = c.getContext('webgl2') || c.getContext('webgl')
              gl?.getExtension('WEBGL_lose_context')?.loseContext()
            } catch (_) { /* 忽略 */ }
            c.remove()
          })
        }
      } catch (_) { /* 容器可能已被移除 */ }

      try {
        viewInstance.destroy()
      } catch (e) {
        console.warn('[MapManager] 视图销毁时出错:', e.message)
      }
    }

    this._eventHandles.forEach((bucket) => {
      bucket.forEach((handle) => handle?.remove?.())
      bucket.clear()
    })
    this._eventHandles.clear()

    this._layersMap.forEach((layer) => {
      if (layer?._objectUrl) {
        URL.revokeObjectURL(layer._objectUrl)
        layer._objectUrl = null
      }
    })

    this._layersMap.clear()
    this._controlsMap.clear()
    this._interactionsMap.clear()

    this._viewInstance = null
    this._mapInstance = null

    console.log('[MapManager] 地图已销毁')
  }

  setMapContainer(container) {
    this._mapContainer = container
    console.log('[MapManager] 地图容器已设置')
  }

  setBaseTheme(mode) {
    const isNight = mode === 'night'

    if (this._mapContainer) {
      if (isNight) {
        this._mapContainer.classList.add('night-mode')
        console.log('[MapManager] 🌙 已应用夜间滤镜')
      } else {
        this._mapContainer.classList.remove('night-mode')
        console.log('[MapManager] ☀️ 已移除夜间滤镜')
      }
    }
  }

  // ===== 3D 相机方法 =====

  setCamera(position, heading = 0, tilt = 60, altitude = 200) {
    const view = toRaw(this._viewInstance)
    if (!view || this._mode !== '3d') return

    const camera = new Camera({
      position: [position[0], position[1], altitude],
      heading,
      tilt,
      fov: 55
    })
    view.goTo(camera, { duration: 0 }).catch(() => {})
  }

  getCamera() {
    if (this._mode !== '3d' || !this._viewInstance) return null
    const c = this._viewInstance.camera
    return {
      position: [c.position.x, c.position.y, c.position.z],
      heading: c.heading,
      tilt: c.tilt,
      fov: c.fov
    }
  }

  flyTo(position, heading = 0, tilt = 60, altitude = 200, duration = 3000) {
    const view = toRaw(this._viewInstance)
    if (!view || this._mode !== '3d') return Promise.resolve()

    const camera = new Camera({
      position: [position[0], position[1], altitude],
      heading,
      tilt,
      fov: 55
    })
    return view.goTo(camera, {
      animate: true,
      duration,
      easing: 'ease-in-out'
    })
  }

  is3D() {
    return this._mode === '3d'
  }
}

let instance = null

export function getMapManager() {
  if (!instance) {
    instance = new MapManager()
    console.log('[MapManager] 创建新的单例实例')
  }
  return instance
}

export default MapManager
