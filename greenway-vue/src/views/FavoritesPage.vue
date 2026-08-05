<template>
  <div class="favorites-page">
    <!-- 两侧装饰背景：山丘 / 松树 / 步道剪影（fixed 铺在空白栏上） -->
    <div class="bg-decoration left" aria-hidden="true">
      <svg viewBox="0 0 380 1000" preserveAspectRatio="xMidYMax slice">
        <path d="M0 780 C70 700 160 730 230 690 C290 656 340 680 380 660 L380 1000 L0 1000 Z" fill="var(--dec-far)"/>
        <path d="M0 840 C80 780 180 800 260 850 C310 880 350 860 380 872 L380 1000 L0 1000 Z" fill="var(--dec-mid)"/>
        <path d="M0 920 C100 860 220 900 380 930 L380 1000 L0 1000 Z" fill="var(--dec-near)"/>
        <path d="M-10 1000 C90 940 40 900 120 850 C200 800 140 760 220 700 C280 655 300 620 330 590" fill="none" stroke="var(--dec-trail)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 10"/>
        <g transform="translate(64 750)">
          <path d="M0 0 L26 -56 L52 0 Z" fill="var(--dec-tree)"/>
          <rect x="21" y="0" width="9" height="18" rx="2" fill="var(--dec-trunk)"/>
        </g>
        <g transform="translate(296 850)">
          <path d="M0 0 L22 -46 L44 0 Z" fill="var(--dec-tree)"/>
          <rect x="17" y="0" width="8" height="15" rx="2" fill="var(--dec-trunk)"/>
        </g>
        <circle cx="150" cy="700" r="4" fill="var(--dec-dot)"/>
        <circle cx="280" cy="620" r="3" fill="var(--dec-dot)"/>
        <circle cx="110" cy="890" r="3" fill="var(--dec-dot)"/>
        <circle cx="330" cy="770" r="2.5" fill="var(--dec-dot)"/>
      </svg>
    </div>
    <div class="bg-decoration right" aria-hidden="true">
      <svg viewBox="0 0 380 1000" preserveAspectRatio="xMidYMax slice">
        <path d="M0 780 C70 700 160 730 230 690 C290 656 340 680 380 660 L380 1000 L0 1000 Z" fill="var(--dec-far)"/>
        <path d="M0 840 C80 780 180 800 260 850 C310 880 350 860 380 872 L380 1000 L0 1000 Z" fill="var(--dec-mid)"/>
        <path d="M0 920 C100 860 220 900 380 930 L380 1000 L0 1000 Z" fill="var(--dec-near)"/>
        <path d="M-10 1000 C90 940 40 900 120 850 C200 800 140 760 220 700 C280 655 300 620 330 590" fill="none" stroke="var(--dec-trail)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 10"/>
        <g transform="translate(64 750)">
          <path d="M0 0 L26 -56 L52 0 Z" fill="var(--dec-tree)"/>
          <rect x="21" y="0" width="9" height="18" rx="2" fill="var(--dec-trunk)"/>
        </g>
        <g transform="translate(296 850)">
          <path d="M0 0 L22 -46 L44 0 Z" fill="var(--dec-tree)"/>
          <rect x="17" y="0" width="8" height="15" rx="2" fill="var(--dec-trunk)"/>
        </g>
        <circle cx="150" cy="700" r="4" fill="var(--dec-dot)"/>
        <circle cx="280" cy="620" r="3" fill="var(--dec-dot)"/>
        <circle cx="110" cy="890" r="3" fill="var(--dec-dot)"/>
        <circle cx="330" cy="770" r="2.5" fill="var(--dec-dot)"/>
      </svg>
    </div>
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="goBack" aria-label="返回">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        返回
      </button>
      <span class="top-bar-title" v-if="list.length">我的收藏</span>
      <button class="browse-btn" @click="$router.push('/map')" v-if="isLoggedIn">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="10 8 16 12 10 16 10 8"/>
        </svg>
        去地图
      </button>
    </div>

    <!-- 未登录 -->
    <div v-if="!isLoggedIn" class="empty-state">
      <div class="empty-icon heartbeat">
        <svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </div>
      <h2>请先登录</h2>
      <p>登录后即可收藏你喜欢的绿道</p>
      <button class="btn-primary" @click="goLogin">去登录</button>
    </div>

    <!-- 空收藏 -->
    <div v-else-if="!list.length" class="empty-state">
      <div class="empty-icon heartbeat">
        <svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          <path d="M3 12h5l2-4 3 7 2-3h6"/>
        </svg>
      </div>
      <h2>还没有收藏</h2>
      <p>去地图上点击绿道并收藏吧</p>
      <button class="btn-primary" @click="$router.push('/map')">浏览绿道地图</button>
    </div>

    <!-- 收藏列表 -->
    <template v-else>
      <!-- 概览横幅 -->
      <div class="overview-banner">
        <div class="banner-left">
          <div class="banner-title">我的收藏</div>
          <div class="banner-sub">收藏你心仪的绿道，随时回来看看</div>
        </div>
        <div class="banner-stats">
          <div class="stat">
            <b>{{ list.length }}</b>
            <span>条收藏</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <b>{{ totalKm }}</b>
            <span>公里 · 总长</span>
          </div>
        </div>
      </div>

      <div class="fav-list">
        <div
          v-for="item in list"
          :key="item.greenway_id"
          class="fav-card"
          :style="{ '--gw-color': colorOf(item) }"
          @click="viewDetail(item)"
        >
          <div class="card-thumb">
            <img
              v-if="!isFailed(item) && imageSrc(item)"
              :src="imageSrc(item)"
              :alt="item.name"
              loading="lazy"
              @error="markFailed(item)"
            />
            <div v-else class="thumb-fallback" :style="{ background: gradientOf(item) }">
              {{ initialOf(item) }}
            </div>
            <span v-if="item.length" class="thumb-length">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {{ item.length }} km
            </span>
          </div>
          <div class="card-body">
            <div class="card-name">
              <span class="name-dot" :style="{ background: colorOf(item) }"></span>
              {{ item.name }}
            </div>
            <div class="card-tags">
              <span v-if="item.location" class="tag tag-loc">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                {{ item.location }}
              </span>
              <span v-else class="tag tag-loc">北京市</span>
              <span v-if="item.coverage_area" class="tag tag-area">{{ item.coverage_area }}</span>
            </div>
            <div class="card-desc">{{ item.description || item.coverage_area || '探索这条绿道的沿途风景' }}</div>
          </div>
          <button class="card-remove" title="取消收藏" @click.stop="removeFav(item)">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserAuth } from '@/stores/userAuth'
