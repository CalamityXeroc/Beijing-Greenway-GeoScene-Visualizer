/**
 * 绿道热度热力图 - 数据库表创建脚本
 * 运行: node scripts/add-heatmap-tables.js
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

const GREENWAY_NAMES = [
  '环二环城市绿道', '温榆河', '北运河绿道', '亮马河绿道',
  '奥林匹克森林公园绿道', '昌平42绿道', '南沙绿道',
  '常营半马绿道', '丽都商圈绿道', '营城建都绿道',
  '三山五园绿道', '朝阳绿道', '北翼山水绿道',
  '东翼大河绿道', '郊野休闲环绿道', '西翼山水绿道', '中心城滨水绿道'
];

async function main() {
  try {
    console.log('[热力图] 创建热度相关表...\n');

    // 1. 创建绿道热度表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS greenway_heatmap (
        id SERIAL PRIMARY KEY,
        greenway_name VARCHAR(255) NOT NULL,
        click_count INTEGER DEFAULT 0,
        route_count INTEGER DEFAULT 0,
        heat_index FLOAT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(greenway_name)
      )
    `);
    console.log('  ✓ greenway_heatmap 表已创建');

    // 2. 创建点击记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS greenway_clicks (
        id SERIAL PRIMARY KEY,
        greenway_name VARCHAR(255) NOT NULL,
        user_id INTEGER,
        clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ greenway_clicks 表已创建');

    // 3. 创建索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_clicks_greenway ON greenway_clicks(greenway_name)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_clicks_time ON greenway_clicks(clicked_at)
    `);
    console.log('  ✓ 索引已创建');

    // 4. 初始化绿道数据（如果不存在）
    for (const name of GREENWAY_NAMES) {
      await pool.query(`
        INSERT INTO greenway_heatmap (greenway_name)
        VALUES ($1)
        ON CONFLICT (greenway_name) DO NOTHING
      `, [name]);
    }
    console.log(`  ✓ 已初始化 ${GREENWAY_NAMES.length} 条绿道热度记录`);

    // 5. 从已有路径规划记录初始化 route_count（单条SQL批量更新）
    console.log('\n[热力图] 从已有数据初始化热度...');
    const result = await pool.query(`
      WITH route_stats AS (
        SELECT j.greenway_name, COUNT(*)::int as cnt
        FROM route_planning_records r,
             jsonb_array_elements_text(r.related_greenways) j(greenway_name)
        WHERE r.is_greenway_related = true
        GROUP BY j.greenway_name
      )
      UPDATE greenway_heatmap h
      SET route_count = COALESCE(r.cnt, 0),
          heat_index = ROUND((h.click_count * 0.3 + COALESCE(r.cnt, 0) * 0.7)::numeric, 1),
          last_updated = CURRENT_TIMESTAMP
      FROM route_stats r
      WHERE h.greenway_name = r.greenway_name
    `);
    console.log(`  ✓ 已更新 ${result.rowCount} 条绿道的路径规划热度`);

    console.log('\n[热力图] 数据库初始化完成!');
  } catch (err) {
    console.error('[热力图] 初始化失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
