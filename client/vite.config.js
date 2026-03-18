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
    // Proxy vers le backend en développement
    proxy: {
      '/api': {
        target: 'http://localhost:3717',
        changeOrigin: true,
      },
      '/hooks': {
        target: 'http://localhost:3717',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3717',
        ws: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
