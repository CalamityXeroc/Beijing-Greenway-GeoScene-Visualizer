<template>
  <div class="gc-panel" :style="{ left: panelPos.x + 'px', top: panelPos.y + 'px' }">
    <!-- 头部（拖动把手） -->
    <div class="gc-header" @mousedown.prevent="startDrag"
         :style="{ cursor: isDragging ? 'grabbing' : 'grab' }">
      <span class="gc-title"><i class="fas fa-scale-balanced"></i> 绿道对比</span>
      <span class="gc-sub">最多选 3 条，并排 PK 帮您决策</span>
      <button class="gc-close" title="关闭" @mousedown.stop @click="$emit('close')">×</button>
    </div>

    <div class="gc-body">
      <!-- 加载中 -->
      <div v-if="loading" class="gc-loading">
        <i class="fas fa-spinner fa-spin"></i> 正在加载全城绿道数据…
      </div>

      <!-- 数据 -->
      <template v-else-if="result">
        <!-- ① 候选列表（勾选加入对比） -->
        <div class="gc-list-head">
          <span class="gc-list-title"><i class="fas fa-list-check"></i> 选择要对比的绿道</span>
          <span class="gc-list-hint">{{ selected.length }}/{{ MAX }}</span>
        </div>
        <div class="gc-list">
          <div v-for="it in result.items" :key="it.name"
               class="gc-item" :class="{ 'gc-item-on': isSelected(it) }"
               @click="toggle(it)">
            <span class="gc-check" :class="{ checked: isSelected(it) }">
              <svg v-if="isSelected(it)" viewBox="0 0 24 24" width="12" height="12" fill="none"
                   stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span class="gc-rank-num" :class="'gc-rank-' + it.rank">{{ it.rank }}</span>
            <div class="gc-item-main">
              <div class="gc-item-top">
                <span class="gc-name">{{ it.name }}</span>
                <span class="gc-grade" :class="'gc-grade-' + it.grade">{{ it.grade }}</span>
              </div>
              <div class="gc-item-tags">
                <span class="gc-tag">长 {{ it.lenKm }} km</span>
                <span v-if="it.heatRank" class="gc-tag">人气第 {{ it.heatRank }}</span>
                <span v-if="it.metro" class="gc-tag">🚇 {{ it.metro }} 站</span>
              </div>
            </div>
            <span class="gc-score"><b>{{ it.score }}</b><em>分</em></span>
          </div>
        </div>

        <!-- ② 对比区（≥2 条时显示） -->
        <div v-if="selected.length >= 2" class="gc-compare">
          <div class="gc-compare-head">
            <span class="gc-compare-title"><i class="fas fa-chart-line"></i> 多维对比</span>
            <button class="gc-clear" @click="clearAll">清空</button>
          </div>

          <!-- 雷达图（多色叠加） -->
          <div ref="radarRef" class="gc-radar"></div>

          <!-- 指标对比表 -->
          <table class="gc-table">
            <thead>
              <tr>
                <th>指标</th>
                <th v-for="(s, i) in selected" :key="s.name">
                  <i class="gc-dot" :style="{ background: COLORS[i] }"></i>{{ shortName(s.name) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in compareRows" :key="row.key">
                <td>{{ row.label }}</td>
                <td v-for="(v, i) in row.values" :key="i"
                    :class="{ 'gc-best': v === row.best && row.best > 0 && v !== null }">
                  <template v-if="row.key === 'heatRank' && v === null">暂无</template>
                  <template v-else>{{ v }}<span v-if="row.suffix"> {{ row.suffix }}</span></template>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 结论行 -->
          <div class="gc-verdict">
            <i class="fas fa-trophy"></i> 综合最优：
            <b :style="{ color: COLORS[bestIndex] }">{{ selected[bestIndex]?.name }}</b>
            （{{ selected[bestIndex]?.score }} 分 · {{ selected[bestIndex]?.grade }}）
          </div>

          <!-- 操作 -->
          <div class="gc-actions">
            <button class="gc-go" @click="goBest">
              <i class="fas fa-route"></i> 去最优绿道
            </button>
            <button class="gc-ai-btn" :disabled="aiLoading" @click="askAI">
              <i class="fas" :class="aiLoading ? 'fa-spinner fa-spin' : 'fa-robot'"></i>
              {{ aiLoading ? 'AI 分析中…' : 'AI 对比解读' }}
            </button>
          </div>

          <!-- AI 对比解读 -->
          <div v-if="aiText" class="gc-ai-text">
            <div class="gc-ai-head"><i class="fas fa-robot"></i> AI 对比解读</div>
            <p class="gc-ai-content">{{ aiText }}</p>
            <button class="gc-ai-retry" @click="aiText = null">重新解读</button>
          </div>
        </div>

        <p v-else-if="selected.length === 1" class="gc-hint">
          <i class="fas fa-circle-info"></i> 再选 1 条即可开始对比
        </p>
        <p v-else class="gc-hint">
          <i class="fas fa-circle-info"></i> 勾选 2~3 条绿道，查看并排对比
        </p>
      </template>

      <p v-else class="gc-empty"><i class="fas fa-circle-exclamation"></i> 对比数据加载失败，请稍后重试</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { getApiBaseUrl } from '@/mobile/services/api'

const emit = defineEmits(['close', 'locate-greenway', 'go-route', 'compare-change'])

const MAX = 3
const COLORS = ['#E53935', '#1E88E5', '#43A047']  // 红 / 蓝 / 绿（与地图高亮一致）

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
const selected = ref([])
const aiText = ref(null)
const aiLoading = ref(false)
const radarRef = ref(null)
let radarChart = null

const isSelected = (it) => selected.value.some(s => s.name === it.name)

function toggle(it) {
  const idx = selected.value.findIndex(s => s.name === it.name)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else {
    if (selected.value.length >= MAX) {
      alert(`最多对比 ${MAX} 条绿道，请先移除一条`)
      return
    }
    selected.value.push(it)
  }
  emit('compare-change', selected.value)
  renderRadar()
}

function clearAll() {
  selected.value = []
  emit('compare-change', selected.value)
  renderRadar()
}

const shortName = (name) => (name.length > 6 ? name.slice(0, 6) + '…' : name)

/* ── 指标对比表 ── */
const DIM_CFG = [
  { key: 'score', label: '综合评分', suffix: '' },
  { key: 'eco', label: '生态自然度', suffix: '分' },
  { key: 'transport', label: '出行便捷度', suffix: '分' },
  { key: 'facility', label: '设施完备度', suffix: '分' },
  { key: 'heat', label: '人气活力值', suffix: '分' },
  { key: 'leisure', label: '休闲适宜度', suffix: '分' },
  { key: 'lenKm', label: '长度', suffix: 'km' },
  { key: 'heatRank', label: '热度排名', suffix: '名' }
]
const compareRows = computed(() => DIM_CFG.map(cfg => {
  const values = selected.value.map(s => {
    if (cfg.key === 'score') return s.score
    if (cfg.key === 'lenKm') return s.lenKm ?? 0
    if (cfg.key === 'heatRank') return s.heatRank ?? null  // 无数据保留 null
    // 五维评分位于 assess 返回的 dims 嵌套对象中（如 s.dims.eco）
    return s.dims?.[cfg.key] ?? 0
  })
  const best = cfg.key === 'heatRank'
    ? Math.min(...values.filter(v => v !== null && v > 0)) || 0
    : Math.max(...values)
  return { key: cfg.key, label: cfg.label, values, best, suffix: cfg.suffix }
}))

const bestIndex = computed(() => {
  if (!selected.value.length) return 0
  let bi = 0
  selected.value.forEach((s, i) => { if (s.score > selected.value[bi].score) bi = i })
  return bi
})

/* ── 雷达图（多色叠加） ── */
const DIM_LABEL = ['生态自然度', '出行便捷度', '设施完备度', '人气活力值', '休闲适宜度']
const DIM_KEY = ['eco', 'transport', 'facility', 'heat', 'leisure']

function renderRadar() {
  if (!radarRef.value) return
  // v-if（selected>=2）销毁再重建后，radarRef 是新的 DOM；
  // 若旧 echarts 实例仍绑定在已脱离文档的旧 DOM 上，需销毁重建，否则 setOption 画在离屏旧 canvas 上导致图表“消失”。
  if (radarChart && radarChart.getDom() !== radarRef.value) {
    try { radarChart.dispose() } catch (e) { /* 忽略 */ }
    radarChart = null
  }
  if (!radarChart) radarChart = echarts.init(radarRef.value)
  const avg = result.value?.avgDims || {}
  const seriesData = selected.value.map((s, i) => ({
    name: s.name,
    value: DIM_KEY.map(k => s.dims[k]),
    lineStyle: { color: COLORS[i], width: 2.5 },
    itemStyle: { color: COLORS[i] },
    areaStyle: { color: COLORS[i] + '33' },
    symbolSize: 5
  }))
  if (seriesData.length < 2) return
  seriesData.push({
    name: '全市平均',
    value: DIM_KEY.map(k => avg[k] ?? 0),
    lineStyle: { color: '#B0BEC5', width: 1.5, type: 'dashed' },
    itemStyle: { color: '#B0BEC5' },
    areaStyle: { color: 'rgba(176,190,197,0.08)' },
    symbolSize: 3
  })
  radarChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: '#777' } },
    radar: {
      indicator: DIM_KEY.map(k => ({ name: DIM_LABEL[DIM_KEY.indexOf(k)], max: 100 })),
      radius: '62%',
      center: ['50%', '46%'],
      splitArea: { areaStyle: { color: ['rgba(46,125,50,0.03)', 'rgba(46,125,50,0.06)'] } },
      axisName: { color: '#8a9a8a', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.12)' } }
    },
    series: [{ type: 'radar', data: seriesData }]
  })
}

