/**
 * 移动端 API 工具
 * 兼容 Capacitor AVD 环境（10.0.2.2:3001）和普通开发环境
 */

export const getApiBaseUrl = () => {
  // Capacitor 原生环境（模拟器/真机 App）
  const isCapacitor = typeof window !== 'undefined' &&
    (window.Capacitor?.isNativePlatform?.() ||
     window.location.protocol === 'capacitor:' ||
     (window.location.protocol === 'http:' && window.location.hostname === 'localhost' && !import.meta.env.DEV))

  if (isCapacitor) {
    // 1. 构建时注入的后端地址优先（真机打包：VITE_API_BASE_URL，在 vite build 时写入）
    const configured = import.meta.env.VITE_API_BASE_URL
    if (configured && configured.trim()) {
      console.log('[API] 使用配置的后端地址:', configured)
      return configured.trim()
    }
    // 2. 模拟器默认：10.0.2.2 指向宿主机
    console.log('[API] Capacitor模式，使用后端地址: http://10.0.2.2:3001')
    return 'http://10.0.2.2:3001'
  }

  // 3. Web 浏览器（桌面/移动 Web）：相对路径，走 Vite 代理到本地后端
  console.log('[API] Web开发模式，使用相对路径')
  return ''
}

/**
 * 获取绿道数据
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export const fetchGreenways = async () => {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}/api/greenways`
  console.log('[API] 请求绿道列表:', url)
  
  try {
    const res = await fetch(url)
    console.log('[API] 绿道列表响应状态:', res.status)
    
    if (!res.ok) {
      const errorText = await res.text()
      console.error('[API] 绿道列表请求失败:', res.status, errorText)
      throw new Error(`API ${res.status}: ${url}`)
    }
    
    const data = await res.json()
    console.log('[API] 绿道列表数据加载成功，数量:', data?.features?.length || 0)
    return data
  } catch (error) {
    console.error('[API] 绿道列表请求异常:', error)
    throw error
  }
}

/**
 * 获取指定绿道详情（按 ID，单条查询）
 * @param {number|string} id 绿道 ID
 * @returns {Promise<Object>} { status, data: { id,name,description,...,geometry,color,image,points_of_interest } }
 */
export const fetchGreenwayById = async (id) => {
  const res = await fetch(buildUrl(`/api/greenways/${encodeURIComponent(id)}`))
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.status === 'error') {
    throw new Error(data.message || `HTTP ${res.status}`)
  }
  return data
}

/**
 * 获取全城绿道体检评估数据（与 Web 端绿道体检一致）
 * @returns {Promise<{items: Array, avgDims: Object, total: number}>}
 * items[i] = { name, score, grade, rank, dims, profile, lenKm, heatRank, heat, metro, highlights, weakPoints, lng, lat }
 */
export const fetchGreenwayAssess = async () => {
  const res = await fetch(buildUrl('/api/greenways/assess'))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data
}

/**
 * 获取社区公开统计（动态总数/今日动态/用户数/绿道数）
 * @returns {Promise<{totalComments:number,todayComments:number,totalUsers:number,totalGreenways:number}>}
 */
export const fetchCommunityStats = async () => {
  const res = await fetch(buildUrl('/api/community/stats'))
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.code !== 200) {
    throw new Error(data.message || `HTTP ${res.status}`)
  }
  return data.data
}

/**
 * 绿道智能推荐（与 Web 端 RecommendPanel 同一接口）
 * @param {{mode:'walking'|'bicycling', interests:string[], needs:string[], topN?:number}} prefs
 * @returns {Promise<{items:Array, mode:string, interests:Array, needs:Array}>}
 */
export const fetchRecommend = async (prefs) => {
  const res = await fetch(buildUrl('/api/greenways/recommend'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: prefs.mode || 'walking',
      interests: prefs.interests && prefs.interests.length ? prefs.interests : ['balanced'],
      needs: prefs.needs || [],
      topN: prefs.topN || 3
    })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error || `推荐失败 (${res.status})`)
  }
  return data
}

/**
 * 获取指定绿道详情
 * @param {string} name 绿道名称
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export const fetchGreenwayByName = async (name) => {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}/api/greenways?name=${encodeURIComponent(name)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`)
  return res.json()
}

/**
 * 检查后端健康状态
 * @returns {Promise<boolean>}
 */
export const checkBackendHealth = async () => {
  try {
    const baseUrl = getApiBaseUrl()
    const url = `${baseUrl}/health`
    const res = await fetch(url, { method: 'GET', timeout: 5000 })
    return res.ok
  } catch {
    return false
  }
}

function buildUrl(path) {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}${path}`
}

async function readJson(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`)
  }
  return data
}

