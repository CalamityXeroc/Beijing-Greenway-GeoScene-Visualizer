import express from 'express'
import { authMiddleware, adminOnly } from '../auth.js'
import { cached, invalidate } from '../cache.js'
const router = express.Router()

// 设施/绿道写入接口在 index.js 创建 POI 时调用 invalidate('poi:')，这里仅读取缓存

// POI 类型映射
const POI_TYPE_MAP = {
  '150500': { name: '地铁站', icon: 'fa-train-subway', color: '#E53935' },
  '150700': { name: '公交站', icon: 'fa-bus', color: '#FB8C00' },
  '150900': { name: '停车场', icon: 'fa-square-parking', color: '#1E88E5' },
  '200300': { name: '公共卫生间', icon: 'fa-restroom', color: '#43A047' },
  '060100': { name: '便利店', icon: 'fa-store', color: '#8E24AA' },
  '080600': { name: '影剧院', icon: 'fa-film', color: '#6A1B9A' },
  '110100': { name: '景点', icon: 'fa-landmark', color: '#E65100' },
  '110200': { name: '景点', icon: 'fa-landmark', color: '#E65100' }
}

// 工具：按名称查设施
async function queryFacilities(pool, greenwayId, types, radius) {
  const radiusM = parseInt(radius) || 1000
  const result = await pool.query(`
    SELECT
      poi.id, poi.name, poi.poi_type, poi.description AS address,
      ROUND(ST_Distance(poi.geometry::geography, g.geometry::geography)) AS distance_m,
      ST_X(poi.geometry) AS lng, ST_Y(poi.geometry) AS lat
    FROM points_of_interest poi
    JOIN greenways g ON g.id = $1
    WHERE poi.greenway_id = $1
      AND poi.poi_type = ANY($2::varchar[])
      AND ST_DWithin(poi.geometry::geography, g.geometry::geography, $3)
    ORDER BY poi.poi_type, distance_m
    LIMIT 100
  `, [greenwayId, types, radiusM])

  return result.rows.map(r => ({
    ...r,
    distance_m: parseInt(r.distance_m),
    icon: POI_TYPE_MAP[r.poi_type]?.icon || 'fa-map-marker-alt',
    color: POI_TYPE_MAP[r.poi_type]?.color || '#999',
    type_name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type
  }))
}

// 绿道附近设施 GeoJSON（按名称 — 必须放在 :id 之前）
router.get('/greenways/name/:name/nearby-facilities/geojson', async (req, res) => {
  try {
    const { name } = req.params
    const radiusM = parseInt(req.query.radius) || 1000
    const types = req.query.types ? req.query.types.split(',') : Object.keys(POI_TYPE_MAP)
    const idRow = await req.pool.query('SELECT id FROM greenways WHERE name = $1', [name])
    if (idRow.rows.length === 0) return res.status(404).json({ type: 'FeatureCollection', features: [] })

    const id = idRow.rows[0].id
    const result = await req.pool.query(`
      SELECT
        poi.id, poi.name, poi.poi_type, poi.description AS address,
        ROUND(ST_Distance(poi.geometry::geography, g.geometry::geography)) AS distance_m,
        poi.greenway_id, g.name AS greenway_name,
        ST_AsGeoJSON(poi.geometry)::json AS geometry
      FROM points_of_interest poi
      JOIN greenways g ON g.id = $1
      WHERE poi.greenway_id = $1
        AND poi.poi_type = ANY($2::varchar[])
        AND ST_DWithin(poi.geometry::geography, g.geometry::geography, $3)
      ORDER BY poi.poi_type, distance_m
      LIMIT 200
    `, [id, types, radiusM])

    const features = result.rows.map(r => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: {
        id: r.id, name: r.name, poi_type: r.poi_type,
        type_name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type,
        color: POI_TYPE_MAP[r.poi_type]?.color || '#999',
        distance_m: parseInt(r.distance_m),
        greenway_id: r.greenway_id,
        greenway_name: r.greenway_name,
        address: r.address
      }
    }))
    res.json({ type: 'FeatureCollection', features })
  } catch (err) {
    console.error('[POI-GeoJSON-by-name] 查询失败:', err.message)
    res.status(500).json({ type: 'FeatureCollection', features: [] })
  }
})

