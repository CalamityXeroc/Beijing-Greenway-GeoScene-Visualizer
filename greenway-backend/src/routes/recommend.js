/**
 * 绿道智能推荐 - API
 * POST /api/greenways/recommend
 * body: { mode: 'walking'|'bicycling', interests: ['eco','scenic','history','urban']|'balanced', needs: ['metro','parking','restroom'], topN: 3 }
 * 评分: 0.55×功能匹配 + 0.15×热度 + 0.20×设施完善度 + 0.10×长度适配（都行模式: 0/0.45/0.35/0.20）
 *      各因子用排名百分位归一化，最终线性映射到 [65, 98] 作为推荐度展示（排序由原始加权分决定）
 */
import express from 'express'
const router = express.Router()

const INTEREST_MAP = {
  eco: '生态绿道',
  scenic: '风景绿道',
  history: '历史文化绿道',
  urban: '城市绿道'
}
const NEED_POI_TYPES = {
  metro: { type: '150500', label: '地铁', key: 'metro' },
  parking: { type: '150900', label: '停车场', key: 'parking' },
  restroom: { type: '200300', label: '卫生间', key: 'restroom' }
}

router.post('/recommend', async (req, res) => {  try {
    const body = req.body || {}
    const mode = body.mode === 'bicycling' ? 'bicycling' : 'walking'
    const interests = Array.isArray(body.interests) ? body.interests : []
    const needs = Array.isArray(body.needs) ? body.needs : []
    const topN = Math.min(Math.max(parseInt(body.topN) || 3, 1), 8)

    // 1. 功能画像（预聚合表）
    const profileRes = await req.pool.query(`
      SELECT greenway_name, eco, scenic, history, urban, total
      FROM greenway_function_profile WHERE total > 0
    `)
    // 2. 热度
    const heatRes = await req.pool.query(
      'SELECT greenway_name, heat_index FROM greenway_heatmap'
    )
    // 3. 设施统计（预聚合表 greenway_facility_stats，1km 口径与详情页 nearby-facilities 一致，毫秒级）
    const facRes = await req.pool.query(
      'SELECT greenway_name, cnt, metro, parking, restroom FROM greenway_facility_stats'
    )
    // 4. 长度 + 入口坐标（长度优先用 greenways.length 官方设计长度，为空时回退几何实测）
    // 注：几何实测长度受矢量化影响偏大（如三山五园官方 36.09km、几何 79.7km），不可直接使用
    const geoRes = await req.pool.query(`
      SELECT name, COALESCE(NULLIF(length, 0), ST_Length(geometry::geography) / 1000) AS len_km,
             ST_X(ST_StartPoint(ST_LineMerge(geometry))) AS lng,
             ST_Y(ST_StartPoint(ST_LineMerge(geometry))) AS lat
      FROM greenways WHERE geometry IS NOT NULL
    `)

    const heatMap = Object.fromEntries(heatRes.rows.map(r => [r.greenway_name, r.heat_index || 0]))
    const facMap = Object.fromEntries(facRes.rows.map(r => [r.greenway_name, r]))
    const geoMap = Object.fromEntries(geoRes.rows.map(r => [r.name, r]))
    // 排名百分位归一化：避免单个极值（如中心城滨水 heat=10.8 / fac=374）把其余绿道压到接近 0 分
    const totalCount = profileRes.rows.length
    const pctOf = (i) => (totalCount > 1 ? 1 - i / (totalCount - 1) : 0.5)
    const heatPctMap = {}
    Object.entries(heatMap).sort((a, b) => b[1] - a[1]).forEach(([name], i) => { heatPctMap[name] = pctOf(i) })
    const facPctMap = {}
    facRes.rows.slice()
      .sort((a, b) => (parseInt(b.cnt) || 0) - (parseInt(a.cnt) || 0))
      .forEach((r, i) => { facPctMap[r.greenway_name] = pctOf(i) })

    // 兴趣权重（'都行' = 均分）
    const balanced = interests.length === 0 || interests.includes('balanced')
    const weights = { eco: 0, scenic: 0, history: 0, urban: 0 }
    if (balanced) {
      weights.eco = weights.scenic = weights.history = weights.urban = 1
    } else {
      interests.forEach(i => { if (INTEREST_MAP[i]) weights[i] = 1 })
    }

    // 生成模板理由（DOMINANT_TEXT 键与 profile 键一致：eco/scenic/history/urban）
    const DOMINANT_TEXT = {
      eco: ['生态功能占比最高，最适合亲近自然', '自然生态气息浓郁，适合放松身心'],
      scenic: ['风景功能占比最高，沿途风光好', '湖光山色相伴，适合拍照打卡'],
      history: ['历史文化底蕴深厚，适合访古游览', '人文古迹丰富，一边游玩一边了解北京'],
      urban: ['城市配套完善，出行便利', '身处都市绿洲，休闲与便利兼得']
    }
    const dominantOf = (profile) => {
      const best = Object.entries(profile).sort((a, b) => b[1] - a[1])[0]
      return best && best[1] > 0.3 ? best[0] : null
    }

    // 权重自适应：兴趣明确（含多选）时功能匹配主导；'都行'时热度+设施主导
    let W = { match: 0.40, heat: 0.28, fac: 0.22, len: 0.10 }
    if (balanced) W = { match: 0, heat: 0.45, fac: 0.35, len: 0.20 }
    else W = { match: 0.55, heat: 0.15, fac: 0.20, len: 0.10 }

    const items = profileRes.rows.map(p => {
      const total = p.total
      const profile = {
        eco: p.eco / total, scenic: p.scenic / total,
        history: p.history / total, urban: p.urban / total
      }
      // 功能匹配度：短板效应（用户选的所有类型都要满足，缺失则重罚）
      let match = 1
      let minP = 1
      if (!balanced) {
        const sel = []
        for (const [k, w] of Object.entries(weights)) {
          if (w) sel.push(profile[k])
        }
        if (sel.length) {
          minP = Math.min(...sel)
          // 以「所选类型占比之和」为主（用户想要的类型覆盖了多少），「最小占比」为辅（避免某项完全缺失）
          const selSum = sel.reduce((s, v) => s + v, 0)
          match = 0.6 * Math.min(1, selSum) + 0.4 * minP
        }
      }

      // 热度（排名百分位：第 1 名 = 1.0，末位 = 0.0）
      const heat = heatMap[p.greenway_name] || 0
      const heatScore = heatPctMap[p.greenway_name] ?? 0

      // 设施完善度
      const fac = facMap[p.greenway_name] || { cnt: 0, metro: 0, parking: 0, restroom: 0 }
      const facBase = facPctMap[p.greenway_name] ?? 0
      let needOk = 1
      if (needs.length > 0) {
        let satisfied = 0
        needs.forEach(n => {
          const cfg = NEED_POI_TYPES[n]
          if (cfg && (parseInt(fac[cfg.key]) || 0) > 0) satisfied++
        })
        needOk = satisfied / needs.length
      }
      const facScore = facBase * 0.6 + needOk * 0.4

      // 长度适配：绿道可分段游览，长绿道不是缺点（只在过短时扣分）
      const len = geoMap[p.greenway_name]?.len_km || 10
      const minGoodLen = mode === 'bicycling' ? 8 : 2
      const lenScore = len >= minGoodLen ? 1 : len / minGoodLen

      const rawScore = 100 * (W.match * match + W.heat * heatScore + W.fac * facScore + W.len * lenScore)
      return { name: p.greenway_name, rawScore, score: 0, match, minP, profile, heat, len, geo: geoMap[p.greenway_name] || null }
    })

    // 匹配度硬门槛：明确兴趣时，所选类型占比 < 15% 的绿道直接剔除
    const MIN_MATCH = 0.15
    const eligible = balanced ? items : items.filter(it => it.minP >= MIN_MATCH)

    // 分数区间映射：把候选集内的原始加权分线性映射到 [65, 98]（推荐度语义，排序不变）。
    // 原始加权分受各因子归一化影响绝对值偏低（20~50），直接展示会让用户误以为推荐质量差。
    const SCORE_MIN = 65, SCORE_MAX = 98
    const rawList = eligible.map(it => it.rawScore)
    const rawMax = rawList.length ? Math.max(...rawList) : 0
    const rawMin = rawList.length ? Math.min(...rawList) : 0
    eligible.forEach(it => {
      it.score = rawMax > rawMin
        ? Math.round(SCORE_MIN + (SCORE_MAX - SCORE_MIN) * (it.rawScore - rawMin) / (rawMax - rawMin))
        : Math.round((SCORE_MIN + SCORE_MAX) / 2)
    })

    // 排序
    const ranked = eligible.sort((a, b) => b.score - a.score)
    // 真实热度排名（按 heat_index 降序）
    const heatRankMap = {}
    Object.entries(heatMap).sort((a, b) => b[1] - a[1]).forEach(([name], i) => { heatRankMap[name] = i + 1 })

    const result = ranked.slice(0, topN).map(it => {
      const reasons = []
      const domKey = dominantOf(it.profile)
      if (domKey && DOMINANT_TEXT[domKey]) {
        reasons.push({ type: 'function', text: DOMINANT_TEXT[domKey][0] + `（占比 ${Math.round(it.profile[domKey] * 100)}%）` })
      } else {
        reasons.push({ type: 'function', text: '功能类型均衡，各种玩法都能满足' })
      }
      // 无热度记录或热度为 0 时视为「暂无排名」，避免展示一个无意义的末位名次
      const heatRank = it.heat > 0 ? heatRankMap[it.name] ?? null : null
      reasons.push({
        type: 'heat',
        text: heatRank ? `人气热度排名第 ${heatRank} 位` : '暂无热度排名（近期关注度较低）'
      })
      const fac = facMap[it.name] || {}
      const haveNeeds = Object.values(NEED_POI_TYPES).filter(cfg => (parseInt(fac[cfg.key]) || 0) > 0)
      const facText = `周边 ${fac.cnt || 0} 处设施` + (haveNeeds.length ? `（${haveNeeds.map(c => c.label).join('、')}）` : '')
      reasons.push({ type: 'facility', text: facText })
      reasons.push({ type: 'match', text: `综合评分 ${it.score} 分（满分 100）` })
      return {
        name: it.name,
        score: it.score,
        matchRate: it.score,
        lenKm: Math.round(it.len * 10) / 10,
        heatRank: heatRank ?? null,
        profile: { eco: Math.round(it.profile.eco * 100), scenic: Math.round(it.profile.scenic * 100), history: Math.round(it.profile.history * 100), urban: Math.round(it.profile.urban * 100) },
        reasons,
        lng: it.geo?.lng,
        lat: it.geo?.lat
      }
    })

    res.json({ items: result, mode, interests: balanced ? ['balanced'] : interests, needs })
  } catch (err) {
    console.error('[绿道推荐] 错误:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// 绿道最近入口点：基于起点坐标，计算绿道线上离起点最近的点（导航到绿道入口用）
router.get('/name/:name/nearest-entry', async (req, res) => {
  try {
    const { name } = req.params
    const lng = parseFloat(req.query.lng)
    const lat = parseFloat(req.query.lat)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return res.status(400).json({ error: '缺少起点坐标' })
    }

    const result = await req.pool.query(`
      WITH merged AS (
        SELECT ST_LineMerge(geometry) AS geom FROM greenways WHERE name = $1
      ),
      dumped AS (
        SELECT (ST_Dump(geom)).geom AS geom FROM merged
      ),
      pts AS (
        SELECT ST_ClosestPoint(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)) AS cp
        FROM dumped
      )
      SELECT ST_X(cp) AS lng, ST_Y(cp) AS lat,
             ROUND(ST_Distance(cp::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)) AS dist_m
      FROM pts
      ORDER BY dist_m
      LIMIT 1
    `, [name, lng, lat])

    if (!result.rows.length) return res.status(404).json({ error: '绿道不存在' })
    const r = result.rows[0]
    const distM = parseInt(r.dist_m) || 0
    const distText = distM > 1000 ? `距起点 ${(distM / 1000).toFixed(1)}km` : `距起点 ${distM}m`
    res.json({
      greenwayName: name,
      lng: parseFloat(r.lng),
      lat: parseFloat(r.lat),
      distM,
      address: `${name}（最近入口，${distText}）`
    })
  } catch (err) {
    console.error('[最近入口] 错误:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
