/**
 * LayerManager - 图层管理器（GeoScene 实现）
 */

import WebTileLayer from '@geoscene/core/layers/WebTileLayer.js'
import GeoJSONLayer from '@geoscene/core/layers/GeoJSONLayer.js'
import GraphicsLayer from '@geoscene/core/layers/GraphicsLayer.js'
import MapImageLayer from '@geoscene/core/layers/MapImageLayer.js'
import FeatureLayer from '@geoscene/core/layers/FeatureLayer.js'
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
        ? `${window.location.origin}/api/tiles/gaode/${style}/{level}/{col}/{row}`
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
    // 按属性分类着色（如功能分区图层）
    if (config.uniqueField && config.valueColorMap) {
      return this._createUniqueValueRenderer(config, this._detectGeometryType(config, data))
    }
    return this._createSimpleRenderer(config, this._detectGeometryType(config, data))
  }

  /** 按属性字段分类着色（unique-value renderer，支持点/线/面） */
  _createUniqueValueRenderer(config = {}, geometryType = 'polyline') {
    const hexToRgba = (hex, alpha = 1) => {
      if (!hex || !hex.startsWith('#')) return hex
      const h = hex.replace('#', '')
      const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
      const r = parseInt(full.slice(0, 2), 16)
      const g = parseInt(full.slice(2, 4), 16)
      const b = parseInt(full.slice(4, 6), 16)
      return `rgba(${r},${g},${b},${alpha})`
    }
    const makeSymbol = (color) => {
      if (geometryType === 'point') {
        return {
          type: 'simple-marker',
          color,
          size: Math.max((config.pointRadius || 4) * 2, 5),
          outline: { color: config.pointOutlineColor || '#ffffff', width: config.pointOutlineWidth ?? 1 }
        }
      }
      if (geometryType === 'polygon') {
        return {
          type: 'simple-fill',
          color: hexToRgba(color, config.polygonOpacity ?? 0.35),
          outline: { color: '#ffffff', width: 1 }
        }
      }
      return {
        type: 'simple-line',
        color,
        width: config.lineWidth || 3,
        cap: 'round',
        join: 'round'
      }
    }
    const uniqueValueInfos = Object.entries(config.valueColorMap || {}).map(([value, color]) => ({
      value,
      symbol: makeSymbol(color)
    }))
    return {
      type: 'unique-value',
      field: config.uniqueField,
      uniqueValueInfos,
      defaultSymbol: makeSymbol('#9E9E9E')
    }
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

  /**
   * 创建 GeoScene 服务图层（MapImageLayer，服务端渲染）
   * 用于叠加展示 GeoScene Server 发布的地图服务（竞赛演示：国产平台服务被真实调用）
   */
  createMapImageLayer(url, options = {}) {
    const {
      zIndex = 100,
      visible = true,
      opacity = 0.8,
      title = 'GeoScene 服务',
      interactive = true
    } = options
    const layer = new MapImageLayer({
      url,
      visible,
      opacity,
      title
    })
    layer._zIndex = zIndex
    layer._interactive = interactive !== false
    return layer
  }

  /**
   * 创建 GeoScene 要素服务图层（FeatureLayer，客户端渲染 + 自定义符号化）
   * 与前端现有 UI/UX 完全一致：unique-value renderer 按字段分类着色
   */
  createFeatureLayerFromService(url, options = {}) {
    const {
      zIndex = 100,
      visible = true,
      opacity = 1,
      title = 'GeoScene 服务',
      geometryType = 'polyline',
      uniqueField = null,
      valueColorMap = null,
      lineWidth = 3,
      pointRadius = 6,
      pointOutlineColor = '#ffffff',
      polygonOpacity = 0.35
    } = options

    const layer = new FeatureLayer({
      url,
      visible,
      opacity,
      title,
      outFields: ['*']
    })

    if (uniqueField && valueColorMap) {
      layer.renderer = this._createUniqueValueRenderer(
        {
          uniqueField,
          valueColorMap,
          lineWidth,
          pointRadius,
          pointOutlineColor,
          polygonOpacity
        },
        geometryType
      )
    }

    layer._zIndex = zIndex
    layer._interactive = true
    return layer
  }

  getDefaultStyle(config = {}) {
    const {
      strokeColor = '#2196F3',
      strokeWidth = 2,
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
