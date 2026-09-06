import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@erd-studio/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts',
      ),
      '@erd-studio/yjs-erd': path.resolve(
        __dirname,
        '../../packages/yjs-erd/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
