/**
 * 用户收藏 - API
 * 路由（全部需登录 authMiddleware）：
 *   GET    /api/favorites/ids           取当前用户收藏的绿道 id 列表（按钮态）
 *   GET    /api/favorites               取收藏列表（JOIN greenways）
 *   POST   /api/favorites               添加收藏 body: { greenway_id | greenway_name }
 *   DELETE /api/favorites/:greenwayId   取消收藏
 *   GET    /api/user/stats              个人中心统计（收藏/骑行/里程/评论）
 */
import { Router } from 'express';
import { authMiddleware } from '../auth.js';

const router = Router();

/** 解析 greenway_id：支持直接传 id 或传 name 反查 */
async function resolveGreenwayId(pool, { greenway_id, greenway_name }) {
  if (greenway_id) return parseInt(greenway_id);
  if (greenway_name) {
    const { rows } = await pool.query('SELECT id FROM greenways WHERE name = $1', [greenway_name]);
    return rows[0]?.id || null;
  }
  return null;
}

// 收藏的绿道 id 列表
router.get('/favorites/ids', authMiddleware, async (req, res) => {
  try {
    const { rows } = await req.pool.query(
      'SELECT greenway_id FROM user_favorites WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ code: 0, data: { ids: rows.map(r => r.greenway_id) } });
  } catch (err) {
    console.error('[favorites/ids]', err.message);
    res.status(500).json({ code: 1, message: '服务器错误' });
  }
});

// 收藏列表（带绿道展示字段）
router.get('/favorites', authMiddleware, async (req, res) => {
  try {
    const { rows } = await req.pool.query(`
      SELECT f.id, f.greenway_id, f.created_at,
             g.name, g.length, g.description, g.coverage_area, g.location, g.image
      FROM user_favorites f
      JOIN greenways g ON g.id = f.greenway_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `, [req.user.id]);
    res.json({ code: 0, data: rows });
  } catch (err) {
    console.error('[favorites]', err.message);
    res.status(500).json({ code: 1, message: '服务器错误' });
  }
});

// 添加收藏（幂等）
router.post('/favorites', authMiddleware, async (req, res) => {
  try {
    const greenwayId = await resolveGreenwayId(req.pool, req.body);
    if (!greenwayId) {
      return res.status(400).json({ code: 1, message: '无效的绿道 ID 或名称' });
    }
    await req.pool.query(
      `INSERT INTO user_favorites (user_id, greenway_id) VALUES ($1, $2)
       ON CONFLICT (user_id, greenway_id) DO NOTHING`,
      [req.user.id, greenwayId]
    );
    res.json({ code: 0, message: '收藏成功', data: { favorited: true, greenway_id: greenwayId } });
  } catch (err) {
    console.error('[favorites POST]', err.message);
    res.status(500).json({ code: 1, message: '服务器错误' });
  }
});

// 取消收藏
router.delete('/favorites/:greenwayId', authMiddleware, async (req, res) => {
  try {
    await req.pool.query(
      'DELETE FROM user_favorites WHERE user_id = $1 AND greenway_id = $2',
      [req.user.id, parseInt(req.params.greenwayId)]
    );
    res.json({ code: 0, message: '已取消收藏', data: { favorited: false } });
  } catch (err) {
    console.error('[favorites DELETE]', err.message);
    res.status(500).json({ code: 1, message: '服务器错误' });
  }
});

// 个人中心统计
router.get('/user/stats', authMiddleware, async (req, res) => {
  try {
    const { rows } = await req.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM user_favorites WHERE user_id = $1) AS favorite_count,
        (SELECT COUNT(*) FROM route_planning_records WHERE user_id = $1 AND travel_mode = 'bicycling') AS ride_count,
        (SELECT COALESCE(SUM(distance), 0) / 1000.0 FROM route_planning_records WHERE user_id = $1) AS total_distance_km,
        (SELECT COUNT(*) FROM greenway_comments WHERE user_id = $1 AND status = 'visible') AS comment_count
    `, [req.user.id]);
    const r = rows[0];
    res.json({
      code: 0,
      data: {
        favorite_count: parseInt(r.favorite_count),
        ride_count: parseInt(r.ride_count),
        total_distance_km: Math.round(parseFloat(r.total_distance_km) * 10) / 10,
        comment_count: parseInt(r.comment_count)
      }
    });
  } catch (err) {
    console.error('[user/stats]', err.message);
    res.status(500).json({ code: 1, message: '服务器错误' });
  }
});

export default router;
