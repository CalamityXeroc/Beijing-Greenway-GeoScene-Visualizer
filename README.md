# Greenway Companion — Smart Greenway Recommendation System Based on Deep Learning and Multi-source Spatial Features

![Vue](https://img.shields.io/badge/Vue-3.4-brightgreen.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)
![PostGIS](https://img.shields.io/badge/PostGIS-3.3+-blue.svg)
![GeoScene](https://img.shields.io/badge/GeoScene-4.33-blue.svg)
![Capacitor](https://img.shields.io/badge/Capacitor-6-119eff.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**English | [中文](./README_zh-CN.md)**

> 🔗 **Lite version (OpenLayers implementation, no commercial GIS license required, clone & run)**
> [Beijing-Greenway-System-Visualizer-A-openlayer-JS-Implementation](https://github.com/CalamityXeroc/Beijing-Greenway-System-Visualizer-A-openlayer-JS-Implementation)
>
> This repository is the **full edition** (GeoScene implementation), with 13 additional modules: deep-learning function profiles, smart recommendation, greenway health assessment, spatial analysis, route planning, isochrone reachability, 3D flyover. See the [comparison table](#two-editions).

---

## Project Overview

A smart greenway recommendation and spatial analysis platform for Beijing citizens. It integrates **17 major greenways** (1248 km), **847 public facilities**, and **29,993 deep-learning function nodes**, covering the full decision chain from *discover → assess → plan → navigate*, across Web, Android App, and Admin Console.

Core idea: combine the **greenway spatial function profiles produced by GeoScene Pro deep learning** with user preferences, and rank via an explainable multi-factor weighted model instead of plain geographic distance.

## Core Features

- **Smart Recommendation** — multi-factor model (function match 0.55 / popularity 0.15 / facilities 0.20 / length 0.10), supporting interests (eco / scenic / historical / urban) and needs (metro / parking / restroom), returning a 65–98 score with explainable reasons
- **Greenway Health Assessment** — five-dimension radar (ecology / transport / facilities / popularity / leisure) with per-dimension highlights and weaknesses
- **Interactive Map** — GeoScene 2D/3D views, AMap basemap, layer control, day/night theme, drawing & measuring tools, PNG export
- **Route Planning & Isochrones** — in-memory graph over 130k OSM road segments (min-heap Dijkstra, 22 m intersection snapping), turn-level navigation and 5–30 min walking/cycling/driving isochrones
- **Spatial Analysis** — polygon query, buffered facility statistics (PostGIS `ST_DWithin`), POI clustering, function zoning grid, heatmap
- **3D Flyover** — tubular path + moving light beads + real terrain with real-time shadows, sampled to 45 evenly spaced waypoints
- **AI Assistant** — DeepSeek-V3.2 with intent-based prompt routing and greenway profile context injection; multi-turn conversation persisted, plus word cloud and question-trend analytics in admin
- **Community & Operations** — comments (17 sensitive-word lexicons), favorites, feedback, popularity index (route×0.40 + facility×0.25 + comment×0.20 + click×0.15)
- **Multi-platform** — Capacitor 6 Android app with a native Java location plugin (`LocationManager`, no GMS dependency)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3.4 + Vite 5 + Pinia |
| Map engine | **GeoScene JS SDK 4.33** (MapView + SceneView) + AMap basemap; OpenLayers 8.2 on mobile |
| Backend | Node.js 18+ + Express 4.18 |
| Database | PostgreSQL 14+ + **PostGIS 3.3+** |
| Spatial algorithms | In-memory graph Dijkstra, isochrone convex hull, WGS-84 ↔ GCJ-02 dual-side conversion |
| AI | DeepSeek-V3.2 (SiliconFlow, OpenAI-compatible API) |
| Charts | ECharts 5.6 + echarts-wordcloud + `segment` tokenizer |
| Mobile | Capacitor 6 + native Android plugin (Java) |
| Data format | GeoJSON / MultiLineString (SRID 4326) |

## Quick Start

```bash
# 1. Backend
cd greenway-backend
cp .env.example .env.local        # fill in DB, JWT_SECRET, API keys
npm install
npm run dev                        # http://localhost:3001

# 2. Frontend
cd ../greenway-vue
cp .env.example .env.local
npm install
npm run dev                        # http://localhost:5173
```

**Database**: create a `greenway` database with PostGIS enabled, then initialize schema per `docs/DATABASE.md`. Greenway vectors and facility data must be prepared by yourself (see "Data Notice").

**Optional configuration** (the app runs without them):

| Variable | Purpose | Behavior if unset |
|---|---|---|
| `VITE_GEOSCENE_BASE` | GeoScene Server URL | Falls back to backend GeoJSON rendering |
| `GEO_SCENE_QUERY_BASE` | Same, for backend proxy | `/api/geoscene/*` returns 503 |
| `GAODE_KEY` | AMap weather / geocoding / search | Related cards hidden |
| `SILICONFLOW_API_KEY` | AI assistant | Assistant unavailable, rest works |

## Project Structure

```
greenproject/
├── greenway-backend/         # Node.js + Express + PostgreSQL/PostGIS
│   ├── src/
│   │   ├── index.js          # entry, tile proxy, scheduled heatmap refresh
│   │   ├── auth.js           # JWT authentication
│   │   └── routes/           # 17 business route modules
│   ├── scripts/              # DB init and data import scripts
│   └── .env.example
├── greenway-vue/             # Vue 3 + GeoScene SDK + Capacitor
│   ├── src/
│   │   ├── views/            # desktop pages
│   │   ├── components/       # desktop components
│   │   ├── mobile/           # mobile app (Capacitor)
│   │   ├── core/             # map management
│   │   └── stores/           # Pinia state
│   ├── public/               # static assets
│   └── android/              # Capacitor Android native project
├── docs/                     # detailed docs (see table below)
└── LICENSE
```

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Project structure detail, design system, security, data flow |
| [docs/API.md](docs/API.md) | Route overview + all API endpoints |
| [docs/DATABASE.md](docs/DATABASE.md) | Table schemas and spatial index design |
| [docs/CONFIG.md](docs/CONFIG.md) | Environment variables, GeoScene Server integration |
| [docs/GREENWAYS.md](docs/GREENWAYS.md) | The 17 greenways and their function profiles |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Changelog |

## Two Editions

| Aspect | This repo (full) | Lite (OpenLayers) |
|---|---|---|
| Map engine | GeoScene JS SDK 4.33 | OpenLayers 8.2 |
| Commercial license | GeoScene Server optional (runs without it) | **None** |
| Backend routes | **17** | 4 |
| Deep-learning function profiles | ✅ 29,993 nodes / 2,827 grids / 1,474 segments | ❌ |
| Smart recommendation / assessment | ✅ | ❌ |
| Route planning / isochrone / spatial analysis | ✅ | ❌ |
| 3D flyover / panorama | ✅ | ❌ |
| AI assistant + conversation analytics | ✅ | ✅ |
| Comments / favorites / feedback | ✅ | Partial |
| Best for | Full demo, competition, extension | Learning, no-license scenarios |

## Data Notice

This repository **does not include** the following data (restricted by competition confidentiality and IP agreements); please prepare your own:

- Beijing greenway vector data and photos
- Deep-learning function identification outputs (nodes / zoning grids / segments)
- Beijing OSM road network
- Comment sensitive-word lexicons (comments gracefully degrade without them)

Spatial query, recommendation, and route planning logic is decoupled from the data — plug in your own dataset and it runs.

## Competition & Intellectual Property

This project is an entry to the **2026 Esri Cup China University Student GIS Software Development Competition** and was awarded the **National First Prize in the Application Development Track** (Entry No. **C186**, College of Applied Arts and Science, Beijing Union University).

- 🏆 **Award**: 2026 Esri Cup China University Student GIS Software Development Competition — Application Development Track — **First Prize**
- 📄 **Software Copyright**: Application filed
- 📝 **Paper**: Under review for publication
- ⚠️ **Strictly No Commercial Use**: This project is provided for education, research, and competition demonstration only. **Any commercial use is strictly prohibited** without prior written authorization from the authors, including but not limited to commercial deployment, resale, or SaaS offerings.
- Attribution is required for citations or derivative works.

## License

[MIT](LICENSE) © 2025-2026 Greenway Companion Team
