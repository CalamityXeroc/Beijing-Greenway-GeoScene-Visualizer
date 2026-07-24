<template>
  <div class="greenroad-page">
    <!-- 加载指示器 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>
    </div>
    
    <!-- 导航栏：sticky 吸顶，不参与页面滚动但始终可见 -->
    <div class="navbar-sticky">
      <TopNavbar :toolbarRef="toolbarRef" :layerConfig="layerConfig"
                :showPathPlanning="showPathPlanning"
                :showHeatmap="showHeatmap"
                :showFacilities="showFacilities"
                @toggle-path-planning="showPathPlanning = !showPathPlanning"
                @toggle-heatmap="toggleHeatmap($event)"
                @toggle-facilities="toggleFacilities($event)"/>
    </div>

    <!-- 地图容器：精确占满视口剩余高度，滚动后变为普通内容区 -->
    <div class="map-container">
      <MapViewer
        ref="mapViewer"
        :center="mapConfig.center"
        :zoom="mapConfig.zoom"
        :layers="layers"
        height="calc(100vh - 64px)"
        @map-ready="onMapReady"
        @feature-click="onFeatureClick"
        @feature-hover="onFeatureHover"
        @map-click="onMapClick"
      />
      <PathPlanning
        v-if="showPathPlanning && mapManager && mapViewer"
        :mapManager="mapManager"
        :layerManager="mapViewer.getLayerManager()"
        @close="showPathPlanning = false"
      />
    </div>

    <!-- MapToolbar 保持在 DOM 中维持交互逻辑，视觉上隐藏；图层控制通过顶部工具栏操作 -->
    <div style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;" aria-hidden="true">
      <MapToolbar
        v-if="mapManager"
        ref="toolbarRef"
        :mapManager="mapManager"
        :layerConfig="layerConfig"
        @tool-activated="onToolActivated"
        @layer-added="onLayerAdded"
        @layer-toggled="onLayerToggled"
      />
    </div>

    <!-- 信息卡片区域 -->
    <div class="info-section">
      <div class="info-cards">
        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-icon">
              <i class="fas fa-route"></i>
            </div>
            <h2 class="info-card-title">系统概览</h2>
          </div>
          <div class="info-card-content">
            <p>北京市绿道系统串联起山、水、林、田等生态空间，形成贯通全市的绿色廊道网络。</p>
            <div class="stats-list">
              <div class="stat-item">
                <div class="stat-value">1000+</div>
                <div class="stat-label">总长度(km)</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">16</div>
                <div class="stat-label">覆盖区域</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">300+</div>
                <div class="stat-label">景点连接</div>
              </div>
            </div>
          </div>
        </div>

        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-icon" style="background: linear-gradient(135deg, #673AB7, #3F51B5);">
              <i class="fas fa-tree"></i>
            </div>
            <h2 class="info-card-title">绿道特色</h2>
          </div>
          <div class="info-card-content">
            <p>北京绿道系统整合了城市绿色资源，打造"山、水、城、景、文"五位一体的休闲游憩网络。</p>
            <div class="features-list">
              <span class="feature-tag">
                <i class="fas fa-mountain"></i>
                山地景观
              </span>
              <span class="feature-tag">
                <i class="fas fa-water"></i>
                滨水空间
              </span>
              <span class="feature-tag">
                <i class="fas fa-city"></i>
                城市风貌
              </span>
              <span class="feature-tag">
                <i class="fas fa-landmark"></i>
                文化遗产
              </span>
              <span class="feature-tag">
                <i class="fas fa-bicycle"></i>
                运动健身
              </span>
              <span class="feature-tag">
                <i class="fas fa-leaf"></i>
                生态保护
              </span>
            </div>
          </div>
        </div>

        <div class="info-card">
          <div class="info-card-header">
            <div class="info-card-icon" style="background: linear-gradient(135deg, #FF9800, #FF5722);">
              <i class="fas fa-info-circle"></i>
            </div>
            <h2 class="info-card-title">使用指南</h2>
          </div>
          <div class="info-card-content">
            <p>探索北京绿道系统，点击地图上的路线可以查看详细信息：</p>
            <ul class="guide-list">
              <li class="guide-item">
                <i class="fas fa-mouse-pointer"></i>
                <span>点击绿道路线查看详情</span>
              </li>
              <li class="guide-item">
                <i class="fas fa-search-plus"></i>
                <span>使用鼠标滚轮缩放地图</span>
              </li>
              <li class="guide-item">
                <i class="fas fa-hand-paper"></i>
                <span>拖动地图浏览不同区域</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 悬浮提示框 (Tooltip) -->
    <div
      ref="tooltipRef"
      v-show="tooltip.visible"
      class="hover-tooltip"
    >
      <div class="tooltip-header">
        <i class="fas fa-route"></i>
        <strong>{{ tooltip.title }}</strong>
      </div>
      <div class="tooltip-body">
        <div class="tooltip-item" v-if="tooltip.data.length">
          <i class="fas fa-ruler"></i>
          <span>总长度：{{ tooltip.data.length }} km</span>
        </div>
        <div class="tooltip-item" v-if="tooltip.data.area">
          <i class="fas fa-map-marked-alt"></i>
          <span>覆盖区域：{{ tooltip.data.area }}</span>
        </div>
      </div>
      <div class="tooltip-footer">
        <small><i class="fas fa-mouse-pointer"></i> 点击查看详情</small>
      </div>
    </div>

    <!-- 弹窗 (点击后显示) -->
    <div v-show="popup.visible" class="popup" :style="popupStyle">
      <div class="popup-content">
        <div class="popup-header" @mousedown="startDrag">
          <h4>{{ popup.title }}</h4>
          <button class="popup-close" @click.stop="closePopup">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <p>{{ popup.content }}</p>
        <button @click="viewPopupDetail" class="popup-btn">
          <i class="fas fa-external-link-alt"></i> 查看详情
        </button>
        <button @click="openFlyover" class="popup-btn flyover-btn">
          🎬 3D 漫游
        </button>
      </div>
    </div>

    <!-- 3D 飞行漫游 -->
    <GreenwayFlyover
      :visible="showFlyover"
      :greenwayName="flyoverName"
      :greenwayColor="flyoverColor"
      @close="showFlyover = false"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, shallowRef, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import MapViewer from '@/components/MapViewer.vue'
import MapToolbar from '@/components/MapToolbarGeoScene.vue'
import TopNavbar from '@/components/TopNavbar.vue'
import PathPlanning from '@/components/PathPlanning.vue'
import GreenwayFlyover from '@/components/GreenwayFlyover.vue'
import { getRouteStore } from '@/stores/route.js'
import { recordGreenwayClick, fetchHeatmapData, fetchHeatmapPoints } from '@/services/heatmapApi.js'
import { useUserAuth } from '@/stores/userAuth.js'

const router = useRouter()
const { isLoggedIn, currentUser } = useUserAuth()
const toolbarRef = ref(null)
const isLoading = ref(true)

// 地图配置
const mapConfig = reactive({
  center: [116.4, 40.4],  // 向北移动视角，使北京区域下移显示
  zoom: 8.5  // 降低缩放级别，确保完整显示北京
})

// 图层配置
const layerConfig = ref([
  {
    id: 'beijing-boundary',
    name: '市界',
    type: 'geojson',
    url: '/数据/北京边界.geojson',
    visible: true,
    zIndex: 6,
    interactive: false, // 标记为不可交互
    style: {
      lineColor: '#1565C0', // 使用 lineColor 而不是 strokeColor
      lineWidth: 4          // 使用 lineWidth 而不是 strokeWidth
    }
  },
  {
    id: 'beijing-area',
    name: '北京市域',
    type: 'geojson',
    url: '/数据/北京面.geojson',
    visible: true,
    zIndex: 5,
    interactive: false, // 标记为不可交互
    style: {
      strokeColor: 'rgba(0,0,0,0)', // 透明描边
      strokeWidth: 0,
      fillColor: 'rgba(33, 150, 243, 0.15)'
    }
  },
  {
    id: 'wenyu-greenway',
    name: '温榆河绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E6%B8%A9%E6%A6%86%E6%B2%B3',
    visible: true,
    zIndex: 10,
    fitExtent: false,  // 不自动适配，使用我们设置的初始视图
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4  // 绿道线条
    },
    info: {
      name: '温榆河绿道',
      description: '沿温榆河而建的滨水型绿道，全长108公里',
      length: 108,
      area: '昌平、顺义、朝阳、通州'
    }
  },
  {
    id: 'huanerhuan-greenway',
    name: '环二环城市绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E7%8E%AF%E4%BA%8C%E7%8E%AF%E5%9F%8E%E5%B8%82%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '环二环城市绿道',
      description: '环绕二环路的城市型绿道，全长87公里',
      length: 87,
      area: '东城、西城、朝阳、海淀'
    }
  },
  {
    id: 'liangmahe-greenway',
    name: '亮马河绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E4%BA%AE%E9%A9%AC%E6%B2%B3%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '亮马河绿道',
      description: '朝阳区国际化滨水绿道，全长5.5公里',
      length: 5.5,
      area: '朝阳区'
    }
  },
  {
    id: 'changying-greenway',
    name: '常营半马绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E5%B8%B8%E8%90%A5%E5%8D%8A%E9%A9%AC%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '常营半马绿道',
      description: '专业半马赛道型绿道，全长21公里',
      length: 21,
      area: '朝阳区常营地区'
    }
  },
  {
    id: 'changping42-greenway',
    name: '昌平42绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E6%98%8C%E5%B9%B342%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '昌平42绿道',
      description: '山地型绿道，全长42公里',
      length: 42,
      area: '昌平区'
    }
  },
  {
    id: 'lidu-greenway',
    name: '丽都商圈绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E4%B8%BD%E9%83%BD%E5%95%86%E5%9C%88%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '丽都商圈绿道',
      description: '商圈绿化廊道，全长6.8公里',
      length: 6.8,
      area: '朝阳区丽都商圈'
    }
  },
  {
    id: 'beiyunhe-greenway',
    name: '北运河绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E5%8C%97%E8%BF%90%E6%B2%B3%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '北运河绿道',
      description: '运河文化滨水绿道，全长36公里',
      length: 36,
      area: '通州区北运河沿岸'
    }
  },
  {
    id: 'nansha-greenway',
    name: '南沙绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E5%8D%97%E6%B2%99%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '南沙绿道',
      description: '滨水生态绿道，全长15公里',
      length: 15,
      area: '昌平区南沙河沿岸'
    }
  },
  {
    id: 'aosen-greenway',
    name: '奥林匹克森林公园绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E5%A5%A5%E6%9E%97%E5%8C%B9%E5%85%8B%E6%A3%AE%E6%9E%97%E5%85%AC%E5%9B%AD%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '奥林匹克森林公园绿道',
      description: '奥运文化主题绿道，全长23公里',
      length: 23,
      area: '朝阳区奥森公园'
    }
  },
  {
    id: 'yingcheng-greenway',
    name: '营城建都绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E8%90%A5%E5%9F%8E%E5%BB%BA%E9%83%BD%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 20,
    fitExtent: false,
    defer: false,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '营城建都绿道',
      description: '历史文化古迹串联绿道，全长42公里',
      length: 42,
      area: '西城区、东城区'
    }
  },
  {
    id: 'sanshan-greenway',
    name: '三山五园绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E4%B8%89%E5%B1%B1%E4%BA%94%E5%9B%AD%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '三山五园绿道',
      description: '皇家园林文化展示绿道，连接颐和园、圆明园、清华、北大等文化胜地',
      length: 36.09,
      area: '海淀区'
    }
  },
  {
    id: 'chaoyang-greenway',
    name: '朝阳绿道',
    type: 'geojson',
    url: '/api/greenways?name=%E6%9C%9D%E9%98%B3%E7%BB%BF%E9%81%93',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#4CAF50',
      lineWidth: 4
    },
    info: {
      name: '朝阳绿道',
      description: '繁华都市中的绿色休闲长廊，汇聚商务、文化、艺术等多种元素',
      length: 18,
      area: '朝阳区'
    }
  },
  {
    id: 'beiyi-greenway',
    name: '北翼山水绿道',
    type: 'geojson',
    url: '/api/greenways?name=北翼山水绿道',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#29B6F6',
      lineWidth: 4
    },
    info: {
      name: '北翼山水绿道',
      description: '北京北部山区生态绿道',
      length: 38.6,
      area: '昌平区、怀柔区'
    }
  },
  {
    id: 'dongyi-greenway',
    name: '东翼大河绿道',
    type: 'geojson',
    url: '/api/greenways?name=东翼大河绿道',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#26C6DA',
      lineWidth: 4
    },
    info: {
      name: '东翼大河绿道',
      description: '东部河系生态廊道',
      length: 64.3,
      area: '通州区、顺义区'
    }
  },
  {
    id: 'jiaoye-greenway',
    name: '郊野休闲环绿道',
    type: 'geojson',
    url: '/api/greenways?name=郊野休闲环绿道',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#78C850',
      lineWidth: 4
    },
    info: {
      name: '郊野休闲环绿道',
      description: '连接郊野公园的休闲环线',
      length: 112.8,
      area: '多区环线'
    }
  },
  {
    id: 'nansha-greenway',
    name: '南沙绿道',
    type: 'geojson',
    url: '/api/greenways?name=南沙绿道',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#42A5F5',
      lineWidth: 4
    },
    info: {
      name: '南沙绿道',
      description: '南沙沿线滨水生态廊道',
      length: 35.2,
      area: '海淀区、昌平区'
    }
  },
  {
    id: 'xiyi-greenway',
    name: '西翼山水绿道',
    type: 'geojson',
    url: '/api/greenways?name=西翼山水绿道',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#7E57C2',
      lineWidth: 4
    },
    info: {
      name: '西翼山水绿道',
      description: '西部山水风景休闲绿道',
      length: 58.7,
      area: '门头沟区、石景山区'
    }
  },
  {
    id: 'zhongxincheng-greenway',
    name: '中心城滨水绿道',
    type: 'geojson',
    url: '/api/greenways?name=中心城滨水绿道',
    visible: true,
    zIndex: 10,
    fitExtent: false,
    defer: true,
    style: {
      lineColor: '#EF5350',
      lineWidth: 4
    },
    info: {
      name: '中心城滨水绿道',
      description: '中心城区滨水慢行走廊',
      length: 44.1,
      area: '中心城区'
    }
  }
])

