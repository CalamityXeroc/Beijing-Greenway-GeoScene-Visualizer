/**
 * 坐标转换工具
 *
 * 本项目坐标系约定：
 *  - 底图（高德）、绿道表（greenways）、POI 表 = GCJ-02（火星坐标）
 *  - OSM 路网（planet_osm_line / planet_osm_polygon）= WGS-84
 *
 * 凡是把 OSM 数据（路网/建筑）用于前端绘制时，必须经 wgs84ToGcj02 转换，
 * 否则与高德底图偏移约 500m。
 */

// WGS84 → GCJ-02（火星坐标）标准算法
export function wgs84ToGcj02(lng, lat) {
  const a = 6378245.0
  const ee = 0.00669342162296594323
  const transformLat = (x, y) => {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0
    ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0
    ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0
    return ret
  }
  const transformLng = (x, y) => {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0
    ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0
    ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0
    return ret
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI)
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI)
  return [lng + dLng, lat + dLat]
}

/** 地理坐标数组批量转换：[[lng,lat], ...] → GCJ-02 */
export function coordsToGcj02(coords) {
  return coords.map(([lng, lat]) => wgs84ToGcj02(lng, lat))
}

/** 建筑轮廓坐标递归转换（ring 结构：[[[lng,lat],...], ...]） */
export function ringsToGcj02(rings) {
  return rings.map(ring => ring.map(([lng, lat]) => wgs84ToGcj02(lng, lat)))
}

/** GCJ-02 → WGS-84（反向，用于把 GCJ-02 坐标换算成 OSM/路网可用的 WGS-84 查询坐标） */
export function gcj02ToWgs84(lng, lat) {
  const [glng, glat] = wgs84ToGcj02(lng, lat)
  return [lng * 2 - glng, lat * 2 - glat]
}