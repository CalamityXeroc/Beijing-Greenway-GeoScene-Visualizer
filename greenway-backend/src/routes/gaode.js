import express from 'express'
const router = express.Router()

function getKey() {
  return process.env.GAODE_KEY
}

async function proxyGaodeApi(req, res, gaodePath, queryParams) {
  const url = new URL(gaodePath, 'https://restapi.amap.com')
  url.searchParams.set('key', getKey())
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v)
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Referer': 'https://www.amap.com/',
        'User-Agent': 'Mozilla/5.0'
      }
    })
    const data = await response.json()
    res.set('Access-Control-Allow-Origin', '*')
    res.json(data)
  } catch (e) {
    console.error('[高德API代理] 错误:', e.message)
    res.status(502).json({ status: '0', info: '代理请求失败' })
  }
}

router.get('/walking', (req, res) => {
  const { origin, destination, waypoints } = req.query
  proxyGaodeApi(req, res, '/v3/direction/walking', { origin, destination, waypoints })
})

router.get('/bicycling', (req, res) => {
  const { origin, destination, waypoints } = req.query
  proxyGaodeApi(req, res, '/v4/direction/bicycling', { origin, destination, waypoints })
})

router.get('/search', (req, res) => {
  const { keywords, city = '北京' } = req.query
  proxyGaodeApi(req, res, '/v3/place/text', {
    keywords,
    city,
    citylimit: 'true',
    types: '150500|120000|130000|140000|160000|170000|190000'
  })
})

router.get('/regeocode', (req, res) => {
  const { location } = req.query
  proxyGaodeApi(req, res, '/v3/geocode/regeo', { location })
})

// 实时天气（经后端代理，避免前端暴露高德 key）
router.get('/weather', (req, res) => {
  const { city, extensions = 'base' } = req.query
  if (!city) return res.status(400).json({ status: '0', info: '缺少 city 参数' })
  proxyGaodeApi(req, res, '/v3/weather/weatherInfo', { city, extensions })
})

export default router