export const fetchCommentsByGreenway = async (greenwayId, options = {}) => {
  const {
    sort = 'newest',
    page = 1,
    pageSize = 20,
    token = null
  } = options

  const params = new URLSearchParams({
    greenwayId: String(greenwayId),
    sort,
    page: String(page),
    pageSize: String(pageSize)
  })

  const res = await fetch(buildUrl(`/api/comments?${params.toString()}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  })

  return readJson(res)
}

export const createComment = async (payload, token) => {
  const res = await fetch(buildUrl('/api/comments'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  })

  return readJson(res)
}

export const deleteComment = async (commentId, token) => {
  const res = await fetch(buildUrl(`/api/comments/${commentId}`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return readJson(res)
}

export const likeComment = async (commentId, token) => {
  const res = await fetch(buildUrl(`/api/comments/${commentId}/like`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return readJson(res)
}

export const unlikeComment = async (commentId, token) => {
  const res = await fetch(buildUrl(`/api/comments/${commentId}/like`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return readJson(res)
}

export const fetchMyComments = async (token, page = 1, pageSize = 10) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  })

  const res = await fetch(buildUrl(`/api/comments/me?${params.toString()}`), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  return readJson(res)
}

export const reportComment = async (commentId, payload, token) => {
  const res = await fetch(buildUrl(`/api/comments/${commentId}/report`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload || {})
  })

  return readJson(res)
}

/**
 * 获取最近评论（用于发现页动态流）
 * @param {number} limit 限制条数
 * @returns {Promise<Object>}
 */
export const fetchRecentComments = async (limit = 10) => {
  const params = new URLSearchParams({
    page: '1',
    pageSize: String(limit),
    status: 'visible'
  })
  const res = await fetch(buildUrl(`/api/comments/recent?${params.toString()}`))
  return readJson(res)
}

// ========== 管理员API（移动端） ==========

/**
 * 管理员API请求封装
 */
const adminFetch = async (path, options = {}, token) => {
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  })
  return readJson(res)
}

/**
 * 获取用户列表（管理员）
 */
export const fetchAdminUsers = async (params, token) => {
  const q = new URLSearchParams(params)
  return adminFetch(`/api/admin/users?${q}`, {}, token)
}

/**
 * 更新用户状态（管理员）
 */
export const updateUserStatus = async (userId, status, token) => {
  return adminFetch(`/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }, token)
}

/**
 * 更新用户信息（管理员）
 */
export const updateUser = async (userId, data, token) => {
  return adminFetch(`/api/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }, token)
}

/**
 * 删除用户（管理员）
 */
export const deleteUser = async (userId, token) => {
  return adminFetch(`/api/admin/users/${userId}`, {
    method: 'DELETE'
  }, token)
}

/**
 * 获取评论列表（管理员）
 */
export const fetchAdminComments = async (params, token) => {
  const q = new URLSearchParams(params)
  return adminFetch(`/api/admin/comments?${q}`, {}, token)
}

/**
 * 更新评论状态（管理员）
 */
export const updateCommentStatus = async (commentId, status, token) => {
  return adminFetch(`/api/admin/comments/${commentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }, token)
}

/**
 * 批量更新评论状态（管理员）
 */
export const batchUpdateCommentStatus = async (ids, status, token) => {
  return adminFetch('/api/admin/comments/batch/status', {
    method: 'PATCH',
    body: JSON.stringify({ ids, status })
  }, token)
}

/**
 * 永久删除评论（管理员）
 */
export const deleteCommentPermanent = async (commentId, token) => {
  return adminFetch(`/api/admin/comments/${commentId}/permanent-delete`, {
    method: 'POST'
  }, token)
}

/**
 * 批量永久删除评论（管理员）
 */
export const batchDeleteCommentsPermanent = async (ids, token) => {
  return adminFetch('/api/admin/comments/batch/permanent-delete', {
    method: 'POST',
    body: JSON.stringify({ ids })
  }, token)
}

/**
 * 获取评论统计（管理员）
 */
export const fetchCommentStats = async (days, token) => {
  return adminFetch(`/api/admin/comments/stats?days=${days}`, {}, token)
}

/**
 * 获取仪表盘数据（管理员）
 */
export const fetchDashboardStats = async (token) => {
  return adminFetch('/api/admin/dashboard/stats', {}, token)
}

// ========== 用户认证 API ==========

/**
 * 用户登录
 */
