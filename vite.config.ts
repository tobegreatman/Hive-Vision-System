import { fileURLToPath, URL } from 'node:url'

import templateCompilerOptions from '@tresjs/core/template-compiler-options'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const THREE_DEPS =
  /\/node_modules\/(three|three-stdlib|postprocessing|three-mesh-bvh|maath|troika-[a-z-]+)\//
const VUE_DEPS = /\/node_modules\/(vue|@vue|vue-router|pinia)\//

const API_PROXY = {
  '/api': {
    target: 'http://127.0.0.1:3600',
    changeOrigin: true,
  },
}

// 个股研究复核台（stockframe）是独立的本地 Python 引擎，统一走 /stockframe-api 前缀转发，
// 避免与平台 /api 冲突；引擎未启动时页面自动退化为内置快照。
const STOCKFRAME_PROXY = {
  '/stockframe-api': {
    target: 'http://127.0.0.1:8770',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/stockframe-api/, ''),
  },
}

const PROXY = {
  ...API_PROXY,
  ...STOCKFRAME_PROXY,
}

export default defineConfig({
  // TresJS 的 <TresXxx> 不是 Vue 组件：必须把 /^Tres[A-Z]/ 与 tres-* 标记为自定义元素，
  // 让它们直接透传给 TresCanvas 的自定义渲染器，否则会触发
  // "Failed to resolve component: TresMesh" 并且整棵场景树不渲染。
  plugins: [vue(templateCompilerOptions)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8080,
    strictPort: true,
    proxy: PROXY,
  },
  // vite preview 不继承 server.proxy，单独声明一份，保证生产包也能打后端
  preview: {
    port: 4173,
    strictPort: true,
    proxy: PROXY,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // 渲染引擎与 UI 框架各自成 chunk：主包只留业务代码，
        // 首屏加载 three 时可被浏览器长缓存复用。
        manualChunks(id: string) {
          const normalized = id.replace(/\\/g, '/')
          if (!normalized.includes('/node_modules/')) return undefined
          if (normalized.includes('/node_modules/@tresjs/')) return 'tres'
          if (THREE_DEPS.test(normalized)) return 'three'
          if (VUE_DEPS.test(normalized)) return 'vue'
          return undefined
        },
      },
    },
  },
})
