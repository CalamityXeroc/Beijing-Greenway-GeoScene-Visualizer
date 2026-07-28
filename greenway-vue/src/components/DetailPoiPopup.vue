<template>
  <!-- POI 详情弹窗 -->
  <div v-show="popup.visible" class="poi-popup" :style="popupStyle">
    <div class="poi-popup-content">
      <div class="poi-popup-header">
        <h4>
          <img v-if="popup.poiSvg" :src="popup.poiSvg" alt="" class="poi-popup-icon" />
          {{ popup.poiName }}
        </h4>
        <button class="poi-popup-close" @click.stop="$emit('close')">&times;</button>
      </div>
      <p class="poi-popup-meta">
        <span class="poi-type-tag" :style="{ background: popup.poiColor + '22', color: popup.poiColor }">
          {{ popup.poiTypeName }}
        </span>
        <span class="poi-distance" v-if="popup.poiDistance">{{ popup.poiDistance }}</span>
      </p>
      <p v-if="popup.poiAddress" class="poi-address">{{ popup.poiAddress }}</p>
    </div>
  </div>

  <!-- 悬浮提示 -->
  <div v-show="tooltip.visible" class="poi-tooltip" :style="tooltipStyle">
    <strong>{{ tooltip.title }}</strong>
    <span v-if="tooltip.data.type">{{ tooltip.data.type }}</span>
    <span v-if="tooltip.data.distance"> · {{ tooltip.data.distance }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  popup: { type: Object, required: true },
  tooltip: { type: Object, required: true }
})

defineEmits(['close'])

const popupStyle = computed(() => ({
  left: `${props.popup.position.x}px`,
  top: `${props.popup.position.y}px`
}))

const tooltipStyle = computed(() => ({
  left: `${props.tooltip.position.x + 15}px`,
  top: `${props.tooltip.position.y + 15}px`
}))
</script>

<style scoped>
.poi-popup {
  position: absolute; z-index: 600;
  background: rgba(255,255,255,0.96); border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.15); min-width: 200px;
  backdrop-filter: blur(8px); transform: translate(-50%, -110%);
  border: 1px solid rgba(0,0,0,0.06);
}
.poi-popup-content { padding: 0.7rem 0.9rem; }
.poi-popup-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem; }
.poi-popup-header h4 { margin: 0; font-size: 0.92rem; color: #222; display: flex; align-items: center; gap: 6px; }
.poi-popup-icon { width: 20px; height: 20px; }
.poi-popup-close { background: none; border: none; font-size: 1.1rem; color: #999; cursor: pointer; padding: 0 0 0 8px; line-height: 1; }
.poi-popup-close:hover { color: #333; }
.poi-popup-meta { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem; }
.poi-type-tag { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 10px; font-size: 0.7rem; font-weight: 600; }
.poi-distance { color: #999; font-size: 0.75rem; }
.poi-address { color: #777; font-size: 0.78rem; margin: 0; }

.poi-tooltip {
  position: absolute; z-index: 550;
  background: rgba(30,30,30,0.9); color: #fff;
  border-radius: 6px; padding: 0.35rem 0.6rem;
  font-size: 0.78rem; white-space: nowrap;
  pointer-events: none;
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
}
.poi-tooltip strong { font-size: 0.82rem; }

/* 暗色模式 */
[data-theme="night"] .poi-popup {
  background: rgba(30,33,38,0.96); border-color: rgba(255,255,255,0.08);
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}
[data-theme="night"] .poi-popup-header h4 { color: #e0e0e0; }
[data-theme="night"] .poi-popup-close { color: #777; }
[data-theme="night"] .poi-popup-close:hover { color: #bbb; }
[data-theme="night"] .poi-address { color: #999; }
[data-theme="night"] .poi-distance { color: #888; }

[data-theme="night"] .poi-tooltip {
  background: rgba(220,220,220,0.92); color: #222;
}
</style>
