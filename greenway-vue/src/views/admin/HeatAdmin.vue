<template>
  <div class="heat-admin">
    <div class="page-header">
      <h2 class="page-title">绿道热度管理</h2>
      <span class="page-subtitle">实时监控绿道热度数据，分析用户行为趋势 | 热度 = 点击×0.2 + 规划×0.5 + 评论×0.3</span>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(33,150,243,.12);color:#2196F3"><i class="fas fa-mouse-pointer"></i></div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.today_clicks || 0 }}</div>
          <div class="stat-label">今日点击量</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(76,175,80,.12);color:#4CAF50"><i class="fas fa-route"></i></div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.today_routes || 0 }}</div>
          <div class="stat-label">今日路径规划</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(250,173,20,.12);color:#FAAD14"><i class="fas fa-comment-dots"></i></div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.today_comments || 0 }}</div>
          <div class="stat-label">今日评论数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(255,77,79,.12);color:#FF4D4F"><i class="fas fa-fire"></i></div>
        <div class="stat-body">
          <div class="stat-value small">{{ overview.top_greenway || '-' }}</div>
          <div class="stat-label">热度最高绿道</div>
        </div>
      </div>
    </div>

    <!-- 第一行：热度排名 + 评论排名 -->
    <div class="charts-row">
      <div class="chart-card">
        <h3 class="chart-title">绿道热度排行榜</h3>
        <div ref="rankChart" class="chart-body"></div>
      </div>
      <div class="chart-card">
        <h3 class="chart-title">评论数量排行榜</h3>
        <div ref="commentRankChart" class="chart-body"></div>
      </div>
    </div>

    <!-- 第二行：热度趋势 + 评论趋势 -->
    <div class="charts-row">
      <div class="chart-card">
        <h3 class="chart-title">综合热度趋势（近90天）</h3>
        <div ref="trendChart" class="chart-body"></div>
      </div>
      <div class="chart-card">
        <h3 class="chart-title">评论趋势（近90天）</h3>
        <div ref="commentTrendChart" class="chart-body"></div>
      </div>
    </div>

    <!-- 第三行：权重分布 + 三维对比 -->
    <div class="charts-row">
      <div class="chart-card">
        <h3 class="chart-title">热度权重分布</h3>
        <div ref="weightPieChart" class="chart-body" style="height:300px"></div>
      </div>
      <div class="chart-card">
        <h3 class="chart-title">点击・规划・评论三维对比</h3>
        <div ref="compareChart" class="chart-body"></div>
      </div>
    </div>

    <!-- 明细表格 -->
    <div class="table-card">
      <h3 class="chart-title">绿道热度明细</h3>
      <div class="table-wrap">
        <table class="heat-table">
          <thead>
            <tr>
              <th>绿道名称</th><th>点击量</th><th>路径规划</th><th>评论数</th><th>热度指数</th><th>热度条</th><th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rankData" :key="item.greenway_name">
              <td>{{ item.greenway_name }}</td>
              <td>{{ item.click_count }}</td>
              <td>{{ item.route_count }}</td>
              <td>{{ item.comment_count || 0 }}</td>
              <td>{{ item.heat_index }}</td>
              <td><div class="heat-bar"><div class="heat-bar-inner" :style="{ width: item.heat_index + '%' }"></div></div></td>
              <td>{{ formatTime(item.last_updated) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { useGlobalTheme } from '@/utils/useTheme'
import {
  fetchHeatmapOverview, fetchHeatmapTrend, fetchHeatmapRank, fetchHeatmapCompare,
  fetchCommentStats, fetchCommentRank, fetchCommentTrend
} from '@/services/heatmapApi'

const { theme: globalTheme } = useGlobalTheme()
const isNight = () => globalTheme.value === 'night'

const overview = ref({})
const rankData = ref([])
const trendData = ref([])
const compareData = ref([])
const commentRankData = ref([])
const commentTrendData = ref([])

const rankChart = ref(null)
const trendChart = ref(null)
const compareChart = ref(null)
const commentRankChart = ref(null)
const commentTrendChart = ref(null)
const weightPieChart = ref(null)

let rankInstance = null
let trendInstance = null
let compareInstance = null
let commentRankInstance = null
let commentTrendInstance = null
let weightPieInstance = null

function textColor() { return isNight() ? '#e5e7eb' : '#333' }
function borderColor() { return isNight() ? '#333' : '#e5e7eb' }

function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

function makeRankChart(data) {
  if (!rankInstance) return
  const names = data.map(d => d.greenway_name).reverse()
  const values = data.map(d => d.heat_index).reverse()
  rankInstance.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '热度指数', axisLine: { lineStyle: { color: borderColor() } }, axisLabel: { color: textColor() } },
    yAxis: { type: 'category', data: names, inverse: true, axisLine: { lineStyle: { color: borderColor() } }, axisLabel: { color: textColor() } },
    series: [{
      name: '热度指数', type: 'bar', data: values,
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#52c41a' }, { offset: 0.5, color: '#faad14' }, { offset: 1, color: '#ff4d4f' }]) },
      label: { show: true, position: 'right', color: textColor() }
    }]
  }, true)
}

