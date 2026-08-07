<template>
  <div class="discover-page">
    <!-- 可滚动内容区 -->
    <div class="scroll-area" ref="scrollEl">
      <!-- 顶部搜索栏 -->
      <div class="discover-top">
        <h1 class="page-title">发现</h1>
        <button class="top-search" @click="showSearch" aria-label="搜索">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>

      <!-- 大图 Banner 轮播（社区风） -->
      <section class="banner-section">
        <div class="banner" @touchstart="onTouchStart" @touchend="onTouchEnd">
          <div class="banner-track" :style="{ transform: `translateX(-${currentSlide * 100}%)` }">
            <div class="banner-slide" v-for="b in bannerTrails" :key="b.id" @click="viewTrailDetail(b)">
              <img :src="`/images/greenways/${b.image}`" :alt="b.name" class="banner-img" loading="lazy"
                @error="e => e.target.src = '/images/greenways/placeholder.svg'" />
              <div class="banner-overlay"></div>
              <div class="banner-caption">
                <span class="banner-badge">精选</span>
                <h2 class="banner-name">{{ b.name }}</h2>
                <p class="banner-meta">{{ b.length }}km · {{ b.area }}</p>
              </div>
            </div>
          </div>
          <div class="banner-dots">
            <span v-for="(_, idx) in bannerTrails" :key="idx"
              class="banner-dot" :class="{ active: idx === currentSlide }"></span>
          </div>
        </div>
      </section>

      <!-- 数据总览小字 -->
      <div class="stats-line">
        <span>{{ totalStats.count }} 条绿道</span>
        <span class="sl-sep">·</span>
        <span>{{ totalStats.km }} km 总里程</span>
        <span class="sl-sep">·</span>
        <span>{{ totalStats.poi }} 个设施</span>
      </div>

      <!-- 精选绿道 横滑大卡（复用 TrailCard） -->
      <section class="section featured-section">
        <div class="section-header">
          <span class="section-title">精选绿道</span>
          <button class="section-action" @click="goToList">查看全部</button>
        </div>
        <div class="card-rail">
          <TrailCard v-for="trail in hotTrails" :key="trail.id" :trail="trail" variant="card"
            @click="viewTrailDetail" />
        </div>
      </section>

      <!-- 社区动态 -->
      <section class="section">
        <div class="section-header">
          <span class="section-title">社区动态</span>
          <button class="section-action" @click="refreshFeed">刷新</button>
        </div>
        
        <!-- 骨架屏 -->
        <div v-if="feedLoading" class="feed-skeleton">
          <div class="feed-card" v-for="i in 2" :key="i">
            <div class="feed-card-header">
              <div class="skeleton skeleton-avatar"></div>
              <div class="feed-card-info">
                <div class="skeleton skeleton-text" style="width: 80px;"></div>
                <div class="skeleton skeleton-text-sm" style="width: 60px;"></div>
              </div>
            </div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 70%;"></div>
          </div>
        </div>

        <!-- 动态列表 -->
        <div v-else class="feed-list">
          <article class="feed-card" v-for="feed in feedList" :key="feed.id">
            <div class="feed-card-header">
              <div class="avatar avatar-md" :style="{ background: getAvatarBg(feed.user) }">
                {{ feed.user?.charAt(0) || '?' }}
              </div>
              <div class="feed-card-info">
                <span class="feed-card-name">{{ feed.user }}</span>
                <span class="feed-card-meta">
                  {{ feed.greenway }} · {{ formatTime(feed.time) }}
                </span>
              </div>
              <span class="feed-rating">{{ renderStars(feed.rating) }}</span>
            </div>
            <p class="feed-card-content">{{ feed.content }}</p>
            <div v-if="feed.cover" class="feed-cover" @click="viewComment(feed)">
              <img :src="`/images/greenways/${feed.cover}`" :alt="feed.greenway" class="feed-cover-img" loading="lazy"
                @error="e => e.target.style.display = 'none'" />
            </div>
            <div class="feed-card-actions">
              <button class="feed-action-btn" :class="{ active: feed.liked }" @click="toggleFeedLike(feed)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                </svg>
                {{ feed.likes || 0 }}
              </button>
              <button class="feed-action-btn" @click="viewComment(feed)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                回复
              </button>
            </div>
          </article>
        </div>

        <!-- 加载更多 -->
        <div v-if="!feedLoading && feedList.length" class="load-more">
          <button class="load-more-btn" @click="loadMoreFeed" :disabled="loadingMore">
            {{ loadingMore ? '加载中...' : '加载更多动态' }}
          </button>
        </div>

        <!-- 空/错误态 -->
        <div v-if="!feedLoading && !feedList.length && feedError" class="feed-hint error">{{ feedError }}</div>
        <div v-else-if="!feedLoading && !feedList.length && !feedError" class="feed-hint">还没有动态，来发布第一条吧</div>
      </section>

      <!-- 底部安全区 -->
      <div class="nav-spacer"></div>
    </div>

    <!-- 底部导航 -->
    <MobileBottomNav v-model="activeTab" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import MobileBottomNav from '../components/MobileBottomNav.vue'
