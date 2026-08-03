<template>
  <div class="page">
    <!-- 顶部栏 -->
    <div class="page-header">
      <h1 class="page-title">收藏</h1>
      <span v-if="favorites.length" class="count-badge">{{ favorites.length }}</span>
    </div>

    <!-- 未登录 -->
    <div v-if="!isLoggedIn" class="empty-state">
      <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
      <h2>请先登录</h2>
      <p>登录后即可收藏你喜欢的绿道</p>
      <button class="btn-primary" @click="$router.push('/mobile/login')">去登录</button>
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
      <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
      <h2>还没有收藏</h2>
      <p>在绿道列表中点击收藏按钮</p>
      <button class="btn-primary" @click="$router.push('/mobile/list')">浏览绿道</button>
    </div>

    <MobileBottomNav v-model="activeTab" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
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

const viewDetail = (trail) => router.push(`/mobile/detail/${trail.greenway_id}`)

async function load() {
  if (!isLoggedIn.value) { favorites.value = []; return }
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
}

async function removeFav(trail) {
  await removeFavorite(trail.greenway_id).catch(() => {})
  favorites.value = favorites.value.filter(t => t.greenway_id !== trail.greenway_id)
  await loadIds()
}

watch(isLoggedIn, (val) => { if (val) load() })

onMounted(load)
</script>

<style scoped>
.page { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: var(--color-bg); }
.page-header {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 10px;
  padding: max(14px, var(--safe-top)) 16px 12px;
  background: var(--color-surface);
  border-bottom: 0.5px solid var(--color-border);
}
.page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.count-badge { background: var(--color-primary); color: #fff; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.scroll-area { flex: 1; overflow-y: auto; }
.card-list { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
.fav-item { position: relative; }
.fav-remove {
  position: absolute;
  top: 8px; right: 8px;
  width: 32px; height: 32px;
  border-radius: 50%;
  border: none;
  display: flex; align-items: center; justify-content: center;
  color: #ef4444;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  z-index: 2;
}
.fav-remove:active { transform: scale(0.9); }
.nav-spacer { height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom,0px) + 12px); }
.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px; color: var(--color-text-tertiary); text-align: center; }
.empty-state svg { opacity: 0.35; }
.empty-state h2 { font-size: var(--text-lg); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary); }
.empty-state p { font-size: var(--text-sm); margin: 0; }
.btn-primary { background: var(--color-primary); color: #fff; border: none; border-radius: var(--radius-full); padding: 10px 28px; font-size: var(--text-base); font-weight: 600; cursor: pointer; }
</style>
