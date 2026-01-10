// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/meteoai/', // Correcte per GitHub Pages
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      // Afegim la nova icona maskable als assets per assegurar que es guarda a la caché
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon-96x96.png', 'maskable-icon.png'],
      manifest: {
        name: 'MeteoToni AI',
        short_name: 'MeteoToni',
        description: 'Previsió meteorològica intel·ligent amb models ECMWF i AROME.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/meteoai/',
        start_url: '/meteoai/',
        
        // 1. CONFIGURACIÓ D'ICONES ARREGLADA
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any' // Icona estàndard (amb transparència)
          },
          {
            // ⚠️ HAS DE CREAR AQUESTA IMATGE: Una versió de 512x512 amb fons sòlid (#0f172a)
            // i el logo una mica més petit al centre (zona segura).
            src: 'maskable-icon.png', 
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable' // Icona adaptativa per Android
          }
        ],

        // 2. SCREENSHOTS PER A UNA INSTAL·LACIÓ "RICA"
        // Això fa que surti una previsualització de l'app abans d'instal·lar-la
        screenshots: [
          {
            src: 'screenshot-mobile.png', // ⚠️ Puja una captura del mòbil (aprox 390x844px) a /public
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Previsió al detall'
          },
          {
            src: 'screenshot-desktop.png', // ⚠️ Opcional: Captura d'escriptori (aprox 1280x800px)
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Panell de control'
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