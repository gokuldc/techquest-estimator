/*import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})*/
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
    }
  }
})
