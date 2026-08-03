<template>
  <div class="heat-admin">
    <div class="page-header">
      <h2 class="page-title">POI 热度统计</h2>
      <span class="page-subtitle">监控各类设施点击趋势，了解用户最关注的周边配套</span>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(76,175,80,.12);color:#4CAF50"><i class="fas fa-map-pin"></i></div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.total || 0 }}</div>
          <div class="stat-label">POI 总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(33,150,243,.12);color:#2196F3"><i class="fas fa-mouse-pointer"></i></div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.todayClicks || 0 }}</div>
          <div class="stat-label">今日 POI 点击</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(139,92,246,.12);color:#8B5CF6"><i class="fas fa-layer-group"></i></div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.typeCount || 0 }}</div>
          <div class="stat-label">POI 类别数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(230,81,0,.12);color:#E65100"><i class="fas fa-fire"></i></div>
        <div class="stat-body">
          <div class="stat-value small">{{ overview.topType || '-' }}</div>
          <div class="stat-label">最热 POI 类别</div>
        </div>
      </div>
    </div>

    <!-- 图表第一行 -->
    <div class="charts-row">
      <div class="chart-card">
        <h3 class="chart-title">POI 类型点击分布</h3>
        <div ref="typePieDom" class="chart-dom"></div>
      </div>
      <div class="chart-card">
        <h3 class="chart-title">POI 点击趋势 ({{ trendDays }}天)</h3>
        <div class="trend-btns">
          <button v-for="d in [7,30,90]" :key="d" :class="{ active: trendDays === d }" @click="loadTrend(d)">{{ d }}天</button>
        </div>
        <div ref="trendDom" class="chart-dom"></div>
      </div>
    </div>

    <!-- 热门 POI TOP 10 表格 -->
    <div class="chart-card chart-card-table">
      <h3 class="chart-title">热门 POI TOP 10</h3>
      <table class="heat-table">
        <thead>
          <tr><th>#</th><th>设施名称</th><th>类型</th><th>所属绿道</th><th>点击数</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in topPois" :key="i">
            <td class="rank">{{ i + 1 }}</td>
            <td>{{ r.poi_name }}</td>
            <td><span class="tag" :style="{ background: typeColor(r.poi_type), color: '#fff' }">{{ r.type_name }}</span></td>
            <td>{{ r.greenway_name }}</td>
            <td>{{ r.cnt }}</td>
          </tr>
          <tr v-if="!topPois.length"><td colspan="5" style="text-align:center;color:#999;padding:2rem">暂无点击数据</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useGlobalTheme } from '@/utils/useTheme'
import { fetchPoiStatsOverview, fetchPoiClickTrend, fetchPoiTypeClicks, fetchTopPois } from '@/services/poiStatsApi'

const { theme: globalTheme } = useGlobalTheme()
const isNight = () => globalTheme.value === 'night'
const textColor = () => isNight() ? '#e5e7eb' : '#333'
const borderColor = () => isNight() ? '#333' : '#e5e7eb'

const TYPE_COLORS = {
  '150500': '#1E88E5', '150700': '#039BE5', '150900': '#43A047',
  '200300': '#8D6E63', '060100': '#E53935', '080600': '#8E24AA',
  '110100': '#F57C00', '110200': '#F57C00'
}
function typeColor(code) { return TYPE_COLORS[code] || '#999' }

const overview = ref({})
const topPois = ref([])
const trendDays = ref(30)

const typePieDom = ref(null)
const trendDom = ref(null)
let typePieInst = null, trendInst = null
let themeObs = null

async function loadAll() {
  try {
    const ov = await fetchPoiStatsOverview()
    overview.value = ov
  } catch { }
  try {
    topPois.value = await fetchTopPois(10)
  } catch { }
  loadTypeChart()
  loadTrend(30)
}

async function loadTypeChart() {
  try {
    const data = await fetchPoiTypeClicks()
    if (!typePieInst) return
    typePieInst.setOption({
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', left: 0, top: 10, textStyle: { color: textColor() } },
      series: [{
        name: '点击量', type: 'pie', radius: ['40%', '70%'], center: ['55%', '55%'],
        data: data.map(d => ({ value: d.cnt, name: d.type_name, itemStyle: { color: typeColor(d.poi_type) } })),
        label: { color: textColor() },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } }
      }]
    }, true)
  } catch { }
}

