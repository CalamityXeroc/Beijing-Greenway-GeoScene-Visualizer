/**
 * 绿道体检评估 - API
 * GET /api/greenways/assess
 * 面向市民的"绿道体检"：从 5 个维度（生态自然/出行便捷/设施完备/人气活力/休闲适宜）
 * 对全部 17 条绿道综合打分，透明可解释，并输出亮点/短板话术。
 *
 * 维度评分口径与智能推荐引擎（recommend.js）保持一致：
 * - 设施：points_of_interest 1km ST_DWithin 统计（地铁 150500 / 停车 150900 / 卫生间 200300）
 * - 热度：greenway_heatmap.heat_index 归一化
 * - 长度适配：骑行偏好 ~20km / 步行偏好 ~8km
 */
import express from 'express'
const router = express.Router()

// 画像主导类别文案（键与 profile 一致）
const DOMINANT_TEXT = {
  eco: '生态功能占比最高，自然气息浓郁，最适合亲近自然',
  scenic: '风景功能占比最高，沿途风光好，适合拍照打卡',
  history: '历史文化底蕴深厚，适合访古游览',
  urban: '城市配套完善，身处都市绿洲，休闲与便利兼得'
}
const DOMINANT_CN = { eco: '生态型', scenic: '风景型', history: '历史文化型', urban: '城市型' }

// 总分权重：综合体检面向所有市民，维度均衡（生态/便捷/设施/热度/休闲）
const W = { eco: 0.25, transport: 0.20, facility: 0.20, heat: 0.15, leisure: 0.20 }

// 等级划分（市民话术）——阈值放宽：多数绿道应落在"良/中"，让市民感知绿道整体品质不错
const gradeOf = (score) => (score >= 82 ? '优' : score >= 70 ? '良' : score >= 55 ? '中' : '待提升')

