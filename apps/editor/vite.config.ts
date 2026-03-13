import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@openlabel/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@openlabel/protocols': path.resolve(__dirname, '../../packages/protocols/src/index.ts'),
      '@openlabel/store': path.resolve(__dirname, '../../packages/store/src/index.ts'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
})
