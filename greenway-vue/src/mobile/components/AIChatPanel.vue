<template>
  <Transition name="ai-panel">
    <div v-if="visible" class="ai-overlay" :class="{ 'theme-dark': isDark }">
      <div class="ai-panel">
        <!-- 头部 -->
        <header class="ai-header">
          <div class="ai-header-info">
            <div class="ai-avatar">🌿</div>
            <div class="ai-header-text">
              <div class="ai-name-row">
                <span class="ai-name">绿道小助手</span>
                <span class="ai-model-badge">AI</span>
              </div>
              <span class="ai-status">
                <span class="ai-status-dot"></span>在线服务中
              </span>
            </div>
          </div>
          <div class="ai-header-actions">
            <button class="ai-icon-btn" @click="clearChat" aria-label="清空对话" title="清空对话">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
            <button class="ai-icon-btn" @click="$emit('close')" aria-label="关闭" title="关闭">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </header>

        <!-- 消息区 -->
        <div ref="messagesEl" class="ai-messages">
          <div
            v-for="m in messages"
            :key="m.id"
            class="ai-msg"
            :class="m.role"
          >
            <div class="ai-bubble">
              <span
                v-for="(part, i) in parseMsgContent(m.content)"
                :key="i"
                :class="{ bold: part.bold }"
                v-html="part.text"
              ></span>
            </div>
            <span class="ai-time">{{ m.time }}</span>
          </div>

          <!-- 正在输入 -->
          <div v-if="isLoading" class="ai-msg assistant">
            <div class="ai-bubble ai-typing">
              <span class="ai-typing-dot"></span>
              <span class="ai-typing-dot"></span>
              <span class="ai-typing-dot"></span>
            </div>
          </div>

          <!-- 快捷建议（仅初始） -->
          <Transition name="fade-down">
            <div v-if="showSuggestions" class="ai-suggestions">
              <button
                v-for="s in suggestions"
                :key="s"
                class="ai-suggest-chip"
                @click="selectSuggestion(s)"
              >{{ s }}</button>
            </div>
          </Transition>
        </div>

        <!-- 输入区 -->
        <div class="ai-input-area">
          <div class="ai-input-wrap">
            <textarea
              ref="inputEl"
              v-model="userInput"
              :disabled="isLoading"
              placeholder="输入问题，例如：推荐一条适合骑行的绿道…"
              rows="1"
              @keydown.enter.exact.prevent="sendMessage"
              @input="autoResize"
            ></textarea>
            <button
              class="ai-send-btn"
              :disabled="!userInput.trim() || isLoading"
              @click="sendMessage"
              aria-label="发送"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21L23 12 2 3v7l15 2-15 2v7z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, reactive, nextTick, watch } from 'vue'

const props = defineProps({ visible: Boolean })
import { aiChat, clearAiContext } from '../services/api'
import { useAppTheme } from '../composables/useAppTheme'
import { toast } from '../composables/useToast'

defineEmits(['close'])

const { isDark } = useAppTheme()

/* ─────────────────────────── 状态 ─────────────────────────── */
const isLoading = ref(false)
const userInput = ref('')
const messagesEl = ref(null)
const inputEl = ref(null)
const showSuggestions = ref(true)

// 会话ID：组件实例存活期间保持一致，关闭重开沿用同一会话上下文
const conversationId = (crypto.randomUUID?.() || String(Date.now()))

let _mid = 1
const makeId = () => _mid++
const timeNow = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

const messages = reactive([
  {
    id: makeId(),
    role: 'assistant',
    content: '你好！👋 我是**绿道小助手**，可以帮你：\n\n🗺️ **推荐绿道** — 根据需求推荐路线\n🛠️ **操作指引** — 介绍平台功能用法\n🌿 **绿道知识** — 解答北京绿道相关问题\n\n有什么我可以帮你的吗？',
    time: timeNow()
  }
])

const suggestions = [
  '推荐适合家庭出行的绿道',
  '最适合骑行的绿道是哪条？',
  '怎么使用地图功能？',
  '温榆河绿道有多长？'
]

/* ─────────────────────────── 消息解析（**粗体** + 换行）─────────────────────────── */
const parseMsgContent = (text) => {
  if (!text) return [{ text: '', bold: false }]
  const lines = text.replace(/\n/g, '<br>')
  const parts = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(lines)) !== null) {
    if (match.index > lastIndex) parts.push({ text: lines.slice(lastIndex, match.index), bold: false })
    parts.push({ text: match[1], bold: true })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < lines.length) parts.push({ text: lines.slice(lastIndex), bold: false })
  return parts.length ? parts : [{ text: lines, bold: false }]
}

/* ─────────────────────────── 操作 ─────────────────────────── */
const selectSuggestion = (text) => {
  showSuggestions.value = false
  userInput.value = text
  sendMessage()
}

const clearChat = () => {
  messages.splice(1) // 保留欢迎消息
  showSuggestions.value = true
  clearAiContext(conversationId)
  toast('已清空对话', 'success')
}

const sendMessage = async () => {
  const text = userInput.value.trim()
  if (!text || isLoading.value) return

  showSuggestions.value = false
  messages.push({ id: makeId(), role: 'user', content: text, time: timeNow() })
  userInput.value = ''
  isLoading.value = true

  await nextTick()
  if (inputEl.value) inputEl.value.style.height = 'auto'
  scrollBottom()

  try {
    const { reply } = await aiChat(text, conversationId)
    messages.push({ id: makeId(), role: 'assistant', content: reply, time: timeNow() })
  } catch (e) {
    messages.push({
      id: makeId(),
      role: 'assistant',
      content: `⚠️ ${e.message || '服务暂时不可用，请稍后重试'}`,
      time: timeNow()
    })
  } finally {
    isLoading.value = false
    await nextTick()
    scrollBottom()
  }
}

