// src/stores/adminAuth.js
// 管理员会话状态管理（无 Pinia 依赖，使用 Vue 3 单例 reactive）
// 会话统一：若前台用户已登录且为 admin，则自动复用其 token（避免二次登录）
import { reactive, computed } from 'vue'
import { getApiBaseUrl } from '../mobile/services/api'

const KEY_TOKEN = 'greenway_admin_token'
const KEY_USER  = 'greenway_admin_user'
const USER_TOKEN_KEY = 'greenway_user_token'
const USER_KEY = 'greenway_user'
// 管理员主动退出标记：置位后不再从「前台用户身份」自动复用会话，避免退出后被就地复活
const KEY_MANUAL_LOGOUT = 'greenway_admin_manual_logout'

// 初始化：优先用管理员独立会话；否则若前台用户是 admin 则同步复用
function initState() {
  let token = localStorage.getItem(KEY_TOKEN)
  let user  = JSON.parse(localStorage.getItem(KEY_USER) || 'null')

  const manualLogout = sessionStorage.getItem(KEY_MANUAL_LOGOUT) === '1'

  // 前台用户会话是 admin 但管理会话为空 → 同步复用（免二次登录）
  if (!manualLogout && (!token || !user || user.role !== 'admin')) {
    const userToken = localStorage.getItem(USER_TOKEN_KEY)
    let userObj = null
    try { userObj = JSON.parse(localStorage.getItem(USER_KEY)) } catch { userObj = null }
    if (userToken && userObj?.role === 'admin') {
      token = userToken
      user = userObj
      localStorage.setItem(KEY_TOKEN, token)
      localStorage.setItem(KEY_USER, JSON.stringify(user))
    }
  }
  return { token, user }
}

const init = initState()
const state = reactive({
  token: init.token,
  user:  init.user,
})

export function useAdminAuth() {
  const isLoggedIn = computed(() => !!state.token && state.user?.role === 'admin')
  const adminUser  = computed(() => state.user)
  const token      = computed(() => state.token)

  function setSession(token, user) {
    sessionStorage.removeItem(KEY_MANUAL_LOGOUT)
    state.token = token
    state.user  = user
    localStorage.setItem(KEY_TOKEN, token)
    localStorage.setItem(KEY_USER,  JSON.stringify(user))
  }

  function clearSession() {
    state.token = null
    state.user  = null
    localStorage.removeItem(KEY_TOKEN)
    localStorage.removeItem(KEY_USER)
  }

  /** 管理员主动退出：打标记后再清会话。
   *  同时清掉前台会话——路由守卫对 /admin/* 会优先放行「前台管理员身份」，
   *  若只清管理员键，退出后仍能凭前台身份直接回到后台。 */
  function logout() {
    sessionStorage.setItem(KEY_MANUAL_LOGOUT, '1')
    clearSession()
    localStorage.removeItem(USER_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  /** 通用请求封装，自动携带 Bearer token */
  async function apiFetch(path, options = {}) {
    const baseUrl = getApiBaseUrl()
    const fullPath = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`

    const res = await fetch(fullPath, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.headers || {}),
      },
    })
    const raw = await res.text()
    let data = {}
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = {}
    }

    if (!res.ok) {
      if (res.status === 401) clearSession()   // token 过期/无效，立即清除本地会话
      throw new Error(data.message || `HTTP ${res.status}`)
    }
    if (!raw) return {}
    if (Object.keys(data).length) return data
    throw new Error('接口返回非 JSON 数据，请检查后端路由或反向代理配置')
  }

  return { isLoggedIn, adminUser, token, setSession, clearSession, logout, apiFetch }
}
