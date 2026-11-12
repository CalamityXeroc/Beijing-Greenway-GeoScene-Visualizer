<template>
  <div class="download-page">
    <!-- 顶部导航（与全站一致的简洁导航） -->
    <header class="dl-nav">
      <router-link to="/" class="dl-logo">
        <img src="/logo_icon.svg" alt="绿脉伴侣" class="dl-logo-img" />
        <span class="dl-logo-text">绿脉伴侣</span>
      </router-link>
      <nav class="dl-nav-links">
        <router-link to="/map" class="dl-nav-link">地图总览</router-link>
        <router-link to="/login" class="dl-nav-link">登录</router-link>
      </nav>
    </header>

    <!-- 主体 -->
    <main class="dl-main">
      <div class="dl-hero">
        <!-- App 图标 -->
        <div class="dl-app-icon">
          <img src="/logo.svg" alt="绿脉伴侣" />
        </div>
        <h1 class="dl-title">绿脉伴侣 App</h1>
        <p class="dl-subtitle">北京绿道智慧服务平台 · 移动端应用</p>
        <p class="dl-desc">
          智能推荐 · 绿道体检 · 路径规划 · 三维漫游 · AI 助手 · 社区互动
        </p>

        <!-- 下载按钮 -->
        <div class="dl-actions">
          <a
            :href="downloadUrl"
            class="dl-btn dl-btn-primary"
            @click.prevent="onDownload"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            下载安卓版 <span class="dl-ver">v{{ version }}</span>
          </a>
        </div>

        <!-- 版本信息 -->
        <div class="dl-meta">
          <span>版本 {{ version }}</span>
          <span class="dl-sep">·</span>
          <span>约 {{ apkSize }} MB</span>
          <span class="dl-sep">·</span>
          <span>Android 9.0 及以上</span>
        </div>

        <!-- 二维码区域 -->
        <div class="dl-qr-section">
          <div class="dl-qr-box">
            <canvas ref="qrCanvas" class="dl-qr-canvas"></canvas>
            <p class="dl-qr-tip">手机扫码下载</p>
          </div>
          <div class="dl-install-tips">
            <h3>安装步骤</h3>
            <ol class="dl-steps">
              <li>点击上方按钮或扫码下载 APK 安装包</li>
              <li>下载完成后点击安装包开始安装</li>
              <li>如提示"未知来源"，请在设置中允许本次安装</li>
              <li>安装完成后即可使用绿脉伴侣全部功能</li>
            </ol>
            <div class="dl-warn">
              <strong>温馨提示：</strong>本应用为独立安卓安装包，未上架应用市场，
              首次安装需允许"安装未知应用"权限；请从官方渠道下载以确保安全。
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="dl-footer">
      <p>© 2025-2026 绿脉伴侣 · 北京联合大学</p>
      <p>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">京ICP备2025153719号-2</a>
        <span class="dl-sep">·</span>
        <a href="https://beian.mps.gov.cn/#/query/webSearch?code=11022902000516" target="_blank" rel="noopener noreferrer">京公网安备11022902000516号</a>
      </p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import QRCode from 'qrcode'

// 下载配置（生产环境由服务器托管 APK）
const VERSION = '1.8'
const APK_SIZE = 173
const DOWNLOAD_PATH = '/apk/greenway-v1.8.apk'

const qrCanvas = ref(null)

// 下载地址：优先用完整域名（扫码场景需要绝对地址），开发环境用相对路径
const downloadUrl = computed(() => {
  if (import.meta.env.DEV) return DOWNLOAD_PATH
  return `${window.location.origin}${DOWNLOAD_PATH}`
})

// 二维码内容：必须是完整可访问的地址（手机扫码）
const qrContent = computed(() => {
  if (import.meta.env.DEV) return 'https://wandergreen.cn' + DOWNLOAD_PATH
  return `${window.location.origin}${DOWNLOAD_PATH}`
})

const version = VERSION
const apkSize = APK_SIZE

