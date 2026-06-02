import express from 'express';
import { authMiddleware, adminOnly } from '../auth.js';

const router = express.Router();

// ==================== 公开 API ====================

/**
 * POST /api/heatmap/click
 * 记录用户点击绿道
 * body: { greenway_name, user_id? }
 */
router.post('/click', async (req, res) => {
  const { greenway_name, user_id } = req.body;
  // DEBUG: 打印原始数据排查编码问题
  const raw = JSON.stringify(req.body);
  const nameHex = [...(greenway_name || '')].map(c => c.codePointAt(0).toString(16)).join(' ');
  console.log('[heatmap/click] raw body:', raw);
  console.log('[heatmap/click] greenway_name hex:', nameHex);

  if (!greenway_name) {
    return res.status(400).json({ code: 1, message: '缺少绿道名称' });
  }

  // 校验名称不含 U+FFFD 等替换字符，防止编码损坏写入数据库
  if (/[�]/.test(greenway_name)) {
    return res.status(400).json({ code: 1, message: '绿道名称包含非法字符' });
  }

  try {
    // 校验该绿道在 greenways 表中存在
    const valid = await req.pool.query(
      'SELECT 1 FROM greenways WHERE name = $1', [greenway_name]
    );
    if (valid.rows.length === 0) {
      return res.status(400).json({ code: 1, message: '无效的绿道名称' });
    }

    // 插入点击记录
    await req.pool.query(
      `INSERT INTO greenway_clicks (greenway_name, user_id) VALUES ($1, $2)`,
      [greenway_name, user_id || null]
    );

    // 更新热度表
    await req.pool.query(
      `INSERT INTO greenway_heatmap (greenway_name, click_count, heat_index)
       VALUES ($1, 1, 0.3)
       ON CONFLICT (greenway_name)
       DO UPDATE SET
         click_count = greenway_heatmap.click_count + 1,
         heat_index = (greenway_heatmap.click_count + 1) * 0.3 + greenway_heatmap.route_count * 0.7,
         last_updated = CURRENT_TIMESTAMP`,
      [greenway_name]
    );

    res.json({ code: 0, message: 'ok' });
  } catch (e) {
    console.error('[热力图] 记录点击失败:', e.message);
    res.status(500).json({ code: 1, message: '记录失败' });
  }
});

/**
 * GET /api/heatmap/data
 * 获取所有绿道热度数据（供前端热力图使用）
 */