import { useFavorites } from '@/stores/favorites'
import { fetchFavorites, removeFavorite } from '@/services/favoritesApi'
import { greenwayColorMap } from '@/utils/greenwayHelper'

const router = useRouter()
const { isLoggedIn } = useUserAuth()
const { loadIds } = useFavorites()
const list = ref([])
const failedIds = ref(new Set())

// 绿道名 → 桌面详情页路由
const NAME_TO_ROUTE = {
  '环二环城市绿道': '/huanerhuan', '昌平42绿道': '/changping42', '温榆河': '/wenyu',
  '亮马河绿道': '/liangmahe', '北运河绿道': '/beiyunhe', '南沙绿道': '/nansha',
  '奥林匹克森林公园绿道': '/aosen', '常营半马绿道': '/changying', '丽都商圈绿道': '/lidu',
  '营城建都绿道': '/yingcheng', '朝阳绿道': '/chaoyang', '北翼山水绿道': '/beiyi',
  '东翼大河绿道': '/dongyi', '郊野休闲环绿道': '/jiaoye', '三山五园绿道': '/sanshan',
  '西翼山水绿道': '/xiyi', '中心城滨水绿道': '/zhongxincheng'
}

const totalKm = computed(() => {
  const sum = list.value.reduce((acc, x) => acc + (Number(x.length) || 0), 0)
  return Number.isFinite(sum) ? Math.round(sum * 10) / 10 : 0
})

function colorOf(item) {
  return greenwayColorMap[item.name] || '#2E7D32'
}
function gradientOf(item) {
  const c = colorOf(item)
  return `linear-gradient(135deg, ${c} 0%, ${c}cc 100%)`
}
function initialOf(item) {
  return String(item.name || '绿').slice(0, 1)
}
function imageSrc(item) {
  return item.image ? `/images/greenways/${item.image}` : ''
}
function isFailed(item) {
  return failedIds.value.has(item.greenway_id)
}
function markFailed(item) {
  const next = new Set(failedIds.value)
  next.add(item.greenway_id)
  failedIds.value = next
}

async function load() {
  if (!isLoggedIn.value) return
  list.value = await fetchFavorites().catch(() => [])
}

