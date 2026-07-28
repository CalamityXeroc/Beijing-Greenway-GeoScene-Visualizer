<template>
  <div class="poi-layer-ctrl" :class="{ expanded: show }">
    <div v-show="show" class="poi-layer-panel" @click.stop>
      <div class="poi-layer-panel-header">
        <span>设施图层</span>
        <a class="poi-layer-all" @click="toggleAll">{{ allOn ? '全部关闭' : '全部开启' }}</a>
      </div>
      <label v-for="t in typeList" :key="t.code" class="poi-layer-row">
        <input type="checkbox" :checked="filters[t.code] !== false"
               @change="emit('toggle', t.code, $event.target.checked)" />
        <img :src="'/images/poi/' + t.icon" alt="" class="poi-layer-icon" />
        <span>{{ t.name }}</span>
      </label>
    </div>

    <button class="poi-layer-toggle" @click="show = !show" title="设施图层">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 22 7 12 12 2 7 12 2"/>
        <polyline points="2 12 12 17 22 12"/>
        <polyline points="2 17 12 22 22 17"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  filters: { type: Object, required: true },
  typeList: { type: Array, required: true }
})

const emit = defineEmits(['toggle', 'toggleAll'])

const show = ref(false)

const allOn = computed(() => props.typeList.every(t => props.filters[t.code] !== false))

function toggleAll() {
  emit('toggleAll', !allOn.value)
}
</script>

<style scoped>
.poi-layer-ctrl {
  position: absolute;
  top: 100px;
  left: 12px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.poi-layer-toggle {
  width: 42px; height: 42px; border-radius: 10px;
  background: rgba(255,255,255,0.94); border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 2px 12px rgba(0,0,0,0.1); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #555; transition: all .2s; order: 2;
}
.poi-layer-toggle:hover { background: #fff; color: #2E7D32; box-shadow: 0 2px 16px rgba(0,0,0,0.16); }
.poi-layer-ctrl.expanded .poi-layer-toggle { background: #2E7D32; color: #fff; border-color: #2E7D32; }

.poi-layer-panel {
  background: rgba(255,255,255,0.96);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.13);
  padding: 0.55rem 0;
  min-width: 152px; margin-bottom: 8px; user-select: none;
  order: 1;
}
.poi-layer-panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.15rem 0.7rem 0.4rem; font-size: 0.78rem; color: #888; font-weight: 600;
}
.poi-layer-all { font-size: 0.7rem; color: #4CAF50; cursor: pointer; font-weight: 400; }
.poi-layer-all:hover { color: #2E7D32; }

.poi-layer-row {
  display: flex; align-items: center; gap: 8px; padding: 0.38rem 0.7rem;
  cursor: pointer; font-size: 0.82rem; transition: background .12s;
}
.poi-layer-row:hover { background: rgba(76,175,80,0.05); }
.poi-layer-row input[type="checkbox"] { accent-color: #4CAF50; width: 15px; height: 15px; cursor: pointer; flex-shrink: 0; }
.poi-layer-icon { width: 18px; height: 18px; flex-shrink: 0; }
.poi-layer-row span { color: #333; font-weight: 450; }

[data-theme="night"] .poi-layer-toggle { background: rgba(35,38,45,0.94); border-color: rgba(255,255,255,0.08); color: #aaa; }
[data-theme="night"] .poi-layer-toggle:hover { background: rgba(40,44,52,0.96); color: #69F0AE; }
[data-theme="night"] .poi-layer-ctrl.expanded .poi-layer-toggle { background: #388E3C; color: #fff; border-color: #388E3C; }
[data-theme="night"] .poi-layer-panel { background: rgba(35,38,45,0.96); box-shadow: 0 4px 24px rgba(0,0,0,0.45); }
[data-theme="night"] .poi-layer-row span { color: #ccc; }
[data-theme="night"] .poi-layer-row:hover { background: rgba(76,175,80,0.08); }

@media (max-width: 768px) {
  .poi-layer-toggle { width: 36px; height: 36px; border-radius: 8px; }
  .poi-layer-panel { min-width: 130px; }
  .poi-layer-row { font-size: 0.76rem; padding: 0.32rem 0.65rem; }
}
</style>
