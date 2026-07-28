<template>
  <div v-if="hasData" class="highlights facilities-panel">
    <h3><i class="fas fa-map-marker-alt"></i> 附近设施 (1km)</h3>
    <div v-for="group in groupedFacilities" :key="group.type" class="facility-group">
      <div class="facility-type-header">
        <i :class="'fas ' + group.icon" :style="{ color: group.color }"></i>
        <span>{{ group.typeName }} ({{ group.items.length }})</span>
      </div>
      <div
        v-for="item in group.items"
        :key="item.id"
        class="facility-row"
      >
        <span class="facility-name">{{ item.name }}</span>
        <span class="facility-dist">{{ formatDist(item.distance_m) }}</span>
      </div>
    </div>
    <div v-if="totalCount > 20" class="facility-toggle" @click="expanded = !expanded">
      {{ expanded ? '收起' : `查看全部 (${totalCount} 个)` }}
      <i :class="expanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getApiBaseUrl } from '../mobile/services/api'

const props = defineProps({
  greenwayName: { type: String, required: true }
})

const facilities = ref([])
const expanded = ref(false)
const loading = ref(false)

const FACILITY_ICONS = {
  '150500': { icon: 'fa-train-subway', name: '地铁站', color: '#E53935' },
  '150700': { icon: 'fa-bus', name: '公交站', color: '#FB8C00' },
  '150900': { icon: 'fa-square-parking', name: '停车场', color: '#1E88E5' },
  '200300': { icon: 'fa-restroom', name: '卫生间', color: '#43A047' },
  '060100': { icon: 'fa-store', name: '便利店', color: '#8E24AA' },
  '080600': { icon: 'fa-film', name: '影剧院', color: '#6A1B9A' },
  '110100': { icon: 'fa-landmark', name: '景点', color: '#E65100' },
  '110200': { icon: 'fa-landmark', name: '景点', color: '#E65100' }
}

const hasData = computed(() => facilities.value.length > 0)
const totalCount = computed(() => facilities.value.length)

const groupedFacilities = computed(() => {
  const groups = []
  const map = {}
  for (const f of facilities.value) {
    if (!map[f.poi_type]) {
      map[f.poi_type] = {
        type: f.poi_type,
        icon: f.icon,
        color: f.color,
        typeName: f.type_name,
        items: []
      }
      groups.push(map[f.poi_type])
    }
    map[f.poi_type].items.push(f)
  }
  // Limit items if not expanded
  if (!expanded.value && totalCount.value > 20) {
    let count = 0
    for (const g of groups) {
      g.items = g.items.filter(() => {
        count++
        return count <= 20
      })
      if (count >= 20) break
    }
  }
  return groups.filter(g => g.items.length > 0)
})

function formatDist(m) {
  if (!m && m !== 0) return ''
  if (m < 1000) return m + 'm'
  return (m / 1000).toFixed(1) + 'km'
}

async function loadFacilities() {
  loading.value = true
  try {
    const apiBase = getApiBaseUrl()
    const resp = await fetch(
      `${apiBase}/api/greenways/name/${encodeURIComponent(props.greenwayName)}/nearby-facilities?radius=1000`
    )
    if (!resp.ok) return
    const data = await resp.json()
    facilities.value = data.facilities || []
  } catch (_) {
    // 静默失败，不阻塞页面
  } finally {
    loading.value = false
  }
}

onMounted(loadFacilities)
</script>

<style scoped>
.facilities-panel {
  margin-top: 0;
}

.facility-group {
  margin-bottom: 0.5rem;
}

.facility-type-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
  border-bottom: 1px solid rgba(76, 175, 80, 0.1);
}

.facility-row {
  display: flex;
  align-items: center;
  padding: 0.35rem 0.35rem 0.35rem 1.2rem;
  font-size: 0.85rem;
  transition: background 0.15s;
}

.facility-row:hover { background: rgba(76, 175, 80, 0.05); border-radius: 4px; }

.facility-name {
  flex: 1;
  color: #444;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.facility-dist {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: #999;
  margin-left: 0.5rem;
  min-width: 3em;
  text-align: right;
}

.facility-toggle {
  text-align: center;
  padding: 0.5rem 0 0;
  font-size: 0.8rem;
  color: #4CAF50;
  cursor: pointer;
  user-select: none;
}

.facility-toggle:hover { color: #388E3C; }
</style>