// 绿道附近设施查询（按名称 — 必须放在 :id 之前，否则 Express 会将 "name" 匹配为 :id）
router.get('/greenways/name/:name/nearby-facilities', async (req, res) => {
  try {
    const { name } = req.params
    const types = req.query.types ? req.query.types.split(',') : Object.keys(POI_TYPE_MAP)
    const idRow = await req.pool.query('SELECT id FROM greenways WHERE name = $1', [name])
    if (idRow.rows.length === 0) return res.status(404).json({ error: '绿道不存在' })
    const radiusM = parseInt(req.query.radius) || 1000
    const facilities = await queryFacilities(req.pool, idRow.rows[0].id, types, radiusM)
    const summary = {}
    for (const f of facilities) { summary[f.poi_type] = (summary[f.poi_type] || 0) + 1 }
    res.json({ greenwayId: idRow.rows[0].id, greenwayName: name, radius: 1000, facilities, summary })
  } catch (err) {
    console.error('[POI-by-name] 查询失败:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 绿道附近设施查询（按 ID）
router.get('/greenways/:id/nearby-facilities', async (req, res) => {
  try {
    const { id } = req.params
    const radiusM = parseInt(req.query.radius) || 1000
    const types = req.query.types ? req.query.types.split(',') : Object.keys(POI_TYPE_MAP)
    const facilities = await queryFacilities(req.pool, id, types, radiusM)
    const gw = await req.pool.query('SELECT name FROM greenways WHERE id = $1', [id])
    const summary = {}
    for (const f of facilities) { summary[f.poi_type] = (summary[f.poi_type] || 0) + 1 }
    res.json({ greenwayId: parseInt(id), greenwayName: gw.rows[0]?.name || '', radius: 1000, facilities, summary })
  } catch (err) {
    console.error('[POI] 查询失败:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 绿道附近设施 GeoJSON（地图图层用）
router.get('/greenways/:id/nearby-facilities/geojson', async (req, res) => {
  try {
    const { id } = req.params
    const radiusM = parseInt(req.query.radius) || 1000
    const types = req.query.types ? req.query.types.split(',') : Object.keys(POI_TYPE_MAP)

    const result = await req.pool.query(`
      SELECT
        poi.id, poi.name, poi.poi_type, poi.description AS address,
        ROUND(ST_Distance(poi.geometry::geography, g.geometry::geography)) AS distance_m,
        poi.greenway_id, g.name AS greenway_name,
        ST_AsGeoJSON(poi.geometry)::json AS geometry
      FROM points_of_interest poi
      JOIN greenways g ON g.id = $1
      WHERE poi.greenway_id = $1
        AND poi.poi_type = ANY($2::varchar[])
        AND ST_DWithin(poi.geometry::geography, g.geometry::geography, $3)
      ORDER BY poi.poi_type, distance_m
      LIMIT 200
    `, [id, types, radiusM])

    const features = result.rows.map(r => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: {
        id: r.id,
        name: r.name,
        poi_type: r.poi_type,
        type_name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type,
        color: POI_TYPE_MAP[r.poi_type]?.color || '#999',
        distance_m: parseInt(r.distance_m),
        greenway_id: r.greenway_id,
        greenway_name: r.greenway_name,
        address: r.address
      }
    }))

    res.json({ type: 'FeatureCollection', features })
  } catch (err) {
    console.error('[POI-GeoJSON] 查询失败:', err.message)
    res.status(500).json({ type: 'FeatureCollection', features: [] })
  }
})

// 所有绿道的设施汇总 GeoJSON（地图总览用）
// 用 ST_X/ST_Y 取坐标（比 ST_AsGeoJSON 快得多，规避远程库序列化瓶颈）
// 远程库慢 + 移动端反复进入地图页 → 缓存秒开
const FACILITIES_TTL = 60_000;

async function queryAllFacilities(pool) {
  const result = await pool.query(`
    SELECT
      poi.id, poi.name, poi.poi_type, poi.description AS address,
      poi.greenway_id, g.name AS greenway_name,
      ST_X(poi.geometry) AS lng, ST_Y(poi.geometry) AS lat
    FROM points_of_interest poi
    LEFT JOIN greenways g ON g.id = poi.greenway_id
    ORDER BY poi.id
    LIMIT 2000
  `)

  const features = result.rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [Number(r.lng), Number(r.lat)] },
    properties: {
      id: r.id,
      name: r.name,
      poi_type: r.poi_type,
      type_name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type,
      color: POI_TYPE_MAP[r.poi_type]?.color || '#999',
      greenway_id: r.greenway_id,
      greenway_name: r.greenway_name,
      address: r.address
    }
  }))

  return { type: 'FeatureCollection', features }
}

router.get('/facilities/geojson', async (req, res) => {
  try {
    const payload = await cached('poi:facilities', FACILITIES_TTL, () => queryAllFacilities(req.pool))
    res.json(payload)
  } catch (err) {
    console.error('[POI-All] 查询失败:', err.message)
    res.status(500).json({ type: 'FeatureCollection', features: [] })
  }
})

// POI 全局搜索
// q=关键词（名称/地址模糊）；type=类型 code（精确过滤，与 q 可组合）
router.get('/poi/search', async (req, res) => {
  try {
    const { q, type } = req.query
    const conditions = []
    const params = []
    if (q && q.trim().length) {
      params.push(`%${q.trim()}%`)
      conditions.push(`(poi.name ILIKE $${params.length} OR poi.description ILIKE $${params.length})`)
    }
    if (type) {
      params.push(String(type))
      conditions.push(`poi.poi_type = $${params.length}`)
    }
    if (conditions.length === 0) return res.json({ results: [] })
    const result = await req.pool.query(`
      SELECT poi.id, poi.name, poi.poi_type, poi.description AS address,
        ST_X(poi.geometry) AS lng, ST_Y(poi.geometry) AS lat,
        g.name AS greenway_name
      FROM points_of_interest poi
      JOIN greenways g ON g.id = poi.greenway_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY poi.poi_type, poi.id
      LIMIT 50
    `, params)
    res.json({
      results: result.rows.map(r => ({
        id: r.id, name: r.name, poi_type: r.poi_type,
        type_name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type,
        color: POI_TYPE_MAP[r.poi_type]?.color || '#999',
        address: r.address, lng: r.lng, lat: r.lat,
        greenway_name: r.greenway_name
      }))
    })
  } catch (err) {
    console.error('[POI-Search] 查询失败:', err.message)
    res.status(500).json({ results: [] })
  }
})

// 管理后台：POI 点击趋势
router.get('/admin/poi/click-trend', authMiddleware, adminOnly, async (req, res) => {
  try {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days) || 30))
    const result = await req.pool.query(`
      SELECT d::date as date, COALESCE(c.cnt, 0) as cnt
      FROM generate_series(CURRENT_DATE - INTERVAL '${days - 1} days', CURRENT_DATE, '1 day') d
      LEFT JOIN (
        SELECT clicked_at::date as dt, COUNT(*) as cnt
        FROM poi_clicks
        WHERE clicked_at > CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY clicked_at::date
      ) c ON d::date = c.dt
      ORDER BY d::date
    `)
    res.json({ data: result.rows.map(r => ({ date: r.date, cnt: parseInt(r.cnt) })) })
  } catch (e) { res.status(500).json({ data: [] }) }
})