function makeTrendChart(data) {
  if (!trendInstance) return
  const dates = data.map(d => d.date.slice(5, 10))
  const clicks = data.map(d => d.click_count)
  const routes = data.map(d => d.route_count)
  const comments = data.map(d => d.comment_count || 0)
  const heats = data.map(d => d.heat_index)

  trendInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['点击量', '路径规划量', '评论量', '热度指数'], bottom: 0, textStyle: { color: textColor() } },
    grid: { left: '3%', right: '4%', bottom: '14%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLabel: { color: textColor(), rotate: 45 }, axisLine: { lineStyle: { color: borderColor() } } },
    yAxis: [
      { type: 'value', name: '数量', axisLabel: { color: textColor() }, splitLine: { lineStyle: { color: borderColor() } } },
      { type: 'value', name: '热度指数', axisLabel: { color: textColor() }, splitLine: { show: false } }
    ],
    series: [
      { name: '点击量', type: 'bar', data: clicks, itemStyle: { color: '#1890ff' } },
      { name: '路径规划量', type: 'bar', data: routes, itemStyle: { color: '#52c41a' } },
      { name: '评论量', type: 'bar', data: comments, itemStyle: { color: '#faad14' } },
      { name: '热度指数', type: 'line', yAxisIndex: 1, data: heats, smooth: true, lineStyle: { color: '#ff4d4f', width: 2 }, itemStyle: { color: '#ff4d4f' } }
    ]
  }, true)
}

function makeCompareChart(data) {
  if (!compareInstance) return
  const names = data.map(d => d.greenway_name)
  const clicks = data.map(d => d.click_count)
  const routes = data.map(d => d.route_count)
  const comments = data.map(d => d.comment_count || 0)

  compareInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['点击量', '路径规划量', '评论量'], bottom: 0, textStyle: { color: textColor() } },
    grid: { left: '3%', right: '4%', bottom: '18%', containLabel: true },
    xAxis: { type: 'category', data: names, axisLabel: { color: textColor(), rotate: 35, interval: 0 }, axisLine: { lineStyle: { color: borderColor() } } },
    yAxis: { type: 'value', axisLabel: { color: textColor() }, splitLine: { lineStyle: { color: borderColor() } } },
    series: [
      { name: '点击量', type: 'bar', data: clicks, itemStyle: { color: '#1890ff' } },
      { name: '路径规划量', type: 'bar', data: routes, itemStyle: { color: '#52c41a' } },
      { name: '评论量', type: 'bar', data: comments, itemStyle: { color: '#faad14' } }
    ]
  }, true)
}

function makeCommentRankChart(data) {
  if (!commentRankInstance) return
  const names = data.map(d => d.greenway_name).reverse()
  const values = data.map(d => d.comment_count).reverse()
  commentRankInstance.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c} 条评论' },
    grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '评论数', axisLine: { lineStyle: { color: borderColor() } }, axisLabel: { color: textColor() } },
    yAxis: { type: 'category', data: names, inverse: true, axisLine: { lineStyle: { color: borderColor() } }, axisLabel: { color: textColor() } },
    series: [{
      name: '评论数', type: 'bar', data: values,
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#91d5ff' }, { offset: 1, color: '#1890ff' }]) },
      label: { show: true, position: 'right', formatter: '{c} 条', color: textColor() }
    }]
  }, true)
}

function makeCommentTrendChart(data) {
  if (!commentTrendInstance) return
  const dates = data.map(d => d.date.slice(5, 10))
  const values = data.map(d => d.comment_count)
  commentTrendInstance.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '5%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLabel: { color: textColor(), rotate: 45 }, axisLine: { lineStyle: { color: borderColor() } } },
    yAxis: { type: 'value', name: '评论数', axisLabel: { color: textColor() }, splitLine: { lineStyle: { color: borderColor() } } },
    series: [{
      name: '评论数', type: 'line', smooth: true, data: values,
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(24,144,255,0.3)' }, { offset: 1, color: 'rgba(24,144,255,0)' }]) },
      itemStyle: { color: '#1890ff' }, lineStyle: { color: '#1890ff', width: 2 }
    }]
  }, true)
}

function makeWeightPieChart() {
  if (!weightPieInstance) return
  weightPieInstance.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: textColor() } },
    series: [{
      name: '权重', type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      data: [
        { value: 20, name: '点击量 (0.2)', itemStyle: { color: '#1890ff' } },
        { value: 50, name: '路径规划 (0.5)', itemStyle: { color: '#52c41a' } },
        { value: 30, name: '评论量 (0.3)', itemStyle: { color: '#faad14' } }
      ],
      label: { color: textColor(), formatter: '{b}\n{d}%' }
    }]
  }, true)
}

