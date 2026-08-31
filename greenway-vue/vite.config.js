import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true,   // 监听 0.0.0.0，Android 模拟器(10.0.2.2)和真机均可访问
    open: false,  // 不自动在桌面浏览器打开（移动端开发）
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path
      },
      // 百度全景静态图代理：绕过 CORS（百度 API 不支持跨域）
      '/baidu-pano': {
        target: 'https://api.map.baidu.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/baidu-pano/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // 移动端性能优化
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    // CSS代码分割
    cssCodeSplit: true,
    // 性能优化
    rollupOptions: {
      output: {
        manualChunks: {
          'ol': ['ol'],
          'vue-router': ['vue-router'],
          'vendor': ['axios', 'pinia']
        }
      }
    },
    // 压缩优化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // 移动端优化 - 支持iOS安全区域
  define: {
    __VITE_APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
})
