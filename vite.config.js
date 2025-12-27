import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/meteoai/', // Nom del repositori
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Només separem el que realment tens instal·lat al package.json
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    open: true,
    host: true
  }
})