import TrailCard from '../components/TrailCard.vue'
import { fetchGreenways, fetchRecentComments } from '../services/api'

const router = useRouter()
const activeTab = ref('discover')
const scrollEl = ref(null)
const feedLoading = ref(true)
const loadingMore = ref(false)
const feedList = ref([])
const feedError = ref('')
const hotTrails = ref([])
const allFeatures = ref([])
const currentSlide = ref(0)

// 首页数据总览（实时统计，突出 WebGIS 数据特色）
const totalStats = computed(() => {
  const feats = allFeatures.value
  const km = feats.reduce((s, f) => s + (parseFloat(f.properties?.length) || 0), 0)
  return {
    count: feats.length || 17,
    km: Math.round(km),
    poi: poiCount.value
  }
})
const poiCount = ref(0)
const loadPoiCount = async () => {
  try {
    const { fetchPoiFacilities } = await import('../services/api')
    const data = await fetchPoiFacilities()
    poiCount.value = (data.features || []).length || 0
  } catch (e) {
    poiCount.value = 0
  }
}

// banner 数据：热门绿道前 3 张
const bannerTrails = computed(() => hotTrails.value.slice(0, 3))

// 时长估算（骑行 ~15km/h，短途按步行换算）——TrailCard 的 durationNum 解析需要"X小时"格式
const calcDuration = (len) => {
  if (!len) return '--'
  if (len < 5) return `${Math.max(15, Math.round((len / 5) * 60 / 15) * 15)}分钟`
  if (len < 20) return `${Math.round((len / 15) * 2) / 2}小时`
  return `${Math.round(len / 15)}小时`
}
// 难度分级（按里程）→ 英文 key 供 TrailCard diffText 映射
const calcDifficulty = (len) => {
  if (!len) return 'medium'
  if (len < 8) return 'easy'
  if (len < 25) return 'medium'
  return 'hard'
}

// 加载热门绿道（同时记录全量用于统计与封面映射）
const loadHotTrails = async () => {
  try {
    const geojson = await fetchGreenways()
    const features = geojson.features || []
    allFeatures.value = features
    hotTrails.value = features
      .slice(0, 5)
      .map((f, idx) => {
        const len = parseFloat(f.properties?.length) || 0
        return {
          id: f.properties?.id || idx,
          name: f.properties?.name || '未知绿道',
          length: len,
          area: f.properties?.area || f.properties?.district || '北京',
          image: f.properties?.image || '',
          difficulty: calcDifficulty(len),
          duration: calcDuration(len)
        }
      })
  } catch (e) {
    console.error('加载热门绿道失败:', e)
  }
}

// 社区动态封面映射：greenway_id → image（用全量绿道数据）
const coverByGreenwayId = computed(() => {
  const map = {}
  allFeatures.value.forEach(f => {
    const p = f.properties
    if (p?.id != null && p?.image) map[String(p.id)] = p.image
  })
  return map
})

// 社区动态字段映射（loadFeed / loadMoreFeed 统一）
const mapFeedItem = (c) => ({
  id: c.id,
  user: c.nickname || c.username || '绿道爱好者',
  greenway_id: c.greenway_id,
  greenway: c.greenway_name || `绿道#${c.greenway_id}`,
  content: c.content,
  rating: c.rating || 5,
  time: c.created_at,
  likes: c.like_count || 0,
  liked: false,
  cover: coverByGreenwayId.value[String(c.greenway_id)] || ''
})

// 加载社区动态
const loadFeed = async () => {
  feedLoading.value = true
  feedError.value = ''
  try {
    const res = await fetchRecentComments(10)
    feedList.value = (res.data?.list || []).map(mapFeedItem)
  } catch (e) {
    console.error('加载动态失败:', e)
    feedList.value = []
    feedError.value = '动态加载失败，请稍后重试'
  } finally {
    feedLoading.value = false
  }
}

const refreshFeed = () => loadFeed()
const loadMoreFeed = async () => {
  loadingMore.value = true
  try {
    const data = await fetchRecentComments(feedList.value.length + 10)
    const more = data.data?.list || []
    if (more.length) {
      feedList.value = [...feedList.value, ...more.map(mapFeedItem)]
    }
  } catch (e) {
    console.error('加载更多动态失败:', e)
  } finally {
    loadingMore.value = false
  }
}

// 工具函数
const getAvatarBg = (name) => {
  const colors = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #11998e, #38ef7d)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #fc4a1a, #f7b733)'
  ]
  return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

