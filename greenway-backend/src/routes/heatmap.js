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

  if (!greenway_name) {
    return res.status(400).json({ code: 1, message: '缺少绿道名称' });
  }

  // 校验名称不含 U+FFFD 等替换字符
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
      'INSERT INTO greenway_clicks (greenway_name, user_id) VALUES ($1, $2)',
      [greenway_name, user_id || null]
    );

    // 更新热度表 (新公式: click*0.2 + route*0.5 + comment*0.3)
    await req.pool.query(
      `INSERT INTO greenway_heatmap (greenway_name, click_count, heat_index)
       VALUES ($1, 1, 0.2)
       ON CONFLICT (greenway_name)
       DO UPDATE SET
         click_count = greenway_heatmap.click_count + 1,
         heat_index = (greenway_heatmap.click_count + 1) * 0.2
                    + greenway_heatmap.route_count * 0.5
                    + greenway_heatmap.comment_count * 0.3,
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
    const result = await req.pool.query(`
      SELECT
        h.greenway_name,
        h.click_count,
        h.route_count,
        h.comment_count,
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
        comment_count: parseInt(r.comment_count || 0),
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

/**
 * GET /api/heatmap/points
 * 沿绿道LineString密集采样点，供热力图FeatureLayer使用
 * 每条绿道采样~200个点，总共约3400个点
 */
router.get('/points', async (req, res) => {
  try {
    const result = await req.pool.query(`
      WITH lines AS (
        SELECT
          h.greenway_name,
          h.heat_index,
          (ST_Dump(g.geometry)).geom as line
        FROM greenway_heatmap h
        JOIN greenways g ON g.name = h.greenway_name
        WHERE g.geometry IS NOT NULL
          AND h.heat_index IS NOT NULL
      ),
      sampled AS (
        SELECT
          greenway_name,
          heat_index,
          (ST_DumpPoints(ST_LineInterpolatePoints(line, 0.005))).geom as pt
        FROM lines
        WHERE ST_GeometryType(line) = 'ST_LineString'
      )
      SELECT
        greenway_name,
        heat_index,
        ST_X(pt) as lng,
        ST_Y(pt) as lat
      FROM sampled
      WHERE ST_GeometryType(pt) = 'ST_Point'
    `);

    const points = result.rows.map(r => ({
      greenway_name: r.greenway_name,
      heat_index: Math.round(parseFloat(r.heat_index) * 10) / 10,
      lng: parseFloat(r.lng),
      lat: parseFloat(r.lat)
    }));

    res.json({ code: 0, data: points, total: points.length });
  } catch (e) {
    console.error('[热力图] 获取采样点失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

// ==================== 管理后台 API ====================

/**
 * GET /api/admin/heatmap/overview
 * 热度概览统计 (含评论数)
 */
router.get('/overview', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [todayClicks, todayRoutes, todayComments, topGreenway, activeUsers] = await Promise.all([
      req.pool.query('SELECT COUNT(*) FROM greenway_clicks WHERE clicked_at > CURRENT_DATE'),
      req.pool.query('SELECT COUNT(*) FROM route_planning_records WHERE created_at > CURRENT_DATE AND is_greenway_related = true'),
      req.pool.query('SELECT COUNT(*) FROM greenway_comments WHERE created_at > CURRENT_DATE AND status = \'visible\''),
      req.pool.query(
        `SELECT h.greenway_name, h.heat_index FROM greenway_heatmap h
         INNER JOIN greenways g ON g.name = h.greenway_name
         ORDER BY h.heat_index DESC LIMIT 1`
      ),
      req.pool.query('SELECT COUNT(DISTINCT user_id) FROM greenway_clicks WHERE clicked_at > CURRENT_DATE AND user_id IS NOT NULL')
    ]);

    res.json({
      code: 0,
      data: {
        today_clicks: parseInt(todayClicks.rows[0]?.count || 0),
        today_routes: parseInt(todayRoutes.rows[0]?.count || 0),
        today_comments: parseInt(todayComments.rows[0]?.count || 0),
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
 * 热度趋势数据 (含评论)
 */
router.get('/trend', authMiddleware, adminOnly, async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));

  try {
    const result = await req.pool.query(`
      SELECT
        d::date as date,
        COALESCE(c.click_count, 0) as click_count,
        COALESCE(r.route_count, 0) as route_count,
        COALESCE(cm.comment_count, 0) as comment_count,
        ROUND((COALESCE(c.click_count, 0) * 0.2 + COALESCE(r.route_count, 0) * 0.5 + COALESCE(cm.comment_count, 0) * 0.3)::numeric, 1) as heat_index
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
      LEFT JOIN (
        SELECT created_at::date as dt, COUNT(*) as comment_count
        FROM greenway_comments
        WHERE created_at > CURRENT_DATE - INTERVAL '${days} days'
          AND status = 'visible'
        GROUP BY created_at::date
      ) cm ON d::date = cm.dt
      ORDER BY d::date
    `);

    res.json({
      code: 0,
      data: result.rows.map(r => ({
        date: r.date,
        click_count: parseInt(r.click_count),
        route_count: parseInt(r.route_count),
        comment_count: parseInt(r.comment_count),
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
 * 热度排名 (含评论数)
 */
router.get('/rank', authMiddleware, adminOnly, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await req.pool.query(`
      SELECT h.greenway_name, h.click_count, h.route_count, h.comment_count, h.heat_index, h.last_updated
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
        comment_count: parseInt(r.comment_count || 0),
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
 * 点击量 vs 路径规划量 vs 评论量对比
 */
router.get('/compare', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT h.greenway_name, h.click_count, h.route_count, h.comment_count
      FROM greenway_heatmap h
      INNER JOIN greenways g ON g.name = h.greenway_name
      ORDER BY h.heat_index DESC
    `);

    res.json({
      code: 0,
      data: result.rows.map(r => ({
        greenway_name: r.greenway_name,
        click_count: parseInt(r.click_count),
        route_count: parseInt(r.route_count),
        comment_count: parseInt(r.comment_count || 0)
      }))
    });
  } catch (e) {
    console.error('[热力图] 获取对比数据失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

// ==================== 评论统计 API (新增) ====================

/**
 * GET /api/admin/heatmap/comment-stats
 * 评论总览统计
 */
router.get('/comment-stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [total, today, avgRating, top] = await Promise.all([
      req.pool.query('SELECT COUNT(*) FROM greenway_comments WHERE status = \'visible\''),
      req.pool.query('SELECT COUNT(*) FROM greenway_comments WHERE created_at > CURRENT_DATE AND status = \'visible\''),
      req.pool.query('SELECT ROUND(AVG(rating)::numeric, 1) as avg_rating FROM greenway_comments WHERE rating IS NOT NULL AND status = \'visible\''),
      req.pool.query(
        `SELECT g.name as greenway_name, COUNT(*) as cnt
         FROM greenway_comments c
         JOIN greenways g ON g.id = c.greenway_id
         WHERE c.status = 'visible'
         GROUP BY g.name
         ORDER BY cnt DESC LIMIT 1`
      )
    ]);

    res.json({
      code: 0,
      data: {
        total_comments: parseInt(total.rows[0]?.count || 0),
        today_comments: parseInt(today.rows[0]?.count || 0),
        avg_rating: parseFloat(avgRating.rows[0]?.avg_rating || 0),
        top_greenway: top.rows[0]?.greenway_name || '暂无数据'
      }
    });
  } catch (e) {
    console.error('[热力图] 获取评论统计失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

/**
 * GET /api/admin/heatmap/comment-rank?limit=10
 * 评论数量排名
 */
router.get('/comment-rank', authMiddleware, adminOnly, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await req.pool.query(`
      SELECT g.name as greenway_name, COUNT(*)::int as comment_count,
             ROUND(AVG(c.rating)::numeric, 1) as avg_rating
      FROM greenway_comments c
      JOIN greenways g ON g.id = c.greenway_id
      WHERE c.status = 'visible'
      GROUP BY g.name
      ORDER BY comment_count DESC
      LIMIT $1
    `, [limit]);

    res.json({
      code: 0,
      data: result.rows.map(r => ({
        greenway_name: r.greenway_name,
        comment_count: r.comment_count,
        avg_rating: r.avg_rating
      }))
    });
  } catch (e) {
    console.error('[热力图] 获取评论排名失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

/**
 * GET /api/admin/heatmap/comment-trend?days=30
 * 评论数量趋势
 */
router.get('/comment-trend', authMiddleware, adminOnly, async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days) || 30));

  try {
    const result = await req.pool.query(`
      SELECT
        d::date as date,
        COALESCE(c.comment_count, 0) as comment_count
      FROM generate_series(CURRENT_DATE - INTERVAL '${days - 1} days', CURRENT_DATE, '1 day') d
      LEFT JOIN (
        SELECT created_at::date as dt, COUNT(*) as comment_count
        FROM greenway_comments
        WHERE created_at > CURRENT_DATE - INTERVAL '${days} days'
          AND status = 'visible'
        GROUP BY created_at::date
      ) c ON d::date = c.dt
      ORDER BY d::date
    `);

    res.json({
      code: 0,
      data: result.rows.map(r => ({
        date: r.date,
        comment_count: parseInt(r.comment_count)
      }))
    });
  } catch (e) {
    console.error('[热力图] 获取评论趋势失败:', e.message);
    res.status(500).json({ code: 1, message: e.message });
  }
});

export default router;
