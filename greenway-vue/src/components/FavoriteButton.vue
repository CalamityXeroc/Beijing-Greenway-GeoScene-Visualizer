<template>
  <button
    class="fav-btn"
    :class="{ active: fav, loading: busy }"
    :title="fav ? '取消收藏' : '收藏'"
    @click.stop="onClick"
  >
    <svg viewBox="0 0 24 24" width="18" height="18" :fill="fav ? 'currentColor' : 'none'"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
    <span v-if="label" class="fav-label">{{ fav ? '已收藏' : '收藏' }}</span>
  </button>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserAuth } from '@/stores/userAuth'
import { useFavorites } from '@/stores/favorites'

const props = defineProps({
  greenwayId: { type: [Number, String], required: true },
  greenwayName: { type: String, default: '' },
  label: { type: Boolean, default: false }
})

const router = useRouter()
const { isLoggedIn } = useUserAuth()
const { isFavorite, toggle, loadIds } = useFavorites()

const busy = ref(false)
const fav = computed(() => isFavorite(props.greenwayId))

// 已登录但收藏列表尚未加载时，拉取一次
watch(isLoggedIn, (val) => {
  if (val) loadIds()
}, { immediate: true })

async function onClick() {
  if (!isLoggedIn.value) {
    router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  busy.value = true
  await toggle(props.greenwayId)
  busy.value = false
}
</script>

<style scoped>
.fav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #9ca3af;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8rem;
}
.fav-btn:hover { color: #ef4444; border-color: #ef4444; }
.fav-btn.active { color: #ef4444; border-color: #ef4444; background: #fef2f2; }
.fav-btn.loading { opacity: 0.6; pointer-events: none; }
[data-theme="night"] .fav-btn { background: #1f2937; border-color: #374151; color: #9ca3af; }
[data-theme="night"] .fav-btn.active { background: #3b1117; border-color: #ef4444; }
</style>