onMounted(load)

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/map')
}

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
.favorites-page {
  isolation: isolate;
  min-height: 100vh;
  padding: 76px 20px 40px;
  max-width: 860px;
  margin: 0 auto;
  background:
    radial-gradient(1000px 480px at 85% -10%, rgba(46, 125, 50, 0.10), transparent 60%),
    radial-gradient(800px 420px at -10% 20%, rgba(33, 150, 243, 0.07), transparent 55%),
    linear-gradient(180deg, #f2f7f3 0%, #f8fbf9 40%, #eef5ef 100%);
}

/* 全屏底色层：让内容区与两侧空白栏色调连贯 */
.favorites-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(1200px 700px at 10% -10%, rgba(46, 125, 50, 0.08), transparent 60%),
    radial-gradient(1100px 650px at 90% 112%, rgba(33, 150, 243, 0.06), transparent 60%),
    linear-gradient(180deg, #eef5ef 0%, #f7faf6 100%);
}

/* ===== 两侧装饰背景：山丘 / 松树 / 步道 ===== */
.bg-decoration {
  position: fixed;
  top: 0;
  bottom: 0;
  width: clamp(220px, 26vw, 400px);
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  --dec-far: rgba(46, 125, 50, 0.10);
  --dec-mid: rgba(27, 94, 32, 0.14);
  --dec-near: rgba(20, 83, 45, 0.20);
  --dec-tree: rgba(27, 94, 32, 0.30);
  --dec-trunk: rgba(124, 90, 58, 0.35);
  --dec-trail: rgba(247, 167, 42, 0.55);
  --dec-dot: rgba(76, 175, 80, 0.30);
}
.bg-decoration.left { left: 0; }
.bg-decoration.right { right: 0; }
.bg-decoration svg {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 82%;
}
.bg-decoration.right svg { transform: scaleX(-1); }

/* ===== 顶部操作栏 ===== */
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(46, 125, 50, 0.25);
  background: #fff;
  color: #2E7D32;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(46, 125, 50, 0.12);
}
.back-btn:hover { background: #2E7D32; color: #fff; transform: translateX(-2px); }
.top-bar-title { font-size: 1rem; font-weight: 700; color: #2c3e50; }
.browse-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(46, 125, 50, 0.25);
  background: #fff;
  color: #2E7D32;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.browse-btn:hover { background: #e8f5e9; }

/* ===== 概览横幅 ===== */
.overview-banner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 26px;
  border-radius: 18px;
  margin-bottom: 20px;
  color: #fff;
  background:
    radial-gradient(420px 180px at 90% -20%, rgba(255, 255, 255, 0.22), transparent 60%),
    linear-gradient(120deg, #2E7D32 0%, #1b5e20 55%, #14532d 100%);
  box-shadow: 0 12px 28px rgba(27, 94, 32, 0.28);
}
.banner-title { font-size: 1.35rem; font-weight: 800; letter-spacing: 0.3px; }
.banner-sub { font-size: 0.82rem; color: rgba(255, 255, 255, 0.82); margin-top: 3px; }
.banner-stats { display: flex; align-items: center; gap: 16px; }
.stat { display: flex; flex-direction: column; align-items: center; }
.stat b { font-size: 1.5rem; font-weight: 800; line-height: 1; }
.stat span { font-size: 0.72rem; color: rgba(255, 255, 255, 0.82); margin-top: 4px; }
.stat-divider { width: 1px; height: 34px; background: rgba(255, 255, 255, 0.3); }

/* ===== 收藏列表 ===== */
.fav-list { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; }
.fav-card {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-left: 5px solid var(--gw-color, #2E7D32);
  border-radius: 16px;
  padding: 14px 48px 14px 14px;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(20, 60, 30, 0.06);
  transition: box-shadow 0.22s, transform 0.22s, border-color 0.22s;
}
.fav-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--gw-color) 6%, transparent), transparent 42%);
  pointer-events: none;
}
.fav-card:hover {
  box-shadow: 0 10px 26px rgba(20, 60, 30, 0.14);
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--gw-color) 40%, transparent);
}
.card-thumb {
  position: relative;
  width: 132px;
  height: 96px;
  flex: 0 0 132px;
  border-radius: 12px;
  overflow: hidden;
  background: #e8f5e9;
}
.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}
.fav-card:hover .card-thumb img { transform: scale(1.06); }
.thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 2rem;
  font-weight: 800;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.thumb-length {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}
