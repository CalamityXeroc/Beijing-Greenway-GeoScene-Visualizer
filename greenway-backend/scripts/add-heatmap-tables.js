/**
 * 绿道热度热力图 - 数据库表创建脚本
 * 运行: node scripts/add-heatmap-tables.js  或  npm run db:heatmap
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

// 与 greenways 表中的 name 完全一致
const GREENWAY_NAMES = [
  '温榆河绿道', '环二环城市绿道', '亮马河绿道', '常营半马绿道',
  '昌平42绿道', '丽都商圈绿道', '北运河绿道', '南沙绿道',
  '奥林匹克森林公园绿道', '营城建都绿道', '三山五园绿道', '朝阳绿道',
  '北翼山水绿道', '东翼大河绿道', '郊野休闲环绿道', '西翼山水绿道',
  '中心城滨水绿道'
];

async function main() {
  try {
    console.log('[热力图迁移] 正在创建热度相关表...\n');

    // 1. 绿道热度汇总表（如果已存在则先加 comment_count 列）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS greenway_heatmap (
        id              SERIAL PRIMARY KEY,
        greenway_name   VARCHAR(255) NOT NULL UNIQUE,
        click_count     INTEGER DEFAULT 0,
        route_count     INTEGER DEFAULT 0,
        comment_count   INTEGER DEFAULT 0,
        heat_index      FLOAT DEFAULT 0,
        last_updated    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ greenway_heatmap 表已创建/已存在');

    // 如果表已存在但缺少 comment_count 列，补充
    try {
      await pool.query('ALTER TABLE greenway_heatmap ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0');
    } catch { /* 列已存在则跳过 */ }

    // 2. 点击记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS greenway_clicks (
        id              SERIAL PRIMARY KEY,
        greenway_name   VARCHAR(255) NOT NULL,
        user_id         INTEGER,
        clicked_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ greenway_clicks 表已创建/已存在');

    // 3. 索引
    await pool.query('CREATE INDEX IF NOT EXISTS idx_gw_clicks_date ON greenway_clicks(clicked_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_gw_clicks_name ON greenway_clicks(greenway_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_gw_hm_name ON greenway_heatmap(greenway_name)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_gw_hm_index ON greenway_heatmap(heat_index)');
    console.log('  ✓ 索引已就绪');

    // 4. 为所有绿道初始化热度记录（不存在才插入）
    let inserted = 0, skipped = 0;
    for (const name of GREENWAY_NAMES) {
      const { rowCount } = await pool.query(
        'INSERT INTO greenway_heatmap (greenway_name) VALUES ($1) ON CONFLICT (greenway_name) DO NOTHING',
        [name]
      );
      if (rowCount > 0) inserted++; else skipped++;
    }
    console.log(`  ✓ 种子数据: ${inserted} 条新增, ${skipped} 条已存在`);

    // 5. 同步已有评论数到热度表
    const syncCmt = await pool.query(`
      UPDATE greenway_heatmap h
      SET comment_count = sub.cnt,
          heat_index = ROUND((h.click_count * 0.2 + h.route_count * 0.5 + sub.cnt * 0.3)::numeric, 1),
          last_updated = CURRENT_TIMESTAMP
      FROM (
        SELECT g.name, COUNT(*)::int AS cnt
        FROM greenway_comments c
        JOIN greenways g ON g.id = c.greenway_id
        WHERE c.status = 'visible'
        GROUP BY g.name
      ) sub
      WHERE h.greenway_name = sub.name
    `);
    console.log(`  ✓ 评论数同步完成，更新了 ${syncCmt.rowCount} 条记录`);

    // 6. 重新计算所有绿道热度指数（统一用最新公式）
    const recalc = await pool.query(`
      UPDATE greenway_heatmap
      SET heat_index = ROUND((click_count * 0.2 + route_count * 0.5 + comment_count * 0.3)::numeric, 1),
          last_updated = CURRENT_TIMESTAMP
    `);
    console.log(`  ✓ 热度指数重算完成，更新了 ${recalc.rowCount} 条记录`);

    // 7. 验证
    const check = await pool.query('SELECT COUNT(*) as cnt, SUM(click_count) as clicks, SUM(route_count) as routes, SUM(comment_count) as cmts FROM greenway_heatmap');
    const r = check.rows[0];
    console.log(`\n[热力图迁移] 🎉 完成！greenway_heatmap: ${r.cnt} 条记录`);
    console.log(`  点击: ${r.clicks || 0}  路径: ${r.routes || 0}  评论: ${r.cmts || 0}`);

    if (parseInt(r.cnt) === 0) {
      console.log('\n  ⚠️ 警告：未找到绿道数据，请先导入绿道数据再重跑此脚本');
    }

  } catch (err) {
    console.error('[热力图迁移] ✗ 失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
