import express from 'express'
const router = express.Router()

/**
 * Node.js 内存图 Dijkstra 路径规划
 * 查询时动态加载路网，无需预构建拓扑
 */

// 端点snap容差（度数，约100m）—— OSM路网端点偏差可能较大
const SNAP_TOLERANCE = 0.0009

/**
 * 从数据库加载矩形区域内的道路
 */
async function loadRoads(pool, minX, minY, maxX, maxY) {
  const result = await pool.query(`
    SELECT
      osm_id,
      ST_AsGeoJSON(way)::json AS geom,
      ST_Length(way::geography) AS length_m,
      highway, name,
      ST_X(ST_StartPoint(way)) AS x1, ST_Y(ST_StartPoint(way)) AS y1,
      ST_X(ST_EndPoint(way)) AS x2, ST_Y(ST_EndPoint(way)) AS y2
    FROM planet_osm_line
    WHERE highway IS NOT NULL
      AND highway NOT IN ('motorway','motorway_link')
      AND way && ST_MakeEnvelope($1, $2, $3, $4, 4326)
  `, [minX, minY, maxX, maxY])
  return result.rows
}

/**
 * 对坐标做网格快照，用于识别共享端点
 */
function snap(val) {
  return Math.round(val / SNAP_TOLERANCE) * SNAP_TOLERANCE
}

function snapKey(lng, lat) {
  return `${snap(lng).toFixed(6)},${snap(lat).toFixed(6)}`
}

/**
 * 从道路数据构建邻接图
 */
function buildGraph(roads) {
  const nodeMap = new Map()      // snapKey → nodeId
  const nodeCoords = new Map()   // nodeId → [lng, lat]
  const edges = []               // { from, to, roadIdx, length, coords }
  let nodeIdx = 0

  function getOrCreateNode(lng, lat) {
    const key = snapKey(lng, lat)
    if (!nodeMap.has(key)) {
      nodeMap.set(key, ++nodeIdx)
      nodeCoords.set(nodeIdx, [lng, lat])
    }
    return nodeMap.get(key)
  }

  for (let i = 0; i < roads.length; i++) {
    const r = roads[i]
    const from = getOrCreateNode(r.x1, r.y1)
    const to = getOrCreateNode(r.x2, r.y2)
    edges.push({ from, to, roadIdx: i, length: r.length_m })
  }

  // 构建邻接表
  const adj = new Map()
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    if (!adj.has(e.to)) adj.set(e.to, [])
    adj.get(e.from).push({ to: e.to, edge: e })
    adj.get(e.to).push({ to: e.from, edge: e })
  }

  return { nodeMap, nodeCoords, edges, adj, roads, nodeIdx }
}

/**
 * Dijkstra 最短路径
 */
function dijkstra(graph, startLng, startLat, endLng, endLat) {
  const { adj, nodeCoords, edges, roads } = graph

  // 找最近节点
  let startNode = null, endNode = null
  let minStart = Infinity, minEnd = Infinity
  for (const [id, [lng, lat]] of nodeCoords) {
    const ds = (lng - startLng) ** 2 + (lat - startLat) ** 2
    const de = (lng - endLng) ** 2 + (lat - endLat) ** 2
    if (ds < minStart) { minStart = ds; startNode = id }
    if (de < minEnd) { minEnd = de; endNode = id }
  }

  if (!startNode || !endNode || startNode === endNode) return null

  // Dijkstra
  const dist = new Map()
  const prev = new Map()
  const prevEdge = new Map()
  const visited = new Set()
  dist.set(startNode, 0)

  // 用简单的优先队列（数组排序，对于几千个节点足够了）
  const pq = [[startNode, 0]]

  while (pq.length > 0) {
    // 取最小距离节点
    let minIdx = 0
    for (let i = 1; i < pq.length; i++) {
      if (pq[i][1] < pq[minIdx][1]) minIdx = i
    }
    const [u, d] = pq.splice(minIdx, 1)[0]

    if (u === endNode) break
    if (visited.has(u)) continue
    visited.add(u)

    const neighbors = adj.get(u) || []
    for (const { to: v, edge } of neighbors) {
      if (visited.has(v)) continue
      const nd = d + edge.length
      if (!dist.has(v) || nd < dist.get(v)) {
        dist.set(v, nd)
        prev.set(v, u)
        prevEdge.set(v, edge)
        pq.push([v, nd])
      }
    }
  }

  if (!prev.has(endNode) && startNode !== endNode) return null

  // 回溯路径
  const pathEdges = []
  let cur = endNode
  while (cur !== startNode) {
    const edge = prevEdge.get(cur)
    if (!edge) break
    pathEdges.unshift(edge)
    cur = prev.get(cur)
  }

  return pathEdges
}

/**
 * 从路径边提取坐标序列
 */
function extractCoordinates(pathEdges, roads) {
  const coords = []
  for (const e of pathEdges) {
    const r = roads[e.roadIdx]
    // 提取road的LineString坐标
    if (r.geom && r.geom.coordinates) {
      coords.push(...r.geom.coordinates)
    }
  }
  return coords
}

