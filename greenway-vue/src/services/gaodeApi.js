const BASE = '/api/gaode'

export async function searchAddress(keywords, city = '北京') {
  const url = `${BASE}/search?keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}`
  const response = await fetch(url)
  const data = await response.json()
  if (data.status !== '1') throw new Error(data.info || '搜索失败')
  return (data.pois || []).map(p => ({
    name: p.name,
    address: p.address || '',
    lng: parseFloat(p.location.split(',')[0]),
    lat: parseFloat(p.location.split(',')[1])
  }))
}

export async function walkingRoute(origin, destination, waypoints = []) {
  let url = `${BASE}/walking?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`
  if (waypoints.length > 0) {
    url += '&waypoints=' + waypoints.map(w => `${w.lng},${w.lat}`).join(';')
  }
  const response = await fetch(url)
  const data = await response.json()
  if (data.status !== '1') throw new Error(data.info || '路径规划失败')
  return data.route
}

export async function bicyclingRoute(origin, destination, waypoints = []) {
  let url = `${BASE}/bicycling?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`
  if (waypoints.length > 0) {
    url += '&waypoints=' + waypoints.map(w => `${w.lng},${w.lat}`).join(';')
  }
  const response = await fetch(url)
  const data = await response.json()
  if (data.errcode && data.errcode !== 0) throw new Error(data.errmsg || '骑行路径规划失败')
  // 骑行 v4 API: data.data 本身就是 route（含 origin/destination/paths）
  return data.data
}

export async function reverseGeocode(lng, lat) {
  const url = `${BASE}/regeocode?location=${lng},${lat}`
  const response = await fetch(url)
  const data = await response.json()
  if (data.status !== '1') throw new Error(data.info || '逆地理编码失败')
  return data.regeocode?.formatted_address || '未知地址'
}
