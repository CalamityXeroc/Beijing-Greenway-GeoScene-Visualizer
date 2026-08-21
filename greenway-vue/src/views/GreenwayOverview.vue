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
                :showRecommend="showRecommend"
                :showBeijing="showBeijing"
                :showGreenways="showGreenways"
                :showFunctionLayer="showFunctionLayer"
                :facilityTypeFilters="facilityTypeFilters"
                @toggle-path-planning="showPathPlanning = !showPathPlanning"
                @toggle-recommend="showRecommend = !showRecommend"
                @toggle-accessibility="showAccessibility = !showAccessibility"
                :showAccessibility="showAccessibility"
                @toggle-assess="showAssess = !showAssess"
                :showAssess="showAssess"
                @toggle-compare="showCompare = !showCompare"
                :showCompare="showCompare"
                @toggle-heatmap="toggleHeatmap($event)"
                @toggle-facilities="toggleFacilities($event)"
                @toggle-beijing="toggleBeijing($event)"
                @toggle-greenways="toggleGreenways($event)"
                @toggle-function-layer="toggleFunctionLayer($event)"
                @toggle-facility-type="(code, checked) => toggleFacilityType(code, checked)">
        <template #search>
          <PoiSearchBar @select="onPoiSearchSelect" />
        </template>
      </TopNavbar>
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
        @zoom-changed="onZoomChanged"
      />
      <!-- 图层说明卡堆叠容器：各图层开关独立，卡片互不影响 -->
      <div class="flc-stack">
        <!-- 绿道功能区划说明卡 -->
        <div v-if="showFunctionLayer && showFunctionCard" class="function-legend-card">
          <div class="flc-header">
            <span class="flc-badge"><i class="fas fa-tree"></i></span>
            <div class="flc-head-text">
              <span class="flc-title">绿道功能区划</span>
              <span class="flc-subtitle">BEIJING GREENWAY</span>
            </div>
            <button class="flc-close" title="关闭" @click="showFunctionCard = false">×</button>
          </div>
          <div class="flc-body">
            <p class="flc-desc">六边形色块显示北京各区域绿道的主导类型，帮您快速了解身边的绿道特色</p>
            <div class="flc-legend">
              <span class="flc-item"><i class="flc-dot" style="background:#66BB6A"></i>生态绿道</span>
              <span class="flc-item"><i class="flc-dot" style="background:#4FC3F7"></i>风景绿道</span>
              <span class="flc-item"><i class="flc-dot" style="background:#D7A97E"></i>历史文化绿道</span>
              <span class="flc-item"><i class="flc-dot" style="background:#90A4AE"></i>城市绿道</span>
            </div>
            <p class="flc-tip">💡 想亲近自然找<span class="flc-hl flc-hl-eco">绿色</span>区域，喜欢人文古迹找<span class="flc-hl flc-hl-his">棕色</span>区域；放大地图可查看更精细的分区</p>
            <button v-if="!showFunctionMore" class="flc-more" @click="showFunctionMore = true">了解更多 <i class="fas fa-chevron-down"></i></button>
            <div v-else class="flc-more-detail">
              <p style="margin:0 0 4px">• 色块颜色代表该区域绿道的主要类型（智能分析全北京绿道环境得出）</p>
              <p style="margin:0 0 4px">• 区域颜色与地图上的绿道线颜色相互对应，方便辨认</p>
              <p style="margin:0">• 六边形越小代表查看的越精细，放大后能看到更细的划分</p>
            </div>
            <p class="flc-src"><i class="fas fa-database"></i> 数据来源：深度学习智能评价</p>
          </div>
        </div>

        <!-- 绿道热度说明卡 -->
        <div v-if="showHeatmap && showHeatmapCard" class="function-legend-card">
          <div class="flc-header">
            <span class="flc-badge flc-badge-hot"><i class="fas fa-fire"></i></span>
            <div class="flc-head-text">
              <span class="flc-title">绿道热度</span>
              <span class="flc-subtitle">POPULARITY</span>
            </div>
            <button class="flc-close" title="关闭" @click="showHeatmapCard = false">×</button>
          </div>
          <div class="flc-body">
            <p class="flc-desc">热力色显示北京各绿道的人气程度，帮您发现大家都爱去的绿道</p>
            <div class="flc-legend flc-legend-heat">
              <span class="legend-label">低</span>
              <span class="legend-gradient"></span>
              <span class="legend-label">高</span>
            </div>
            <p class="flc-tip">💡 人气高的绿道（红橙色区域）通常风景好、设施完善，第一次体验绿道可以从热门开始</p>
            <p class="flc-src"><i class="fas fa-database"></i> 数据来源：平台用户访问热度统计</p>
          </div>
        </div>
      </div>

      <!-- 附近设施说明卡（独立定位右下角，避免与左下堆叠卡重叠） -->
      <div v-if="showFacilities && showFacilitiesCard" class="function-legend-card function-legend-card--poi">
        <div class="flc-header">
          <span class="flc-badge flc-badge-poi"><i class="fas fa-map-pin"></i></span>
          <div class="flc-head-text">
            <span class="flc-title">附近设施</span>
            <span class="flc-subtitle">FACILITIES</span>
          </div>
          <button class="flc-close" title="关闭" @click="showFacilitiesCard = false">×</button>
        </div>
        <div class="flc-body">
          <p class="flc-desc">显示绿道周边 1 公里内的便民设施，出行更省心</p>
          <div class="flc-legend">
            <span class="flc-item"><i class="flc-dot" style="background:#1565C0"></i>🚇 地铁站</span>
            <span class="flc-item"><i class="flc-dot" style="background:#0277BD"></i>🚌 公交站</span>
            <span class="flc-item"><i class="flc-dot" style="background:#2E7D32"></i>🅿 停车场</span>
            <span class="flc-item"><i class="flc-dot" style="background:#4E342E"></i>🚻 卫生间</span>
            <span class="flc-item"><i class="flc-dot" style="background:#C62828"></i>🏪 便利店</span>
            <span class="flc-item"><i class="flc-dot" style="background:#6A1B9A"></i>🎬 影剧院</span>
            <span class="flc-item"><i class="flc-dot" style="background:#E65100"></i>🏛 景点</span>
          </div>
          <p class="flc-tip">💡 出门前先看看绿道附近的地铁站和停车场，规划好路线再出发</p>
          <p class="flc-src"><i class="fas fa-database"></i> 数据来源：平台设施数据库</p>
        </div>
      </div>
      <PathPlanning
        v-if="showPathPlanning && mapManager && mapViewer"
        :mapManager="mapManager"
        :layerManager="mapViewer.getLayerManager()"
        @close="showPathPlanning = false"
      />
      <RecommendPanel
        v-if="showRecommend"
        @close="showRecommend = false"
        @locate-greenway="locateRecommendGreenway"
        @go-route="goRecommendRoute"
      />
      <AssessPanel
        v-if="showAssess"
        @close="showAssess = false"
        @locate-greenway="locateRecommendGreenway"
        @go-route="goRecommendRoute"
      />
      <GreenwayComparePanel
        v-if="showCompare"
        @close="onCompareClose"
        @locate-greenway="locateRecommendGreenway"
        @go-route="goRecommendRoute"
        @compare-change="onCompareChange"
      />
      <AccessibilityPanel
        v-if="showAccessibility"
        ref="accessibilityPanelRef"
        @close="closeAccessibility"
        @pick-origin="(v) => pickingAccessibilityOrigin = v"
        @hull-change="renderAccessibilityHull"
        @origin-set="onAccessOriginSet"
        @locate-greenway="locateRecommendGreenway"
        @go-route="goRecommendRoute"
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
        @spatial-analysis-complete="onSpatialAnalysisComplete"
        @spatial-analysis-clear="onSpatialAnalysisClear"
      />
    </div>

    <!-- 空间分析结果面板 -->
    <SpatialAnalysisPanel
      v-if="spatialResult"
      :result="spatialResult"
      @close="closeSpatialPanel"
      @locate-poi="locateSpatialPoi"
      @locate-greenway="locateSpatialGreenway"
    />

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
            <p>绿脉伴侣整合了城市绿色资源，以深度学习画像识别每条绿道的生态、风景、历史与城市功能，打造"山、水、城、景、文"五位一体的休闲游憩网络。</p>
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
            <p>探索绿脉伴侣，点击地图上的路线可以查看详细信息：</p>
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

    <!-- 弹窗：绿道信息 (点击后显示) -->
    <div v-show="popup.visible && !popup.isPoi" class="popup" :style="popupStyle">
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

    <!-- 弹窗：POI 设施信息 -->
    <div v-show="popup.visible && popup.isPoi" class="popup popup--poi" :style="popupStyle">
      <div class="popup-content">
        <div class="popup-header" @mousedown="startDrag">
          <h4>
            <img v-if="popup.poiSvg" :src="popup.poiSvg" alt="" style="width:22px;height:22px;vertical-align:middle;margin-right:4px" />
            {{ popup.poiName || '' }}
          </h4>
          <button class="popup-close" @click.stop="closePopup">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <p>
          <span class="poi-type-tag">{{ popup.poiTypeName || '' }}</span>
          <span v-if="popup.poiAddress" style="color:#999;font-size:0.85rem">{{ popup.poiAddress }}</span>
        </p>
        <p v-if="popup.poiGreenway" style="color:#558B2F;font-size:0.9rem">
          <i class="fas fa-tree"></i> 所属: {{ popup.poiGreenway }}
          <span v-if="popup.poiDistance"> · {{ popup.poiDistance }}</span>
        </p>
        <button @click="goToPoiGreenway" class="popup-btn">
          <i class="fas fa-arrow-right"></i> 查看绿道详情
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
import { sessionRef } from '@/utils/sessionRef.js'
import GeoJSONLayer from '@geoscene/core/layers/GeoJSONLayer.js'
import UniqueValueRenderer from '@geoscene/core/renderers/UniqueValueRenderer.js'
import PictureMarkerSymbol from '@geoscene/core/symbols/PictureMarkerSymbol.js'
import PoiSearchBar from '@/components/PoiSearchBar.vue'
import SpatialAnalysisPanel from '@/components/SpatialAnalysisPanel.vue'
import { analyzeSpatial } from '@/services/spatialApi.js'
import GraphicsLayer from '@geoscene/core/layers/GraphicsLayer.js'
import Graphic from '@geoscene/core/Graphic.js'
import Point from '@geoscene/core/geometry/Point.js'
import { buildPoiPopupTemplate, buildClusterPopupTemplate, bindPoiPopupNavigation } from '@/utils/poiPopupTemplate.js'
import { useGlobalTheme } from '@/utils/useTheme'
import RecommendPanel from '@/components/RecommendPanel.vue'
import AccessibilityPanel from '@/components/AccessibilityPanel.vue'
import AssessPanel from '@/components/AssessPanel.vue'
import GreenwayComparePanel from '@/components/GreenwayComparePanel.vue'
import { getApiBaseUrl } from '@/mobile/services/api'

