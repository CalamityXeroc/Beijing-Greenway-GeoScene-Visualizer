import express from 'express'
const router = express.Router()

/**
 * Node.js 内存图 Dijkstra 路径规划
 * 查询时动态加载路网，无需预构建拓扑
 *
 * v2 改进：
 *  - 顶点级建图：每条路的每个顶点都是节点，交叉口（两条路顶点 < snap 容差）自动连通
 *    修复了旧版"只用道路端点建图"导致图碎片化、路径降级为直线的问题
 *  - 最小堆 Dijkstra：顶点多时性能可控
 *  - 步骤按道路名聚合：沿 xx 路 → 转入 xx 路，指引更清晰
 */

// 端点 snap 容差（度数，约 22m）—— 顶点级建图下用于合并交叉口附近顶点
const SNAP_TOLERANCE = 0.0002

// 路网图缓存：路网静态，同区域反复规划时复用，避免每次远程加载
const graphCache = new Map()  // key → { graph, roads, time }
const GRAPH_CACHE_MAX = 20
const GRAPH_CACHE_TTL = 10 * 60 * 1000  // 10 分钟

function cacheKey(minX, minY, maxX, maxY, spanKm) {
  const k = (v) => Math.round(v * 100)  // 网格化到 0.01°（约 1km）
  return `${spanKm > 8 ? 'm' : 'a'}${k(minX)},${k(minY)},${k(maxX)},${k(maxY)}`
}

/**
 * 从数据库加载矩形区域内的道路
 * spanKm > 8 时长距离走主干道（primary/secondary/tertiary），避免大数据量远程传输超时
 */
async function loadRoads(pool, minX, minY, maxX, maxY, spanKm) {
  const mainOnly = spanKm > 8
  const highwayCond = mainOnly
    ? "highway IN ('primary','primary_link','secondary','secondary_link')"
    : "highway NOT IN ('motorway','motorway_link','trunk','trunk_link')"
  const result = await pool.query(`
    SELECT
      osm_id,
      ST_AsGeoJSON(way, 6)::json AS geom,
      highway, name
    FROM planet_osm_line
    WHERE highway IS NOT NULL
      AND ${highwayCond}
      AND way && ST_MakeEnvelope($1, $2, $3, $4, 4326)
    LIMIT 10000
  `, [minX, minY, maxX, maxY])
  return result.rows
}

/**
 * 对坐标做网格快照，用于识别共享端点（交叉口）
 */
function snap(val) {
  return Math.round(val / SNAP_TOLERANCE) * SNAP_TOLERANCE
}

function snapKey(lng, lat) {
  return `${snap(lng).toFixed(6)},${snap(lat).toFixed(6)}`
}

/** 段长度（近似，4326 度数 → 米） */
function segmentLength(x1, y1, x2, y2) {
  const dLat = (y2 - y1) * 111320
  const dLng = (x2 - x1) * 111320 * Math.cos((y1 + y2) / 2 * Math.PI / 180)
  return Math.sqrt(dLng * dLng + dLat * dLat)
}

/**
 * 从道路数据构建顶点级邻接图：
 * 每条路的每个顶点都是节点，相邻顶点建边；交叉口附近顶点 snap 合并 → 图连通
 */
function buildGraph(roads) {
  const nodeMap = new Map()      // snapKey → nodeId
  const nodeCoords = new Map()   // nodeId → [lng, lat]
  const edges = []               // { from, to, roadIdx, length, coords:[[x1,y1],[x2,y2]] }
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
    const coords = r.geom?.coordinates
    if (!coords || coords.length < 2) continue
    for (let k = 0; k < coords.length - 1; k++) {
      const [x1, y1] = coords[k]
      const [x2, y2] = coords[k + 1]
      if (x1 === x2 && y1 === y2) continue
      const from = getOrCreateNode(x1, y1)
      const to = getOrCreateNode(x2, y2)
      if (from === to) continue  // 段太短 snap 到同一节点，跳过
      edges.push({
        from, to, roadIdx: i,
        length: segmentLength(x1, y1, x2, y2),
        coords: [[x1, y1], [x2, y2]]
      })
    }
  }

  // 构建邻接表（无向图）
  const adj = new Map()
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    if (!adj.has(e.to)) adj.set(e.to, [])
    adj.get(e.from).push({ to: e.to, edge: e })
    adj.get(e.to).push({ to: e.from, edge: e })
  }

  return { nodeMap, nodeCoords, edges, adj, roads, nodeIdx }
}

/** 最小堆（二叉堆）优先队列 */
class MinHeap {
  constructor() { this.heap = [] }
  push(item) {
    this.heap.push(item)
    let i = this.heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.heap[p][1] <= this.heap[i][1]) break
      ;[this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]]
      i = p
    }
  }
  pop() {
    const top = this.heap[0]
    const last = this.heap.pop()
    if (this.heap.length) {
      this.heap[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1, r = l + 1
        let m = i
        if (l < this.heap.length && this.heap[l][1] < this.heap[m][1]) m = l
        if (r < this.heap.length && this.heap[r][1] < this.heap[m][1]) m = r
        if (m === i) break
        ;[this.heap[m], this.heap[i]] = [this.heap[i], this.heap[m]]
        i = m
      }
    }
    return top
  }
  get size() { return this.heap.length }
}

/**
 * Dijkstra 最短路径（最小堆）
 */
