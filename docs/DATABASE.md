# 数据库设计 / Database Schema

> 返回 [主 README](../README_zh-CN.md)

##  数据库结构

```sql
CREATE TABLE greenways (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  total_length      DECIMAL(10, 2),
  coverage_area     VARCHAR(255),
  construction_area DECIMAL(10, 2),
  features          TEXT,
  description       TEXT,
  geometry          geometry(MultiLineString, 4326),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- **几何类型：** `MultiLineString`，保留独立线段，避免错误连接
- **坐标系：** SRID 4326（WGS 84 标准）
- **数据序列化：** PostGIS `ST_AsGeoJSON()` 输出 GeoJSON 格式

```sql
-- 热度热力图追踪表
CREATE TABLE greenway_heatmap (
  id              SERIAL PRIMARY KEY,
  greenway_name   VARCHAR(255) NOT NULL UNIQUE,
  click_count     INTEGER DEFAULT 0,
  route_count     INTEGER DEFAULT 0,
  comment_count   INTEGER DEFAULT 0,
  heat_index      FLOAT DEFAULT 0,
  last_updated    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE greenway_clicks (
  id              SERIAL PRIMARY KEY,
  greenway_name   VARCHAR(255) NOT NULL,
  user_id         INTEGER,
  clicked_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户收藏表
CREATE TABLE user_favorites (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  greenway_id  INTEGER NOT NULL REFERENCES greenways(id) ON DELETE CASCADE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, greenway_id)
);
```

---

