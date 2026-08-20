<template>
  <section class="recommend-section">
    <!-- 入口卡（未展开时） -->
    <div v-if="!expanded" class="rc-entry" @click="expanded = true">
      <div class="rc-entry-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l1.9 5.7L20 10l-6.1 1.3L12 17l-1.9-5.7L4 10l6.1-1.3z"/>
          <path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z"/>
        </svg>
      </div>
      <div class="rc-entry-text">
        <h3 class="rc-entry-title">绿道智能推荐</h3>
        <p class="rc-entry-desc">告诉我你的偏好，为你挑选最合适的绿道</p>
      </div>
      <span class="rc-entry-arrow">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </span>
    </div>

    <!-- 展开：偏好选择 -->
    <div v-else-if="!result" class="rc-body">
      <div class="rc-header">
        <h3 class="rc-title">✨ 绿道智能推荐</h3>
        <button class="rc-close" @click="expanded = false" aria-label="收起">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
      </div>

      <div class="rc-section">
        <div class="rc-label">出行方式</div>
        <div class="rc-toggle">
          <button class="rc-mode" :class="{ on: mode === 'walking' }" @click="mode = 'walking'">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM7 21l2-6M17 21l-3-7-4 2"/></svg>
            步行
          </button>
          <button class="rc-mode" :class="{ on: mode === 'bicycling' }" @click="mode = 'bicycling'">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            骑行
          </button>
        </div>
      </div>

      <div class="rc-section">
        <div class="rc-label">感兴趣的绿道类型</div>
        <div class="rc-chips">
          <button v-for="t in interestList" :key="t.key"
                  class="rc-chip" :class="{ on: interests.includes(t.key) }"
                  @click="toggleInterest(t.key)">
            {{ t.icon }} {{ t.label }}
          </button>
          <button class="rc-chip rc-chip-all" :class="{ on: isBalanced }" @click="setBalanced">✨ 都行</button>
        </div>
      </div>

      <div class="rc-section">
        <div class="rc-label">附加需求 <span class="rc-hint">（可多选）</span></div>
        <div class="rc-chips">
          <button v-for="n in needList" :key="n.key"
                  class="rc-chip rc-chip-need" :class="{ on: needs.includes(n.key) }"
                  @click="toggleNeed(n.key)">
            {{ n.icon }} {{ n.label }}
          </button>
        </div>
      </div>

      <button class="rc-submit" :disabled="loading" @click="doRecommend">
        <svg v-if="!loading" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.7L20 10l-6.1 1.3L12 17l-1.9-5.7L4 10l6.1-1.3z"/></svg>
        <svg v-else class="rc-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>
        {{ loading ? '正在为您挑选…' : '开始推荐' }}
      </button>
    </div>

    <!-- 推荐结果 -->
    <div v-else class="rc-body">
      <div class="rc-header">
        <div class="rc-result-title">
          <span>为您推荐了 {{ result.items.length }} 条绿道</span>
          <button class="rc-retry" @click="reset">重新选择</button>
        </div>
        <button class="rc-close" @click="expanded = false" aria-label="收起">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>
        </button>
      </div>

      <!-- 评分对比图表 -->
      <div class="rc-chart" v-if="result.items.length">
        <div class="rc-chart-title">综合评分对比</div>
        <div class="rc-chart-row" v-for="(item, idx) in result.items" :key="item.name">
          <span class="rc-chart-rank" :class="'rc-chart-rank--' + (idx + 1)">{{ idx + 1 }}</span>
          <span class="rc-chart-name">{{ item.name }}</span>
          <div class="rc-chart-track">
            <div class="rc-chart-fill" :class="'rc-chart-fill--' + (idx + 1)"
                 :style="{ width: item.score + '%' }"></div>
          </div>
          <span class="rc-chart-val font-number">{{ item.score }}</span>
        </div>
      </div>

      <!-- 推荐列表 -->
      <div class="rc-list">
        <div v-for="(item, idx) in result.items" :key="item.name"
             class="rc-item" :class="{ 'rc-item-first': idx === 0 }">
          <div class="rc-rank" :class="'rc-rank-' + (idx + 1)">{{ idx + 1 }}</div>
          <div class="rc-item-main">
            <div class="rc-item-top">
              <span class="rc-name">{{ item.name }}</span>
              <span class="rc-score"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z"/></svg> {{ item.score }}分</span>
            </div>
            <div class="rc-item-meta">
              <span class="rc-meta-tag">{{ item.lenKm }} km</span>
              <span class="rc-meta-tag">热度第 {{ item.heatRank }} 名</span>
              <span v-if="item.profile" class="rc-meta-tag rc-meta-type">{{ dominantName(item.profile) }}</span>
            </div>
            <ul class="rc-reasons">
              <li v-for="(r, ri) in item.reasons" :key="ri" class="rc-reason">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {{ r.text }}
              </li>
            </ul>
          </div>
          <button class="rc-go" @click.stop="goRoute(item)">去这里</button>
        </div>
      </div>

      <!-- AI 解读 -->
      <div class="rc-ai">
        <button v-if="!aiText && !aiLoading" class="rc-ai-btn" @click="askAI">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M8 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/><line x1="12" y1="11" x2="12" y2="15"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>
          AI 解读：为什么推荐这些？
        </button>
        <div v-else class="rc-ai-text">
          <div v-if="aiLoading" class="rc-ai-loading">
            <svg class="rc-spin" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>
            AI 正在分析…
          </div>
          <template v-else>
            <div class="rc-ai-head">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M8 7V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3"/><line x1="12" y1="11" x2="12" y2="15"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>
              AI 解读
            </div>
            <p class="rc-ai-content">{{ aiText }}</p>
            <button class="rc-ai-retry" @click="aiText = null">重新解读</button>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { fetchRecommend, aiChat } from '../services/api'

