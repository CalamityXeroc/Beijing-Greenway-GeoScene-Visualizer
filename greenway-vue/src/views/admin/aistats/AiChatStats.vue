<template>
  <div class="ai-stats-page">
    <!-- 页头 -->
    <div class="page-header">
      <h2 class="page-title">AI 对话分析</h2>
      <div class="range-tabs">
        <button
          v-for="opt in rangeOptions"
          :key="opt.days"
          :class="['range-btn', { active: days === opt.days }]"
          @click="setDays(opt.days)"
        >{{ opt.label }}</button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row" v-if="summary">
      <div class="stat-card">
        <div class="stat-num">{{ summary.total_messages }}</div>
        <div class="stat-lbl">总对话数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ summary.unique_sessions }}</div>
        <div class="stat-lbl">独立会话</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ summary.unique_words }}</div>
        <div class="stat-lbl">关键词种类</div>
      </div>
    </div>

    <!-- 加载 / 错误 -->
    <div v-if="loading" class="hint">加载中…</div>
    <div v-else-if="error" class="hint error">{{ error }}</div>

    <template v-else>
      <!-- 词云 -->
      <div class="chart-card">
        <div class="card-title">高频关键词词云</div>
        <div v-if="wordData.length === 0" class="hint muted">暂无词云数据（对话记录不足）</div>
        <div v-else ref="wordCloudRef" class="echart"></div>
      </div>

      <!-- 日趋势折线图 -->
      <div class="chart-card">
        <div class="card-title">每日对话量趋势</div>
        <div v-if="dailyData.length === 0" class="hint muted">暂无趋势数据</div>
        <div v-else ref="lineChartRef" class="echart echart-line"></div>
      </div>

      <!-- 最近对话记录 -->
      <div class="chart-card">
        <div class="card-title">最近用户提问</div>
        <div v-if="recentMsgs.length === 0" class="hint muted">暂无记录</div>
        <ul v-else class="msg-list">
          <li v-for="(m, i) in recentMsgs" :key="i" class="msg-item">
            <span class="msg-time">{{ formatTime(m.created_at) }}</span>
            <span class="msg-text">{{ m.message }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import 'echarts-wordcloud'
import { useAdminAuth } from '@/stores/adminAuth'
import { useGlobalTheme } from '@/utils/useTheme'

const { apiFetch } = useAdminAuth()
const { theme } = useGlobalTheme()
const isDark = computed(() => theme.value === 'night')

const rangeOptions = [
  { days: 7,  label: '近 7 天' },
  { days: 30, label: '近 30 天' },
  { days: 90, label: '近 90 天' }
]

const days      = ref(30)
const loading   = ref(false)
const error     = ref('')
const summary   = ref(null)
const wordData  = ref([])   // [{ name, value }]
const dailyData = ref([])   // [{ date, count }]
const recentMsgs = ref([])

async function loadStats() {
  loading.value = true
  error.value   = ''
  try {
    const [statsRes, recentRes] = await Promise.all([
      apiFetch(`/api/admin/ai-stats?days=${days.value}`),
      apiFetch(`/api/admin/ai-stats/recent?limit=20`)
    ])
    // statsRes shape: { summary, wordFrequency: [{word,count}], dailyTrend: [{date,count}] }
    summary.value  = statsRes.summary  || null
    wordData.value = (statsRes.wordFrequency || []).map(w => ({ name: w.word, value: w.count }))
    dailyData.value = statsRes.dailyTrend || []
    recentMsgs.value = recentRes.messages || []
  } catch (e) {
    error.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

function setDays(d) {
  days.value = d
}

// ── 原生 ECharts ─────────────────────────────────────────────
const wordCloudRef = ref(null)
const lineChartRef = ref(null)
let wordCloudChart = null
let lineChartInst = null

function initCharts() {
  if (wordCloudRef.value && !wordCloudChart) {
    wordCloudChart = echarts.init(wordCloudRef.value)
  }
  if (lineChartRef.value && !lineChartInst) {
    lineChartInst = echarts.init(lineChartRef.value)
  }
}

function updateCharts() {
  if (wordCloudChart && wordData.value.length > 0) {
    wordCloudChart.setOption(wordCloudOption.value, true)
  }
  if (lineChartInst && dailyData.value.length > 0) {
    lineChartInst.setOption(lineOption.value, true)
  }
}

watch(days, loadStats)
onMounted(async () => {
  await loadStats()
  await nextTick()
  initCharts()
  await nextTick()
  updateCharts()
})
watch(wordData, () => nextTick(() => updateCharts()), { deep: true })
watch(dailyData, () => nextTick(() => updateCharts()), { deep: true })
onBeforeUnmount(() => {
  wordCloudChart?.dispose()
  lineChartInst?.dispose()
  wordCloudChart = null
  lineChartInst = null
})

// ── ECharts options ──────────────────────────────────────────

const wordCloudOption = computed(() => ({
  backgroundColor: 'transparent',
  series: [{
    type: 'wordCloud',
    shape: 'circle',
    left: 'center',
    top: 'center',
    width: '90%',
    height: '90%',
    sizeRange: [14, 72],
    rotationRange: [-30, 30],
    rotationStep: 15,
    gridSize: 8,
    drawOutOfBound: false,
    layoutAnimation: true,
    textStyle: {
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      fontWeight: 'bold',
      color() {
        const paletteDark  = ['#e8e8e8','#d1d5db','#9ca3af','#A5D6A7','#81C784','#4CAF50','#facc15','#fb923c','#60a5fa']
        const paletteLight = ['#15803d','#16a34a','#166534','#1e7e34','#0f6b2e','#22863a','#2da44e','#3fb950','#56d364']
        const palette = isDark.value ? paletteDark : paletteLight
        return palette[Math.floor(Math.random() * palette.length)]
      }
    },
    emphasis: {
      focus: 'self',
      textStyle: { shadowBlur: 10, shadowColor: isDark.value ? '#ffffff33' : '#15803d55' }
    },
    data: wordData.value
  }]
}))

const lineOption = computed(() => {
  const dates  = dailyData.value.map(d => d.date)
  const counts = dailyData.value.map(d => Number(d.count))
  const dark = isDark.value
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#252525' : '#fff',
      borderColor:     dark ? '#333' : '#e5e7eb',
      textStyle: { color: dark ? '#e8e8e8' : '#1f2937' }
    },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine:  { lineStyle: { color: dark ? '#333' : '#e5e7eb' } },
      axisTick:  { lineStyle: { color: dark ? '#333' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: dark ? '#2a2a2a' : '#f3f4f6' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 }
    },
    series: [{
      name: '对话数',
      type: 'line',
      data: counts,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: dark ? '#60a5fa' : '#16a34a', width: 2 },
      itemStyle: { color: dark ? '#60a5fa' : '#16a34a' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: dark ? '#60a5fa44' : '#16a34a33' },
            { offset: 1, color: dark ? '#60a5fa05' : '#16a34a05' }
          ]
        }
      }
    }]
  }
})

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
/* ===== 白天模式（默认）===== */
.ai-stats-page {
  padding: 24px;
  min-height: 100%;
  background: #f0f2f5;
  color: #111827;
  transition: background 0.3s, color 0.3s;
}

