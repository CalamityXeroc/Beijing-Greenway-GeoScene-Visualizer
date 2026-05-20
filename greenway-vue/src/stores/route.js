import { reactive, ref, computed } from 'vue'
import { searchAddress, walkingRoute, bicyclingRoute, reverseGeocode } from '@/services/gaodeApi.js'
import { wgs84ToGcj02 } from '@/utils/coordinateTransform.js'

const state = reactive({
  origin: null,
  destination: null,
  waypoints: [],
  travelMode: 'walking',
  routeResult: null,
  isPlanning: false,
  isPanelVisible: false,
  activeInput: null,
  searchResults: [],
  isSearching: false,
  error: null
})

let waypointIdCounter = 0

export function useRouteStore() {
  const hasRequired = computed(() => state.origin && state.destination)
  const waypointCount = computed(() => state.waypoints.length)

  function setOrigin(point) {
    state.origin = point ? { ...point } : null
    state.error = null
  }

  function setDestination(point) {
    state.destination = point ? { ...point } : null
    state.error = null
  }

  function addWaypoint(point) {
    if (state.waypoints.length >= 5) return
    state.waypoints.push({ id: ++waypointIdCounter, ...point })
    state.error = null
  }

  function removeWaypoint(id) {
    state.waypoints = state.waypoints.filter(w => w.id !== id)
  }

  function setTravelMode(mode) {
    state.travelMode = mode
    if (state.routeResult) {
      state.routeResult = null
    }
  }

  function setActiveInput(id) {
    state.activeInput = id
    state.error = null
  }

  function clearRoute() {
    state.routeResult = null
    state.origin = null
    state.destination = null
    state.waypoints = []
    state.error = null
    state.activeInput = null
  }

  function clearResults() {
    state.routeResult = null
    state.error = null
  }

  async function handleMapClick({ lng, lat }) {
    const inputId = state.activeInput
    if (!inputId) return

    try {
      const address = await reverseGeocode(lng, lat)
      const point = { lng, lat, address: address || `${lng.toFixed(6)}, ${lat.toFixed(6)}` }

      if (inputId === 'origin') {
        setOrigin(point)
      } else if (inputId === 'destination') {
        setDestination(point)
      } else {
        const wp = state.waypoints.find(w => w.id === inputId)
        if (wp) {
          Object.assign(wp, point)
          state.waypoints = [...state.waypoints]
        }
      }
    } catch {
      const point = { lng, lat, address: `${lng.toFixed(6)}, ${lat.toFixed(6)}` }
      if (inputId === 'origin') setOrigin(point)
      else if (inputId === 'destination') setDestination(point)
    }

    state.activeInput = null
    document.body.style.cursor = ''
  }

  async function doSearch(keywords) {
    if (!keywords || keywords.trim().length < 1) {
      state.searchResults = []
      return
    }
    state.isSearching = true
    try {
      const results = await searchAddress(keywords.trim())
      state.searchResults = results
    } catch (e) {
      state.searchResults = []
    } finally {
      state.isSearching = false
    }
  }

  let searchTimer = null
  function debouncedSearch(keywords) {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => doSearch(keywords), 300)
  }

  async function planRoute(onRouteReady) {
    if (!state.origin || !state.destination) {
      state.error = '请设置起点和终点'
      return
    }

    state.isPlanning = true
    state.error = null
    state.routeResult = null

    try {
      const origin = { lng: state.origin.lng, lat: state.origin.lat }
      const destination = { lng: state.destination.lng, lat: state.destination.lat }
      const waypoints = state.waypoints.map(w => ({ lng: w.lng, lat: w.lat }))

      const route = state.travelMode === 'bicycling'
        ? await bicyclingRoute(origin, destination, waypoints)
        : await walkingRoute(origin, destination, waypoints)

      if (!route || (!route.paths && !route.origin)) {
        state.error = '未找到可行路线，请调整起点或终点'
        return
      }

      state.routeResult = route

      if (onRouteReady) {
        onRouteReady(route, state.origin, state.destination, state.waypoints)
      }
    } catch (e) {
      state.error = e.message || '路径规划失败，请重试'
    } finally {
      state.isPlanning = false
    }
  }

  return {
    state,
    hasRequired,
    waypointCount,
    setOrigin,
    setDestination,
    addWaypoint,
    removeWaypoint,
    setTravelMode,
    setActiveInput,
    clearRoute,
    clearResults,
    handleMapClick,
    doSearch,
    debouncedSearch,
    planRoute
  }
}

let instance = null

export function getRouteStore() {
  if (!instance) {
    instance = useRouteStore()
  }
  return instance
}
