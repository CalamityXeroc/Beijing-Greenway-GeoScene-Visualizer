import { computed, ref } from 'vue'

const STORAGE_KEY = 'appTheme' // 'day' | 'night' | 'auto'；缺失/非法视为 auto

/**
 * 判断北京时间是否为白天 (06:00-18:00)
 */
export function isBeiJingDayTime(now = new Date()) {
  const beijingTime = new Date(now.getTime() + (8 - (-now.getTimezoneOffset() / 60)) * 3600000)
  const hour = beijingTime.getHours()
  return hour >= 6 && hour < 18
}

/**
 * 读取持久化主题偏好（统一 key：appTheme = day / night / auto）
 */
export function readPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'day' || v === 'night' || v === 'auto') return v
  } catch {}
  return 'auto'
}

function writePreference(mode) {
  try { localStorage.setItem(STORAGE_KEY, mode) } catch {}
}

/**
 * 迁移历史 key，统一收敛到 appTheme = day / night / auto：
 * - 移动端旧版用 greenway-theme（dark / light）
 * - 桌面端旧版用 appThemeLockTime（sessionStorage 12h 锁）
 * 手动选择按新语义永久保留，不再受锁过期影响
 */
export function migrateLegacyKeys() {
  try {
    const cur = localStorage.getItem(STORAGE_KEY)
    if (cur !== 'day' && cur !== 'night' && cur !== 'auto') {
      const legacyMobile = localStorage.getItem('greenway-theme')
      if (legacyMobile === 'dark' || legacyMobile === 'light') {
        localStorage.setItem(STORAGE_KEY, legacyMobile === 'dark' ? 'night' : 'day')
      }
    }
    localStorage.removeItem('greenway-theme')
    sessionStorage.removeItem('appThemeLockTime')
    sessionStorage.removeItem('appThemeLock')
  } catch {}
}

/**
 * 全局主题管理 composable
 * 控制整个应用的黑夜/白天模式：
 * - auto：按北京时间 (06:00-18:00=白天) 自动切换，每 5 分钟检查
 * - day / night：用户手动固定，持久保留，不再自动切换
 */
export function useTheme() {
  const theme = ref('day')    // 当前实际显示的主题
  const mode = ref('auto')    // 用户偏好：auto | day | night
  let autoThemeTimer = null
  let initialized = false

  const isAuto = computed(() => mode.value === 'auto')

  function applyMode(m) {
    const valid = m === 'night' ? 'night' : 'day'
    theme.value = valid
    document.documentElement.setAttribute('data-theme', valid)
    document.documentElement.classList.add(valid === 'night' ? 'theme-dark' : 'theme-light')
    document.documentElement.classList.remove(valid === 'night' ? 'theme-light' : 'theme-dark')
  }

  /**
   * 设置主题偏好。mode: 'day' | 'night' | 'auto'
   */
  function setTheme(nextMode) {
    const m = nextMode === 'day' || nextMode === 'night' || nextMode === 'auto' ? nextMode : 'auto'
    mode.value = m

    if (m === 'auto') {
      applyMode(isBeiJingDayTime() ? 'day' : 'night')
      writePreference('auto')
      startAutoSwitch()
    } else {
      applyMode(m)
      writePreference(m)
      stopAutoSwitch()
    }
    return theme.value
  }

  /**
   * 手动切换主题（当前实际主题取反，永久保留）
   */
  function toggleTheme() {
    const next = theme.value === 'day' ? 'night' : 'day'
    return setTheme(next)
  }

  /**
   * 重置为自动模式（跟随北京时间）
   */
  function resetToAutoMode() {
    return setTheme('auto')
  }

  /**
   * 启动自动主题切换（每 5 分钟检查一次）
   */
  function startAutoSwitch() {
    if (autoThemeTimer) {
      clearInterval(autoThemeTimer)
    }
    autoThemeTimer = setInterval(() => {
      if (mode.value !== 'auto') {
        stopAutoSwitch()
        return
      }
      const target = isBeiJingDayTime() ? 'day' : 'night'
      if (target !== theme.value) {
        applyMode(target)
      }
    }, 5 * 60 * 1000)
  }

  /**
   * 停止自动主题切换
   */
  function stopAutoSwitch() {
    if (autoThemeTimer) {
      clearInterval(autoThemeTimer)
      autoThemeTimer = null
    }
  }

  /**
   * 初始化主题（单例由 useGlobalTheme 调用一次）
   */
  function initTheme() {
    if (initialized) return
    initialized = true
    migrateLegacyKeys()
    const pref = readPreference()
    if (pref === 'auto') {
      mode.value = 'auto'
      applyMode(isBeiJingDayTime() ? 'day' : 'night')
      startAutoSwitch()
    } else {
      mode.value = pref
      applyMode(pref)
    }
  }

  return {
    theme,
    mode,
    isAuto,
    setTheme,
    toggleTheme,
    startAutoSwitch,
    stopAutoSwitch,
    resetToAutoMode,
    initTheme
  }
}

// 导出全局单例实例
let globalThemeInstance = null

export function useGlobalTheme() {
  if (!globalThemeInstance) {
    globalThemeInstance = useTheme()
    // 直接初始化，不依赖 onMounted（单例不一定在组件 setup 里调用）
    globalThemeInstance.initTheme()
  }
  return globalThemeInstance
}
