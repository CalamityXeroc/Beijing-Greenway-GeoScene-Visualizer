<template>
  <section class="weather-block" :class="{ loading: loading }">
    <div class="wb-header">
      <h3 class="wb-title">实时天气</h3>
      <button class="wb-refresh" :class="{ spinning: loading }" :disabled="loading" @click="fetchWeather" aria-label="刷新">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      </button>
    </div>

    <div v-if="loading && !weather" class="wb-skeleton">
      <div class="wb-skel-temp skeleton"></div>
      <div class="wb-skel-line skeleton"></div>
    </div>

    <div v-else-if="error" class="wb-error">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="weather" class="wb-content">
      <div class="wb-main">
        <span class="wb-temp font-number">{{ weather.temperature }}<span class="wb-temp-unit">°C</span></span>
        <div class="wb-desc">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="weatherIconPath"/></svg>
          <span>{{ weather.weather }}</span>
        </div>
      </div>
      <div class="wb-details">
        <div class="wb-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
          <span>{{ weather.winddirection }}风 {{ weather.windpower }}级</span>
        </div>
        <div class="wb-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><line x1="12.65" y1="19.04" x2="17.5" y2="14.19"/></svg>
          <span>湿度 {{ weather.humidity }}%</span>
        </div>
        <div class="wb-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>{{ weather.city }}</span>
        </div>
      </div>
      <div class="wb-reporttime">{{ weather.reporttime }}</div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { fetchWeather as fetchWeatherApi } from '../services/api'

const props = defineProps({
  longitude: { type: Number, required: true },
  latitude: { type: Number, required: true },
  locationLabel: { type: String, default: '' }
})

const weather = ref(null)
const loading = ref(false)
const error = ref(null)

// 天气描述 → SVG 路径映射（用内联 SVG，不依赖字体图标库）
const weatherIconMap = {
  '晴': 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  '多云': 'M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.7M8 19h9.5',
  '阴': 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  '雨': 'M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25',
  '雪': 'M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01',
  '雾': 'M3 8h18M3 12h18M3 16h18'
}
const weatherIconPath = computed(() => {
  const w = weather.value?.weather || ''
  for (const key of Object.keys(weatherIconMap)) {
    if (w.includes(key)) return weatherIconMap[key]
  }
  return weatherIconMap['多云'] // 兜底
})

const fetchWeather = async () => {
  if (!props.longitude || !props.latitude) return
  loading.value = true
  error.value = null
  try {
    weather.value = await fetchWeatherApi(props.longitude, props.latitude)
  } catch (e) {
    error.value = e.message || '天气数据加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(fetchWeather)
</script>

<style scoped>
.weather-block {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  border: 0.5px solid var(--color-border-light);
}
.wb-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.wb-title { font-size: var(--text-heading-md); font-weight: var(--font-weight-bold); color: var(--color-text-primary); letter-spacing: -0.2px; }
.wb-refresh {
  width: 30px; height: 30px; border: none; border-radius: 50%;
  background: var(--color-surface-2); color: var(--color-text-secondary);
  display: flex; align-items: center; justify-content: center;
  transition: transform var(--transition-fast);
}
.wb-refresh:active:not(:disabled) { transform: scale(0.88); }
.wb-refresh.spinning svg { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.wb-content { display: flex; flex-direction: column; gap: 12px; }
.wb-main { display: flex; align-items: center; justify-content: space-between; }
.wb-temp {
  font-size: 36px; font-weight: var(--font-weight-bold); color: var(--color-text-primary);
  line-height: 1; letter-spacing: -1px;
}
.wb-temp-unit { font-size: 18px; font-weight: var(--font-weight-medium); color: var(--color-text-secondary); margin-left: 2px; }
.wb-desc { display: flex; align-items: center; gap: 6px; font-size: var(--text-base); color: var(--color-ocean); font-weight: var(--font-weight-medium); }

.wb-details { display: flex; flex-wrap: wrap; gap: 8px 16px; padding-top: 12px; border-top: 0.5px solid var(--color-divider); }
.wb-detail { display: flex; align-items: center; gap: 5px; font-size: var(--text-sm); color: var(--color-text-secondary); }
.wb-detail svg { color: var(--color-text-tertiary); flex-shrink: 0; }

.wb-reporttime { font-size: 10px; color: var(--color-text-tertiary); text-align: right; }

/* 骨架屏 */
.wb-skeleton { display: flex; flex-direction: column; gap: 12px; }
.wb-skel-temp { width: 110px; height: 38px; border-radius: var(--radius-md); }
.wb-skel-line { width: 60%; height: 14px; border-radius: var(--radius-sm); }

/* 错误 */
.wb-error { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 0; color: var(--color-text-tertiary); font-size: var(--text-sm); }
.wb-error svg { opacity: 0.4; }
</style>
