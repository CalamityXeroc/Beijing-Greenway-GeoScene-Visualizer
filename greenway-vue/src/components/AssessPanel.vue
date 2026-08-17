<template>
  <div class="as-panel" :style="{ left: panelPos.x + 'px', top: panelPos.y + 'px' }">
    <!-- 头部（拖动把手） -->
    <div class="as-header" @mousedown.prevent="startDrag"
         :style="{ cursor: isDragging ? 'grabbing' : 'grab' }">
      <span class="as-title"><i class="fas fa-heart-pulse"></i> 绿道体检评估</span>
      <span class="as-sub">17 条绿道健康度排名，看看哪条适合您</span>
      <button class="as-close" title="关闭" @mousedown.stop @click="$emit('close')">×</button>
    </div>

    <div class="as-body">
      <!-- 加载中 -->
      <div v-if="loading" class="as-loading">
        <i class="fas fa-spinner fa-spin"></i> 正在体检全城绿道…
      </div>

      <!-- 数据 -->
      <template v-else-if="result">
        <!-- ① 排名榜单 -->
        <div class="as-rank-head">
          <span class="as-rank-title"><i class="fas fa-ranking-star"></i> 绿道健康榜</span>
          <span class="as-rank-hint">点击查看体检报告</span>
        </div>
        <div class="as-list">
          <div v-for="it in result.items" :key="it.name"
               class="as-item" :class="{ 'as-item-on': selected?.name === it.name }"
               @click="select(it)">
            <span class="as-rank-num" :class="'as-rank-' + it.rank">{{ it.rank }}</span>
            <div class="as-item-main">
              <div class="as-item-top">
                <span class="as-name">{{ it.name }}</span>
                <span class="as-grade" :class="'as-grade-' + it.grade">{{ it.grade }}</span>
              </div>
              <div class="as-item-tags">
                <span class="as-tag">长 {{ it.lenKm }} km</span>
                <span v-if="it.heatRank" class="as-tag">人气第 {{ it.heatRank }}</span>
                <span v-else class="as-tag">人气暂无</span>
                <span v-if="it.metro" class="as-tag">🚇 {{ it.metro }} 站</span>
              </div>
            </div>
            <span class="as-score"><b>{{ it.score }}</b><em>分</em></span>
          </div>
        </div>

        <!-- ② 选中绿道体检报告 -->
        <div v-if="selected" class="as-detail">
          <div class="as-detail-head">
            <span class="as-detail-title">{{ selected.name }} · 体检报告</span>
            <span class="as-detail-score" :class="'as-grade-' + selected.grade">{{ selected.score }}分 {{ selected.grade }}</span>
          </div>

          <!-- 雷达图 -->
          <div ref="radarRef" class="as-radar"></div>

          <!-- 亮点 / 短板 -->
          <div class="as-dim-row">
            <div class="as-dim-col as-dim-good">
              <div class="as-dim-label"><i class="fas fa-circle-check"></i> 亮点</div>
              <ul class="as-dim-list">
                <li v-for="(h, i) in selected.highlights" :key="i">{{ h.text }}</li>
              </ul>
            </div>
            <div class="as-dim-col as-dim-weak">
              <div class="as-dim-label"><i class="fas fa-circle-exclamation"></i> 短板</div>
              <ul class="as-dim-list">
                <li v-for="(w, i) in selected.weakPoints" :key="i">{{ w.text }}</li>
              </ul>
            </div>
          </div>

          <!-- 画像占比 -->
          <div class="as-profile">
            <span class="as-profile-label">功能画像</span>
            <div class="as-profile-bar">
              <span v-for="p in profileList" :key="p.key" class="as-profile-seg"
                    :style="{ width: p.v + '%', background: p.color }" :title="p.label + ' ' + p.v + '%'"></span>
            </div>
            <div class="as-profile-legend">
              <span v-for="p in profileList" :key="p.key">
                <i :style="{ background: p.color }"></i>{{ p.label }} {{ p.v }}%
              </span>
            </div>
          </div>

          <!-- 操作 -->
          <div class="as-actions">
            <button class="as-go" @click="$emit('go-route', selected)">
              <i class="fas fa-route"></i> 去这里
            </button>
            <button class="as-ai-btn" :disabled="aiLoading" @click="askAI">
              <i class="fas" :class="aiLoading ? 'fa-spinner fa-spin' : 'fa-robot'"></i>
              {{ aiLoading ? 'AI 体检中…' : 'AI 体检报告' }}
            </button>
          </div>

          <!-- AI 报告 -->
          <div v-if="aiText" class="as-ai-text">
            <div class="as-ai-head"><i class="fas fa-robot"></i> AI 体检报告</div>
            <p class="as-ai-content">{{ aiText }}</p>
            <button class="as-ai-retry" @click="aiText = null">重新解读</button>
          </div>
        </div>
      </template>

      <p v-else class="as-empty"><i class="fas fa-circle-exclamation"></i> 评估数据加载失败，请稍后重试</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { getApiBaseUrl } from '@/mobile/services/api'

