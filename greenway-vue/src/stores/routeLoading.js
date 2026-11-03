// 全局路由加载态
// 地图页依赖体积较大的 GeoScene 资源，首次进入需要下载/解析较久。
// 这个状态由路由守卫驱动，渲染在 App 根组件上，保证切换期间始终有可见反馈，
// 不会出现「页面一片空白、连加载图标都没有」的情况。
import { ref } from 'vue'

export const routeLoading = ref(false)

let showTimer = null

/**
 * 标记导航开始：延迟 150ms 再显示遮罩，
 * 避免快速切换（本地缓存命中）时遮罩一闪而过。
 */
export function beginRouteLoading() {
  clearTimeout(showTimer)
  showTimer = setTimeout(() => { routeLoading.value = true }, 150)
}

/** 标记导航结束：取消待显示并隐藏遮罩 */
export function endRouteLoading() {
  clearTimeout(showTimer)
  showTimer = null
  routeLoading.value = false
}