function handleResize() {
  rankInstance?.resize(); trendInstance?.resize(); compareInstance?.resize()
  commentRankInstance?.resize(); commentTrendInstance?.resize(); weightPieInstance?.resize()
}

async function loadData() {
  try {
    const [ov, rank, trend, comp, cRank, cTrend] = await Promise.all([
      fetchHeatmapOverview(), fetchHeatmapRank(20), fetchHeatmapTrend(90), fetchHeatmapCompare(),
      fetchCommentRank(20), fetchCommentTrend(90)
    ])
    overview.value = ov
    rankData.value = rank
    trendData.value = trend
    compareData.value = comp
    commentRankData.value = cRank
    commentTrendData.value = cTrend

    makeRankChart(rank)
    makeTrendChart(trend)
    makeCompareChart(comp)
    makeCommentRankChart(cRank)
    makeCommentTrendChart(cTrend)
    makeWeightPieChart()
  } catch (e) {
    console.error('[热度管理] 加载数据失败:', e)
  }
}

onMounted(async () => {
  await loadData()

  const init = (refEl) => { if (refEl.value) return echarts.init(refEl.value); return null }
  rankInstance = init(rankChart)
  trendInstance = init(trendChart)
  compareInstance = init(compareChart)
  commentRankInstance = init(commentRankChart)
  commentTrendInstance = init(commentTrendChart)
  weightPieInstance = init(weightPieChart)

  makeRankChart(rankData.value)
  makeTrendChart(trendData.value)
  makeCompareChart(compareData.value)
  makeCommentRankChart(commentRankData.value)
  makeCommentTrendChart(commentTrendData.value)
  makeWeightPieChart()

  window.addEventListener('resize', handleResize)
})

watch(globalTheme, () => {
  if (rankData.value.length) makeRankChart(rankData.value)
  if (trendData.value.length) makeTrendChart(trendData.value)
  if (compareData.value.length) makeCompareChart(compareData.value)
  if (commentRankData.value.length) makeCommentRankChart(commentRankData.value)
  if (commentTrendData.value.length) makeCommentTrendChart(commentTrendData.value)
  makeWeightPieChart()
})

onBeforeUnmount(() => {
  rankInstance?.dispose(); trendInstance?.dispose(); compareInstance?.dispose()
  commentRankInstance?.dispose(); commentTrendInstance?.dispose(); weightPieInstance?.dispose()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.heat-admin { max-width: 1400px; margin: 0 auto; }

.page-header { margin-bottom: 24px; }
.page-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0 0 4px; }
.page-subtitle { font-size: 0.8rem; color: #6b7280; }

.stats-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: #fff; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; }
.stat-body { flex: 1; }
.stat-value { font-size: 1.8rem; font-weight: 700; color: #111827; }
.stat-value.small { font-size: 1rem; }
.stat-label { font-size: 0.8rem; color: #6b7280; margin-top: 2px; }

.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.chart-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.chart-title { font-size: 1rem; font-weight: 600; color: #111827; margin: 0 0 16px; }
.chart-body { width: 100%; height: 360px; }

.table-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 24px; }
.table-wrap { overflow-x: auto; }
.heat-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.heat-table th { text-align: left; padding: 12px 16px; background: #f9fafb; color: #6b7280; font-weight: 600; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
.heat-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; white-space: nowrap; }
.heat-table tbody tr:hover { background: #f9fafb; }
.heat-bar { width: 100px; height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
.heat-bar-inner { height: 100%; border-radius: 4px; background: linear-gradient(to right, #52c41a, #faad14, #ff4d4f); transition: width 0.4s ease; }

@media (max-width: 1200px) { .stats-cards { grid-template-columns: repeat(2, 1fr); } .charts-row { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .stats-cards { grid-template-columns: 1fr; } }

[data-theme="night"] .page-title { color: #e5e7eb; }
[data-theme="night"] .page-subtitle { color: #9ca3af; }
[data-theme="night"] .stat-card { background: #1a1a1a; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
[data-theme="night"] .stat-value { color: #e5e7eb; }
[data-theme="night"] .stat-label { color: #9ca3af; }
[data-theme="night"] .chart-card { background: #1a1a1a; }
[data-theme="night"] .chart-title { color: #e5e7eb; }
[data-theme="night"] .table-card { background: #1a1a1a; }
[data-theme="night"] .heat-table th { background: #252525; color: #9ca3af; border-bottom-color: #333; }
[data-theme="night"] .heat-table td { color: #d1d5db; border-bottom-color: #252525; }
[data-theme="night"] .heat-table tbody tr:hover { background: #252525; }
[data-theme="night"] .heat-bar { background: #333; }
</style>
