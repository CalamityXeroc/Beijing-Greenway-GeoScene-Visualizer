/**
 * 路网图公共模块（路径规划与可达性分析共享）
 * - 顶点级建图（交叉口 snap 合并）
 * - 最小堆 Dijkstra（单终点 + 全距离场）
 * - 图缓存（路网静态，同区域复用）
 */

// 端点 snap 容差（度数，约 22m）——顶点级建图下用于合并交叉口附近顶点
export const SNAP_TOLERANCE = 0.0002

// 路网图缓存：路网静态，同区域反复查询时复用，避免每次远程加载
const graphCache = new Map()  // key → { graph, roads, time }
const GRAPH_CACHE_MAX = 20
const GRAPH_CACHE_TTL = 10 * 60 * 1000  // 10 分钟

function cacheKey(minX, minY, maxX, maxY, spanKm) {
  const k = (v) => Math.round(v * 100)  // 网格化到 0.01°（约 1km）
  return `${spanKm > 8 ? 'm' : 'a'}${k(minX)},${k(minY)},${k(maxX)},${k(maxY)}`
}

/**
 * 从数据库加载矩形区域内的道路
 * spanKm > 8 时长距离走主干道（primary/secondary），避免大数据量远程传输超时
 *
 * 重要：结果按“距中心点距离”由近到远排序后再截断（KNN，走 GiST 索引）。
 * 若直接 LIMIT，PostgreSQL 按物理存储顺序返回，会在道路密集区域
 * （如骑行 30 分钟 bbox 内有 2 万+ 条）随机丢掉起点周边的路网，
 * 导致起点吸附到 1km 外的节点、可达圈中心偏移。
 */
export async function loadRoads(pool, minX, minY, maxX, maxY, spanKm) {
  const mainOnly = spanKm > 8
  const highwayCond = mainOnly
    ? "highway IN ('primary','primary_link','secondary','secondary_link')"
    : "highway NOT IN ('motorway','motorway_link','trunk','trunk_link')"
  const centerLng = (minX + maxX) / 2
  const centerLat = (minY + maxY) / 2
  const result = await pool.query(`
    SELECT
      osm_id,
      ST_AsGeoJSON(way, 6)::json AS geom,
      highway, name
    FROM planet_osm_line
    WHERE highway IS NOT NULL
      AND ${highwayCond}
      AND way && ST_MakeEnvelope($1, $2, $3, $4, 4326)
    ORDER BY way <-> ST_SetSRID(ST_MakePoint($5, $6), 4326)
    LIMIT 10000
  `, [minX, minY, maxX, maxY, centerLng, centerLat])
  return result.rows
}

/** 对坐标做网格快照，用于识别共享端点（交叉口） */
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
export function buildGraph(roads) {
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
    const coords = r.geom?.coordinates
    if (!coords || coords.length < 2) continue
    for (let k = 0; k < coords.length - 1; k++) {
      const [x1, y1] = coords[k]
      const [x2, y2] = coords[k + 1]
      if (x1 === x2 && y1 === y2) continue
      const from = getOrCreateNode(x1, y1)
      const to = getOrCreateNode(x2, y2)
      if (from === to) continue
      edges.push({
        from, to, roadIdx: i,
        length: segmentLength(x1, y1, x2, y2),
        coords: [[x1, y1], [x2, y2]]
      })
    }
  }

  const adj = new Map()
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    if (!adj.has(e.to)) adj.set(e.to, [])
    adj.get(e.from).push({ to: e.to, edge: e })
    adj.get(e.to).push({ to: e.from, edge: e })
  }

  return { nodeMap, nodeCoords, edges, adj, nodeIdx }
}

/** 最小堆（二叉堆）优先队列 */
export class MinHeap {
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

/** 找距离给定坐标最近的路网节点（平方距离最小） */
export function nearestNode(graph, lng, lat) {
  let best = null, minD = Infinity
  for (const [id, [x, y]] of graph.nodeCoords) {
    const d = (x - lng) ** 2 + (y - lat) ** 2
    if (d < minD) { minD = d; best = id }
  }
  return best
}

/**
 * Dijkstra 最短路径（最小堆）
 * 返回 pathEdges（起点到终点的边序列）或 null
 */
export function dijkstra(graph, startLng, startLat, endLng, endLat) {
  const { adj } = graph
  const startNode = nearestNode(graph, startLng, startLat)
  const endNode = nearestNode(graph, endLng, endLat)
  if (!startNode || !endNode || startNode === endNode) return null

  const dist = new Map()
  const prev = new Map()
  const prevEdge = new Map()
  dist.set(startNode, 0)

  const pq = new MinHeap()
  pq.push([startNode, 0])

  while (pq.size > 0) {
    const [u, d] = pq.pop()
    if (d !== dist.get(u)) continue
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
 * Dijkstra 全距离场：返回起点到所有可达节点的距离 Map<nodeId, distM>
 * maxDistM 限制扩散范围（性能与结果大小控制）
 */
export function dijkstraAll(graph, startLng, startLat, maxDistM = Infinity) {
  const { adj } = graph
  const startNode = nearestNode(graph, startLng, startLat)
  const dist = new Map()
  if (!startNode) return dist

  dist.set(startNode, 0)
  const pq = new MinHeap()
  pq.push([startNode, 0])

  while (pq.size > 0) {
    const [u, d] = pq.pop()
    if (d !== dist.get(u)) continue
    if (d > maxDistM) break

    const neighbors = adj.get(u) || []
    for (const { to: v, edge } of neighbors) {
      const nd = d + edge.length
      if (!dist.has(v) || nd < dist.get(v)) {
        dist.set(v, nd)
        pq.push([v, nd])
      }
    }
  }
  return dist
}

/**
 * 带缓存的图加载：同区域命中缓存跳过远程加载
 */
export async function getGraph(pool, minX, minY, maxX, maxY, spanKm) {
  const key = cacheKey(minX, minY, maxX, maxY, spanKm)
  const hit = graphCache.get(key)
  if (hit && Date.now() - hit.time < GRAPH_CACHE_TTL) {
    return hit
  }
  const roads = await loadRoads(pool, minX, minY, maxX, maxY, spanKm)
  if (roads.length < 2) throw new Error('该区域路网数据不足')
  const graph = buildGraph(roads)
  const entry = { graph, roads, time: Date.now() }
  graphCache.set(key, entry)
  if (graphCache.size > GRAPH_CACHE_MAX) {
    const oldest = graphCache.keys().next().value
    graphCache.delete(oldest)
  }
  return entry
}
