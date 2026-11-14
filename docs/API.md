# API 文档 / API Reference

> 返回 [主 README](../README_zh-CN.md)

##  路由总览

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | LandingPage | 全屏落地页 |
| `/map` | GreenwayOverview | 主交互地图 |
| `/wenyu` | WenyuDetail | 温榆河绿道详情 |
| `/huanerhuan` | HuanerhuanDetail | 环二环城市绿道详情 |
| `/liangmahe` | LiangmaheDetail | 亮马河绿道详情 |
| `/changying` | ChangyingDetail | 常营半马绿道详情 |
| `/changping42` | Changping42Detail | 昌平42绿道详情 |
| `/lidu` | LiduDetail | 丽都商圈绿道详情 |
| `/beiyunhe` | BeiyunheDetail | 北运河绿道详情 |
| `/nansha` | NanshaDetail | 南沙绿道详情 |
| `/aosen` | AosenDetail | 奥森绿道详情 |
| `/yingcheng` | YingchengDetail | 营城建都绿道详情 |
| `/sanshan` | SanshanDetail | 三山五园绿道详情 |
| `/chaoyang` | ChaoyangDetail | 朝阳绿道详情 |
| `/beiyi` | BeiyiDetail | 北翼山水绿道详情 |
| `/dongyi` | DongyiDetail | 东翼大河绿道详情 |
| `/jiaoye` | JiaoyeDetail | 郊野休闲环绿道详情 |
| `/xiyi` | XiyiDetail | 西翼山水绿道详情 |
| `/zhongxincheng` | ZhongxinchengDetail | 中心城滨水绿道详情 |
| `/login` | UserLogin | 用户登录 |
| `/register` | UserRegister | 用户注册 |
| `/favorites` | FavoritesPage | 我的收藏（桌面端收藏列表页） |
| `/admin/login` | AdminLogin | 管理员登录 |
| `/admin/dashboard` | AdminDashboard | 数据概览 *（需登录）* |
| `/admin/users` | AdminUsers | 用户管理 *（需登录）* |
| `/admin/logs` | AdminLogs | 系统日志 *（需登录）* |
| `/admin/ai-stats` | AiChatStats | AI 对话分析 *（需登录）* |
| `/admin/comments` | AdminComments | 评论管理 *（需登录）* |
| `/admin/heatmap` | HeatAdmin | 热度分析看板 *（需登录）* |
| `/admin/route-stats` | RouteStats | 路径规划统计 *（需登录）* |
| `/mobile/*` | MobileLayout | 移动端布局（Capacitor） |

---


##  API 端点

```http
GET /api/greenways              # 获取所有绿道列表
GET /api/greenways/:id          # 按 ID 获取单条绿道详情（含设施/颜色/图片）
GET /api/greenways?name=温榆河  # 按名称筛选，返回 GeoJSON FeatureCollection
POST /api/ai/chat               # AI 对话（DeepSeek-V4.1-Flash）
DELETE /api/ai/context/:id      # 清除对话历史
POST /api/comments              # 发布评论（含敏感词检测、可选评分）
GET /api/comments               # 按绿道查询评论
GET /api/comments/recent        # 跨绿道最新顶级评论（发现页社区动态流）
GET /api/gaode/search            # 高德POI搜索（代理）
GET /api/gaode/walking           # 高德步行路径规划（代理）
GET /api/gaode/bicycling         # 高德骑行路径规划（代理）
POST /api/osrm/route             # 顶点级 Dijkstra 路径规划（步行/骑行，OSM 路网，街道名指引）
GET /api/greenways/:id/flyover?maxPoints=45    # 3D 飞行漫游路径点（PostGIS 地理处理，精确 45 个等距点）
GET /api/greenways/name/:name/flyover?maxPoints=45  # 按绿道名称获取漫游路径点
GET /api/greenways/:id/nearby-facilities?radius=1000  # 绿道周边设施查询（按类型分组）
GET /api/greenways/name/:name/nearby-facilities       # 按绿道名称查询周边设施
GET /api/greenways/name/:name/nearby-facilities/geojson  # 按绿道名称查询周边设施 GeoJSON
GET /api/greenways/:id/nearby-facilities/geojson       # 绿道周边设施 GeoJSON FeatureCollection
GET /api/facilities/geojson                           # 全部 POI 设施 GeoJSON（地图叠加图层用）
GET /api/poi/search?q=关键词                          # POI 设施关键词搜索（名称/地址模糊匹配）
GET /api/poi-types                                    # POI 类型定义（代码、名称、图标、颜色）
POST /api/spatial/analyze                            # 空间分析：绘制多边形查询区域内绿道与设施（ST_Intersects）
GET  /api/spatial/points?limit=600                  # 按功能类型抽样的深度学习节点（散点图层）
GET  /api/spatial/grid?size=0.02                    # 六边形网格分区 GeoJSON（预聚合 + 启动预热缓存）
GET  /api/greenways/name/:name/function-profile     # 绿道功能画像（生态/风景/历史文化/城市占比，1km 缓冲区）
POST /api/greenways/recommend                        # 智能推荐：偏好 → 评分排序（短板匹配+热度+设施）
GET  /api/greenways/name/:name/nearest-entry?lng=&lat=  # 绿道线上离起点最近的点（ST_ClosestPoint，最近入口导航）
POST /api/accessibility/reach                            # 可达性：Dijkstra 距离场 → 5 档等时圈凸包 + 可达绿道
GET  /api/favorites/ids                              # 当前用户收藏的绿道 id 列表（按钮态）
GET  /api/favorites                                  # 收藏列表（JOIN 绿道展示字段）
POST /api/favorites                                  # 添加收藏 { greenway_id | greenway_name }
DELETE /api/favorites/:greenwayId                    # 取消收藏
GET  /api/user/stats                                 # 个人中心统计（收藏数/骑行/总里程/评论数）
GET /api/tiles/gaode/:style/:level/:col/:row  # 高德瓦片代理（style=6 卫星图, style=7 矢量图）
POST /api/heatmap/click          # 记录绿道点击（热度埋点）
GET /api/heatmap/data            # 热度数据（含质心坐标与加权指数）
GET /api/heatmap/points          # 沿绿道线密集采样的热力点

# 管理员接口（需 Bearer JWT）
GET /api/admin/stats              # 平台概览统计（用户/绿道/活跃）
GET /api/admin/dashboard/stats    # 移动端管理中心统计（用户/评论/待审核/今日）
GET /api/admin/ai-stats?days=7  # 词云 + 每日趋势，支持 7/14/30 天
GET /api/admin/ai-stats/recent  # 最近原始提问记录
GET /api/admin/comments         # 评论列表（支持筛选/分页）
PATCH /api/admin/comments/:id/status      # 单条评论状态更新
PATCH /api/admin/comments/batch/status    # 批量评论状态更新
GET /api/admin/heatmap/overview          # 热度概览（今日点击/规划/评论、热度最高绿道）
GET /api/admin/heatmap/trend?days=30     # 每日热度趋势（含点击/规划/评论拆分）
GET /api/admin/heatmap/rank?limit=20     # 绿道热度排名
GET /api/admin/heatmap/compare           # 点击量 vs 规划量 vs 评论量三维对比
GET /api/admin/heatmap/comment-stats     # 评论总览（总数/今日/均分/最多绿道）
GET /api/admin/heatmap/comment-rank      # 绿道评论数量排名
GET /api/admin/heatmap/comment-trend     # 每日评论趋势
```

```bash
curl "http://localhost:3001/api/greenways?name=南沙"
```

---

