<template>
  <div v-if="result" class="spatial-panel">
    <div class="sp-panel-header">
      <span class="sp-title">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 3v18h18"/><path d="M7 15l4-6 4 3 5-8"/>
        </svg>
        空间分析结果
      </span>
      <button class="sp-close" @click="$emit('close')" title="关闭">&times;</button>
    </div>

    <div class="sp-summary">
      <div class="sp-sum-item">
        <span class="sp-sum-num">{{ result.summary?.greenwayCount ?? 0 }}</span>
        <span class="sp-sum-label">绿道</span>
      </div>
      <div class="sp-sum-item">
        <span class="sp-sum-num">{{ result.summary?.poiCount ?? 0 }}</span>
        <span class="sp-sum-label">设施</span>
      </div>
    </div>

    <div v-if="result.analysis" class="sp-analysis">
      <span v-if="result.analysis.area" class="sp-an-item">
        <i class="fas fa-vector-square"></i> 面积 {{ result.analysis.area }}
      </span>
      <span v-if="result.analysis.perimeter" class="sp-an-item">
        <i class="fas fa-ruler-combined"></i> 周长 {{ result.analysis.perimeter }}
      </span>
      <span v-if="result.summary?.poiCount" class="sp-an-item">
        <i class="fas fa-th"></i> 设施密度 {{ poiDensity }}
      </span>
    </div>

    <div v-if="result.summary?.functionBreakdown?.length" class="sp-functions">
      <h4 class="sp-sec-title"><i class="fas fa-brain"></i> 功能分区 <span class="sp-fn-sub">深度学习评价 · {{ result.summary.functionCount }} 节点</span></h4>
      <div v-for="fn in result.summary.functionBreakdown" :key="fn.name" class="sp-fn-row">
        <span class="sp-fn-name"><i :class="fnIcon(fn.name)" :style="{ color: fnColor(fn.name) }"></i>{{ fn.name }}</span>
        <div class="sp-fn-track"><div class="sp-fn-fill" :style="{ width: fn.pct + '%', background: fnColor(fn.name) }"></div></div>
        <span class="sp-fn-pct">{{ fn.pct }}%</span>
      </div>
    </div>

    <div class="sp-body">
      <div v-if="greenways.length" class="sp-section">
        <h4 class="sp-sec-title">命中的绿道</h4>
        <div v-for="gw in greenways" :key="gw.id" class="sp-row sp-row--gw"
             @click="$emit('locate-greenway', gw)">
          <i class="fas fa-tree" style="color:#2E7D32"></i>
          <span class="sp-row-name">{{ gw.name }}</span>
          <span v-if="gw.length" class="sp-row-sub">{{ Number(gw.length) }} km</span>
        </div>
      </div>

      <div v-if="pois.length" class="sp-section">
        <h4 class="sp-sec-title">区域内的设施</h4>
        <div v-for="poi in pois" :key="poi.id" class="sp-row"
             @click="$emit('locate-poi', poi)">
          <i class="fas fa-map-marker-alt" :style="{ color: poiColor(poi.poi_type) }"></i>
          <span class="sp-row-name">{{ poi.name }}</span>
          <span class="sp-row-sub">{{ poi.type_name }}</span>
        </div>
      </div>

      <div v-if="!greenways.length && !pois.length" class="sp-empty">该区域内未发现绿道或设施</div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  result: { type: Object, default: null }
})
defineEmits(['close', 'locate-greenway', 'locate-poi'])

const POI_COLORS = {
  '150500': '#E53935', '150700': '#FB8C00', '150900': '#1E88E5',
  '200300': '#43A047', '060100': '#8E24AA', '080600': '#6A1B9A',
  '110100': '#E65100', '110200': '#E65100'
}
function poiColor(code) { return POI_COLORS[code] || '#666' }

// 功能分区类型样式
const FN_META = {
  '历史文化绿道': { color: '#A0522D', icon: 'fas fa-landmark' },
  '风景绿道':     { color: '#2196F3', icon: 'fas fa-mountain-sun' },
  '生态绿道':     { color: '#2E7D32', icon: 'fas fa-leaf' },
  '城市绿道':     { color: '#607D8B', icon: 'fas fa-city' }
}
function fnColor(name) { return FN_META[name]?.color || '#9E9E9E' }
function fnIcon(name) { return FN_META[name]?.icon || 'fas fa-circle' }

