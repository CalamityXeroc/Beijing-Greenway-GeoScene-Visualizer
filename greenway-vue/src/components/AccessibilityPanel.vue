<template>
  <div class="acc-panel" :style="{ left: panelPos.x + 'px', top: panelPos.y + 'px' }">
    <!-- 头部（拖动把手） -->
    <div class="ap-header" @mousedown.prevent="startDrag"
         :style="{ cursor: isDragging ? 'grabbing' : 'grab' }">
      <span class="ap-title"><i class="fas fa-location-dot"></i> 绿道可达圈</span>
      <span class="ap-sub">看看您多久能到附近的绿道</span>
      <button class="ap-close" title="关闭" @mousedown.stop @click="$emit('close')">×</button>
    </div>

    <div class="ap-body">
      <!-- 起点 -->
      <div class="ap-section">
        <div class="ap-label">我的位置</div>
        <div class="ap-locate-row">
          <button class="ap-locate" :class="{ active: !picking && origin?.source === 'geo' }" :disabled="locating" @click="locateMe">
            <i class="fas" :class="locating ? 'fa-spinner fa-spin' : 'fa-crosshairs'"></i>
            {{ locating ? '定位中…' : '使用我的位置' }}
          </button>
          <button class="ap-locate ap-locate-alt" :class="{ active: picking || origin?.source === 'map' }" @click="handlePickOrigin">
            <i class="fas fa-map-pin"></i> 地图选点
          </button>
        </div>
        <p v-if="picking" class="ap-picking-hint"><i class="fas fa-hand-pointer"></i> 请在左侧地图上点击任意位置作为起点</p>
        <p v-if="origin && !picking" class="ap-origin-text"><i class="fas fa-check-circle"></i> 起点：{{ origin.address || origin.lng.toFixed(4) + ',' + origin.lat.toFixed(4) }}</p>
        <!-- 计算过程/失败/后端说明：给出可见反馈，避免“点了没反应” -->
        <p v-if="loading" class="ap-alert ap-alert--info"><i class="fas fa-spinner fa-spin"></i> 正在计算可达圈…</p>
        <p v-if="error" class="ap-alert ap-alert--err"><i class="fas fa-triangle-exclamation"></i> {{ error }}</p>
        <p v-if="notice" class="ap-alert ap-alert--info"><i class="fas fa-circle-info"></i> {{ notice }}</p>
      </div>

      <!-- 出行方式 -->
      <div class="ap-section">
        <div class="ap-label">出行方式</div>
        <div class="ap-toggle">
          <button class="ap-mode" :class="{ on: mode === 'walking' }" @click="setMode('walking')">🚶 步行</button>
          <button class="ap-mode" :class="{ on: mode === 'bicycling' }" @click="setMode('bicycling')">🚴 骑行</button>
        </div>
      </div>

      <!-- 计算结果 -->
      <template v-if="result">
        <div class="ap-section">
          <div class="ap-label">
            时间范围
            <span class="ap-minutes">{{ currentMin }} 分钟</span>
          </div>
          <input type="range" class="ap-slider" min="0" max="4" step="1" :value="currentIndex"
                 @input="changeIndex(parseInt($event.target.value))" />
          <div class="ap-slider-labels">
            <span v-for="(m, i) in LEVELS" :key="m" :class="{ on: i === currentIndex }" @click="changeIndex(i)">{{ m }}'</span>
          </div>
        </div>

        <div class="ap-result-head">
          <span class="ap-result-title"><i class="fas fa-route"></i> {{ currentMin }} 分钟内可达 <b>{{ reachableNow.length }}</b> 条绿道</span>
          <button class="ap-refresh" @click="recompute"><i class="fas fa-rotate-right"></i> 重算</button>
        </div>

        <div v-if="reachableNow.length" class="ap-list">
          <div v-for="gw in reachableNow" :key="gw.name" class="ap-item"
               @click="$emit('locate-greenway', gw)">
            <div class="ap-item-main">
              <div class="ap-name">{{ gw.name }}</div>
              <div class="ap-meta">
                <span class="ap-tag">{{ (gw.distM / 1000).toFixed(1) }} km</span>
                <span class="ap-tag">{{ gw.minutes }} 分钟</span>
              </div>
            </div>
            <button class="ap-go" @click.stop="$emit('go-route', gw)">去这里</button>
          </div>
        </div>
        <p v-else class="ap-empty">
          {{ currentMin }} 分钟内暂无可达绿道，试试切换<b>骑行</b>或放长时间？
        </p>
      </template>

      <!-- 未计算 -->
      <p v-else class="ap-empty ap-empty-hint">
        先定位或选点起点，再选出行方式，就能看到您 {{ mode === 'walking' ? '步行' : '骑行' }} 能到哪些绿道啦～
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { getApiBaseUrl } from '@/mobile/services/api'
import { wgs84ToGcj02 } from '@/utils/coordinateTransform'

const emit = defineEmits(['close', 'pick-origin', 'hull-change', 'origin-set', 'locate-greenway', 'go-route'])