const router = useRouter()
const { isLoggedIn, currentUser } = useUserAuth()
const toolbarRef = ref(null)
const isLoading = ref(true)

// 空间分析状态
const spatialResult = ref(null)
const spatialResultsMap = new Map()
const spatialPoiLayerId = 'spatial-result'
const spatialLayerId = 'spatial-layer'
const layerIdByDbName = {}
const buildLayerIdByNameMap = () => {
  Object.keys(layerIdByDbName).forEach(k => delete layerIdByDbName[k])
  layerConfig.value.forEach(l => {
    const m = l.url && l.url.match(/greenways\?name=([^&]+)/)
    if (m) layerIdByDbName[decodeURIComponent(m[1])] = l.id
  })
}

// 地图配置
const mapConfig = reactive({
  center: [116.4, 40.4],  // 向北移动视角，使北京区域下移显示
  zoom: 8.5  // 降低缩放级别，确保完整显示北京
})

// GeoScene Server 公网服务地址（数据源替换目标）
const GEO_SCENE_BASE = 'https://wandergreen.cn/rest/services'
const GEO_SCENE_CORE = `${GEO_SCENE_BASE}/%E5%9C%B0%E5%9B%BE/MapServer`
const GEO_SCENE_FN = `${GEO_SCENE_BASE}/greenwayfunction/MapServer`

// 图层配置
const layerConfig = sessionRef('gw_layerConfig_v2', [
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
      lineColor: '#00ACC1',
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
      lineColor: '#F57C00',
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
      lineColor: '#29B6F6',
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
      lineColor: '#0277BD',
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
      lineColor: '#1565C0',
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
      lineColor: '#1976D2',
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
      lineColor: '#26A69A',
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
      lineColor: '#00B8D4',
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
      lineColor: '#00BCD4',
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
      lineColor: '#E64A19',
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
      lineColor: '#9C27B0',
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
      lineColor: '#00897B',
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
      lineColor: '#3949AB',
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
      lineColor: '#5C6BC0',
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
      lineColor: '#03A9F4',
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
      lineColor: '#00ACC1',
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
      lineColor: '#43A047',
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
      lineColor: '#1E88E5',
      lineWidth: 4
    },
    info: {
      name: '中心城滨水绿道',
      description: '中心城区滨水慢行走廊',
      length: 44.1,
      area: '中心城区'
    }
  },
  {
    id: 'function-grid',
    name: '绿道功能区划',
    type: 'geojson',
    // 数据源：GeoScene 服务（greenwayfunction/MapServer/1，按 size 过滤，字段 function_n 对应原 function_name）
    url: `${GEO_SCENE_FN}/1/query?where=size%3D0.02&outFields=*&returnGeometry=true&f=geojson`,
    visible: false,
    zIndex: 8,
    interactive: false,
    style: {
      uniqueField: 'function_n',
      valueColorMap: {
        '历史文化绿道': 'rgba(215,169,126,0.65)',
        '风景绿道': 'rgba(79,195,247,0.65)',
        '生态绿道': 'rgba(102,187,106,0.65)',
        '城市绿道': 'rgba(144,164,174,0.65)'
      }
    }
  }
])

// 迁移清理：过滤旧版 session 数据里残留的散点/分段图层（仅保留六边形网格）
if (layerConfig.value.some(l => l.id === 'function-points' || l.id === 'function-segments')) {
  layerConfig.value = layerConfig.value.filter(l => l.id !== 'function-points' && l.id !== 'function-segments')
}
// 迁移清理：function-grid 数据源已替换为 GeoScene 服务（旧 session 可能保存了后端 url + function_name 字段，需强制更新）
const gridCfg = layerConfig.value.find(l => l.id === 'function-grid')
if (gridCfg) {
  if (!gridCfg.url || gridCfg.url.startsWith('/api/')) {
    gridCfg.url = `${GEO_SCENE_FN}/1/query?where=size%3D0.02&outFields=*&returnGeometry=true&f=geojson`
  }
  if (gridCfg.style && gridCfg.style.uniqueField !== 'function_n') {
    gridCfg.style.uniqueField = 'function_n'
  }
}

/* ── 绿道昼夜配色（随主题切换，避免夜间深蓝底图吞线色；参考 Mapbox/Carto 夜间路线规范：夜间用高亮色） ── */
const { theme: globalTheme } = useGlobalTheme()

const GREENWAY_DAY_COLORS = {
  'wenyu-greenway': '#00ACC1',
  'huanerhuan-greenway': '#F57C00',
  'liangmahe-greenway': '#29B6F6',
  'changying-greenway': '#0277BD',
  'changping42-greenway': '#1565C0',
  'lidu-greenway': '#1976D2',
  'beiyunhe-greenway': '#26A69A',
  'nansha-greenway': '#00B8D4',
  'aosen-greenway': '#00BCD4',
  'yingcheng-greenway': '#E64A19',
  'sanshan-greenway': '#9C27B0',
  'chaoyang-greenway': '#00897B',
  'beiyi-greenway': '#3949AB',
  'dongyi-greenway': '#5C6BC0',
  'jiaoye-greenway': '#03A9F4',
  'xiyi-greenway': '#43A047',
  'zhongxincheng-greenway': '#1E88E5'
}

const GREENWAY_NIGHT_COLORS = {
  'wenyu-greenway': '#80DEEA',
  'huanerhuan-greenway': '#FFB74D',
  'liangmahe-greenway': '#81D4FA',
  'changying-greenway': '#42A5F5',
  'changping42-greenway': '#64B5F6',
  'lidu-greenway': '#90CAF9',
  'beiyunhe-greenway': '#80CBC4',
  'nansha-greenway': '#4DD0E1',
  'aosen-greenway': '#26C6DA',
  'yingcheng-greenway': '#FF8A65',
  'sanshan-greenway': '#CE93D8',
  'chaoyang-greenway': '#4DB6AC',
  'beiyi-greenway': '#7986CB',
  'dongyi-greenway': '#9FA8DA',
  'jiaoye-greenway': '#29B6F6',
  'xiyi-greenway': '#81C784',
  'zhongxincheng-greenway': '#82B1FF'
}

// 绿道数据源已替换为 GeoScene 服务：初始隐藏 17 个 geojson 绿道图层（渲染由 GeoScene FeatureLayer 承担，info 仍保留用于交互）
layerConfig.value.forEach(l => {
  if (l.id.endsWith('-greenway')) l.visible = false
})

