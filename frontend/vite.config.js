import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/sync': 'http://localhost:3001',
      '/journey': 'http://localhost:3001',
      '/users': 'http://localhost:3001',
      '/courses': 'http://localhost:3001',
      '/enrollments': 'http://localhost:3001',
    }
  },
  build: {
    outDir: '../public',
    emptyOutDir: true
  }
})