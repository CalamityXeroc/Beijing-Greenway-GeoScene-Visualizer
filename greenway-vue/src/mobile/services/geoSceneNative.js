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
