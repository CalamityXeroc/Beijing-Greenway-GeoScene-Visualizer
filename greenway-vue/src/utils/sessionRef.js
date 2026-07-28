/**
 * sessionStorage 持久化 ref — 导航间保持状态，关闭标签页后重置
 * 用法同 ref()，但值会写入 sessionStorage，组件重挂载时自动恢复
 */
import { ref, watch } from 'vue'

export function sessionRef(key, defaultValue) {
  let stored
  try {
    const raw = sessionStorage.getItem(key)
    stored = raw !== null ? JSON.parse(raw) : undefined
  } catch { /* ignore */ }

  const r = ref(stored !== undefined ? stored : defaultValue)

  watch(r, (val) => {
    try { sessionStorage.setItem(key, JSON.stringify(val)) } catch { /* quota exceeded */ }
  }, { deep: true })

  return r
}
