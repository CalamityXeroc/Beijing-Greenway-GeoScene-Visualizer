<template>
  <div class="recommend-panel" :style="{ left: panelPos.x + 'px', top: panelPos.y + 'px' }">
    <!-- 头部（拖动把手） -->
    <div class="rp-header" @mousedown.prevent="startDrag"
         :style="{ cursor: isDragging ? 'grabbing' : 'grab' }">
      <span class="rp-title"><i class="fas fa-wand-magic-sparkles"></i> 绿道智能推荐</span>
      <span class="rp-sub">拖动窗口可自由移动</span>
      <button class="rp-close" title="关闭" @mousedown.stop @click="$emit('close')">×</button>
    </div>

    <!-- 步骤1：选偏好 -->
    <div v-if="!result" class="rp-body">
      <div class="rp-section">
        <div class="rp-label">出行方式</div>
        <div class="rp-toggle">
          <button class="rp-mode" :class="{ on: mode === 'walking' }" @click="mode = 'walking'">🚶 步行</button>
          <button class="rp-mode" :class="{ on: mode === 'bicycling' }" @click="mode = 'bicycling'">🚴 骑行</button>
        </div>
      </div>

      <div class="rp-section">
        <div class="rp-label">感兴趣的绿道类型</div>
        <div class="rp-chips">
          <button v-for="t in interestList" :key="t.key"
                  class="rp-chip" :class="{ on: interests.includes(t.key) }"
                  @click="toggleInterest(t.key)">
            {{ t.icon }} {{ t.label }}
          </button>
          <button class="rp-chip rp-chip-all" :class="{ on: isBalanced }" @click="setBalanced">
            ✨ 都行
          </button>
        </div>
      </div>

      <div class="rp-section">
        <div class="rp-label">附加需求 <span class="rp-hint">（可多选）</span></div>
        <div class="rp-chips">
          <button v-for="n in needList" :key="n.key"
                  class="rp-chip rp-chip-need" :class="{ on: needs.includes(n.key) }"
                  @click="toggleNeed(n.key)">
            {{ n.icon }} {{ n.label }}
          </button>
        </div>
      </div>

      <button class="rp-submit" :disabled="loading" @click="doRecommend">
        <i class="fas" :class="loading ? 'fa-spinner fa-spin' : 'fa-magic'"></i>
        {{ loading ? '正在为您挑选…' : '开始推荐' }}
      </button>
    </div>

    <!-- 步骤2：结果 -->
    <div v-else class="rp-body">
      <div class="rp-result-head">
        <span class="rp-result-title"><i class="fas fa-star"></i> 为您推荐了 {{ result.items.length }} 条绿道</span>
        <button class="rp-retry" @click="reset">重新选择</button>
      </div>

      <div class="rp-list">
        <div v-for="(item, idx) in result.items" :key="item.name"
             class="rp-item" :class="{ 'rp-item-first': idx === 0 }"
             @click="$emit('locate-greenway', item)">
          <div class="rp-rank" :class="'rp-rank-' + (idx + 1)">{{ idx + 1 }}</div>
          <div class="rp-item-main">
            <div class="rp-item-top">
              <span class="rp-name">{{ item.name }}</span>
              <span class="rp-score"><i class="fas fa-fire" style="color:#ff7043"></i> {{ item.score }}分</span>
            </div>
            <div class="rp-item-meta">
              <span class="rp-meta-tag">{{ item.lenKm }} km</span>
              <span class="rp-meta-tag">热度第 {{ item.heatRank }} 名</span>
              <span v-if="item.profile" class="rp-meta-tag rp-meta-type">{{ dominantName(item.profile) }}</span>
            </div>
            <ul class="rp-reasons">
              <li v-for="(r, ri) in item.reasons" :key="ri" class="rp-reason">
                <i class="fas fa-check-circle"></i> {{ r.text }}
              </li>
            </ul>
          </div>
          <button class="rp-go" title="去这里" @click.stop="$emit('go-route', item)">去这里</button>
        </div>
      </div>

      <!-- AI 解读 -->
      <div class="rp-ai">
        <button v-if="!aiText && !aiLoading" class="rp-ai-btn" @click="askAI">
          <i class="fas fa-robot"></i> AI 解读：为什么推荐这些？
        </button>
        <div v-else class="rp-ai-text">
          <div v-if="aiLoading" class="rp-ai-loading"><i class="fas fa-spinner fa-spin"></i> AI 正在分析…</div>
          <template v-else>
            <div class="rp-ai-head"><i class="fas fa-robot"></i> AI 解读</div>
            <p class="rp-ai-content">{{ aiText }}</p>
            <button class="rp-ai-retry" @click="aiText = null">重新解读</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { getApiBaseUrl } from '@/mobile/services/api'

const emit = defineEmits(['close', 'locate-greenway', 'go-route'])

