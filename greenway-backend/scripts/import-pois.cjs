/**
 * POI 数据导入脚本
 * 从高德 API 获取北京各类设施，用 ST_DWithin 筛选绿道周边 1km 的 POI，去重入库
 * 用法: node scripts/import-pois.js [--radius=1000] [--types=150500|150700]
 */
const pg = require('pg')
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const GAODE_KEY = process.env.GAODE_KEY
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'greenway'
}

const POI_TYPES = {
  '150500': { name: '地铁站', icon: '🚇' },
  '150700': { name: '公交站', icon: '🚌' },
  '150900': { name: '停车场', icon: '🅿️' },
  '200300': { name: '公共卫生间', icon: '🚻' },
  '060100': { name: '便利店', icon: '🏪' },
  '080600': { name: '影剧院', icon: '🎬' },
  '110100': { name: '景点', icon: '🏛️' },
  '110200': { name: '景点', icon: '🏛️' }
}

const RADIUS = parseInt(process.argv.find(a => a.startsWith('--radius='))?.split('=')[1] || '1000')
const TYPES_FILTER = process.argv.find(a => a.startsWith('--types='))?.split('=')[1]?.split(',') || Object.keys(POI_TYPES)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchAmapPage(typeCode, page) {
  const url = `https://restapi.amap.com/v3/place/text?key=${GAODE_KEY}&types=${typeCode}&city=北京&citylimit=true&offset=25&page=${page}&extensions=all`
  const resp = await fetch(url, {
    headers: { 'Referer': 'https://www.amap.com/', 'User-Agent': 'Mozilla/5.0' }
  })
  return resp.json()
}

async function fetchAllByType(typeCode) {
  const typeName = POI_TYPES[typeCode]?.name || typeCode
  const all = []
  const first = await fetchAmapPage(typeCode, 1)
  if (first.status !== '1') {
    console.log(`  ${typeName}: API 异常 - ${first.info || ''}`)
    return all
  }
  const total = parseInt(first.count) || 0
  const pages = Math.min(Math.ceil(total / 25), 36) // 高德上限 900 条

  for (const p of (first.pois || [])) {
    all.push({ amap_id: p.id, name: p.name, type: typeCode, address: p.address || '', lng: parseFloat(p.location?.split(',')[0]) || 0, lat: parseFloat(p.location?.split(',')[1]) || 0 })
  }

  for (let page = 2; page <= pages; page++) {
    await sleep(300)
    const r = await fetchAmapPage(typeCode, page)
    if (r.status === '1' && r.pois) {
      for (const p of r.pois) {
        all.push({ amap_id: p.id, name: p.name, type: typeCode, address: p.address || '', lng: parseFloat(p.location?.split(',')[0]) || 0, lat: parseFloat(p.location?.split(',')[1]) || 0 })
      }
    }
    process.stdout.write(`\r      第 ${page}/${pages} 页 (已收集 ${all.length})`)
  }
  // 去重
  const seen = new Set()
  const deduped = all.filter(p => { if (seen.has(p.amap_id)) return false; seen.add(p.amap_id); return true })
  console.log(`\r  ${POI_TYPES[typeCode].icon} ${typeName}: ${deduped.length} 条 (原始 ${total}, 获取 ${pages} 页)`)
  return deduped
}

async function main() {
  const pool = new pg.Pool(DB_CONFIG)

  console.log('═══════════════════════════════════════')
  console.log('  绿道 POI 设施数据导入')
  console.log(`  搜索半径: ${RADIUS}m | 类型: ${TYPES_FILTER.map(t => POI_TYPES[t]?.name || t).join(', ')}`)
  console.log('═══════════════════════════════════════\n')

  // 确保 amap_id 列和唯一索引存在
  await pool.query(`ALTER TABLE points_of_interest ADD COLUMN IF NOT EXISTS amap_id VARCHAR(64)`)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_poi_amap_id ON points_of_interest(amap_id)`)
  console.log('表结构检查完成\n')

  const gwRes = await pool.query(`SELECT id, name FROM greenways ORDER BY id`)
  console.log(`绿道总数: ${gwRes.rows.length}\n`)

  let totalInserted = 0
  const stats = {}

  for (const typeCode of TYPES_FILTER) {
    const conf = POI_TYPES[typeCode]
    if (!conf) continue

    const pois = await fetchAllByType(typeCode)
    if (pois.length === 0) { stats[typeCode] = 0; continue }

    let inserted = 0
    let batch = 0

    for (const poi of pois) {
      if (!poi.lng || !poi.lat) continue

      // 查最近绿道
      const dist = await pool.query(`
        SELECT g.id, ROUND(ST_Distance(
          ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, g.geometry::geography
        )) AS m
        FROM greenways g
        WHERE ST_DWithin(ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, g.geometry::geography, $3)
        ORDER BY m LIMIT 1
      `, [poi.lng, poi.lat, RADIUS])

      if (dist.rows.length === 0) continue

      try {
        await pool.query(`
          INSERT INTO points_of_interest (name, description, poi_type, greenway_id, amap_id, geometry)
          VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326))
          ON CONFLICT (amap_id) DO UPDATE SET greenway_id = EXCLUDED.greenway_id
        `, [poi.name, poi.address, typeCode, dist.rows[0].id, poi.amap_id, poi.lng, poi.lat])
        inserted++
        batch++
      } catch (e) {
        if (!e.message?.includes('unique') && !e.message?.includes('duplicate')) {
          console.warn(`  插入失败: ${poi.name} - ${e.message?.slice(0,80)}`)
        }
      }

      if (batch % 200 === 0) {
        process.stdout.write(`\r      已入库 ${inserted}/${pois.length} ...`)
      }
    }

    stats[typeCode] = inserted
    totalInserted += inserted
    console.log(`\r  → 入库: ${inserted} 条 (全北京 ${pois.length} 条中${RADIUS}m内 ${inserted} 条)`)
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  导入完成!')
  for (const [code, n] of Object.entries(stats)) {
    console.log(`  ${POI_TYPES[code]?.icon || '📍'} ${POI_TYPES[code]?.name || code}: ${n}`)
  }
  console.log(`  ─────────────────────`)
  console.log(`  📦 总计入库: ${totalInserted} 条`)
  console.log('═══════════════════════════════════════')

  await pool.end()
}

main().catch(e => { console.error('导入失败:', e); process.exit(1) })
