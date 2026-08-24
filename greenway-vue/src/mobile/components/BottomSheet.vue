<template>
  <div class="bs-root" :style="{ '--bs-bottom': bottomOffset }">
    <!-- 半透明遮罩（仅展开时） -->
    <Transition name="bs-mask">
      <div v-if="modelValue" class="bs-mask" @click="dismiss"></div>
    </Transition>

    <!-- 抽屉面板：收起时露出 peek 高度，展开时撑到 expanded 高度 -->
    <div
      class="bottom-sheet"
      :class="{ 'is-expanded': modelValue }"
      :style="{ '--bs-peek': peekHeight + 'px', '--bs-expanded': expandedHeight }"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchEnd"
    >
      <div class="bs-drag" @click="toggle">
        <span class="bs-drag-bar"></span>
      </div>

      <div class="bs-header">
        <slot name="header" :close="close">
          <div class="bs-title">{{ title }}</div>
        </slot>
      </div>

      <div class="bs-body">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  peekHeight: { type: Number, default: 84 },
  expandedHeight: { type: String, default: '58%' },
  bottomOffset: { type: String, default: '0px' }
})
const emit = defineEmits(['update:modelValue', 'dismiss', 'open'])

const sheetEl = ref(null)
let startY = 0
let dragging = false
let wasExpanded = false

const toggle = () => { emit('update:modelValue', !props.modelValue) }
const close = () => { emit('update:modelValue', false) }
// 遮罩点击：同时更新 v-model 与发 dismiss 事件（兼容两种用法）
const dismiss = () => { emit('update:modelValue', false); emit('dismiss') }

watch(() => props.modelValue, (v) => {
  if (v) emit('open')
})

const onTouchStart = (e) => {
  startY = e.touches[0].clientY
  dragging = true
  wasExpanded = props.modelValue
}

const bodyAtTop = (el) => {
  const body = el?.closest?.('.bs-body')
  return !body || body.scrollTop <= 0
}

const onTouchMove = (e) => {
  if (!dragging || !sheetEl.value) return
  const dy = e.touches[0].clientY - startY
  if (wasExpanded) {
    // 展开态向下拖：仅当 body 已在顶部才允许收起拖动
    if (dy > 0 && bodyAtTop(e.target)) {
      sheetEl.value.style.transition = 'none'
      sheetEl.value.style.transform = `translateY(${Math.min(dy, 200)}px)`
    }
  } else if (dy < 0) {
    // 收起态向上拖：展开（height 过渡动画由 is-expanded 触发）
    emit('update:modelValue', true)
    dragging = false
  }
}

const onTouchEnd = (e) => {
  if (!dragging || !sheetEl.value) return
  dragging = false
  sheetEl.value.style.transition = ''
  const dy = e.changedTouches[0].clientY - startY
  if (wasExpanded && dy > 80) close()
  else sheetEl.value.style.transform = ''
}
</script>

<style scoped>
.bs-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-overlay);
}

.bs-mask {
  position: absolute;
  inset: 0 0 var(--bs-bottom, 0px) 0;
  background: var(--overlay-bg);
  pointer-events: auto;
  z-index: 1;
}

.bottom-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--bs-bottom, 0px);
  height: var(--bs-peek);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: 24px 24px 0 0;
  box-shadow: var(--shadow-xl);
  transition: height 0.32s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: height;
  pointer-events: auto;
  overflow: hidden;
}
.theme-dark .bottom-sheet {
  background: var(--color-surface);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.bottom-sheet::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.4);
}
.theme-dark .bottom-sheet::before { background: rgba(255, 255, 255, 0.06); }

.bottom-sheet.is-expanded {
  height: var(--bs-expanded);
}

.bs-drag {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0 6px;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
}
.bs-drag-bar {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-surface-3);
}

.bs-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 10px;
  gap: 8px;
}
.bs-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: -0.2px;
}

.bs-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
