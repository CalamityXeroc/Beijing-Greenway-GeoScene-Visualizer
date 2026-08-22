<template>
  <div class="feedback-page">
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <button class="back-btn" @click="goBack" aria-label="返回">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        返回
      </button>
      <span class="top-bar-title">问题反馈</span>
      <span class="top-bar-spacer"></span>
    </div>

    <div class="page-body">
      <div class="intro-card">
        <div class="intro-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </div>
        <div class="intro-text">
          <h3>告诉我们您遇到的问题</h3>
          <p>您的反馈将直达开发团队，我们会认真对待每一条建议并持续改进绿脉伴侣。</p>
        </div>
      </div>

      <div class="form-card">
        <div class="field-group">
          <label class="field-label">反馈内容 <span class="required">*</span></label>
          <textarea
            v-model="content"
            class="field-input textarea"
            placeholder="请详细描述您遇到的问题或建议…"
            rows="6"
            maxlength="2000"
          ></textarea>
          <div class="char-count">{{ content.length }}/2000</div>
        </div>

        <div class="field-group">
          <label class="field-label">联系方式（可选）</label>
          <input
            v-model="contact"
            class="field-input"
            placeholder="邮箱或手机号，方便我们回复您"
          />
        </div>

        <p v-if="!isLoggedIn" class="login-tip">
          未登录也可提交反馈，登录后可让我们跟进您的反馈进度
          <router-link to="/login" class="login-link">去登录</router-link>
        </p>
        <p v-else class="login-tip">当前以「{{ nickname }}」提交</p>
      </div>

      <div class="submit-area">
        <button class="submit-btn" :disabled="!content.trim() || submitting" @click="submitFeedback">
          {{ submitting ? '提交中…' : '提交反馈' }}
        </button>
        <p v-if="errorMsg" class="error-tip">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- 成功提示 -->
    <Teleport to="body">
      <div v-if="showSuccess" class="modal-overlay" @click="closeSuccess">
        <div class="modal-card" @click.stop>
          <div class="success-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#2E7D32" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h3>感谢您的反馈！</h3>
          <p>您的反馈已提交，我们会认真对待每一条建议。</p>
          <button class="done-btn" @click="closeSuccess">知道了</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserAuth } from '@/stores/userAuth'

const router = useRouter()
const goBack = () => router.back()

// 进入页面定格顶部（防止从地图底部跳转后保留滚动位置）
onMounted(() => window.scrollTo(0, 0))

const { isLoggedIn, token, nickname } = useUserAuth()

const content = ref('')
const contact = ref('')
const submitting = ref(false)
const showSuccess = ref(false)
const errorMsg = ref('')

function closeSuccess() {
  showSuccess.value = false
  goBack()
}

async function submitFeedback() {
  if (!content.value.trim() || submitting.value) return

  submitting.value = true
  errorMsg.value = ''

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token.value) headers['Authorization'] = `Bearer ${token.value}`

    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source: 'web',
        content: content.value.trim(),
        contact: contact.value.trim()
      })
    })
    const data = await res.json().catch(() => ({}))
    // 校验业务 code（防止 SPA fallback 返回 index.html 200 时误判成功）
    if (!res.ok || data.code !== 200) throw new Error(data.message || `HTTP ${res.status}`)

    content.value = ''
    contact.value = ''
    showSuccess.value = true
  } catch (e) {
    errorMsg.value = e.message || '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.feedback-page {
  min-height: 100vh;
  background: #f5f7f2;
  color: #1f2937;
  transition: background .3s, color .3s;
}

