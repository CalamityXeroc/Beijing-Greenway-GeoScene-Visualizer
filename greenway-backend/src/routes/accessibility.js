/**
 * 绿道可达性分析（可达圈）- API
 * POST /api/accessibility/reach
 * body: { origin: {lng,lat}, mode: 'walking'|'bicycling' }
 *
 * 市民场景：从我的位置出发，步行/骑行 X 分钟能到达哪些绿道？
 * - 沿路网 Dijkstra 计算距离场
 * - 5 档等时圈凸包（5/10/15/20/30 分钟）
 * - 各绿道最近入口的路网距离
 */
import express from 'express'
import { getGraph, dijkstraAll, nearestNode } from './roadGraph.js'

const router = express.Router()

const SPEED = { walking: 1.389, bicycling: 4.167 }  // m/s（与路径规划一致）
const LEVELS = [5, 10, 15, 20, 30]  // 时间档（分钟）

/** 点到线段最近距离 + 最近点（4326 近似） */
function pointToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)))
  const cx = x1 + t * dx, cy = y1 + t * dy
  const dLat = (py - cy) * 111320
  const dLng = (px - cx) * 111320 * Math.cos((py + cy) / 2 * Math.PI / 180)
  return { d: Math.sqrt(dLng * dLng + dLat * dLat), lng: cx, lat: cy }
}

/** Andrew monotone chain 凸包（输入 [lng,lat] 数组，返回逆时针多边形坐标） */
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3) return pts
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop(); upper.pop()
  return [...lower, ...upper]
}

router.post('/reach', async (req, res) => {
  try {
    const { origin, mode } = req.body || {}
    const lng = parseFloat(origin?.lng)
    const lat = parseFloat(origin?.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json({ error: '缺少起点坐标' })
    }
    const travelMode = mode === 'bicycling' ? 'bicycling' : 'walking'
    const speed = SPEED[travelMode]
    const maxMinutes = 30
    const maxDist = speed * maxMinutes * 60  // 30 分钟最远距离
    const margin = (maxDist + 1000) / 111320  // 度（含 1km 余量）
    const spanKm = (maxDist + 1000) / 1000

    const t0 = Date.now()
    // 加载路网图（全路网，强制非主干道模式）
    const { graph } = await getGraph(
      req.pool,
      lng - margin, lat - margin, lng + margin, lat + margin,
      Math.min(spanKm, 8)  // 保持全路网（avoid 主干道降级）
    )
    console.log(`[可达圈] 路网就绪 ${graph.nodeIdx}节点 ${Date.now() - t0}ms`)

    // 距离场
    const t1 = Date.now()
    const dists = dijkstraAll(graph, lng, lat, maxDist)
    console.log(`[可达圈] 距离场 ${dists.size}节点 ${Date.now() - t1}ms`)

    // 各时间档凸包
    const hulls = {}
    for (const min of LEVELS) {
      const limit = speed * min * 60
      const pts = []
      for (const [id, d] of dists) {
        if (d <= limit) {
          const c = graph.nodeCoords.get(id)
          if (c) pts.push(c)
        }
      }
      hulls[min] = convexHull(pts)
    }

    // 可达绿道：绿道最近入口 → 最近路网节点 → 路网距离
    const gwRes = await req.pool.query(`
      SELECT name, ST_AsGeoJSON(geometry, 6)::json AS geom FROM greenways WHERE geometry IS NOT NULL
    `)
    const greenways = []
    for (const g of gwRes.rows) {
      const coords = g.geom?.coordinates
      if (!coords) continue
      const lines = g.geom.type === 'MultiLineString' ? coords : [coords]
      // 起点到绿道线最近点（欧氏）
      let best = { d: Infinity, lng: 0, lat: 0 }
      for (const line of lines) {
        for (let i = 0; i < line.length - 1; i++) {
          const r = pointToSeg(lng, lat, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1])
          if (r.d < best.d) best = r
        }
      }
      if (!Number.isFinite(best.d)) continue
      // 最近入口点 → 最近路网节点 → 路网距离
      const nodeId = nearestNode(graph, best.lng, best.lat)
      const distM = nodeId != null ? (dists.get(nodeId) ?? Infinity) : Infinity
      if (distM <= maxDist) {
        greenways.push({
          name: g.name,
          lng: best.lng,
          lat: best.lat,
          distM: Math.round(distM),
          minutes: Math.max(1, Math.round(distM / speed / 60))
        })
      }
    }
    greenways.sort((a, b) => a.distM - b.distM)

    res.json({
      mode: travelMode,
      origin: { lng, lat },
      hulls,
      greenways,
      summary: {
        reachableCount: greenways.length,
        within15: greenways.filter(g => g.minutes <= 15).length,
        nearest: greenways[0] || null
      }
    })
  } catch (err) {
    console.error('[可达圈] 错误:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
