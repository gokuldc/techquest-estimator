import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dns from 'node:dns'

dns.setDefaultResultOrder('verbatim')

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
    // If building for production (Electron .exe), use relative paths. Otherwise, use absolute.
    base: command === 'build' ? './' : '/',
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      // 🔥 THE BRIDGE: Tell Vite to forward API calls to our Rust Daemon!
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        }
      }
    }
  }
})