/**
 * 绿道功能画像数据导入脚本
 * 将深度学习评价节点 CSV（greenway_nodes_result_safe.csv）导入 greenway_function_nodes 表
 * CSV 字段: node_id,longitude,latitude,function_type,function_name,manual_confidence,result_level,remark
 * 用法: node scripts/import-function-nodes.cjs <csv路径>
 */
const fs = require('fs')
const pg = require('pg')
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'greenway'
}

const CSV_PATH = process.argv[2]
if (!CSV_PATH || !fs.existsSync(CSV_PATH)) {
  console.error('请指定 CSV 文件路径: node scripts/import-function-nodes.cjs <csv路径>')
  process.exit(1)
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  const rows = lines.slice(1).map(l => {
    const [node_id, longitude, latitude, function_type, function_name, manual_confidence] = l.split(',')
    return [parseInt(node_id), parseFloat(longitude), parseFloat(latitude),
            parseInt(function_type) || null, function_name || null, parseInt(manual_confidence) || null]
  }).filter(r => !isNaN(r[0]))

  const client = new pg.Client(DB_CONFIG)
  await client.connect()

  await client.query(`
    DROP TABLE IF EXISTS greenway_function_nodes;
    CREATE TABLE greenway_function_nodes (
      node_id INT PRIMARY KEY,
      longitude DOUBLE PRECISION NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      function_type INT,
      function_name TEXT,
      manual_confidence INT,
      geom geometry(Point, 4326)
    );
  `)

  // 批量插入（每批 500 条）
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values = batch.map((r, j) => `($${j * 6 + 1},$${j * 6 + 2},$${j * 6 + 3},$${j * 6 + 4},$${j * 6 + 5},$${j * 6 + 6},ST_SetSRID(ST_MakePoint($${j * 6 + 2},$${j * 6 + 3}),4326))`).join(',')
    await client.query(
      `INSERT INTO greenway_function_nodes (node_id, longitude, latitude, function_type, function_name, manual_confidence, geom) VALUES ${values}`,
      batch.flat()
    )
  }

  await client.query('CREATE INDEX idx_gn_func_geom ON greenway_function_nodes USING gist (geom)')
  const { rows: cnt } = await client.query('SELECT count(*) AS c FROM greenway_function_nodes')
  console.log(`导入完成: ${cnt[0].c} 条节点（含空间索引）`)
  await client.end()
}

main().catch(e => { console.error('导入失败:', e.message); process.exit(1) })