const renderStars = (n) => '★'.repeat(Math.min(5, Math.max(0, n))) + '☆'.repeat(5 - Math.min(5, Math.max(0, n)))

const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  return d.toLocaleDateString('zh-CN')
}

// 交互
const viewTrailDetail = (trail) => router.push(`/mobile/detail/${trail.id}`)
const goToList = () => router.push('/mobile/list')
const showSearch = () => router.push('/mobile/poi-search')
const toggleFeedLike = (feed) => { feed.liked = !feed.liked; feed.likes += feed.liked ? 1 : -1 }
const viewComment = (feed) => router.push(`/mobile/detail/${feed.greenway_id || 1}`)

// Banner 自动轮播 + 触摸滑动
let slideTimer = null
const startAutoSlide = () => {
  slideTimer = setInterval(() => {
    if (bannerTrails.value.length > 1) currentSlide.value = (currentSlide.value + 1) % bannerTrails.value.length
  }, 4500)
}
const stopAutoSlide = () => { if (slideTimer) clearInterval(slideTimer) }
let touchStartX = 0
const onTouchStart = (e) => {
  stopAutoSlide()
  touchStartX = e.touches[0].clientX
}
const onTouchEnd = (e) => {
  const diff = touchStartX - e.changedTouches[0].clientX
  if (Math.abs(diff) > 40) {
    if (diff > 0 && currentSlide.value < bannerTrails.value.length - 1) currentSlide.value++
    else if (diff < 0 && currentSlide.value > 0) currentSlide.value--
  }
  startAutoSlide()
}

onMounted(() => {
  // 先加载绿道（封面映射依赖 allFeatures），完成后再加载社区动态
  loadHotTrails().then(() => {
    loadFeed()
    startAutoSlide()
  })
  loadPoiCount()
})

onUnmounted(() => stopAutoSlide())
</script>

<style scoped>
.discover-page {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg);
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* ─────────── 顶部搜索栏 ─────────── */
.discover-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: max(14px, var(--safe-top)) 16px 8px;
}
.page-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--color-text-primary);
  margin: 0;
}
.top-search {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.top-search:active { background: var(--color-surface-2); }

/* ─────────── 大图 Banner 轮播 ─────────── */
.banner-section {
  padding: 6px 16px 0;
}
.banner {
  position: relative;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  height: 196px;
}
.banner-track {
  display: flex;
  height: 100%;
  transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.banner-slide {
  flex: 0 0 100%;
  position: relative;
  cursor: pointer;
  height: 100%;
}
.banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.banner-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.55));
}
.banner-caption {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 16px;
  color: #fff;
}
.banner-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.22);
  border: 1px solid rgba(255,255,255,0.3);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.banner-name {
  font-size: 21px;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.3px;
  text-shadow: 0 2px 10px rgba(0,0,0,0.4);
}
.banner-meta {
  font-size: 12px;
  margin: 4px 0 0;
  opacity: 0.85;
}
.banner-dots {
  position: absolute;
  bottom: 10px;
  right: 16px;
  display: flex;
  gap: 5px;
}
.banner-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
  transition: all 0.3s;
}
.banner-dot.active {
  width: 18px;
  border-radius: 3px;
  background: #fff;
}

/* 数据总览小字 */
.stats-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.sl-sep { color: var(--color-text-tertiary); opacity: 0.6; }

/* 区块错位入场动画 */
.banner-section { animation: fadeSlideUp 0.6s ease-out both; }
.featured-section { animation: fadeSlideUp 0.6s ease-out 0.12s both; }
.section:nth-of-type(2) { animation: fadeSlideUp 0.6s ease-out 0.2s both; }

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 精选绿道 横滑大卡（TrailCard card-rail，仿 ListView） */
.section.featured-section {
  padding: 22px 0 4px;
}
.card-rail {
  display: flex;
  gap: 14px;
  padding: 0 16px 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.card-rail::-webkit-scrollbar { display: none; }


/* 动态（社区贴） */
.feed-list {
  padding: 0 16px;
}
.feed-card {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--color-border-light);
}
.feed-rating {
  color: var(--color-warning);
  font-size: 12px;
}
/* 社区贴封面图 */
.feed-cover {
  margin: 12px 0 2px;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
}
.feed-cover-img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}
.feed-cover:active .feed-cover-img { transform: scale(1.03); }

/* 加载更多 */
.load-more {
  padding: 16px;
  text-align: center;
}
.feed-hint {
  padding: 24px 16px;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}
.feed-hint.error { color: var(--color-error); }
.load-more-btn {
  padding: 12px 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.load-more-btn:active:not(:disabled) {
  background: var(--color-surface-2);
}
.load-more-btn:disabled {
  opacity: 0.6;
}

/* 通用 */
.section {
  padding: 20px 0;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 14px;
}
.section-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.section-action {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.nav-spacer {
  height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 36px);
}
</style>