const layerInfoCache = new Map()
const interactiveLayerIds = new Set()

const rebuildLayerCaches = () => {
  layerInfoCache.clear()
  interactiveLayerIds.clear()
  layerConfig.value.forEach(layer => {
    layerInfoCache.set(layer.id, layer)
    if (layer.info) {
      interactiveLayerIds.add(layer.id)
    }
  })
}

const pickInteractiveFeature = (featuresWithLayers = []) => {
  if (!featuresWithLayers) return null
  for (let i = 0; i < featuresWithLayers.length; i += 1) {
    const candidate = featuresWithLayers[i]
    if (candidate?.layerId && interactiveLayerIds.has(candidate.layerId)) {
      return candidate
    }
  }
  return null
}

rebuildLayerCaches()

watch(layerConfig, rebuildLayerCaches, { deep: true })

// 当前激活的图层 - 使用浅拷贝优化性能
const layers = computed(() => layerConfig.value.slice())

// 选中的绿道
const selectedGreenway = ref(null)

// 悬浮提示框状态 (Tooltip - 鼠标悬停时显示)
const tooltip = reactive({
  visible: false,
  title: '',
  data: {}
})

const tooltipRef = ref(null)
const tooltipPixel = { x: -9999, y: -9999 }
let tooltipMoveRaf = null

