import { getApiBaseUrl } from '@/mobile/services/api'

const BASE = `${getApiBaseUrl()}/api/route`

export async function saveRouteRecord(data) {
  const response = await fetch(`${BASE}/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  const result = await response.json()
  if (result.code !== 0) throw new Error(result.message || '保存失败')
  return result.data
}

export async function getGreenwayRank(limit = 10, days = 30) {
  const url = `${BASE}/stats/greenway-rank?limit=${limit}&days=${days}`
  const response = await fetch(url)
  const result = await response.json()
  if (result.code !== 0) throw new Error(result.message)
  return result.data
}

export async function getRouteOverview() {
  const response = await fetch(`${BASE}/stats/overview`)
  const result = await response.json()
  if (result.code !== 0) throw new Error(result.message)
  return result.data
}

export async function getRouteTrend() {
  const response = await fetch(`${BASE}/stats/trend`)
  const result = await response.json()
  if (result.code !== 0) throw new Error(result.message)
  return result.data
}

export async function getRouteRecords(page = 1, pageSize = 20, filters = {}) {
  const params = new URLSearchParams({ page, pageSize, ...filters })
  const response = await fetch(`${BASE}/stats/records?${params}`)
  const result = await response.json()
  if (result.code !== 0) throw new Error(result.message)
  return result.data
}
