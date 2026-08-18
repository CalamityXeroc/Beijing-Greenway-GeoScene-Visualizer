import express from 'express'
const router = express.Router()
import { getGraph, dijkstra, nearestNode } from './roadGraph.js'
import { wgs84ToGcj02, gcj02ToWgs84 } from '../utils/coordTransform.js'

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
    // 前端/底图坐标为 GCJ-02（高德），路网为 OSM WGS-84，需先转成 WGS-84 才能匹配路网
    const [wgOlng, wgOlat] = gcj02ToWgs84(origin.lng, origin.lat)
    const [wgDlng, wgDlat] = gcj02ToWgs84(destination.lng, destination.lat)
    const olng = wgOlng, olat = wgOlat
    const dlng = wgDlng, dlat = wgDlat

    // 包围盒：按起终点距离自适应扩展（至少 2km，最多 12km）
    const lngDist = Math.abs(dlng - olng) * 111320 * Math.cos((olat + dlat) / 2 * Math.PI / 180)
    const latDist = Math.abs(dlat - olat) * 111320
    const spanKm = Math.max(lngDist, latDist) / 1000
    const margin = Math.min(Math.max(spanKm * 0.4, 2), 12) / 111.32  // 度

    const minX = Math.min(olng, dlng) - margin
    const maxX = Math.max(olng, dlng) + margin
    const minY = Math.min(olat, dlat) - margin
    const maxY = Math.max(olat, dlat) + margin

    const t0 = Date.now()
    const { graph, roads } = await getGraph(pool, minX, minY, maxX, maxY, spanKm)
    console.log(`[路由] 路网就绪 ${roads.length}条/${graph.nodeIdx}节点 (${spanKm > 8 ? '主干道' : '全路网'}) ${Date.now() - t0}ms`)

    const t1 = Date.now()
    const pathEdges = dijkstra(graph, olng, olat, dlng, dlat)
    console.log(`[路由] 算路 ${Date.now() - t1}ms, pathEdges=${pathEdges ? pathEdges.length : 'NULL'}`)

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

    // 路网坐标为 OSM WGS-84，转回 GCJ-02 与高德底图/绿道对齐
    const gcjCoords = coordinates.map(([lng, lat]) => wgs84ToGcj02(lng, lat))
    const gcjSteps = steps.map(s => ({
      ...s,
      coordinates: s.coordinates ? s.coordinates.map(([lng, lat]) => wgs84ToGcj02(lng, lat)) : s.coordinates
    }))
    // 步骤距离不受坐标转换影响，保持原样

    res.json({
      origin: `${origin.lng},${origin.lat}`,
      destination: `${destination.lng},${destination.lat}`,
      paths: [{
        distance: totalDist,
        duration: totalDuration,
        coordinates: gcjCoords,
        steps: gcjSteps
      }]
    })
    console.log(`[路由] 完成 ${Date.now() - tStart}ms, 坐标已转 GCJ-02 与底图对齐`)
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
