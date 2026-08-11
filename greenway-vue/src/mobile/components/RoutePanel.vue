<template>
  <div class="route-panel" :class="{ 'theme-dark': isDark }">
    <!-- 头部 -->
    <header class="rp-header">
      <div class="rp-title">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>
        </svg>
        路径规划
      </div>
      <button class="rp-close" @click="$emit('close')" aria-label="关闭">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </header>

    <!-- 出行方式 -->
    <div class="rp-mode">
      <button class="rp-mode-btn" :class="{ active: travelMode === 'walking' }" @click="setMode('walking')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM7 21l2-6M17 21l-3-7-4 2"/></svg>
        步行
      </button>
      <button class="rp-mode-btn" :class="{ active: travelMode === 'bicycling' }" @click="setMode('bicycling')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 17.5V14l-3-3 4-3 2 3h2"/></svg>
        骑行
      </button>
    </div>

    <!-- 起终点 -->
    <div class="rp-inputs">
      <div class="rp-input-row" :class="{ picking: activeInput === 'origin' }">
        <span class="rp-dot start"></span>
        <button class="rp-input-btn" @click="togglePick('origin')">
          <span v-if="origin" class="rp-input-val">{{ origin.address }}</span>
          <span v-else class="rp-input-ph">点击地图选择起点</span>
        </button>
        <button class="rp-locate" @click="useMyLocation('origin')" aria-label="我的位置">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>

      <div class="rp-input-row" :class="{ picking: activeInput === 'destination' }">
        <span class="rp-dot end"></span>
        <button class="rp-input-btn" @click="togglePick('destination')">
          <span v-if="destination" class="rp-input-val">{{ destination.address }}</span>
          <span v-else class="rp-input-ph">点击地图选择终点</span>
        </button>
        <button class="rp-locate" @click="useMyLocation('destination')" aria-label="我的位置">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="rp-error">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ error }}
    </div>

    <!-- 规划按钮 -->
    <button class="rp-plan-btn" :disabled="!hasRequired || isPlanning" @click="doPlan">
      <span v-if="isPlanning" class="rp-spinner"></span>
      <span v-else>开始规划</span>
    </button>

    <!-- 结果 -->
    <div v-if="routeResult" class="rp-result">
      <div class="rp-stats">
        <div class="rp-stat">
          <span class="rp-stat-val font-number">{{ formatDistance(routeDistance) }}</span>
          <span class="rp-stat-label">距离</span>
        </div>
        <div class="rp-stat">
          <span class="rp-stat-val font-number">{{ formatDuration(routeDuration) }}</span>
          <span class="rp-stat-label">预计耗时</span>
        </div>
      </div>
      <div v-if="routeSteps.length" class="rp-steps">
        <div v-for="(s, i) in routeSteps" :key="i" class="rp-step">
          <span class="rp-step-idx">{{ i + 1 }}</span>
          <span class="rp-step-text">{{ s.instruction }}</span>
          <span class="rp-step-dist">{{ formatDistance(s.distance) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { planRoute } from '../services/api'
import { useAppTheme } from '../composables/useAppTheme'
import { useLocation } from '../composables/useLocation'
import { toast } from '../composables/useToast'

const emit = defineEmits(['close', 'route-ready'])

const { isDark } = useAppTheme()
const { fetchLocation, userLocation } = useLocation()

const origin = ref(null)
const destination = ref(null)
const travelMode = ref('walking')
const isPlanning = ref(false)
const routeResult = ref(null)
const activeInput = ref(null)
const error = ref('')

const hasRequired = computed(() => origin.value && destination.value)

const routeDistance = computed(() => routeResult.value?.paths?.[0]?.distance || 0)
const routeDuration = computed(() => routeResult.value?.paths?.[0]?.duration || 0)
const routeSteps = computed(() => routeResult.value?.paths?.[0]?.steps || [])

/* ---------- 工具 ---------- */
const formatDistance = (m) => {
  if (!m && m !== 0) return '--'
  const n = Number(m)
  if (n >= 1000) return `${(n / 1000).toFixed(1)} 公里`
  return `${Math.round(n)} 米`
}
const formatDuration = (s) => {
  if (!s && s !== 0) return '--'
  const n = Number(s)
  if (n >= 3600) return `${Math.floor(n / 3600)} 时 ${Math.floor((n % 3600) / 60)} 分`
  if (n >= 60) return `${Math.floor(n / 60)} 分`
  return `${Math.round(n)} 秒`
}
const reverseGeocode = async (lng, lat) => {
  try {
    const { getApiBaseUrl } = await import('../services/api')
    const res = await fetch(`${getApiBaseUrl()}/api/gaode/regeocode?location=${lng},${lat}`)
    const data = await res.json()
    return data.regeocode?.formatted_address || `${lng.toFixed(5)}, ${lat.toFixed(5)}`
  } catch {
    return `${lng.toFixed(5)}, ${lat.toFixed(5)}`
  }
}

/* ---------- 交互 ---------- */
const setMode = (mode) => {
  travelMode.value = mode
  routeResult.value = null
  error.value = ''
}

const togglePick = (target) => {
  activeInput.value = activeInput.value === target ? null : target
  error.value = ''
}

const setPoint = (target, point) => {
  if (target === 'origin') origin.value = point
  else destination.value = point
  routeResult.value = null
  error.value = ''
}

const useMyLocation = async (target) => {
  if (!userLocation.value) {
    await fetchLocation(false)
  }
  if (!userLocation.value) {
    error.value = '无法获取当前位置，请检查定位权限'
    return
  }
  const { lng, lat } = userLocation.value
  const address = await reverseGeocode(lng, lat)
  setPoint(target, { lng, lat, address: address || '我的位置' })
  toast('已使用当前位置', 'success')
}

/* 地图点选（由 MapView 调用） */
const isPicking = () => !!activeInput.value

const handleMapPick = async (lng, lat) => {
  if (!activeInput.value) return
  const target = activeInput.value
  const address = await reverseGeocode(lng, lat)
  setPoint(target, { lng, lat, address })
  activeInput.value = null
  toast(target === 'origin' ? '起点已设置' : '终点已设置', 'success')
}

/* ---------- 规划 ---------- */
const doPlan = async () => {
  if (!hasRequired.value) return
  isPlanning.value = true
  error.value = ''
  routeResult.value = null
  try {
    const route = await planRoute(
      { lng: origin.value.lng, lat: origin.value.lat },
      { lng: destination.value.lng, lat: destination.value.lat },
      travelMode.value
    )
    if (!route?.paths?.[0]) throw new Error('未找到可行路线')
    routeResult.value = route
    emitRoute()
  } catch (e) {
    error.value = e.message || '路径规划失败，请重试'
  } finally {
    isPlanning.value = false
  }
}

const emitRoute = () => {
  emit('route-ready', {
    route: routeResult.value,
    origin: origin.value,
    destination: destination.value
  })
}

defineExpose({ isPicking, handleMapPick })
</script>

<style scoped>
.route-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px calc(16px + var(--safe-bottom));
}

/* 头部 */
.rp-header { display: flex; align-items: center; justify-content: space-between; }
.rp-title {
  display: flex; align-items: center; gap: 8px;
  font-size: var(--text-lg); font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.rp-title svg { color: var(--color-ocean); }
.rp-close {
  width: 34px; height: 34px; border: none; border-radius: 50%;
  background: var(--color-surface-2); color: var(--color-text-tertiary);
  display: flex; align-items: center; justify-content: center;
}

/* 出行方式 */
.rp-mode { display: flex; gap: 8px; }
.rp-mode-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 40px; border: 1px solid var(--color-border); border-radius: var(--radius-full);
  background: var(--color-surface); color: var(--color-text-secondary);
  font-size: var(--text-base); font-weight: var(--font-weight-medium);
  transition: all var(--transition-fast);
}
.rp-mode-btn.active {
  background: var(--fill-info); border-color: var(--color-ocean); color: var(--color-ocean);
  font-weight: var(--font-weight-semibold);
}

/* 起终点输入 */
.rp-inputs { display: flex; flex-direction: column; gap: 8px; }
.rp-input-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: var(--color-surface);
  transition: border-color var(--transition-fast);
}
.rp-input-row.picking { border-color: var(--color-ocean); box-shadow: 0 0 0 3px var(--fill-info); }
.rp-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.rp-dot.start { background: var(--color-success); }
.rp-dot.end { background: var(--color-error); }
.rp-input-btn {
  flex: 1; min-width: 0; border: none; background: none; padding: 0;
  text-align: left; font-size: var(--text-base);
}
.rp-input-val { color: var(--color-text-primary); font-weight: var(--font-weight-medium); }
.rp-input-ph { color: var(--color-text-tertiary); }
.rp-locate {
  width: 32px; height: 32px; border: none; border-radius: 50%;
  background: var(--color-surface-2); color: var(--color-text-secondary);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

/* 错误 */
.rp-error {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: var(--radius-md);
  background: var(--fill-error); color: var(--color-error);
  font-size: var(--text-sm);
}

/* 规划按钮 */
.rp-plan-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: 46px; border: none; border-radius: var(--radius-full);
  background: var(--gradient-ocean); color: #fff;
  font-size: var(--text-base); font-weight: var(--font-weight-semibold);
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.rp-plan-btn:active:not(:disabled) { transform: scale(0.97); }
.rp-plan-btn:disabled { opacity: var(--opacity-disabled); box-shadow: none; }
.rp-spinner {
  width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff; border-radius: 50%; animation: rp-spin 0.8s linear infinite;
}
@keyframes rp-spin { to { transform: rotate(360deg); } }

/* 结果 */
.rp-result { display: flex; flex-direction: column; gap: 12px; }
.rp-stats { display: flex; gap: 10px; }
.rp-stat {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 12px; border-radius: var(--radius-md); background: var(--color-surface-2);
}
.rp-stat-val { font-size: var(--text-lg); font-weight: var(--font-weight-bold); color: var(--color-ocean); }
.rp-stat-label { font-size: var(--text-xs); color: var(--color-text-tertiary); }
.rp-steps { display: flex; flex-direction: column; max-height: 160px; overflow-y: auto; }
.rp-step {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 0.5px solid var(--color-divider);
  font-size: var(--text-sm);
}
.rp-step:last-child { border-bottom: none; }
.rp-step-idx {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  background: var(--fill-info); color: var(--color-ocean);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: var(--font-weight-bold);
}
.rp-step-text { flex: 1; color: var(--color-text-primary); }
.rp-step-dist { flex-shrink: 0; color: var(--color-text-tertiary); font-size: var(--text-xs); }
</style>
