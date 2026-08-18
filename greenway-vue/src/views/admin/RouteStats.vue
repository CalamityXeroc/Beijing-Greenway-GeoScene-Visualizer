<template>
  <div class="route-stats-page">
    <div class="page-header">
      <h2 class="page-title">路径规划统计</h2>
      <span class="page-subtitle">用户路径规划行为数据分析</span>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(33,150,243,.12);color:#2196F3">
          <i class="fas fa-route"></i>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.total_plans || 0 }}</div>
          <div class="stat-label">总规划次数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(76,175,80,.12);color:#4CAF50">
          <i class="fas fa-leaf"></i>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.greenway_related || 0 }}</div>
          <div class="stat-label">绿道相关</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(255,152,0,.12);color:#FF9800">
          <i class="fas fa-calendar-day"></i>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.today_plans || 0 }}</div>
          <div class="stat-label">今日规划</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(156,39,176,.12);color:#9C27B0">
          <i class="fas fa-users"></i>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ overview.total_users || 0 }}</div>
          <div class="stat-label">使用用户</div>
        </div>
      </div>
    </div>

    <!-- 图表区 -->
    <div class="charts-row">
      <div class="chart-card chart-card--wide">
        <div class="chart-title">路径规划趋势（近7天）</div>
        <div ref="trendChart" class="chart-box"></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">出行方式分布</div>
        <div ref="modeChart" class="chart-box"></div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card chart-card--full">
        <div class="chart-title">绿道热度排行榜（近30天）</div>
        <div ref="rankChart" class="chart-box chart-box--bar"></div>
      </div>
    </div>

    <!-- 记录列表 -->
    <div class="records-section">
      <div class="chart-title">近期规划记录</div>
      <div class="records-table-wrap">
        <table class="records-table">
          <thead>
            <tr>
              <th>时间</th><th>用户</th><th>起点</th><th>终点</th><th>方式</th><th>绿道相关</th><th>距离</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records" :key="r.record_id">
              <td>{{ fmtTime(r.created_at) }}</td>
              <td>{{ r.nickname || r.username || '-' }}</td>
              <td class="addr-cell">{{ r.origin_address || '-' }}</td>
              <td class="addr-cell">{{ r.destination_address || '-' }}</td>
              <td>{{ r.travel_mode === 'walking' ? '步行' : '骑行' }}</td>
              <td>{{ r.is_greenway_related ? r.related_greenways?.join(', ') || '是' : '否' }}</td>
              <td>{{ fmtDist(r.distance) }}</td>
            </tr>
            <tr v-if="records.length === 0">
              <td colspan="7" class="empty-cell">暂无规划记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useGlobalTheme } from '@/utils/useTheme'
import { getRouteOverview, getRouteTrend, getGreenwayRank, getRouteRecords } from '@/services/routeApi.js'
import * as echarts from 'echarts'

const { theme: globalTheme } = useGlobalTheme()

// 统计概览
const overview = ref({})
const records = ref([])

// 图表 refs
const trendChart = ref(null)
const modeChart = ref(null)
const rankChart = ref(null)

let trendInstance = null
let modeInstance = null
let rankInstance = null

function fmtTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit' })
}
function fmtDist(m) {
  if (!m || m < 1000) return (m||0) + 'm'
  return (m/1000).toFixed(1) + 'km'
}

const isNight = () => globalTheme.value === 'night'

function makeTrendChart(data) {
  if (!trendChart.value) return
  if (!trendInstance) trendInstance = echarts.init(trendChart.value)
  const dark = isNight()
  trendInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['总规划','绿道相关','非绿道'], bottom: 0,
      textStyle: { color: dark ? '#aaa' : '#555' } },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '8%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false,
      data: (data||[]).map(d => d.date?.slice(5) || ''),
      axisLabel: { color: dark ? '#888' : '#666' } },
    yAxis: { type: 'value',
      axisLabel: { color: dark ? '#888' : '#666' },
      splitLine: { lineStyle: { color: dark ? '#333' : '#eee' } } },
    series: [
      { name: '总规划', type: 'line', smooth: true, data: (data||[]).map(d => d.total || 0),
        itemStyle: { color: '#2196F3' } },
      { name: '绿道相关', type: 'line', smooth: true, data: (data||[]).map(d => d.greenway_related || 0),
        itemStyle: { color: '#4CAF50' } },
      { name: '非绿道', type: 'line', smooth: true, data: (data||[]).map(d => d.non_greenway || 0),
        itemStyle: { color: '#FF9800' } }
    ],
    backgroundColor: 'transparent'
  })
}

function makeModeChart(ov) {
  if (!modeChart.value) return
  if (!modeInstance) modeInstance = echarts.init(modeChart.value)
  const dark = isNight()
  modeInstance.setOption({
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 0, top: 'center',
      textStyle: { color: dark ? '#aaa' : '#555' } },
    series: [{
      type: 'pie', radius: ['45%','70%'], center: ['55%','50%'],
      label: { color: dark ? '#aaa' : '#555' },
      data: [
        { value: ov?.walking || 0, name: '步行', itemStyle: { color: '#2196F3' } },
        { value: ov?.bicycling || 0, name: '骑行', itemStyle: { color: '#4CAF50' } }
      ]
    }],
    backgroundColor: 'transparent'
  })
}

