<template>
  <div v-if="loading" class="function-profile loading">
    <span class="fp-spinner"></span> 正在分析绿道功能…
  </div>
  <div v-else-if="error" class="function-profile fp-error">
    <i class="fas fa-info-circle"></i> 暂无功能画像数据
  </div>
  <div v-else-if="data" class="function-profile">
    <h3 class="fp-title">
      <i class="fas fa-brain"></i> 绿道功能画像
      <span class="fp-sub">深度学习评价</span>
    </h3>
    <div class="fp-dominant">
      <span class="fp-dom-badge" :style="{ color: colorOf(data.dominant), background: bgOf(data.dominant) }">
        <i :class="iconOf(data.dominant)"></i> {{ data.dominant }}主导
      </span>
      <span class="fp-total">基于 {{ data.total }} 个评价节点</span>
    </div>
    <div class="fp-bars">
      <div v-for="item in sortedItems" :key="item.name" class="fp-bar">
        <div class="fp-bar-head">
          <span class="fp-bar-name"><i :class="iconOf(item.name)"></i> {{ item.name }}</span>
          <span class="fp-bar-pct">{{ item.pct }}%</span>
        </div>
        <div class="fp-bar-track">
          <div class="fp-bar-fill" :style="{ width: item.pct + '%', background: colorOf(item.name) }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getApiBaseUrl } from '@/mobile/services/api'

const props = defineProps({
  greenwayName: { type: String, required: true }
})

const data = ref(null)
const loading = ref(true)
const error = ref(false)

const TYPE_META = {
  '历史文化绿道': { color: '#A0522D', icon: 'fas fa-landmark' },
  '风景绿道':     { color: '#2196F3', icon: 'fas fa-mountain-sun' },
  '生态绿道':     { color: '#4CAF50', icon: 'fas fa-leaf' },
  '城市绿道':     { color: '#607D8B', icon: 'fas fa-city' }
}

const sortedItems = computed(() =>
  [...(data.value?.items || [])].sort((a, b) => b.count - a.count)
)

const colorOf = (name) => TYPE_META[name]?.color || '#9E9E9E'
const iconOf = (name) => TYPE_META[name]?.icon || 'fas fa-circle'
const bgOf = (name) => (TYPE_META[name]?.color || '#9E9E9E') + '1A'

onMounted(async () => {
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/greenways/name/${encodeURIComponent(props.greenwayName)}/function-profile`
    )
    const d = await res.json()
    if (d && d.items && d.items.length > 0) {
      data.value = d
    } else {
      error.value = true
    }
  } catch (e) {
    console.error('[功能画像] 加载失败:', e.message)
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.function-profile {
  margin: 1rem 0;
  padding: 1rem 1.1rem;
  border-radius: 12px;
  background: var(--card-bg, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.fp-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.7rem;
  font-size: 1rem;
  color: var(--text-primary, #222);
}

.fp-sub {
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--text-secondary, #888);
  background: rgba(128, 128, 128, 0.12);
  padding: 0.1rem 0.5rem;
  border-radius: 10px;
}

.fp-dominant {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.8rem;
}

.fp-dom-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.8rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.fp-total {
  font-size: 0.75rem;
  color: var(--text-secondary, #888);
}

.fp-bar { margin-bottom: 0.55rem; }
.fp-bar:last-child { margin-bottom: 0; }

.fp-bar-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  margin-bottom: 0.25rem;
  color: var(--text-primary, #333);
}

.fp-bar-name { display: inline-flex; align-items: center; gap: 0.35rem; }
.fp-bar-pct { color: var(--text-secondary, #888); font-weight: 600; }

.fp-bar-track {
  height: 8px;
  border-radius: 4px;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.08));
  overflow: hidden;
}

.fp-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}

.fp-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: #4CAF50;
  border-radius: 50%;
  animation: fp-rotate 0.8s linear infinite;
  vertical-align: middle;
  margin-right: 0.4rem;
}

@keyframes fp-rotate { to { transform: rotate(360deg); } }

.fp-error {
  color: var(--text-secondary, #888);
  font-size: 0.85rem;
  padding: 0.6rem 0;
}
</style>
