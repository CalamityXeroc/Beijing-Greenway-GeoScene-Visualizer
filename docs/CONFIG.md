# 配置说明 / Configuration

> 返回 [主 README](../README_zh-CN.md)

##  GeoScene Server 服务（国产平台数据源）

系统地图数据源已接入 **GeoScene Server（易智瑞国产 GIS 平台）** 真实发布的地图服务，前端直接调用公网服务图层：

| 服务图层 | 内容 | 数量 |
|---------|------|------|
| 绿道（`地图/MapServer/2`）| 北京 17 条主要绿道路线 | 17 |
| 设施（`地图/MapServer/1`）| 绿道周边便民设施（地铁/公交/停车/卫生间/便利店/影剧院/景点）| 847 |
| 功能网格（`greenwayfunction/MapServer/1`）| 深度学习分类的六边形功能分区（生态/风景/历史/城市），随缩放切换 0.04°~0.01° 网格 | 2827 |
| 功能节点（`greenwayfunction/MapServer/0`）| 深度学习评价节点 | 29993 |

- 前端渲染与交互与原有实现**完全一致**：绿道 17 色日/夜配色、hover 金色高亮、点击橙色高亮与卡片、绿道对比联动；设施 SVG 图标、聚合、类型筛选、详情跳转；功能区划 4 色半透明网格与缩放联动。
- 服务字段受 SHP 导出限制有截断（如 `descriptio`→`description`），前端做字段映射与数据补齐（如 `greenway_i`→绿道名、`poi_type`→类型名）。
- 服务已公开访问（匿名可查询），nginx 反代 `/rest/` 统一入口。

---


##  环境变量配置

**后端（`greenway-backend/.env.local`）**
```env
DB_HOST=localhost
DB_NAME=greenway
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3001
JWT_SECRET=your_jwt_secret

# AI 服务（OpenAI 兼容接口，当前为 DeepSeek）
SILICONFLOW_API_URL=https://api.deepseek.com/v1/chat/completions
SILICONFLOW_API_KEY=your_deepseek_api_key
AI_MODEL=deepseek-flash
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7
AI_REQUEST_TIMEOUT=60000

GAODE_KEY=your_amap_web_service_key
```

> 变量名沿用历史命名（项目最初接入硅基流动），切换到其它 OpenAI 兼容服务时只需改值。`AI_MAX_TOKENS` 需为思考 token 留出余量——`deepseek-flash` 的 reasoning 内容也计入该额度。

**前端（`greenway-vue/.env.local`）**
```env
VITE_AMAP_KEY=your_amap_key
VITE_BAIDU_MAP_KEY=your_baidu_key
VITE_API_BASE=http://localhost:3001
```

---

