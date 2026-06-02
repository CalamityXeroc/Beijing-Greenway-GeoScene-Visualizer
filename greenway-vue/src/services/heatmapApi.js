/**
 * 热度热力图 API 服务
 */

const API_BASE = '';

export async function fetchHeatmapData() {
  const res = await fetch(`${API_BASE}/api/heatmap/data`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || '获取热度数据失败');
  return json.data;
}

export async function recordGreenwayClick(greenwayName, userId) {
  try {
    await fetch(`${API_BASE}/api/heatmap/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        greenway_name: greenwayName,
        user_id: userId || undefined
      })
    });
  } catch (err) {
    console.error('[热力图] 记录点击失败:', err);
  }
}

export async function fetchHeatmapOverview() {
  const token = localStorage.getItem('greenway_admin_token');
  const res = await fetch(`${API_BASE}/api/admin/heatmap/overview`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || '获取概览失败');
  return json.data;
}

export async function fetchHeatmapTrend(days = 30) {
  const token = localStorage.getItem('greenway_admin_token');
  const res = await fetch(`${API_BASE}/api/admin/heatmap/trend?days=${days}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || '获取趋势失败');
  return json.data;
}

export async function fetchHeatmapRank(limit = 10) {
  const token = localStorage.getItem('greenway_admin_token');
  const res = await fetch(`${API_BASE}/api/admin/heatmap/rank?limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || '获取排名失败');
  return json.data;
}

export async function fetchHeatmapCompare() {
  const token = localStorage.getItem('greenway_admin_token');
  const res = await fetch(`${API_BASE}/api/admin/heatmap/compare`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || '获取对比数据失败');
  return json.data;
}
