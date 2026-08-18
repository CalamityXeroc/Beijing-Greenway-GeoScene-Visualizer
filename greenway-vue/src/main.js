import { createApp } from 'vue'
import router from './router'
import App from './App.vue'
import { Capacitor } from '@capacitor/core'
import { CapacitorPlugin, initializeApp, setupAppListeners } from './utils/capacitorPlugin'
import { isMobileDevice } from './utils/useMobileOptimization'
import { isBeiJingDayTime, readPreference, migrateLegacyKeys } from './utils/useTheme'

// 导入全局样式
import './assets/main.css'

// 导入移动端设计系统
import './mobile/styles/design-system.css'

// ─── 提前同步初始化主题（在 Vue 挂载前执行，防止白屏闪烁）────────────────
;(function initThemeEarly() {
  migrateLegacyKeys()
  const pref = readPreference()
  let mode
  if (pref === 'day') {
    mode = 'day'
  } else if (pref === 'night') {
    mode = 'night'
  } else {
    // auto: 根据北京时间 (06:00-18:00 = 白天)
    mode = isBeiJingDayTime() ? 'day' : 'night'
  }
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.classList.add(mode === 'night' ? 'theme-dark' : 'theme-light')
  console.log(`[main] 早期主题初始化: ${mode} (pref=${pref})`)
})()
// ────────────────────────────────────────────────────────────────────────────

const app = createApp(App)

// 使用路由
app.use(router)

// 挂载应用
app.mount('#app')

// 仅在 Capacitor 原生环境（App 容器）中初始化原生插件；
// 普通手机浏览器访问网站时 isMobileDevice() 也为 true，但 Capacitor 插件不可用，
// 若强行调用 StatusBar 等会报 "plugin is not implemented on web"。
const isCapacitorNative = Capacitor.isNativePlatform()
if (isCapacitorNative) {
  app.use(CapacitorPlugin)

  // DOM挂载完成后初始化Capacitor
  setTimeout(() => {
    try {
      initializeApp()
      setupAppListeners()
      console.log('🔌 Capacitor 原生功能已初始化')
    } catch (error) {
      console.log('💡 Capacitor在Web环境可能不完全可用')
    }
  }, 500)
}

console.log('🌳 绿脉伴侣 Vue 应用已启动')
console.log('📍 基于 Vue 3 + GeoScene + Capacitor 架构')
if (isMobileDevice()) {
  console.log('📱 移动端模式已启用（浏览器访问）')
}
