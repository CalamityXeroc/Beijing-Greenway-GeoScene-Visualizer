export async function analyzeSpatial(polygon) {
  const res = await fetch('/api/spatial/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon })
  })
  const data = await res.json().catch(() => ({}))
  if (data.code !== 0) throw new Error(data.message || '空间分析失败')
  return data.data
}
