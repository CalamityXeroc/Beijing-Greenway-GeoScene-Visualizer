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

      <!-- 百度全景容器（BMapGL WebGL 全景） -->
      <div ref="baiduPanorama" class="panorama-content"></div>

      <!-- 静态图降级渲染层（BMapGL 权限不可用时启用） -->
      <div v-if="usingFallback" class="panorama-content fallback-layer">
        <img
          v-if="fallbackSrc && !loadError"
          :src="fallbackSrc"
          class="fallback-img"
          alt="百度街景全景"
          draggable="false"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
          @touchstart.passive="onTouchStart"
          @touchmove.passive="onTouchMove"
          @touchend="onTouchEnd"
        />
        <div v-if="fallbackLoading" class="panorama-loading">
          <div class="loading-spinner"></div>
          <span>加载街景中...</span>
        </div>
        <!-- 降级模式视角控制按钮 -->
        <div v-if="fallbackSrc && !loadError" class="fallback-controls">
          <button class="fb-btn" @click="rotateView(-30, 0)" title="左转">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="fb-btn fb-up" @click="rotateView(0, 10)" title="上移">
            <i class="fas fa-chevron-up"></i>
          </button>
          <button class="fb-btn" @click="rotateView(30, 0)" title="右转">
            <i class="fas fa-chevron-right"></i>
          </button>
          <button class="fb-btn fb-down" @click="rotateView(0, -10)" title="下移">
            <i class="fas fa-chevron-down"></i>
          </button>
          <button class="fb-btn fb-zoom-in" @click="zoomView(-10)" title="放大">
            <i class="fas fa-plus"></i>
          </button>
          <button class="fb-btn fb-zoom-out" @click="zoomView(10)" title="缩小">
            <i class="fas fa-minus"></i>
          </button>
          <button class="fb-btn fb-fullscreen" @click="toggleFallbackFullscreen" title="全屏">
            <i class="fas fa-expand"></i>
          </button>
        </div>
      </div>

      <!-- 暂无街景提示层 -->
      <div class="pano-error-overlay" v-if="loadError && !quotaExceeded">
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
      <div class="pano-error-overlay" v-if="loadError && quotaExceeded">
        <div class="pano-error-box">
          <div class="pano-error-icon quota-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="pano-error-title">百度街景服务暂不可用</div>
          <div class="pano-error-desc">
            百度全景接口今日访问量已达到免费配额上限，
            暂时无法加载街景影像，请明天再试或稍后刷新。
          </div>
          <div class="pano-error-actions">
            <button class="pano-btn" @click="closeViewer">关闭</button>
          </div>
        </div>
      </div>

      <!-- 底部导航（点位切换始终保留） -->
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
const quotaExceeded = ref(false)
let panoramaService = null
let panoramaInstance = null
let baiduMapLoaded = false

// ===== 静态图降级状态 =====
const usingFallback = ref(false)
const fallbackSrc = ref('')
const fallbackLoading = ref(false)
let fbHeading = 0
let fbPitch = 0
let fbFov = 100
let fbDragging = false
let fbLastX = 0
let fbLastY = 0
let fbLastTouchDist = 0

const currentPoint = computed(() => {
  return props.panoramaPoints[currentPointIndex.value] || { name: '全景浏览', lng: 116.4, lat: 40 }
})

// ================= BMapGL 主方案（原版逻辑） =================

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
    quotaExceeded.value = false
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

    console.log('[百度全景] BMapGL 初始化:', currentPoint.value.name)
    
  } catch (error) {
    console.error('[百度全景] BMapGL 初始化失败:', error)
    // BMapGL 不可用（如 JS API 权限被禁用）→ 降级到静态图
    startFallback()
  }
}

