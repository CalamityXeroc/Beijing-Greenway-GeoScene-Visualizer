import { reactive, computed } from 'vue'
import { getApiBaseUrl } from '../mobile/services/api'
import { useAdminAuth } from './adminAuth'

const TOKEN_KEY = 'greenway_user_token'
const USER_KEY  = 'greenway_user'

const state = reactive({
  token:       localStorage.getItem(TOKEN_KEY) || null,
  currentUser: (() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })()
})

const isLoggedIn    = computed(() => !!state.token && !!state.currentUser)
const currentUser   = computed(() => state.currentUser)
const token         = computed(() => state.token)
const username      = computed(() => state.currentUser?.username || '')
const nickname      = computed(() => state.currentUser?.nickname || state.currentUser?.username || '')

function setSession(tokenStr, userObj) {
  // 重新登录后解除「管理员已主动退出」标记，恢复“前台管理员免二次登录”
  sessionStorage.removeItem('greenway_admin_manual_logout')
  state.token       = tokenStr
  state.currentUser = userObj
  localStorage.setItem(TOKEN_KEY, tokenStr)
  localStorage.setItem(USER_KEY, JSON.stringify(userObj))
}

function clearSession() {
  state.token       = null
  state.currentUser = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  // 前台退出时一并清掉管理员会话，否则管理后台“复用前台身份”获得的登录态会继续有效
  useAdminAuth().clearSession()
}

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`

  const baseUrl = getApiBaseUrl()
  const fullPath = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`

  const res = await fetch(fullPath, { ...options, headers })

  // token 过期/无效：立即清除本地会话，避免收藏等接口静默失效（与 adminAuth 行为一致）
  if (res.status === 401) clearSession()

  return res
}

export function useUserAuth() {
  return { isLoggedIn, currentUser, token, username, nickname, setSession, clearSession, apiFetch }
}
