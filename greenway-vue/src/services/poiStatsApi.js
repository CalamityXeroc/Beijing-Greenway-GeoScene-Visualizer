/**
 * POI 统计 API 服务（管理后台用）
 */
const API_BASE = '';

function token() { return localStorage.getItem('greenway_admin_token') }
function authHeaders() { return { 'Authorization': `Bearer ${token()}` } }

export async function fetchPoiStatsOverview() {
  const res = await fetch(`${API_BASE}/api/admin/poi/stats`, { headers: authHeaders() });
  const json = await res.json();
  if (json.code !== 0 && json.error) throw new Error(json.error);
  return json;
}

export async function fetchPoiClickTrend(days = 30) {
  const res = await fetch(`${API_BASE}/api/admin/poi/click-trend?days=${days}`, { headers: authHeaders() });
  const json = await res.json();
  return json.data || [];
}

export async function fetchPoiTypeClicks() {
  const res = await fetch(`${API_BASE}/api/admin/poi/type-clicks`, { headers: authHeaders() });
  const json = await res.json();
  return json.data || [];
}

export async function fetchTopPois(limit = 10) {
  const res = await fetch(`${API_BASE}/api/admin/poi/top?limit=${limit}`, { headers: authHeaders() });
  const json = await res.json();
  return json.data || [];
}