/* 页头 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.range-tabs { display: flex; gap: 8px; }
.range-btn {
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #4b5563;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all .2s;
}
.range-btn:hover  { border-color: #2E7D32; color: #2E7D32; }
.range-btn.active { background: #dcfce7; border-color: #86efac; color: #15803d; font-weight: 600; }

/* 手机端：加大触控目标 */
@media (max-width: 768px) {
  .range-btn {
    min-height: 36px;
    padding: 6px 16px;
    font-size: 0.85rem;
  }
}

/* 统计行 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: background 0.3s, border-color 0.3s;
}
.stat-num { font-size: 2rem; font-weight: 700; color: #111827; }
.stat-lbl { font-size: 0.8rem; color: #6b7280; margin-top: 4px; }

/* 提示 */
.hint { text-align: center; padding: 32px; color: #6b7280; }
.hint.error { color: #dc2626; }
.hint.muted { padding: 40px; font-size: 0.9rem; }

/* 图表卡片 */
.chart-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: background 0.3s, border-color 0.3s;
}
.card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 16px;
}

/* ECharts 容器 */
.echart { width: 100%; height: 380px; }
.echart-line { height: 260px; }

/* 消息列表 */
.msg-list { list-style: none; margin: 0; padding: 0; }
.msg-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.88rem;
  line-height: 1.5;
}
.msg-item:last-child { border-bottom: none; }
.msg-time {
  flex-shrink: 0;
  color: #6b7280;
  font-size: 0.78rem;
  margin-top: 2px;
  width: 70px;
}
.msg-text { color: #374151; }

/* ===== 夜间模式覆盖 ===== */
:global([data-theme="night"] .ai-stats-page) { background: #0f0f0f; color: #e5e7eb; }
:global([data-theme="night"] .page-title)     { color: #e8e8e8; }
:global([data-theme="night"] .range-btn)      { border-color: #3a3a3a; background: transparent; color: #9ca3af; }
:global([data-theme="night"] .range-btn:hover)  { border-color: #4CAF50; color: #A5D6A7; }
:global([data-theme="night"] .range-btn.active) { background: #252525; border-color: #4CAF50; color: #A5D6A7; }
:global([data-theme="night"] .stat-card)   { background: #1e1e1e; border-color: #333; box-shadow: none; }
:global([data-theme="night"] .stat-num)    { color: #e8e8e8; }
:global([data-theme="night"] .stat-lbl)    { color: #9ca3af; }
:global([data-theme="night"] .hint)        { color: #9ca3af; }
:global([data-theme="night"] .hint.error)  { color: #f87171; }
:global([data-theme="night"] .chart-card)  { background: #1e1e1e; border-color: #333; box-shadow: none; }
:global([data-theme="night"] .card-title)  { color: #e8e8e8; }
:global([data-theme="night"] .msg-item)    { border-bottom-color: #2a2a2a; }
:global([data-theme="night"] .msg-time)    { color: #9ca3af; }
:global([data-theme="night"] .msg-text)    { color: #d1d5db; }
</style>
