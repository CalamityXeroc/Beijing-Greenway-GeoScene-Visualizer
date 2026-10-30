const BASE = '/api/gaode'

/** 统一请求解析：后端或反代异常时给出可读错误，
 *  避免把 "Unexpected token '<'" 这类 JSON 解析异常直接抛到路径规划面板 */
async function requestJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`地图服务暂不可用（HTTP ${response.status}）`)
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('地图服务返回了非 JSON 数据，请稍后重试')
  }
}

export async function searchAddress(keywords, city = '北京') {
  const url = `${BASE}/search?keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}`
  const data = await requestJson(url)
  if (data.status !== '1') throw new Error(data.info || '搜索失败')
  // location 缺失时 split 会抛 TypeError，导致整批搜索结果全丢，这里做过滤
  return (data.pois || [])
    .filter((p) => typeof p.location === 'string' && p.location.includes(','))
    .map((p) => {
      const [lng, lat] = p.location.split(',')
      return { name: p.name, address: p.address || '', lng: parseFloat(lng), lat: parseFloat(lat) }
    })
    .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat))
}

export async function walkingRoute(origin, destination, waypoints = []) {
  let url = `${BASE}/walking?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`
  if (waypoints.length > 0) {
    url += '&waypoints=' + waypoints.map(w => `${w.lng},${w.lat}`).join(';')
  }
  const data = await requestJson(url)
  if (data.status !== '1') throw new Error(data.info || '路径规划失败')
  return data.route
}

export async function bicyclingRoute(origin, destination, waypoints = []) {
  let url = `${BASE}/bicycling?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`
  if (waypoints.length > 0) {
    url += '&waypoints=' + waypoints.map(w => `${w.lng},${w.lat}`).join(';')
  }
  const data = await requestJson(url)
  if (data.errcode && data.errcode !== 0) throw new Error(data.errmsg || '骑行路径规划失败')
  // 骑行 v4 API: data.data 本身就是 route（含 origin/destination/paths）
  return data.data
}

export async function reverseGeocode(lng, lat) {
  const url = `${BASE}/regeocode?location=${lng},${lat}`
  const data = await requestJson(url)
  if (data.status !== '1') throw new Error(data.info || '逆地理编码失败')
  return data.regeocode?.formatted_address || '未知地址'
}