watch(radarRef, () => renderRadar())

/* ── 操作 ── */
function goBest() {
  const best = selected.value[bestIndex.value]
  if (best) emit('go-route', best)
}

async function load() {
  loading.value = true
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/greenways/assess`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    result.value = data
  } catch (e) {
    alert('对比数据加载失败：' + e.message)
  } finally {
    loading.value = false
  }
}

/* ── AI 对比解读 ── */
async function askAI() {
  if (selected.value.length < 2) return
  aiLoading.value = true
  aiText.value = null
  try {
    const list = selected.value
    const detail = list.map((s, i) => {
      const tag = COLORS[i] === '#E53935' ? 'A' : COLORS[i] === '#1E88E5' ? 'B' : 'C'
      return `${tag}.${s.name}（综合${s.score}分/${s.grade}，长${s.lenKm}km，热度排名${s.heatRank ?? '暂无'}）\n` +
        `  五维：生态${s.dims.eco}、出行${s.dims.transport}、设施${s.dims.facility}、人气${s.dims.heat}、休闲${s.dims.leisure}\n` +
        `  画像：生态${s.profile.eco}%/风景${s.profile.scenic}%/历史文化${s.profile.history}%/城市${s.profile.urban}%\n` +
        `  亮点：${s.highlights.map(h => h.text).join('；')}\n` +
        `  短板：${s.weakPoints.map(w => w.text).join('；') || '无明显短板'}`
    }).join('\n\n')

    const res = await fetch(`${getApiBaseUrl()}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `请对比下面 ${list.length} 条北京绿道（250-300字），数据如下（注意：北京全市仅有 17 条绿道，不要虚构更多）：\n${detail}\n\n` +
          `要求：1) 先用一句话说清各自的定位差异（比如"A适合遛娃，B适合骑行，C适合访古"）；` +
          `2) 按"不同人群/场景"给出选道建议（遛娃、骑行、跑步、访古、亲近自然、周末郊游等）；` +
          `3) 最后明确给出你推荐哪一条，并说明理由。语言通俗亲切，像朋友推荐一样。`
      })
    })
    const data = await res.json()
    aiText.value = data.reply || 'AI 暂时无法解读，请稍后重试。'
  } catch (e) {
    aiText.value = 'AI 对比解读生成失败：' + e.message
  } finally {
    aiLoading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.gc-panel {
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
.gc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.06));
  background: linear-gradient(135deg, rgba(229,57,53,0.08), rgba(255,152,0,0.03));
  touch-action: none;
}
.gc-title { font-size: 1rem; font-weight: 800; color: var(--text-primary, #1a2a1a); display: inline-flex; align-items: center; gap: 6px; }
.gc-title i { color: #E53935; }
.gc-sub { flex: 1; font-size: 0.72rem; color: var(--text-secondary, #888); }
.gc-close {
  border: none; background: rgba(0,0,0,0.05); border-radius: 50%;
  width: 26px; height: 26px; font-size: 1rem; color: var(--text-tertiary, #999);
  cursor: pointer; line-height: 1; display: inline-flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.gc-close:hover { background: rgba(229,57,53,0.12); color: #E53935; transform: rotate(90deg); }
.gc-body { padding: 12px 16px 16px; overflow-y: auto; }
.gc-loading { text-align: center; padding: 30px 0; color: var(--text-secondary, #888); font-size: 0.9rem; }

.gc-list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.gc-list-title { font-size: 0.86rem; font-weight: 700; color: var(--text-primary, #333); }
.gc-list-title i { color: #E53935; }
.gc-list-hint { font-size: 0.7rem; color: var(--text-tertiary, #999); font-weight: 700; }
.gc-list { display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; padding-right: 2px; }
.gc-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer; transition: all 0.15s;
}
.gc-item:hover { background: var(--bg-secondary, rgba(0,0,0,0.03)); }
.gc-item-on { background: rgba(229,57,53,0.06); border-color: rgba(229,57,53,0.28); }
.gc-check {
  flex: 0 0 18px; height: 18px; border-radius: 5px;
  border: 2px solid #d1d5db; background: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; transition: all 0.15s;
}
.gc-check.checked { background: #E53935; border-color: #E53935; }
.gc-rank-num {
  flex: 0 0 24px; height: 24px; border-radius: 7px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 800; color: #fff; background: #90A4AE;
}
.gc-rank-1 { background: linear-gradient(135deg, #F57F17, #FFB300); }
.gc-rank-2 { background: linear-gradient(135deg, #78909C, #B0BEC5); }
.gc-rank-3 { background: linear-gradient(135deg, #8D6E63, #BCAAA4); }
.gc-item-main { flex: 1; min-width: 0; }
.gc-item-top { display: flex; align-items: center; gap: 6px; }
.gc-name { font-size: 0.86rem; font-weight: 700; color: var(--text-primary, #222); }
.gc-grade { font-size: 0.6rem; font-weight: 700; padding: 1px 7px; border-radius: 8px; color: #fff; }
.gc-grade-优 { background: #2E7D32; }
.gc-grade-良 { background: #1976D2; }
.gc-grade-中 { background: #F57C00; }
.gc-grade-待提升 { background: #C62828; }
.gc-item-tags { display: flex; gap: 5px; margin-top: 2px; flex-wrap: wrap; }
.gc-tag { font-size: 0.62rem; color: var(--text-secondary, #777); background: var(--bg-tertiary, rgba(0,0,0,0.05)); padding: 1px 6px; border-radius: 7px; }
.gc-score { flex: 0 0 auto; text-align: right; }
.gc-score b { font-size: 1.05rem; color: #E53935; }
.gc-score em { font-size: 0.62rem; color: var(--text-tertiary, #999); font-style: normal; }

.gc-compare { margin-top: 10px; border-top: 1px dashed var(--border-color, rgba(0,0,0,0.12)); padding-top: 10px; }
.gc-compare-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.gc-compare-title { font-size: 0.86rem; font-weight: 700; color: var(--text-primary, #333); }
.gc-compare-title i { color: #E53935; }
.gc-clear { border: none; background: transparent; color: var(--text-tertiary, #999); font-size: 0.72rem; cursor: pointer; padding: 2px 6px; }
.gc-clear:hover { color: #E53935; }
.gc-radar { width: 100%; height: 240px; }

.gc-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 0.74rem; }
.gc-table th, .gc-table td { padding: 5px 6px; text-align: center; border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.06)); }
.gc-table th { color: var(--text-secondary, #777); font-weight: 600; }
.gc-table th .gc-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.gc-table td:first-child { text-align: left; color: var(--text-secondary, #777); }
.gc-table td { color: var(--text-primary, #333); }
.gc-table .gc-best { color: #2E7D32; font-weight: 800; }

.gc-verdict {
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px; padding: 8px 12px; border-radius: 10px;
  background: rgba(255,215,0,0.1); border: 1px solid rgba(255,180,0,0.3);
  font-size: 0.8rem; color: var(--text-primary, #333);
}
.gc-verdict i { color: #F57F17; }
.gc-actions { display: flex; gap: 10px; margin-top: 10px; }
.gc-go {
  flex: 1; padding: 8px 0; border: none; border-radius: 10px;
  background: linear-gradient(135deg, #E53935, #FF7043);
  color: #fff; font-size: 0.84rem; font-weight: 700; cursor: pointer;
  box-shadow: 0 3px 8px rgba(229,57,53,0.25); transition: all 0.2s;
}
.gc-go:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(229,57,53,0.35); }
.gc-ai-btn {
  flex: 1; padding: 8px 0; border-radius: 10px; border: 1.5px solid #43A047;
  background: rgba(67,160,71,0.08); color: #2E7D32; font-size: 0.84rem; font-weight: 700; cursor: pointer;
  transition: all 0.2s;
}
.gc-ai-btn:hover { background: rgba(67,160,71,0.15); }
.gc-ai-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.gc-ai-text {
  margin-top: 10px; padding: 10px 12px; border-radius: 10px;
  background: rgba(67,160,71,0.07); border: 1px solid rgba(67,160,71,0.2);
}
.gc-ai-head { font-size: 0.76rem; font-weight: 800; color: #2E7D32; margin-bottom: 6px; }
.gc-ai-content { margin: 0; font-size: 0.78rem; line-height: 1.8; color: var(--text-primary, #333); white-space: pre-wrap; }
.gc-ai-retry { margin-top: 8px; border: none; background: transparent; color: #2E7D32; font-size: 0.7rem; cursor: pointer; font-weight: 600; }
.gc-ai-retry:hover { text-decoration: underline; }

.gc-hint { text-align: center; color: var(--text-tertiary, #999); font-size: 0.78rem; padding: 18px 0; }
.gc-empty { text-align: center; color: var(--text-secondary, #888); font-size: 0.85rem; padding: 20px 0; }

/* 手机端：面板全宽，避免溢出屏幕 */
@media (max-width: 480px) {
  .gc-panel {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
    left: 8px !important;
    top: 56px !important;
  }
  .gc-table { font-size: 0.68rem; }
}
</style>