const router = useRouter()
const expanded = ref(false)
const mode = ref('walking')
const interests = ref([])
const needs = ref([])
const loading = ref(false)
const result = ref(null)
const aiText = ref(null)
const aiLoading = ref(false)

const interestList = [
  { key: 'eco', icon: '🌿', label: '生态' },
  { key: 'scenic', icon: '🌄', label: '风景' },
  { key: 'history', icon: '🏛️', label: '历史文化' },
  { key: 'urban', icon: '🏙️', label: '城市' }
]
const needList = [
  { key: 'metro', icon: '🚇', label: '地铁可达' },
  { key: 'parking', icon: '🅿️', label: '停车方便' },
  { key: 'restroom', icon: '🚻', label: '有卫生间' }
]

const isBalanced = computed(() => interests.value.length === 0)

function toggleInterest(key) {
  interests.value = interests.value.includes(key)
    ? interests.value.filter(k => k !== key)
    : [...interests.value, key]
}
function setBalanced() { interests.value = [] }
function toggleNeed(key) {
  needs.value = needs.value.includes(key)
    ? needs.value.filter(k => k !== key)
    : [...needs.value, key]
}
function reset() {
  result.value = null
  aiText.value = null
  aiLoading.value = false
}

const DOMINANT_CN = {
  eco: '生态型', scenic: '风景型', history: '历史文化型', urban: '城市型'
}
function dominantName(profile) {
  let best = 'eco', bestV = -1
  for (const k of Object.keys(profile)) {
    if (profile[k] > bestV) { bestV = profile[k]; best = k }
  }
  return DOMINANT_CN[best] || ''
}

async function doRecommend() {
  loading.value = true
  try {
    result.value = await fetchRecommend({
      mode: mode.value,
      interests: isBalanced.value ? ['balanced'] : interests.value,
      needs: needs.value,
      topN: 3
    })
  } catch (e) {
    alert('推荐失败：' + e.message)
  } finally {
    loading.value = false
  }
}

/* 去这里 → 跳地图页并自动打开路径规划（起点=用户定位） */
function goRoute(item) {
  router.push({
    path: '/mobile/map',
    query: {
      open: 'route',
      name: item.name,
      lng: item.lng,
      lat: item.lat
    }
  })
}

async function askAI() {
  aiLoading.value = true
  aiText.value = null
  try {
    const prefs = []
    prefs.push(mode.value === 'walking' ? '步行' : '骑行')
    if (isBalanced.value) prefs.push('类型都行')
    else prefs.push(interests.value.map(k => interestList.find(t => t.key === k)?.label).join('、'))
    if (needs.value.length) prefs.push('需要' + needs.value.map(k => needList.find(t => t.key === k)?.label).join('、'))

    const recDetail = result.value.items.map((it, idx) =>
      `第${idx + 1}名 ${it.name}（综合${it.score}分，长${it.lenKm}km，热度第${it.heatRank}名，` +
      `生态${it.profile.eco}%/风景${it.profile.scenic}%/历史文化${it.profile.history}%/城市${it.profile.urban}%，` +
      `理由：${it.reasons.map(r => r.text).join('；')}）`
    ).join('\n')

    const res = await aiChat(`我的偏好是${prefs.join('，')}。系统按评分推荐了这些绿道：\n${recDetail}\n\n` +
      `请做一份详细点评（250-300字）：1) 逐条说明每条绿道与我的偏好匹配在哪、欠缺在哪（结合画像占比和设施数据）；` +
      `2) 对比三者，说明哪条最值得去、为什么；3) 给出1-2条出发前的实用建议。语言通俗，像朋友给建议一样。`)
    aiText.value = res.reply || 'AI 暂时无法解读，请稍后重试。'
  } catch (e) {
    aiText.value = 'AI 解读失败：' + e.message
  } finally {
    aiLoading.value = false
  }
}
</script>

<style scoped>
.recommend-section {
  padding: 20px 16px 4px;
  animation: fadeSlideUp 0.6s ease-out 0.06s both;
}

/* ── 入口卡 ── */
.rc-entry {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.13), rgba(16, 185, 129, 0.06));
  border: 1px solid rgba(34, 197, 94, 0.25);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}