router.get('/data', async (req, res) => {
  try {
    // 获取绿道热度 + 绿道中心点坐标
    const result = await req.pool.query(`
      SELECT
        h.greenway_name,
        h.click_count,
        h.route_count,
        h.heat_index,
        h.last_updated,
        ST_X(ST_Centroid(g.geometry)) as center_lng,
        ST_Y(ST_Centroid(g.geometry)) as center_lat
      FROM greenway_heatmap h
      LEFT JOIN greenways g ON g.name = h.greenway_name
      WHERE g.geometry IS NOT NULL
      ORDER BY h.heat_index DESC
    `);

    res.json({
      code: 0,
      data: result.rows.map(r => ({
        greenway_name: r.greenway_name,
        click_count: parseInt(r.click_count),
        route_count: parseInt(r.route_count),
        heat_index: Math.round(r.heat_index * 10) / 10,
        center_lng: r.center_lng,
        center_lat: r.center_lat,
        last_updated: r.last_updated
      }))
    });
  } catch (e) {
    console.error('[热力图] 获取数据失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

// ==================== 管理后台 API ====================

/**
 * GET /api/admin/heatmap/overview
 * 热度概览统计
 */
router.get('/overview', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [todayClicks, todayRoutes, topGreenway, activeUsers] = await Promise.all([
      req.pool.query(
        `SELECT COUNT(*) FROM greenway_clicks WHERE clicked_at > CURRENT_DATE`
      ),
      req.pool.query(
        `SELECT COUNT(*) FROM route_planning_records
         WHERE created_at > CURRENT_DATE AND is_greenway_related = true`
      ),
      req.pool.query(
        `SELECT h.greenway_name, h.heat_index FROM greenway_heatmap h
         INNER JOIN greenways g ON g.name = h.greenway_name
         ORDER BY h.heat_index DESC LIMIT 1`
      ),
      req.pool.query(
        `SELECT COUNT(DISTINCT user_id) FROM greenway_clicks
         WHERE clicked_at > CURRENT_DATE AND user_id IS NOT NULL`
      )
    ]);

    res.json({
      code: 0,
      data: {
        today_clicks: parseInt(todayClicks.rows[0]?.count || 0),
        today_routes: parseInt(todayRoutes.rows[0]?.count || 0),
        top_greenway: topGreenway.rows[0]?.greenway_name || '暂无数据',
        active_users: parseInt(activeUsers.rows[0]?.count || 0)
      }
    });
  } catch (e) {
    console.error('[热力图] 获取概览失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

/**
 * GET /api/admin/heatmap/trend?days=30
 * 热度趋势数据
 */
router.get('/trend', authMiddleware, adminOnly, async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));

  try {
    const result = await req.pool.query(`
      SELECT
        d::date as date,
        COALESCE(c.click_count, 0) as click_count,
        COALESCE(r.route_count, 0) as route_count,
        ROUND((COALESCE(c.click_count, 0) * 0.3 + COALESCE(r.route_count, 0) * 0.7)::numeric, 1) as heat_index
      FROM generate_series(CURRENT_DATE - INTERVAL '${days - 1} days', CURRENT_DATE, '1 day') d
      LEFT JOIN (
        SELECT clicked_at::date as dt, COUNT(*) as click_count
        FROM greenway_clicks
        WHERE clicked_at > CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY clicked_at::date
      ) c ON d::date = c.dt
      LEFT JOIN (
        SELECT created_at::date as dt, COUNT(*) as route_count
        FROM route_planning_records
        WHERE created_at > CURRENT_DATE - INTERVAL '${days} days'
          AND is_greenway_related = true
        GROUP BY created_at::date
      ) r ON d::date = r.dt
      ORDER BY d::date
    `);

    res.json({
      code: 0,
      data: result.rows.map(r => ({
        date: r.date,
        click_count: parseInt(r.click_count),
        route_count: parseInt(r.route_count),
        heat_index: parseFloat(r.heat_index)
      }))
    });
  } catch (e) {
    console.error('[热力图] 获取趋势失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

/**
 * GET /api/admin/heatmap/rank?limit=10
 * 热度排名
 */
router.get('/rank', authMiddleware, adminOnly, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await req.pool.query(`
      SELECT h.greenway_name, h.click_count, h.route_count, h.heat_index, h.last_updated
      FROM greenway_heatmap h
      INNER JOIN greenways g ON g.name = h.greenway_name
      ORDER BY h.heat_index DESC
      LIMIT $1
    `, [limit]);

    res.json({
      code: 0,
      data: result.rows.map(r => ({
        greenway_name: r.greenway_name,
        click_count: parseInt(r.click_count),
        route_count: parseInt(r.route_count),
        heat_index: Math.round(r.heat_index * 10) / 10,
        last_updated: r.last_updated
      }))
    });
  } catch (e) {
    console.error('[热力图] 获取排名失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

/**
 * GET /api/admin/heatmap/compare
 * 点击量 vs 路径规划量对比
 */
router.get('/compare', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT h.greenway_name, h.click_count, h.route_count
      FROM greenway_heatmap h
      INNER JOIN greenways g ON g.name = h.greenway_name
      ORDER BY h.heat_index DESC
    `);

    res.json({
      code: 0,
      data: result.rows.map(r => ({
        greenway_name: r.greenway_name,
        click_count: parseInt(r.click_count),
        route_count: parseInt(r.route_count)
      }))
    });
  } catch (e) {
    console.error('[热力图] 获取对比数据失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

export default router;
