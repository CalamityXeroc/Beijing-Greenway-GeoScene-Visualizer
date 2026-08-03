/**
 * 用户收藏 - 数据库表创建脚本
 * 运行: node scripts/add-favorites-table.js  或  npm run db:favorites
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
    console.log('[收藏迁移] 正在创建收藏相关表...\n');

    // 1. 用户收藏表（绿道收藏，user_id + greenway_id 唯一）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        greenway_id INTEGER NOT NULL REFERENCES greenways(id) ON DELETE CASCADE,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, greenway_id)
      )
    `);
    console.log('  ✓ user_favorites 表已创建/已存在');

    // 2. 索引
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_favorites_greenway ON user_favorites(greenway_id)');
    console.log('  ✓ 索引已就绪');

    // 3. 验证
    const check = await pool.query('SELECT COUNT(*) as cnt FROM user_favorites');
    console.log(`\n[收藏迁移] 🎉 完成！user_favorites: ${check.rows[0].cnt} 条记录`);

  } catch (err) {
    console.error('[收藏迁移] ✗ 失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