// 主题切换时更新绿道线颜色（白天深色/夜间亮色）
watch(globalTheme, (t) => {
  const palette = t === 'night' ? GREENWAY_NIGHT_COLORS : GREENWAY_DAY_COLORS
  layerConfig.value.forEach((layer) => {
    if (palette[layer.id] && layer.style) {
      layer.style.lineColor = palette[layer.id]
    }
  })
}, { immediate: true })

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
  buildLayerIdByNameMap()
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
  position: { x: 0, y: 0 },
  isPoi: false,
  poiName: '',
  poiTypeName: '',
  poiSvg: '',
  poiColor: '#666',
  poiAddress: '',
  poiGreenway: '',
  poiDistance: '',
  poiGreenwayId: null,
  greenwayId: null
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
const showHeatmap = sessionRef('gw_showHeatmap', false)
const showFacilities = sessionRef('gw_showFacilities', false)
const showBeijing = sessionRef('gw_showBeijing', true)
const showGreenways = sessionRef('gw_showGreenways', true)
const showFunctionLayer = sessionRef('gw_showFunctionLayer', false)
const showFunctionCard = sessionRef('gw_showFunctionCard', true)  // 说明卡独立开关：关闭即持久化，不再每次开启图层/刷新后弹回
const showFunctionMore = ref(false)
const showHeatmapCard = ref(true)
const showFacilitiesCard = sessionRef('gw_showFacilitiesCard', true)

// POI 搜索选中处理
async function onPoiSearchSelect(poi) {
  if (!mapManager.value) return
  // 确保设施图层已开启
  if (!showFacilities.value) toggleFacilities(true)
  const view = mapManager.value.getView()
  if (!view) return
  view.goTo({ center: [poi.lng, poi.lat], zoom: 15 }, { duration: 800 }).catch(() => {})
  tooltip.visible = false

  // 优先走 GeoScene 原生 popup：从设施图层查到对应要素，与直接点击 POI 点保持一致
  const layer = mapManager.value.getLayer(facilitiesLayerId)
  try {
    if (layer?.queryFeatures) {
      const res = await layer.queryFeatures({
        where: `id = ${Number(poi.id)}`,
        outFields: ['id', 'name', 'poi_type', 'type_name', 'address', 'greenway_name'],
        returnGeometry: true
      })
      const feat = res?.features?.[0]
      if (feat) {
        // 用 openPopup 初始化并打开原生 popup（view.popup 为懒初始化，首次 narrows 前无 .open）
        view.openPopup({ location: feat.geometry, features: [feat], updateLocationEnabled: true }).catch?.(() => {})
        return
      }
    }
  } catch (e) {
    console.warn('[POI搜索] 查询设施要素失败，回退到构造要素', e)
  }

  // 兜底：用搜索数据构造一个带图层 popupTemplate 的要素，同样走原生 popup
  const att = {
    id: poi.id, name: poi.name, poi_type: poi.poi_type,
    type_name: poi.type_name, address: poi.address,
    greenway_name: poi.greenway_name || '', distance_m: null
  }
  const graphic = new Graphic({
    geometry: new Point({ x: poi.lng, y: poi.lat }),
    attributes: att,
    popupTemplate: layer?.popupTemplate
  })
  try {
    view.openPopup({ location: graphic.geometry, features: [graphic], updateLocationEnabled: true }).catch?.(() => {})
  } catch (e) {
    console.warn('[POI搜索] 原生 popup 打开失败', e)
  }
}

// POI popup 跳转到绿道详情页
function goToPoiGreenway() {
  const name = popup.poiGreenway
  closePopup()
  if (!name) return
  const routeMap = { '温榆河': '/wenyu', '环二环城市绿道': '/huanerhuan', '亮马河绿道': '/liangmahe', '常营半马绿道': '/changying', '昌平42绿道': '/changping42', '丽都商圈绿道': '/lidu', '北运河绿道': '/beiyunhe', '南沙绿道': '/nansha', '奥林匹克森林公园绿道': '/aosen', '营城建都绿道': '/yingcheng', '三山五园绿道': '/sanshan', '朝阳绿道': '/chaoyang', '北翼山水绿道': '/beiyi', '东翼大河绿道': '/dongyi', '郊野休闲环绿道': '/jiaoye', '西翼山水绿道': '/xiyi', '中心城滨水绿道': '/zhongxincheng' }
  const path = routeMap[name]
  if (path) router.push(path)
}

const facilitiesLayerId = 'greenway-facilities'

// POI 类型 → 样式配置（真实矢量图标 + 色调用于 popup 标签）
const FACILITY_CONFIG = {
  '150500': { name: '地铁站', icon: 'subway.svg', color: '#1565C0' },
  '150700': { name: '公交站', icon: 'bus.svg', color: '#0277BD' },
  '150900': { name: '停车场', icon: 'parking.svg', color: '#2E7D32' },
  '200300': { name: '卫生间', icon: 'restroom.svg', color: '#4E342E' },
  '060100': { name: '便利店', icon: 'store.svg', color: '#C62828' },
  '080600': { name: '影剧院', icon: 'cinema.svg', color: '#6A1B9A' },
  '110100': { name: '景点', icon: 'scenic.svg', color: '#E65100' },
  '110200': { name: '景点', icon: 'scenic.svg', color: '#E65100' },
}

// 各类型子开关（sessionStorage 持久化，与 FACILITY_CONFIG 合并防新增 key 丢失）
const _filters = sessionRef('gw_facilityFilters', null)
const _defaultFilters = Object.fromEntries(Object.keys(FACILITY_CONFIG).map(k => [k, true]))
const facilityTypeFilters = reactive(_filters.value ? { ..._defaultFilters, ..._filters.value } : { ..._defaultFilters })
watch(() => ({ ...facilityTypeFilters }), (v) => { _filters.value = v }, { deep: true })
const heatmapLayerId = 'greenway-heatmap'

const routeStore = getRouteStore()
const showPathPlanning = sessionRef('gw_showPathPlanning', false)
const showRecommend = sessionRef('gw_showRecommend', false)
const showAccessibility = sessionRef('gw_showAccessibility', false)
const showAssess = sessionRef('gw_showAssess', false)
const showCompare = sessionRef('gw_showCompare', false)
const accessibilityPanelRef = ref(null)
const pickingAccessibilityOrigin = ref(false)
let accessibilityHullLayerId = null

const mapViewer = ref(null)
const mapManager = shallowRef(null)

// GeoScene 绿道 FeatureLayer 主题配色（白天深色/夜间亮色，与现有 geojson 17 色一致）
const applyGeoSceneGreenwayTheme = (theme) => {
  const geosceneLayer = mapManager.value?.getLayer?.('geoscene-greenways')
  const lm = mapViewer.value?.getLayerManager?.()
  if (!geosceneLayer || !lm || !geosceneLayer.renderer) return
  const palette = theme === 'night' ? GREENWAY_NIGHT_COLORS : GREENWAY_DAY_COLORS
  // key 必须用服务数据 name（GEO_SCENE_GREENWAY_COLORS 的 key 即服务 name），值取对应图层的日间/夜间色
  // 注意：服务 name 大多是完整名（“环二环城市绿道”），只有温榆河是无后缀（“温榆河”），不能统一去后缀
  const colors = {}
  Object.keys(GEO_SCENE_GREENWAY_COLORS).forEach((svcName) => {
    const norm = (n) => (n || '').replace(/绿道$/, '')
    const l = layerConfig.value.find(x => x.info?.name && norm(x.info.name) === norm(svcName))
    if (l && palette[l.id]) colors[svcName] = palette[l.id]
  })
  if (!Object.keys(colors).length) return
  try {
    geosceneLayer.renderer = lm._createUniqueValueRenderer(
      { uniqueField: 'name', valueColorMap: colors, lineWidth: 4 },
      'polyline'
    )
  } catch (e) {
    console.warn('[GeoScene绿道] 主题配色更新失败:', e.message)
  }
}

// GeoScene 绿道随主题切换更新配色
watch(globalTheme, (t) => {
  applyGeoSceneGreenwayTheme(t)
})

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
    layerConfig.value.forEach(layer => {
      const layerInstance = mapManager.value?.getLayer(layer.id)
      if (layerInstance && !layerDefaultRenderers.has(layer.id)) {
        layerDefaultRenderers.set(layer.id, layerInstance.renderer || null)
      }
    })
  }

  // 从 sessionStorage 恢复上次打开的地图图层
  setTimeout(() => {
    if (showFacilities.value) {
      console.log('[GreenwayOverview] 恢复 POI 设施图层')
      toggleFacilities(true)
    }
    if (showHeatmap.value) {
      console.log('[GreenwayOverview] 恢复热度图层')
      toggleHeatmap(true)
    }
    if (showFunctionLayer.value) {
      toggleFunctionLayer(true)
    }
    if (showGreenways.value) {
      toggleGreenways(true)
    }
  }, 800)
}

