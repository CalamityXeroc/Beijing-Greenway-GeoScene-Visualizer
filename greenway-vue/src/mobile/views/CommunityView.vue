<template>
  <div class="community-page">
    <!-- 可滚动内容区 -->
    <div class="scroll-area" ref="scrollEl">
      <!-- 顶部标题 -->
      <div class="community-top">
        <h1 class="page-title">社区</h1>
        <span class="page-sub">绿道爱好者的聚集地</span>
      </div>

      <!-- 统计概览卡（4 格） -->
      <section class="stats-section">
        <div class="stats-card" v-for="s in statItems" :key="s.key">
          <span class="stat-icon" :class="'stat-icon--' + s.key" v-html="s.icon"></span>
          <span class="stat-num font-number">{{ stats[s.key] ?? '—' }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
      </section>

      <!-- 热门绿道榜（纵向榜单） -->
      <section class="section rank-section">
        <div class="section-header">
          <span class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M17 3H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><path d="M9 8l2.5 2.5L16 6"/></svg>
            热门绿道榜
          </span>
          <button class="section-action" @click="goAllRank">查看完整榜单</button>
        </div>

        <!-- 骨架屏 -->
        <div v-if="rankLoading" class="rank-skeleton">
          <div class="rank-skeleton-row" v-for="i in 5" :key="i">
            <div class="skeleton skeleton-avatar" style="width:36px;height:36px;border-radius:10px;"></div>
            <div class="rank-skeleton-body">
              <div class="skeleton skeleton-text" style="width: 55%;"></div>
              <div class="skeleton skeleton-text-sm" style="width: 30%;"></div>
            </div>
          </div>
        </div>

        <!-- 榜单列表 -->
        <div v-else class="rank-list">
          <div class="rank-row" v-for="(item, idx) in rankList" :key="item.name" @click="goDetail(item)">
            <div class="rank-badge" :class="'rank-badge--' + (idx + 1)">{{ idx + 1 }}</div>
            <div class="rank-main">
              <div class="rank-top">
                <span class="rank-name">{{ item.name }}</span>
                <span class="rank-grade" :class="'grade-' + item.grade">{{ item.grade }}</span>
              </div>
              <div class="rank-meta">
                <span class="rank-meta-tag">热度 #{{ item.heatRank }}</span>
                <span class="rank-meta-tag">{{ item.lenKm }} km</span>
                <span class="rank-meta-tag">{{ item.score }} 分</span>
              </div>
            </div>
            <span class="rank-arrow">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </span>
          </div>
        </div>
      </section>

      <!-- 社区动态 -->
      <section class="section feed-section">
        <div class="section-header">
          <span class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            社区动态
          </span>
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
import { fetchCommunityStats, fetchGreenwayAssess, fetchRecentComments } from '../services/api'

const router = useRouter()
const activeTab = ref('community')
const scrollEl = ref(null)

/* ── 统计概览 ── */
const stats = ref({ totalComments: null, todayComments: null, totalUsers: null, totalGreenways: null })
const statItems = [
  { key: 'totalComments', label: '社区动态', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' },
  { key: 'todayComments', label: '今日新动态', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>' },
  { key: 'totalUsers', label: '社区用户', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { key: 'totalGreenways', label: '绿道总数', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-6 4 3 5-8"/></svg>' }
]
const loadStats = async () => {
  try {
    stats.value = await fetchCommunityStats()
  } catch (e) {
    console.error('加载社区统计失败:', e)
  }
}

/* ── 热门绿道榜（按热度排名） ── */
const rankLoading = ref(true)
const rankList = ref([])
const greenwayIdMap = ref({})  // name → id（详情跳转）
const loadRank = async () => {
  rankLoading.value = true
  try {
    const [assess, geojson] = await Promise.all([
      fetchGreenwayAssess(),
      import('../services/api').then(m => m.fetchGreenways())
    ])
    // name → id 映射（assess 返回 name，详情路由需要 id）
    const map = {}
    ;(geojson.features || []).forEach(f => {
      const p = f.properties
      if (p?.name != null && p?.id != null) map[String(p.name)] = p.id
    })
    greenwayIdMap.value = map
    // 按 heatRank 升序取前 5
    rankList.value = (assess.items || [])
      .filter(it => it.heatRank != null)
      .sort((a, b) => a.heatRank - b.heatRank)
      .slice(0, 5)
      .map(it => ({ ...it, id: map[String(it.name)] }))
  } catch (e) {
    console.error('加载热度榜失败:', e)
  } finally {
    rankLoading.value = false
  }
}
const goDetail = (item) => {
  if (item.id != null) router.push(`/mobile/detail/${item.id}`)
}
const goAllRank = () => router.push('/mobile/list')

/* ── 社区动态（迁移自 DiscoverView） ── */
const feedLoading = ref(true)
const loadingMore = ref(false)
const feedList = ref([])
const feedError = ref('')
const allFeatures = ref([])

const coverByGreenwayId = computed(() => {
  const map = {}
  allFeatures.value.forEach(f => {
    const p = f.properties
    if (p?.id != null && p?.image) map[String(p.id)] = p.image
  })
  return map
})

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
let hasMoreFeed = true
const loadMoreFeed = async () => {
  if (loadingMore.value || !hasMoreFeed) return
  loadingMore.value = true
  try {
    // 接口每次取最新 N 条，已加载的通过 id 去重，避免重复追加
    const data = await fetchRecentComments(feedList.value.length + 10)
    const all = (data.data?.list || []).map(mapFeedItem)
    const seen = new Set(feedList.value.map(f => f.id))
    const fresh = all.filter(f => !seen.has(f.id))
    if (fresh.length) {
      feedList.value = [...feedList.value, ...fresh]
    } else {
      hasMoreFeed = false  // 没有新数据说明已到底
    }
  } catch (e) {
    console.error('加载更多动态失败:', e)
  } finally {
    loadingMore.value = false
  }
}

const toggleFeedLike = (feed) => { feed.liked = !feed.liked; feed.likes += feed.liked ? 1 : -1 }
const viewComment = (feed) => {
  const id = Number(feed.greenway_id)
  if (Number.isFinite(id) && id > 0) router.push(`/mobile/detail/${id}`)
}

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

onMounted(async () => {
  loadStats()
  loadRank()
  // 加载绿道（封面映射依赖），完成后再加载动态
  try {
    const geojson = await fetchGreenways()
    allFeatures.value = geojson.features || []
  } catch (e) {
    console.error('加载绿道失败:', e)
  }
  loadFeed()
})

onUnmounted(() => {})
</script>

<style scoped>
.community-page {
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

/* ─────────── 顶部标题 ─────────── */
.community-top {
  padding: max(14px, var(--safe-top)) 16px 4px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.page-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--color-text-primary);
  margin: 0;
}
.page-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ─────────── 统计概览卡 ─────────── */
.stats-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 12px 16px 4px;
}
.stats-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 14px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-soft);
  animation: fadeSlideUp 0.5s ease-out both;
}
.stats-card:nth-child(2) { animation-delay: 0.06s; }
.stats-card:nth-child(3) { animation-delay: 0.12s; }
.stats-card:nth-child(4) { animation-delay: 0.18s; }
.stat-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.stat-icon--totalComments { background: linear-gradient(135deg, #22c55e, #16a34a); }
.stat-icon--todayComments { background: linear-gradient(135deg, #f59e0b, #f97316); }
.stat-icon--totalUsers { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.stat-icon--totalGreenways { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
.stat-num {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1;
}
.stat-label {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

/* ─────────── 区块标题 ─────────── */
.section {
  padding: 18px 0 0;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
}
.section-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.section-title svg { color: var(--color-primary); }
.section-action {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

/* ─────────── 热门绿道榜（纵向榜单） ─────────── */
.rank-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  transition: transform var(--transition-fast);
}
.rank-row:active { transform: scale(0.98); }
.rank-badge {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  background: #9e9e9e;
}
.rank-badge--1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); }
.rank-badge--2 { background: linear-gradient(135deg, #94a3b8, #64748b); }
.rank-badge--3 { background: linear-gradient(135deg, #d4a373, #b07d4b); }
.rank-main { flex: 1; min-width: 0; }
.rank-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rank-name {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-grade {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.grade-优 { background: rgba(34, 197, 94, 0.15); color: #16a34a; }
.grade-良 { background: rgba(59, 130, 246, 0.13); color: #2563eb; }
.grade-中 { background: rgba(245, 158, 11, 0.15); color: #d97706; }
.grade-待提升 { background: rgba(239, 68, 68, 0.13); color: #dc2626; }
.rank-meta {
  display: flex;
  gap: 6px;
  margin-top: 5px;
}
.rank-meta-tag {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-surface-2);
  padding: 2px 8px;
  border-radius: 10px;
}
.rank-arrow {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
}

/* 榜单骨架 */
.rank-skeleton {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rank-skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 14px;
  border: 1px solid var(--color-border-light);
}
.rank-skeleton-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }

/* ─────────── 社区动态（迁移自发现页） ─────────── */
.feed-list { padding: 0 16px; }
.feed-card {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--color-border-light);
}
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
.load-more { padding: 4px 16px 16px; text-align: center; }
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
.load-more-btn:active:not(:disabled) { background: var(--color-surface-2); }
.load-more-btn:disabled { opacity: 0.6; }

.nav-spacer {
  height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 36px);
}

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