// 管理后台：POI 类型点击分布（景点 110100/110200 合并为一类）
router.get('/admin/poi/type-clicks', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT
        CASE WHEN poi_type IN ('110100','110200') THEN '110100' ELSE poi_type END AS poi_type,
        COUNT(*) as cnt
      FROM poi_clicks
      GROUP BY 1
      ORDER BY cnt DESC
    `)
    res.json({ data: result.rows.map(r => ({
      poi_type: r.poi_type,
      type_name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type,
      cnt: parseInt(r.cnt)
    })) })
  } catch (e) { res.status(500).json({ data: [] }) }
})

// 管理后台：热门 POI TOP N
router.get('/admin/poi/top', authMiddleware, adminOnly, async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 10))
    const result = await req.pool.query(`
      SELECT pc.poi_name, pc.poi_type, g.name as greenway_name, COUNT(*) as cnt
      FROM poi_clicks pc
      LEFT JOIN greenways g ON g.id = pc.greenway_id
      GROUP BY pc.poi_name, pc.poi_type, g.name
      ORDER BY cnt DESC LIMIT $1
    `, [limit])
    res.json({ data: result.rows.map(r => ({
      poi_name: r.poi_name,
      poi_type: r.poi_type,
      type_name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type,
      greenway_name: r.greenway_name || '未知',
      cnt: parseInt(r.cnt)
    })) })
  } catch (e) { res.status(500).json({ data: [] }) }
})

// 管理后台：POI 统计
router.get('/admin/poi/stats', async (req, res) => {
  try {
    // 总览统计
    const overview = await req.pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT CASE WHEN poi_type IN ('110100','110200') THEN '110100' ELSE poi_type END) AS type_count,
        COUNT(DISTINCT greenway_id) AS greenway_count
      FROM points_of_interest
    `)
    // 今日点击 + 最热类型
    const today = await req.pool.query(`SELECT COUNT(*) FROM poi_clicks WHERE clicked_at > CURRENT_DATE`)
    const topType = await req.pool.query(`SELECT poi_type, COUNT(*) as cnt FROM poi_clicks GROUP BY poi_type ORDER BY cnt DESC LIMIT 1`)

    // 各绿道 POI 分布
    const breakdown = await req.pool.query(`
      SELECT
        g.id, g.name,
        COUNT(*) FILTER (WHERE poi.poi_type = '150500') AS subway,
        COUNT(*) FILTER (WHERE poi.poi_type = '150700') AS bus,
        COUNT(*) FILTER (WHERE poi.poi_type = '150900') AS parking,
        COUNT(*) FILTER (WHERE poi.poi_type = '200300') AS restroom,
        COUNT(*) FILTER (WHERE poi.poi_type = '060100') AS store,
        COUNT(*) FILTER (WHERE poi.poi_type = '080600') AS cinema,
        COUNT(*) FILTER (WHERE poi.poi_type IN ('110100','110200')) AS scenic,
        COUNT(*) AS total
      FROM greenways g
      LEFT JOIN points_of_interest poi ON poi.greenway_id = g.id
      GROUP BY g.id, g.name
      ORDER BY g.id
    `)

    // 各类型总计
    const typeTotals = await req.pool.query(`
      SELECT poi_type, COUNT(*) AS cnt
      FROM points_of_interest
      GROUP BY poi_type
      ORDER BY poi_type
    `)

    res.json({
      total: parseInt(overview.rows[0]?.total || 0),
      typeCount: parseInt(overview.rows[0]?.type_count || 0),
      greenwayCount: parseInt(overview.rows[0]?.greenway_count || 0),
      todayClicks: parseInt(today.rows[0]?.count || 0),
      topType: POI_TYPE_MAP[topType.rows[0]?.poi_type]?.name || '暂无数据',
      type_total: typeTotals.rows.map(r => ({
        ...r,
        name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type,
        icon: POI_TYPE_MAP[r.poi_type]?.icon || 'fa-map-marker-alt'
      })),
      greenway_breakdown: breakdown.rows
    })
  } catch (err) {
    console.error('[POI-Admin] 统计失败:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POI 点击埋点
router.post('/poi/click', async (req, res) => {
  try {
    const { poi_id, poi_name, poi_type, greenway_id } = req.body
    if (!poi_name) return res.status(400).json({ code: 1, message: '缺少POI名称' })

    // 插入点击记录
    await req.pool.query(
      'INSERT INTO poi_clicks (poi_id, poi_name, poi_type, greenway_id) VALUES ($1,$2,$3,$4)',
      [poi_id || null, poi_name, poi_type || null, greenway_id || null]
    )

    // 同步更新对应绿道的 poi_click_count + 热力指数
    if (greenway_id) {
      await req.pool.query(`
        UPDATE greenway_heatmap h
        SET poi_click_count = poi_click_count + 1,
            heat_index = ROUND((click_count * 0.15 + route_count * 0.40 + comment_count * 0.20 + (poi_click_count + 1) * 0.25)::numeric, 1),
            last_updated = CURRENT_TIMESTAMP
        FROM greenways g
        WHERE g.id = $1 AND h.greenway_name = g.name
      `, [greenway_id])
    }

    res.json({ code: 0, message: 'ok' })
  } catch (e) {
    console.error('[POI-click] 失败:', e.message)
    res.status(500).json({ code: 1, message: '记录失败' })
  }
})

// 服务启动时预热设施缓存（复用与路由相同的 key，避免重复查询）
export function preloadFacilitiesCache(pool) {
  return cached('poi:facilities', FACILITIES_TTL, () => queryAllFacilities(pool))
}

// POI 类型定义（供前端使用）
router.get('/poi-types', (_req, res) => {
  res.json(Object.entries(POI_TYPE_MAP).map(([code, info]) => ({ code, ...info })))
})

export default router
