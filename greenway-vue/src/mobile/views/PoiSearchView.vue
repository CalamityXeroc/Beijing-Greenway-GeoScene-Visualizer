<template>
  <div class="poi-search-view">
    <!-- 顶部栏 -->
    <div class="search-header">
      <button class="back-btn" @click="goBack" aria-label="返回">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="search-input-group">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索地铁站、卫生间、便利店…"
          type="search"
          autofocus
          @input="onInput"
          @keyup.enter="doSearch"
        />
        <button v-if="keyword" class="clear-btn" @click="clearSearch" aria-label="清除">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 类型快捷入口 -->
    <div v-if="!results.length && !loading" class="type-shortcuts">
      <div class="type-shortcuts-title">按类型查找</div>
      <div class="type-shortcuts-grid">
        <button
          v-for="t in typeList"
          :key="t.code"
          class="type-shortcut"
          :style="{ '--tc': t.color }"
          @click="quickSearch(t.code, t.name)"
        >
          <img :src="t.icon" alt="" class="ts-icon" />
          <span>{{ t.name }}</span>
        </button>
      </div>
    </div>

    <!-- 加载/空态 -->
    <div v-if="loading" class="state-hint">搜索中…</div>
    <div v-else-if="searchError" class="state-hint error">{{ searchError }}</div>
    <div v-else-if="searched && !results.length" class="state-hint">没有找到相关设施</div>

    <!-- 结果列表 -->
    <div v-else-if="results.length" class="result-list">
      <div
        v-for="r in results"
        :key="r.id"
        class="result-item"
        @click="selectResult(r)"
      >
        <span class="res-icon">
          <img :src="poiIconUrl(r.poi_type)" alt="" class="res-icon-img" />
        </span>
        <div class="res-body">
          <div class="res-name">
            {{ r.name }}
            <span class="res-type" :style="{ color: poiTypeColor(r.poi_type) }">{{ r.type_name }}</span>
          </div>
          <div class="res-meta">
            <span v-if="r.greenway_name" class="res-gw">{{ r.greenway_name }}</span>
            <span v-if="r.address" class="res-addr">{{ r.address }}</span>
          </div>
        </div>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { searchPoi, fetchPoiTypes } from '../services/api'
import { POI_TYPE_CONFIG, poiIconUrl, poiTypeColor } from '../constants/poi'
import { toast } from '../composables/useToast'

const router = useRouter()
const keyword = ref('')
const results = ref([])
const loading = ref(false)
const searchError = ref('')
const searched = ref(false)
const typeList = ref([])
const searchMode = ref('')   // '' = 关键词搜索，否则为类型 code

onMounted(async () => {
  try {
    const types = await fetchPoiTypes()
    // 去重（按名称，避免 110100/110200 同为"景点"出现两项）+ 保留已配置的图标颜色
    const seen = {}
    typeList.value = (types || []).filter(t => {
      if (seen[t.name]) return false
      seen[t.name] = true
      return true
    }).map(t => ({
      code: String(t.code),
      name: t.name,
      icon: poiIconUrl(t.code),
      color: POI_TYPE_CONFIG[t.code]?.color || t.color || '#999'
    }))
  } catch (e) {
    // 类型加载失败则用本地常量
    typeList.value = Object.entries(POI_TYPE_CONFIG).map(([code, cfg]) => ({
      code, name: cfg.name, icon: cfg.icon ? `/images/poi/${cfg.icon}` : '', color: cfg.color
    })).filter((v, i, arr) => arr.findIndex(x => x.code === v.code) === i)
  }
})

function onInput() {
  searchMode.value = ''   // 手动输入关键词时退出类型模式
  searched.value = false
  clearTimeout(onInput.t)
  onInput.t = setTimeout(doSearch, 300)
}

async function doSearch() {
  const q = keyword.value.trim()
  if (!q && !searchMode.value) { results.value = []; searched.value = false; searchError.value = ''; return }
  loading.value = true
  searched.value = true
  searchError.value = ''
  try {
    results.value = await searchPoi(searchMode.value ? { type: searchMode.value } : { q })
  } catch (e) {
    console.error('POI 搜索失败:', e)
    results.value = []
    searchError.value = '网络异常，请稍后重试'
    toast('搜索失败，请检查网络', 'error')
  } finally {
    loading.value = false
  }
}

function clearSearch() {
  keyword.value = ''
  searchMode.value = ''
  results.value = []
  searched.value = false
  searchError.value = ''
}

function quickSearch(code, name) {
  keyword.value = name
  searchMode.value = code
  doSearch()
}

function selectResult(r) {
  // 跳回地图页并定位到该设施（通过 query 传参），颜色统一用前端类型色
  router.push({
    path: '/mobile/map',
    query: { poi: JSON.stringify({ id: r.id, name: r.name, lng: r.lng, lat: r.lat, poi_type: r.poi_type, type_name: r.type_name, color: poiTypeColor(r.poi_type), address: r.address, greenway_id: r.greenway_id, greenway_name: r.greenway_name }) }
  })
}

function goBack() {
  router.back()
}
</script>

<style scoped>
.poi-search-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
}

.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: max(12px, var(--safe-top)) 12px 10px;
  background: var(--color-surface);
  border-bottom: 0.5px solid var(--color-border);
}

.back-btn {
  width: 38px; height: 38px;
  flex: 0 0 38px;
  border-radius: 50%;
  border: none;
  background: var(--color-surface-2);
  color: var(--color-text-primary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}

.search-input-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 10px;
  border-radius: var(--radius-full);
  background: var(--color-surface-2);
  color: var(--color-text-tertiary);
}
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: var(--text-base);
  color: var(--color-text-primary);
}
.search-input::placeholder { color: var(--color-text-tertiary); }
.clear-btn {
  background: transparent; border: none;
  color: var(--color-text-tertiary);
  cursor: pointer; padding: 4px;
}

/* 类型快捷入口 */
.type-shortcuts { padding: 16px 14px; }
.type-shortcuts-title {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: 10px;
  font-weight: var(--font-weight-medium);
}
.type-shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.type-shortcut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
}
.type-shortcut:active { transform: scale(0.96); }
.ts-icon {
  width: 26px; height: 26px;
  object-fit: contain;
  filter: none;
}

.state-hint {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}
.state-hint.error { color: var(--color-error); }

/* 结果列表 */
.result-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0 calc(20px + env(safe-area-inset-bottom, 0px));
}
.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 0.5px solid var(--color-border-light);
  cursor: pointer;
  color: var(--color-text-tertiary);
  transition: background var(--transition-fast);
}
.result-item:active { background: var(--color-surface-2); }
.res-icon {
  width: 34px; height: 34px;
  flex: 0 0 34px;
  display: flex; align-items: center; justify-content: center;
}
.res-icon-img {
  width: 30px; height: 30px;
  object-fit: contain;
  filter: none;
}
.res-body { flex: 1; min-width: 0; }
.res-name {
  font-size: var(--text-base);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  display: flex; align-items: center; gap: 8px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.res-type { font-size: 12px; font-weight: var(--font-weight-semibold); flex: 0 0 auto; }
.res-meta {
  display: flex; flex-direction: column; gap: 2px;
  margin-top: 3px;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}
.res-gw { color: var(--color-text-secondary); }
.res-addr { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