const greenways = props.result?.greenways || []
const pois = props.result?.pois || []

// 设施密度：每 km² 设施数（面积字符串形如 "12.5 km²"）
const poiDensity = (() => {
  const areaStr = props.result?.analysis?.area || ''
  const match = areaStr.match(/([\d.]+)\s*km²/)
  if (!match) return null
  const areaKm2 = parseFloat(match[1])
  if (!areaKm2 || !pois.length) return null
  return `${(pois.length / areaKm2).toFixed(1)} 个/km²`
})()
</script>

<style scoped>
.spatial-panel {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 320px;
  max-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
  border: 1px solid #e5e7eb;
  z-index: 300;
  overflow: hidden;
}
.sp-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}
.sp-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.9rem; color: #111; }
.sp-close { background: none; border: none; font-size: 1.3rem; color: #9ca3af; cursor: pointer; line-height: 1; }
.sp-close:hover { color: #ef4444; }
.sp-summary { display: flex; padding: 12px 14px; gap: 24px; border-bottom: 1px solid #f0f0f0; }
.sp-sum-item { display: flex; align-items: baseline; gap: 6px; }
.sp-sum-num { font-size: 1.5rem; font-weight: 800; color: #2E7D32; }
.sp-sum-label { font-size: 0.78rem; color: #6b7280; }
.sp-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.sp-section { padding: 6px 0; }
.sp-sec-title { font-size: 0.78rem; color: #9ca3af; font-weight: 600; margin: 6px 14px; text-transform: uppercase; letter-spacing: 0.3px; }
.sp-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 14px; cursor: pointer; font-size: 0.85rem;
}
.sp-row:hover { background: #f5f5f5; }
.sp-row i { width: 16px; text-align: center; }
.sp-row-name { flex: 1; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-row-sub { font-size: 0.75rem; color: #9ca3af; flex: 0 0 auto; }
.sp-empty { padding: 24px 14px; text-align: center; color: #9ca3af; font-size: 0.85rem; }
.sp-analysis { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #f0f0f0; }
.sp-an-item { display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; color: #374151; background: #f3f4f6; border-radius: 6px; padding: 4px 8px; }
.sp-an-item i { color: #2E7D32; }

.sp-functions { padding: 10px 14px; border-bottom: 1px solid #f0f0f0; }
.sp-fn-sub { font-size: 0.72rem; font-weight: 400; color: #9ca3af; margin-left: 4px; }
.sp-fn-row { display: flex; align-items: center; gap: 8px; margin: 5px 0; }
.sp-fn-name { width: 84px; font-size: 0.78rem; color: #374151; display: inline-flex; align-items: center; gap: 5px; }
.sp-fn-track { flex: 1; height: 7px; border-radius: 4px; background: #f0f0f0; overflow: hidden; }
.sp-fn-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
.sp-fn-pct { width: 38px; text-align: right; font-size: 0.78rem; color: #6b7280; font-weight: 600; }

[data-theme="night"] .sp-functions { border-color: #2a2a2a; }
[data-theme="night"] .sp-fn-name { color: #d1d5db; }
[data-theme="night"] .sp-fn-track { background: #2a2a2a; }
[data-theme="night"] .sp-fn-pct { color: #9ca3af; }

[data-theme="night"] .spatial-panel { background: #1a1a1a; border-color: #2a2a2a; }
[data-theme="night"] .sp-an-item { background: #2a2a2a; color: #d1d5db; }
[data-theme="night"] .sp-analysis { border-color: #2a2a2a; }
[data-theme="night"] .sp-panel-header { background: #222; border-color: #2a2a2a; }
[data-theme="night"] .sp-title { color: #e5e7eb; }
[data-theme="night"] .sp-summary { border-color: #2a2a2a; }
[data-theme="night"] .sp-sum-num { color: #4CAF50; }
[data-theme="night"] .sp-row:hover { background: #222; }
[data-theme="night"] .sp-row-name { color: #e5e7eb; }
</style>
