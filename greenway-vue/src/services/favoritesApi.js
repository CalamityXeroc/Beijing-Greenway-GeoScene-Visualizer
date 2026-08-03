import { useUserAuth } from '@/stores/userAuth'

const { apiFetch } = useUserAuth()

async function readJson(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
  return data
}

export async function fetchFavoriteIds() {
  const data = await readJson(await apiFetch('/api/favorites/ids'))
  return data.data?.ids || []
}

export async function fetchFavorites() {
  const data = await readJson(await apiFetch('/api/favorites'))
  return data.data || []
}

export async function addFavorite(greenwayId) {
  return readJson(await apiFetch('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ greenway_id: greenwayId })
  }))
}

export async function removeFavorite(greenwayId) {
  return readJson(await apiFetch(`/api/favorites/${greenwayId}`, { method: 'DELETE' }))
}

export async function fetchUserStats() {
  const data = await readJson(await apiFetch('/api/user/stats'))
  return data.data || {}
}