// 检测全景是否实际加载（百度无街景时不会创建可交互渲染层）
const checkPanoramaLoaded = () => {
  const container = baiduPanorama.value
  if (!container) return
  // BMapGL 渲染出的 canvas（即使权限被禁也会创建黑色 canvas）
  const hasCanvas = container.querySelector('canvas')
  // 探测该位置是否有真实街景数据（静态图 API）
  probePanoData(currentPoint.value).then(probeResult => {
    if (probeResult === 'quota') {
      // 百度日配额耗尽，提示稍后重试
      quotaExceeded.value = true
      loadError.value = true
      return
    }
    if (probeResult !== 'ok') {
      // 确实无街景数据
      loadError.value = true
      return
    }
    // 有街景数据：验证 BMapGL 是否真实显示（canvas 可见且有内容）
    const canvas = container.querySelector('canvas')
    const canvasVisible = canvas && window.getComputedStyle(canvas).display !== 'none'
    if (canvasVisible && canvas.width > 0) {
      // 读取 canvas 像素判断是否黑屏
      try {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const data = ctx.getImageData(0, 0, Math.min(50, canvas.width), Math.min(50, canvas.height)).data
          let brightness = 0
          let count = 0
          for (let i = 0; i < data.length; i += 40) {
            brightness += data[i] + data[i + 1] + data[i + 2]
            count++
          }
          const avg = count > 0 ? brightness / (count * 3) : 0
          if (avg > 8) {
            // 有真实内容
            return
          }
          // 黑屏 → BMapGL 权限问题 → 降级
          console.log('[百度全景] BMapGL 黑屏（JS API 权限被禁用），降级到静态图模式')
          startFallback()
          return
        }
      } catch (e) {
        // 读像素失败（跨域等）→ 视为正常，不降级
        return
      }
    }
    // canvas 不可见或无 canvas → 降级
    console.log('[百度全景] BMapGL 未渲染，降级到静态图模式')
    startFallback()
  })
}

// 探测该位置是否有街景数据（静态图 API 快速探测）
// 返回: 'ok' 有街景 / 'nopano' 无街景 / 'quota' 配额耗尽 / 'error' 其他
const probePanoData = (point) => {
  return new Promise((resolve) => {
    if (!point || !point.lng || !point.lat) {
      resolve('nopano')
      return
    }
    // 优先走同源代理（可读取错误 JSON，区分配额/无街景）
    const proxyUrl = `/baidu-pano/panorama/v2?${new URLSearchParams({
      ak: props.baiduMapKey,
      width: '96',
      height: '48',
      location: `${point.lng},${point.lat}`,
      fov: '100',
      heading: '0',
      pitch: '0'
    })}`
    fetch(proxyUrl)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const head = new Uint8Array(buf.slice(0, 2))
        if (head[0] === 0xff && head[1] === 0xd8) {
          resolve('ok')
        } else {
          const text = new TextDecoder().decode(buf.slice(0, 300))
          if (text.includes('配额') || text.includes('302') || text.includes('QPS') || text.includes('quota')) {
            resolve('quota')
          } else {
            resolve('nopano')
          }
        }
      })
      .catch(() => {
        // 代理不可用（如未配置）时回退 img 探测（img 不受 CORS 限制）
        const img = new Image()
        img.onload = () => {
          resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? 'ok' : 'nopano')
        }
        img.onerror = () => resolve('nopano')
        img.src = buildStaticUrl(point, 96, 48)
      })
  })
}

// 切换观景点
const switchPoint = async (index) => {
  if (index === currentPointIndex.value) return
  
  currentPointIndex.value = index
  loadError.value = false
  quotaExceeded.value = false
  
  // 降级模式下切换静态图
  if (usingFallback.value) {
    fbHeading = 0
    fbPitch = 0
    await loadFallbackImage()
    emit('point-change', index)
    return
  }
  
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
  usingFallback.value = false
  fallbackSrc.value = ''
  quotaExceeded.value = false
}

// ================= 静态图降级方案 =================

// 构造全景静态图 URL（fov=100 视角，拖拽旋转）
const buildStaticUrl = (point, w = 1024, h = 512) => {
  const params = new URLSearchParams({
    ak: props.baiduMapKey,
    width: String(w),
    height: String(h),
    location: `${point.lng},${point.lat}`,
    fov: String(fbFov),
    heading: String(Math.round(fbHeading)),
    pitch: String(Math.round(fbPitch))
  })
  // 走同源代理（百度 API 不支持 CORS，且 img 直连无法读取配额错误）
  return `/baidu-pano/panorama/v2?${params.toString()}&_t=${Date.now()}`
}

// 加载降级全景图
const loadFallbackImage = () => {
  return new Promise((resolve) => {
    const point = currentPoint.value
    if (!point || !point.lng || !point.lat) {
      loadError.value = true
      fallbackLoading.value = false
      resolve(false)
      return
    }
    fallbackLoading.value = true
    loadError.value = false
    const url = buildStaticUrl(point)
    // 用 fetch 走代理（可读取错误 JSON，区分配额/无街景）
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const head = new Uint8Array(buf.slice(0, 2))
        if (head[0] === 0xff && head[1] === 0xd8) {
          // 有效图片
          const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }))
          fallbackSrc.value = blobUrl
          fallbackLoading.value = false
          resolve(true)
        } else {
          const text = new TextDecoder().decode(buf.slice(0, 300))
          if (text.includes('配额') || text.includes('302') || text.includes('QPS') || text.includes('quota')) {
            quotaExceeded.value = true
          }
          fallbackLoading.value = false
          loadError.value = true
          resolve(false)
        }
      })
      .catch(() => {
        fallbackLoading.value = false
        loadError.value = true
        resolve(false)
      })
  })
}