// 生成二维码
onMounted(() => {
  if (qrCanvas.value) {
    QRCode.toCanvas(qrCanvas.value, qrContent.value, {
      width: 168,
      margin: 2,
      color: { dark: '#0f2b5b', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    }).catch(err => console.error('[下载页] 二维码生成失败:', err))
  }
})

// 下载点击：Web 直接下载，App 内提示用浏览器打开
const onDownload = () => {
  if (window.Capacitor?.isNativePlatform?.()) {
    alert('请在手机浏览器中打开本页面下载安装包')
    return
  }
  window.location.href = downloadUrl.value
}
</script>

<style scoped>
.download-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(170deg, #f0f6ff 0%, #ffffff 45%, #f7fafc 100%);
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}

/* 黑夜模式适配 */
[data-theme="night"] .download-page {
  background: linear-gradient(170deg, #162142 0%, #0f172a 45%, #101a2e 100%);
}

[data-theme="night"] .dl-nav {
  background: rgba(15, 23, 42, 0.88);
  border-bottom-color: #1e293b;
}

[data-theme="night"] .dl-logo-text { color: #e8f5e9; }
[data-theme="night"] .dl-nav-link { color: #94a3b8; }
[data-theme="night"] .dl-nav-link:hover { color: #69f0ae; }

[data-theme="night"] .dl-title {
  background: linear-gradient(135deg, #7dd3fc, #5eead4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
[data-theme="night"] .dl-subtitle { color: #94a3b8; }
[data-theme="night"] .dl-desc { color: #64748b; }
[data-theme="night"] .dl-meta { color: #94a3b8; }
[data-theme="night"] .dl-sep { color: #334155; }

[data-theme="night"] .dl-qr-section {
  background: #111c33;
  border-color: #1e293b;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.4);
}
[data-theme="night"] .dl-qr-canvas { border-color: #1e293b; }
[data-theme="night"] .dl-qr-tip { color: #94a3b8; }
[data-theme="night"] .dl-install-tips h3 { color: #e2e8f0; }
[data-theme="night"] .dl-steps { color: #94a3b8; }

[data-theme="night"] .dl-warn {
  color: #fbbf24;
  background: #1c1917;
  border-color: #78350f;
}

[data-theme="night"] .dl-footer {
  border-top-color: #1e293b;
  color: #64748b;
}
[data-theme="night"] .dl-footer a { color: #64748b; }
[data-theme="night"] .dl-footer a:hover { color: #69f0ae; }

/* 导航 */
.dl-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 32px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e6eefc;
}
.dl-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.dl-logo-img { width: 32px; height: 32px; }
.dl-logo-text { font-size: 18px; font-weight: 700; color: #0f2b5b; }
.dl-nav-links { display: flex; gap: 22px; }
.dl-nav-link {
  color: #475569; text-decoration: none; font-size: 14px;
  transition: color 0.2s;
}
.dl-nav-link:hover { color: #2563eb; }

/* 主体 */
.dl-main { flex: 1; display: flex; justify-content: center; padding: 48px 20px; }
.dl-hero { max-width: 720px; width: 100%; text-align: center; }

.dl-app-icon {
  width: 96px; height: 96px; margin: 0 auto 20px;
  border-radius: 22px;
  background: linear-gradient(135deg, #1e40af, #0e7490);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 14px 34px rgba(30, 64, 175, 0.3);
}
.dl-app-icon img { width: 60px; height: 60px; }

.dl-title { font-size: 30px; font-weight: 800; color: #0f2b5b; margin: 0 0 6px; }
.dl-subtitle { font-size: 16px; color: #64748b; margin: 0 0 10px; }
.dl-desc { font-size: 14px; color: #94a3b8; margin: 0 0 26px; }

/* 按钮 */
.dl-actions { margin-bottom: 14px; }
.dl-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 40px; border-radius: 30px;
  font-size: 17px; font-weight: 700; text-decoration: none;
  transition: all 0.25s ease;
}
.dl-btn-primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  box-shadow: 0 10px 26px rgba(37, 99, 235, 0.35);
}
.dl-btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 34px rgba(37, 99, 235, 0.45);
}
.dl-ver { font-size: 13px; opacity: 0.85; font-weight: 500; }

.dl-meta {
  display: flex; justify-content: center; gap: 8px;
  font-size: 13px; color: #64748b; margin-bottom: 36px;
}
.dl-sep { color: #cbd5e1; }

/* 二维码 */
.dl-qr-section {
  display: flex; gap: 36px; align-items: flex-start;
  background: #fff;
  border: 1px solid #e2ecff;
  border-radius: 18px;
  padding: 30px 36px;
  text-align: left;
  box-shadow: 0 8px 26px rgba(30, 64, 175, 0.08);
}
.dl-qr-box { text-align: center; flex-shrink: 0; }
.dl-qr-canvas { border-radius: 10px; border: 1px solid #e8effc; }
.dl-qr-tip { font-size: 13px; color: #64748b; margin-top: 10px; }

.dl-install-tips { flex: 1; }
.dl-install-tips h3 { font-size: 16px; color: #0f2b5b; margin: 0 0 12px; }
.dl-steps {
  margin: 0 0 14px; padding-left: 20px;
  font-size: 13.5px; color: #475569; line-height: 2;
}
.dl-warn {
  font-size: 12.5px; color: #92600a;
  background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 10px; padding: 10px 14px; line-height: 1.7;
}

/* 页脚 */
.dl-footer {
  text-align: center; padding: 22px 16px;
  border-top: 1px solid #e6eefc;
  font-size: 12.5px; color: #94a3b8; line-height: 1.9;
}
.dl-footer a { color: #94a3b8; text-decoration: none; }
.dl-footer a:hover { color: #2563eb; }

/* 响应式 */
@media (max-width: 768px) {
  .dl-nav { padding: 12px 16px; }
  .dl-nav-links { gap: 14px; }
  .dl-main { padding: 32px 16px; }
  .dl-title { font-size: 24px; }
  .dl-btn { padding: 13px 30px; font-size: 15px; }
  .dl-qr-section { flex-direction: column; align-items: center; padding: 24px 20px; }
  .dl-install-tips { width: 100%; }
  .dl-app-icon { width: 80px; height: 80px; border-radius: 18px; }
  .dl-app-icon img { width: 50px; height: 50px; }
}
</style>
