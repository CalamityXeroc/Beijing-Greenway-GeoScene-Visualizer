// 内存缓存：绿道/POI 等静态数据避免每次都打远程慢库（远程 DB 响应 4-7s）
const store = new Map()
const inflight = new Map()

// 加载失败时旧值的保留宽限期：期间直接返回旧值，避免数据库抖动导致整页不可用
const STALE_GRACE_MS = 30_000

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
    // 加载失败且有旧值：把旧值的宽限期往后顺延并直接返回（此前的实现只是原样写回已过期的 expires，
    // 导致下一次请求仍然判定为过期、旧值实际上从未被服务过）
    if (hit) {
      store.set(key, { value: hit.value, expires: Date.now() + STALE_GRACE_MS })
      return hit.value
    }
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