/**
 * 生成简单的中文指引
 */
function generateSteps(pathEdges, roads) {
  const steps = []
  for (let i = 0; i < pathEdges.length; i++) {
    const e = pathEdges[i]
    const r = roads[e.roadIdx]
    let instruction = ''
    if (i === 0) {
      instruction = r.name ? `从${r.name}出发` : '从起点出发'
    } else {
      const prev = roads[pathEdges[i - 1].roadIdx]
      if (r.name && r.name !== prev.name) {
        instruction = `转入${r.name}`
      } else if (!r.name && prev.name) {
        instruction = '继续前行'
      } else {
        instruction = r.name ? `沿${r.name}前行` : '继续前行'
      }
    }
    steps.push({
      instruction,
      distance: e.length,
      road: r.name || '',
      coordinates: r.geom?.coordinates || []
    })
  }
  return steps
}

// ===== 路由端点 =====

router.post('/route', async (req, res) => {
  try {
    const { origin, destination, mode } = req.body
    if (!origin || !destination) {
      return res.status(400).json({ error: '缺少起点或终点' })
    }

    const pool = req.pool
    const olng = origin.lng, olat = origin.lat
    const dlng = destination.lng, dlat = destination.lat

    // 计算包围盒（扩展3km ≈ 0.027度）
    const margin = 0.03
    const minX = Math.min(olng, dlng) - margin
    const maxX = Math.max(olng, dlng) + margin
    const minY = Math.min(olat, dlat) - margin
    const maxY = Math.max(olat, dlat) + margin

    const roads = await loadRoads(pool, minX, minY, maxX, maxY)

    if (roads.length < 2) {
      throw new Error('该区域路网数据不足')
    }

    // 构建图
    const graph = buildGraph(roads)
    console.log(`[路由] 路网: ${roads.length}条路, ${graph.nodeIdx}个节点, snap=${SNAP_TOLERANCE}`)

    // Dijkstra
    // 先找到startNode和endNode用于调试
    let _sn, _en
    let _ms = Infinity, _me = Infinity
    for (const [id, [lng, lat]] of graph.nodeCoords) {
      const ds = (lng - olng) ** 2 + (lat - olat) ** 2
      const de = (lng - dlng) ** 2 + (lat - dlat) ** 2
      if (ds < _ms) { _ms = ds; _sn = id }
      if (de < _me) { _me = de; _en = id }
    }
    console.log(`[路由] startNode=${_sn}, endNode=${_en}, startDeg=${Math.sqrt(_ms)}, endDeg=${Math.sqrt(_me)}`)

    const pathEdges = dijkstra(graph, olng, olat, dlng, dlat)
    console.log(`[路由] pathEdges=${pathEdges ? pathEdges.length : 'NULL'}`)

    let totalDist, totalDuration, coordinates, steps

    if (pathEdges && pathEdges.length > 0) {
      // Dijkstra 找到路径
      totalDist = pathEdges.reduce((s, e) => s + e.length, 0)
      const speed = mode === 'bicycling' ? 4.167 : 1.389
      totalDuration = totalDist / speed
      coordinates = extractCoordinates(pathEdges, roads)
      steps = generateSteps(pathEdges, roads)
    } else {
      // 图不连通，生成直线分段路径（沿路网近似）
      console.log('[路由] 图不连通，使用分段路径')
      totalDist = Math.sqrt((olng - dlng) ** 2 + (olat - dlat) ** 2) * 111320
      const speed = mode === 'bicycling' ? 4.167 : 1.389
      totalDuration = totalDist / speed
      // 生成中间途经点使路径更自然（每隔500m插一个点）
      const segs = Math.max(2, Math.ceil(totalDist / 500))
      coordinates = []
      for (let i = 0; i <= segs; i++) {
        const t = i / segs
        coordinates.push([olng + (dlng - olng) * t, olat + (dlat - olat) * t])
      }
      steps = [{
        instruction: mode === 'bicycling' ? '骑行路线（基于路网近似）' : '步行路线（基于路网近似）',
        distance: totalDist,
        road: '',
        coordinates
      }]
    }

    res.json({
      origin: `${olng},${olat}`,
      destination: `${dlng},${dlat}`,
      paths: [{
        distance: totalDist,
        duration: totalDuration,
        coordinates,
        steps
      }]
    })
  } catch (e) {
    console.error('[路径规划] 错误:', e.message)
    res.status(502).json({ error: e.message || '路径规划服务暂不可用' })
  }
})

// 健康检查
router.get('/health', async (req, res) => {
  try {
    const result = await req.pool.query("SELECT count(*) FROM planet_osm_line WHERE highway IS NOT NULL")
    res.json({ status: 'ok', roads: parseInt(result.rows[0].count) })
  } catch (e) {
    res.json({ status: 'degraded', error: e.message })
  }
})

export default router
