import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI/State libraries
          'vendor-ui': ['@tanstack/react-query', 'clsx', 'react-hot-toast'],
          // Charts (heaviest dependency)
          'vendor-charts': ['recharts'],
          // Lucide icons
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