const scheduleTooltipPosition = (pixel) => {
  if (!pixel) return
  tooltipPixel.x = pixel[0] + 15
  tooltipPixel.y = pixel[1] + 15

  if (tooltipMoveRaf) return
  tooltipMoveRaf = requestAnimationFrame(() => {
    tooltipMoveRaf = null
    if (tooltipRef.value) {
      tooltipRef.value.style.transform = `translate3d(${tooltipPixel.x}px, ${tooltipPixel.y}px, 0)`
    }
  })
}

// 弹窗状态 (Popup - 点击后显示)
const popup = reactive({
  visible: false,
  title: '',
  content: '',
  data: null,
  position: { x: 0, y: 0 }
})

const popupStyle = computed(() => ({
  left: `${popup.position.x}px`,
  top: `${popup.position.y}px`
}))

// 弹窗拖动相关
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
let popupRafId = null

const startDrag = (event) => {
  isDragging.value = true
  const rect = event.currentTarget.getBoundingClientRect()
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  document.addEventListener('mousemove', onDrag, { passive: true })
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (event) => {
  if (!isDragging.value) return
  
  if (popupRafId) {
    cancelAnimationFrame(popupRafId)
  }
  
  popupRafId = requestAnimationFrame(() => {
    popup.position.x = event.clientX - dragOffset.value.x
    popup.position.y = event.clientY - dragOffset.value.y
  })
}

const stopDrag = () => {
  isDragging.value = false
  if (popupRafId) {
    cancelAnimationFrame(popupRafId)
    popupRafId = null
  }
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 热力图状态
const showHeatmap = ref(false)
const showFacilities = ref(false)
const facilitiesLayerId = 'greenway-facilities'

// POI 类型 → 颜色映射
const FACILITY_COLORS = {
  '150500': '#E53935', // 地铁站-红
  '150700': '#FB8C00', // 公交站-橙
  '150900': '#1E88E5', // 停车场-蓝
  '200300': '#43A047', // 卫生间-绿
  '060100': '#8E24AA', // 便利店-紫
  '080600': '#00ACC1', // 单车-青
}
const heatmapLayerId = 'greenway-heatmap'

const routeStore = getRouteStore()
const showPathPlanning = ref(false)

const mapViewer = ref(null)
const mapManager = shallowRef(null)

// 地图就绪
const onMapReady = (map) => {
  console.log('[GreenwayOverview] 地图已就绪')
  isLoading.value = false

  if (!map) {
    console.error('[GreenwayOverview] 地图初始化失败，map 为 null')
    return
  }

  // 获取 MapManager 实例
  if (mapViewer.value) {
    mapManager.value = markRaw(mapViewer.value.getMapManager())
    // 记录每个图层的默认渲染器，方便恢复
    layerConfig.value.forEach(layer => {
      const layerInstance = mapManager.value?.getLayer(layer.id)
      if (layerInstance && !layerDefaultRenderers.has(layer.id)) {
        layerDefaultRenderers.set(layer.id, layerInstance.renderer || null)
      }
    })
  }
}

// 路径规划地图点击 → 转发给 routeStore
const onMapClick = ({ coordinate }) => {
  if (!coordinate || !routeStore.state.activeInput) return
  routeStore.handleMapClick({ lng: coordinate[0], lat: coordinate[1] })
}

// 当前悬停的要素
const hoveredFeature = ref(null)
// 当前选中（点击）的图层
const selectedLayer = ref(null)
const selectedLayerId = ref(null)

// 3D 漫游状态
const showFlyover = ref(false)
const flyoverName = ref('')
const flyoverColor = ref('#4CAF50')

function openFlyover() {
  if (!popup.data?.info) return
  flyoverName.value = popup.data.info.name
  flyoverColor.value = popup.data.style?.lineColor || '#4CAF50'
  showFlyover.value = true
}

// 高亮渲染器缓存，避免重复创建
const highlightRendererCache = new Map()
const layerDefaultRenderers = new Map()

const getHighlightStyle = (color, width, isHover) => {
  const key = `${color}-${width}-${isHover}`
  
  if (!highlightRendererCache.has(key)) {
    highlightRendererCache.set(key, {
      type: 'simple',
      symbol: {
        type: 'simple-line',
        color,
        width,
        style: isHover ? 'short-dash' : 'solid',
        cap: 'round',
        join: 'round'
      }
    })
  }
  
  return highlightRendererCache.get(key)
}

// 高亮整个图层的所有要素 - 直接切换图层样式
const highlightLayer = (layerId, color, width, isHover = false) => {
  const mapViewerComponent = mapViewer.value
  if (!mapViewerComponent) return
  
  const mapManager = mapViewerComponent.getMapManager()
  if (!mapManager) return
  
  const layer = mapManager.getLayer(layerId)
  if (!layer) return

  if (!layerDefaultRenderers.has(layerId)) {
    layerDefaultRenderers.set(layerId, layer.renderer || null)
  }
  
  const highlightStyle = getHighlightStyle(color, width, isHover)
  if (layer.renderer !== highlightStyle) {
    layer.renderer = highlightStyle
  }
}

// 清除图层高亮 - 恢复默认样式
const clearLayerHighlight = (layerId) => {
  const mapViewerComponent = mapViewer.value
  if (!mapViewerComponent) return
  
  const mapManager = mapViewerComponent.getMapManager()
  if (!mapManager) return
  
  const layer = mapManager.getLayer(layerId)
  if (!layer) return

  const defaultRenderer = layerDefaultRenderers.get(layerId)
  if (defaultRenderer) {
    layer.renderer = defaultRenderer
  } else {
    layer.renderer = null
  }
}

// 要素点击
const onFeatureClick = ({ featuresWithLayers, pixel }) => {
  console.log('[GreenwayOverview] 点击事件:', { featuresWithLayers, pixel })

  const greenwayFeature = pickInteractiveFeature(featuresWithLayers)
  if (!greenwayFeature) {
    console.log('[GreenwayOverview] 未点击到绿道图层')
    return
  }

  console.log('[GreenwayOverview] 点击到绿道:', greenwayFeature)

  if (selectedLayerId.value && selectedLayerId.value !== greenwayFeature.layerId) {
    clearLayerHighlight(selectedLayerId.value)
  }

  highlightLayer(greenwayFeature.layerId, '#FF6B35', 5, false)
  selectedLayerId.value = greenwayFeature.layerId

  const layerInfo = layerInfoCache.get(greenwayFeature.layerId)
  if (layerInfo && layerInfo.info) {
    selectedGreenway.value = layerInfo.info
    tooltip.visible = false

    popup.title = layerInfo.info.name
    popup.content = layerInfo.info.description
    popup.data = layerInfo
    popup.position = { x: pixel[0], y: pixel[1] }
    popup.visible = true

    console.log('[GreenwayOverview] 显示弹窗:', popup)

    // 记录点击（热力图埋点）
    if (layerInfo.info?.name) {
      const userId = currentUser.value?.id
      recordGreenwayClick(layerInfo.info.name, userId)
    }
  }
}

// 要素悬停
let lastHoveredLayerId = null

const onFeatureHover = ({ featuresWithLayers, pixel }) => {
  const isLayerSelected = selectedLayerId.value !== null
  const greenwayFeature = pickInteractiveFeature(featuresWithLayers)

  if (greenwayFeature) {
    const layerInfo = layerInfoCache.get(greenwayFeature.layerId)

    if (layerInfo?.info && !popup.visible) {
      tooltip.title = layerInfo.info.name
      tooltip.data = {
        length: layerInfo.info.length,
        area: layerInfo.info.area,
        description: layerInfo.info.description
      }
      scheduleTooltipPosition(pixel)
      tooltip.visible = true
    }

    if (!isLayerSelected && greenwayFeature.layerId !== lastHoveredLayerId) {
      if (lastHoveredLayerId) {
        clearLayerHighlight(lastHoveredLayerId)
      }

      hoveredFeature.value = greenwayFeature.feature
      lastHoveredLayerId = greenwayFeature.layerId
      highlightLayer(greenwayFeature.layerId, '#FFD700', 6, true)
    }

    return
  }

  tooltip.visible = false

  if (!isLayerSelected && lastHoveredLayerId) {
    clearLayerHighlight(lastHoveredLayerId)
    hoveredFeature.value = null
    lastHoveredLayerId = null
  }
}

// 切换图层
const toggleLayer = (layerId, visible) => {
  const layer = layerConfig.value.find(l => l.id === layerId)
  if (layer) {
    layer.visible = visible

    // 通知地图组件更新
    if (mapViewer.value) {
      mapViewer.value.setLayerVisibility(layerId, visible)
    }
  }
}

// 热力图开关
const toggleHeatmap = async (visible) => {
  showHeatmap.value = visible

  if (!mapManager.value) return

  if (visible) {
    try {
      const data = await fetchHeatmapData()
      if (!data || data.length === 0) return

      const [FeatureLayer, Graphic, Point, HeatmapRenderer] = await Promise.all([
        import('@geoscene/core/layers/FeatureLayer.js').then(m => m.default || m),
        import('@geoscene/core/Graphic.js').then(m => m.default || m),
        import('@geoscene/core/geometry/Point.js').then(m => m.default || m),
        import('@geoscene/core/renderers/HeatmapRenderer.js').then(m => m.default || m)
      ])

      if (mapManager.value.getLayer(heatmapLayerId)) {
        mapManager.value.removeLayer(heatmapLayerId)
      }

      const maxHeat = Math.max(...data.map(d => d.heat_index), 1)

      const graphics = data
        .filter(item => item.center_lng && item.center_lat)
        .map((item, i) => new Graphic({
          geometry: new Point({
            longitude: item.center_lng,
            latitude: item.center_lat,
            spatialReference: { wkid: 4326 }
          }),
          attributes: {
            ObjectID: i + 1,
            greenway_name: item.greenway_name,
            heat_index: (item.heat_index / maxHeat) * 100
          }
        }))

      const layer = new FeatureLayer({
        id: heatmapLayerId,
        title: '绿道热度',
        source: graphics,
        objectIdField: 'ObjectID',
        fields: [
          { name: 'ObjectID', type: 'oid' },
          { name: 'greenway_name', type: 'string' },
          { name: 'heat_index', type: 'double' }
        ],
        spatialReference: { wkid: 4326 },
        renderer: new HeatmapRenderer({
          field: 'heat_index',
          colorStops: [
            { ratio: 0, color: 'rgba(0, 200, 0, 0)' },
            { ratio: 0.3, color: 'rgba(0, 200, 0, 0.7)' },
            { ratio: 0.5, color: 'rgba(255, 255, 0, 0.8)' },
            { ratio: 0.75, color: 'rgba(255, 140, 0, 0.9)' },
            { ratio: 1, color: 'rgba(255, 0, 0, 1)' }
          ],
          radius: 80,
          maxDensity: 0.01,
          minDensity: 0
        })
      })

      mapManager.value.addLayer(heatmapLayerId, layer)
    } catch (e) {
      console.error('[热力图] 创建图层失败:', e)
      showHeatmap.value = false
    }
  } else {
    if (mapManager.value.getLayer(heatmapLayerId)) {
      mapManager.value.removeLayer(heatmapLayerId)
    }
  }
}

const toggleFacilities = async (visible) => {
  showFacilities.value = visible

  if (!mapManager.value) return

  if (visible) {
    try {
      // 如果图层已存在，直接设置为可见
      const existing = mapManager.value.getLayer(facilitiesLayerId)
      if (existing) {
        existing.visible = true
        return
      }

      const [GraphicsLayer, Graphic, Point, SimpleMarkerSymbol] = await Promise.all([
        import('@geoscene/core/layers/GraphicsLayer.js').then(m => m.default || m),
        import('@geoscene/core/Graphic.js').then(m => m.default || m),
        import('@geoscene/core/geometry/Point.js').then(m => m.default || m),
        import('@geoscene/core/symbols/SimpleMarkerSymbol.js').then(m => m.default || m)
      ])

      const resp = await fetch(`/api/facilities/geojson`)
      const geojson = await resp.json()
      if (!geojson.features || geojson.features.length === 0) {
        showFacilities.value = false
        return
      }

      const graphics = geojson.features.map(f => {
        const p = f.properties
        const coords = f.geometry?.coordinates || []
        return new Graphic({
          geometry: new Point({ longitude: coords[0], latitude: coords[1], spatialReference: { wkid: 4326 } }),
          symbol: new SimpleMarkerSymbol({
            style: 'circle',
            color: FACILITY_COLORS[p.poi_type] || '#666',
            size: 8,
            outline: { color: '#fff', width: 1 }
          }),
          attributes: {
            name: p.name,
            poi_type: p.poi_type,
            type_name: p.type_name,
            distance_m: p.distance_m,
            greenway_id: p.greenway_id
          }
        })
      })

      const layer = new GraphicsLayer({
        id: facilitiesLayerId,
        title: '附近设施',
        graphics,
        visible: true,
        minScale: 150000, // 缩放到 1:150k 以内才显示，避免远处密密麻麻
        listMode: 'hide'
      })
      layer._zIndex = 250

      mapManager.value.addLayer(facilitiesLayerId, layer)
    } catch (e) {
      console.error('[设施图层] 创建失败:', e)
      showFacilities.value = false
    }
  } else {
    const layer = mapManager.value.getLayer(facilitiesLayerId)
    if (layer) {
      layer.visible = false
    }
  }
}

// 图层切换事件（来自工具栏）
const onLayerToggled = ({ layerId, visible }) => {
  const layer = layerConfig.value.find(l => l.id === layerId)
  if (layer) {
    layer.visible = visible
  } else {
    console.warn('GreenwayOverview: layer not found', layerId)
  }
}

// 关闭弹窗
const closePopup = () => {
  popup.visible = false
  
  // 清除选中图层的高亮
  if (selectedLayerId.value) {
    clearLayerHighlight(selectedLayerId.value)
    selectedLayerId.value = null
  }
}

// 查看详情
const viewDetail = () => {
  if (selectedLayerId.value === 'wenyu-greenway') {
    router.push('/wenyu')
  } else if (selectedLayerId.value === 'huanerhuan-greenway') {
    router.push('/huanerhuan')
  } else if (selectedLayerId.value === 'liangmahe-greenway') {
    router.push('/liangmahe')
  } else if (selectedLayerId.value === 'changying-greenway') {
    router.push('/changying')
  } else if (selectedLayerId.value === 'changping42-greenway') {
    router.push('/changping42')
  } else if (selectedLayerId.value === 'lidu-greenway') {
    router.push('/lidu')
  } else if (selectedLayerId.value === 'beiyunhe-greenway') {
    router.push('/beiyunhe')
  } else if (selectedLayerId.value === 'nansha-greenway') {
    router.push('/nansha')
  } else if (selectedLayerId.value === 'aosen-greenway') {
    router.push('/aosen')
  } else if (selectedLayerId.value === 'yingcheng-greenway') {
    router.push('/yingcheng')
  }
}

// 弹窗查看详情
const viewPopupDetail = () => {
  console.log('[GreenwayOverview] 🔍 弹窗查看详情按钮被点击')
  console.log('[GreenwayOverview] 📍 当前选中的图层ID:', selectedLayerId.value)
  console.log('[GreenwayOverview] 📦 popup数据:', popup)
  
  // ⚠️ 重要：必须在 closePopup() 之前保存图层ID，因为 closePopup() 会将其设为 null
  const targetLayerId = selectedLayerId.value
  
  console.log('[GreenwayOverview] 💾 保存的目标图层ID:', targetLayerId)
  
  closePopup()
  
  console.log('[GreenwayOverview] 🚀 准备导航，目标图层:', targetLayerId)
  
  if (targetLayerId === 'wenyu-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到温榆河绿道 /wenyu')
    router.push('/wenyu').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'huanerhuan-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到环二环绿道 /huanerhuan')
    router.push('/huanerhuan').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'liangmahe-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到亮马河绿道 /liangmahe')
    router.push('/liangmahe').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'changying-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到常营半马绿道 /changying')
    router.push('/changying').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'changping42-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到昌平42绿道 /changping42')
    router.push('/changping42').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'lidu-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到丽都商圈绿道 /lidu')
    router.push('/lidu').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'beiyunhe-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到北运河绿道 /beiyunhe')
    router.push('/beiyunhe').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'nansha-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到南沙绿道 /nansha')
    router.push('/nansha').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'aosen-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到奥林匹克森林公园绿道 /aosen')
    router.push('/aosen').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'yingcheng-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到营城建都绿道 /yingcheng')
    router.push('/yingcheng').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'sanshan-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到三山五园绿道 /sanshan')
    router.push('/sanshan').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'chaoyang-greenway') {
    console.log('[GreenwayOverview] ✅ 导航到朝阳绿道 /chaoyang')
    router.push('/chaoyang').then(() => {
      console.log('[GreenwayOverview] ✅ 导航成功')
    }).catch(err => {
      console.error('[GreenwayOverview] ❌ 导航失败:', err)
    })
  } else if (targetLayerId === 'beiyi-greenway') {
    router.push('/beiyi')
  } else if (targetLayerId === 'dongyi-greenway') {
    router.push('/dongyi')
  } else if (targetLayerId === 'jiaoye-greenway') {
    router.push('/jiaoye')
  } else if (targetLayerId === 'nansha-greenway') {
    router.push('/nansha')
  } else if (targetLayerId === 'xiyi-greenway') {
    router.push('/xiyi')
  } else if (targetLayerId === 'zhongxincheng-greenway') {
    router.push('/zhongxincheng')
  } else {
    console.warn('[GreenwayOverview] ⚠️ 未找到匹配的图层ID:', targetLayerId)
    console.warn('[GreenwayOverview] 📋 所有支持的图层:', [
      'wenyu-greenway', 'huanerhuan-greenway', 'liangmahe-greenway',
      'changying-greenway', 'changping42-greenway', 'lidu-greenway',
      'beiyunhe-greenway', 'nansha-greenway', 'aosen-greenway', 'yingcheng-greenway',
      'sanshan-greenway', 'chaoyang-greenway', 'beiyi-greenway', 'dongyi-greenway',
      'jiaoye-greenway', 'nansha-greenway', 'xiyi-greenway', 'zhongxincheng-greenway'
    ])
  }
}

