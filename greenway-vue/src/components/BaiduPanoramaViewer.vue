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

      <!-- 全景图片容器（百度全景静态图 API，支持视角旋转） -->
      <div class="panorama-content" ref="panoramaContent">
        <img
          v-if="!loadError && panoramaSrc"
          :src="panoramaSrc"
          class="panorama-img"
          alt="百度街景全景"
          draggable="false"
          @error="handleImageError"
          @load="handleImageLoad"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        />
        <div v-if="loading" class="panorama-loading">
          <div class="loading-spinner"></div>
          <span>加载街景中...</span>
        </div>

        <!-- 视角控制提示 -->
        <div v-if="!loadError && panoramaSrc" class="panorama-hint">
          <i class="fas fa-mouse-pointer"></i>
          拖拽旋转视角 · 滚轮缩放 · 方向键切换
        </div>

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
    default: 'YOUR_BAIDU_MAP_KEY' // 百度地图开放平台申请的密钥
  }
})

const emit = defineEmits(['close', 'point-change'])

const panoramaContent = ref(null)
const currentPointIndex = ref(props.initialPoint)
const loadError = ref(false)
const loading = ref(false)
const panoramaSrc = ref('')

// 视角状态
const heading = ref(0)   // 水平视角 0-360
const pitch = ref(0)     // 垂直视角 -45~45
const fov = ref(100)     // 视野宽度

// 拖拽状态
let dragging = false
let lastX = 0
let lastY = 0
let lastTouchDist = 0

const currentPoint = computed(() => {
  return props.panoramaPoints[currentPointIndex.value] || { name: '全景浏览', lng: 116.4, lat: 40 }
})

// 构造全景静态图 URL（百度全景静态图 API）
const buildPanoramaUrl = () => {
  const point = currentPoint.value
  const params = new URLSearchParams({
    ak: props.baiduMapKey,
    width: '1024',
    height: '512',
    location: `${point.lng},${point.lat}`,
    fov: String(fov.value),
    heading: String(Math.round(heading.value)),
    pitch: String(Math.round(pitch.value)),
    'auto': '0'
  })
  // 加时间戳避免浏览器缓存相同参数图片
  return `https://api.map.baidu.com/panorama/v2?${params.toString()}&_t=${Date.now()}`
}

// 加载全景
const loadPanorama = () => {
  const point = currentPoint.value
  if (!point || !point.lng || !point.lat) {
    loadError.value = true
    return
  }
  loading.value = true
  loadError.value = false
  panoramaSrc.value = buildPanoramaUrl()
}

// 图片加载成功（全景有效）
const handleImageLoad = () => {
  loading.value = false
  loadError.value = false
}

// 图片加载失败（无街景 / 参数非法）
const handleImageError = () => {
  loading.value = false
  loadError.value = true
  panoramaSrc.value = ''
}

// 旋转视角
const rotateView = (dHeading, dPitch) => {
  heading.value = (heading.value + dHeading + 360) % 360
  pitch.value = Math.max(-45, Math.min(45, pitch.value + dPitch))
  loadPanorama()
}

// 缩放视野
const zoomView = (delta) => {
  fov.value = Math.max(40, Math.min(140, fov.value + delta))
  loadPanorama()
}

// --- 鼠标拖拽 ---
const onMouseDown = (e) => {
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
}

const onMouseMove = (e) => {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  // 水平拖动旋转 heading，垂直拖动调整 pitch
  rotateView(dx * 0.8, dy * 0.6)
}

const onMouseUp = () => {
  dragging = false
}

// --- 触摸拖拽 ---
const onTouchStart = (e) => {
  if (e.touches.length === 1) {
    dragging = true
    lastX = e.touches[0].clientX
    lastY = e.touches[0].clientY
  } else if (e.touches.length === 2) {
    // 双指缩放
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    lastTouchDist = Math.sqrt(dx * dx + dy * dy)
  }
}

const onTouchMove = (e) => {
  e.preventDefault()
  if (e.touches.length === 1 && dragging) {
    const tx = e.touches[0].clientX
    const ty = e.touches[0].clientY
    const dx = tx - lastX
    const dy = ty - lastY
    lastX = tx
    lastY = ty
    rotateView(dx * 0.8, dy * 0.6)
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (lastTouchDist > 0) {
      const delta = dist - lastTouchDist
      zoomView(delta * -0.2)
    }
    lastTouchDist = dist
  }
}

const onTouchEnd = () => {
  dragging = false
  lastTouchDist = 0
}

// 切换观景点
const switchPoint = (index) => {
  if (index === currentPointIndex.value) return
  currentPointIndex.value = index
  heading.value = 0
  pitch.value = 0
  loadPanorama()
  emit('point-change', index)
}

// 关闭查看器
const closeViewer = () => {
  emit('close')
}

// 键盘控制
const handleKeydown = (e) => {
  if (!props.visible) return

  if (e.key === 'Escape') {
    closeViewer()
  } else if (e.key === 'ArrowLeft') {
    rotateView(-30, 0)
  } else if (e.key === 'ArrowRight') {
    rotateView(30, 0)
  } else if (e.key === 'ArrowUp') {
    rotateView(0, 10)
  } else if (e.key === 'ArrowDown') {
    rotateView(0, -10)
  }
}

// 滚轮缩放
const handleWheel = (e) => {
  if (!props.visible) return
  e.preventDefault()
  zoomView(e.deltaY > 0 ? 10 : -10)
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    heading.value = 0
    pitch.value = 0
    fov.value = 100
    setTimeout(() => {
      loadPanorama()
    }, 100)
  } else {
    panoramaSrc.value = ''
    loadError.value = false
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('wheel', handleWheel, { passive: false })
  if (props.visible) {
    loadPanorama()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('wheel', handleWheel)
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
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panorama-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
  touch-action: none;
}

.panorama-img:active {
  cursor: grabbing;
}

/* 加载指示 */
.panorama-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #94a3b8;
  font-size: 14px;
  z-index: 4;
}

.loading-spinner {
  width: 42px;
  height: 42px;
  border: 3px solid rgba(76, 175, 80, 0.2);
  border-top-color: #4CAF50;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 操作提示 */
.panorama-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.65);
  color: #e2e8f0;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 4;
  pointer-events: none;
  white-space: nowrap;
  backdrop-filter: blur(4px);
  transition: opacity 0.5s ease;
  animation: fadeIn 0.5s ease;
}

/* 暂无街景提示层 */
.pano-error-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(160deg, #1a2a4a, #0f1e3d);
  display: flex;
  align-items: center;
  justify-content: center;
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

  .panorama-hint {
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