// 启动降级模式
const startFallback = async () => {
  if (usingFallback.value) return
  // 清空 BMapGL 容器
  if (baiduPanorama.value) {
    baiduPanorama.value.innerHTML = ''
  }
  usingFallback.value = true
  await loadFallbackImage()
}

// 旋转视角
const rotateView = (dHeading, dPitch) => {
  fbHeading = (fbHeading + dHeading + 360) % 360
  fbPitch = Math.max(-45, Math.min(45, fbPitch + dPitch))
  loadFallbackImage()
}

// 缩放
const zoomView = (delta) => {
  fbFov = Math.max(40, Math.min(140, fbFov + delta))
  loadFallbackImage()
}

// 降级模式全屏
const toggleFallbackFullscreen = () => {
  const container = baiduPanorama.value && baiduPanorama.value.parentElement
  const target = document.querySelector('.fallback-layer')
  if (!target) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    target.requestFullscreen && target.requestFullscreen()
  }
}

// 鼠标拖拽
const onMouseDown = (e) => {
  fbDragging = true
  fbLastX = e.clientX
  fbLastY = e.clientY
}
const onMouseMove = (e) => {
  if (!fbDragging) return
  const dx = e.clientX - fbLastX
  const dy = e.clientY - fbLastY
  fbLastX = e.clientX
  fbLastY = e.clientY
  rotateView(dx * 0.8, dy * 0.6)
}
const onMouseUp = () => { fbDragging = false }

// 触摸拖拽
const onTouchStart = (e) => {
  if (e.touches.length === 1) {
    fbDragging = true
    fbLastX = e.touches[0].clientX
    fbLastY = e.touches[0].clientY
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    fbLastTouchDist = Math.sqrt(dx * dx + dy * dy)
  }
}
const onTouchMove = (e) => {
  e.preventDefault()
  if (e.touches.length === 1 && fbDragging) {
    const tx = e.touches[0].clientX
    const ty = e.touches[0].clientY
    const dx = tx - fbLastX
    const dy = ty - fbLastY
    fbLastX = tx
    fbLastY = ty
    rotateView(dx * 0.8, dy * 0.6)
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (fbLastTouchDist > 0) {
      zoomView((dist - fbLastTouchDist) * -0.2)
    }
    fbLastTouchDist = dist
  }
}
const onTouchEnd = () => {
  fbDragging = false
  fbLastTouchDist = 0
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
    if (usingFallback.value) {
      rotateView(-30, 0)
    } else {
      const prevIndex = currentPointIndex.value > 0 ? currentPointIndex.value - 1 : props.panoramaPoints.length - 1
      switchPoint(prevIndex)
    }
  } else if (e.key === 'ArrowRight') {
    if (usingFallback.value) {
      rotateView(30, 0)
    } else {
      const nextIndex = currentPointIndex.value < props.panoramaPoints.length - 1 ? currentPointIndex.value + 1 : 0
      switchPoint(nextIndex)
    }
  } else if (e.key === 'ArrowUp') {
    if (usingFallback.value) rotateView(0, 10)
  } else if (e.key === 'ArrowDown') {
    if (usingFallback.value) rotateView(0, -10)
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

/* 静态图降级层 */
.fallback-layer {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 3;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fallback-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
  touch-action: none;
}

.fallback-img:active {
  cursor: grabbing;
}

/* 降级模式控制按钮 */
.fallback-controls {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 4;
}

.fb-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  backdrop-filter: blur(4px);
}

.fb-btn:hover {
  background: rgba(76, 175, 80, 0.6);
  border-color: #4CAF50;
  transform: scale(1.08);
}

.fb-up, .fb-down, .fb-zoom-in, .fb-zoom-out {
  position: absolute;
}

.fb-up { top: -52px; left: 0; }
.fb-down { top: 52px; left: 0; }
.fb-zoom-in { bottom: -52px; left: 0; }
.fb-zoom-out { bottom: 0; left: -52px; }
.fb-fullscreen { margin-top: 8px; }

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

  .fallback-controls {
    right: 8px;
  }

  .fb-btn {
    width: 36px;
    height: 36px;
  }
}
</style>
