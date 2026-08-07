// 内存缓存：绿道/POI 等静态数据避免每次都打远程慢库（远程 DB 响应 4-7s）
const store = new Map()
const inflight = new Map()

export function cached(key, ttlMs, loader) {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expires > now) return Promise.resolve(hit.value)
  // 单飞去重：同一 key 的并发请求共享同一个 loader，避免重复打慢库
  if (inflight.has(key)) return inflight.get(key)
  const p = Promise.resolve(loader()).then((value) => {
    store.set(key, { value, expires: Date.now() + ttlMs })
    return value
  }).catch((err) => {
    // 加载失败时若已有缓存则保留旧值，避免单次抖动拖垮整页
    if (hit) store.set(key, { value: hit.value, expires: hit.expires })
    throw err
  }).finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, p)
  return p
}

export function invalidate(prefix) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
