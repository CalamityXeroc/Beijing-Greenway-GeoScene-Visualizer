<template>
  <div class="baidu-panorama-viewer-wrapper" v-if="visible">
    <div class="panorama-overlay" @click="closeViewer"></div>
    <div class="panorama-container">
      <!-- 头部控制栏 -->
      <div class="panorama-header">
        <div class="panorama-title">
          <i class="fas fa-street-view"></i>
          <span>{{ currentPoint.name }}</span>
          <span class="badge-realtime">
            <i class="fas fa-video"></i> 百度街景
          </span>
          <span class="badge-warning">
            <i class="fas fa-exclamation-triangle"></i> 街景位置为近似点
          </span>
        </div>
        <div class="panorama-controls">
          <button 
            class="control-btn close-btn" 
            @click="closeViewer"
            title="关闭"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 百度全景容器 -->
      <div ref="baiduPanorama" class="panorama-content"></div>

      <!-- 暂无街景提示层 -->
      <div class="pano-error-overlay" v-if="loadError">
        <div class="pano-error-box">
          <div class="pano-error-icon">
            <i class="fas fa-street-view"></i>
          </div>
          <div class="pano-error-title">该位置暂无街景数据</div>
          <div class="pano-error-desc">
            百度街景由移动采集车拍摄，主要覆盖城市道路；
            绿道内部通常不允许车辆通行，因此部分观景点可能暂无街景影像。
          </div>
          <div class="pano-error-actions">
            <button class="pano-btn" @click="closeViewer">关闭</button>
          </div>
        </div>
      </div>

      <!-- 底部导航 -->
      <div class="panorama-footer">
        <div class="panorama-info">
          <span class="info-badge">
            <i class="fas fa-map-marker-alt"></i>
            {{ currentPoint.description }}
          </span>
        </div>
        <div class="points-navigation">
          <button 
            v-for="(point, index) in panoramaPoints" 
            :key="index"
            class="point-btn"
            :class="{ active: currentPointIndex === index }"
            @click="switchPoint(index)"
            :title="point.name"
          >
            <i class="fas fa-map-marker-alt"></i>
            <span>{{ point.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  panoramaPoints: {
    type: Array,
    default: () => []
  },
  initialPoint: {
    type: Number,
    default: 0
  },
  baiduMapKey: {
    type: String,
    default: 'YOUR_BAIDU_MAP_KEY' // 需要申请百度地图API密钥
  }
})

const emit = defineEmits(['close', 'point-change'])

const baiduPanorama = ref(null)
const currentPointIndex = ref(props.initialPoint)
const loadError = ref(false)
let panoramaService = null
let panoramaInstance = null
let baiduMapLoaded = false

const currentPoint = computed(() => {
  return props.panoramaPoints[currentPointIndex.value] || { name: '全景浏览', lng: 116.4, lat: 40 }
})

