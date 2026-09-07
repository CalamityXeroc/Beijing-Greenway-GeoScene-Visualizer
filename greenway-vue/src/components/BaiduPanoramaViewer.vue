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

      <!-- 全景容器（Photo Sphere Viewer 渲染完整 360° 全景，支持拖拽旋转/缩放/全屏） -->
      <div ref="viewerContainer" class="panorama-content"></div>

      <!-- 加载中提示 -->
      <div v-if="loading && !loadError" class="panorama-loading">
        <div class="loading-spinner"></div>
        <span>加载街景中...</span>
      </div>

      <!-- 暂无街景提示层 -->
      <div class="pano-error-overlay" v-if="loadError && errorType === 'nopano'">
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

      <!-- 配额耗尽提示层 -->
      <div class="pano-error-overlay" v-if="loadError && errorType === 'quota'">
        <div class="pano-error-box">
          <div class="pano-error-icon quota-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="pano-error-title">百度街景服务暂不可用</div>
          <div class="pano-error-desc">
            百度全景接口今日访问量已达到免费配额上限（每日 100 次），
            暂时无法加载街景影像，请明天再试或稍后刷新。
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
import { Viewer } from '@photo-sphere-viewer/core'
import '@photo-sphere-viewer/core/index.css'

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

// 全景静态图属于服务端 API，与浏览器端 JS API 的 AK 分开；
// 未配置 VITE_BAIDU_STATIC_KEY 时回退到传入的 key
const staticKey = import.meta.env.VITE_BAIDU_STATIC_KEY || props.baiduMapKey

const viewerContainer = ref(null)
const currentPointIndex = ref(props.initialPoint)
const loadError = ref(false)
const errorType = ref('nopano') // 'nopano' 无街景 | 'quota' 配额耗尽
const loading = ref(false)
let viewer = null

const currentPoint = computed(() => {
  return props.panoramaPoints[currentPointIndex.value] || { name: '全景浏览', lng: 116.4, lat: 40 }
})

// 构造完整 360° 全景图 URL（fov=360 输出 2:1 等距柱状投影，一次请求本地无限旋转）
// 走 /baidu-pano 同源代理（百度 API 不支持 CORS）
const buildPanoUrl = (point) => {
  const params = new URLSearchParams({
    ak: staticKey,
    width: '1024',
    height: '512',
    location: `${point.lng},${point.lat}`,
    fov: '360',
    heading: '0',
    pitch: '0'
  })
  return `/baidu-pano/panorama/v2?${params.toString()}&_t=${Date.now()}`
}

// 加载全景图（走代理 fetch，可读取错误 JSON 区分配额/无街景）
const loadPanoImage = (point) => {
  return new Promise((resolve, reject) => {
    if (!point || !point.lng || !point.lat) {
      reject(new Error('nopano'))
      return
    }
    fetch(buildPanoUrl(point))
      .then(r => r.arrayBuffer())
      .then(buf => {
        const head = new Uint8Array(buf.slice(0, 2))
        if (head[0] === 0xff && head[1] === 0xd8) {
          // 有效 JPEG → blob URL 交给 PSV（同源 blob 无 CORS 问题）
          const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }))
          resolve(blobUrl)
        } else {
          const text = new TextDecoder().decode(buf.slice(0, 300))
          if (text.includes('配额') || text.includes('302') || text.includes('QPS') || text.includes('quota')) {
            reject(new Error('quota'))
          } else {
            reject(new Error('nopano'))
          }
        }
      })
      .catch(() => reject(new Error('nopano')))
  })
}

// 初始化查看器
const initViewer = async () => {
  if (!viewerContainer.value) return

  loading.value = true
  loadError.value = false

  try {
    const point = currentPoint.value
    const url = await loadPanoImage(point)

    // 销毁旧查看器
    if (viewer) {
      viewer.destroy()
      viewer = null
    }

    viewer = new Viewer({
      container: viewerContainer.value,
      panorama: url,
      caption: point.description,
      // 缩放 / 视角移动 / 全屏 按钮（全屏为浏览器原生全屏）
      navbar: ['zoom', 'move', 'fullscreen'],
      defaultZoomLvl: 50,
      mousewheel: true,
      mousemove: true,
      keyboard: true,
      fisheye: false,
      minFov: 30,
      maxFov: 90,
      defaultYaw: 0,
      defaultPitch: 0
    })

    viewer.addEventListener('ready', () => {
      loading.value = false
    })

    viewer.addEventListener('panorama-error', () => {
      loading.value = false
      loadError.value = true
      errorType.value = 'nopano'
    })

    console.log('[百度全景] 加载成功:', point.name)
  } catch (error) {
    loading.value = false
    loadError.value = true
    errorType.value = error.message === 'quota' ? 'quota' : 'nopano'
    console.error('[百度全景] 加载失败:', error.message)
  }
}

// 切换观景点（每点位一次请求，旋转/缩放本地零消耗）
const switchPoint = async (index) => {
  if (index === currentPointIndex.value) return

  currentPointIndex.value = index
  emit('point-change', index)
  loadError.value = false

  if (!viewer) {
    await initViewer()
    return
  }

  loading.value = true
  try {
    const point = props.panoramaPoints[index]
    const url = await loadPanoImage(point)
    await viewer.setPanorama(url, {
      transition: 600,
      caption: point.description
    })
    loading.value = false
  } catch (error) {
    loading.value = false
    loadError.value = true
    errorType.value = error.message === 'quota' ? 'quota' : 'nopano'
  }
}

// 关闭查看器
const closeViewer = () => {
  emit('close')
}

// 销毁查看器
const destroyViewer = () => {
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
}

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      initViewer()
    }, 100)
  } else {
    destroyViewer()
  }
})

onMounted(() => {
  if (props.visible) {
    initViewer()
  }
})

onBeforeUnmount(() => {
  destroyViewer()
})

// Esc 关闭（方向键/缩放由 PSV keyboard 接管）
const handleKeydown = (e) => {
  if (!props.visible) return
  if (e.key === 'Escape') {
    closeViewer()
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

/* PSV 容器铺满 */
.panorama-content :deep(.psv-container) {
  width: 100% !important;
  height: 100% !important;
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
  z-index: 6;
  background: rgba(0, 0, 0, 0.5);
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

/* 暂无街景提示层 */
.pano-error-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(160deg, #1a2a4a, #0f1e3d);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 7;
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
.pano-error-icon.quota-icon {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 10px 30px rgba(217, 119, 6, 0.4);
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