// 路径规划地图点击 → 转发给 routeStore
const onMapClick = ({ coordinate }) => {
  if (!coordinate) return
  if (pickingAccessibilityOrigin.value) {
    pickingAccessibilityOrigin.value = false
    accessibilityPanelRef.value?.applyOrigin({ lng: coordinate[0], lat: coordinate[1], address: '地图选点' })
    return
  }
  if (!routeStore.state.activeInput) return
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

// ═══════════════ 绿道对比面板：地图多色高亮 + 其余置灰 ═══════════════
const COMPARE_COLORS = ['#E53935', '#1E88E5', '#43A047']  // 红 / 蓝 / 绿，与面板一致
let compareHighlighted = []  // 当前被对比高亮的图层 id 列表
let compareDimmed = []       // 当前被置灰的图层 id 列表

// 图层置灰（透明度降低，突出对比项）
const dimLayer = (layerId) => {
  const mapViewerComponent = mapViewer.value
  const mapManager = mapViewerComponent?.getMapManager?.()
  const layer = mapManager?.getLayer?.(layerId)
  if (layer && layer.opacity === undefined) {
    layer._comparePrevOpacity = 1
  }
  if (layer) {
    layer.opacity = 0.22
  }
}

// 恢复图层透明度
const undimLayer = (layerId) => {
  const mapViewerComponent = mapViewer.value
  const mapManager = mapViewerComponent?.getMapManager?.()
  const layer = mapManager?.getLayer?.(layerId)
  if (layer) {
    layer.opacity = 1
  }
}

// 对比项变化：更新地图高亮
const onCompareChange = (list) => {
  // 1. 恢复上一次对比高亮的绿道
  compareHighlighted.forEach(lid => clearLayerHighlight(lid))
  compareHighlighted = []
  // 2. 恢复上一次置灰的绿道
  compareDimmed.forEach(lid => undimLayer(lid))
  compareDimmed = []

  const hasCompare = !!(list && list.length)

  // GeoScene 服务不支持多色对比高亮：对比时临时切换回 geojson 图层（复用现有对比高亮/置灰逻辑）
  const geosceneLayer = mapManager.value?.getLayer?.('geoscene-greenways')
  if (geosceneLayer) geosceneLayer.visible = !hasCompare
  layerConfig.value.forEach(l => {
    if (l.id.endsWith('-greenway')) l.visible = hasCompare
  })

  // 3. 无对比项 → 恢复原状
  if (!hasCompare) return
  // 4. 非对比绿道置灰
  Object.values(layerIdByDbName).forEach(lid => {
    const inCompare = list.some(g => layerIdByDbName[g.name] === lid)
    if (!inCompare) {
      dimLayer(lid)
      compareDimmed.push(lid)
    }
  })
  // 5. 对比绿道按颜色高亮（红蓝绿）
  list.forEach((g, i) => {
    const lid = layerIdByDbName[g.name]
    if (lid && i < COMPARE_COLORS.length) {
      highlightLayer(lid, COMPARE_COLORS[i], 5, false)
      compareHighlighted.push(lid)
    }
  })
}

// 关闭对比面板：恢复全部地图状态
const onCompareClose = () => {
  showCompare.value = false
  compareHighlighted.forEach(lid => clearLayerHighlight(lid))
  compareHighlighted = []
  compareDimmed.forEach(lid => undimLayer(lid))
  compareDimmed = []
  // 恢复 GeoScene 绿道图层 + 隐藏 geojson 绿道
  const geosceneLayer = mapManager.value?.getLayer?.('geoscene-greenways')
  if (geosceneLayer) geosceneLayer.visible = showGreenways.value
  layerConfig.value.forEach(l => {
    if (l.id.endsWith('-greenway')) l.visible = false
  })
}

// 要素点击
// 绿道名称规范化（服务数据“温榆河”↔ 前端配置“温榆河绿道”）
const normalizeGreenwayName = (n) => (n || '').replace(/绿道$/, '')

// 根据绿道名称从现有 layerConfig 找对应的 info（用于 GeoScene 服务图层点击时复用现有弹窗）
const getGreenwayInfoByName = (name) => {
  if (!name) return null
  const norm = normalizeGreenwayName(name)
  return layerConfig.value.find(l => l.info?.name && normalizeGreenwayName(l.info?.name) === norm)?.info || null
}

// 根据绿道名称找对应的 geojson 图层 id（容错匹配，用于详情跳转/选中态）
const getLayerIdByGreenwayName = (name) => {
  if (!name) return null
  const norm = normalizeGreenwayName(name)
  const key = Object.keys(layerIdByDbName).find(k => normalizeGreenwayName(k) === norm)
  return key ? layerIdByDbName[key] : null
}

// ── GeoScene 绿道高亮（独立 GraphicsLayer 叠加画线，即时生效，效果与现有 highlightLayer 完全一致） ──
let geosceneHighlightLayer = null

const getGeoSceneHighlightLayer = () => {
  const existing = mapManager.value?.getLayer?.('geoscene-greenway-highlight')
  if (existing) return existing
  const layer = new GraphicsLayer({ listMode: 'hide', visible: true })
  layer._zIndex = 112
  layer._interactive = false
  mapManager.value?.addLayer?.('geoscene-greenway-highlight', layer)
  geosceneHighlightLayer = layer
  return layer
}

// 高亮单条绿道：在高亮图层上画该绿道的几何（加粗 + 变色 + 虚线/实线，与现有一致）
const highlightGeoSceneGreenway = (feature, color, width, isHover = false) => {
  if (!feature?.geometry) return
  try {
    const layer = getGeoSceneHighlightLayer()
    layer.removeAll()
    layer.add(new Graphic({
      geometry: feature.geometry,
      symbol: {
        type: 'simple-line',
        color,
        width,
        style: isHover ? 'short-dash' : 'solid',
        cap: 'round',
        join: 'round'
      }
    }))
  } catch (e) {
    console.warn('[GeoScene绿道] 高亮失败:', e.message)
  }
}

// 清除高亮：清空高亮图层
const clearGeoSceneGreenwayHighlight = () => {
  const layer = mapManager.value?.getLayer?.('geoscene-greenway-highlight')
  if (layer) layer.removeAll()
}

const onFeatureClick = ({ featuresWithLayers, pixel }) => {
  // 0. 检查是否点击了空间分析多边形（可再次点击查看）
  for (const item of (featuresWithLayers || [])) {
    if (item.layerId === spatialLayerId) {
      const analysisId = item.feature?.attributes?.analysisId
      const saved = analysisId != null ? spatialResultsMap.get(analysisId) : null
      if (saved) {
        showSpatialResult(saved, pixel)
      }
      return
    }
  }

  // 1. 检查是否点击了 POI 设施（UI 统一交给 GeoScene popup，这里只做埋点）
  for (const item of (featuresWithLayers || [])) {
    if (item.layerId === facilitiesLayerId) {
      const attr = item.feature?.attributes || {}
      // 关闭自写自定义 popup，避免双 UI（GeoScene popup 自动弹出）
      popup.visible = false
      tooltip.visible = false
      if (attr.cluster_count == null) {
        // 单个 POI 点击埋点
        fetch('/api/poi/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poi_id: attr.id, poi_name: attr.name, poi_type: attr.poi_type, greenway_id: attr.greenway_id }) }).catch(() => {})
      }
      return
    }
  }

  // 1.5 检查是否点击了 GeoScene 服务图层（绿道/POI，交互与现有完全一致）
  for (const item of (featuresWithLayers || [])) {
    if (item.layerId === 'geoscene-greenways') {
      const attr = item.feature?.attributes || {}
      const info = getGreenwayInfoByName(attr.name)
      if (info) {
        // 映射回 geojson 图层 id（用于详情跳转/评论等，保持与现有完全一致）
        const lid = getLayerIdByGreenwayName(attr.name) || 'geoscene-greenways'
        if (selectedLayerId.value && selectedLayerId.value !== lid) {
          clearLayerHighlight(selectedLayerId.value)
        }
        clearGeoSceneGreenwayHighlight()
        highlightGeoSceneGreenway(item.feature, '#FF6B35', 5, false)
        selectedLayerId.value = lid
        tooltip.visible = false
        selectedGreenway.value = info
        popup.title = info.name
        popup.content = info.description
        popup.data = { info }
        popup.greenwayId = attr.id ?? null
        popup.position = { x: pixel[0], y: pixel[1] }
        popup.visible = true
        const userId = currentUser.value?.id
        recordGreenwayClick(info.name, userId)
      }
      return
    }
    if (item.layerId === 'geoscene-pois') {
      const attr = item.feature?.attributes || {}
      popup.visible = false
      tooltip.visible = false
      if (attr.cluster_count == null) {
        fetch('/api/poi/click', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poi_id: attr.id, poi_name: attr.name, poi_type: attr.poi_type, greenway_id: attr.greenway_i }) }).catch(() => {})
      }
      return
    }
  }

  // 2. 正常绿道点击
  const greenwayFeature = pickInteractiveFeature(featuresWithLayers)
  if (!greenwayFeature) return

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
    popup.greenwayId = greenwayFeature.feature?.attributes?.id ?? null
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
let lastHoveredGreenwayName = null  // GeoScene 绿道 hover 跟踪（避免同一条重复重建 renderer）

