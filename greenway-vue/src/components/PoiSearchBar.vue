<template>
  <div class="poi-search" ref="rootEl">
    <div class="poi-search-input-wrap">
      <svg class="poi-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        ref="inputEl"
        v-model="query"
        class="poi-search-input"
        type="text"
        placeholder="搜索设施…"
        @input="onInput"
        @focus="onFocus"
        @keydown="onKeydown"
        @blur="onBlur"
      />
      <button v-if="query" class="poi-search-clear" @mousedown.prevent="clear" title="清除">&times;</button>
    </div>
    <ul v-show="showDropdown" class="poi-search-dropdown" @mousedown.prevent>
      <li v-if="loading" class="poi-search-item poi-search-loading">搜索中…</li>
      <template v-else-if="results.length">
        <li
          v-for="(r, i) in results"
          :key="r.id"
          class="poi-search-item"
          :class="{ active: i === activeIdx }"
          @mouseenter="activeIdx = i"
          @click="select(r)"
        >
          <img :src="'/images/poi/' + (icons[r.poi_type] || 'scenic.svg')" alt="" class="poi-search-item-icon" />
          <span class="poi-search-item-name">{{ r.name }}</span>
          <span class="poi-search-item-type">{{ r.type_name }}</span>
        </li>
      </template>
      <li v-else class="poi-search-item poi-search-empty">未找到设施</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['select'])

const icons = {
  '150500': 'subway.svg', '150700': 'bus.svg', '150900': 'parking.svg',
  '200300': 'restroom.svg', '060100': 'store.svg', '080600': 'cinema.svg',
  '110100': 'scenic.svg', '110200': 'scenic.svg',
}

const query = ref('')
const results = ref([])
const loading = ref(false)
const showDropdown = ref(false)
const activeIdx = ref(-1)
const inputEl = ref(null)
const rootEl = ref(null)
let timer = null
let seq = 0  // 请求序号：旧响应不得覆盖新结果（防抖竞态）

function onInput() {
  activeIdx.value = -1
  const v = query.value.trim()
  if (!v) { results.value = []; showDropdown.value = false; clearTimeout(timer); return }
  loading.value = true
  showDropdown.value = true
  clearTimeout(timer)
  const mySeq = ++seq
  timer = setTimeout(() => {
    fetch(`/api/poi/search?q=${encodeURIComponent(v)}`)
      .then(r => r.json())
      .then(d => {
        if (mySeq !== seq) return  // 已有更新的请求，丢弃本次结果
        results.value = d.results || []; loading.value = false
      })
      .catch(() => {
        if (mySeq !== seq) return
        results.value = []; loading.value = false
      })
  }, 200)
}

function onFocus() {
  if (query.value.trim() && results.value.length) showDropdown.value = true
}

function onBlur() {
  setTimeout(() => { showDropdown.value = false }, 150)
}

function onKeydown(e) {
  if (!showDropdown.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx.value = Math.max(activeIdx.value - 1, 0) }
  else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx.value >= 0 && results.value[activeIdx.value]) select(results.value[activeIdx.value]) }
  else if (e.key === 'Escape') { showDropdown.value = false; inputEl.value?.blur() }
}

function select(poi) {
  emit('select', poi)
  showDropdown.value = false
  query.value = ''
  results.value = []
  inputEl.value?.blur()
}

function clear() {
  query.value = ''
  results.value = []
  showDropdown.value = false
}

// 组件卸载时清理防抖定时器，避免卸载后仍触发请求
onBeforeUnmount(() => {
  clearTimeout(timer)
  seq++  // 使进行中的旧响应全部失效
})
</script>

<style scoped>
/* ---- 白天模式 ---- */
.poi-search { position: relative; flex-shrink: 0; margin-right: 12px; }
.poi-search-input-wrap {
  display: flex; align-items: center;
  background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.12);
  border-radius: 8px; padding: 0 8px; gap: 6px; transition: all .2s;
}
.poi-search-input-wrap:focus-within {
  background: #fff; border-color: rgba(76,175,80,0.5);
  box-shadow: 0 0 0 2px rgba(76,175,80,0.15);
}
.poi-search-icon { color: #999; flex-shrink: 0; }
.poi-search-input {
  background: none; border: none; outline: none; color: #333;
  font-size: 0.82rem; width: 180px; line-height: 32px;
}

/* 手机端：固定输入字号，避免 :root rem 缩放（≤480px→12px）导致输入文字过小 */
@media (max-width: 480px) {
  .poi-search-input {
    font-size: 14px;
  }
}
.poi-search-input::placeholder { color: #999; }
.poi-search-clear { background: none; border: none; color: #999; cursor: pointer; font-size: 1.1rem; padding: 0; line-height: 1; }
.poi-search-clear:hover { color: #333; }

.poi-search-dropdown {
  position: absolute; top: 100%; margin-top: 4px; left: 0; right: 0;
  background: rgba(255,255,255,0.97); border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15); list-style: none;
  padding: 6px 0; z-index: 3000; max-height: 320px; overflow-y: auto;
  border: 1px solid rgba(0,0,0,0.08);
}
.poi-search-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 0.82rem; transition: background .1s; }
.poi-search-item:hover, .poi-search-item.active { background: rgba(76,175,80,0.08); }
.poi-search-item-icon { width: 18px; height: 18px; flex-shrink: 0; }
.poi-search-item-name { flex: 1; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.poi-search-item-type { font-size: 0.72rem; color: #999; flex-shrink: 0; }
.poi-search-loading, .poi-search-empty { color: #999; cursor: default; }

/* ---- 暗色模式 ---- */
[data-theme="night"] .poi-search-input-wrap {
  background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.12);
}
[data-theme="night"] .poi-search-input-wrap:focus-within {
  background: rgba(255,255,255,0.14); border-color: rgba(76,175,80,0.4);
  box-shadow: 0 0 0 2px rgba(76,175,80,0.2);
}
[data-theme="night"] .poi-search-icon { color: rgba(255,255,255,0.5); }
[data-theme="night"] .poi-search-input { color: #eee; }
[data-theme="night"] .poi-search-input::placeholder { color: rgba(255,255,255,0.35); }
[data-theme="night"] .poi-search-clear { color: rgba(255,255,255,0.5); }
[data-theme="night"] .poi-search-clear:hover { color: #fff; }
[data-theme="night"] .poi-search-dropdown { background: rgba(35,38,45,0.97); border-color: rgba(255,255,255,0.1); }
[data-theme="night"] .poi-search-item-name { color: #ddd; }
[data-theme="night"] .poi-search-item:hover,
[data-theme="night"] .poi-search-item.active { background: rgba(76,175,80,0.12); }
</style>
