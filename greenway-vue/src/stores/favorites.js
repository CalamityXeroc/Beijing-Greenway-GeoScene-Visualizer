import { reactive, watch } from 'vue'
import { useUserAuth } from '@/stores/userAuth'
import { fetchFavoriteIds, addFavorite, removeFavorite } from '@/services/favoritesApi'

const { isLoggedIn } = useUserAuth()

const state = reactive({
  ids: [],
  loaded: false
})

function isFavorite(greenwayId) {
  return state.ids.includes(Number(greenwayId))
}

async function loadIds() {
  if (!isLoggedIn.value) { state.ids = []; state.loaded = false; return }
  try {
    state.ids = await fetchFavoriteIds()
    state.loaded = true
  } catch {
    state.loaded = false
  }
}

async function toggle(greenwayId) {
  const id = Number(greenwayId)
  if (!isLoggedIn.value) return
  try {
    if (isFavorite(id)) {
      await removeFavorite(id)
      state.ids = state.ids.filter(x => x !== id)
    } else {
      await addFavorite(id)
      if (!state.ids.includes(id)) state.ids.push(id)
    }
    return true
  } catch {
    return false
  }
}

// 登录态变化时同步收藏状态
watch(isLoggedIn, (val) => {
  if (val) loadIds()
  else { state.ids = []; state.loaded = false }
})

export function useFavorites() {
  return { favorites: state, isFavorite, loadIds, toggle }
}
