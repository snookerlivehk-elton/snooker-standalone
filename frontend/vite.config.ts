/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Read BASE_PATH from .env files (e.g., .env.production) without prefix
  const env = loadEnv(mode, process.cwd(), '')
  // Prefer process.env for CI step env, fallback to .env, else '/'
  const base = process.env.BASE_PATH ?? env.BASE_PATH ?? '/'
  return {
    plugins: [react(), tailwindcss()],
    // Root path for GitHub Pages project site (username.github.io/<repo>/)
    base,
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  }
})