const scrollBottom = () => {
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

const autoResize = () => {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

// 打开时滚动到底部 + 聚焦输入框
watch(() => props.visible, (v) => {
  if (v) {
    nextTick(() => {
      scrollBottom()
      inputEl.value?.focus()
    })
  }
})
</script>

<style scoped>
/* ======================== 全屏遮罩 + 面板 ======================== */
.ai-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: var(--overlay-bg);
  display: flex;
  justify-content: center;
  align-items: stretch;
}
.ai-panel {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  animation: aiSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
@keyframes aiSlideUp {
  from { transform: translateY(24px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}

/* ======================== 头部 ======================== */
.ai-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--safe-top) + 8px) 16px 12px;
  background: var(--color-surface);
  border-bottom: 0.5px solid var(--color-divider);
}
.ai-header-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ai-avatar {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  background: var(--gradient-brand);
  box-shadow: var(--shadow-glow);
}
.ai-header-text { min-width: 0; }
.ai-name-row { display: flex; align-items: center; gap: 6px; }
.ai-name { font-size: var(--text-base); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.ai-model-badge {
  font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: var(--radius-full);
  background: var(--fill-info); color: var(--color-info); letter-spacing: 0.5px;
}
.ai-status { display: flex; align-items: center; gap: 5px; font-size: var(--text-xs); color: var(--color-text-tertiary); margin-top: 2px; }
.ai-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 6px var(--color-success); }
.ai-header-actions { display: flex; gap: 4px; flex-shrink: 0; }
.ai-icon-btn {
  width: 36px; height: 36px; border: none; border-radius: var(--radius-full);
  background: var(--color-surface-2); color: var(--color-text-secondary);
  display: flex; align-items: center; justify-content: center;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.ai-icon-btn:active { transform: scale(0.9); background: var(--color-surface-3); }

/* ======================== 消息区 ======================== */
.ai-messages {
  flex: 1; min-height: 0;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
  padding: 16px 12px 8px;
}
.ai-msg { display: flex; flex-direction: column; margin-bottom: 14px; }
.ai-msg.user { align-items: flex-end; }
.ai-msg.assistant { align-items: flex-start; }
.ai-bubble {
  max-width: 85%; padding: 11px 15px;
  border-radius: 18px; font-size: var(--text-base); line-height: 1.55;
  word-break: break-word; box-shadow: var(--shadow-sm);
}
.ai-msg.user .ai-bubble {
  background: var(--color-primary); color: #fff;
  border-bottom-right-radius: 5px;
}
.ai-msg.assistant .ai-bubble {
  background: var(--color-surface); color: var(--color-text-primary);
  border: 0.5px solid var(--color-border-light);
  border-bottom-left-radius: 5px;
}
.ai-bubble .bold { font-weight: var(--font-weight-bold); }
.ai-time { font-size: 10px; color: var(--color-text-tertiary); margin-top: 4px; padding: 0 4px; }

/* ======================== 打字动画 ======================== */
.ai-typing { display: inline-flex; gap: 5px; align-items: center; padding: 14px 16px; }
.ai-typing-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--color-text-tertiary);
  animation: aiTyping 1.2s infinite ease-in-out;
}
.ai-typing-dot:nth-child(2) { animation-delay: 0.15s; }
.ai-typing-dot:nth-child(3) { animation-delay: 0.3s; }
@keyframes aiTyping {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-5px); opacity: 1; }
}

/* ======================== 快捷建议 ======================== */
.ai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.ai-suggest-chip {
  padding: 8px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-full);
  background: var(--color-surface); color: var(--color-text-secondary);
  font-size: var(--text-sm); transition: all var(--transition-fast);
}
.ai-suggest-chip:active { background: var(--fill-primary); color: var(--color-primary); border-color: var(--color-primary); transform: scale(0.96); }

/* ======================== 输入区 ======================== */
.ai-input-area {
  flex: 0 0 auto;
  padding: 10px 12px calc(var(--safe-bottom) + 10px);
  background: var(--color-surface);
  border-top: 0.5px solid var(--color-divider);
}
.ai-input-wrap { display: flex; align-items: flex-end; gap: 8px; }
.ai-input-wrap textarea {
  flex: 1; resize: none; max-height: 120px;
  padding: 10px 14px; border: 0.5px solid var(--color-border);
  border-radius: 20px; background: var(--color-bg); color: var(--color-text-primary);
  font-size: var(--text-base); line-height: 1.4;
  transition: border-color var(--transition-fast);
}
.ai-input-wrap textarea:focus { border-color: var(--color-primary); }
.ai-input-wrap textarea::placeholder { color: var(--color-text-tertiary); }
.ai-send-btn {
  flex-shrink: 0; width: 40px; height: 40px; border: none; border-radius: 50%;
  background: var(--color-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-fab); transition: transform var(--transition-fast), opacity var(--transition-fast);
}
.ai-send-btn:active:not(:disabled) { transform: scale(0.9); }
.ai-send-btn:disabled { opacity: var(--opacity-disabled); box-shadow: none; }


/* ======================== 过渡 ======================== */
.ai-panel-enter-active, .ai-panel-leave-active { transition: opacity 0.25s ease; }
.ai-panel-enter-from, .ai-panel-leave-to { opacity: 0; }
.fade-down-enter-active, .fade-down-leave-active { transition: all 0.25s ease; }
.fade-down-enter-from, .fade-down-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
