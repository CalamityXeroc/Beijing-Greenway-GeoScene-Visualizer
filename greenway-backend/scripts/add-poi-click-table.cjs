/**
 * POI 点击统计表创建脚本
 * 运行: node scripts/add-poi-click-table.cjs
 */
const pg = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'greenway'
});

async function main() {
  try {
    console.log('[POI点击迁移] 开始...\n');

    // 1. POI 点击记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poi_clicks (
        id          SERIAL PRIMARY KEY,
        poi_id      INTEGER,
        poi_name    VARCHAR(255),
        poi_type    VARCHAR(10),
        greenway_id INTEGER,
        clicked_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✓ poi_clicks 表');

    // 2. 索引
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pc_date ON poi_clicks(clicked_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pc_type ON poi_clicks(poi_type)');
    console.log('  ✓ 索引');

    // 3. greenway_heatmap 加入 poi_click_count
    await pool.query('ALTER TABLE greenway_heatmap ADD COLUMN IF NOT EXISTS poi_click_count INTEGER DEFAULT 0');
    console.log('  ✓ greenway_heatmap.poi_click_count 列');

    // 4. 用新公式重算: click*0.15 + route*0.40 + comment*0.20 + poi_click*0.25
    const r = await pool.query(`
      UPDATE greenway_heatmap
      SET heat_index = ROUND((click_count * 0.15 + route_count * 0.40 + comment_count * 0.20 + poi_click_count * 0.25)::numeric, 1),
          last_updated = CURRENT_TIMESTAMP
    `);
    console.log(`  ✓ 热度重算: ${r.rowCount} 条`);

    console.log('\n[POI点击迁移] 完成');
  } catch (err) {
    console.error('[POI点击迁移] 失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