const onFeatureHover = ({ featuresWithLayers, pixel }) => {
  // POI 设施悬浮 tooltip
  for (const item of (featuresWithLayers || [])) {
    if (item.layerId === facilitiesLayerId && !popup.visible) {
      const attr = item.feature?.attributes || {}
      // 聚类命中：不显示自定义 tooltip，交给 GeoScene 处理
      if (attr.cluster_count != null) {
        tooltip.visible = false
        return
      }
      const cfg = FACILITY_CONFIG[attr.poi_type]
      tooltip.title = attr.name || ''
      tooltip.data = {
        length: null,
        area: (attr.type_name || '') + (attr.distance_m ? ' · ' + (attr.distance_m < 1000 ? attr.distance_m + 'm' : (attr.distance_m/1000).toFixed(1)+'km') : ''),
        description: attr.address || ''
      }
      scheduleTooltipPosition(pixel)
      tooltip.visible = true
      return
    }
  }

  // GeoScene 服务图层绿道悬浮 tooltip + 金色高亮（交互与现有一致）
  for (const item of (featuresWithLayers || [])) {
    if (item.layerId === 'geoscene-greenways' && !popup.visible) {
      const attr = item.feature?.attributes || {}
      const info = getGreenwayInfoByName(attr.name)
      if (info) {
        tooltip.title = info.name
        tooltip.data = {
          length: info.length,
          area: info.area,
          description: info.description
        }
        scheduleTooltipPosition(pixel)
        tooltip.visible = true
        // 只在 hover 绿道变化时改 renderer（鼠标在绿道上移动时高亮保持稳定，不闪烁）
        if (!selectedLayerId.value && lastHoveredGreenwayName !== attr.name) {
          highlightGeoSceneGreenway(item.feature, '#FFD700', 6, true)
          lastHoveredGreenwayName = attr.name
        }
        hoveredFeature.value = item.feature
      }
      return
    }
  }

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

  // GeoScene 绿道 hover 移出：未选中时清除高亮
  if (!selectedLayerId.value) {
    clearGeoSceneGreenwayHighlight()
    lastHoveredGreenwayName = null
  }

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
  if (visible) showHeatmapCard.value = true  // 开启图层时说明卡重新出现

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

// ── GeoScene 服务 POI 数据源替换（交互与替换前完全一致，仅数据源改为服务 query） ──
let greenwayIdNameMap = {}
let greenwayIdNameMapLoaded = false

// 从后端拉取绿道 id→name 映射（补齐服务数据缺失的 greenway_name 字段）
const loadGreenwayIdNameMap = async () => {
  if (greenwayIdNameMapLoaded) return
  try {
    const resp = await fetch('/api/greenways')
    const data = await resp.json()
    for (const f of (data.features || [])) {
      const p = f.properties || {}
      if (p.id != null && p.name) greenwayIdNameMap[p.id] = p.name
    }
    greenwayIdNameMapLoaded = true
  } catch (e) {
    console.warn('[设施] 绿道映射加载失败:', e.message)
  }
}

// 从 GeoScene 服务 query POI，转换为与现有 /api/facilities/geojson 相同结构的 GeoJSON
const queryGeoScenePois = async () => {
  await loadGreenwayIdNameMap()
  const url = `${GEO_SCENE_CORE}/1/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`服务查询失败 HTTP ${resp.status}`)
  const data = await resp.json()
  const feats = (data.features || []).map(f => {
    const a = f.properties || {}
    return {
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id: a.FID ?? a.id,
        name: a.name || '',
        poi_type: a.poi_type || '',
        type_name: FACILITY_CONFIG[a.poi_type]?.name || '',
        color: FACILITY_CONFIG[a.poi_type]?.color || '#999',
        greenway_id: a.greenway_i ?? null,
        greenway_name: greenwayIdNameMap[a.greenway_i] || '',
        address: a.descriptio || ''
      }
    }
  })
  return { type: 'FeatureCollection', features: feats }
}

const toggleFacilities = async (visible) => {
  showFacilities.value = visible
  if (visible) showFacilitiesCard.value = true  // 打开图层时说明卡自动出现

  if (!mapManager.value) return

  if (visible) {
    try {
      const existing = mapManager.value.getLayer(facilitiesLayerId)
      if (existing) {
        existing.visible = true
        return
      }
      // 数据源：GeoScene 服务 query（字段补齐后与 /api/facilities/geojson 结构完全一致）
      const geojson = await queryGeoScenePois()
      if (!geojson.features || geojson.features.length === 0) {
        showFacilities.value = false
        return
      }

      // 图层 URL（Blob）
      const blob = new Blob([JSON.stringify(geojson)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      // 构建渲染器：真实矢量图标
      const uniqueValueInfos = Object.entries(FACILITY_CONFIG).map(([code, cfg]) => ({
        value: code,
        symbol: new PictureMarkerSymbol({
          url: `/images/poi/${cfg.icon}`,
          width: '26px',
          height: '26px'
        })
      }))

      const layer = new GeoJSONLayer({
        id: facilitiesLayerId,
        title: '附近设施',
        url,
        visible: true,
        outFields: ['id', 'name', 'poi_type', 'type_name', 'greenway_id', 'greenway_name', 'address'],
        minScale: 0,
        maxScale: 0,
        renderer: new UniqueValueRenderer({
          field: 'poi_type',
          uniqueValueInfos
        }),
        // 统一 GeoScene popup：content 函数区分聚合点/单点，含跳转按钮
        popupTemplate: buildPoiPopupTemplate(FACILITY_CONFIG),
        featureReduction: {
          type: 'cluster',
          clusterRadius: '60px',
          clusterMaxSize: 40,
          clusterMinSize: 12,
          maxScale: 72224,
          popupTemplate: buildClusterPopupTemplate(() => mapManager.value?.getLayer(facilitiesLayerId))
        }
      })
      layer._zIndex = 250
      // 标记此图层仅供交互查询，GeoJSONLayer 不再通过 hitTest 响应时
      // 我们改用在 MapViewer 的 feature-hover/click 中做判断
      layer.listMode = 'hide'

      mapManager.value.addLayer(facilitiesLayerId, layer)
      console.log('[设施图层] 已添加, POI:', geojson.features.length)

      // 缩放监听：zoom < 11 时隐藏设施图层（太密），11~13 聚合，>13 散开单点
      const view = mapManager.value.getView()
      if (view) {
        const handleZoom = () => {
          const facLayer = mapManager.value?.getLayer(facilitiesLayerId)
          if (!facLayer) return
          const z = view.zoom
          facLayer.visible = z >= 11 && showFacilities.value
        }
        view.watch('zoom', handleZoom)
        facZoomWatcher = handleZoom
        handleZoom()
      }
    } catch (e) {
      console.error('[设施图层] 创建失败:', e)
      showFacilities.value = false
    }
  } else {
    if (facZoomWatcher) { facZoomWatcher = null }
    const layer = mapManager.value.getLayer(facilitiesLayerId)
    if (layer) {
      layer.visible = false
    }
  }
}

// 北京市界/市域聚合开关
const toggleBeijing = (visible) => {
  showBeijing.value = visible
  layerConfig.value.forEach((layer) => {
    if (layer.id === 'beijing-boundary' || layer.id === 'beijing-area') {
      layer.visible = visible
    }
  })
}

// 全部绿道聚合开关（控制图上所有绿道线）
const toggleGreenways = (visible) => {
  showGreenways.value = visible
  // GeoScene 服务替代：现有 17 个 geojson 绿道图层始终隐藏（数据源已替换为 GeoScene 服务）
  layerConfig.value.forEach((layer) => {
    if (layer.id.endsWith('-greenway')) {
      layer.visible = false
    }
  })
  if (visible) {
    loadGeoSceneLayer('geoscene-greenways')
  } else {
    removeGeoSceneLayer('geoscene-greenways')
    // 同时清理 GeoScene 高亮图层与悬浮状态
    removeGeoSceneLayer('geoscene-greenway-highlight')
    geosceneHighlightLayer = null
    lastHoveredGreenwayName = null
  }
}

// 功能分区图层开关（深度学习评价节点，按功能类型着色）
const toggleFunctionLayer = (visible) => {
  showFunctionLayer.value = visible
  const layer = layerConfig.value.find(l => l.id === 'function-grid')
  if (layer) layer.visible = visible
  if (visible) {
    applyFunctionGridSize()
    showFunctionCard.value = true  // 打开图层时说明卡自动出现
  }
}

// GeoScene 服务图层开关（FeatureLayer + 自定义符号化 + 交互适配，与现有 UI/UX 完全一致）
// 服务字段被 shp 截断，这里做字段名映射
const GEO_SCENE_FIELD_ALIAS = {
  descriptio: 'description',
  introducti: 'introduction',
  function_n: 'function_name',
  greenway_n: 'greenway_name',
  function_t: 'function_type',
  coverage_a: 'coverage_area',
  constructi: 'construction_area',
  greenway_i: 'greenway_id',
  manual_con: 'manual_confidence'
}

// 配色映射（与现有前端一致）
const GEO_SCENE_GREENWAY_COLORS = {
  '环二环城市绿道': '#F57C00',
  '昌平42绿道': '#1565C0',
  '温榆河': '#00ACC1',
  '亮马河绿道': '#29B6F6',
  '北运河绿道': '#26A69A',
  '南沙绿道': '#00B8D4',
  '奥林匹克森林公园绿道': '#00BCD4',
  '常营半马绿道': '#0277BD',
  '丽都商圈绿道': '#1976D2',
  '营城建都绿道': '#E64A19',
  '朝阳绿道': '#00897B',
  '北翼山水绿道': '#3949AB',
  '东翼大河绿道': '#5C6BC0',
  '郊野休闲环绿道': '#03A9F4',
  '三山五园绿道': '#9C27B0',
  '西翼山水绿道': '#43A047',
  '中心城滨水绿道': '#1E88E5'
}

const GEO_SCENE_FACILITY_COLORS = {
  '150500': '#E53935',
  '150700': '#FB8C00',
  '150900': '#1E88E5',
  '200300': '#43A047',
  '060100': '#8E24AA',
  '080600': '#6A1B9A',
  '110100': '#E65100',
  '110200': '#E65100'
}

const GEO_SCENE_FUNCTION_COLORS = {
  '历史文化绿道': '#A0522D',
  '风景绿道': '#2196F3',
  '生态绿道': '#4CAF50',
  '城市绿道': '#607D8B'
}

// 5 个子图层（FeatureLayer，客户端渲染 + 自定义 renderer）
const GEO_SCENE_SERVICE_LAYERS = [
  {
    id: 'geoscene-greenways',
    title: '绿道（GeoScene）',
    url: `${GEO_SCENE_CORE}/2`,
    geometryType: 'polyline',
    uniqueField: 'name',
    valueColorMap: GEO_SCENE_GREENWAY_COLORS,
    lineWidth: 4,
    zIndex: 110,
    opacity: 1
  },
  {
    id: 'geoscene-pois',
    title: '设施（GeoScene）',
    url: `${GEO_SCENE_CORE}/1`,
    geometryType: 'point',
    uniqueField: 'poi_type',
    valueColorMap: GEO_SCENE_FACILITY_COLORS,
    pointRadius: 5,
    zIndex: 111,
    opacity: 1
  },
  {
    id: 'geoscene-segments',
    title: '功能分段（GeoScene）',
    url: `${GEO_SCENE_CORE}/0`,
    geometryType: 'polyline',
    uniqueField: 'function_n',
    valueColorMap: GEO_SCENE_FUNCTION_COLORS,
    lineWidth: 3,
    zIndex: 112,
    opacity: 0.9
  },
  {
    id: 'geoscene-function-nodes',
    title: '功能节点（GeoScene）',
    url: `${GEO_SCENE_FN}/0`,
    geometryType: 'point',
    uniqueField: 'function_n',
    valueColorMap: GEO_SCENE_FUNCTION_COLORS,
    pointRadius: 4,
    zIndex: 113,
    opacity: 0.8
  },
  {
    id: 'geoscene-function-grid',
    title: '功能网格（GeoScene）',
    url: `${GEO_SCENE_FN}/1`,
    geometryType: 'polygon',
    uniqueField: 'function_n',
    valueColorMap: GEO_SCENE_FUNCTION_COLORS,
    zIndex: 114,
    opacity: 1,
    polygonOpacity: 0.35
  }
]

// 加载单个 GeoScene 服务图层（FeatureLayer + 自定义符号化）
const loadGeoSceneLayer = async (layerId) => {
  try {
    const lm = mapViewer.value?.getLayerManager?.()
    if (!lm || !mapViewer.value) return
    const cfg = GEO_SCENE_SERVICE_LAYERS.find(c => c.id === layerId)
    if (!cfg) return
    const existing = mapManager.value?.getLayer?.(layerId)
    if (existing) return
    const layer = lm.createFeatureLayerFromService(cfg.url, {
      zIndex: cfg.zIndex,
      opacity: cfg.opacity,
      title: cfg.title,
      geometryType: cfg.geometryType,
      uniqueField: cfg.uniqueField,
      valueColorMap: cfg.valueColorMap,
      lineWidth: cfg.lineWidth,
      pointRadius: cfg.pointRadius,
      polygonOpacity: cfg.polygonOpacity
    })
    mapViewer.value.addLayer(cfg.id, layer, { type: 'featureserver', url: cfg.url })
    console.log(`[GeoScene服务] 已加载图层: ${layerId}`)
    // 加载后应用当前主题配色（夜间亮色/日间深色）
    if (layerId === 'geoscene-greenways') {
      applyGeoSceneGreenwayTheme(globalTheme.value)
    }
  } catch (err) {
    console.error(`[GeoScene服务] 加载图层 ${layerId} 失败:`, err.message || err)
  }
}

const removeGeoSceneLayer = (layerId) => {
  mapViewer.value?.removeLayer?.(layerId)
}

// 地图缩放变化（MapViewer 事件）——功能分区开启时联动六边形网格大小
const onZoomChanged = () => {
  if (showFunctionLayer.value) applyFunctionGridSize()
}

// 功能分区六边形网格缩放联动（低缩放大格/高缩放细格）
const FUNCTION_GRID_SIZES = [
  { maxZoom: 9, size: 0.04 },
  { maxZoom: 11, size: 0.02 },
  { maxZoom: 99, size: 0.01 }
]
const applyFunctionGridSize = () => {
  const zoom = mapManager.value?.getView?.()?.zoom
  if (zoom == null) return
  const s = FUNCTION_GRID_SIZES.find(x => zoom < x.maxZoom)?.size || 0.01
  const layer = layerConfig.value.find(l => l.id === 'function-grid')
  // 数据源：GeoScene 服务按 size 过滤（服务已预生成 0.04/0.02/0.01 三档网格，与现有缩放联动一致）
  const url = `${GEO_SCENE_FN}/1/query?where=size%3D${s}&outFields=*&returnGeometry=true&f=geojson`
  if (layer && layer.url !== url) {
    layer.url = url
  }
}

// 单独切换某类设施（同时过滤聚类：用 definitionExpression，聚类也遵循）
function toggleFacilityType(typeCode, checked) {
  facilityTypeFilters[typeCode] = checked
  // 景点类需要同步 110100(公园广场) 和 110200(风景名胜)
  if (typeCode === '110100') facilityTypeFilters['110200'] = checked
  if (typeCode === '110200') facilityTypeFilters['110100'] = checked
  const layer = mapManager.value?.getLayer(facilitiesLayerId)
  if (!layer) return

  // definitionExpression 过滤数据源，聚类只聚合选中类型
  const enabledCodes = Object.keys(FACILITY_CONFIG).filter(code => facilityTypeFilters[code])
  if (enabledCodes.length === Object.keys(FACILITY_CONFIG).length) {
    layer.definitionExpression = null
  } else {
    layer.definitionExpression = `poi_type IN (${enabledCodes.map(c => `'${c}'`).join(',')})`
  }

  // 同时更新渲染器（散开单点时图标跟随过滤）
  if (layer.renderer?.type === 'unique-value') {
    const newInfos = Object.entries(FACILITY_CONFIG)
      .filter(([code]) => facilityTypeFilters[code])
      .map(([code, cfg]) => ({
        value: code,
        symbol: new PictureMarkerSymbol({
          url: `/images/poi/${cfg.icon}`,
          width: '26px',
          height: '26px'
        })
      }))
    layer.renderer.uniqueValueInfos = newInfos
  }
}

let facZoomWatcher = null

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
  popup.isPoi = false
  popup.greenwayId = null

  if (selectedLayerId.value) {
    clearLayerHighlight(selectedLayerId.value)
    clearGeoSceneGreenwayHighlight()
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

// ─── 空间分析 ─────────────────────────────────────────
const onSpatialAnalysisComplete = async ({ polygon, analysis, analysisId }) => {
  try {
    const data = await analyzeSpatial(polygon)
    const result = { summary: data.summary, greenways: data.greenways, pois: data.pois, analysis }
    if (analysisId != null) spatialResultsMap.set(analysisId, result)
    showSpatialResult(result)
  } catch (e) {
    console.error('[空间分析]', e.message)
    alert('空间分析失败：' + e.message)
  }
}

// 展示某次空间分析结果（新建或再次点击）
const showSpatialResult = (result, pixel) => {
  clearSpatialHighlights()
  result.greenways.forEach(gw => {
    const lid = layerIdByDbName[gw.name]
    if (lid) highlightLayer(lid, '#FF5722', 5, false)
  })
  renderSpatialPoiMarkers(result.pois)
  spatialResult.value = result
}

// 清除空间分析（来自工具栏按钮）
const onSpatialAnalysisClear = () => {
  spatialResultsMap.clear()
  closeSpatialPanel()
}

const renderSpatialPoiMarkers = (pois) => {
  const existing = mapManager.value?.getLayer(spatialPoiLayerId)
  if (existing) mapManager.value.removeLayer(spatialPoiLayerId)
  const layer = new GraphicsLayer({ id: spatialPoiLayerId, title: '空间分析结果', listMode: 'hide' })
  pois.forEach(p => {
    layer.add(new Graphic({
      geometry: new Point({ longitude: p.lng, latitude: p.lat, spatialReference: { wkid: 4326 } }),
      symbol: { type: 'simple-marker', color: '#4CAF50', size: 8, outline: { color: '#fff', width: 1.5 } }
    }))
  })
  mapManager.value?.addLayer(spatialPoiLayerId, layer)
}

const clearSpatialHighlights = () => {
  Object.values(layerIdByDbName).forEach(lid => {
    if (lid) clearLayerHighlight(lid)
  })
}

const closeSpatialPanel = () => {
  spatialResult.value = null
  clearSpatialHighlights()
  const layer = mapManager.value?.getLayer(spatialPoiLayerId)
  if (layer) mapManager.value.removeLayer(spatialPoiLayerId)
}

const locateSpatialPoi = (poi) => {
  const view = mapManager.value?.getView()
  if (view && poi.lng && poi.lat) view.goTo({ center: [poi.lng, poi.lat], zoom: 15 })
}

const locateSpatialGreenway = (gw) => {
  const lid = layerIdByDbName[gw.name]
  const layer = lid ? mapManager.value?.getLayer(lid) : null
  if (layer) {
    layer.queryExtent()
      .then(r => { if (r?.extent) mapManager.value?.fitExtent(r.extent, { padding: [80, 80, 80, 80] }) })
      .catch(() => {})
  }
}

// 智能推荐：定位到推荐绿道（飞行 + 高亮）
const locateRecommendGreenway = (gw) => {
  const view = mapManager.value?.getView?.()
  if (view && gw.lng && gw.lat) {
    view.goTo({ center: [gw.lng, gw.lat], zoom: 13 }, { duration: 900 })
  }
  const lid = layerIdByDbName[gw.name]
  if (lid) {
    highlightLayer(lid, '#FFB300', 6, false)
    setTimeout(() => highlightLayer(lid, null, 4, false), 3000)
  }
}

// 智能推荐：去这里 → 打开路径规划，目的地自动设为绿道最近入口（基于起点动态计算）
let pendingRecommendGreenway = null  // 当前目标绿道（起点变化时自动重算目的地）

const applyNearestEntry = async (gw, origin) => {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/greenways/name/${encodeURIComponent(gw.name)}/nearest-entry?lng=${origin.lng}&lat=${origin.lat}`
    )
    const d = await res.json()
    if (d.lng && d.lat) {
      routeStore.setDestination({ lng: d.lng, lat: d.lat, address: d.address || `${gw.name}（最近入口）` })
    }
  } catch (e) {
    console.warn('[推荐] 最近入口计算失败:', e.message)
    if (gw.lng && gw.lat) routeStore.setDestination({ lng: gw.lng, lat: gw.lat, address: gw.name })
  }
}

