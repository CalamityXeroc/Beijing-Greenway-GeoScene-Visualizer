/**
 * 用户反馈 - 数据库表创建脚本
 * 运行: node scripts/add-feedback-table.js
 * 表结构: user_feedback
 *   - source: 'web' | 'app'（区分 Web 端与 App 端反馈）
 *   - status: 'pending' | 'processing' | 'resolved'
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'greenway'
});

async function main() {
  try {
    console.log('[反馈迁移] 正在创建反馈相关表...\n');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_feedback (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        source     VARCHAR(10) DEFAULT 'web',
        type       VARCHAR(20) DEFAULT 'suggestion',
        content    TEXT NOT NULL,
        contact    VARCHAR(100),
        status     VARCHAR(10) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ user_feedback 表已创建/已存在');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_feedback_source ON user_feedback(source)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_feedback_created ON user_feedback(created_at DESC)');
    console.log('  ✓ 索引已就绪');

    const check = await pool.query('SELECT COUNT(*) as cnt FROM user_feedback');
    console.log(`\n[反馈迁移] 🎉 完成！user_feedback: ${check.rows[0].cnt} 条记录`);
  } catch (err) {
    console.error('[反馈迁移] ✗ 失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
