# 绿脉伴侣 —— 基于深度学习与多源空间特征的绿道智慧推荐系统

![Vue](https://img.shields.io/badge/Vue-3.4-brightgreen.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)
![PostGIS](https://img.shields.io/badge/PostGIS-3.3+-blue.svg)
![GeoScene](https://img.shields.io/badge/GeoScene-4.33-blue.svg)
![Capacitor](https://img.shields.io/badge/Capacitor-6-119eff.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**[English](./README.md) | 中文**

> 🔗 **轻量版（OpenLayers 实现，无需商业 GIS 许可，clone 即可运行）**
> [Beijing-Greenway-System-Visualizer-A-openlayer-JS-Implementation](https://github.com/CalamityXeroc/Beijing-Greenway-System-Visualizer-A-openlayer-JS-Implementation)
>
> 本项目为**完整版**（GeoScene 实现），额外包含深度学习功能画像、智能推荐、绿道体检、空间分析、路径规划、可达圈、3D 漫游等 13 个模块。两版功能对照见 [下方表格](#两个版本对比)。

---

## 项目简介

面向北京市民的绿道智慧推荐与空间分析平台。系统整合 **17 条北京主要绿道**（1248 km）、**847 处便民设施**、**29,993 个深度学习功能识别节点**，提供从"发现—评估—规划—导航"的完整决策链路，并支持 Web 端、Android App 与管理后台三端协同。

核心思路：把 **GeoScene Pro 深度学习产出的绿道空间功能画像**与用户偏好结合，用可解释的多因子加权模型做推荐，而不是简单的地理距离排序。

## 核心功能

- **智能推荐** —— 多因子加权模型（功能匹配 0.55 / 热度 0.15 / 设施 0.20 / 长度 0.10），支持「生态 / 风景 / 历史文化 / 城市」兴趣与「地铁 / 停车 / 卫生间」附加需求，输出 65~98 分推荐度与可解释理由
- **绿道体检评估** —— 五维雷达图（生态自然 / 出行便捷 / 设施完备 / 人气活力 / 休闲适宜），逐维给出亮点与短板文案
- **交互地图** —— GeoScene 2D/3D 双视图、高德底图、图层控制、昼夜主题、绘图与测量工具、PNG 导出
- **路径规划与可达圈** —— 基于 13 万条 OSM 路网在内存建图（最小堆 Dijkstra，22m 交叉口合并容差），输出转向级导航与步行/骑行/驾车 5–30 分钟等时圈
- **空间分析** —— 多边形区域查询、缓冲区设施统计（PostGIS `ST_DWithin`）、POI 聚类、功能区划网格、热力图
- **3D 飞行漫游** —— 沿绿道的管状路径 + 路径光珠 + 真实地形与实时阴影，45 个等距航点采样
- **AI 助手** —— 接入 DeepSeek-V3.2，按意图路由系统提示词并注入绿道功能画像上下文，支持多轮对话与全量落库；管理后台提供词云与提问趋势分析
- **社区与运营** —— 评论（17 类敏感词库拦截）、收藏、反馈、热度指数（路径×0.40 + 设施×0.25 + 评论×0.20 + 点击×0.15）
- **多端** —— Capacitor 6 打包 Android App，含 Java 原生定位插件（`LocationManager`，不依赖 GMS）

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端框架 | Vue 3.4 + Vite 5 + Pinia |
| 地图引擎 | **GeoScene JS SDK 4.33**（MapView + SceneView）+ 高德底图；移动端使用 OpenLayers 8.2 |
| 后端 | Node.js 18+ + Express 4.18 |
| 数据库 | PostgreSQL 14+ + **PostGIS 3.3+** |
| 空间算法 | 自研内存图 Dijkstra、等时圈凸包、WGS-84 ↔ GCJ-02 双端坐标转换 |
| AI | DeepSeek-V3.2（硅基流动 SiliconFlow，OpenAI 兼容接口） |
| 图表 | ECharts 5.6 + echarts-wordcloud + segment 中文分词 |
| 移动端 | Capacitor 6 + Android 原生插件（Java） |
| 数据格式 | GeoJSON / MultiLineString（SRID 4326） |

## 快速开始

```bash
# 1. 后端
cd greenway-backend
cp .env.example .env.local        # 填入数据库、JWT_SECRET、API Key
npm install
npm run dev                        # http://localhost:3001

# 2. 前端
cd ../greenway-vue
cp .env.example .env.local
npm install
npm run dev                        # http://localhost:5173
```

**数据库准备**：创建 `greenway` 库并启用 PostGIS，按 `docs/CONFIG.md` 与 `docs/DATABASE.md` 初始化表结构；绿道矢量与设施数据需自行准备（见下方"数据说明"）。

**可选配置**（不配也能跑）：

| 变量 | 作用 | 未配置时 |
|---|---|---|
| `VITE_GEOSCENE_BASE` | GeoScene Server 服务地址 | 自动降级用后端 GeoJSON 渲染绿道 |
| `GEO_SCENE_QUERY_BASE` | 同上（后端代理） | `/api/geoscene/*` 返回 503 |
| `GAODE_KEY` | 高德天气/逆地理/搜索 | 相关卡片不显示 |
| `SILICONFLOW_API_KEY` | AI 助手 | 助手不可用，其余正常 |

## 项目结构

```
greenproject/
├── greenway-backend/         # Node.js + Express + PostgreSQL/PostGIS
│   ├── src/
│   │   ├── index.js          # 入口、瓦片代理、定时热度更新
│   │   ├── auth.js           # JWT 认证
│   │   └── routes/           # 17 个业务模块路由
│   ├── scripts/              # 数据库初始化与数据导入脚本
│   └── .env.example
├── greenway-vue/             # Vue 3 + GeoScene SDK + Capacitor
│   ├── src/
│   │   ├── views/            # 桌面端页面
│   │   ├── components/       # 桌面端组件
│   │   ├── mobile/           # 移动端（Capacitor App）
│   │   ├── core/             # 地图管理
│   │   └── stores/           # Pinia 状态
│   ├── public/               # 静态资源
│   └── android/              # Capacitor Android 原生工程
├── docs/                     # 详细文档（见下表）
└── LICENSE
```

## 文档导航

| 文档 | 内容 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 项目结构详情、设计系统、安全机制、数据流转 |
| [docs/API.md](docs/API.md) | 路由总览 + 全部 API 端点说明 |
| [docs/DATABASE.md](docs/DATABASE.md) | 数据库表结构与空间索引设计 |
| [docs/CONFIG.md](docs/CONFIG.md) | 环境变量、GeoScene Server 接入说明 |
| [docs/GREENWAYS.md](docs/GREENWAYS.md) | 17 条绿道清单与功能画像 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 更新日志 |

## 两个版本对比

| 维度 | 本项目（完整版） | 轻量版（OpenLayers） |
|---|---|---|
| 地图引擎 | GeoScene JS SDK 4.33 | OpenLayers 8.2 |
| 商业许可依赖 | 需自备 GeoScene Server（可选，不配也能跑） | **无** |
| 后端路由 | **17 个** | 4 个 |
| 深度学习功能画像 | ✅ 29,993 节点 / 2,827 网格 / 1,474 分段 | ❌ |
| 智能推荐 / 绿道体检 | ✅ | ❌ |
| 路径规划 / 可达圈 / 空间分析 | ✅ | ❌ |
| 3D 飞行漫游 / 全景 | ✅ | ❌ |
| AI 助手 + 对话分析 | ✅ | ✅ |
| 评论 / 收藏 / 反馈 | ✅ | 部分 |
| 适用场景 | 完整演示、竞赛、二次开发 | 学习、无商业许可场景 |

## 数据说明

本仓库**不包含**以下数据（受竞赛保密与知识产权约定约束），请自行准备：

- 北京市绿道真实矢量数据与照片
- 深度学习功能识别成果（功能节点 / 功能区划网格 / 功能分段）
- 北京 OSM 路网数据
- 评论敏感词库（缺失时评论功能自动降级）

代码中的空间查询、推荐、路径规划逻辑均与数据解耦，接入自有数据即可运行。

## 竞赛与知识产权

本项目为 **2026 易智瑞杯中国大学生 GIS 软件开发竞赛**参赛作品（作品编号 C186，北京联合大学应用文理学院），软件著作权申请中。

- 教育科研用途可自由使用
- 商业用途或衍生作品请联系作者授权

## 许可证

[MIT](LICENSE) © 2025-2026 绿脉伴侣项目组
