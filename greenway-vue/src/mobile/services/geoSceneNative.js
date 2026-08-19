import { registerPlugin } from '@capacitor/core'

/**
 * GeoScene 原生引擎桥接（Capacitor 插件）
 * 由 Android 原生端 GeoScenePlugin 实现，WebView 内通过此封装调用
 */
const GeoSceneNative = registerPlugin('GeoScene')

export async function initGeoScene() {
  return GeoSceneNative.init()
}

export async function getGeoSceneSdkInfo() {
  const [versionRes, licenseRes] = await Promise.allSettled([
    GeoSceneNative.getSdkVersion(),
    GeoSceneNative.getLicenseLevel()
  ])
  const version = versionRes.status === 'fulfilled' ? versionRes.value?.version : null
  const licenseLevel = licenseRes.status === 'fulfilled' ? licenseRes.value?.licenseLevel : null
  return { version, licenseLevel }
}

/**
 * 原生定位（Android LocationManager，不依赖 Google Play Services）
 * 国内手机无 GMS 时 Capacitor Geolocation 插件不可用，此方法作为可靠替代。
 * @returns {Promise<{lat: number, lng: number, accuracy: number, source: string}>}
 */
export async function getNativeLocation() {
  const result = await GeoSceneNative.getLocation()
  return {
    lat: result.lat,
    lng: result.lng,
    accuracy: result.accuracy,
    source: result.source || 'native'
  }
}
