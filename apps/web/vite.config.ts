import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { prerenderLanding } from './vite-plugin-prerender-landing'
import { apiProxy } from './vite-plugin-api-proxy'

export default defineConfig(({ mode }) => {
  const root = path.resolve(__dirname, '../..')
  const env = loadEnv(mode, root, '')
  const apiTarget = `http://127.0.0.1:${env.API_PORT || 3000}`
  const collabTarget = `http://127.0.0.1:${env.COLLAB_PORT || 3030}`
  // 개발 서버 Host 허용 목록이에요. VITE_ 접두사 없이 서버 전용으로 읽어요.
  const allowedHosts = (env.DEV_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  return {
    envDir: root,
    plugins: [apiProxy(apiTarget), vue(), tailwindcss(), prerenderLanding()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@erd-studio/shared': path.resolve(root, 'packages/shared/src/index.ts'),
        '@erd-studio/sql': path.resolve(root, 'packages/sql/src/index.ts'),
        '@erd-studio/yjs-erd': path.resolve(root, 'packages/yjs-erd/src/index.ts'),
      },
    },
    optimizeDeps: {
      exclude: ['@erd-studio/shared', '@erd-studio/sql', '@erd-studio/yjs-erd'],
    },
    ssr: {
      noExternal: ['reka-ui', 'lucide-vue-next', 'class-variance-authority'],
    },
    server: {
      host: true,
      port: 5173,
      ...(allowedHosts.length ? { allowedHosts } : {}),
      fs: { allow: [root] },
      proxy: {
        '/collaboration': {
          target: collabTarget,
          ws: true,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/collaboration/, '') || '/',
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.warn(`[vite] collab proxy: ${err.message}`)
            })
          },
        },
      },
    },
  }
})