const emit = defineEmits(['close', 'locate-greenway', 'go-route'])

/* ── 拖拽 ── */
const PANEL_W = 460
const panelPos = ref({ x: 60, y: 130 })
const isDragging = ref(false)
let dragStart = { mx: 0, my: 0, px: 0, py: 0 }
function startDrag(e) {
  if (e.target.closest('button')) return
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
  radarChart?.dispose()
})

/* ── 数据 ── */
const loading = ref(true)
const result = ref(null)
const selected = ref(null)
const aiText = ref(null)
const aiLoading = ref(false)
const radarRef = ref(null)
let radarChart = null

const PROFILE_COLORS = { eco: '#2E7D32', scenic: '#26A69A', history: '#A0522D', urban: '#1E88E5' }
const PROFILE_CN = { eco: '生态', scenic: '风景', history: '历史文化', urban: '城市' }
const profileList = computed(() => {
  if (!selected.value?.profile) return []
  return Object.keys(selected.value.profile).map(k => ({
    key: k, label: PROFILE_CN[k], color: PROFILE_COLORS[k], v: selected.value.profile[k] || 0
  }))
})

const GRADE_COLOR = { 优: '#2E7D32', 良: '#1976D2', 中: '#F57C00', 待提升: '#C62828' }

function select(it) {
  selected.value = it
  aiText.value = null
  emit('locate-greenway', it)
  renderRadar(it)
}