.card-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
.card-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.08rem;
  font-weight: 700;
  color: #1f2937;
}
.name-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: 0 0 10px;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--gw-color) 18%, transparent);
}
.card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
}
.tag-loc { background: #eef4fb; color: #1d4ed8; }
.tag-area { background: #f0f7f1; color: #2E7D32; }
.card-desc {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-remove {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  color: #d1d5db;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s;
}
.card-remove:hover { color: #fff; background: #ef4444; transform: scale(1.08); }

/* ===== 空状态 ===== */
.empty-state {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 90px 24px;
  color: #9ca3af;
  text-align: center;
}
.empty-icon {
  width: 108px;
  height: 108px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #2E7D32;
  background: radial-gradient(circle at 30% 25%, #eaf6ec, #d6ecdb);
  box-shadow: 0 14px 34px rgba(46, 125, 50, 0.18);
}
.heartbeat svg { animation: heartbeat 1.6s ease-in-out infinite; }
@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  12% { transform: scale(1.12); }
  24% { transform: scale(1); }
  36% { transform: scale(1.08); }
}
.empty-state h2 { font-size: 1.15rem; color: #374151; margin: 0; }
.empty-state p { font-size: 0.85rem; margin: 0; }
.btn-primary {
  background: linear-gradient(120deg, #2E7D32, #388E3C);
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 11px 28px;
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(46, 125, 50, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(46, 125, 50, 0.36); }

/* ===== 夜间模式 ===== */
[data-theme="night"] .favorites-page {
  background:
    radial-gradient(1000px 480px at 85% -10%, rgba(76, 175, 80, 0.09), transparent 60%),
    radial-gradient(800px 420px at -10% 20%, rgba(33, 150, 243, 0.06), transparent 55%),
    linear-gradient(180deg, #0e1510 0%, #121b14 45%, #0c120d 100%);
}
[data-theme="night"] .favorites-page::before {
  background:
    radial-gradient(1200px 700px at 10% -10%, rgba(76, 175, 80, 0.07), transparent 60%),
    radial-gradient(1100px 650px at 90% 112%, rgba(33, 150, 243, 0.05), transparent 60%),
    linear-gradient(180deg, #0d130e 0%, #11170f 100%);
}
[data-theme="night"] .bg-decoration {
  --dec-far: rgba(76, 175, 80, 0.12);
  --dec-mid: rgba(76, 175, 80, 0.17);
  --dec-near: rgba(102, 187, 106, 0.19);
  --dec-tree: rgba(102, 187, 106, 0.30);
  --dec-trunk: rgba(166, 124, 82, 0.38);
  --dec-trail: rgba(129, 199, 132, 0.50);
  --dec-dot: rgba(165, 214, 167, 0.28);
}
[data-theme="night"] .top-bar {
  background: rgba(18, 22, 19, 0.86);
  border-bottom-color: rgba(255, 255, 255, 0.07);
}
[data-theme="night"] .back-btn,
[data-theme="night"] .browse-btn {
  background: #1a241d;
  border-color: rgba(76, 175, 80, 0.32);
  color: #7ecb8a;
}
[data-theme="night"] .back-btn:hover { background: #2E7D32; color: #fff; }
[data-theme="night"] .browse-btn:hover { background: #1e3323; }
[data-theme="night"] .top-bar-title { color: #d7e4d8; }
[data-theme="night"] .overview-banner {
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
}
[data-theme="night"] .fav-card {
  background: #1a241d;
  border-color: rgba(255, 255, 255, 0.07);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
[data-theme="night"] .fav-card:hover {
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
}
[data-theme="night"] .card-name { color: #e5f0e6; }
[data-theme="night"] .tag-loc { background: #16233a; color: #7ea6ff; }
[data-theme="night"] .tag-area { background: #16301d; color: #7ecb8a; }
[data-theme="night"] .card-desc { color: #8fa394; }
[data-theme="night"] .card-remove { background: #26312a; color: #6b7a6e; box-shadow: none; }
[data-theme="night"] .card-remove:hover { color: #fff; background: #dc2626; }
[data-theme="night"] .empty-state h2 { color: #cfdecb; }
[data-theme="night"] .empty-icon { background: radial-gradient(circle at 30% 25%, #1e3323, #16241b); }

/* 窄屏时装饰会与内容区重叠，隐藏以免遮挡 */
@media (max-width: 1280px) {
  .bg-decoration { display: none; }
}
</style>
