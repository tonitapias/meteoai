// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/meteoai/', // Assegura't que coincideix amb el nom del teu repo de GitHub
  build: {
    outDir: 'dist',
    sourcemap: false, // Desactiva els mapes en producció per estalviar espai
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          icons: ['lucide-react'],
          ui: ['framer-motion', 'clsx', 'tailwind-merge']
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Puja el límit d'avís a 1MB per evitar warnings innecessaris
  },
  server: {
    open: true,
    host: true
  }
})