export const loginUser = async (username, password) => {
  const res = await fetch(buildUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  return readJson(res)
}

/**
 * 用户注册
 */
export const registerUser = async (data) => {
  const res = await fetch(buildUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return readJson(res)
}

/* ============ POI 设施 ============ */

/**
 * 获取全部 POI 设施 GeoJSON（地图叠加用）
 * @returns {Promise<Object>} FeatureCollection，properties: id,name,poi_type,type_name,color,greenway_id,greenway_name,address
 */
export const fetchPoiFacilities = async () => {
  const res = await fetch(buildUrl('/api/facilities/geojson'))
  return readJson(res)
}

/**
 * 搜索 POI 设施（支持关键词 q 或类型 code 精确过滤）
 * @param {{q?: string, type?: string}} params
 * @returns {Promise<Array>} [{id,name,poi_type,type_name,color,address,lng,lat,greenway_name}]
 */
export const searchPoi = async ({ q, type } = {}) => {
  const query = new URLSearchParams()
  if (q && q.trim()) query.set('q', q.trim())
  if (type) query.set('type', type)
  if (!query.size) return []
  const res = await fetch(buildUrl(`/api/poi/search?${query}`))
  const data = await readJson(res)
  return data.results || []
}

/**
 * 获取 POI 类型定义
 * @returns {Promise<Array>} [{code,name,icon,color}]
 */
export const fetchPoiTypes = async () => {
  const res = await fetch(buildUrl('/api/poi-types'))
  const data = await readJson(res)
  return data.data || data || []
}

/* =====================================================================
   AI 绿道助手
   ===================================================================== */
/**
 * 发送消息给 AI，获取回复（基于后端 /api/ai/chat，DeepSeek）
 * @param {string} message 用户消息
 * @param {string} conversationId 会话ID（用于服务端维持上下文）
 * @returns {Promise<{reply: string, conversationId: string}>}
 */
export const aiChat = async (message, conversationId) => {
  const res = await fetch(buildUrl('/api/ai/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return { reply: data.reply, conversationId: data.conversationId }
}

/** 清除服务端对话历史（不阻塞、失败静默） */
export const clearAiContext = (conversationId) => {
  if (!conversationId) return Promise.resolve()
  return fetch(buildUrl(`/api/ai/context/${conversationId}`), { method: 'DELETE' })
    .catch(() => {})
}

/* =====================================================================
   路径规划（Dijkstra / OSM 路网）
   ===================================================================== */
/**
 * 路径规划
 * @param {{lng:number,lat:number}} origin 起点
 * @param {{lng:number,lat:number}} destination 终点
 * @param {'walking'|'bicycling'} mode 出行方式
 * @returns {Promise<Object>} { origin, destination, paths: [{ distance, duration, coordinates, steps }] }
 */
export const planRoute = async (origin, destination, mode = 'walking') => {
  const res = await fetch(buildUrl('/api/osrm/route'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, mode })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `路径规划失败 (${res.status})`)
  }
  return data
}

/* =====================================================================
   空间分析（绘制多边形筛选区域内绿道/设施）
   ===================================================================== */
/**
 * 空间分析：绘制多边形，返回区域内命中的绿道与设施
 * @param {Object} polygon GeoJSON Polygon（坐标 4326）
 * @returns {Promise<Object>} { code, data: { greenways, pois, summary } }
 */
export const spatialAnalyze = async (polygon) => {
  const res = await fetch(buildUrl('/api/spatial/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.code !== 0) {
    throw new Error(data.message || `空间分析失败 (${res.status})`)
  }
  return data
}

/* =====================================================================
   实时天气（高德天气 API）
   ===================================================================== */
/**
 * 按经纬度查询实时天气（高德 regeo 取 adcode → 天气查询）
 * @param {number} lng 经度（WGS84/GCJ02 均可，高德兼容）
 * @param {number} lat 纬度
 * @returns {Promise<Object>} { temperature, weather, winddirection, windpower, humidity, city, reporttime }
 */
export const fetchWeather = async (lng, lat) => {
  const apiKey = import.meta.env.VITE_AMAP_KEY
  if (!apiKey) throw new Error('天气服务未配置（缺少 VITE_AMAP_KEY）')

  // 1. 逆地理编码取 adcode（行政区划代码）
  const geoUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${lng},${lat}`
  const geoRes = await fetch(geoUrl)
  const geoData = await geoRes.json()
  if (geoData.status !== '1' || !geoData.regeocode) {
    throw new Error('定位解析失败')
  }
  const adcode = geoData.regeocode.addressComponent.adcode
  let city = geoData.regeocode.addressComponent.city || geoData.regeocode.addressComponent.province
  if (Array.isArray(city)) city = city[0] || '北京市'
  if (!city) city = '北京市'

  // 2. 查实时天气
  const weatherUrl = `https://restapi.amap.com/v3/weather/weatherInfo?key=${apiKey}&city=${adcode}&extensions=base`
  const wRes = await fetch(weatherUrl)
  const wData = await wRes.json()
  if (wData.status !== '1' || !wData.lives || wData.lives.length === 0) {
    throw new Error('天气查询失败')
  }
  return { ...wData.lives[0], city }
}
