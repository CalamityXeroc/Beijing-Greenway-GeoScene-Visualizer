import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { getNativeLocation } from '../services/geoSceneNative'

/**
 * 检查是否在原生平台上运行
 */
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform()
}

/**
 * 获取当前位置
 * 真机定位修复（国内手机无 Google Play Services）：
 * - Capacitor Geolocation 插件底层依赖 GMS 的 FusedLocationProvider，国内真机不可用
 * - 改为优先使用浏览器 HTML5 Geolocation API（WebView 原生支持，用系统 LocationManager，不依赖 GMS）
 * - 兜底仍保留 Capacitor 插件（有 GMS 的设备可增强精度）
 */
export const getCurrentLocation = async () => {
  try {
    if (!isNativePlatform()) {
      // Web平台降级到浏览器地理位置API
      return await getBrowserLocation()
    }

    // 原生平台：优先用 GeoScene 原生定位（Android LocationManager，不依赖 GMS，国内手机首选）
    try {
      const loc = await getNativeLocation()
      console.log('[定位] 原生定位成功:', loc.source, '精度:', loc.accuracy)
      return loc
    } catch (nativeErr) {
      console.warn('[定位] 原生定位失败，尝试浏览器定位:', nativeErr.message)
    }

    // 兜底：浏览器 Geolocation（WebView 内置，也支持系统 LocationManager）
    try {
      const loc = await getBrowserLocation()
      return loc
    } catch (webErr) {
      console.warn('[定位] 浏览器定位失败，尝试 Capacitor 插件:', webErr.message)
    }

    // 最后兜底：Capacitor 插件（有 Google Play Services 的设备可增强精度）
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000
      })
      return formatPosition(coordinates)
    } catch (highErr) {
      console.warn('[定位] 高精度失败，降级网络定位:', highErr.message)
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000
      })
      return formatPosition(coordinates)
    }
  } catch (error) {
    console.error('获取位置失败:', error)
    throw error
  }
}

function formatPosition(coordinates) {
  return {
    lat: coordinates.coords.latitude,
    lng: coordinates.coords.longitude,
    accuracy: coordinates.coords.accuracy,
    altitude: coordinates.coords.altitude,
    altitudeAccuracy: coordinates.coords.altitudeAccuracy,
    heading: coordinates.coords.heading,
    speed: coordinates.coords.speed,
    timestamp: coordinates.timestamp
  }
}

/**
 * 浏览器地理位置API
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export const getBrowserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持地理位置功能'))
      return
    }

    // 高精度优先，失败降级低精度（网络/基站，更快更稳，不依赖 GPS 冷启动）
    const attempt = (highAccuracy) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          })
        },
        (error) => {
          if (highAccuracy) {
            // 高精度失败（室内/GPS 弱）：降级低精度再试一次
            console.warn('[定位] 浏览器高精度失败，降级低精度:', error.message)
            attempt(false)
          } else {
            reject(new Error(`浏览器地理位置错误: ${error.message}`))
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 8000 : 15000,
          maximumAge: highAccuracy ? 10000 : 60000
        }
      )
    }

    attempt(true)
  })
}

/**
 * 监听位置变化
 * @param {Function} callback - 位置更新回调函数
 * @returns {string} 监听ID，用于停止监听
 */
export const watchLocation = (callback) => {
  if (!isNativePlatform()) {
    // Web平台使用浏览器API
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
      },
      (error) => {
        console.error('监听位置变化失败:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
    return `web-${watchId}`
  }

  // 原生平台暂不支持watchPosition，使用定时器模拟
  const intervalId = setInterval(async () => {
    try {
      const location = await getCurrentLocation()
      callback(location)
    } catch (error) {
      console.error('监听位置变化出错:', error)
    }
  }, 5000) // 每5秒更新一次

  return `native-${intervalId}`
}

/**
 * 停止监听位置变化
 * @param {string} watchId - 监听ID
 */
export const clearWatch = (watchId) => {
  if (watchId.startsWith('web-')) {
    const id = parseInt(watchId.split('-')[1])
    navigator.geolocation.clearWatch(id)
  } else if (watchId.startsWith('native-')) {
    const id = parseInt(watchId.split('-')[1])
    clearInterval(id)
  }
}

/**
 * 设置状态栏样式
 */
export const setupStatusBar = async () => {
  if (!isNativePlatform()) return

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#0d1420' })
    await StatusBar.setOverlaysWebView({ overlay: false })
  } catch (error) {
    console.warn('设置状态栏失败:', error)
  }
}

/**
 * 隐藏启动屏
 */
export const hideSplashScreen = async () => {
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch (error) {
    console.log('SplashScreen not available on web')
  }
}

/**
 * 显示启动屏
 */
export const showSplashScreen = async () => {
  try {
    await SplashScreen.show({
      autoHide: false
    })
  } catch (error) {
    console.log('SplashScreen not available on web')
  }
}

/**
 * 获取应用信息
 */
export const getAppInfo = async () => {
  try {
    if (!isNativePlatform()) {
      // Web环境返回模拟信息
      return {
        appId: 'com.greenway.mobile',
        appName: '绿脉伴侣',
        version: '1.0.0',
        build: '1',
        platform: 'web'
      }
    }
    const info = await App.getInfo()
    return {
      appId: info.id,
      appName: info.name,
      version: info.version,
      build: info.build,
      platform: Capacitor.getPlatform()
    }
  } catch (error) {
    console.warn('获取应用信息失败 (Web环境正常):', error.message)
    return null
  }
}

/**
 * 处理返回按钮（Android）
 */
export const setupBackButton = (callback) => {
  if (isNativePlatform()) {
    App.addListener('backButton', () => {
      callback()
    })
  }
}

/**
 * 处理应用恢复
 */
export const setupAppResume = (callback) => {
  if (isNativePlatform()) {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        callback(true)
      }
    })
  }
}

/**
 * 检查权限
 */
export const checkLocationPermission = async () => {
  if (!isNativePlatform()) {
    return true // Web平台总是返回true
  }

  try {
    const permission = await Geolocation.checkPermissions()
    return permission.location === 'granted' || permission.location === 'prompt'
  } catch (error) {
    console.error('检查位置权限失败:', error)
    return false
  }
}

/**
 * 请求位置权限
 */
export const requestLocationPermission = async () => {
  if (!isNativePlatform()) {
    return true // Web平台总是返回true
  }

  try {
    const permission = await Geolocation.requestPermissions()
    return permission.location === 'granted'
  } catch (error) {
    console.error('请求位置权限失败:', error)
    return false
  }
}

/**
 * 初始化Capacitor
 */
export const initializeCapacitor = async () => {
  try {
    // 设置状态栏
    await setupStatusBar()

    // 初始化应用信息
    const appInfo = await getAppInfo()
    console.log('App Info:', appInfo)

    // 返回初始化结果
    return {
      isNative: isNativePlatform(),
      appInfo: appInfo
    }
  } catch (error) {
    console.error('Capacitor初始化失败:', error)
    return {
      isNative: false,
      appInfo: null
    }
  }
}

export default {
  isNativePlatform,
  getCurrentLocation,
  getBrowserLocation,
  watchLocation,
  clearWatch,
  setupStatusBar,
  hideSplashScreen,
  showSplashScreen,
  getAppInfo,
  setupBackButton,
  setupAppResume,
  checkLocationPermission,
  requestLocationPermission,
  initializeCapacitor
}
