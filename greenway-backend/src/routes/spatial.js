/**
 * 空间分析 - API
 * 路由：
 *   POST /api/spatial/analyze   画多边形筛选区域内绿道与 POI
 * body: { polygon: { type:'Polygon', coordinates:[[[lng,lat],...]] } }（坐标已为 4326）
 */
import { Router } from 'express';

const router = Router();

// POI 类型映射（与 poi.js 保持一致）
const POI_TYPE_MAP = {
  '150500': { name: '地铁站' },
  '150700': { name: '公交站' },
  '150900': { name: '停车场' },
  '200300': { name: '公共卫生间' },
  '060100': { name: '便利店' },
  '080600': { name: '影剧院' },
  '110100': { name: '景点' },
  '110200': { name: '景点' }
};

router.post('/analyze', async (req, res) => {
  try {
    const { polygon } = req.body;
    if (!polygon || polygon.type !== 'Polygon' || !polygon.coordinates?.[0]?.length) {
      return res.status(400).json({ code: 1, message: '缺少有效的多边形' });
    }

    // 防御：坐标个数上限，防止超大多边形拖垮查询
    const totalPts = polygon.coordinates.reduce((n, ring) => n + ring.length, 0);
    if (totalPts > 1000) {
      return res.status(400).json({ code: 1, message: '多边形顶点过多（上限 1000）' });
    }

    const polygonGeoJSON = JSON.stringify(polygon);

    // 绿道（线与多边形相交）
    const gwRes = await req.pool.query(`
      SELECT g.id, g.name, g.length, g.description
      FROM greenways g
      WHERE g.geometry IS NOT NULL
        AND ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
        AND ST_Intersects(g.geometry, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
      ORDER BY g.name
    `, [polygonGeoJSON]);

    // POI（点与多边形相交/包含）
    const poiRes = await req.pool.query(`
      SELECT poi.id, poi.name, poi.poi_type, poi.description AS address,
             ST_X(poi.geometry) AS lng, ST_Y(poi.geometry) AS lat,
             poi.greenway_id, g.name AS greenway_name
      FROM points_of_interest poi
      LEFT JOIN greenways g ON g.id = poi.greenway_id
      WHERE ST_Intersects(poi.geometry, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
      LIMIT 500
    `, [polygonGeoJSON]);

    const greenways = gwRes.rows;
    const pois = poiRes.rows.map(r => ({
      id: r.id,
      name: r.name,
      poi_type: r.poi_type,
      type_name: POI_TYPE_MAP[r.poi_type]?.name || r.poi_type,
      address: r.address,
      lng: parseFloat(r.lng),
      lat: parseFloat(r.lat),
      greenway_id: r.greenway_id,
      greenway_name: r.greenway_name || ''
    }));

    // 区域内功能分区统计（深度学习评价节点）
    const fnRes = await req.pool.query(`
      SELECT fn.function_name AS name, COUNT(*) AS cnt
      FROM greenway_function_nodes fn
      WHERE ST_Intersects(fn.geom, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))
        AND fn.function_name <> '未确定'
      GROUP BY fn.function_name
      ORDER BY cnt DESC
    `, [polygonGeoJSON]);
    const functions = fnRes.rows.map(r => ({ name: r.name, count: parseInt(r.cnt) }));
    const fnTotal = functions.reduce((s, i) => s + i.count, 0);

    res.json({
      code: 0,
      data: {
        greenways,
        pois,
        functions,
        summary: {
          greenwayCount: greenways.length,
          poiCount: pois.length,
          functionCount: fnTotal,
          functionBreakdown: functions.map(i => ({
            ...i,
            pct: fnTotal ? Math.round(i.count / fnTotal * 100) : 0
          }))
        }
      }
    });
  } catch (err) {
    console.error('[spatial/analyze]', err.message);
    res.status(500).json({ code: 1, message: '服务器错误', data: { greenways: [], pois: [], functions: [], summary: {} } });
  }
});

// 功能分区点图层：全北京深度学习评价节点（按功能类型抽样，供地图叠加）
router.get('/points', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 600, 3000)
    const result = await req.pool.query(`
      SELECT node_id, ST_X(geom) AS lng, ST_Y(geom) AS lat,
             function_name, function_type, manual_confidence AS confidence
      FROM (
        SELECT *, row_number() OVER (PARTITION BY function_name ORDER BY random()) AS rn
        FROM greenway_function_nodes
        WHERE function_name <> '未确定'
      ) t
      WHERE t.rn <= $1
    `, [limit])

    const features = result.rows.map(r => ({
      type: 'Feature',
      properties: {
        node_id: r.node_id,
        function_name: r.function_name,
        function_type: r.function_type,
        confidence: r.confidence
      },
      geometry: { type: 'Point', coordinates: [parseFloat(r.lng), parseFloat(r.lat)] }
    }))

    res.json({ type: 'FeatureCollection', features })
  } catch (err) {
    console.error('[function/points]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 六边形网格预聚合结果缓存（数据静态，接口查预聚合表毫秒级）
const gridCache = new Map()
const GRID_CACHE_TTL = 10 * 60 * 1000

// 功能分区六边形网格图层：查预聚合表（greenway_function_grid），秒级返回
router.get('/grid', async (req, res) => {
  try {
    const size = Math.min(Math.max(parseFloat(req.query.size) || 0.02, 0.005), 0.1)
    const key = `g${size}`

    const hit = gridCache.get(key)
    if (hit && Date.now() - hit.time < GRID_CACHE_TTL) {
      return res.json(hit.data)
    }

    const result = await req.pool.query(`
      SELECT function_name, cnt, total, ST_AsGeoJSON(geom, 6)::json AS geometry
      FROM greenway_function_grid
      WHERE size = $1
    `, [size])

    const features = result.rows.map(r => ({
      type: 'Feature',
      properties: {
        function_name: r.function_name,
        count: parseInt(r.cnt),
        total: parseInt(r.total)
      },
      geometry: r.geometry
    }))
    const data = { type: 'FeatureCollection', features }
    gridCache.set(key, { data, time: Date.now() })
    res.json(data)
  } catch (err) {
    console.error('[function/grid]', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router

// 预热六边形网格缓存（3 档），供启动时调用，避免用户首次请求等待远程传输
export async function warmGridCache(pool) {
  for (const size of [0.04, 0.02, 0.01]) {
    const key = `g${size}`
    if (gridCache.has(key)) continue
    const result = await pool.query(`
      SELECT function_name, cnt, total, ST_AsGeoJSON(geom, 6)::json AS geometry
      FROM greenway_function_grid
      WHERE size = $1
    `, [size])
    const features = result.rows.map(r => ({
      type: 'Feature',
      properties: {
        function_name: r.function_name,
        count: parseInt(r.cnt),
        total: parseInt(r.total)
      },
      geometry: r.geometry
    }))
    gridCache.set(key, { data: { type: 'FeatureCollection', features }, time: Date.now() })
    console.log(`[预热] 功能区划网格 size=${size} 已缓存 (${features.length} 格)`)
  }
};
