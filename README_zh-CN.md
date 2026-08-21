# 北京绿道系统可视化平台

![Vue](https://img.shields.io/badge/Vue-3.4.0-brightgreen.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)
![GeoScene](https://img.shields.io/badge/GeoScene-4.33-blue.svg)
![DeepSeek](https://img.shields.io/badge/AI-DeepSeek%20V4-Flash-purple.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

基于 Vue 3 + GeoScene JS SDK + 高德地图 + PostgreSQL/PostGIS 的现代 WebGIS 平台，交互式探索北京绿道网络。

**[English](./README.md) | [中文](./README_zh-CN.md)**

> ⚡ **快速开始？** 请查看 [**快速部署指南.md**](./快速部署指南.md) — 5 分钟内部署完整系统（包含 PostgreSQL、Node.js 配置步骤）

---

##  功能截图


![落地页](示例图片/1.png)


![地图总览](示例图片/2.png)


![绿道详情](示例图片/3.png)


![GIS 工具](示例图片/4.png)


![管理后台](示例图片/5.png)


![移动端](示例图片/6.png)

---

##  项目简介

交互式可视化 **17 条北京主要绿道**，集成全屏落地页、GeoScene 交互地图（高德底图）、路径规划导航、**3D 飞行漫游**、GIS 工具集、实时天气、全景街景、管理后台、用户认证及 Capacitor 移动端应用。

-  17 条完整绿道路线
-  Vue 3 + GeoScene JS SDK + 高德底图 前端
-  Node.js + Express REST API 后端
-  PostgreSQL + PostGIS 地理数据库
-  全屏落地页，防抖鼠标滚轮六屏切换（0.6s 过渡动画）
-  图层控制集成到顶部导航栏下拉菜单
-  **绿道热度热力图**：实时热力图层，三因子加权指数（点击×0.2 + 规划×0.5 + 评论×0.3），图层面板可控开关；自动初始化 17 条绿道热度记录并同步已有评论数
-  管理后台 JWT 认证（localStorage 持久化，仅主动注销才清除）
-  前台导航栏显示管理员登录状态
-  绘图工具 RGB 调色板（点 / 线 / 面均支持自定义颜色）
-  地图画布导出为 PNG 图片
-  地图界面"返回主界面"快捷按钮
-  用户注册与登录系统
-  绿道详情页评论系统（桌面评论面板，评分可选）
-  管理后台评论管理（`/admin/comments`）：支持筛选、单条处理与批量处理
-  评论敏感词拦截：命中敏感词直接禁止发布并提示
- 全站昼夜主题（按北京时间自动切换），管理后台双主题完整适配
-  **AI 助手（绿道小助手）**：基于 DeepSeek-V4-Flash，，支持路线推荐、操作指引、绿道知识问答，对话自动写入数据库
-  **管理员 AI 对话分析：** 词云 + 每日趋势折线图（7/30/90 天可选）+ 最近提问记录，支持昼夜主题自动切换（ECharts + echarts-wordcloud，中文分词使用 `segment` 库）
-  **3D 飞行漫游（3D Flyover）**：发光管状路径（PathSymbol3DLayer）+ 路径光珠（已飞/当前/未来状态）+ 飞行轨迹（已飞段亮色/未飞段暗色）+ 转弯倾斜 + 时段氛围（星空、天空色、地面色自适应），支持播放/暂停/调速/前后跳转。路径经 PostGIS `ST_SimplifyPreserveTopology` + `ST_LineInterpolatePoint` 精确采样为 45 个等距航点（最多 4,911 个原始顶点精简至 45 个）。**真三维城市场景增强**：沿绿道 800m 走廊加载最多 250 栋 OSM 真三维建筑（`planet_osm_polygon` 11 万栋 footprint，`PolygonSymbol3D` + `ExtrudeSymbol3DLayer` 按面积估算高度挤出，建筑类型分色——住宅米黄/商业蓝灰/学校绿灰等，夜晚自动调暗成城市夜景，`ST_SimplifyPreserveTopology` 轮廓简化 + bbox 粗筛 + 预计算面积列保证接口仅 ~0.24s）；建筑名称与沿线 POI（地铁/公交/景点/公园/餐饮等分类彩色圆点）以 `LabelSymbol3D` 名称标注浮显（自动面向相机、自动避让），顶部栏可一键开关建筑/标注图层。
-  **POI 附近设施**：从高德 POI API 导入 7 类共 847 条便民设施（地铁站、公交站、停车场、公共卫生间、便利店、影剧院、景点），经 PostGIS `ST_DWithin` 筛选绿道周边指定范围内。专业 SVG 矢量地图标记，支持悬浮 tooltip、点击详情弹窗。顶部导航栏内置全局关键词搜索（自动补全 + 键盘导航）。图例面板和详情页图层控制器支持按类型独立开关，详情页支持搜索半径可调（500m~5km）。会话间通过 sessionStorage 持久化图层状态。
-  **POI 设施聚类**：缩放级别 11~13 时设施点自动聚合成数字气泡，放大后散开显示单个 POI；点击聚合点弹出聚合区域内真实 POI 名称列表。聚类严格跟随图层类型过滤（`definitionExpression`），只保留用户选中的设施类型。
-  **统一 GeoScene Popup**：设施交互 UI 统一迁移至 GeoScene 原生 popup（popupTemplate + content 函数），支持设施图标、类型、地址、距离展示与"查看绿道详情"一键跳转按钮；单点与聚合 popup 均完整适配白天/黑夜双主题。
-  **空间分析工具集**：地图上绘制多边形分析区域，调用后端 PostGIS `ST_Intersects` 空间查询，返回区域内命中的绿道与设施，地图高亮 + 结果列表面板（含面积、周长、设施密度分析）。支持绘制多个分析区域，再次点击多边形可恢复结果。
-  **绿道功能区划（六边形分区图）**：约 3 万个深度学习分类节点（生态/风景/历史文化/城市）聚合成六边形网格分区图（`ST_HexagonGrid` + 每格多数票主导功能），市民一眼看清北京各区域绿道的主导类型。网格随缩放自动调整（0.04°/0.02°/0.01°），数据预聚合进 `greenway_function_grid` 表 + 启动预热缓存，缩放切换秒级响应。
-  **绿道功能画像（详情页卡片）**：每条绿道详情页展示功能画像卡片（生态/风景/历史文化/城市占比，由 1km 缓冲区统计、预聚合表 `greenway_function_profile` 计算），帮用户快速了解绿道特色；AI 助手也注入该画像数据，可推荐绿道（如“哪条生态最好”）。
-  **绿道按类配色（昼夜双色板）**：绿道按主导功能类别着色，并为白天/夜间各设计一套色板，随主题自动切换——保证在白天浅色底图与夜间反相深色底图上都清晰可见。
-  **图层说明卡（市民服务）**：开启功能区划/热度/设施图层时，在地图角落弹出市民导向的玻璃拟态说明卡（该图层含义、图例、使用建议，如“想亲近自然看绿色、喜欢人文古迹找棕色”），卡片可独立关闭而不影响图层显示。
-  **图层管理整合**：图层菜单将“北京市”（市界+市域）与“绿道（全部 17 条）”整合为两个总开关，一键控制全部对应图层。
-  **用户收藏 + 个人中心**：收藏绿道（后端 `user_favorites` 表 + 收藏按钮），桌面端收藏列表页、移动端收藏页与个人中心统计（收藏数、骑行记录、总里程、评论数）全部接入真实数据。
-  **图层图例控件**：集成 GeoScene 官方 Legend 组件（Expand 折叠面板），自动展示热力图渐变与设施图例。
-  **移动端 POI 设施**：移动端地图（OpenLayers）叠加 7 类设施 SVG 图标，缩放联动显示（放大到城市/绿道级别才显示设施，避免低缩放密集），类型 chips 过滤，点击弹出底部信息卡（名称/类型/地址/所属绿道 + 跳详情），独立设施搜索页（类型快捷入口 + 关键词搜索）。
-  **跟随时间主题**：全站默认按北京时间自动切换昼夜，用户可随时固定白天/夜间或切回跟随时间（桌面与移动端共享一套偏好）。
-  **智能推荐（偏好评分引擎）**：新增推荐接口 `POST /api/greenways/recommend`，按用户偏好对 17 条绿道评分——出行方式（步行/骑行）、兴趣类型（生态/风景/历史文化/城市/都行）、设施需求（地铁/停车/卫生间）。评分透明可解释：短板效应功能匹配（所选类型占比取最低值，<15% 硬门槛剔除）、热度排名、设施完善度（空间 1km 统计）、长度适配，权重自适应（兴趣明确时功能匹配 55% 主导；"都行"时热度+设施主导）。结果展示综合评分、画像占比、热度排名和模板推荐理由（如"历史文化占比 39%，适合访古游览"），第一名高亮。
-  **可拖动推荐面板 + AI 深度解读**：推荐面板为玻璃拟态可自由拖动窗口（选偏好→看结果→"去这里"）。"AI 解读"按钮将每条推荐的完整画像/设施数据喂给 AI，生成 250-300 字逐条点评（匹配点/欠缺点对比 + 实用建议）。
-  **最近入口导航**："去这里"打开路径规划时，目的地动态设为绿道线上离当前起点最近的点（PostGIS `ST_ClosestPoint` 对合并多段线计算，`GET /api/greenways/name/:name/nearest-entry`）。若之后才设置起点（地图选点/我的位置），终点自动重算——导航永远到绿道最近入口，而非几十公里绿道的某个随机端点。
-  **绿道可达圈（可达性分析）**：面向市民的可达性分析——定位/选点起点，选择步行或骑行，地图上绘制 5/10/15/20/30 分钟等时圈凸包（绿→黄→橙→红渐变着色），并列出所选时间内可达的绿道（真实路网距离与分钟数，基于共享路网的 Dijkstra 距离场，`POST /api/accessibility/reach`）。一次请求返回全部 5 档等时圈，时间滑块切换即时更新；"去这里"直达最近入口导航。入口整合在空间分析菜单（"区域分析"为多边形分析、"可达圈分析"为可达性），与路径规划共享路网图模块与缓存。
-  **绿道体检评估（健康度排名）**：面向市民的"绿道体检"——从 5 个维度（生态自然度/出行便捷度/设施完备度/人气活力值/休闲适宜度）对 17 条绿道综合打分排名（`GET /api/greenways/assess`），评分透明可解释，输出等级（优/良/中/待提升）、亮点与短板话术（如"公共交通偏少，建议骑行或自驾前往"）。前端评估面板：17 条健康榜（点击定位高亮）、ECharts 雷达图（选中绿道 vs 全市平均五维对比）、功能画像占比条、"AI 体检报告"（喂入五维+画像+排名数据生成 250-300 字市民话术报告：总体评价/核心亮点/适合人群/出发建议）。入口在空间分析菜单"绿道评估"。
-  **移动端浮动玻璃底栏**：毛玻璃悬浮式底部导航（四周留白 + 大圆角 + backdrop blur），激活 tab 图标上浮放大弹性动画，简洁无多余装饰
-  **移动端发现页（内容社区风）**：真实照片大图 banner 轮播 + 精选绿道卡（真实绿道照片）+ 带封面图的社区动态贴，首页以图片驱动
-  **真实照片绿道卡片**：绿道列表与收藏页卡片缩略图渲染真实绿道照片（`/images/greenways/…`），无图时优雅回退占位，替代纯渐变占位
-  **移动端 POI 搜索定位**：搜索设施 → 点击结果 → 地图平滑飞到目标点（zoom 16）并在选中 POI 上叠加高亮光圈；POI 图层仅在缩放到位或搜索后才显示，避免低缩放密集
-  **后端响应缓存**：`/api/greenways` 与 `/api/facilities/geojson` 接入内存缓存（60s TTL、并发单飞去重、启动预热）——移动端地图数据由 4~7s 提速至约 0.2s
-  **移动端 AI 助手（绿道小助手）**：地图页右上角 AI 按钮 → 全屏聊天面板，支持路线推荐、操作指引、绿道知识问答（DeepSeek 驱动），消息气泡与快捷建议双主题适配
-  **移动端实时天气**：绿道详情页内嵌实时天气卡片（高德天气 API，按绿道质心坐标查询温度/天气/风向/湿度），支持刷新与骨架屏
-  **移动端地图稳定性修复**：修复地图反复进出详情页后仅剩背景的空白 bug（地图销毁后正确重建实例）
-  **详情页单条接口优化**：绿道详情改按 ID 单条查询（`GET /api/greenways/:id`），首屏数据量由全量 17 条降至单条
-  **API 安全加固**：移除 WeatherCard 中硬编码的高德 Key，改为从环境变量读取
-  **社区动态接口**：新增 `/api/comments/recent`，返回跨绿道的最新顶级评论，供发现页社区动态流使用
-  **全局 Toast 修复 + 收藏即时刷新**：Toast 提示补全文字内容（此前为空白色块）；收藏页每次进入自动重新加载（兼容 keep-alive 缓存），收藏后立即显示
-  Capacitor 移动端应用（UI/UX 全面优化）
-  **移动端绿道体检评估**：每个绿道详情页内嵌与 Web 端一致的深度学习评价——五维评分（对比全市均值）、功能画像占比条、亮点/短板，以及 AI 深度报告按钮（DeepSeek），全部适配移动端设计系统
-  **移动端定位按钮 + 权限引导**：地图页新增"定位到我的位置"悬浮按钮，点击触发系统定位权限弹窗（权限/GPS 关闭时 Toast 引导），修复真机无法定位问题
-  **管理员入口修复**：移动端管理中心改用前台用户身份（role=admin）鉴权，从个人中心进入管理功能不再二次登录
-  **管理中心统计接口**：新增 `GET /api/admin/dashboard/stats`，支撑移动端管理中心统计卡片（注册用户/评论/待审核/今日活跃）
-  **管理后台三个统计页适配移动端**：路径规划/绿道热度/POI 热度统计服务改用自适应 API 基址（`getApiBaseUrl`），在 App 内可正常加载数据；响应式布局（2 列卡片、紧凑图表）+ 修复 WebView 中图表初始化时序
-  **启动画面打磨**：App 启动为纯深绿（无白屏、无图标），无缝过渡到 Vue 绿色动画；新版透明无文字 logo（`logo_icon.svg`）用于启动画面
-  **GeoScene 原生引擎注册**：`MainActivity` 注册 `GeoScene` 插件，设置页显示"已连接 · 200.8.0"（Developer 许可）
-  **详情信息表优化**：删除冗余的长度/编号行，展示真实数据（所在区域/覆盖范围/建设面积/特色）
-  **移动端地图 UI 冲突修复**：空间分析条与 POI 类型条同时打开时不再重叠（自动上移）
-  **坐标系对齐（GCJ-02）**：路径规划与可达圈输出做 WGS-84 ↔ GCJ-02 转换，与高德底图精确对齐（后端公共 `coordTransform.js` + 前端转换工具）
-  **真机定位修复（国内手机适配）**：Capacitor 定位插件底层依赖 Google Play Services（GMS），国内真机不可用——新增 GeoScene 原生定位（Android `LocationManager`，通过 GeoScene 插件调用），并做三级降级：原生 LocationManager → 浏览器 HTML5 定位 → Capacitor 插件（网络定位兜底）。诊断页新增"定位测试"按钮，可在真机上一键验证定位链路。
-  **移动端首页原生滚动**：移动端（≤768px）不再使用全屏翻页，恢复原生滚动（修复内容被截断问题），用 `IntersectionObserver` 监听滚动位置驱动区块高亮、统计数字与卡片入场动画；首页地球图形随容器自适应缩放。
-  **Web 手机浏览器适配（桌面页面响应式）**：用手机浏览器直接访问网站时，桌面页面自动切换为移动布局，所有功能可用——顶部导航工具条横向滚动 + 触摸点按切换下拉菜单（hover 在触屏不可用，改点击切换，点外部自动关闭）；首页恢复原生滚动；管理后台侧边栏折叠为汉堡抽屉（点汉堡滑出侧边栏 + 遮罩，点菜单项自动关闭）；17 个绿道详情页标题居中显示（修复 480px 内边距把标题推出屏幕的问题）；地图说明卡与各分析面板（路径规划/推荐/可达圈/画像）改为全宽不溢出；搜索框输入字号固定 14px；允许双指缩放与文本选择（可访问性）。
-  **PC 端布局修复**：顶部导航在中等宽度窗口（1024~1366px）下工具条自动改为横向滚动，避免菜单+搜索+用户区溢出屏幕；触屏设备检测改用 `pointer: coarse`，避免 Windows 触控板电脑误判为触屏导致 hover 菜单失效；管理后台桌面端折叠按钮恢复可用。
-  **绿道对比（多选并排 PK）**：导航栏新增「绿道推荐」统一入口（含智能推荐 / 绿道评估 / 绿道对比三个子功能）。绿道对比面板最多勾选 3 条绿道，多色叠加雷达图（红/蓝/绿 vs 全市平均虚线）+ 八项指标对比表（综合评分、五维评分：生态自然度/出行便捷度/设施完备度/人气活力值/休闲适宜度、长度、热度排名，每维度最优标绿，无热度数据的绿道显示“暂无”）+ 综合最优结论行；地图同步多色高亮被选绿道、其余置灰，关闭面板自动恢复；任意增删/更换对比项图表即时更新；一键“去最优绿道”（走最近入口导航）+ “AI 对比解读”（250-300 字场景化选道建议，如遛娃/骑行/访古）。

---

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

##  快速开始

### 一键启动（Windows）
```bash
.\启动完整系统.bat
```
自动打开两个终端：后端监听 **3001** 端口，前端监听 **5173** 端口。

### 手动启动

**后端：**
```bash
cd greenway-backend
npm install
npm run db:init         # 初始化 PostgreSQL + PostGIS 表结构
npm run db:chat-logs   # 创建 AI 对话日志表
npm run db:heatmap     # 创建热度热力图追踪表
npm run dev            # http://localhost:3001
```

**前端（新终端）：**
```bash
cd greenway-vue
npm install
npm run dev       # http://localhost:5173
```

---

##  核心功能

| 功能 | 描述 |
|------|------|
|  **落地页** | 防抖鼠标滚轮六屏全屏切换，0.6s 平滑过渡动画 |
|  **交互式地图** | GeoScene 多图层渲染 + 高德底图 |
|  **路径规划** | 步行/骑行路径规划，本地 Dijkstra 最短路径算法（基于 PostGIS 中 OSM 路网数据），面板可拖动 |
|  **3D 飞行漫游** | 发光管状路径 + 路径光珠 + 飞行轨迹 + 转弯倾斜 + 时段氛围特效；PostGIS 地理处理精确采样为 45 个等距航点 |
|  **GIS 工具集** | 绘图（支持 RGB 调色板）、测量、导入 GeoJSON、基础图层切换 |
|  **地图导出** | 将当前地图视图导出为 PNG 图片 |
|  **17 条绿道** | 每条均有独立详情页、真实图片展示、属性信息和全景街景 |
|  **附近设施** | 847 条 POI（7 类），SVG 矢量标记，关键词搜索，悬浮提示+点击弹窗，分类筛选，半径可调，会话持久化 |
|  **POI 聚类** | 缩放 11~13 聚合为数字气泡，放大散开单点；聚合列表显示真实 POI 名，跟随类型过滤 |
|  **统一 Popup** | 单点/聚合统一 GeoScene popup：设施详情 + 绿道跳转按钮，白天/黑夜双主题 |
|  **空间分析** | 绘制多边形 → PostGIS 空间查询 → 绿道/设施高亮 + 结果面板（面积/周长/密度） |
|  **绿道功能区划** | 深度学习分类的 3 万节点聚合成六边形网格分区图（北京各区域绿道主导类型），缩放联动网格粗细，半透明色块 |
|  **绿道功能画像** | 每个绿道详情页展示功能画像卡片（生态/风景/历史文化/城市占比，深度学习评价） |
|  **绿道按类配色** | 绿道按主导功能类别配色，昼夜双色板随主题自动切换，保证两种底图上均清晰可见 |
|  **图层说明卡** | 功能区划/热度/设施图层开启时展示市民导向的说明卡（含义+图例+用途），可独立关闭不影响图层 |
|  **用户收藏** | 收藏绿道（后端持久化），桌面收藏页 + 移动端收藏页，个人中心真实统计 |
|  **图例控件** | GeoScene 官方 Legend 组件（Expand 折叠），自动展示热力/设施图例 |
|  **实时天气** | 可拖动天气组件（高德地图 API）；移动端详情页内嵌天气卡片 |
|  **AI 助手** | 地图页浮窗（DeepSeek 驱动，对话写入数据库）；移动端全屏聊天面板 |
|  **智能推荐** | 按出行方式+兴趣类型+设施需求给 17 条绿道评分排序（透明理由），可拖动面板，AI 深度解读，一键导航到绿道最近入口 |
|  **AI 对话分析** | 管理员：词云 + 折线图 + 最近提问，昼夜主题自动切换 |
|  **昼夜主题** | 默认按北京时间自动切换，可固定白天/夜间或切回跟随时间（桌面/移动共享偏好） |
|  **热度分析看板** | 管理后台 ECharts 图表：热度排名、趋势分析、评论统计、权重饼图、明细表格 |
|  **管理后台** | JWT 认证（localStorage 持久化）、数据概览、用户管理、系统日志 |
|  **评论系统** | 绿道详情页评论发布，支持可选评分与点赞交互 |
|  **评论管理系统** | 管理端支持评论筛选、状态处理、批量审核/下架 |
|  **内容安全** | 评论发布前执行敏感词检测，命中即拦截 |
|  **用户系统** | 公众用户注册与登录 |
|  **移动端 POI** | 移动端地图叠加 7 类设施图标，缩放联动 + 类型过滤 + 底部弹卡 + 独立搜索页 |
|  **移动端** | Capacitor + Vue 3，原生平台自动跳转移动端布局；AI 助手、实时天气、POI 设施，UI/UX 全面优化 |

---

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

##  17 条绿道

| # | 名称 | 长度 | 特色 |
|----|------|------|------|
| 1 | 温榆河绿道 | 108 km | 滨水生态廊道 |
| 2 | 环二环城市绿道 | 87 km | 城市绿道环线 |
| 3 | 亮马河绿道 | 5.5 km | 商务区滨水绿道 |
| 4 | 常营半马绿道 | 21 km | 半马赛道级绿道 |
| 5 | 昌平42绿道 | 42 km | 全马长度山地绿道 |
| 6 | 丽都商圈绿道 | 6.8 km | 商圈休闲绿道 |
| 7 | 北运河绿道 | 36 km | 运河沿线绿道 |
| 8 | 南沙绿道 | 15 km | 南部生态绿廊 |
| 9 | 奥林匹克森林公园绿道 | 23 km | 奥森公园环绕绿道 |
| 10 | 营城建都绿道 | 42 km | 历史文化遗址绿道 |
| 11 | 三山五园绿道 |  | 皇家园林景观绿道 |
| 12 | 朝阳绿道 |  | 朝阳北部绿道环 |
| 13 | 北翼山水绿道 | 174 km | 北部山区生态绿道 |
| 14 | 东翼大河绿道 | 328 km | 东部河系生态廊道 |
| 15 | 郊野休闲环绿道 | 109 km | 郊野公园休闲环线 |
| 16 | 西翼山水绿道 | 160 km | 西部山水风景绿道 |
| 17 | 中心城滨水绿道 | 125 km | 中心城区滨水绿道 |

---

##  API 端点

```http
GET /api/greenways              # 获取所有绿道列表
GET /api/greenways/:id          # 按 ID 获取单条绿道详情（含设施/颜色/图片）
GET /api/greenways?name=温榆河  # 按名称筛选，返回 GeoJSON FeatureCollection
POST /api/ai/chat               # AI 对话（DeepSeek-V4-Flash）
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

##  环境变量配置

**后端（`greenway-backend/.env.local`）**
```env
DB_HOST=localhost
DB_NAME=greenway
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3001
JWT_SECRET=your_jwt_secret
DEEPSEEK_API_KEY=your_deepseek_api_key
GAODE_KEY=your_amap_web_service_key
```

**前端（`greenway-vue/.env.local`）**
```env
VITE_AMAP_KEY=your_amap_key
VITE_BAIDU_MAP_KEY=your_baidu_key
VITE_API_BASE=http://localhost:3001
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

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3.4 + Vite 5 + Pinia |
| 地图引擎 | GeoScene JS SDK 4.33（2D MapView + 3D SceneView）+ 高德底图 |
| 3D 飞行漫游 | GeoScene SceneView + WebTileLayer（卫星图）+ Camera flyTo 动画 + PostGIS ST_SimplifyPreserveTopology |
| POI 附近设施 | 高德 POI API → PostGIS ST_DWithin → GeoJSON → GeoScene GeoJSONLayer + PictureMarkerSymbol |
| 路径规划 | 本地 Dijkstra 最短路径算法（基于 PostGIS OSM 路网数据） |
| 图表 / 词云 | ECharts 6 + echarts-wordcloud + vue-echarts |
| AI 模型 | DeepSeek-V4-Flash（REST API） |
| 中文分词 | segment（纯 JS 分词库） |
| 后端 | Node.js 18+ + Express 4.18 |
| 数据库 | PostgreSQL 14+ + PostGIS 3.3+ |
| 移动端 | Capacitor 5 |
| 数据格式 | GeoJSON + MultiLineString（SRID 4326） |

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

##  竞赛与知识产权

本项目为技术竞赛参赛作品，正在申请软件著作权。

-  教育科研用途可自由使用
-  商业用途或衍生作品需联系作者授权
-  软件著作权保护申请中

##  许可证

MIT  详见 LICENSE 文件

---

**用❤为北京城市绿道而开发**
