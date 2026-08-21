<template>
  <button class="trail-card" :class="variant === 'card' ? 'trail-card--large' : ''" @click="handleClick" type="button">
    <div class="card-thumb" :class="{ 'thumb--full': variant === 'card' }">
      <img v-if="imgSrc" :src="imgSrc" :alt="trail.name" class="thumb-img" @error="onImgError" loading="lazy" />
      <div v-else class="thumb-fallback" :style="{ background: fallbackBg }">
        <span class="thumb-letter">{{ fallbackLetter }}</span>
      </div>
      <div v-if="variant === 'card'" class="thumb-shade"></div>
      <span v-if="trail.difficulty" class="diff-badge" :class="'diff-' + trail.difficulty">{{ diffText }}</span>
      <div v-if="variant === 'card'" class="thumb-top-row">
        <span class="thumb-area">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {{ trail.area || trail.district || '北京' }}
        </span>
      </div>
      <div v-if="variant === 'card'" class="thumb-caption">
        <h3 class="thumb-name">{{ trail.name }}</h3>
        <div class="thumb-metrics">
          <span class="thumb-metric"><b class="font-number">{{ trail.length ?? '—' }}</b>km 里程</span>
          <span class="thumb-metric-dot"></span>
          <span class="thumb-metric"><b class="font-number">{{ durationNum }}</b>h 耗时</span>
        </div>
      </div>
    </div>
    <div v-if="variant !== 'card'" class="card-body">
      <h3 class="trail-name">{{ trail.name }}</h3>
      <p v-if="cleanDesc" class="trail-desc line-clamp-2">{{ cleanDesc }}</p>
      <div class="card-meta">
        <span v-if="trail.length" class="meta-chip">· {{ trail.length }}km</span>
        <span v-if="trail.duration" class="meta-chip">{{ trail.duration }}</span>
        <span v-if="trail.tags && trail.tags[0]" class="meta-tag">{{ trail.tags[0] }}</span>
      </div>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { formatDistance } from '../composables/useLocation'

const props = defineProps({
  trail: { type: Object, required: true },
  distanceKm: { type: Number, default: null },
  variant: { type: String, default: 'list' } // 'list' 紧凑 | 'card' 横向大卡
})
const emit = defineEmits(['click', 'toggle-favorite'])

const diffText = computed(() => ({ easy: '简单', medium: '中等', hard: '困难' })[props.trail.difficulty] ?? '')

const distanceText = computed(() => {
  if (props.distanceKm == null) return ''
  return '距您 ' + formatDistance(props.distanceKm)
})

// 大卡距离拆成数字+单位
const distanceNum = computed(() => {
  if (props.distanceKm == null) return ''
  return props.distanceKm < 1 ? String(Math.round(props.distanceKm * 1000)) : props.distanceKm.toFixed(1)
})
const distanceUnit = computed(() => {
  if (props.distanceKm == null) return ''
  return props.distanceKm < 1 ? 'm' : 'km'
})

// 从耗时文本解析小时数（"1小时以内"→1，"2-3小时"→2.5，"5小时以上"→5）
const durationNum = computed(() => {
  const d = props.trail.duration || ''
  const m = d.match(/(\d+(?:\.\d+)?)/g)
  if (!m) return '—'
  const nums = m.map(Number)
  return nums.length > 1 ? (nums[0] + nums[nums.length - 1]) / 2 : nums[0]
})

const cleanDesc = computed(() => {
  const raw = props.trail.description || ''
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[�￾￿]/g, '')
    .replace(/[^一-龥　-〿＀-￯ -~a-zA-Z0-9\s.,，。！？]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
})

const imgSrc = computed(() => (props.trail.image ? `/images/greenways/${props.trail.image}` : null))

const fallbackLetter = computed(() => String(props.trail.name || '绿').slice(0, 1))
const fallbackBg = computed(() => {
  const colors = [
    'linear-gradient(135deg, #16a34a, #4ade80)',
    'linear-gradient(135deg, #15803d, #84cc16)',
    'linear-gradient(135deg, #0ea5e9, #2563eb)',
    'linear-gradient(135deg, #4ade80, #86efac)'
  ]
  const n = String(props.trail.name || '绿').charCodeAt(0) || 0
  return colors[n % colors.length]
})

const handleClick = () => emit('click', props.trail)
const onImgError = (e) => {
  // 图片加载失败时兜底到占位图（避免显破坏的裂图）
  const img = e.target
  if (img.dataset.fallback) return
  img.dataset.fallback = '1'
  img.src = '/images/greenways/placeholder.svg'
}
</script>

<style scoped>
.trail-card {
  display: flex; gap: 12px;
  width: 100%;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  -webkit-user-select: none; user-select: none;
}
.theme-dark .trail-card {
  border-color: rgba(255, 255, 255, 0.06);
}
.trail-card:active { transform: scale(0.975); box-shadow: var(--shadow-sm); }

/* 横向大卡（推荐区） */
.trail-card--large {
  flex-direction: column;
  gap: 0;
  padding: 0;
  width: 268px;
  flex: 0 0 268px;
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.card-thumb {
  position: relative; flex: 0 0 96px; height: 96px;
  border-radius: var(--radius-md); overflow: hidden;
  background: var(--color-surface-3);
}
.thumb-img { width: 100%; height: 100%; object-fit: cover; }
.thumb-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
.thumb-letter {
  font-size: 34px; font-weight: 700; color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.trail-card--large .thumb-letter { font-size: 44px; }

/* 大卡：全图卡片（图片撑满 + 渐变遮罩 + 文字叠图） */
.trail-card--large .card-thumb {
  position: relative;
  width: 100%;
  height: 150px;
  border-radius: 0;
  flex-basis: 150px;
}
.trail-card--large .thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
}
.trail-card--large:active .thumb-img { transform: scale(1.04); }
.thumb-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.10) 0%, transparent 40%, rgba(0,0,0,0.68) 100%);
}
/* 大卡顶部：区域徽章 */
.thumb-top-row {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 2;
}
.thumb-area {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.35);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
}
/* 大卡底部：名称 + 数据（水印式） */
.thumb-caption {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 12px;
  color: #fff;
  z-index: 2;
}
.thumb-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.2px;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.thumb-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
}
.thumb-metric {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.thumb-metric b {
  font-size: 14px;
  font-weight: 800;
  color: #fff;
  margin-right: 2px;
}
.thumb-metric-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
}

/* 难度徽章（大卡置于右上） */
.trail-card--large .diff-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  left: auto;
  bottom: auto;
  z-index: 2;
}

.diff-badge {
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.diff-easy   { background: rgba(34, 197, 94, 0.88); }
.diff-medium { background: rgba(245, 158, 11, 0.9); }
.diff-hard   { background: rgba(239, 68, 68, 0.9); }

.card-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 4px; padding: 2px 0;
}
.trail-name {
  font-size: var(--text-base); font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary); line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.trail-desc {
  font-size: var(--text-sm); color: var(--color-text-secondary);
  line-height: 1.45; flex: 1;
}
.card-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
.meta-chip {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 3px 7px; background: var(--color-surface-2);
  border-radius: var(--radius-full); font-size: 11px;
  color: var(--color-text-secondary); font-weight: var(--font-weight-medium);
}
.meta-tag {
  padding: 3px 7px; background: var(--fill-primary);
  color: var(--color-primary); border-radius: var(--radius-full);
  font-size: 11px; font-weight: var(--font-weight-medium);
}
.meta-dist {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 3px 8px;
  background: var(--fill-primary);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 11px; font-weight: var(--font-weight-semibold);
}
</style>
