<template>
  <div class="feedback-admin-page">
    <div class="page-header">
      <h1 class="page-title">反馈管理</h1>
      <p class="page-desc">查看并处理来自 Web 端与 App 端的用户反馈</p>
    </div>

    <!-- 统计卡 -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card">
        <div class="stat-num">{{ stats.total }}</div>
        <div class="stat-lbl">反馈总数</div>
      </div>
      <div class="stat-card warn">
        <div class="stat-num">{{ stats.pending }}</div>
        <div class="stat-lbl">待处理</div>
      </div>
      <div class="stat-card web">
        <div class="stat-num">{{ stats.web }}</div>
        <div class="stat-lbl">来自 Web 端</div>
      </div>
      <div class="stat-card app">
        <div class="stat-num">{{ stats.app }}</div>
        <div class="stat-lbl">来自 App 端</div>
      </div>
    </div>

    <!-- 筛选工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <input v-model.trim="query.keyword" class="ipt" placeholder="按内容/联系方式/用户搜索" @input="debouncedLoad" />
        <select v-model="query.source" class="sel" @change="loadList">
          <option value="">全部来源</option>
          <option value="web">Web 端</option>
          <option value="app">App 端</option>
        </select>
        <select v-model="query.status" class="sel" @change="loadList">
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="processing">处理中</option>
          <option value="resolved">已解决</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button type="button" class="btn" @click="refreshAll">刷新</button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="table-wrap">
      <div v-if="loading" class="table-loading">加载中...</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th style="width:60px;">ID</th>
            <th style="width:80px;">来源</th>
            <th>反馈内容</th>
            <th style="width:110px;">用户</th>
            <th style="width:130px;">联系方式</th>
            <th style="width:150px;">提交时间</th>
            <th style="width:90px;">状态</th>
            <th style="width:200px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in list" :key="item.id">
            <td class="cell-id">#{{ item.id }}</td>
            <td>
              <span class="source-tag" :class="item.source">{{ item.source_label }}</span>
            </td>
            <td class="cell-content">
              <span class="content-text" :class="{ expanded: expandedIds.has(item.id) }">{{ item.content }}</span>
              <button v-if="item.content.length > 60" class="expand-btn" @click="toggleExpand(item.id)">
                {{ expandedIds.has(item.id) ? '收起' : '展开' }}
              </button>
            </td>
            <td class="cell-user">{{ item.username || '游客' }}</td>
            <td class="cell-contact">{{ item.contact || '—' }}</td>
            <td class="cell-time">{{ fmtTime(item.created_at) }}</td>
            <td>
              <span class="status-tag" :class="item.status">{{ item.status_label }}</span>
            </td>
            <td class="cell-actions">
              <button v-if="item.status !== 'processing'" class="mini-btn" @click="updateStatus(item, 'processing')">标记处理中</button>
              <button v-if="item.status !== 'resolved'" class="mini-btn ok" @click="updateStatus(item, 'resolved')">标记已解决</button>
              <button v-if="item.status !== 'pending'" class="mini-btn" @click="updateStatus(item, 'pending')">待处理</button>
            </td>
          </tr>
          <tr v-if="!list.length">
            <td colspan="8" class="empty-cell">暂无反馈记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="total > pageSize">
      <button class="page-btn" :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useAdminAuth } from '@/stores/adminAuth'

const { apiFetch } = useAdminAuth()

const stats = ref(null)
const list = ref([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const expandedIds = ref(new Set())

const query = reactive({ keyword: '', source: '', status: '' })

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { page.value = 1; loadList() }, 400)
}

async function loadStats() {
  try {
    const res = await apiFetch('/api/admin/feedback/stats')
    stats.value = res.data || null
  } catch (e) {
    console.warn('[反馈] 统计加载失败:', e.message)
  }
}

async function loadList() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize),
      ...(query.keyword ? { keyword: query.keyword } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.status ? { status: query.status } : {})
    })
    const res = await apiFetch(`/api/admin/feedback?${params}`)
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {
    console.warn('[反馈] 列表加载失败:', e.message)
  } finally {
    loading.value = false
  }
}