/* ── 窗口拖拽 ── */
const PANEL_W = 460
const panelPos = ref({ x: 480, y: 200 })  // 初始位置（居中偏上）
const isDragging = ref(false)
let dragStart = { mx: 0, my: 0, px: 0, py: 0 }

function startDrag(e) {
  if (e.target.closest('button')) return  // 不拦截按钮点击
  isDragging.value = true
  dragStart = { mx: e.clientX, my: e.clientY, px: panelPos.value.x, py: panelPos.value.y }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
}
function onDrag(e) {
  if (!isDragging.value) return
  panelPos.value = {
    x: Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, dragStart.px + e.clientX - dragStart.mx)),
    y: Math.max(76, Math.min(window.innerHeight - 90, dragStart.py + e.clientY - dragStart.my))
  }
}
function endDrag() {
  isDragging.value = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
}
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
})

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
    const res = await fetch(`${getApiBaseUrl()}/api/greenways/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: mode.value,
        interests: isBalanced.value ? ['balanced'] : interests.value,
        needs: needs.value,
        topN: 3
      })
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    result.value = data
  } catch (e) {
    alert('推荐失败：' + e.message)
  } finally {
    loading.value = false
  }
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

    // 给 AI 完整的数据明细，让它能逐条深入分析
    const recDetail = result.value.items.map((it, idx) =>
      `第${idx + 1}名 ${it.name}（综合${it.score}分，长${it.lenKm}km，热度第${it.heatRank}名，` +
      `生态${it.profile.eco}%/风景${it.profile.scenic}%/历史文化${it.profile.history}%/城市${it.profile.urban}%，` +
      `理由：${it.reasons.map(r => r.text).join('；')}）`
    ).join('\n')

    const res = await fetch(`${getApiBaseUrl()}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `我的偏好是${prefs.join('，')}。系统按评分推荐了这些绿道：\n${recDetail}\n\n` +
          `请做一份详细点评（250-300字）：1) 逐条说明每条绿道与我的偏好匹配在哪、欠缺在哪（结合画像占比和设施数据）；` +
          `2) 对比三者，说明哪条最值得去、为什么；3) 给出1-2条出发前的实用建议。语言通俗，像朋友给建议一样。`
      })
    })
    const data = await res.json()
    aiText.value = data.reply || 'AI 暂时无法解读，请稍后重试。'
  } catch (e) {
    aiText.value = 'AI 解读失败：' + e.message
  } finally {
    aiLoading.value = false
  }
}
</script>

<style scoped>
.recommend-panel {
  position: absolute;
  z-index: 30;
  width: 460px;
  max-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--card-bg, rgba(255, 255, 255, 0.95));
  backdrop-filter: blur(14px);
  border: 1px solid var(--card-border, rgba(0, 0, 0, 0.1));
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  font-family: inherit;
  box-sizing: border-box;
  user-select: none;
  transition: box-shadow 0.2s;
}
.recommend-panel:active { box-shadow: 0 16px 48px rgba(0, 0, 0, 0.24); }