.rc-entry:active { transform: scale(0.98); }
.rc-entry-icon {
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #22c55e, #0d9488);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);
}
.rc-entry-text { flex: 1; min-width: 0; }
.rc-entry-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-text-primary);
}
.rc-entry-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.rc-entry-arrow { color: var(--color-primary); flex: 0 0 auto; }

/* ── 展开体 ── */
.rc-body {
  background: var(--color-surface);
  border-radius: var(--radius-xl);
  padding: 16px;
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-soft);
}
.rc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.rc-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-text-primary);
}
.rc-close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: var(--color-surface-2);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.rc-section { margin-bottom: 14px; }
.rc-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}
.rc-hint { font-size: 11px; font-weight: 400; color: var(--color-text-tertiary); }

.rc-toggle { display: flex; gap: 10px; }
.rc-mode {
  flex: 1;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: transparent;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all var(--transition-fast);
}
.rc-mode.on {
  border-color: var(--color-primary);
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-primary);
}

.rc-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.rc-chip {
  padding: 9px 14px;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border);
  background: transparent;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.rc-chip.on {
  border-color: var(--color-primary);
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-primary);
  font-weight: 600;
}
.rc-chip-all.on { border-color: #f59e0b; background: rgba(245, 158, 11, 0.12); color: #b45309; }
.rc-chip-need.on { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); color: #2563eb; }

.rc-submit {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: transform var(--transition-fast);
}
.rc-submit:active:not(:disabled) { transform: scale(0.98); }
.rc-submit:disabled { opacity: 0.7; cursor: not-allowed; }
.rc-spin { animation: rc-spin 0.8s linear infinite; }
@keyframes rc-spin { to { transform: rotate(360deg); } }

/* ── 结果头 ── */
.rc-result-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-text-primary);
}
.rc-retry {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
}

/* ── 评分对比图表 ── */
.rc-chart {
  background: var(--color-surface-2);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 12px;
}
.rc-chart-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}
.rc-chart-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.rc-chart-row:last-child { margin-bottom: 0; }
.rc-chart-rank {
  flex: 0 0 18px;
  font-size: 11px;
  font-weight: 800;
  color: #9e9e9e;
}
.rc-chart-rank--1 { color: #f59e0b; }
.rc-chart-rank--2 { color: #64748b; }
.rc-chart-rank--3 { color: #b07d4b; }
.rc-chart-name {
  flex: 0 0 64px;
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rc-chart-track {
  flex: 1;
  height: 10px;
  background: var(--color-surface-3);
  border-radius: 5px;
  overflow: hidden;
}
.rc-chart-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.rc-chart-fill--1 { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.rc-chart-fill--2 { background: linear-gradient(90deg, #94a3b8, #64748b); }
.rc-chart-fill--3 { background: linear-gradient(90deg, #d4a373, #b07d4b); }
.rc-chart-val {
  flex: 0 0 26px;
  text-align: right;
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-primary);
}

/* ── 推荐列表 ── */
.rc-list { display: flex; flex-direction: column; gap: 10px; }
.rc-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-light);
  background: var(--color-surface-2);
  align-items: flex-start;
}
.rc-item-first {
  border-color: rgba(245, 158, 11, 0.5);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.06), var(--color-surface-2));
}
.rc-rank {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  background: #9e9e9e;
}
.rc-rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); }
.rc-rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); }
.rc-rank-3 { background: linear-gradient(135deg, #d4a373, #b07d4b); }
.rc-item-main { flex: 1; min-width: 0; }
.rc-item-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.rc-name { font-size: var(--text-base); font-weight: 700; color: var(--color-text-primary); }
.rc-score {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.rc-score svg { color: #f59e0b; }
.rc-item-meta { display: flex; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
.rc-meta-tag {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-surface-3);
  padding: 2px 8px;
  border-radius: 10px;
}
.rc-meta-type { color: var(--color-primary); font-weight: 600; }
.rc-reasons { list-style: none; margin: 0; padding: 0; }
.rc-reason {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 3px 0;
  display: flex;
  gap: 5px;
  align-items: flex-start;
  line-height: 1.45;
}
.rc-reason svg { color: var(--color-primary); flex: 0 0 auto; margin-top: 2px; }
.rc-go {
  flex: 0 0 auto;
  padding: 7px 14px;
  border: none;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(34, 197, 94, 0.25);
}

/* ── AI 解读 ── */
.rc-ai { margin-top: 12px; }
.rc-ai-btn {
  width: 100%;
  height: 44px;
  border: 1.5px dashed rgba(34, 197, 94, 0.4);
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.rc-ai-text {
  padding: 12px;
  border-radius: var(--radius-md);
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.15);
}
.rc-ai-loading {
  color: var(--color-text-secondary);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rc-ai-head {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.rc-ai-content {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text-primary);
  white-space: pre-wrap;
}
.rc-ai-retry {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
}

@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