const goRecommendRoute = async (gw) => {
  if (!gw.lng && !gw.lat) return
  pendingRecommendGreenway = gw
  routeStore.setTravelMode('walking')
  routeStore.state.isPanelVisible = true
  showPathPlanning.value = true
  showRecommend.value = false

  const origin = routeStore.state.origin
  if (origin && origin.lng && origin.lat) {
    // 起点已设置 → 目的地 = 绿道最近入口
    await applyNearestEntry(gw, origin)
  } else {
    // 起点未设置 → 先兜底用绿道首点，用户设置起点后自动重算
    routeStore.setDestination({ lng: gw.lng, lat: gw.lat, address: gw.name })
  }
}

// 起点变化 → 自动把目的地重算为当前目标绿道的最近入口
watch(() => routeStore.state.origin, (origin) => {
  if (!origin || !pendingRecommendGreenway) return
  applyNearestEntry(pendingRecommendGreenway, origin)
})

/* ── 可达圈分析 ── */
const closeAccessibility = () => {
  showAccessibility.value = false
  pickingAccessibilityOrigin.value = false
  if (accessibilityHullLayerId && mapManager.value?.getLayer(accessibilityHullLayerId)) {
    mapManager.value.removeLayer(accessibilityHullLayerId)
    accessibilityHullLayerId = null
  }
}

