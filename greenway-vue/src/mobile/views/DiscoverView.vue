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
                <span class="banner-badge">✨ 精选</span>
                <h2 class="banner-name">{{ b.name }}</h2>
                <div class="banner-meta-row">
                  <span class="banner-meta-chip">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {{ b.area }}
                  </span>
                  <span class="banner-meta-chip">{{ b.length }}km</span>
                </div>
              </div>
            </div>
          </div>
          <div class="banner-dots">
            <span v-for="(_, idx) in bannerTrails" :key="idx"
              class="banner-dot" :class="{ active: idx === currentSlide }"></span>
          </div>
        </div>
      </section>

      <!-- 数据总览（数字卡） -->
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-num font-number">{{ totalStats.count }}</span>
          <span class="stat-label">条绿道</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num font-number">{{ totalStats.km }}</span>
          <span class="stat-label">km 总里程</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num font-number">{{ totalStats.poi }}</span>
          <span class="stat-label">个设施</span>
        </div>
      </div>

      <!-- 精选绿道 横滑大卡（复用 TrailCard） -->
      <section class="section featured-section">
        <div class="section-header">
          <span class="section-title section-title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            精选绿道
          </span>
          <button class="section-action section-action-more" @click="goToList">
            查看全部
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
        <div class="card-rail">
          <TrailCard v-for="trail in hotTrails" :key="trail.id" :trail="trail" variant="card"
            @click="viewTrailDetail" />
        </div>
      </section>

      <!-- 绿道智能推荐 -->
      <RecommendSection />

      <!-- 底部安全区 -->
      <div class="nav-spacer"></div>
    </div>

    <!-- 底部导航 -->
    <MobileBottomNav v-model="activeTab" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'
import MobileBottomNav from '../components/MobileBottomNav.vue'
import TrailCard from '../components/TrailCard.vue'
import RecommendSection from '../components/RecommendSection.vue'
import { fetchGreenways } from '../services/api'

const router = useRouter()
const activeTab = ref('discover')
const scrollEl = ref(null)
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

// 交互
const viewTrailDetail = (trail) => router.push(`/mobile/detail/${trail.id}`)
const goToList = () => router.push('/mobile/list')
const showSearch = () => router.push('/mobile/poi-search')

// Banner 自动轮播 + 触摸滑动（keep-alive 下用 activated/deactivated 控制，切走暂停）
let slideTimer = null
const startAutoSlide = () => {
  if (slideTimer) return
  slideTimer = setInterval(() => {
    if (bannerTrails.value.length > 1) currentSlide.value = (currentSlide.value + 1) % bannerTrails.value.length
  }, 4500)
}
const stopAutoSlide = () => { if (slideTimer) { clearInterval(slideTimer); slideTimer = null } }
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
  loadHotTrails()
  loadPoiCount()
  startAutoSlide()
})

// keep-alive：切走暂停轮播，切回恢复（省电 + 减少卡顿）
onDeactivated(() => stopAutoSlide())
onActivated(() => startAutoSlide())

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
/* 顶部氛围光斑 */
.discover-page::before {
  content: '';
  position: fixed;
  top: -80px;
  left: -60px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.08), transparent 70%);
  pointer-events: none;
  z-index: 0;
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

/* 数据总览（数字卡） */
.stats-grid {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px 2px;
}
.stat-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 10px 14px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-soft);
}
.stat-num {
  font-size: 19px;
  font-weight: 800;
  color: var(--color-primary);
  line-height: 1;
}
.stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.stat-divider {
  width: 1px;
  height: 22px;
  background: var(--color-divider);
}

/* Banner 增强 */
.banner-meta-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.banner-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.3);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.95);
  font-size: 10px;
  font-weight: 600;
}
.banner-badge {
  padding: 3px 10px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.85), rgba(245, 158, 11, 0.65));
  border: none;
  letter-spacing: 0.5px;
}

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

/* 通用 */
.load-more-btn {
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