router.get('/assess', async (req, res) => {
  try {
    // 1. 功能画像（预聚合表）
    const profileRes = await req.pool.query(`
      SELECT greenway_name, eco, scenic, history, urban, total
      FROM greenway_function_profile WHERE total > 0
    `)
    // 2. 热度
    const heatRes = await req.pool.query(
      'SELECT greenway_name, heat_index FROM greenway_heatmap'
    )
    // 3. 设施统计（预聚合表 greenway_facility_stats，1km 口径与推荐引擎一致，毫秒级）
    const facRes = await req.pool.query(
      'SELECT greenway_name, cnt, metro, parking, restroom FROM greenway_facility_stats'
    )
    // 4. 长度（用字段 length 与详情页/首页口径一致）+ 入口坐标
    const geoRes = await req.pool.query(`
      SELECT name, COALESCE(length, ST_Length(geometry::geography) / 1000) AS len_km,
             ST_X(ST_StartPoint(ST_LineMerge(geometry))) AS lng,
             ST_Y(ST_StartPoint(ST_LineMerge(geometry))) AS lat
      FROM greenways WHERE geometry IS NOT NULL
    `)

    const heatMap = Object.fromEntries(heatRes.rows.map(r => [r.greenway_name, r.heat_index || 0]))
    const facMap = Object.fromEntries(facRes.rows.map(r => [r.greenway_name, r]))
    const geoMap = Object.fromEntries(geoRes.rows.map(r => [r.name, r]))
    // 热度真实排名 + 排名归一化（第一名 100 分，最后一名保底，分布平缓不极端）
    const heatRankList = Object.entries(heatMap).sort((a, b) => b[1] - a[1])
    const heatRankIdx = {}
    heatRankList.forEach(([n], i) => { heatRankIdx[n] = i })
    const heatLastIdx = Math.max(1, heatRankList.length - 1)
    const maxFac = Math.max(...Object.values(facMap).map(f => parseInt(f.cnt) || 0), 1)

    const items = profileRes.rows.map(p => {
      const total = p.total
      const profile = {
        eco: p.eco / total, scenic: p.scenic / total,
        history: p.history / total, urban: p.urban / total
      }
      const geo = geoMap[p.greenway_name] || { len_km: 10, lng: null, lat: null }
      const heat = heatMap[p.greenway_name] || 0
      const fac = facMap[p.greenway_name] || { cnt: 0, metro: 0, parking: 0, restroom: 0 }
      const len = geo.len_km || 10

      // ── 维度 1：生态自然度（生态 + 风景×0.6 的占比，反映"绿色质量"）──
      // 公式放宽（×2.0）：让城市绿道也能拿到中等偏上的生态分，避免"城市型=低分"的观感
      const ecoRaw = profile.eco + profile.scenic * 0.6
      const dimEco = Math.round(Math.min(1, ecoRaw * 2.0) * 100)

      // ── 维度 2：出行便捷度（地铁覆盖为主，设施密度为辅）──
      const metro = parseInt(fac.metro) || 0
      const metroScore = Math.min(1, metro / 3)
      const densScore = Math.min(1, (parseInt(fac.cnt) || 0) / (maxFac * 0.6))
      const dimTransport = Math.round((metroScore * 0.7 + densScore * 0.3) * 100)

      // ── 维度 3：设施完备度（总量 + 三类关键设施达标）──
      const facBase = Math.min(1, (parseInt(fac.cnt) || 0) / maxFac)
      const needKinds = ['metro', 'parking', 'restroom']
      const haveKinds = needKinds.filter(k => (parseInt(fac[k]) || 0) > 0).length
      const needOk = haveKinds / needKinds.length
      const dimFacility = Math.round((facBase * 0.55 + needOk * 0.45) * 100)

      // ── 维度 4：人气活力值（按热度排名归一化；无热度数据的绿道按最后一名）──
      const dimHeat = Math.round((1 - (heatRankIdx[p.greenway_name] ?? heatLastIdx) / heatLastIdx) * 100)

      // ── 维度 5：休闲适宜度（长度适中 + 功能均衡）──
      const ideal = 12  // 综合体检：12km 左右的绿道最适宜多数市民
      const lenFit = Math.max(0, 1 - Math.abs(len - ideal) / 40)
      // 功能均衡度：最大占比与 0.5 的差距越小越均衡（过度单一也减分）
      const maxShare = Math.max(...Object.values(profile))
      const balance = Math.max(0, 1 - Math.abs(maxShare - 0.45) * 1.2)
      const dimLeisure = Math.round((lenFit * 0.6 + balance * 0.4) * 100)

      const dims = { eco: dimEco, transport: dimTransport, facility: dimFacility, heat: dimHeat, leisure: dimLeisure }
      const raw = (
        W.eco * dimEco + W.transport * dimTransport + W.facility * dimFacility +
        W.heat * dimHeat + W.leisure * dimLeisure
      )
      // 总分放宽：基础分 36 + 0.65×加权分（满分 100 的"市民友好"映射），
      // 让绿道整体落在 55~85 区间，避免"全市没几条好绿道"的消极观感
      const score = Math.round(36 + 0.65 * raw)

      return { name: p.greenway_name, score, grade: gradeOf(score), dims, profile, heat, len, geo, fac, metro }
    })

    // 全市平均（雷达图对比基准）
    const avgDims = {
      eco: Math.round(items.reduce((s, i) => s + i.dims.eco, 0) / items.length),
      transport: Math.round(items.reduce((s, i) => s + i.dims.transport, 0) / items.length),
      facility: Math.round(items.reduce((s, i) => s + i.dims.facility, 0) / items.length),
      heat: Math.round(items.reduce((s, i) => s + i.dims.heat, 0) / items.length),
      leisure: Math.round(items.reduce((s, i) => s + i.dims.leisure, 0) / items.length)
    }

    // 热度真实排名（无热度数据的绿道返回 null，前端显示"暂无"）
    const heatRankMap = {}
    heatRankList.forEach(([name], i) => { heatRankMap[name] = i + 1 })

    // 亮点 / 短板（相对全市平均）
    const dimName = { eco: '生态自然度', transport: '出行便捷度', facility: '设施完备度', heat: '人气活力值', leisure: '休闲适宜度' }
    const dimGood = { eco: '绿意盎然，空气清新，适合深呼吸放松', transport: '地铁/公交覆盖好，绿色出行很方便', facility: '周边设施齐全，吃饭歇脚都方便', heat: '人气旺，活动多，热闹有氛围', leisure: '长度适中，节奏舒适，遛弯骑行皆宜' }
    const dimWeak = { eco: '城市气息较重，自然生态占比偏低', transport: '公共交通偏少，建议骑行或自驾前往', facility: '周边设施较少，建议自带饮水干粮', heat: '人气偏低，比较清静，适合喜欢安静的人', leisure: '长度偏长/偏短，建议按体力分段体验' }

    const ranked = items.sort((a, b) => b.score - a.score)

    const result = ranked.map((it, idx) => {
      const highs = []
      const weaks = []
      for (const [k, v] of Object.entries(it.dims)) {
        if (v >= 80) highs.push({ key: k, text: dimGood[k] })
        else if (v <= avgDims[k] - 5) weaks.push({ key: k, text: dimWeak[k] })
      }
      // 画像主导类别亮点
      const best = Object.entries(it.profile).sort((a, b) => b[1] - a[1])[0]
      if (best && best[1] > 0.3 && highs.length < 3) {
        highs.push({ key: 'profile', text: `${DOMINANT_CN[best[0]]}：${DOMINANT_TEXT[best[0]]}` })
      }
      // 关键设施提示（补充亮点/短板）
      const fac = it.fac || {}
      const needKinds = [
        { key: 'metro', label: '地铁' }, { key: 'parking', label: '停车场' }, { key: 'restroom', label: '卫生间' }
      ]
      const have = needKinds.filter(n => (parseInt(fac[n.key]) || 0) > 0).map(n => n.label)
      if (have.length === 3 && !highs.some(h => h.key === 'facility')) {
        highs.push({ key: 'facility', text: `地铁、停车场、卫生间一应俱全，带娃遛弯也方便` })
      }
      if (have.length === 0 && weaks.length < 3) {
        weaks.push({ key: 'facility', text: '周边缺少地铁/停车场/卫生间等配套' })
      }

      return {
        name: it.name,
        score: it.score,
        grade: it.grade,
        rank: idx + 1,
        dims: it.dims,
        profile: { eco: Math.round(it.profile.eco * 100), scenic: Math.round(it.profile.scenic * 100), history: Math.round(it.profile.history * 100), urban: Math.round(it.profile.urban * 100) },
        lenKm: Math.round(it.len * 10) / 10,
        heatRank: heatRankMap[it.name],
        heat: Math.round(it.heat),
        metro: parseInt(it.metro) || 0,
        highlights: highs.slice(0, 3),
        weakPoints: weaks.slice(0, 3),
        lng: it.geo?.lng,
        lat: it.geo?.lat
      }
    })

    res.json({ items: result, avgDims, total: result.length })
  } catch (err) {
    console.error('[绿道评估] 错误:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