// 等时圈渲染：Chaikin 平滑 + 多档叠加（蓝系渐变，内深外浅）+ 起点高亮标记
const HULL_FILL = {
  5: 'rgba(21,101,192,0.30)', 10: 'rgba(25,118,210,0.24)',
  15: 'rgba(30,136,229,0.18)', 20: 'rgba(66,165,245,0.13)',
  30: 'rgba(144,202,249,0.09)'
}
const HULL_LINE = { 5: '#1565C0', 10: '#1976D2', 15: '#1E88E5', 20: '#42A5F5', 30: '#90CAF9' }

/** Chaikin 平滑（闭合多边形边缘圆润化） */
function chaikinSmooth(pts, iter = 2) {
  let p = pts
  for (let i = 0; i < iter; i++) {
    const np = []
    for (let j = 0; j < p.length - 1; j++) {
      const [x1, y1] = p[j], [x2, y2] = p[j + 1]
      np.push([x1 * 0.75 + x2 * 0.25, y1 * 0.75 + y2 * 0.25])
      np.push([x1 * 0.25 + x2 * 0.75, y1 * 0.25 + y2 * 0.75])
    }
    const [x1, y1] = p[p.length - 1], [x2, y2] = p[0]
    np.push([x1 * 0.75 + x2 * 0.25, y1 * 0.75 + y2 * 0.25])
    np.push([x1 * 0.25 + x2 * 0.75, y1 * 0.25 + y2 * 0.75])
    p = np
  }
  return p
}

const renderAccessibilityHull = async ({ hulls, minutes, origin }) => {
  if (!hulls || !mapManager.value) return
  const [Graphic] = await Promise.all([import('@geoscene/core/Graphic.js').then(m => m.default || m)])

  if (!accessibilityHullLayerId) {
    const [GraphicsLayer] = await Promise.all([import('@geoscene/core/layers/GraphicsLayer.js').then(m => m.default || m)])
    const layer = new GraphicsLayer({ listMode: 'hide' })
    layer._zIndex = 9
    mapManager.value.addLayer('accessibility-hull', layer)
    accessibilityHullLayerId = 'accessibility-hull'
  }
  const layer = mapManager.value.getLayer(accessibilityHullLayerId)
  if (!layer) return

  layer.removeAll()

  // 多档等时圈叠加（5→当前分钟，内层深外层浅）
  for (const m of [5, 10, 15, 20, 30]) {
    if (m > minutes) break
    const hull = hulls[m]
    if (!hull || hull.length < 3) continue
    layer.add(new Graphic({
      geometry: {
        type: 'polygon',
        rings: [chaikinSmooth(hull)],
        spatialReference: { wkid: 4326 }
      },
      symbol: {
        type: 'simple-fill',
        color: HULL_FILL[m],
        outline: { color: HULL_LINE[m], width: m === minutes ? 2.5 : 1.5 }
      }
    }))
  }

  // 起点高亮标记（蓝点 + 白边 + 光晕）
  if (origin && origin.lng && origin.lat) {
    layer.add(new Graphic({
      geometry: { type: 'point', longitude: origin.lng, latitude: origin.lat, spatialReference: { wkid: 4326 } },
      symbol: { type: 'simple-marker', color: '#0D47A1', size: 15, outline: { color: '#ffffff', width: 3 } }
    }))
    layer.add(new Graphic({
      geometry: { type: 'point', longitude: origin.lng, latitude: origin.lat, spatialReference: { wkid: 4326 } },
      symbol: { type: 'simple-marker', color: 'rgba(13,71,161,0.25)', size: 34, outline: { color: 'rgba(13,71,161,0.4)', width: 1 } }
    }))
  }
}