// 工具栏事件处理
const onToolActivated = (data) => {
  console.log('[GreenwayOverview] 工具激活:', data)
}

const onLayerAdded = (layerInfo) => {
  console.log('[GreenwayOverview] 图层已添加:', layerInfo)
  rebuildLayerCaches()
}

onMounted(() => {
  console.log('[GreenwayOverview] 组件已挂载')
  if (tooltipRef.value) {
    tooltipRef.value.style.transform = 'translate3d(-9999px, -9999px, 0)'
  }
})

// 监听路由变化，在导航时显示加载指示器
watch(
  () => router.currentRoute.value.name,
  (newName) => {
    if (newName === 'Home') {
      // 路由到地图页时，重新显示加载指示器
      isLoading.value = true
    }
  }
)

onBeforeUnmount(() => {
  if (tooltipMoveRaf) {
    cancelAnimationFrame(tooltipMoveRaf)
    tooltipMoveRaf = null
  }
})
</script>

<style scoped>
.greenroad-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  /* 允许垂直滚动，信息区域在地图下方自然流动 */
}

/* 加载指示器 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.loading-spinner {
  text-align: center;
  color: white;
}

.spinner {
  width: 50px;
  height: 50px;
  margin: 0 auto 20px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-spinner p {
  font-size: 14px;
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
}

/* 导航栏粘性容器：吸顶显示 */
.navbar-sticky {
  position: sticky;
  top: 0;
  z-index: 3000;
}