/* ── 拖拽 ── */
const PANEL_W = 380
const panelPos = ref({ x: 60, y: 140 })
const isDragging = ref(false)
let dragStart = { mx: 0, my: 0, px: 0, py: 0 }
function startDrag(e) {
  if (e.target.closest('button')) return
  isDragging.value = true
  dragStart = { mx: e.clientX, my: e.clientY, px: panelPos.value.x, py: panelPos.value.y }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
}
function onDrag(e) {
  if (!isDragging.value) return
  panelPos.value = {
    x: Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, dragStart.px + e.clientX - dragStart.mx)),
    y: Math.max(76, Math.min(window.innerHeight - 90, dragStart.py + e.clientY - dragStart.my))
  }
}
function endDrag() {
  isDragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
}
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
})

/* ── 状态 ── */
const mode = ref('walking')
const origin = ref(null)
const result = ref(null)
const currentMin = ref(15)
const LEVELS = [5, 10, 15, 20, 30]
const currentIndex = computed(() => LEVELS.indexOf(currentMin.value))

function changeMin(m) { currentMin.value = m; emitHull() }
function changeIndex(i) { changeMin(LEVELS[i] ?? 15) }
const locating = ref(false)
const loading = ref(false)
const picking = ref(false)
const error = ref('')   // 计算失败原因（面板内可见反馈，替代 alert）
const notice = ref('')  // 后端说明，如“超出路网覆盖范围”

const reachableNow = computed(() => {
  if (!result.value) return []
  return result.value.greenways.filter(g => g.minutes <= currentMin.value)
})

function setMode(m) {
  mode.value = m
  if (origin.value) recompute()
}

function handlePickOrigin() {
  picking.value = !picking.value
  error.value = ''
  notice.value = ''
  emit('pick-origin', picking.value)
}

/* 起点已确定：立即通知父组件飞行并画出起点标记，不等计算完成。
   否则计算失败时（如超出路网覆盖范围）标记也不会出现，用户会以为选点没生效。 */
function publishOrigin() {
  if (!origin.value) return
  emit('origin-set', origin.value)
  emitHull({})
}

/* 供父组件调用：地图选点结果 */
function applyOrigin(pt) {
  picking.value = false
  origin.value = { ...pt, address: '地图选点', source: 'map' }
  publishOrigin()
  recompute()
}
defineExpose({ applyOrigin })

async function locateMe() {
  error.value = ''
  notice.value = ''
  if (!navigator.geolocation) {
    error.value = '您的浏览器不支持定位功能，请使用地图选点'
    return
  }
  // 浏览器仅在安全上下文（HTTPS / localhost）提供定位。
  // 通过局域网 IP 访问时 getCurrentPosition 必然失败，此处提前说明原因。
  if (!window.isSecureContext) {
    error.value = '当前地址非安全环境，浏览器已禁用定位。请改用「地图选点」，或通过 http://localhost:5173 访问'
    return
  }
  picking.value = false
  locating.value = true
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
    })
    // 浏览器 geolocation 返回 WGS-84，高德底图为 GCJ-02，需转换
    const gcj = wgs84ToGcj02(pos.coords.longitude, pos.coords.latitude)
    origin.value = { lng: gcj.lng, lat: gcj.lat, address: '我的位置', source: 'geo' }
    publishOrigin()
    await recompute()
  } catch {
    error.value = '定位失败，请使用地图选点'
  } finally {
    locating.value = false
  }
}

async function recompute() {
  if (!origin.value) return
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/accessibility/reach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: { lng: origin.value.lng, lat: origin.value.lat }, mode: mode.value })
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    notice.value = data.notice || ''
    // 超出路网覆盖范围时后端只返回说明而不给 hulls，此时不进入“结果”视图，
    // 否则会显示“可达 0 条绿道”的误导性结果（实际是未参与计算）
    if (data.notice && !Object.keys(data.hulls || {}).length) {
      result.value = null
      return
    }
    result.value = data
    // 计算成功：地图飞至起点 + 渲染多档等时圈
    publishOrigin()
    emitHull()
  } catch (e) {
    // 面板内提示替代 alert：起点标记仍保留在图上，便于用户换点重试
    result.value = null
    error.value = '可达圈计算失败：' + e.message
  } finally {
    loading.value = false
  }
}

function emitHull(hulls = result.value?.hulls || {}) {
  emit('hull-change', {
    hulls,
    minutes: currentMin.value,
    origin: origin.value
  })
}
</script>