/* 顶部操作栏 */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
  transition: background .3s, border-color .3s;
}
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: #4b5563;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background .2s;
}
.back-btn:hover { background: rgba(0,0,0,0.05); }
.top-bar-title { font-size: 1.05rem; font-weight: 600; color: #111827; }
.top-bar-spacer { width: 70px; }

.page-body { max-width: 680px; margin: 0 auto; padding: 24px 16px 60px; }

/* 引导卡片 */
.intro-card {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  background: linear-gradient(135deg, #e8f5e9, #f1f8e9);
  border: 1px solid #c8e6c9;
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.intro-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #2E7D32;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.intro-text h3 { margin: 2px 0 4px; font-size: 1rem; color: #1f2937; }
.intro-text p { margin: 0; font-size: 0.85rem; color: #4b5563; line-height: 1.6; }

/* 表单卡片 */
.form-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.field-group { margin-bottom: 18px; }
.field-group:last-of-type { margin-bottom: 12px; }

.field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}
.required { color: #dc2626; }

.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 13px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #1f2937;
  font-size: 0.9rem;
  font-family: inherit;
  transition: border-color .2s, box-shadow .2s;
}
.field-input:focus {
  outline: none;
  border-color: #43A047;
  box-shadow: 0 0 0 2px rgba(67,160,71,0.15);
}
.textarea { resize: vertical; min-height: 130px; line-height: 1.6; }

.char-count { text-align: right; font-size: 0.78rem; color: #9ca3af; margin-top: 4px; }

.login-tip { font-size: 0.8rem; color: #6b7280; margin: 4px 0 0; }
.login-link { color: #2E7D32; text-decoration: none; font-weight: 500; margin-left: 6px; }
.login-link:hover { text-decoration: underline; }

.submit-area { margin-top: 20px; text-align: center; }
.submit-btn {
  width: 100%;
  max-width: 320px;
  padding: 13px;
  background: linear-gradient(135deg, #2E7D32, #43A047);
  color: #fff;
  border: none;
  border-radius: 24px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .2s, transform .1s;
}
.submit-btn:hover:not(:disabled) { opacity: 0.92; }
.submit-btn:active:not(:disabled) { transform: scale(0.98); }
.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.error-tip { margin: 12px 0 0; font-size: 0.85rem; color: #dc2626; }

/* 成功弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.modal-card {
  width: 100%;
  max-width: 320px;
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
.success-icon { margin-bottom: 16px; }
.modal-card h3 { margin: 0 0 8px; font-size: 1.1rem; color: #111827; }
.modal-card p { margin: 0 0 20px; font-size: 0.85rem; color: #6b7280; }
.done-btn {
  width: 100%;
  padding: 12px;
  background: #2E7D32;
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.done-btn:hover { background: #256a28; }

/* 夜间模式 */
[data-theme="night"] .feedback-page { background: #0f0f0f; color: #e5e7eb; }
[data-theme="night"] .top-bar { background: #1a1a1a; border-bottom-color: #2a2a2a; }
[data-theme="night"] .back-btn { color: #9ca3af; }
[data-theme="night"] .back-btn:hover { background: rgba(255,255,255,0.06); }
[data-theme="night"] .top-bar-title { color: #e8e8e8; }
[data-theme="night"] .intro-card {
  background: linear-gradient(135deg, #16301a, #1a2e1a);
  border-color: #2d4a2d;
}
[data-theme="night"] .intro-text h3 { color: #e8e8e8; }
[data-theme="night"] .intro-text p { color: #9ca3af; }
[data-theme="night"] .form-card { background: #1e1e1e; border-color: #333; box-shadow: none; }
[data-theme="night"] .field-label { color: #d1d5db; }
[data-theme="night"] .field-input { background: #252525; border-color: #3a3a3a; color: #e5e7eb; }
[data-theme="night"] .field-input:focus { border-color: #4CAF50; box-shadow: 0 0 0 2px rgba(76,175,80,0.15); }
[data-theme="night"] .char-count { color: #6b7280; }
[data-theme="night"] .login-tip { color: #9ca3af; }
[data-theme="night"] .login-link { color: #81C784; }
[data-theme="night"] .modal-card { background: #1e1e1e; }
[data-theme="night"] .modal-card h3 { color: #e8e8e8; }
[data-theme="night"] .modal-card p { color: #9ca3af; }
</style>