/* 地图容器：精确占满视口扣除导航栏后的高度，不随页面滚动 */
.map-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 64px);
  overflow: hidden;
}

/* 弹窗样式 */
.popup {
  position: fixed;
  z-index: 1000;
  pointer-events: all;
  animation: popupSlideIn 0.3s ease-out;
}

@keyframes popupSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.popup-content {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 255, 248, 0.98));
  backdrop-filter: blur(8px);
  border-radius: 16px;
  padding: 0;
  box-shadow: 0 8px 32px rgba(76, 175, 80, 0.25);
  border: 2px solid rgba(76, 175, 80, 0.2);
  /* 硬件加速 */
  transform: translateZ(0);
  will-change: transform;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  min-width: 250px;
  max-width: 350px;
  position: relative;
  user-select: none;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 2px solid rgba(76, 175, 80, 0.1);
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(33, 150, 243, 0.05));
  border-radius: 14px 14px 0 0;
  cursor: move;
}

.popup-header h4 {
  margin: 0;
  color: #2E7D32;
  font-size: 1.1rem;
  font-weight: 600;
}

.popup-content > p {
  padding: 1rem 1.25rem;
  margin: 0;
  color: #558B2F;
  font-size: 0.95rem;
  line-height: 1.5;
  cursor: default;
}

