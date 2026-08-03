<template>
  <div class="favorites-page">
    <div class="page-header">
      <h1 class="page-title">我的收藏</h1>
      <span class="count-badge" v-if="list.length">{{ list.length }} 条</span>
    </div>

    <div v-if="!isLoggedIn" class="empty-state">
      <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <h2>请先登录</h2>
      <p>登录后即可收藏你喜欢的绿道</p>
      <button class="btn-primary" @click="goLogin">去登录</button>
    </div>

    <div v-else-if="!list.length" class="empty-state">
      <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <h2>还没有收藏</h2>
      <p>去地图上点击绿道并收藏吧</p>
      <button class="btn-primary" @click="$router.push('/map')">浏览绿道地图</button>
    </div>

    <div v-else class="fav-list">
      <div v-for="item in list" :key="item.greenway_id" class="fav-card" @click="viewDetail(item)">
        <div class="card-img" :style="{ backgroundImage: item.image ? `url(${item.image})` : undefined }">
          <span v-if="!item.image" class="img-placeholder">{{ item.name?.[0] || '绿' }}</span>
        </div>
        <div class="card-body">
          <div class="card-name">{{ item.name }}</div>
          <div class="card-meta">
            <span v-if="item.length">全长 {{ Number(item.length) }} km</span>
            <span v-if="item.location">{{ item.location }}</span>
          </div>
          <div class="card-desc">{{ item.description || item.coverage_area || '' }}</div>
        </div>
        <button class="card-remove" title="取消收藏" @click.stop="removeFav(item)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserAuth } from '@/stores/userAuth'
import { useFavorites } from '@/stores/favorites'
import { fetchFavorites, removeFavorite } from '@/services/favoritesApi'
import { greenwayNameMap } from '@/utils/greenwayHelper'

const router = useRouter()
const { isLoggedIn } = useUserAuth()
const { loadIds } = useFavorites()
const list = ref([])

// 绿道名 → 桌面详情页路由
const NAME_TO_ROUTE = {
  '环二环城市绿道': '/huanerhuan', '昌平42绿道': '/changping42', '温榆河': '/wenyu',
  '亮马河绿道': '/liangmahe', '北运河绿道': '/beiyunhe', '南沙绿道': '/nansha',
  '奥林匹克森林公园绿道': '/aosen', '常营半马绿道': '/changying', '丽都商圈绿道': '/lidu',
  '营城建都绿道': '/yingcheng', '朝阳绿道': '/chaoyang', '北翼山水绿道': '/beiyi',
  '东翼大河绿道': '/dongyi', '郊野休闲环绿道': '/jiaoye', '三山五园绿道': '/sanshan',
  '西翼山水绿道': '/xiyi', '中心城滨水绿道': '/zhongxincheng'
}

async function load() {
  if (!isLoggedIn.value) return
  list.value = await fetchFavorites().catch(() => [])
}

onMounted(load)

function goLogin() {
  router.push('/login')
}

function viewDetail(item) {
  const path = NAME_TO_ROUTE[item.name]
  router.push(path || '/map')
}

async function removeFav(item) {
  await removeFavorite(item.greenway_id).catch(() => {})
  await loadIds()
  list.value = list.value.filter(x => x.greenway_id !== item.greenway_id)
}
</script>

<style scoped>
.favorites-page { min-height: 100vh; background: #f5f6f7; padding: 24px 20px; max-width: 900px; margin: 0 auto; }
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.page-title { font-size: 1.5rem; color: #111; margin: 0; }
.count-badge { background: #2E7D32; color: #fff; font-size: 0.8rem; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 80px 24px; color: #9ca3af; text-align: center; }
.empty-state h2 { font-size: 1.1rem; color: #6b7280; margin: 0; }
.empty-state p { font-size: 0.85rem; margin: 0; }
.btn-primary { background: #2E7D32; color: #fff; border: none; border-radius: 8px; padding: 9px 22px; font-size: 0.9rem; cursor: pointer; }
.btn-primary:hover { background: #256829; }
.fav-list { display: flex; flex-direction: column; gap: 12px; }
.fav-card { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 12px; cursor: pointer; transition: box-shadow 0.2s, transform 0.2s; }
.fav-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); transform: translateY(-1px); }
.card-img { width: 96px; height: 72px; border-radius: 8px; background: #e8f5e9 center/cover no-repeat; display: flex; align-items: center; justify-content: center; flex: 0 0 96px; }
.img-placeholder { font-size: 1.6rem; color: #2E7D32; font-weight: 700; }
.card-body { flex: 1; min-width: 0; }
.card-name { font-size: 1.02rem; font-weight: 600; color: #111; }
.card-meta { display: flex; gap: 10px; font-size: 0.78rem; color: #6b7280; margin-top: 3px; }
.card-desc { font-size: 0.8rem; color: #9ca3af; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-remove { background: none; border: none; color: #d1d5db; cursor: pointer; padding: 8px; border-radius: 8px; }
.card-remove:hover { color: #ef4444; background: #fef2f2; }
[data-theme="night"] .favorites-page { background: #0f0f0f; }
[data-theme="night"] .page-title { color: #e5e7eb; }
[data-theme="night"] .fav-card { background: #1a1a1a; border-color: #2a2a2a; }
[data-theme="night"] .card-name { color: #e5e7eb; }
[data-theme="night"] .card-meta { color: #9ca3af; }
[data-theme="night"] .card-desc { color: #6b7280; }
</style>
