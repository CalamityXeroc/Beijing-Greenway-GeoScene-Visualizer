<template>
  <div class="page">
    <!-- 顶部栏 -->
    <div class="page-header">
      <h1 class="page-title">收藏</h1>
      <span v-if="favorites.length" class="count-badge">{{ favorites.length }}</span>
    </div>

    <!-- 未登录 -->
    <div v-if="!isLoggedIn" class="empty-state">
      <svg class="empty-illustration" viewBox="0 0 120 120" width="120" height="120" fill="none">
        <circle cx="60" cy="60" r="56" fill="var(--fill-primary)" opacity="0.5"/>
        <path d="M10 88 L40 52 L58 76 L72 60 L110 88 Z" fill="var(--green-200)" opacity="0.55"/>
        <path d="M18 92 L48 66 L70 92 Z" fill="var(--green-300)" opacity="0.65"/>
        <path d="M52 94 Q58 78 60 72 Q62 78 68 94" stroke="var(--color-primary)" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M60 68 c-6-5-10-9-10-13 a5.5 5.5 0 0 1 10-3 a5.5 5.5 0 0 1 10 3 c0 4-4 8-10 13z" fill="var(--color-primary)"/>
      </svg>
      <h2>请先登录</h2>
      <p>登录后即可收藏你喜欢的绿道</p>
      <button class="btn-primary" @click="$router.push('/mobile/login')">去登录</button>
    </div>

    <!-- 加载中 -->
    <div v-else-if="loading" class="empty-state">
      <div class="loading-spinner-mini"></div>
      <p>加载中…</p>
    </div>

    <!-- 列表 -->
    <div class="scroll-area" v-else-if="favorites.length">
      <div class="card-list">
        <div v-for="trail in favorites" :key="trail.greenway_id" class="fav-item">
          <TrailCard :trail="trail" @click="viewDetail" />
          <button class="fav-remove" title="取消收藏" @click.stop="removeFav(trail)">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="nav-spacer"></div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <svg class="empty-illustration" viewBox="0 0 120 120" width="120" height="120" fill="none">
        <circle cx="60" cy="60" r="56" fill="var(--fill-primary)" opacity="0.5"/>
        <path d="M10 88 L40 52 L58 76 L72 60 L110 88 Z" fill="var(--green-200)" opacity="0.55"/>
        <path d="M18 92 L48 66 L70 92 Z" fill="var(--green-300)" opacity="0.65"/>
        <path d="M52 94 Q58 78 60 72 Q62 78 68 94" stroke="var(--color-primary)" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M60 68 c-6-5-10-9-10-13 a5.5 5.5 0 0 1 10-3 a5.5 5.5 0 0 1 10 3 c0 4-4 8-10 13z" fill="var(--color-primary)"/>
      </svg>
      <h2>还没有收藏</h2>
      <p>在绿道列表中点击收藏按钮</p>
      <button class="btn-primary" @click="$router.push('/mobile/list')">浏览绿道</button>
    </div>

    <MobileBottomNav v-model="activeTab" />
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, watch } from 'vue'
import { useRouter } from 'vue-router'
import TrailCard from '../components/TrailCard.vue'
import MobileBottomNav from '../components/MobileBottomNav.vue'
import { useUserAuth } from '@/stores/userAuth'
import { useFavorites } from '@/stores/favorites'
import { fetchFavorites, removeFavorite } from '@/services/favoritesApi'

const router = useRouter()
const activeTab = ref('favorites')
const { isLoggedIn } = useUserAuth()
const { loadIds } = useFavorites()
const favorites = ref([])
const loading = ref(false)

const viewDetail = (trail) => router.push(`/mobile/detail/${trail.greenway_id}`)

async function load() {
  if (!isLoggedIn.value) { favorites.value = []; return }
  loading.value = true
  try {
    const data = await fetchFavorites().catch(() => [])
    favorites.value = data.map(d => ({
      greenway_id: d.greenway_id,
      id: d.greenway_id,
      name: d.name,
      length: d.length,
      description: d.description,
      image: d.image,
      location: d.location
    }))
  } finally {
    loading.value = false
  }
}

async function removeFav(trail) {
  await removeFavorite(trail.greenway_id).catch(() => {})
  favorites.value = favorites.value.filter(t => t.greenway_id !== trail.greenway_id)
  await loadIds()
}

watch(isLoggedIn, (val) => { if (val) load() })

onMounted(load)
// keep-alive 缓存下每次进入收藏页都重新加载（否则用户从详情页收藏后回来看到旧列表）
onActivated(load)
</script>

<style scoped>
.page { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--color-bg); }
.page-header {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 10px;
  padding: max(14px, var(--safe-top)) 16px 10px;
  background: transparent;
}
.page-title { font-size: 26px; font-weight: 800; letter-spacing: 0.5px; color: var(--color-text-primary); margin: 0; }
.count-badge { background: var(--gradient-brand); color: #fff; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 99px; box-shadow: 0 2px 8px rgba(5,150,105,0.3); }
.scroll-area { flex: 1; overflow-y: auto; }
.card-list { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
.fav-item { position: relative; }
.fav-remove {
  position: absolute;
  top: 8px; right: 8px;
  width: 34px; height: 34px;
  border-radius: 50%;
  border: none;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-error);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  z-index: 2;
  transition: transform var(--transition-fast);
}
.fav-remove:active { transform: scale(0.88); }
.nav-spacer { height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom,0px) + 32px); }
.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px; color: var(--color-text-tertiary); text-align: center; }
.loading-spinner-mini {
  width: 26px; height: 26px;
  border: 3px solid var(--color-surface-3);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: fav-spin 0.8s linear infinite;
}
@keyframes fav-spin { to { transform: rotate(360deg); } }
.empty-illustration { margin-bottom: 8px; }
.empty-state h2 { font-size: var(--text-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.empty-state p { font-size: var(--text-sm); margin: 0; }
.btn-primary { background: var(--gradient-brand); color: #fff; border: none; border-radius: var(--radius-full); padding: 12px 30px; font-size: var(--text-base); font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(5,150,105,0.32); }
</style>