async function updateStatus(item, status) {
  try {
    const res = await apiFetch(`/api/admin/feedback/${item.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
    if (res.code === 200) {
      item.status = status
      item.status_label = { pending: '待处理', processing: '处理中', resolved: '已解决' }[status]
      loadStats()
    }
  } catch (e) {
    alert('操作失败：' + (e.message || '未知错误'))
  }
}

function toggleExpand(id) {
  const s = new Set(expandedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedIds.value = s
}

function changePage(p) {
  page.value = p
  loadList()
}

function fmtTime(t) {
  if (!t) return '-'
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function refreshAll() {
  loadStats()
  loadList()
}

onMounted(() => {
  refreshAll()
})
</script>

<style scoped>
.feedback-admin-page { padding: 24px; min-height: 100%; background: #f0f2f5; color: #111827; transition: background .3s, color .3s; }

.page-header { margin-bottom: 20px; }
.page-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0 0 4px; }
.page-desc { font-size: 0.85rem; color: #6b7280; margin: 0; }

/* 统计卡 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
  transition: background .3s, border-color .3s;
}
.stat-num { font-size: 1.8rem; font-weight: 700; color: #111827; }
.stat-card.warn .stat-num { color: #f59e0b; }
.stat-card.web .stat-num { color: #2563eb; }
.stat-card.app .stat-num { color: #7c3aed; }
.stat-lbl { font-size: 0.8rem; color: #6b7280; margin-top: 4px; }

/* 工具栏 */
.toolbar { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.toolbar-left { display: flex; gap: 8px; flex-wrap: wrap; }
.ipt {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 0.85rem;
  width: 240px;
  box-sizing: border-box;
}
.sel {
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 0.85rem;
}
.btn {
  padding: 8px 18px;
  border: 1px solid #2E7D32;
  border-radius: 8px;
  background: #2E7D32;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background .2s;
}
.btn:hover { background: #256a28; }

/* 表格 */
.table-wrap {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.table-loading { padding: 40px; text-align: center; color: #6b7280; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.data-table th {
  background: #f9fafb;
  color: #6b7280;
  font-weight: 600;
  text-align: left;
  padding: 11px 14px;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
  color: #374151;
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tbody tr:hover { background: #fafafa; }

.cell-id { color: #9ca3af; font-variant-numeric: tabular-nums; }
.source-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 600;
}
.source-tag.web { background: #dbeafe; color: #1d4ed8; }
.source-tag.app { background: #ede9fe; color: #6d28d9; }

.cell-content { max-width: 380px; }
.content-text {
  display: block;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  max-height: 40px;
  overflow: hidden;
}
.content-text.expanded { max-height: none; }
.expand-btn {
  border: none;
  background: none;
  color: #2E7D32;
  font-size: 0.78rem;
  cursor: pointer;
  padding: 2px 0;
  margin-top: 2px;
}
.expand-btn:hover { text-decoration: underline; }

.cell-user, .cell-contact, .cell-time { white-space: nowrap; font-size: 0.82rem; color: #6b7280; }

.status-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 600;
}
.status-tag.pending { background: #fef3c7; color: #b45309; }
.status-tag.processing { background: #dbeafe; color: #1d4ed8; }
.status-tag.resolved { background: #d1fae5; color: #047857; }

.cell-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.mini-btn {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #4b5563;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all .2s;
  white-space: nowrap;
}
.mini-btn:hover { border-color: #2E7D32; color: #2E7D32; }
.mini-btn.ok { border-color: #86efac; color: #15803d; background: #f0fdf4; }
.mini-btn.ok:hover { background: #dcfce7; }

.empty-cell { text-align: center; padding: 40px; color: #9ca3af; }

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
}
.page-btn {
  padding: 6px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 0.85rem;
  cursor: pointer;
}
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 0.85rem; color: #6b7280; }

/* 夜间模式 */
[data-theme="night"] .feedback-admin-page { background: #0f0f0f; color: #e5e7eb; }
[data-theme="night"] .page-title { color: #e8e8e8; }
[data-theme="night"] .page-desc { color: #9ca3af; }
[data-theme="night"] .stat-card { background: #1e1e1e; border-color: #333; box-shadow: none; }
[data-theme="night"] .stat-num { color: #e8e8e8; }
[data-theme="night"] .stat-lbl { color: #9ca3af; }
[data-theme="night"] .ipt, [data-theme="night"] .sel { background: #252525; border-color: #3a3a3a; color: #e5e7eb; }
[data-theme="night"] .table-wrap { background: #1e1e1e; border-color: #333; box-shadow: none; }
[data-theme="night"] .data-table th { background: #252525; color: #9ca3af; border-bottom-color: #333; }
[data-theme="night"] .data-table td { border-bottom-color: #2a2a2a; color: #d1d5db; }
[data-theme="night"] .data-table tbody tr:hover { background: #252525; }
[data-theme="night"] .cell-id { color: #6b7280; }
[data-theme="night"] .cell-user, [data-theme="night"] .cell-contact, [data-theme="night"] .cell-time { color: #9ca3af; }
[data-theme="night"] .mini-btn { background: #252525; border-color: #3a3a3a; color: #9ca3af; }
[data-theme="night"] .mini-btn.ok { background: #1a2e1a; border-color: #2d4a2d; color: #81C784; }
[data-theme="night"] .page-btn { background: #252525; border-color: #3a3a3a; color: #d1d5db; }
[data-theme="night"] .page-info { color: #9ca3af; }
</style>