// 动态加载百度地图API
const loadBaiduMapAPI = () => {
  return new Promise((resolve, reject) => {
    if (window.BMapGL) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${props.baiduMapKey}&callback=initBaiduMap`
    script.onerror = reject
    
    window.initBaiduMap = () => {
      baiduMapLoaded = true
      resolve()
    }
    
    document.head.appendChild(script)
  })
}

// 初始化百度全景
const initBaiduPanorama = async () => {
  if (!baiduPanorama.value) return

  try {
    loadError.value = false
    await loadBaiduMapAPI()

    // 创建全景服务
    panoramaService = new window.BMapGL.Panorama(baiduPanorama.value)
    
    // 监听全景加载失败（无街景数据时触发）
    panoramaService.addEventListener('position_changed', () => {
      loadError.value = false
    })

    // 设置全景位置
    const point = new window.BMapGL.Point(currentPoint.value.lng, currentPoint.value.lat)
    
    // 如果有指定的全景ID，使用ID；否则搜索最近的全景点
    if (currentPoint.value.panoId) {
      panoramaService.setId(currentPoint.value.panoId)
    } else {
      panoramaService.setPosition(point)
    }

    // 设置全景参数
    panoramaService.setPov({
      heading: 0,
      pitch: 0
    })

    // 延迟检测是否成功加载（无街景时 setPosition 不会报错，但容器为隐藏状态）
    setTimeout(() => {
      checkPanoramaLoaded()
    }, 4500)

    console.log('[百度全景] 初始化成功:', currentPoint.value.name)
    
  } catch (error) {
    console.error('[百度全景] 初始化失败:', error)
    loadError.value = true
  }
}

// 切换观景点
const switchPoint = async (index) => {
  if (index === currentPointIndex.value) return
  
  currentPointIndex.value = index
  loadError.value = false
  const point = props.panoramaPoints[index]
  
  // 若全景服务未初始化，先初始化
  if (!panoramaService) {
    await initBaiduPanorama()
    return
  }
  
  const baiduPoint = new window.BMapGL.Point(point.lng, point.lat)
  
  if (point.panoId) {
    panoramaService.setId(point.panoId)
  } else {
    panoramaService.setPosition(baiduPoint)
  }
  
  // 切换后重新检测
  setTimeout(() => {
    checkPanoramaLoaded()
  }, 4500)
  
  emit('point-change', index)
}

// 检测全景是否实际加载（百度无街景时不会创建可交互渲染层）
const checkPanoramaLoaded = () => {
  const container = baiduPanorama.value
  if (!container) return
  // 全景成功加载的标志：容器内存在非隐藏的 canvas（全景渲染层）
  const hasCanvas = container.querySelector('canvas') &&
    window.getComputedStyle(container.querySelector('canvas')).display !== 'none'
  if (!hasCanvas) {
    loadError.value = true
  }
}

// 关闭查看器
const closeViewer = () => {
  emit('close')
}

// 销毁全景
const destroyPanorama = () => {
  if (panoramaService) {
    // 百度地图全景没有destroy方法，清空容器即可
    if (baiduPanorama.value) {
      baiduPanorama.value.innerHTML = ''
    }
    panoramaService = null
  }
}

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      initBaiduPanorama()
    }, 100)
  } else {
    destroyPanorama()
  }
})

onMounted(() => {
  if (props.visible) {
    initBaiduPanorama()
  }
})

onBeforeUnmount(() => {
  destroyPanorama()
})

// 键盘控制
const handleKeydown = (e) => {
  if (!props.visible) return
  
  if (e.key === 'Escape') {
    closeViewer()
  } else if (e.key === 'ArrowLeft') {
    const prevIndex = currentPointIndex.value > 0 ? currentPointIndex.value - 1 : props.panoramaPoints.length - 1
    switchPoint(prevIndex)
  } else if (e.key === 'ArrowRight') {
    const nextIndex = currentPointIndex.value < props.panoramaPoints.length - 1 ? currentPointIndex.value + 1 : 0
    switchPoint(nextIndex)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.baidu-panorama-viewer-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panorama-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  animation: fadeIn 0.3s ease;
}

.panorama-container {
  position: relative;
  width: 95%;
  height: 95%;
  max-width: 1800px;
  max-height: 1000px;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  z-index: 1;
  animation: slideUp 0.4s ease;
}

.panorama-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
  border-bottom: 2px solid #4CAF50;
}

.panorama-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #fff;
  font-size: 1.2rem;
  font-weight: 600;
}

.panorama-title i {
  color: #4CAF50;
  font-size: 1.5rem;
}

.badge-realtime {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  background: linear-gradient(135deg, #2196F3, #1976D2);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-warning {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  background: linear-gradient(135deg, #ff9800, #f57c00);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  animation: pulse 2s ease-in-out infinite;
}

.panorama-controls {
  display: flex;
  gap: 0.5rem;
}

.control-btn {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #4CAF50;
  transform: translateY(-2px);
}

.close-btn:hover {
  background: #f44336;
  border-color: #f44336;
}

.panorama-content {
  flex: 1;
  width: 100%;
  position: relative;
  background: #000;
}

/* 暂无街景提示层 */
.pano-error-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(160deg, #1a2a4a, #0f1e3d);
  display: flex; align-items: center; justify-content: center;
  z-index: 5;
}
.pano-error-box {
  text-align: center; padding: 40px 60px; max-width: 460px;
}
.pano-error-icon {
  width: 72px; height: 72px; margin: 0 auto 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 32px;
  box-shadow: 0 10px 30px rgba(37, 99, 235, 0.4);
}
.pano-error-title {
  font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 12px;
}
.pano-error-desc {
  font-size: 14px; color: #94a3b8; line-height: 1.8; margin-bottom: 24px;
}
.pano-btn {
  padding: 10px 32px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none; border-radius: 22px; color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all 0.3s ease;
}
.pano-btn:hover {
  transform: translateY(-2px); box-shadow: 0 6px 18px rgba(37, 99, 235, 0.4);
}

/* 修复百度地图黑色方块问题 - 只隐藏特定的控件 */
.panorama-content :deep(.anchorBL) {
  opacity: 0.3 !important;
}

.panorama-footer {
  padding: 1rem;
  background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.panorama-info {
  margin-bottom: 0.75rem;
  text-align: center;
}

.info-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 8px;
  color: #4CAF50;
  font-size: 0.9rem;
}

.points-navigation {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.5rem 0;
}

.points-navigation::-webkit-scrollbar {
  height: 6px;
}

.points-navigation::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.points-navigation::-webkit-scrollbar-thumb {
  background: #4CAF50;
  border-radius: 3px;
}

.point-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  font-size: 0.95rem;
}

.point-btn i {
  color: #4CAF50;
}

.point-btn:hover {
  background: rgba(76, 175, 80, 0.2);
  border-color: #4CAF50;
  transform: translateY(-2px);
}

.point-btn.active {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  border-color: #4CAF50;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .panorama-container {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .panorama-header {
    padding: 0.75rem 1rem;
  }

  .panorama-title {
    font-size: 1rem;
  }

  .panorama-title > span:first-of-type {
    display: none;
  }

  .points-navigation {
    gap: 0.5rem;
  }

  .point-btn span {
    display: none;
  }

  .point-btn {
    padding: 0.75rem;
  }
}
</style>