// 起点确定 → 地图飞至起点并放大
const onAccessOriginSet = (origin) => {
  const view = mapManager.value?.getView?.()
  if (view && origin?.lng && origin?.lat) {
    view.goTo({ center: [origin.lng, origin.lat], zoom: 14 }, { duration: 900 })
  }
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
  // 绑定 POI popup 内"查看绿道详情"按钮的全局点击委托
  unbindPoiPopupNav = bindPoiPopupNavigation(router)
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

let unbindPoiPopupNav = null
onBeforeUnmount(() => {
  unbindPoiPopupNav?.()
  unbindPoiPopupNav = null
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
  overflow-x: hidden;
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

/* ===== 图层说明卡堆叠容器（左下角，多卡竖排互不影响） ===== */
.flc-stack {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: 20;
  display: flex;
  flex-direction: column-reverse;
  gap: 10px;
  max-width: 276px;
  pointer-events: none;
}
.flc-stack .function-legend-card { pointer-events: auto; }

/* 附近设施卡：位于功能区划卡正右侧（并排，底部对齐，互不遮挡） */
.function-legend-card--poi {
  position: absolute;
  left: 302px;  /* 16(左距) + 276(功能区划卡宽) + 10(间距) */
  bottom: 16px;
  z-index: 20;
  pointer-events: auto;
}

/* ===== 绿道功能区划说明卡（玻璃拟态 + 绿道主题渐变 + 微光效） ===== */
.function-legend-card {
  width: 276px;
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(150deg, rgba(255,255,255,0.92), rgba(235,248,235,0.88));
  backdrop-filter: blur(14px);
  border: 1px solid rgba(46,125,50,0.22);
  box-shadow:
    0 10px 34px rgba(46,125,50,0.16),
    0 2px 8px rgba(0,0,0,0.06),
    inset 0 0 0 1px rgba(255,255,255,0.5);
  font-family: inherit;
  box-sizing: border-box;
  transition: box-shadow 0.3s;
}
.function-legend-card:hover {
  box-shadow:
    0 12px 40px rgba(46,125,50,0.24),
    0 2px 8px rgba(0,0,0,0.06),
    inset 0 0 0 1px rgba(255,255,255,0.5);
}
/* 顶部绿色渐变头部（替代原顶部流动线条） */
.flc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 4px;
  background: linear-gradient(135deg, rgba(46,125,50,0.1), rgba(102,187,106,0.03));
}
/* 图标徽章 */
.flc-badge {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.95rem;
  background: linear-gradient(135deg, #2E7D32, #66BB6A);
  box-shadow: 0 4px 10px rgba(46,125,50,0.35);
  flex: 0 0 auto;
}
.flc-badge-hot {
  background: linear-gradient(135deg, #E64A19, #FF9800);
  box-shadow: 0 4px 10px rgba(230,74,25,0.35);
}
.flc-badge-poi {
  background: linear-gradient(135deg, #1565C0, #4FC3F7);
  box-shadow: 0 4px 10px rgba(21,101,192,0.35);
}
.flc-head-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.flc-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary, #1a2a1a);
  letter-spacing: 0.3px;
}
.flc-subtitle {
  font-size: 0.6rem;
  letter-spacing: 1.6px;
  color: var(--text-tertiary, #9aa8a0);
  font-weight: 600;
}
.flc-close {
  border: none;
  background: rgba(0,0,0,0.05);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  font-size: 0.95rem;
  color: var(--text-tertiary, #999);
  cursor: pointer;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex: 0 0 auto;
}
.flc-close:hover {
  background: rgba(46,125,50,0.12);
  color: #2E7D32;
  transform: rotate(90deg);
}
.flc-body {
  padding: 6px 14px 13px;
}
.flc-desc {
  font-size: 0.78rem;
  color: var(--text-secondary, #555);
  margin: 4px 0 9px;
  line-height: 1.55;
}
.flc-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 9px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(46,125,50,0.05);
  border: 1px solid rgba(46,125,50,0.1);
}
.flc-legend-heat {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}
.flc-legend-heat .legend-gradient {
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(to right, #00c800, #ffff00, #ff8c00, #ff0000);
}
.flc-legend-heat .legend-label {
  font-size: 0.72rem;
  color: var(--text-secondary, #888);
}
.flc-item {
  font-size: 0.75rem;
  color: var(--text-primary, #444);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
}
.flc-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: 0 0 auto;
  box-shadow: 0 0 6px currentColor;
}
.flc-tip {
  font-size: 0.74rem;
  color: var(--text-secondary, #666);
  margin: 0 0 7px;
  line-height: 1.6;
}
.flc-hl { font-weight: 700; }
.flc-hl-eco { color: #2E7D32; }
.flc-hl-his { color: #8D6E63; }
.flc-more {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 7px;
  padding: 5px 12px;
  font-size: 0.74rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #2E7D32, #43A047);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(46,125,50,0.3);
  transition: all 0.2s;
}
.flc-more:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 14px rgba(46,125,50,0.4);
}
.flc-more-detail {
  margin: 4px 0 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(46,125,50,0.05);
  border: 1px dashed rgba(46,125,50,0.25);
  font-size: 0.72rem;
  color: var(--text-secondary, #666);
  line-height: 1.65;
}
.flc-src {
  font-size: 0.66rem;
  color: var(--text-tertiary, #aaa);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ===== 夜间模式：霓虹绿发光 ===== */
[data-theme="night"] .function-legend-card {
  background: linear-gradient(150deg, rgba(22,36,22,0.94), rgba(12,24,12,0.92));
  border-color: rgba(76,175,80,0.35);
  box-shadow:
    0 0 26px rgba(76,175,80,0.22),
    0 10px 34px rgba(0,0,0,0.5),
    inset 0 0 0 1px rgba(129,199,132,0.12);
}
[data-theme="night"] .function-legend-card:hover {
  box-shadow:
    0 0 36px rgba(76,175,80,0.32),
    0 12px 40px rgba(0,0,0,0.5),
    inset 0 0 0 1px rgba(129,199,132,0.12);
}
[data-theme="night"] .flc-header {
  background: linear-gradient(135deg, rgba(76,175,80,0.12), rgba(76,175,80,0.03));
}
[data-theme="night"] .flc-badge {
  background: linear-gradient(135deg, #1B5E20, #4CAF50);
  box-shadow: 0 0 14px rgba(76,175,80,0.5);
}
[data-theme="night"] .flc-badge-hot {
  background: linear-gradient(135deg, #BF360C, #FF9800);
  box-shadow: 0 0 14px rgba(255,152,0,0.5);
}
[data-theme="night"] .flc-badge-poi {
  background: linear-gradient(135deg, #0D47A1, #4FC3F7);
  box-shadow: 0 0 14px rgba(79,195,247,0.5);
}
[data-theme="night"] .flc-close {
  background: rgba(255,255,255,0.06);
}
[data-theme="night"] .flc-close:hover {
  background: rgba(76,175,80,0.2);
  color: #81C784;
}
[data-theme="night"] .flc-legend,
[data-theme="night"] .flc-more-detail {
  background: rgba(76,175,80,0.07);
  border-color: rgba(76,175,80,0.2);
}
[data-theme="night"] .flc-hl-eco { color: #81C784; }
[data-theme="night"] .flc-hl-his { color: #D7A97E; }
[data-theme="night"] .flc-more {
  background: linear-gradient(135deg, #1B5E20, #43A047);
  box-shadow: 0 0 12px rgba(76,175,80,0.35);
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
  /* 附近设施说明卡：桌面布局在左卡右侧(left:302px)，手机端会溢出屏幕，改为底部全宽 */
  .function-legend-card--poi {
    left: 16px;
    right: 16px;
    width: auto;
  }
  /* 说明卡堆叠容器：手机端限制宽度，避免遮挡地图 */
  .flc-stack {
    max-width: calc(100% - 32px);
  }
  .flc-stack .function-legend-card {
    width: 100%;
  }
}

/* === POI 弹窗类型标签 === */
.popup--poi .poi-type-tag { display: inline-block; padding: 0.12rem 0.5rem; border-radius: 10px; font-size: 0.76rem; font-weight: 600; margin-right: 0.4rem; background: rgba(0,0,0,0.06); color: #666; }

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