function dijkstra(graph, startLng, startLat, endLng, endLat) {
  const { adj, nodeCoords } = graph

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

  const dist = new Map()
  const prev = new Map()
  const prevEdge = new Map()
  dist.set(startNode, 0)

  const pq = new MinHeap()
  pq.push([startNode, 0])

  while (pq.size > 0) {
    const [u, d] = pq.pop()
    if (d !== dist.get(u)) continue  // 过期条目
    if (u === endNode) break

    const neighbors = adj.get(u) || []
    for (const { to: v, edge } of neighbors) {
      const nd = d + edge.length
      if (!dist.has(v) || nd < dist.get(v)) {
        dist.set(v, nd)
        prev.set(v, u)
        prevEdge.set(v, edge)
        pq.push([v, nd])
      }
    }
  }

  if (!dist.has(endNode)) return null

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
 * 从路径边提取坐标序列（去除连接处重复点）
 */
function extractCoordinates(pathEdges) {
  const coords = []
  for (const e of pathEdges) {
    if (!e.coords?.length) continue
    const [p1, p2] = e.coords
    const last = coords[coords.length - 1]
    if (last && Math.abs(last[0] - p1[0]) < 1e-9 && Math.abs(last[1] - p1[1]) < 1e-9) {
      coords.push(p2)
    } else {
      coords.push(p1, p2)
    }
  }
  return coords
}

/**
 * 生成中文指引（按道路名聚合连续段）
 */
function generateSteps(pathEdges, roads) {
  const groups = []
  for (const e of pathEdges) {
    const r = roads[e.roadIdx]
    const name = r?.name || ''
    const last = groups[groups.length - 1]
    if (last && last.name === name) {
      last.dist += e.length
      if (e.coords?.length) last.coords.push(e.coords[1])
    } else {
      groups.push({ name, roadIdx: e.roadIdx, dist: e.length, coords: e.coords ? [...e.coords] : [] })
    }
  }
  return groups.map((s, i) => {
    let instruction
    if (i === 0) instruction = s.name ? `从${s.name}出发` : '从起点出发'
    else if (s.name) instruction = `转入${s.name}`
    else instruction = '继续前行'
    return { instruction, distance: s.dist, road: s.name, coordinates: s.coords }
  })
}

// ===== 路由端点 =====

router.post('/route', async (req, res) => {
  const tStart = Date.now()
  try {
    const { origin, destination, mode } = req.body
    if (!origin || !destination) {
      return res.status(400).json({ error: '缺少起点或终点' })
    }

    const pool = req.pool
    const olng = origin.lng, olat = origin.lat
    const dlng = destination.lng, dlat = destination.lat

    // 包围盒：按起终点距离自适应扩展（至少 2km，最多 12km）
    const lngDist = Math.abs(dlng - olng) * 111320 * Math.cos((olat + dlat) / 2 * Math.PI / 180)
    const latDist = Math.abs(dlat - olat) * 111320
    const spanKm = Math.max(lngDist, latDist) / 1000
    const margin = Math.min(Math.max(spanKm * 0.4, 2), 12) / 111.32  // 度

    const minX = Math.min(olng, dlng) - margin
    const maxX = Math.max(olng, dlng) + margin
    const minY = Math.min(olat, dlat) - margin
    const maxY = Math.max(olat, dlat) + margin

    const key = cacheKey(minX, minY, maxX, maxY, spanKm)
    let graph, roads
    const hit = graphCache.get(key)
    if (hit && Date.now() - hit.time < GRAPH_CACHE_TTL) {
      graph = hit.graph
      roads = hit.roads
      console.log('[路由] 命中缓存，跳过 loadRoads')
    } else {
      roads = await loadRoads(pool, minX, minY, maxX, maxY, spanKm)
      console.log(`[路由] 加载路网 ${roads.length}条(${spanKm > 8 ? '主干道' : '全路网'}) ${Date.now() - tStart}ms`)
      if (roads.length < 2) {
        throw new Error('该区域路网数据不足')
      }
      const t0 = Date.now()
      graph = buildGraph(roads)
      console.log(`[路由] buildGraph: ${graph.nodeIdx}节点/${graph.edges.length}边 ${Date.now() - t0}ms`)
      graphCache.set(key, { graph, roads, time: Date.now() })
      if (graphCache.size > GRAPH_CACHE_MAX) {
        const oldest = graphCache.keys().next().value
        graphCache.delete(oldest)
      }
    }

    const t1 = Date.now()
    const pathEdges = dijkstra(graph, olng, olat, dlng, dlat)
    console.log(`[路由] 算路 ${Date.now() - t1}ms, pathEdges=${pathEdges ? pathEdges.length : 'NULL'}${hit ? ' (缓存)' : ''}`)

    let totalDist, totalDuration, coordinates, steps

    if (pathEdges && pathEdges.length > 0) {
      totalDist = pathEdges.reduce((s, e) => s + e.length, 0)
      const speed = mode === 'bicycling' ? 4.167 : 1.389
      totalDuration = totalDist / speed
      coordinates = extractCoordinates(pathEdges)
      steps = generateSteps(pathEdges, roads)
    } else {
      console.log('[路由] 图不连通，使用直线兜底')
      totalDist = Math.sqrt((olng - dlng) ** 2 + (olat - dlat) ** 2) * 111320
      const speed = mode === 'bicycling' ? 4.167 : 1.389
      totalDuration = totalDist / speed
      coordinates = [[olng, olat], [dlng, dlat]]
      steps = [{
        instruction: mode === 'bicycling' ? '骑行路线（直线兜底，路网未连通）' : '步行路线（直线兜底，路网未连通）',
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
    console.log(`[路由] 完成 ${Date.now() - tStart}ms`)
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