.rp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.06));
  background: linear-gradient(135deg, rgba(46,125,50,0.08), rgba(102,187,106,0.02));
  touch-action: none;
}
.rp-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-primary, #1a2a1a);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rp-title i { color: #43A047; }
.rp-sub {
  flex: 1;
  font-size: 0.72rem;
  color: var(--text-secondary, #888);
}
.rp-close {
  border: none;
  background: rgba(0,0,0,0.05);
  border-radius: 50%;
  width: 26px;
  height: 26px;
  font-size: 1rem;
  color: var(--text-tertiary, #999);
  cursor: pointer;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.rp-close:hover { background: rgba(46,125,50,0.12); color: #2E7D32; transform: rotate(90deg); }

.rp-body {
  padding: 12px 16px 16px;
  overflow-y: auto;
}
.rp-section { margin-bottom: 14px; }
.rp-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary, #333);
  margin-bottom: 8px;
}
.rp-hint { font-size: 0.68rem; font-weight: 400; color: var(--text-tertiary, #999); }

.rp-toggle { display: flex; gap: 10px; }
.rp-mode {
  flex: 1;
  padding: 9px 0;
  border-radius: 10px;
  border: 1.5px solid var(--border-color, #e0e0e0);
  background: transparent;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text-secondary, #555);
  cursor: pointer;
  transition: all 0.2s;
}
.rp-mode.on {
  border-color: #43A047;
  background: rgba(67, 160, 71, 0.1);
  color: #2E7D32;
}

.rp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.rp-chip {
  padding: 7px 13px;
  border-radius: 20px;
  border: 1.5px solid var(--border-color, #e0e0e0);
  background: transparent;
  font-size: 0.8rem;
  color: var(--text-secondary, #555);
  cursor: pointer;
  transition: all 0.2s;
}
.rp-chip.on {
  border-color: #43A047;
  background: rgba(67, 160, 71, 0.12);
  color: #2E7D32;
  font-weight: 600;
}
.rp-chip-all.on { border-color: #FFB300; background: rgba(255, 179, 0, 0.12); color: #B8860B; }
.rp-chip-need.on { border-color: #1976D2; background: rgba(25, 118, 210, 0.1); color: #1565C0; }

.rp-submit {
  width: 100%;
  padding: 11px 0;
  border: none;
  border-radius: 12px;
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #2E7D32, #43A047);
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(46, 125, 50, 0.3);
  transition: all 0.2s;
}
.rp-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(46, 125, 50, 0.4); }
.rp-submit:disabled { opacity: 0.7; cursor: not-allowed; }

/* 结果 */
.rp-result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.rp-result-title {
  font-size: 0.86rem;
  font-weight: 700;
  color: var(--text-primary, #333);
}
.rp-result-title i { color: #FFB300; }
.rp-retry {
  border: none;
  background: transparent;
  color: #43A047;
  font-size: 0.78rem;
  cursor: pointer;
  font-weight: 600;
}
.rp-retry:hover { text-decoration: underline; }

.rp-list { display: flex; flex-direction: column; gap: 10px; }
.rp-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(0,0,0,0.08));
  background: var(--bg-secondary, rgba(0,0,0,0.02));
  cursor: pointer;
  transition: all 0.2s;
  align-items: flex-start;
}
.rp-item:hover { border-color: rgba(67,160,71,0.4); box-shadow: 0 4px 14px rgba(46,125,50,0.12); }
.rp-item-first {
  border-color: rgba(255, 179, 0, 0.5);
  background: linear-gradient(135deg, rgba(255,179,0,0.06), var(--bg-secondary, rgba(0,0,0,0.02)));
}
.rp-rank {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 800;
  color: #fff;
  background: #9E9E9E;
  flex: 0 0 auto;
}
.rp-rank-1 { background: linear-gradient(135deg, #FFB300, #FF8F00); }
.rp-rank-2 { background: linear-gradient(135deg, #90A4AE, #607D8B); }
.rp-rank-3 { background: linear-gradient(135deg, #A1887F, #8D6E63); }
.rp-item-main { flex: 1; min-width: 0; }
.rp-item-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.rp-name { font-size: 0.92rem; font-weight: 700; color: var(--text-primary, #222); }
.rp-score { font-size: 0.82rem; font-weight: 700; color: var(--text-secondary, #666); white-space: nowrap; }
.rp-item-meta { display: flex; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
.rp-meta-tag {
  font-size: 0.68rem;
  color: var(--text-secondary, #777);
  background: var(--bg-tertiary, rgba(0,0,0,0.05));
  padding: 2px 8px;
  border-radius: 10px;
}
.rp-meta-type { color: #2E7D32; font-weight: 600; }
.rp-reasons { list-style: none; margin: 0; padding: 0; }
.rp-reason {
  font-size: 0.74rem;
  color: var(--text-secondary, #555);
  margin: 3px 0;
  display: flex;
  gap: 5px;
  align-items: flex-start;
  line-height: 1.45;
}
.rp-reason i { color: #66BB6A; font-size: 0.7rem; margin-top: 2px; flex: 0 0 auto; }
.rp-go {
  flex: 0 0 auto;
  padding: 6px 14px;
  border: none;
  border-radius: 18px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #2E7D32, #43A047);
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(46,125,50,0.25);
  transition: all 0.2s;
}
.rp-go:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(46,125,50,0.35); }

/* AI 解读 */
.rp-ai { margin-top: 12px; }
.rp-ai-btn {
  width: 100%;
  padding: 10px 0;
  border: 1.5px dashed rgba(46, 125, 50, 0.4);
  border-radius: 10px;
  background: transparent;
  font-size: 0.82rem;
  font-weight: 600;
  color: #2E7D32;
  cursor: pointer;
  transition: all 0.2s;
}
.rp-ai-btn:hover { background: rgba(46, 125, 50, 0.06); }
.rp-ai-text {
  padding: 12px;
  border-radius: 10px;
  background: rgba(46, 125, 50, 0.06);
  border: 1px solid rgba(46, 125, 50, 0.15);
}
.rp-ai-loading { color: var(--text-secondary, #888); font-size: 0.82rem; }
.rp-ai-head {
  font-size: 0.8rem;
  font-weight: 700;
  color: #2E7D32;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.rp-ai-content {
  margin: 0 0 8px;
  font-size: 0.8rem;
  line-height: 1.65;
  color: var(--text-primary, #333);
  white-space: pre-wrap;
}
.rp-ai-retry {
  border: none;
  background: transparent;
  color: #43A047;
  font-size: 0.72rem;
  cursor: pointer;
  font-weight: 600;
}
</style>
