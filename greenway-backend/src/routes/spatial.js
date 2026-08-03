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

    res.json({
      code: 0,
      data: {
        greenways,
        pois,
        summary: { greenwayCount: greenways.length, poiCount: pois.length }
      }
    });
  } catch (err) {
    console.error('[spatial/analyze]', err.message);
    res.status(500).json({ code: 1, message: '服务器错误', data: { greenways: [], pois: [], summary: {} } });
  }
});

export default router;
