# Beijing Greenway System Visualization Platform

![Vue](https://img.shields.io/badge/Vue-3.4.0-brightgreen.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)
![GeoScene](https://img.shields.io/badge/GeoScene-4.33-blue.svg)
![DeepSeek](https://img.shields.io/badge/AI-DeepSeek%20V4-Flash-purple.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

A modern WebGIS platform for exploring Beijing's greenway network, built with Vue 3 + GeoScene JS SDK + Amap + PostgreSQL/PostGIS.

**[English](./README.md) | [中文](./README_zh-CN.md)**

> ⚡ **Quick Start?** See the [**快速部署指南.md**](./快速部署指南.md) for complete setup instructions (PostgreSQL + Node.js configuration included)

---

##  Screenshots


![Landing Page](示例图片/1.png)


![Map Overview](示例图片/2.png)


![Greenway Detail](示例图片/3.png)


![GIS Tools](示例图片/4.png)


![Admin Panel](示例图片/5.png)


![Mobile View](示例图片/6.png)

---

##  Project Overview

Interactive visualization of **17 major Beijing greenways** featuring a fullscreen landing page, an interactive GeoScene map with Amap basemap tiles, path planning & navigation, **3D flyover tour**, GIS tools, real-time weather, panoramic street view, admin panel, user auth, and a Capacitor-based mobile app.

-  17 complete greenway routes
-  Vue 3 + GeoScene JS SDK + Amap tiles frontend
-  Node.js + Express REST API backend
-  PostgreSQL + PostGIS geospatial database
-  Fullpage landing page with debounced mouse-wheel scroll (6 sections)
-  Layer control integrated into top navigation bar
-  **Greenway Heatmap Layer**: Real-time heatmap overlay with three-factor weighted index (clicks × 0.2 + routes × 0.5 + comments × 0.3), toggleable in layer panel; auto-initialises 17 greenway records with comment count sync
-  Admin panel with JWT authentication (localStorage, persists across tabs)
-  Admin login state reflected in frontend navbar
-  RGB color picker for all drawing tools (point / line / polygon)
-  Map canvas export to PNG
-  Back-to-homepage button in map navigation bar
-  User login / registration system
-  Greenway detail comment system (desktop panel, optional rating)
-  Comment moderation console in admin panel (`/admin/comments`) with search and batch actions
-  Sensitive-word interception for comments (blocked submissions are rejected with prompt)
-  Full site day/night theme (auto-switches by Beijing time) + responsive design
-  **AI Assistant (绿道小助手)**: Powered by DeepSeek-V4-Flash, supports route recommendations, tutorials, and Q&A; conversations logged to database
-  **Admin AI Chat Analytics**: Word cloud + daily trend chart (7/30/90 day views) + recent messages log, with day/night theme support (ECharts + echarts-wordcloud, Chinese NLP via `segment`)
-  **3D Flyover Tour (3D 漫游)**: Immersive bird's-eye flight with glowing 3D tube path (PathSymbol3DLayer), auto-play camera animation with banking on turns, waypoint beads with fly/current/upcoming states, camera trail (flown/remaining segments), time-based atmosphere (starfield, sky color, ground color), and playback controls. Paths simplified via PostGIS `ST_SimplifyPreserveTopology` + `ST_LineInterpolatePoint` — exactly 45 equidistant waypoints per greenway, regardless of original vertex count (up to 4,911 raw vertices reduced to 45). **True-3D city scene**: up to 250 real OSM building footprints along an 800 m corridor (`planet_osm_polygon`, 111k buildings) extruded with `PolygonSymbol3D` + `ExtrudeSymbol3DLayer` (height estimated from area, color-coded by building type, dimmed to city-night look after dark), plus `LabelSymbol3D` name callouts for buildings and nearby POIs (metro/bus/scenic/park/food with colored dots); top bar toggles buildings/labels. Query tuned with bbox coarse filter + precomputed area column (~0.24 s).
-  **POI Nearby Facilities**: 847 facilities across 7 categories (subway, bus, parking, restroom, convenience store, cinema, scenic spots) imported from Amap POI API, filtered by PostGIS `ST_DWithin` within 1 km of greenways. Professional SVG map markers with hover tooltips and click detail popups. Global keyword search with autocomplete + keyboard navigation in the top navbar. Per-type visibility control via layer legend panel and detail-page layer controller. Adjustable search radius (500m–5km) on detail pages. State persisted across page navigation via sessionStorage.
-  **POI Facility Clustering**: Facilities auto-aggregate into numeric bubbles at zoom 11–13, dispersing into individual points when zoomed in. Clicking a cluster opens a popup listing the real POI names within the aggregation area. Clustering strictly follows layer type filtering (`definitionExpression`) so only user-selected facility types are aggregated.
-  **Unified GeoScene Popup**: All facility interaction UI migrated to native GeoScene popups (popupTemplate + content function) supporting facility icons, type, address, distance display and a one-click "View Greenway Detail" jump button. Both single-point and cluster popups fully support day/night themes.
-  **Spatial Analysis Toolkit**: Draw a polygon on the map to run a backend PostGIS `ST_Intersects` spatial query, returning greenways and facilities within the area — highlighted on the map with a result list panel (including area, perimeter, and facility density analysis). Multiple analysis polygons supported; clicking a polygon again restores its results.
-  **Greenway Function Zoning (绿道功能区划)**: ~30k deep-learning classified nodes (eco / scenic / historical / urban) are aggregated into a hexagonal-grid zoning map (`ST_HexagonGrid` + majority vote per cell), so citizens can see at a glance which type each Beijing area's greenways lean toward. Grid size auto-adjusts with zoom (0.04° / 0.02° / 0.01°), pre-aggregated into `greenway_function_grid` + boot-time warm-up cache for instant zoom switching.
-  **Greenway Function Profile (绿道功能画像)**: Each greenway detail page shows a functional profile card (eco / scenic / historical / urban shares computed in a 1 km buffer via pre-aggregated `greenway_function_profile`), letting users quickly understand a greenway's character; the AI assistant also receives this profile data to recommend greenways (e.g. "best eco greenway").
-  **Greenway Color Coding (绿道按类配色)**: Greenways are colored by their dominant functional category, with dedicated day/night palettes — colors auto-switch with the theme so lines stay visible on both the light daytime basemap and the dark night (inverted) basemap.
-  **Layer Legend Cards (图层说明卡)**: Turning on the Function Zoning / Heatmap / Facilities layers shows citizen-oriented explainer cards (glassmorphism, gradient accents) at the map corner — explaining what the layer means, the legend, and usage tips (e.g. "green = close to nature, brown = historic sites"); cards are independently closable without affecting the layer.
-  **Layer Management Consolidation**: The layer menu now groups "北京市" (boundary + area) and "绿道（全部 17 条）" as single aggregate switches controlling all respective layers at once.
-  **User Favorites + Personal Center**: Favorite greenways (backend `user_favorites` table + favorite button), desktop favorites page, mobile favorites page, and personal-center stats (favorites count, ride records, total distance, comment count) all wired to real data.
-  **Layer Legend Widget**: Integrated official GeoScene Legend component (Expand collapsible panel) that automatically shows heatmap gradients and facility legends.
-  **Mobile POI Facilities**: Mobile map (OpenLayers) overlays 7 facility categories with SVG icons, zoom-linked visibility (facilities appear when zoomed to city/greenway level), per-type filter chips, tap-to-open bottom sheet with details + greenway jump, and a dedicated facility search page with type shortcuts and keyword search.
-  **Follow-Time Theme**: The whole site auto-switches between day/night by Beijing time by default; users can pin a fixed theme or return to auto mode at any time (both desktop and mobile share one preference store).
-  **Smart Recommendation (绿道智能推荐)**: A dedicated recommend engine (`POST /api/greenways/recommend`) scores all 17 greenways from user preferences — travel mode (walk/cycle), interest types (eco / scenic / historical / urban, or "no preference") and facility needs (metro / parking / restroom). Scoring is transparent: short-board functional match (min of selected-type shares, hard threshold <15% excludes), heat ranking, facility completeness (spatial 1km stats) and length fit, with adaptive weights (explicit interests → match 55% dominant; "no preference" → heat + facilities). Results show score, profile shares, heat rank, template reasons (e.g. "historical 39%, best for visiting ancient sites") and the #1 card highlighted.
-  **Draggable Recommend Panel + AI Interpretation**: The recommendation panel is a freely draggable glassmorphism window (preferences → results → "去这里"). An "AI 解读" button feeds the full profile/facility data of each recommendation to the assistant for a detailed 250-300 char review (per-item match/gap analysis, comparison and practical advice).
-  **Nearest-Entry Routing (最近入口导航)**: "去这里" opens route planning with the destination dynamically set to the greenway's closest point to the current origin (PostGIS `ST_ClosestPoint` over the merged multi-line, `GET /api/greenways/name/:name/nearest-entry`). If the origin is set later (map pick / "my location"), the destination auto-recomputes — users always navigate to the nearest entry of a multi-km greenway instead of a random endpoint.
-  **Greenway Reachability Circles (绿道可达圈)**: A citizen-facing accessibility analysis — pick your location (GPS / map pick), choose walk or cycle, and see 5/10/15/20/30-min isochrone hulls drawn on the map (color-graded green→yellow→orange→red) plus the list of greenways reachable within the selected time, each with real network distance and minutes (Dijkstra distance field over the shared road graph, `POST /api/accessibility/reach`). One request returns all five hull levels so the time slider updates instantly; "去这里" jumps straight to nearest-entry routing. Entry lives in the Spatial Analysis menu ("区域分析" for polygon analysis, "可达圈分析" for accessibility), sharing the same road-graph module and cache as path planning.
-  **Greenway Health Assessment (绿道体检评估)**: A citizen-facing "health check" over all 17 greenways — five dimensions (ecological naturalness / transit convenience / facility completeness / popularity vitality / leisure suitability) are scored into a transparent, explainable total with grades (优/良/中/待提升) plus highlights & weak-point tips in plain language (`GET /api/greenways/assess`). The draggable assessment panel shows the 17-greenway health ranking (click to locate & highlight on the map), an ECharts radar chart (selected greenway vs city-average on the 5 dimensions), the function-profile share bar, and an "AI health report" (feeds the full five-dimension/profile/rank data to AI for a 250-300 char citizen-style report: overall verdict / highlights / best-fit crowds / departure tips). Entry in the Spatial Analysis menu ("绿道评估"). Facility stats now come from the pre-aggregated `greenway_facility_stats` table (6.2s → 0.4s, shared with the recommender).
-  **Mobile Floating Glass Bottom Bar**: Floating glassmorphism tab bar with rounded corners and backdrop blur; active tab icon rises & scales with a spring animation, selected indicator removed for a clean look.
-  **Mobile Discover (Content-Feed Style)**: Real-photo hero banner carousel + featured greenway cards using actual route photos + community feed posts with cover images — a picture-driven home page.
-  **Real Photo Trail Cards**: Greenway & favorites cards now render actual route photos (`/images/greenways/…`) with graceful placeholder fallback, replacing flat gradient placeholders.
-  **Mobile POI Search & Locate**: Search a facility → tap result → map flies to the point (zoom 16) with a highlighted glow ring around the selected POI; POI layer only shows when zoomed in or after search.
-  **Backend Response Caching**: In-memory cache for `/api/greenways` & `/api/facilities/geojson` (60s TTL, single-flight dedup, warm-up on boot) — mobile map data loads in ~0.2s instead of 4–7s.
-  **Mobile AI Assistant (Greenway Helper)**: AI button on the map page opens a fullscreen chat panel — route recommendations, usage guidance, greenway Q&A (DeepSeek-powered), dual-theme bubbles & quick suggestions.
-  **Mobile Real-time Weather**: Inline weather card on the greenway detail page (Amap Weather API, queried by greenway centroid: temperature/weather/wind/humidity), with refresh & skeleton loading.
-  **Mobile Map Stability Fix**: Fixed the map becoming a blank background after repeatedly navigating to detail pages (map instance now correctly rebuilt after disposal).
-  **Detail Page Single-Route API**: Greenway detail now queries by ID (`GET /api/greenways/:id`) instead of fetching all 17 routes and filtering client-side.
-  **API Security Hardening**: Removed the hardcoded Amap key from WeatherCard; now read from environment variables.
-  **Community Feed API**: New `/api/comments/recent` endpoint returns the latest cross-greenway top-level comments for the Discover feed.
-  **Global Toast Fix & Favorites Refresh**: Toast prompts now display their message text (were blank colored blocks); favorites page reloads on every entry (keep-alive aware) so new favorites appear immediately.
-  Capacitor-based mobile app (enhanced UI/UX)
-  **Mobile Greenway Health Assessment (移动端绿道体检)**: Every greenway detail page now embeds the same deep-learning assessment as the web — five-dimension scores vs city average, functional profile share bar, highlights/weak-points, and an AI deep-report button (DeepSeek), all styled with the mobile design system.
-  **Mobile Locate-Me Button + Permission Guide**: New "locate me" FAB on the mobile map triggers the system location-permission dialog (and toast guidance when GPS/permission is off), fixing location on real devices.
-  **Admin Entry Fix (mobile)**: Mobile admin pages now authenticate with the frontend user identity (role=admin), removing the double-login when entering admin from the profile page.
-  **Admin Dashboard Stats API**: New `GET /api/admin/dashboard/stats` endpoint powers the mobile admin home cards (users/comments/pending/today).
-  **Admin Stats Pages Work on Mobile**: route/heatmap/POI stats services now use the adaptive API base (`getApiBaseUrl`), so the three dashboards load real data inside the Capacitor app; responsive layout (2-col cards, compact charts) + chart-init timing fix for the WebView.
-  **Native Splash Polish**: App boot shows a pure dark-green splash (no white flash, no icon), seamlessly transitioning into the Vue green animation; new transparent text-free logo (`logo_icon.svg`) used in the splash.
-  **GeoScene Native Engine Registered**: `MainActivity` now registers the `GeoScene` Capacitor plugin, so the settings page shows "connected · 200.8.0" (Developer license) instead of unavailable.
-  **Detail Info Table Refine**: Removed redundant length/ID rows; shows real data (area / coverage / construction area / features).
-  **Mobile Map UI Conflict Fix**: Spatial-analysis bar no longer overlaps the POI-type bar when both are open (auto lifts above).
-  **Coordinate Alignment (GCJ-02)**: Path planning & reachability outputs are converted WGS-84 ↔ GCJ-02 to align with the Amap basemap (shared `coordTransform.js` backend util + frontend helper).
-  **Real-Device Geolocation Fix (国内真机定位修复)**: Capacitor's Geolocation plugin depends on Google Play Services (GMS), which is unavailable on domestic Android devices — added a native GeoScene location path (Android `LocationManager` via the GeoScene plugin) with three-level fallback: native LocationManager → browser HTML5 Geolocation → Capacitor plugin (network-location). The diagnostic page gains a "定位测试" button to verify the location chain on real devices.
-  **Mobile Landing Native Scroll**: On mobile (≤768px) the landing page no longer uses full-screen page snapping; it restores native scrolling (fixes content clipping) with an `IntersectionObserver` driving section-active state, stats counters and card reveals; the hero globe scales to fit its container.
-  **Web Responsive on Mobile Browsers (desktop pages adapt)**: Visiting the site from a phone browser now adapts every desktop page to mobile — top-nav tools become horizontally scrollable with tap-to-toggle dropdowns (hover unavailable on touch, so clicks toggle menus and outside taps close them); the landing page scrolls natively; the admin sidebar collapses into a hamburger drawer (tap to slide in + mask, tapping a menu item closes it); all 17 greenway detail page titles center correctly (fixed the 480px padding that pushed titles off-screen); map legend cards and analysis panels (path planning / recommendation / reachability / assessment) go full-width without overflow; the search input pins a 14px font size; pinch-zoom and text selection are allowed (accessibility).
-  **Desktop Layout Fixes**: The top navbar switches its tool strip to horizontal scrolling at medium window widths (1024–1366px) so menus + search + user area never overflow; touch detection now uses `pointer: coarse` so Windows laptops with touchpads no longer lose hover dropdowns; the admin sidebar collapse button works again on desktop.
-  **Greenway Compare (side-by-side PK)**: A new unified "Greenway Recommend" menu in the top nav groups three helpers — Smart Recommend / Greenway Assess / Greenway Compare. The compare panel lets you tick up to 3 greenways: an overlaid multi-color radar chart (red/blue/green vs dashed city average), an 8-row metrics table (overall score, five dimension scores — ecological / transit / facility / popularity / leisure — length, and heat rank; best value highlighted green, "暂无/N-A" for greenways without heat data), and a verdict row picking the overall winner; the map highlights the compared greenways in their colors and dims the rest, restoring automatically on close; adding/removing/swapping comparison items updates the charts instantly. One-click "Go to best" (nearest-entry routing) plus "AI comparison review" (250–300 chars of scenario-based advice: strolling/cycling/heritage visits, etc.).

---

##  GeoScene Server Integration (Domestic GIS Platform)

The map data sources are now backed by **GeoScene Server** (EasyIRIS's domestically-developed GIS platform) published map services, called directly from the frontend over the public internet:

| Service Layer | Content | Count |
|---------|------|------|
| Greenways (`地图/MapServer/2`) | 17 major Beijing greenway routes | 17 |
| Facilities (`地图/MapServer/1`) | Nearby amenities (metro / bus / parking / restroom / store / cinema / scenic) | 847 |
| Function Grid (`greenwayfunction/MapServer/1`) | Hexagonal zoning from deep-learning classification (eco / scenic / historical / urban), zoom-linked 0.04°–0.01° grids | 2827 |
| Function Nodes (`greenwayfunction/MapServer/0`) | Deep-learning evaluation nodes | 29993 |

- Frontend rendering & interaction stay **pixel-consistent with the original implementation**: 17-color day/night greenway palettes, gold hover highlight, orange click highlight & cards, compare-mode linkage; SVG facility icons, clustering, type filters, detail jumps; 4-color translucent zoning grids with zoom linkage.
- Service fields are truncated by the SHP export (e.g. `descriptio`→`description`); the frontend maps & backfills fields (e.g. `greenway_i`→greenway name, `poi_type`→type name).
- Services are publicly accessible (anonymous query allowed) behind an nginx `/rest/` reverse-proxy entry.

---

##  Quick Start

### One-Command (Windows)
```bash
.\启动完整系统.bat
```
Opens two terminals  backend on port **3001** and frontend on port **5173**.

### Manual

**Backend:**
```bash
cd greenway-backend
npm install
npm run db:init        # initialise PostgreSQL + PostGIS tables
npm run db:chat-logs  # create AI chat logs table
npm run db:heatmap    # create heatmap tracking tables
npm run dev            # http://localhost:3001
```

**Frontend (new terminal):**
```bash
cd greenway-vue
npm install
npm run dev       # http://localhost:5173
```

---

##  Core Features

| Feature | Description |
|---------|-------------|
|  **Landing Page** | Fullpage debounced mouse-wheel scroll, 6 animated sections, 0.6s transition |
|  **Interactive Map** | GeoScene multi-layer rendering with Amap tile basemap |
|  **Path Planning** | Walking/cycling route planning via vertex-level Dijkstra over the OSM road network (PostGIS), turn-by-turn street-name guidance steps, region graph caching |
|  **3D Flyover Tour** | Glowing 3D tube path + waypoint beads + camera trail + banking turns + time-based atmosphere effects; 45-point equal-distance sampling via PostGIS simplification |
|  **GIS Toolkit** | Draw (with RGB color picker), measure, import GeoJSON, toggle base layers |
|  **Map Export** | Export current map view as PNG image |
|  **17 Greenways** | Individual detail pages with attributes, real images, facility info & street panorama |
|  **Nearby Facilities** | 847 POIs (7 categories), SVG markers, tooltip+popup, keyword search, per-type filter, radius slider, session-persisted |
|  **POI Clustering** | Zoom 11–13 aggregates facilities into bubbles, dispersing at higher zoom; cluster popup lists real POI names, follows type filtering |
|  **Unified Popup** | Single/aggregate unified GeoScene popup: facility detail + greenway jump button, day/night themes |
|  **Spatial Analysis** | Draw polygon → PostGIS spatial query → greenway/facility highlight + result panel (area/perimeter/density); mobile map draw-toolbar |
|  **Function Zoning** | Hexagonal-grid zoning map of Beijing's greenway dominant types (deep-learning classified, 30k nodes), zoom-linked grid granularity, translucent color blocks |
|  **Function Profile** | Each greenway detail page shows its functional profile (eco / scenic / historical / urban shares) from deep-learning evaluation |
|  **Greenway Color Coding** | Greenways colored by dominant functional category; day/night dual palettes auto-switch to stay visible on both basemaps |
|  **Layer Legend Cards** | Citizen-oriented explainer cards for Function Zoning / Heatmap / Facilities layers (what it means + how to use), independently closable |
|  **User Favorites** | Favorite greenways (backend persisted), desktop + mobile favorites pages, personal-center real stats |
|  **Legend Widget** | Official GeoScene Legend component (Expand collapsible), auto heatmap/facility legends |
|  **Real-time Weather** | Draggable weather widget (Amap API); mobile detail page embeds an inline weather card |
|  **AI Assistant** | Map/detail-only floating chatbot (DeepSeek-V4-Flash), conversations logged to DB; mobile fullscreen chat panel |
|  **Smart Recommendation** | Preference-driven greenway recommender (travel mode + interests + facility needs → scored ranking with transparent reasons), draggable panel, AI deep-dive interpretation, and smart routing to the greenway's nearest entry |
|  **AI Chat Analytics** | Admin: word cloud + daily trend + recent messages, dual day/night theme |
|  **Day/Night Theme** | Auto-switches by Beijing time by default; user can pin day/night or return to follow-time mode (desktop & mobile shared preference) |
|  **Heatmap Analytics** | Admin dashboard with ECharts: heat ranking, trend, comment stats, weight pie, detail table |
|  **Admin Panel** | JWT auth (localStorage), dashboard, user management, logs |
|  **Comment System** | Detail-page comments with optional rating and like interactions |
|  **Comment Management** | Admin review panel with filtering, status actions, and batch updates |
|  **Content Safety** | Sensitive-word check blocks disallowed comments before storage |
|  **User Auth** | Public user registration and login |
|  **Mobile App** | Capacitor + Vue 3, auto-detected on native platform; AI assistant, real-time weather, POI facilities, route planning, spatial analysis, theme, and polished mobile UI |

---

##  Project Structure

```
 greenway-backend/           # Node.js + Express + DB
    src/
       index.js            # API entry point
       db.js               # PostgreSQL connection pool
       cache.js            # In-memory response cache (greenways/facilities, single-flight + warm-up)
       routes/
          ai.js            # DeepSeek chat API + chat_logs INSERT
          adminAiStats.js  # Admin AI analytics (word cloud & trends)
          gaode.js         # Amap API proxy (directions / search / geocode)
          osrmRoute.js     # Dijkstra shortest-path routing (OSM road network)
          heatmap.js       # Heatmap tracking & analytics APIs
          poi.js           # POI nearby-facilities query & admin stats APIs
          favorites.js     # User favorites CRUD & personal-center stats APIs
          spatial.js       # Spatial analysis API (polygon query for greenways/facilities)
    scripts/
       add-chat-logs-table.js   # DB migration: chat_logs table
       add-heatmap-tables.js    # DB migration: heatmap tracking tables
       add-favorites-table.js   # DB migration: user_favorites table
       import-pois.cjs          # Amap POI importer (7 categories, ST_DWithin filter)
       ...                      # DB init & GeoJSON import utilities
    init-db.sql             # Schema + PostGIS setup

 greenway-vue/               # Vue 3 frontend (Vite)
    src/
       views/
          LandingPage.vue          # /   fullpage homepage
          GreenwayOverview.vue     # /map  main map view
          *Detail.vue              # /wenyu  /zhongxincheng (17 pages)
          UserLogin.vue            # /login
          UserRegister.vue         # /register
          admin/                   # /admin/* (auth-protected)
              aistats/AiChatStats.vue  # AI chat analytics dashboard
       components/
          TopNavbar.vue            # Navigation bar + layer dropdown
          MapViewer.vue            # GeoScene map wrapper with Amap basemap
          MapToolbarGeoScene.vue   # GIS tools (draw/measure/layers)
          PathPlanning.vue         # Route planning panel (walking/cycling)
          WeatherCard.vue          # Draggable weather widget
          PanoramaViewer.vue       # Street panorama viewer
          GreenwayFlyover.vue      # 3D flyover tour (SceneView + satellite)
          AIChatbot.vue             # AI floating window (map pages only)
          NearbyFacilities.vue     # POI nearby-facilities block (detail pages)
          DetailPoiPopup.vue       # POI detail popup + tooltip
          DetailPoiLayerControl.vue # Per-type POI visibility toggle panel
          PoiSearchBar.vue         # Global POI keyword search with autocomplete
          FavoriteButton.vue       # Greenway favorite button (heart toggle)
          MapLegend.vue            # Official GeoScene legend widget (Expand fold)
          SpatialAnalysisPanel.vue # Spatial analysis result list panel
       services/
          gaodeApi.js              # Amap API proxy calls (directions/search)
          osrmApi.js               # Dijkstra routing API client (walking/cycling)
          heatmapApi.js            # Heatmap analytics API client
          favoritesApi.js          # Favorites + personal stats API client
          spatialApi.js            # Spatial analysis API client
       stores/
          route.js                 # Route planning reactive state
          favorites.js             # Favorite state (ids + toggle + logout reset)
       utils/
          coordinateTransform.js   # WGS84 ↔ GCJ02 conversion
          sessionRef.js            # sessionStorage-backed reactive ref
          poiPopupTemplate.js      # Unified GeoScene popup builder (point/cluster/jump)
       composables/
          useDetailPoi.js          # Detail-page POI layer + popup logic
       stores/
          adminAuth.js             # Pinia store (JWT, localStorage)
          userAuth.js              # Public user auth
       router/index.js              # Routes + navigation guards

    mobile/                         # Capacitor mobile app (Vue 3)
       views/
          MapView.vue              # Map page (greenways + POI facilities + AI assistant entry + locate/highlight + bottom sheet)
          DiscoverView.vue         # Discover/home page (photo banner carousel + community feed)
          ListView.vue             # Greenway list with search & filter (real photo cards)
          DetailView.vue           # Greenway detail (single-route API, favorite persisted, comments, weather card)
          PoiSearchView.vue        # POI facility search page
          ProfileView.vue / SettingsView.vue / FavoritesView.vue  # Personal center
       components/
          MobileBottomNav.vue      # Floating glass bottom navigation bar
          BottomSheet.vue          # Half-screen bottom sheet drawer (peek/expanded + drag)
          TrailCard.vue            # Greenway card with real-photo thumbnail + fallback
          AIChatPanel.vue          # AI greenway assistant (fullscreen chat panel)
          WeatherBlock.vue         # Real-time weather card (embedded in detail page)
       composables/
          useToast.js              # Global toast + confirm dialog (mobile UX)
          useAppTheme.js           # Theme store (shares desktop preference)
       constants/poi.js            # POI facility type config
       services/api.js             # Mobile API client (greenways/POI/AI/weather/favorites/auth, configurable backend URL)
       styles/design-system.css    # Mobile design system (dual theme)

    scripts/
       sync-android.sh             # Capacitor sync + custom plugin re-registration

    public/数据/                     # GeoJSON geometry files
    public/images/greenways/        # Greenway cover images (17 entries)

 示例图片/                   # Project screenshots used in this README
 README.md                   # English documentation (this file)
 README_zh-CN.md             # Chinese documentation
 启动完整系统.bat            # One-command startup script (Windows)
```

---

##  Route Overview

| Path | Component | Description |
|------|-----------|-------------|
| `/` | LandingPage | Fullpage hero landing |
| `/map` | GreenwayOverview | Main interactive map |
| `/wenyu` | WenyuDetail | 温榆河绿道 |
| `/huanerhuan` | HuanerhuanDetail | 环二环城市绿道 |
| `/liangmahe` | LiangmaheDetail | 亮马河绿道 |
| `/changying` | ChangyingDetail | 常营半马绿道 |
| `/changping42` | Changping42Detail | 昌平42绿道 |
| `/lidu` | LiduDetail | 丽都商圈绿道 |
| `/beiyunhe` | BeiyunheDetail | 北运河绿道 |
| `/nansha` | NanshaDetail | 南沙绿道 |
| `/aosen` | AosenDetail | 奥林匹克森林公园绿道 |
| `/yingcheng` | YingchengDetail | 营城建都绿道 |
| `/sanshan` | SanshanDetail | 三山五园绿道 |
| `/chaoyang` | ChaoyangDetail | 朝阳绿道 |
| `/beiyi` | BeiyiDetail | 北翼山水绿道 |
| `/dongyi` | DongyiDetail | 东翼大河绿道 |
| `/jiaoye` | JiaoyeDetail | 郊野休闲环绿道 |
| `/xiyi` | XiyiDetail | 西翼山水绿道 |
| `/zhongxincheng` | ZhongxinchengDetail | 中心城滨水绿道 |
| `/login` | UserLogin | User login |
| `/register` | UserRegister | User registration |
| `/favorites` | FavoritesPage | My favorites (desktop favorites list page) |
| `/admin/login` | AdminLogin | Admin login |
| `/admin/dashboard` | AdminDashboard | Admin overview *(auth required)* |
| `/admin/users` | AdminUsers | User management *(auth required)* |
| `/admin/logs` | AdminLogs | System logs *(auth required)* |
| `/admin/ai-stats` | AiChatStats | AI chat analytics *(auth required)* |
| `/admin/comments` | AdminComments | Comment management *(auth required)* |
| `/admin/heatmap` | HeatAdmin | Heatmap analytics *(auth required)* |
| `/admin/route-stats` | RouteStats | Route planning stats *(auth required)* |
| `/mobile/*` | MobileLayout | Mobile app (Capacitor) |

---

##  17 Greenways

| # | Name | Length | Key Feature |
|----|------|--------|-------------|
| 1 | 温榆河绿道 (Wenyu River) | 108 km | Waterfront ecological corridor |
| 2 | 环二环城市绿道 (Ring Road 2) | 87 km | Urban ring greenway loop |
| 3 | 亮马河绿道 (Liangma River) | 5.5 km | Business district waterway |
| 4 | 常营半马绿道 (Changying) | 21 km | Half-marathon track |
| 5 | 昌平42绿道 (Changping 42) | 42 km | Marathon-length mountain route |
| 6 | 丽都商圈绿道 (Lido) | 6.8 km | Commercial district loop |
| 7 | 北运河绿道 (Bei Yunhe) | 36 km | Canal-side greenway |
| 8 | 南沙绿道 (Nansha) | 15 km | Southern ecological belt |
| 9 | 奥林匹克森林公园绿道 (Olympic Forest) | 23 km | Olympic park perimeter |
| 10 | 营城建都绿道 (Yingcheng) | 42 km | Historical heritage route |
| 11 | 三山五园绿道 (Sanshan) |  | Imperial gardens & landscape |
| 12 | 朝阳绿道 (Chaoyang) |  | North Chaoyang district loop |
| 13 | 北翼山水绿道 (Beiyi) | 174 km | Northern mountain landscape |
| 14 | 东翼大河绿道 (Dongyi) | 328 km | Eastern river corridor |
| 15 | 郊野休闲环绿道 (Jiaoye) | 109 km | Suburban leisure loop |
| 16 | 西翼山水绿道 (Xiyi) | 160 km | Western mountain landscape |
| 17 | 中心城滨水绿道 (Zhongxincheng) | 125 km | Central city waterfront |

---

##  API Endpoints

```http
GET /api/greenways              # all greenways (summary list)
GET /api/greenways/:id          # single greenway detail by ID (incl. facilities/color/image)
GET /api/greenways?name=温榆河  # filter by name → GeoJSON FeatureCollection
POST /api/ai/chat               # AI conversation (DeepSeek-V4-Flash)
DELETE /api/ai/context/:id      # clear conversation history
POST /api/comments              # create a comment (sensitive-word check + optional rating)
GET /api/comments               # query comments by greenway
GET /api/comments/recent        # latest cross-greenway top-level comments (Discover feed)
GET /api/gaode/search            # Amap POI search (proxy)
GET /api/gaode/walking           # Amap walking directions (proxy)
GET /api/gaode/bicycling         # Amap cycling directions (proxy)
POST /api/osrm/route             # vertex-level Dijkstra routing (walking/cycling, OSM road network, street-name steps)
GET /api/greenways/:id/flyover?maxPoints=45    # 3D flyover waypoints (PostGIS-simplified, exactly 45 equidistant points)
GET /api/greenways/name/:name/flyover?maxPoints=45  # flyover waypoints by greenway name
GET /api/greenways/:id/nearby-facilities?radius=1000  # POI facilities within radius (grouped by type)
GET /api/greenways/name/:name/nearby-facilities       # POI facilities by greenway name
GET /api/greenways/name/:name/nearby-facilities/geojson  # POI GeoJSON by greenway name
GET /api/greenways/:id/nearby-facilities/geojson       # POI facilities as GeoJSON FeatureCollection
GET /api/facilities/geojson                           # all POI facilities GeoJSON (map overlay layer)
GET /api/poi/search?q=keyword                         # keyword search across POI names & addresses
GET /api/poi-types                                    # POI category definitions (code, name, icon, color)
POST /api/spatial/analyze                            # spatial analysis: draw polygon, query greenways/facilities in area (ST_Intersects)
GET  /api/spatial/points?limit=600                  # sampled deep-learning nodes by function type (scatter layer)
GET  /api/spatial/grid?size=0.02                    # hexagon-grid zoning GeoJSON (pre-aggregated, boot-warmed cache)
GET  /api/greenways/name/:name/function-profile     # greenway functional profile (eco/scenic/historical/urban shares, 1km buffer)
POST /api/greenways/recommend                        # smart recommendation: preferences → scored ranking (short-board match + heat + facilities)
GET  /api/greenways/name/:name/nearest-entry?lng=&lat=  # nearest point on the greenway line to a given origin (ST_ClosestPoint)
POST /api/accessibility/reach                            # reachability: Dijkstra distance field → 5-level isochrone hulls + reachable greenways
GET  /api/favorites/ids                              # current user's favorited greenway IDs (button state)
GET  /api/favorites                                  # favorites list (JOIN greenway display fields)
POST /api/favorites                                  # add favorite { greenway_id | greenway_name }
DELETE /api/favorites/:greenwayId                    # remove favorite
GET  /api/user/stats                                 # personal-center stats (favorites/rides/total distance/comments)
GET /api/tiles/gaode/:style/:level/:col/:row  # Amap tile proxy (style 6 = satellite, style 7 = vector)
POST /api/heatmap/click          # record greenway click (heatmap tracking)
GET /api/heatmap/data            # heatmap points with centroids & weighted index
GET /api/heatmap/points          # dense-sampled heatmap points along greenway lines

# Admin routes (Bearer JWT required)
GET /api/admin/stats               # platform overview counts (users/greenways/active)
GET /api/admin/dashboard/stats     # mobile admin home stats (users/comments/pending/today)
GET /api/admin/ai-stats?days=7  # word cloud + daily trend (7/14/30d)
GET /api/admin/ai-stats/recent  # recent raw messages
GET /api/admin/comments         # comment list with filters/pagination
PATCH /api/admin/comments/:id/status      # update single comment status
PATCH /api/admin/comments/batch/status    # batch status updates
GET /api/admin/heatmap/overview          # heatmap summary stats (clicks, routes, comments)
GET /api/admin/heatmap/trend?days=30     # daily heat trend (click/route/comment breakdown)
GET /api/admin/heatmap/rank?limit=20     # greenway heat ranking
GET /api/admin/heatmap/compare           # click vs route vs comment comparison
GET /api/admin/heatmap/comment-stats     # comment overview (total/today/avg rating/top)
GET /api/admin/heatmap/comment-rank      # greenway comment count ranking
GET /api/admin/heatmap/comment-trend     # daily comment trend
```

```bash
curl "http://localhost:3001/api/greenways?name=南沙"
```

---

##  Database Schema

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

```sql
-- AI chat logs (source for admin analytics dashboard)
CREATE TABLE chat_logs (
  id              SERIAL PRIMARY KEY,
  conversation_id TEXT,
  message         TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- **Geometry:** `MultiLineString` preserves independent segments
- **CRS:** SRID 4326 (WGS 84)
- **Spatial API:** PostGIS `ST_AsGeoJSON()` for GeoJSON serialization

```sql
-- Heatmap tracking tables
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

-- User favorites table
CREATE TABLE user_favorites (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  greenway_id  INTEGER NOT NULL REFERENCES greenways(id) ON DELETE CASCADE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, greenway_id)
);
```

---

##  Environment Configuration

**Backend (`greenway-backend/.env.local`)**
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

**Frontend (`greenway-vue/.env.local`)**
```env
VITE_AMAP_KEY=your_amap_key
VITE_BAIDU_MAP_KEY=your_baidu_key
VITE_API_BASE=http://localhost:3001
```

---

##  Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#060d14` | Global dark base |
| Primary green | `#2E7D32` / `#4CAF50` | Buttons, accents |
| Highlight | `#69F0AE` | Active / hover states |
| Muted green | `#A5D6A7` | Secondary text |
| Boundary blue | `#1565C0` | Map district outline layer |

---

##  Security

- Admin JWT stored in **localStorage** (persists across tabs and page refreshes; cleared only on explicit logout or 401)
- Vue Router navigation guards enforce `requiresAdmin` meta flag
- 401 responses auto-clear session and redirect to admin login
- Parameterized DB queries prevent SQL injection
- CORS configured for local development only

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Vue 3.4 + Vite 5 + Pinia |
| Map engine | GeoScene JS SDK 4.33 (2D MapView + 3D SceneView) + Amap tiles |
| 3D flyover | GeoScene SceneView + WebTileLayer (satellite) + Camera flyTo animation + PostGIS ST_SimplifyPreserveTopology |
| POI facilities | Amap POI API → PostGIS ST_DWithin → GeoJSON → GeoScene GeoJSONLayer + PictureMarkerSymbol |
| Charts / Word cloud | ECharts 6 + echarts-wordcloud + vue-echarts |
| AI model | DeepSeek-V4-Flash (REST API) |
| Chinese NLP | segment (pure-JS tokenizer) |
| Backend | Node.js 18+ + Express 4.18 |
| Database | PostgreSQL 14+ + PostGIS 3.3+ |
| Mobile | Capacitor 5 |
| Data format | GeoJSON + MultiLineString (SRID 4326) |

---

##  Competition & Intellectual Property

Developed for a technical competition; software copyright registration (软著申请) in progress.

-  Free for educational and research use
-  Commercial use or derivative works require author permission
-  Software copyright protection pending

##  License

MIT  see LICENSE for details.

---

**Built with ❤ for Beijing's urban green spaces**
