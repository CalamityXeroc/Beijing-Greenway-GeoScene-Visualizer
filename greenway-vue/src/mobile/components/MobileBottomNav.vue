<template>
  <nav class="bottom-nav">
    <div class="nav-inner">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-tab"
        :class="{ active: activeTab === item.id }"
        @click="handleTabChange(item.id)"
        :aria-label="item.label"
        :aria-current="activeTab === item.id ? 'page' : undefined"
      >
        <!-- SVG 图标 -->
        <span class="tab-icon" v-html="item.svg"></span>
        <span class="tab-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const props = defineProps({
  modelValue: { type: String, default: 'map' }
})
const emit = defineEmits(['update:modelValue', 'change'])

// activeTab 由当前路由派生：组件被 keep-alive 缓存后实例不重置，本地 ref 会残留上次高亮
const activeTab = computed(() => {
  const item = navItems.find(i => route.path.startsWith(i.path))
  return item?.id || props.modelValue
})

const navItems = [
  {
    id: 'discover', label: '发现', path: '/mobile/discover',
    svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
    </svg>`
  },
  {
    id: 'map', label: '地图', path: '/mobile/map',
    svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
      <line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line>
    </svg>`
  },
  {
    id: 'list', label: '绿道', path: '/mobile/list',
    svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>`
  },
  {
    id: 'community', label: '社区', path: '/mobile/community',
    svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>`
  },
  {
    id: 'profile', label: '我的', path: '/mobile/profile',
    svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>`
  }
]

const handleTabChange = (tabId) => {
  emit('update:modelValue', tabId)
  emit('change', tabId)
  const item = navItems.find(i => i.id === tabId)
  if (item?.path) router.push(item.path)
}
</script>

<style scoped>
/* 浮动玻璃底栏：四周留白 + 大圆角 + 毛玻璃 */
.bottom-nav {
  position: fixed;
  bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  left: 14px;
  right: 14px;
  z-index: var(--z-fixed);
  pointer-events: none;  /* 容器不拦截点击，按钮内层接管 */
}

.nav-inner {
  pointer-events: auto;
  position: relative;
  display: flex;
  height: 62px;
  padding: 0 8px;
  border-radius: 26px;
  box-shadow: var(--shadow-glass);
}

/* 毛玻璃背景 */
.theme-light .nav-inner {
  background: rgba(255, 255, 255, 0.72);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  backdrop-filter: blur(22px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.55);
}
.theme-dark .nav-inner {
  background: rgba(22, 30, 26, 0.72);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  backdrop-filter: blur(22px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 顶部内高光线 */
.nav-inner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
}
.theme-dark .nav-inner::before {
  background: rgba(255, 255, 255, 0.08);
}

.nav-tab {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: none;
  border: none;
  padding: 6px 4px;
  color: var(--color-text-tertiary);
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.nav-tab:active { transform: scale(0.92); }

.nav-tab.active {
  color: var(--color-primary);
}
/* 选中图标上浮 + 放大 + 弹性动画 */
.nav-tab.active .tab-icon {
  transform: translateY(-4px) scale(1.12);
}
.nav-tab.active .tab-icon svg {
  filter: drop-shadow(0 4px 10px rgba(22, 163, 74, 0.45));
}
.nav-tab.active .tab-label {
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  transform: translateY(1px);
}

.tab-icon {
  position: relative;
  z-index: 1;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tab-icon svg {
  transition: filter 0.3s ease;
}

.tab-label {
  position: relative;
  z-index: 1;
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  line-height: 1;
  letter-spacing: 0.2px;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), font-weight 0.2s;
}

</style>
