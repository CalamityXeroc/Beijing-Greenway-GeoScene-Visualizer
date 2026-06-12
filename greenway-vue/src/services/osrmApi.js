const BASE = '/api/osrm'

/**
 * 步行路径规划（替换高德 walkingRoute）
 */
export async function walkingRoute(origin, destination, waypoints = []) {
  return routeRequest(origin, destination, waypoints, 'walking')
}

/**
 * 骑行路径规划（替换高德 bicyclingRoute）
 */
export async function bicyclingRoute(origin, destination, waypoints = []) {
  return routeRequest(origin, destination, waypoints, 'bicycling')
}

async function routeRequest(origin, destination, waypoints, mode) {
  const body = {
    origin: { lng: origin.lng, lat: origin.lat },
    destination: { lng: destination.lng, lat: destination.lat },
    mode
  }
  if (waypoints && waypoints.length > 0) {
    body.waypoints = waypoints.map(w => ({ lng: w.lng, lat: w.lat }))
  }

  const response = await fetch(`${BASE}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `路径规划失败 (${response.status})`)
  }

  const data = await response.json()
  // 返回格式已与高德兼容: { origin, destination, paths: [{ distance, duration, coordinates, steps }] }
  return data
}
