import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    plugins: [react()],
    base: '/dashboard/',
    ...(isDev && {
      server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        hmr: {
          protocol: 'ws',
          host: 'localhost',
          port: 5173,
        },
        watch: {
          usePolling: true,
        },
        proxy: {
          '/organisations': {
            target: 'http://backend:9000',
            changeOrigin: true,
          },
          '/organisation': {
            target: 'http://backend:9000',
            changeOrigin: true,
          },
          '/user': {
            target: 'http://backend:9000',
            changeOrigin: true,
          },
          '/users': {
            target: 'http://backend:9000',
            changeOrigin: true,
          },
          '/release': {
            target: 'http://backend:9000',
            changeOrigin: true,
          },
        },
      }
    })
  }
})
