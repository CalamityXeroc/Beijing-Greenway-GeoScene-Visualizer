/**
 * 移动端主题管理（薄封装）
 * 统一委托给桌面端全局单例 useGlobalTheme，避免两套状态互相打架。
 * 兼容 `data-theme`（桌面）和 `.theme-light/.theme-dark`（移动端）两套样式机制。
 * 持久化统一使用 useTheme 的 appTheme key（day / night / auto）。
 */
import { computed } from 'vue'
import { useGlobalTheme } from '@/utils/useTheme'

export function useAppTheme() {
  const { theme, isAuto, setTheme, toggleTheme } = useGlobalTheme()

  const isDark = computed(() => theme.value === 'night')

  // 全局单例已在 useGlobalTheme 初始化，无需重复
  const init = () => {}

  // 兼容旧签名：setTheme(dark, auto)
  const setThemeCompat = (dark, auto = false) => {
    if (auto) return setTheme('auto')
    return setTheme(dark ? 'night' : 'day')
  }

  return { isDark, isAuto, init, toggleTheme, setTheme: setThemeCompat }
}
