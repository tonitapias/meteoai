// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      // HE ACTUALITZAT AIXÒ: Ara inclou el favicon-96x96.png que tens
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon-96x96.png'],
      manifest: {
        name: 'MeteoToni AI',
        short_name: 'MeteoToni',
        description: 'Previsió meteorològica intel·ligent amb models ECMWF i AROME.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            // HE ACTUALITZAT AIXÒ: Nom correcte del fitxer que has pujat
            src: 'android-chrome-192x192.png', 
            sizes: '192x192',
            type: 'image/png'
          },
          {
            // HE ACTUALITZAT AIXÒ: Nom correcte del fitxer que has pujat
            src: 'android-chrome-512x512.png', 
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'lucide-react'],
          'vendor-maps': ['leaflet', 'react-leaflet'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    open: true,
    host: true
  }
});