.popup-close {
  position: relative;
  top: auto;
  right: auto;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: #558B2F;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.popup-close:hover {
  background: rgba(244, 67, 54, 0.1);
  color: #D32F2F;
  transform: rotate(90deg);
}

.popup-btn {
  width: calc(100% - 2.5rem);
  margin: 0 1.25rem 1.25rem 1.25rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, #4CAF50, #66BB6A);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.popup-btn:hover {
  background: linear-gradient(135deg, #388E3C, #4CAF50);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
}
.flyover-btn {
  background: linear-gradient(135deg, #1976D2, #2196F3);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
}
.flyover-btn:hover {
  background: linear-gradient(135deg, #1565C0, #1976D2);
  box-shadow: 0 6px 16px rgba(33, 150, 243, 0.4);
}

/* 信息卡片区域 */
.info-section {
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 0;
  margin: 0;
  backdrop-filter: blur(10px);
}

.info-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.info-card {
  background: rgba(255, 255, 255, 0.95);
  padding: 1.25rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(10px);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.info-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid rgba(52, 152, 219, 0.1);
}

.info-card-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4CAF50, #2196F3);
  border-radius: 12px;
  color: white;
  font-size: 1.3rem;
}

.info-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.info-card-content {
  color: #666;
  line-height: 1.6;
  font-size: 0.9rem;
}

.info-card-content p {
  margin: 0 0 0.75rem 0;
}

.stats-list {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.stat-item {
  background: rgba(52, 152, 219, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2196F3;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #666;
  font-weight: 500;
}

.features-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.feature-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(33, 150, 243, 0.1));
  border: 1px solid rgba(76, 175, 80, 0.2);
  border-radius: 20px;
  font-size: 0.8rem;
  color: #2E7D32;
  transition: all 0.3s ease;
}

.feature-tag:hover {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(33, 150, 243, 0.2));
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
}

.feature-tag i {
  color: #4CAF50;
}

.guide-list {
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0 0;
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 0;
  padding: 0.5rem;
  background: rgba(52, 152, 219, 0.05);
  border-radius: 6px;
  transition: all 0.3s ease;
}

.guide-item:hover {
  background: rgba(52, 152, 219, 0.1);
  transform: translateX(5px);
}

.guide-item:nth-child(1) {
  background: rgba(33, 150, 243, 0.05);
}

.guide-item:nth-child(1):hover {
  background: rgba(33, 150, 243, 0.1);
}

.guide-item:nth-child(2) {
  background: rgba(76, 175, 80, 0.05);
}

.guide-item:nth-child(2):hover {
  background: rgba(76, 175, 80, 0.1);
}

.guide-item:nth-child(3) {
  background: rgba(255, 152, 0, 0.05);
}

.guide-item:nth-child(3):hover {
  background: rgba(255, 152, 0, 0.1);
}

.guide-item i {
  font-size: 1.1rem;
  min-width: 1.5rem;
}

.guide-item:nth-child(1) i {
  color: #2196F3;
}

.guide-item:nth-child(2) i {
  color: #4CAF50;
}

.guide-item:nth-child(3) i {
  color: #FF9800;
}

/* 响应式 */
@media (max-width: 1200px) {
  .info-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  /* 移动端: TopNavbar 组件自行处理响应式 */
}

/* 悬停提示框 - 性能优化 */
.hover-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  padding: 0;
  min-width: 280px;
  max-width: 320px;
  backdrop-filter: blur(6px);
  border: 1px solid rgba(76, 175, 80, 0.2);
  overflow: hidden;
  animation: tooltipFadeIn 0.2s ease-out;
  /* 硬件加速 */
  transform: translate3d(-9999px, -9999px, 0);
  will-change: transform, opacity;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.tooltip-header {
  background: linear-gradient(135deg, #4CAF50, #66BB6A);
  color: white;
  padding: 0.875rem 1rem;
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
}

.tooltip-header i {
  font-size: 1.1rem;
}

.tooltip-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tooltip-item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  font-size: 0.875rem;
  color: #424242;
  line-height: 1.5;
}

.tooltip-item i {
  color: #4CAF50;
  font-size: 0.875rem;
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.tooltip-item strong {
  color: #2E7D32;
  font-weight: 600;
  margin-right: 0.25rem;
}

.tooltip-footer {
  background: rgba(76, 175, 80, 0.08);
  padding: 0.625rem 1rem;
  font-size: 0.75rem;
  color: #666;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border-top: 1px solid rgba(76, 175, 80, 0.1);
}

.tooltip-footer i {
  font-size: 0.875rem;
  color: #4CAF50;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .hover-tooltip {
    min-width: 240px;
    max-width: 280px;
  }
  
  .tooltip-header {
    font-size: 0.9rem;
    padding: 0.75rem 0.875rem;
  }
  
  .tooltip-body {
    padding: 0.875rem;
    gap: 0.625rem;
  }
  
  .tooltip-item {
    font-size: 0.8125rem;
  }
}

.title-container {
  background: transparent;
  padding: 0.8rem 2rem;
  text-align: center;
  pointer-events: auto;
  text-shadow: 0 1px 4px rgba(255, 255, 255, 0.9), 0 0 8px rgba(255, 255, 255, 0.8);
}

.title-container:hover {
  transform: translateY(-2px);
}

/* 夜间模式样式覆盖 */
[data-theme="night"] .greenroad-page {
  background: var(--bg-primary);
}

[data-theme="night"] .popup-content {
  background: var(--card-bg);
  border: 2px solid var(--card-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

[data-theme="night"] .popup-header {
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
}

[data-theme="night"] .popup-header h4 {
  color: var(--text-primary);
}

[data-theme="night"] .popup-content > p {
  color: var(--text-secondary);
}

[data-theme="night"] .popup-close {
  color: var(--text-secondary);
}

[data-theme="night"] .info-section {
  background: var(--bg-secondary);
}

[data-theme="night"] .info-card {
  background: var(--card-bg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

[data-theme="night"] .info-card-header {
  border-bottom: 2px solid var(--border-color);
}

[data-theme="night"] .info-card-title {
  color: var(--text-primary);
}

[data-theme="night"] .info-card-content {
  color: var(--text-secondary);
}

[data-theme="night"] .stat-item {
  background: var(--bg-tertiary);
}

[data-theme="night"] .stat-value {
  color: var(--theme-blue);
}

[data-theme="night"] .stat-label {
  color: var(--text-secondary);
}

[data-theme="night"] .feature-tag {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

[data-theme="night"] .feature-tag:hover {
  background: var(--bg-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

[data-theme="night"] .feature-tag i {
  color: var(--theme-green);
}

[data-theme="night"] .guide-item {
  background: var(--bg-tertiary);
}

[data-theme="night"] .guide-item:hover {
  background: var(--bg-secondary);
}

[data-theme="night"] .guide-item:nth-child(1) {
  background: var(--bg-tertiary);
}

[data-theme="night"] .guide-item:nth-child(1):hover {
  background: var(--bg-secondary);
}

[data-theme="night"] .guide-item:nth-child(2) {
  background: var(--bg-tertiary);
}

[data-theme="night"] .guide-item:nth-child(2):hover {
  background: var(--bg-secondary);
}

[data-theme="night"] .guide-item:nth-child(3) {
  background: var(--bg-tertiary);
}

[data-theme="night"] .guide-item:nth-child(3):hover {
  background: var(--bg-secondary);
}

[data-theme="night"] .hover-tooltip {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

[data-theme="night"] .tooltip-header {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-bottom: 2px solid var(--border-color);
}

[data-theme="night"] .tooltip-body {
  background: var(--card-bg);
}

[data-theme="night"] .tooltip-item {
  color: var(--text-secondary);
}

[data-theme="night"] .tooltip-item strong {
  color: var(--text-primary);
}

[data-theme="night"] .tooltip-footer {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
}
</style>

<!-- 全局主题样式 - 处理scoped样式中无法应用的全局选择器 -->
<style>
[data-theme="night"] .greenroad-page {
  background: var(--bg-primary) !important;
}

[data-theme="night"] .greenroad-page .popup-content {
  background: var(--card-bg) !important;
  border: 2px solid var(--card-border) !important;
}

[data-theme="night"] .greenroad-page .popup-header {
  background: var(--bg-secondary) !important;
  border-bottom: 2px solid var(--border-color) !important;
}

[data-theme="night"] .greenroad-page .popup-header h4 {
  color: var(--text-primary) !important;
}

[data-theme="night"] .greenroad-page .popup-content > p {
  color: var(--text-secondary) !important;
}

[data-theme="night"] .greenroad-page .info-section {
  background: var(--bg-secondary) !important;
}

[data-theme="night"] .greenroad-page .info-card {
  background: var(--card-bg) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
}

[data-theme="night"] .greenroad-page .info-card-title {
  color: var(--text-primary) !important;
}

[data-theme="night"] .greenroad-page .info-card-content {
  color: var(--text-secondary) !important;
}

[data-theme="night"] .greenroad-page .stat-item {
  background: var(--bg-tertiary) !important;
}

[data-theme="night"] .greenroad-page .stat-value {
  color: var(--theme-blue) !important;
}

[data-theme="night"] .greenroad-page .stat-label {
  color: var(--text-secondary) !important;
}

[data-theme="night"] .greenroad-page .feature-tag {
  background: var(--bg-tertiary) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-secondary) !important;
}

[data-theme="night"] .greenroad-page .guide-item {
  background: var(--bg-tertiary) !important;
}

[data-theme="night"] .greenroad-page .hover-tooltip {
  background: var(--card-bg) !important;
  border: 1px solid var(--card-border) !important;
}

[data-theme="night"] .greenroad-page .tooltip-header {
  background: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
}

[data-theme="night"] .greenroad-page .tooltip-item {
  color: var(--text-secondary) !important;
}

[data-theme="night"] .greenroad-page .tooltip-footer {
  background: var(--bg-secondary) !important;
  color: var(--text-secondary) !important;
}
</style>