async function loadTrend(days) {
  trendDays.value = days
  try {
    const data = await fetchPoiClickTrend(days)
    if (!trendInst) return
    trendInst.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: data.map(d => d.date.slice(5, 10)), axisLabel: { color: textColor() }, axisLine: { lineStyle: { color: borderColor() } } },
      yAxis: { type: 'value', axisLabel: { color: textColor() }, splitLine: { lineStyle: { color: borderColor() } } },
      series: [{
        name: 'POI点击', type: 'line', data: data.map(d => d.cnt), smooth: true,
        lineStyle: { color: '#8B5CF6', width: 2 }, itemStyle: { color: '#8B5CF6' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(139,92,246,0.3)' }, { offset: 1, color: 'rgba(139,92,246,0.02)' }]) }
      }]
    }, true)
  } catch { }
}

onMounted(async () => {
  await nextTick()
  if (typePieDom.value) { typePieInst = echarts.init(typePieDom.value) }
  if (trendDom.value) { trendInst = echarts.init(trendDom.value) }
  await loadAll()
  themeObs = new MutationObserver(() => {
    if (typePieInst) { typePieInst.setOption({ legend: { textStyle: { color: textColor() } } }) }
    loadTypeChart(); loadTrend(trendDays.value)
  })
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})

onBeforeUnmount(() => {
  typePieInst?.dispose(); trendInst?.dispose()
  themeObs?.disconnect()
})
</script>

<style scoped>
.heat-admin { padding: 0 0 2rem; }
.page-header { margin-bottom: 1.5rem; }
.page-title { font-size: 1.5rem; color: #111; margin: 0 0 0.3rem; }
.page-subtitle { font-size: 0.85rem; color: #9ca3af; }
.stats-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 1.5rem; }
.stat-card { background: #fff; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #f0f0f0; }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.stat-body { flex: 1; }
.stat-value { font-size: 1.8rem; font-weight: 700; color: #111; }
.stat-value.small { font-size: 1rem; }
.stat-label { font-size: 0.8rem; color: #6b7280; margin-top: 2px; }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 1.5rem; }
.chart-card { background: #fff; border-radius: 12px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #f0f0f0; position: relative; }
.chart-card-table { margin-bottom: 1.5rem; }
.chart-title { font-size: 0.9rem; color: #374151; margin: 0 0 0.6rem; }
.chart-dom { width: 100%; height: 260px; }
.trend-btns { position: absolute; right: 1rem; top: 1rem; display: flex; gap: 4px; }
.trend-btns button { padding: 2px 8px; border: 1px solid #e5e7eb; background: #fff; border-radius: 4px; font-size: 0.75rem; cursor: pointer; color: #6b7280; }
.trend-btns button.active { background: #4CAF50; color: #fff; border-color: #4CAF50; }
.heat-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.heat-table th { text-align: left; padding: 0.6rem 0.8rem; background: #f9fafb; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
.heat-table td { padding: 0.55rem 0.8rem; border-bottom: 1px solid #f3f4f6; }
.rank { font-weight: 700; color: #4CAF50; }
.tag { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 10px; font-size: 0.72rem; font-weight: 600; }

[data-theme="night"] .page-title { color: #e5e7eb; }
[data-theme="night"] .stat-card { background: #1f2937; border-color: #374151; }
[data-theme="night"] .stat-value { color: #e5e7eb; }
[data-theme="night"] .chart-card { background: #1f2937; border-color: #374151; }
[data-theme="night"] .chart-title { color: #d1d5db; }
[data-theme="night"] .heat-table th { background: #111827; color: #9ca3af; border-color: #374151; }
[data-theme="night"] .heat-table td { border-color: #1f2937; color: #d1d5db; }
[data-theme="night"] .trend-btns button { background: #1f2937; border-color: #374151; color: #9ca3af; }
[data-theme="night"] .trend-btns button.active { background: #4CAF50; color: #fff; }
</style>
