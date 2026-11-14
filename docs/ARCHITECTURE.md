# 架构与设计 / Architecture

> 返回 [主 README](../README_zh-CN.md)

##  项目结构

```
 greenway-backend/           # Node.js + Express + 数据库
    src/
       index.js            # API 入口
       db.js               # PostgreSQL 连接池
       cache.js            # 内存响应缓存（绿道/设施，单飞去重 + 启动预热）
       routes/
          ai.js            # DeepSeek 对话 API + 对话日志入库
          adminAiStats.js  # 管理员 AI 分析（词云 & 趋势）
          gaode.js         # 高德API代理（路径规划/搜索/逆地理）
          osrmRoute.js     # Dijkstra 最短路径规划（OSM 路网数据）
          heatmap.js       # 热度热力图追踪与分析 API
          poi.js           # POI 附近设施查询与管理统计 API
          favorites.js     # 用户收藏 CRUD 与个人中心统计 API
          spatial.js       # 空间分析 API（多边形区域查询绿道/设施）
    scripts/
       add-chat-logs-table.js   # 数据库迁移：AI 对话日志表
       add-heatmap-tables.js    # 数据库迁移：热度热力图追踪表
       add-favorites-table.js   # 数据库迁移：用户收藏表
       import-pois.cjs          # 高德 POI 导入脚本（7 类设施，ST_DWithin 筛选）
       ...                      # 数据库初始化与导入工具
    init-db.sql             # 表结构 + PostGIS 初始化

 greenway-vue/               # Vue 3 前端（Vite）
    src/
       views/
          LandingPage.vue          # /   首页落地页
          GreenwayOverview.vue     # /map  主地图页
          *Detail.vue              # /wenyu  /zhongxincheng（17个详情页）
          UserLogin.vue            # /login
          UserRegister.vue         # /register
          admin/                   # /admin/*（权限保护）
              aistats/AiChatStats.vue  # AI 对话分析看板
       components/
          TopNavbar.vue            # 顶部导航 + 图层下拉菜单
          MapViewer.vue            # GeoScene 地图封装（高德底图）
          MapToolbarGeoScene.vue   # GIS 工具（绘图/测量/图层）
          PathPlanning.vue         # 路径规划面板（步行/骑行）
          WeatherCard.vue          # 可拖动天气组件
          PanoramaViewer.vue       # 全景街景查看器
          GreenwayFlyover.vue      # 3D 飞行漫游（SceneView + 卫星底图）
          AIChatbot.vue             # AI 浮窗（仅地图页显示）
          NearbyFacilities.vue     # POI 附近设施板块（详情页专用）
          DetailPoiPopup.vue       # POI 详情弹窗 + 悬浮提示
          DetailPoiLayerControl.vue # POI 类型独立开关面板
          PoiSearchBar.vue         # POI 全局关键词搜索（自动补全 + 键盘导航）
          FavoriteButton.vue       # 绿道收藏按钮（心形切换）
          MapLegend.vue            # GeoScene 官方图例组件（Expand 折叠）
          SpatialAnalysisPanel.vue # 空间分析结果列表面板
       services/
          gaodeApi.js              # 高德API代理调用
          osrmApi.js               # Dijkstra 路径规划 API 客户端（步行/骑行）
          heatmapApi.js            # 热度热力图分析 API 客户端
          favoritesApi.js          # 收藏 + 个人统计 API 客户端
          spatialApi.js            # 空间分析 API 客户端
       stores/
          route.js                 # 路径规划响应式状态
          favorites.js             # 收藏状态（ids + toggle + 登出清理）
       utils/
          coordinateTransform.js   # WGS84 ↔ GCJ02 坐标转换
          sessionRef.js            # sessionStorage 持久化响应式引用
          poiPopupTemplate.js      # POI 统一 GeoScene popup 构建器（单点/聚合/跳转）
       composables/
          useDetailPoi.js          # 详情页 POI 图层 + 弹窗逻辑
       stores/
          adminAuth.js             # 管理员 Auth（JWT，localStorage）
          userAuth.js              # 前台用户 Auth
       router/index.js              # 路由配置 + 导航守卫

    mobile/                         # Capacitor 移动端（Vue 3）
       views/
          MapView.vue              # 地图页（绿道 + POI 设施 + AI 助手入口 + 定位高亮 + 底部弹卡）
          DiscoverView.vue         # 发现页/首页（照片 banner 轮播 + 社区动态流）
          ListView.vue             # 绿道列表（搜索 + 筛选，真实照片卡片）
          DetailView.vue           # 绿道详情（单条接口、收藏持久化、评论、实时天气）
          PoiSearchView.vue        # POI 设施搜索页
          ProfileView.vue / SettingsView.vue / FavoritesView.vue  # 个人中心
       components/
          MobileBottomNav.vue      # 浮动玻璃底部导航栏
          BottomSheet.vue          # 半屏抽屉（peek/展开两档 + 拖拽）
          TrailCard.vue            # 绿道卡片（真实照片缩略图 + 无图回退）
          AIChatPanel.vue          # AI 绿道小助手（全屏聊天面板）
          WeatherBlock.vue         # 实时天气卡片（详情页内嵌）
       composables/
          useToast.js              # 全局轻提示 + 确认弹窗（手机端体验）
          useAppTheme.js           # 主题（与桌面共享偏好）
       constants/poi.js            # POI 设施类型配置
       services/api.js             # 移动端 API 客户端（绿道/POI/AI/天气/收藏/认证，后端地址可配置）
       styles/design-system.css    # 移动端设计系统（双主题）

 scripts/
    sync-android.sh                # Capacitor 同步 + 自定义插件重新注册

    public/数据/                     # GeoJSON 几何数据文件
    public/images/greenways/        # 绿道封面图片（17 张）

 示例图片/                   # 项目截图（本文档引用）
 README.md                   # 英文文档
 README_zh-CN.md             # 中文文档（本文件）
 启动完整系统.bat            # 一键启动脚本（Windows）
```

---


##  设计系统

| 设计标记 | 颜色值 | 用途 |
|---------|--------|------|
| 主背景 | `#060d14` | 全局深色底色 |
| 主题绿 | `#2E7D32` / `#4CAF50` | 按钮、强调色 |
| 高亮绿 | `#69F0AE` | 激活/悬停状态 |
| 柔和绿 | `#A5D6A7` | 次要文字 |
| 边界蓝 | `#1565C0` | 地图市界图层 |

---

##  安全机制

- 管理员 JWT 令牌存储于 **localStorage**（页面刷新、切换标签页均保持登录，仅主动注销或服务端 401 才清除）
- Vue Router 导航守卫强制校验 `requiresAdmin` 元数据
- 401 响应自动清除会话并跳转至管理员登录页
- 所有数据库查询使用参数化语句，防止 SQL 注入
- CORS 仅开发环境开启

---


##  数据流转

```
高德 POI API                        GeoJSON / OSM 数据
     │                                      │
     ▼                                      ▼
import-pois.cjs（ST_DWithin 筛选）    PostGIS 空间数据库
     │                                      │
     ▼                                      ▼
points_of_interest 表              ST_AsGeoJSON() 序列化
     │                                      │
     ▼                                      ▼
/api/facilities/geojson          /api/greenways 接口
     │                                      │
     ▼                                      ▼
GeoScene GraphicsLayer           Vue 3 组件（GreenwayOverview / *Detail）
     │                                      │
     ▼                                      ▼
地图 POI 叠加层（可开关）           GeoScene MapViewer → 浏览器渲染
```

---