<style scoped>
.acc-panel {
  position: absolute;
  z-index: 30;
  width: 380px;
  max-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--card-bg, rgba(255, 255, 255, 0.95));
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  font-family: inherit;
  box-sizing: border-box;
  user-select: none;
}
.ap-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.06));
  background: linear-gradient(135deg, rgba(25,118,210,0.08), rgba(79,195,247,0.03));
  touch-action: none;
}
.ap-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary, #1a2a1a);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ap-title i { color: #1976D2; }
.ap-sub { flex: 1; font-size: 0.72rem; color: var(--text-secondary, #888); }
.ap-close {
  border: none;
  background: rgba(0,0,0,0.05);
  border-radius: 50%;
  width: 26px;
  height: 26px;
  font-size: 1rem;
  color: var(--text-tertiary, #999);
  cursor: pointer;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.ap-close:hover { background: rgba(25,118,210,0.12); color: #1976D2; transform: rotate(90deg); }
.ap-body { padding: 12px 16px 16px; overflow-y: auto; }
.ap-section { margin-bottom: 14px; }
.ap-label { font-size: 0.8rem; font-weight: 700; color: var(--text-primary, #333); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
.ap-locate-row { display: flex; gap: 10px; }
.ap-locate {
  flex: 1;
  padding: 9px 0;
  border-radius: 10px;
  border: 1.5px solid var(--border-color, #e0e0e0);
  background: transparent;
  color: var(--text-secondary, #555);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.ap-locate:hover { border-color: #1976D2; color: #1565C0; background: rgba(25, 118, 210, 0.05); }
.ap-locate:disabled { opacity: 0.6; cursor: not-allowed; }
.ap-locate.active {
  border-color: #1976D2;
  background: rgba(25, 118, 210, 0.12);
  color: #1565C0;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.18);
}
.ap-locate-alt.active {
  border-color: #1976D2;
  background: rgba(25, 118, 210, 0.12);
  color: #1565C0;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.18);
}
.ap-locate-alt:hover { border-color: #1976D2; color: #1565C0; background: rgba(25,118,210,0.05); }
.ap-picking-hint { margin: 8px 0 0; font-size: 0.74rem; color: #E65100; display: flex; align-items: center; gap: 5px; font-weight: 600; }
.ap-origin-text { margin: 8px 0 0; font-size: 0.74rem; color: #2E7D32; display: flex; align-items: center; gap: 5px; }
.ap-toggle { display: flex; gap: 10px; }
.ap-mode {
  flex: 1;
  padding: 9px 0;
  border-radius: 10px;
  border: 1.5px solid var(--border-color, #e0e0e0);
  background: transparent;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-secondary, #555);
  cursor: pointer;
  transition: all 0.2s;
}
.ap-mode.on { border-color: #1976D2; background: rgba(25, 118, 210, 0.1); color: #1565C0; }
.ap-slider { width: 100%; accent-color: #1976D2; cursor: pointer; }
.ap-slider-labels { display: flex; justify-content: space-between; margin-top: 4px; }
.ap-slider-labels span { font-size: 0.68rem; color: var(--text-tertiary, #999); cursor: pointer; padding: 2px 6px; border-radius: 8px; }
.ap-slider-labels span.on { color: #1565C0; font-weight: 700; background: rgba(25,118,210,0.1); }
.ap-minutes { font-size: 0.78rem; color: #1565C0; font-weight: 700; }
.ap-result-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ap-result-title { font-size: 0.86rem; font-weight: 600; color: var(--text-primary, #333); }
.ap-result-title b { color: #1976D2; font-size: 1rem; }
.ap-refresh { border: none; background: transparent; color: #1976D2; font-size: 0.76rem; cursor: pointer; font-weight: 600; }
.ap-refresh:hover { text-decoration: underline; }
.ap-list { display: flex; flex-direction: column; gap: 8px; }
.ap-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(0,0,0,0.08));
  background: var(--bg-secondary, rgba(0,0,0,0.02));
  cursor: pointer;
  transition: all 0.2s;
}
.ap-item:hover { border-color: rgba(25,118,210,0.4); box-shadow: 0 4px 14px rgba(25,118,210,0.12); }
.ap-name { font-size: 0.9rem; font-weight: 700; color: var(--text-primary, #222); }
.ap-meta { display: flex; gap: 6px; margin-top: 5px; }
.ap-tag { font-size: 0.68rem; color: var(--text-secondary, #777); background: var(--bg-tertiary, rgba(0,0,0,0.05)); padding: 2px 8px; border-radius: 10px; }
.ap-go {
  flex: 0 0 auto;
  padding: 6px 14px;
  border: none;
  border-radius: 18px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #1565C0, #42A5F5);
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(21,101,192,0.25);
  transition: all 0.2s;
}
.ap-go:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(21,101,192,0.35); }
.ap-empty { text-align: center; color: var(--text-secondary, #888); font-size: 0.82rem; padding: 10px 0; line-height: 1.6; }
.ap-empty-hint { border: 1px dashed var(--border-color, #ddd); border-radius: 10px; padding: 16px 10px; }

/* 状态提示条：计算中 / 失败原因 / 后端说明 */
.ap-alert { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; font-size: 0.78rem; line-height: 1.55; display: flex; gap: 6px; align-items: flex-start; }
.ap-alert i { margin-top: 2px; flex: 0 0 auto; }
.ap-alert--err { color: #B3261E; background: rgba(179, 38, 30, 0.08); border: 1px solid rgba(179, 38, 30, 0.22); }
.ap-alert--info { color: #1565C0; background: rgba(25, 118, 210, 0.08); border: 1px solid rgba(25, 118, 210, 0.2); }

/* 手机端：面板全宽，避免溢出屏幕 */
@media (max-width: 480px) {
  .acc-panel {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
    left: 8px !important;
    top: 56px !important;
  }
}
</style>