function makeRankChart(data) {
  if (!rankChart.value) return
  if (!rankInstance) rankInstance = echarts.init(rankChart.value)
  const dark = isNight()
  const names = (data||[]).map(d => d.greenway_name).reverse()
  const counts = (data||[]).map(d => parseInt(d.count)).reverse()
  rankInstance.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
    xAxis: { type: 'value',
      axisLabel: { color: dark ? '#888' : '#666' },
      splitLine: { lineStyle: { color: dark ? '#333' : '#eee' } } },
    yAxis: { type: 'category', data: names,
      axisLabel: { color: dark ? '#aaa' : '#666', width: 100, overflow: 'truncate' } },
    series: [{
      type: 'bar', data: counts,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0,0,1,0,[
          { offset: 0, color: '#4CAF50' },{ offset: 1, color: '#95de64' }
        ])
      },
      label: { show: true, position: 'right', color: dark ? '#aaa' : '#555' }
    }],
    backgroundColor: 'transparent'
  })
}

async function loadData() {
  try {
    const [ov, trend, rank, recs] = await Promise.all([
      getRouteOverview(), getRouteTrend(), getGreenwayRank(15, 30),
      getRouteRecords(1, 10)
    ])
    overview.value = ov || {}
    records.value = recs?.records || []
    makeTrendChart(trend)
    makeModeChart(ov)
    makeRankChart(rank)
  } catch (e) {
    console.error('[RouteStats] 加载失败:', e.message)
  }
}

onMounted(() => { loadData() })

// 主题切换时更新 ECharts
const stopWatch = () => {}
const themeWatcher = computed(() => globalTheme.value)
import { watch, computed } from 'vue'
watch(themeWatcher, () => {
  if (trendInstance) makeTrendChart(null) // reuse last data via overview/trend
  if (modeInstance) makeModeChart(overview.value)
  if (rankInstance) makeRankChart(null)
  loadData() // re-fetch with new theme
})

onBeforeUnmount(() => {
  trendInstance?.dispose()
  modeInstance?.dispose()
  rankInstance?.dispose()
})

function handleResize() {
  trendInstance?.resize()
  modeInstance?.resize()
  rankInstance?.resize()
}
onMounted(() => window.addEventListener('resize', handleResize))
onBeforeUnmount(() => window.removeEventListener('resize', handleResize))
</script>

<style scoped>
.route-stats-page { padding: 24px; max-width: 1400px; margin: 0 auto; }

.page-header { margin-bottom: 24px; }
.page-title { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
.page-subtitle { font-size: 0.85rem; color: var(--text-secondary); }

.stats-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card {
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px;
}
.stat-icon {
  width: 48px; height: 48px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;
}
.stat-value { font-size: 1.8rem; font-weight: 800; color: var(--text-primary); line-height: 1.1; }
.stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; }

.charts-row { display: flex; gap: 16px; margin-bottom: 24px; }
.chart-card {
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: 12px; padding: 20px; flex: 1;
}
.chart-card--wide { flex: 1.5; }
.chart-card--full { flex: 1; }
.chart-title { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; }
.chart-box { height: 280px; }
.chart-box--bar { height: 420px; }

.records-section { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; }
.records-table-wrap { overflow-x: auto; }
.records-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.records-table th { text-align: left; padding: 10px 12px; color: var(--text-secondary); font-weight: 600; border-bottom: 2px solid var(--border-color); white-space: nowrap; }
.records-table td { padding: 10px 12px; color: var(--text-primary); border-bottom: 1px solid var(--border-color); }
.addr-cell { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-cell { text-align: center; color: var(--text-tertiary); padding: 32px; }

@media (max-width: 900px) {
  .stats-cards { grid-template-columns: repeat(2, 1fr); }
  .charts-row { flex-direction: column; }
}
@media (max-width: 768px) {
  .route-stats-page { padding: 12px; }
  .stats-cards { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat-card { padding: 14px; gap: 10px; }
  .stat-icon { width: 40px; height: 40px; font-size: 1rem; }
  .stat-value { font-size: 1.4rem; }
  .chart-card { padding: 12px; }
  .chart-box { height: 220px; }
  .chart-box--bar { height: 320px; }
  .page-title { font-size: 1.2rem; }
}

/* 夜间模式覆盖 —— 确保使用中性灰黑而非绿色系 */
[data-theme="night"] .page-title { color: #e8e8e8; }
[data-theme="night"] .page-subtitle { color: #9ca3af; }
[data-theme="night"] .stat-card {
  background: #1e1e1e;
  border-color: #333;
}
[data-theme="night"] .stat-value { color: #e8e8e8; }
[data-theme="night"] .stat-label { color: #9ca3af; }
[data-theme="night"] .chart-card {
  background: #1e1e1e;
  border-color: #333;
}
[data-theme="night"] .chart-title { color: #e8e8e8; }
[data-theme="night"] .records-section {
  background: #1e1e1e;
  border-color: #333;
}
[data-theme="night"] .records-table th {
  color: #9ca3af;
  border-bottom-color: #3a3a3a;
}
[data-theme="night"] .records-table td {
  color: #e5e7eb;
  border-bottom-color: #2a2a2a;
}
[data-theme="night"] .empty-cell { color: #6b7280; }
</style>
