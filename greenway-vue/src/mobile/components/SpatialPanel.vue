<template>
  <div class="spatial-panel" :class="{ 'theme-dark': isDark }">
    <!-- 头部 -->
    <header class="sp-header">
      <div class="sp-title">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3v18h18"/><path d="M7 15l4-6 4 3 5-8"/>
        </svg>
        空间分析
      </div>
      <button class="sp-close" @click="$emit('close')" aria-label="关闭">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </header>

    <!-- 统计 -->
    <div class="sp-summary">
      <div class="sp-sum-item">
        <span class="sp-sum-num font-number">{{ summary.greenwayCount ?? 0 }}</span>
        <span class="sp-sum-label">命中绿道</span>
      </div>
      <div class="sp-sum-item">
        <span class="sp-sum-num font-number">{{ summary.poiCount ?? 0 }}</span>
        <span class="sp-sum-label">区域内设施</span>
      </div>
    </div>

    <!-- 列表 -->
    <div class="sp-body">
      <div v-if="greenways.length" class="sp-section">
        <h4 class="sp-sec-title">命中的绿道</h4>
        <div v-for="gw in greenways" :key="gw.id" class="sp-row" @click="$emit('locate-greenway', gw)">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/></svg>
          <span class="sp-row-name">{{ gw.name }}</span>
          <span v-if="gw.length" class="sp-row-sub">{{ Number(gw.length) }} km</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="sp-chevron"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      <div v-if="pois.length" class="sp-section">
        <h4 class="sp-sec-title">区域内的设施</h4>
        <div v-for="poi in pois" :key="poi.id" class="sp-row" @click="$emit('locate-poi', poi)">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="{ color: poiColor(poi.poi_type) }"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span class="sp-row-name">{{ poi.name }}</span>
          <span class="sp-row-sub">{{ poi.type_name }}</span>
        </div>
      </div>

      <div v-if="!greenways.length && !pois.length" class="sp-empty">该区域内未发现绿道或设施</div>
    </div>

    <!-- 操作 -->
    <div class="sp-actions">
      <button class="sp-action-btn" @click="$emit('redo')">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        重新分析
      </button>
      <button class="sp-action-btn primary" @click="$emit('clear')">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        清除分析
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppTheme } from '../composables/useAppTheme'

const props = defineProps({
  result: { type: Object, default: null }
})
const emit = defineEmits(['close', 'locate-greenway', 'locate-poi', 'redo', 'clear'])

const { isDark } = useAppTheme()

const POI_COLORS = {
  '150500': '#E53935', '150700': '#FB8C00', '150900': '#1E88E5',
  '200300': '#43A047', '060100': '#8E24AA', '080600': '#6A1B9A',
  '110100': '#E65100', '110200': '#E65100'
}
const poiColor = (code) => POI_COLORS[String(code)] || '#666'

const greenways = computed(() => props.result?.greenways || [])
const pois = computed(() => props.result?.pois || [])
const summary = computed(() => props.result?.summary || { greenwayCount: 0, poiCount: 0 })
</script>

<style scoped>
.spatial-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 12px 0 calc(12px + var(--safe-bottom));
}

/* 头部 */
.sp-header { display: flex; align-items: center; justify-content: space-between; padding: 0 16px 10px; }
.sp-title {
  display: flex; align-items: center; gap: 8px;
  font-size: var(--text-lg); font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.sp-title svg { color: var(--color-accent); }
.sp-close {
  width: 34px; height: 34px; border: none; border-radius: 50%;
  background: var(--color-surface-2); color: var(--color-text-tertiary);
  display: flex; align-items: center; justify-content: center;
}

/* 统计 */
.sp-summary {
  display: flex; gap: 12px; padding: 0 16px 12px;
  border-bottom: 0.5px solid var(--color-divider);
}
.sp-sum-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 10px; border-radius: var(--radius-md); background: var(--color-surface-2);
}
.sp-sum-num { font-size: var(--text-2xl); font-weight: var(--font-weight-bold); color: var(--color-accent); }
.sp-sum-label { font-size: var(--text-xs); color: var(--color-text-tertiary); }

/* 列表 */
.sp-body { max-height: 40vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.sp-section { padding: 4px 0; }
.sp-sec-title {
  font-size: var(--text-xs); color: var(--color-text-tertiary); font-weight: var(--font-weight-semibold);
  margin: 6px 16px; text-transform: uppercase; letter-spacing: 0.5px;
}
.sp-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 16px; font-size: var(--text-base); cursor: pointer;
  transition: background var(--transition-fast);
}
.sp-row:active { background: var(--color-surface-2); }
.sp-row svg:first-child { flex-shrink: 0; }
.sp-row-name { flex: 1; min-width: 0; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-row-sub { flex-shrink: 0; font-size: var(--text-xs); color: var(--color-text-tertiary); }
.sp-chevron { flex-shrink: 0; color: var(--color-text-tertiary); }
.sp-empty { padding: 24px 16px; text-align: center; color: var(--color-text-tertiary); font-size: var(--text-sm); }

/* 操作按钮 */
.sp-actions { display: flex; gap: 10px; padding: 10px 16px 0; border-top: 0.5px solid var(--color-divider); }
.sp-action-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  height: 42px; border: 1px solid var(--color-border); border-radius: var(--radius-full);
  background: var(--color-surface); color: var(--color-text-secondary);
  font-size: var(--text-sm); font-weight: var(--font-weight-medium);
}
.sp-action-btn.primary {
  background: var(--fill-primary); border-color: var(--color-primary); color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}
</style>
