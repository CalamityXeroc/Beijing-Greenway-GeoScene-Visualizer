/**
 * 用户反馈 API
 * 路由：
 *   POST   /api/feedback                   提交反馈（公开；带 token 可选关联用户）
 *   GET    /api/admin/feedback             反馈列表（管理员）
 *   GET    /api/admin/feedback/stats       反馈统计（管理员）
 *   PATCH  /api/admin/feedback/:id/status  更新反馈状态（管理员）
 *
 * source: 'web' | 'app'（区分 Web 端与 App 端）
 * status: 'pending' | 'processing' | 'resolved'
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, adminOnly } from '../auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'greenway-secret-2025-change-me';

const TYPE_MAP = { suggestion: '功能建议', bug: '问题反馈', content: '内容纠错', other: '其他' };
const SOURCE_MAP = { web: 'Web 端', app: 'App 端' };
const STATUS_MAP = { pending: '待处理', processing: '处理中', resolved: '已解决' };

// 可选认证：带合法 token 则解析出 user，否则 user=null
function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { req.user = null; return next(); }
  try { req.user = jwt.verify(auth.slice(7), JWT_SECRET); }
  catch { req.user = null; }
  next();
}

/**
 * POST /api/feedback
 * body: { source?, type?, content, contact? }
 */
router.post('/feedback', optionalAuth, async (req, res) => {
  const { source = 'web', type = 'suggestion', content, contact } = req.body || {};

  if (!content || !content.trim()) {
    return res.status(400).json({ code: 400, message: '反馈内容不能为空' });
  }
  const text = content.trim();
  if (text.length > 2000) {
    return res.status(400).json({ code: 400, message: '反馈内容不能超过 2000 字' });
  }
  const src = ['web', 'app'].includes(source) ? source : 'web';
  const tp = TYPE_MAP[type] ? type : 'suggestion';

  try {
    const { rows } = await req.pool.query(
      `INSERT INTO user_feedback (user_id, source, type, content, contact)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, source, type, content, contact, status, created_at`,
      [req.user?.id || null, src, tp, text, (contact || '').trim().slice(0, 100) || null]
    );

    res.status(201).json({ code: 200, message: '反馈提交成功', data: rows[0] });
  } catch (err) {
    console.error('[反馈] 提交失败:', err.message);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin/feedback?page=1&pageSize=20&source=&type=&status=&keyword=
 */
router.get('/admin/feedback', authMiddleware, adminOnly, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
  const { source = '', type = '', status = '', keyword = '' } = req.query;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const params = [];
  if (source) { params.push(source); conditions.push(`f.source = $${params.length}`); }
  if (type)   { params.push(type);   conditions.push(`f.type = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`f.status = $${params.length}`); }
  if (keyword) {
    params.push(`%${keyword}%`);
    conditions.push(`(f.content ILIKE $${params.length} OR COALESCE(f.contact,'') ILIKE $${params.length} OR COALESCE(u.username,'') ILIKE $${params.length})`);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const countRes = await req.pool.query(
      `SELECT COUNT(*) FROM user_feedback f LEFT JOIN users u ON u.id = f.user_id ${where}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    params.push(pageSize, offset);
    const { rows } = await req.pool.query(
      `SELECT f.id, f.source, f.type, f.content, f.contact, f.status, f.created_at,
              f.user_id, COALESCE(u.username, '') AS username, COALESCE(u.nickname, '') AS nickname
       FROM user_feedback f
       LEFT JOIN users u ON u.id = f.user_id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      code: 200,
      data: {
        list: rows.map(r => ({
          ...r,
          type_label: TYPE_MAP[r.type] || r.type,
          source_label: SOURCE_MAP[r.source] || r.source,
          status_label: STATUS_MAP[r.status] || r.status
        })),
        total, page, pageSize
      }
    });
  } catch (err) {
    console.error('[反馈] 列表失败:', err.message);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * GET /api/admin/feedback/stats
 */
router.get('/admin/feedback/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [total, pending, web, app] = await Promise.all([
      req.pool.query('SELECT COUNT(*) FROM user_feedback'),
      req.pool.query("SELECT COUNT(*) FROM user_feedback WHERE status = 'pending'"),
      req.pool.query("SELECT COUNT(*) FROM user_feedback WHERE source = 'web'"),
      req.pool.query("SELECT COUNT(*) FROM user_feedback WHERE source = 'app'")
    ]);
    res.json({
      code: 200,
      data: {
        total: parseInt(total.rows[0].count),
        pending: parseInt(pending.rows[0].count),
        web: parseInt(web.rows[0].count),
        app: parseInt(app.rows[0].count)
      }
    });
  } catch (err) {
    console.error('[反馈] 统计失败:', err.message);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

/**
 * PATCH /api/admin/feedback/:id/status
 * body: { status: 'pending' | 'processing' | 'resolved' }
 */
router.patch('/admin/feedback/:id/status', authMiddleware, adminOnly, async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'processing', 'resolved'].includes(status)) {
    return res.status(400).json({ code: 400, message: 'status 值非法' });
  }
  try {
    const { rows } = await req.pool.query(
      `UPDATE user_feedback SET status = $1 WHERE id = $2 RETURNING id, status`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ code: 404, message: '反馈不存在' });
    res.json({ code: 200, message: '状态已更新', data: rows[0] });
  } catch (err) {
    console.error('[反馈] 状态更新失败:', err.message);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
});

export default router;
