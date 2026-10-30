import express from 'express'
const router = express.Router()

// POST /api/route/record - 保存路径规划记录 + 绿道关联判断
router.post('/record', async (req, res) => {
  const { user_id, origin, destination, waypoints, travel_mode, distance, duration } = req.body

  if (!user_id || !origin || !destination) {
    return res.status(400).json({ code: 1, message: '缺少必要参数' })
  }

  // 坐标必须是有限数值：此前的实现直接把这些值拼进 SQL（公开接口，可被注入）
  const coords = [origin.lng, origin.lat, destination.lng, destination.lat].map((v) => Number(v))
  if (!coords.every((v) => Number.isFinite(v))) {
    return res.status(400).json({ code: 1, message: '坐标参数非法' })
  }
  const [oLng, oLat, dLng, dLat] = coords

  try {
    // PostGIS 绿道关联判断：构建路线线段，查询 500m 内的绿道
    const greenwayResult = await req.pool.query(`
      SELECT name FROM greenways
      WHERE geometry IS NOT NULL
        AND ST_DWithin(geometry, ST_SetSRID(ST_MakeLine(ARRAY[
          ST_SetSRID(ST_MakePoint($1, $2), 4326),
          ST_SetSRID(ST_MakePoint($3, $4), 4326)
        ]), 4326), 0.005)
        AND ST_NumGeometries(geometry) > 0
      LIMIT 10
    `, [oLng, oLat, dLng, dLat])

    const is_greenway_related = greenwayResult.rows.length > 0
    const related_greenways = JSON.stringify(greenwayResult.rows.map(r => r.name))

    // 插入记录
    const result = await req.pool.query(`
      INSERT INTO route_planning_records
        (user_id, origin_lng, origin_lat, origin_address,
         destination_lng, destination_lat, destination_address,
         waypoints, travel_mode, is_greenway_related, related_greenways,
         distance, duration)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING record_id
    `, [
      user_id,
      origin.lng, origin.lat, origin.address || '',
      destination.lng, destination.lat, destination.address || '',
      JSON.stringify(waypoints || []),
      travel_mode || 'walking',
      is_greenway_related,
      related_greenways,
      distance || 0,
      duration || 0
    ])

    res.json({
      code: 0,
      message: '记录成功',
      data: {
        record_id: result.rows[0].record_id,
        is_greenway_related,
        related_greenways: greenwayResult.rows.map(r => r.name)
      }
    })
  } catch (e) {
    console.error('[路径规划记录] 保存失败:', e.message)
    res.status(500).json({ code: 1, message: '保存失败' })
  }
})

// GET /api/route/stats/greenway-rank - 绿道热度排名
router.get('/stats/greenway-rank', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100)
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 90, 1), 3650)

  try {
    const result = await req.pool.query(`
      SELECT
        j.greenway_name,
        COUNT(*) as count
      FROM route_planning_records r,
           jsonb_array_elements_text(r.related_greenways) j(greenway_name)
      WHERE r.is_greenway_related = true
        AND r.created_at > NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY j.greenway_name
      ORDER BY count DESC
      LIMIT $1
    `, [limit, days])

    res.json({ code: 0, data: result.rows })
  } catch (e) {
    console.error('[统计] 获取排名失败:', e.message)
    res.status(500).json({ code: 1, message: e.message })
  }
})

// GET /api/route/stats/overview - 总体统计
router.get('/stats/overview', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT
        COUNT(*) as total_plans,
        COUNT(*) FILTER (WHERE is_greenway_related) as greenway_related,
        COUNT(*) FILTER (WHERE NOT is_greenway_related) as non_greenway,
        COUNT(*) FILTER (WHERE travel_mode = 'walking') as walking,
        COUNT(*) FILTER (WHERE travel_mode = 'bicycling') as bicycling,
        COUNT(*) FILTER (WHERE created_at > CURRENT_DATE) as today_plans,
        COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '7 days') as week_plans,
        COUNT(DISTINCT user_id) as total_users
      FROM route_planning_records
    `)

    res.json({ code: 0, data: result.rows[0] })
  } catch (e) {
    console.error('[统计] 获取概览失败:', e.message)
    res.status(500).json({ code: 1, message: e.message })
  }
})

// GET /api/route/stats/trend - 近7天趋势
router.get('/stats/trend', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT
        d::date as date,
        COUNT(r.record_id) as total,
        COUNT(r.record_id) FILTER (WHERE r.is_greenway_related) as greenway_related,
        COUNT(r.record_id) FILTER (WHERE NOT r.is_greenway_related) as non_greenway
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
      LEFT JOIN route_planning_records r ON r.created_at::date = d::date
      GROUP BY d::date
      ORDER BY d::date
    `)

    res.json({ code: 0, data: result.rows })
  } catch (e) {
    console.error('[统计] 获取趋势失败:', e.message)
    res.status(500).json({ code: 1, message: e.message })
  }
})

// GET /api/route/stats/records - 分页记录列表
router.get('/stats/records', async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100)
  const travelMode = req.query.travel_mode || ''
  const greenwayOnly = req.query.greenway_only === 'true'
  const offset = (page - 1) * pageSize

  try {
    let where = 'WHERE 1=1'
    const params = []

    if (travelMode) {
      params.push(travelMode)
      where += ` AND r.travel_mode = $${params.length}`
    }
    if (greenwayOnly) {
      where += ' AND r.is_greenway_related = true'
    }

    const countResult = await req.pool.query(
      `SELECT COUNT(*) FROM route_planning_records r ${where}`, params)
    const total = parseInt(countResult.rows[0].count)

    params.push(pageSize, offset)
    const result = await req.pool.query(`
      SELECT r.*, u.username, u.nickname
      FROM route_planning_records r
      LEFT JOIN users u ON r.user_id = u.id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    res.json({
      code: 0,
      data: {
        records: result.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    })
  } catch (e) {
    console.error('[统计] 获取记录列表失败:', e.message)
    res.status(500).json({ code: 1, message: e.message })
  }
})

export default router