async function load() {
  loading.value = true
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/greenways/assess`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    result.value = data
    if (data.items?.length) select(data.items[0])
  } catch (e) {
    alert('体检数据加载失败：' + e.message)
  } finally {
    loading.value = false
  }
}

/* ── 雷达图 ── */
const DIM_LABEL = ['生态自然度', '出行便捷度', '设施完备度', '人气活力值', '休闲适宜度']
const DIM_KEY = ['eco', 'transport', 'facility', 'heat', 'leisure']

function renderRadar(it) {
  if (!it || !radarRef.value) return
  if (!radarChart) radarChart = echarts.init(radarRef.value)
  const avg = result.value?.avgDims || {}
  radarChart.setOption({
    tooltip: { trigger: 'item' },
    legend: {
      bottom: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#777' }
    },
    radar: {
      indicator: DIM_KEY.map(k => ({ name: DIM_LABEL[DIM_KEY.indexOf(k)], max: 100 })),
      radius: '62%',
      center: ['50%', '46%'],
      splitArea: { areaStyle: { color: ['rgba(46,125,50,0.03)', 'rgba(46,125,50,0.06)'] } },
      axisName: { color: '#8a9a8a', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.12)' } }
    },
    series: [{
      type: 'radar',
      data: [
        {
          name: it.name,
          value: DIM_KEY.map(k => it.dims[k]),
          lineStyle: { color: '#43A047', width: 2.5 },
          itemStyle: { color: '#43A047' },
          areaStyle: { color: 'rgba(67,160,71,0.22)' },
          symbolSize: 5
        },
        {
          name: '全市平均',
          value: DIM_KEY.map(k => avg[k] ?? 0),
          lineStyle: { color: '#B0BEC5', width: 1.5, type: 'dashed' },
          itemStyle: { color: '#B0BEC5' },
          areaStyle: { color: 'rgba(176,190,197,0.08)' },
          symbolSize: 3
        }
      ]
    }]
  })
}

watch(radarRef, () => { if (selected.value) renderRadar(selected.value) })

/* ── AI 体检报告 ── */
async function askAI() {
  if (!selected.value) return
  aiLoading.value = true
  aiText.value = null
  try {
    const it = selected.value
    const avg = result.value?.avgDims || {}
    const detail =
      `${it.name}（综合${it.score}分/${it.grade}，全市第${it.rank}名，长${it.lenKm}km）\n` +
      `五维体检：生态自然度${it.dims.eco}分（全市平均${avg.eco}）、出行便捷度${it.dims.transport}分（平均${avg.transport}）、` +
      `设施完备度${it.dims.facility}分（平均${avg.facility}）、人气活力值${it.dims.heat}分（平均${avg.heat}）、` +
      `休闲适宜度${it.dims.leisure}分（平均${avg.leisure}）\n` +
      `功能画像：生态${it.profile.eco}%/风景${it.profile.scenic}%/历史文化${it.profile.history}%/城市${it.profile.urban}%\n` +
      `亮点：${it.highlights.map(h => h.text).join('；')}\n` +
      `短板：${it.weakPoints.map(w => w.text).join('；') || '无明显短板'}`

    const res = await fetch(`${getApiBaseUrl()}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `请为这条北京绿道写一份"市民体检报告"（250-300字），数据如下（注意：北京全市仅有 17 条绿道，不要虚构更多）：\n${detail}\n\n` +
          `要求：1) 先给一句总体评价（结合分数和等级）；2) 说说它的核心亮点（结合五维和画像）；` +
          `3) 指出它的短板和适合的人群/场景（遛娃、骑行、跑步、访古、亲近自然等）；` +
          `4) 给 1-2 条出发建议。语言通俗亲切，像朋友推荐一样。`
      })
    })
    const data = await res.json()
    aiText.value = data.reply || 'AI 暂时无法解读，请稍后重试。'
  } catch (e) {
    aiText.value = 'AI 体检报告生成失败：' + e.message
  } finally {
    aiLoading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.as-panel {
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
}
.as-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.06));
  background: linear-gradient(135deg, rgba(25,118,210,0.08), rgba(79,195,247,0.03));
  touch-action: none;
}
.as-title { font-size: 1rem; font-weight: 800; color: var(--text-primary, #1a2a1a); display: inline-flex; align-items: center; gap: 6px; }
.as-title i { color: #1976D2; }
.as-sub { flex: 1; font-size: 0.72rem; color: var(--text-secondary, #888); }
.as-close {
  border: none; background: rgba(0,0,0,0.05); border-radius: 50%;
  width: 26px; height: 26px; font-size: 1rem; color: var(--text-tertiary, #999);
  cursor: pointer; line-height: 1; display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.as-close:hover { background: rgba(25,118,210,0.12); color: #1976D2; transform: rotate(90deg); }
.as-body { padding: 12px 16px 16px; overflow-y: auto; }
.as-loading { text-align: center; padding: 30px 0; color: var(--text-secondary, #888); font-size: 0.9rem; }
.as-rank-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.as-rank-title { font-size: 0.86rem; font-weight: 700; color: var(--text-primary, #333); }
.as-rank-title i { color: #F57C00; }
.as-rank-hint { font-size: 0.68rem; color: var(--text-tertiary, #999); }
.as-list { display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; padding-right: 2px; }
.as-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer; transition: all 0.15s;
}
.as-item:hover { background: var(--bg-secondary, rgba(0,0,0,0.03)); }
.as-item-on { background: rgba(25,118,210,0.08); border-color: rgba(25,118,210,0.35); }
.as-rank-num {
  flex: 0 0 26px; height: 26px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 800; color: #fff;
  background: #90A4AE;
}
.as-rank-1 { background: linear-gradient(135deg, #F57F17, #FFB300); }
.as-rank-2 { background: linear-gradient(135deg, #78909C, #B0BEC5); }
.as-rank-3 { background: linear-gradient(135deg, #8D6E63, #BCAAA4); }
.as-item-main { flex: 1; min-width: 0; }
.as-item-top { display: flex; align-items: center; gap: 6px; }
.as-name { font-size: 0.88rem; font-weight: 700; color: var(--text-primary, #222); }
.as-grade { font-size: 0.62rem; font-weight: 700; padding: 1px 7px; border-radius: 8px; color: #fff; }
.as-grade-优 { background: #2E7D32; }
.as-grade-良 { background: #1976D2; }
.as-grade-中 { background: #F57C00; }
.as-grade-待提升 { background: #C62828; }
.as-item-tags { display: flex; gap: 5px; margin-top: 3px; flex-wrap: wrap; }
.as-tag { font-size: 0.64rem; color: var(--text-secondary, #777); background: var(--bg-tertiary, rgba(0,0,0,0.05)); padding: 1px 7px; border-radius: 8px; }
.as-score { flex: 0 0 auto; text-align: right; }
.as-score b { font-size: 1.1rem; color: #1976D2; }
.as-score em { font-size: 0.65rem; color: var(--text-tertiary, #999); font-style: normal; }

.as-detail { margin-top: 12px; border-top: 1px dashed var(--border-color, rgba(0,0,0,0.12)); padding-top: 12px; }
.as-detail-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.as-detail-title { font-size: 0.92rem; font-weight: 800; color: var(--text-primary, #222); }
.as-detail-score { font-size: 0.8rem; font-weight: 800; padding: 2px 10px; border-radius: 10px; color: #fff; }
.as-radar { width: 100%; height: 250px; }
.as-dim-row { display: flex; gap: 10px; margin-top: 4px; }
.as-dim-col { flex: 1; border-radius: 10px; padding: 8px 10px; }
.as-dim-good { background: rgba(46,125,50,0.07); }
.as-dim-weak { background: rgba(198,40,40,0.06); }
.as-dim-label { font-size: 0.74rem; font-weight: 700; margin-bottom: 5px; }
.as-dim-good .as-dim-label { color: #2E7D32; }
.as-dim-weak .as-dim-label { color: #C62828; }
.as-dim-list { margin: 0; padding-left: 16px; }
.as-dim-list li { font-size: 0.7rem; color: var(--text-secondary, #666); line-height: 1.7; }
.as-profile { margin-top: 10px; }
.as-profile-label { font-size: 0.74rem; font-weight: 700; color: var(--text-primary, #333); }
.as-profile-bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; margin: 6px 0 4px; }
.as-profile-seg { height: 100%; }
.as-profile-legend { display: flex; gap: 10px; flex-wrap: wrap; }
.as-profile-legend span { font-size: 0.66rem; color: var(--text-secondary, #777); display: inline-flex; align-items: center; gap: 4px; }
.as-profile-legend i { width: 8px; height: 8px; border-radius: 3px; display: inline-block; }
.as-actions { display: flex; gap: 10px; margin-top: 12px; }
.as-go {
  flex: 1; padding: 8px 0; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #1976D2, #42A5F5);
  color: #fff; font-size: 0.84rem; font-weight: 700; cursor: pointer;
  box-shadow: 0 3px 8px rgba(25,118,210,0.25); transition: all 0.2s;
}
.as-go:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(25,118,210,0.35); }
.as-ai-btn {
  flex: 1; padding: 8px 0; border-radius: 10px; border: 1.5px solid #43A047;
  background: rgba(67,160,71,0.08); color: #2E7D32; font-size: 0.84rem; font-weight: 700; cursor: pointer;
  transition: all 0.2s;
}
.as-ai-btn:hover { background: rgba(67,160,71,0.15); }
.as-ai-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.as-ai-text {
  margin-top: 10px; padding: 10px 12px; border-radius: 10px;
  background: rgba(67,160,71,0.07); border: 1px solid rgba(67,160,71,0.2);
}
.as-ai-head { font-size: 0.76rem; font-weight: 800; color: #2E7D32; margin-bottom: 6px; }
.as-ai-content { margin: 0; font-size: 0.78rem; line-height: 1.8; color: var(--text-primary, #333); white-space: pre-wrap; }
.as-ai-retry { margin-top: 8px; border: none; background: transparent; color: #2E7D32; font-size: 0.7rem; cursor: pointer; font-weight: 600; }
.as-ai-retry:hover { text-decoration: underline; }
.as-empty { text-align: center; color: var(--text-secondary, #888); font-size: 0.85rem; padding: 20px 0; }
</style>
