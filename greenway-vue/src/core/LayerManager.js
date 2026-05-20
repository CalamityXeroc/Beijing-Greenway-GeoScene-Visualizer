/**
 * LayerManager - 图层管理器（GeoScene 实现）
 */

import WebTileLayer from '@geoscene/core/layers/WebTileLayer.js'
import GeoJSONLayer from '@geoscene/core/layers/GeoJSONLayer.js'
import GraphicsLayer from '@geoscene/core/layers/GraphicsLayer.js'
import { markRaw } from 'vue'

class LayerManager {
  constructor() {
    Object.defineProperty(this, 'baseLayers', { value: new Map(), writable: false, enumerable: false })
    Object.defineProperty(this, 'overlayLayers', { value: new Map(), writable: false, enumerable: false })
  }

  createGaodeLayer(style = 8, options = {}) {
    const useProxy = options.useProxy !== false
    const subDomains = ['1', '2', '3', '4']
    
    const layer = new WebTileLayer({
      id: 'gaode-base-layer',
      title: '高德底图',
      urlTemplate: useProxy
        ? `/api/tiles/gaode/${style}/{level}/{col}/{row}`
        : `https://webrd0{subDomain}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=${style}&x={col}&y={row}&z={level}`,
      subDomains: subDomains,
      visible: true,
      copyright: 'Gaode Maps'
    })

    layer._zIndex = 0
    layer._interactive = false
    layer._useProxy = useProxy
    return layer
  }

  _detectGeometryType(config = {}, data) {
    if (data?.features?.length) {
      const rawType = data.features[0]?.geometry?.type || ''
      if (rawType.includes('Point')) return 'point'
      if (rawType.includes('Polygon')) return 'polygon'
      return 'polyline'
    }

    if (config.fillColor) return 'polygon'
    if (config.pointColor || config.pointFillColor || config.pointRadius) return 'point'
    return 'polyline'
  }

  _createSimpleRenderer(config = {}, geometryType = 'polyline') {
    if (geometryType === 'point') {
      return {
        type: 'simple',
        symbol: {
          type: 'simple-marker',
          color: config.pointFillColor || config.pointColor || '#2196F3',
          size: Math.max((config.pointRadius || 6) * 2, 6),
          outline: {
            color: '#ffffff',
            width: 2
          }
        }
      }
    }

    if (geometryType === 'polygon') {
      return {
        type: 'simple',
        symbol: {
          type: 'simple-fill',
          color: config.fillColor || 'rgba(33, 150, 243, 0.1)',
          outline: {
            color: config.strokeColor || config.lineColor || '#2196F3',
            width: config.strokeWidth || config.lineWidth || 2
          }
        }
      }
    }

    return {
      type: 'simple',
      symbol: {
        type: 'simple-line',
        color: config.lineColor || config.strokeColor || '#2196F3',
        width: config.lineWidth || config.strokeWidth || 3,
        cap: 'round',
        join: 'round'
      }
    }
  }

  createStyleFunction(config = {}, data) {
    return this._createSimpleRenderer(config, this._detectGeometryType(config, data))
  }

  createVectorLayerFromGeoJSON(options = {}) {
    const {
      url,
      data,
      style = this.getDefaultStyle(),
      zIndex = 10,
      visible = true,
      interactive = true
    } = options

    let layerUrl = url
    if (!layerUrl && data) {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      layerUrl = URL.createObjectURL(blob)
    }

    const renderer = this.createStyleFunction(style, data)
    const layer = new GeoJSONLayer({
      url: layerUrl,
      renderer,
      visible,
      outFields: ['*']
    })

    if (!url && data) {
      layer._objectUrl = layerUrl
    }

    layer._zIndex = zIndex
    layer._interactive = interactive !== false
    return layer
  }

  createVectorLayerFromFeatures(_features, options = {}) {
    const { zIndex = 10, visible = true, interactive = true } = options
    const layer = new GraphicsLayer({
      visible,
      listMode: 'hide'
    })
    layer._zIndex = zIndex
    layer._interactive = interactive !== false
    return layer
  }

  getDefaultStyle(config = {}) {
    const {
      strokeColor = '#2196F3',
      strokeWidth = 3,
      fillColor = 'rgba(33, 150, 243, 0.1)',
      pointRadius = 6,
      pointFillColor = '#2196F3'
    } = config

    return {
      strokeColor,
      strokeWidth,
      fillColor,
      pointRadius,
      pointFillColor
    }
  }

  getHighlightStyle(color = '#FF9800') {
    return {
      lineColor: color,
      lineWidth: 5
    }
  }

  async loadGeoJSON(url) {
    try {
      const response = await fetch(url)
      return await response.json()
    } catch (error) {
      console.error('[LayerManager] 加载 GeoJSON 失败:', error)
      throw error
    }
  }
}

let instance = null

export function getLayerManager() {
  if (!instance) {
    instance = markRaw(new LayerManager())
  }
  return instance
}

export default LayerManager
