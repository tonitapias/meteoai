// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/meteoai/', //[cite: 3]
  
  build: {
    sourcemap: true, //[cite: 3]
    chunkSizeWarningLimit: 2000, // Ajustat a 2MB per silenciar l'avís del motor GIS WebGL
    rollupOptions: {
      output: {
        manualChunks: {
          // Separem les llibreries grans per optimitzar la càrrega i la persistència a la memòria cau
          'vendor-react': ['react', 'react-dom'], //[cite: 3]
          'vendor-leaflet': ['leaflet', 'react-leaflet'], //[cite: 3]
          'vendor-utils': ['lucide-react', 'zod'], //[cite: 3]
          'vendor-mapbox': ['mapbox-gl'] // NOU: Aïllament estratègic de la llibreria WebGL
        }
      }
    }
  },

  plugins: [
    react(), //[cite: 3]
    VitePWA({
      registerType: 'autoUpdate', //[cite: 3]
      devOptions: {
        enabled: true //[cite: 3]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon-96x96.png', 'maskable-icon.png'], //[cite: 3]
      manifest: {
        name: 'MeteoToni AI', //[cite: 3]
        short_name: 'MeteoToni', //[cite: 3]
        description: 'Previsió meteorològica intel·ligent amb models ECMWF i AROME.', //[cite: 3]
        theme_color: '#05060A', //[cite: 3]
        background_color: '#05060A', //[cite: 3]
        display: 'standalone', //[cite: 3]
        orientation: 'any', //[cite: 3]
        scope: '/meteoai/', //[cite: 3]
        start_url: '/meteoai/', //[cite: 3]
        icons: [
          {
            src: 'android-chrome-192x192.png', //[cite: 3]
            sizes: '192x192', //[cite: 3]
            type: 'image/png' //[cite: 3]
          },
          {
            src: 'android-chrome-512x512.png', //[cite: 3]
            sizes: '512x512', //[cite: 3]
            type: 'image/png' //[cite: 3]
          },
          {
             src: 'maskable-icon.png', //[cite: 3]
             sizes: '512x512', //[cite: 3]
             type: 'image/png', //[cite: 3]
             purpose: 'maskable' //[cite: 3]
          }
        ],
        screenshots: [
          {
            src: 'screenshot-mobile.png', //[cite: 3]
            sizes: '390x844', //[cite: 3]
            type: 'image/png', //[cite: 3]
            form_factor: 'narrow', //[cite: 3]
            label: 'Previsió al detall' //[cite: 3]
          },
          {
            src: 'screenshot-desktop.png', //[cite: 3]
            sizes: '1280x800', //[cite: 3]
            type: 'image/png', //[cite: 3]
            form_factor: 'wide', //[cite: 3]
            label: 'Panell de control' //[cite: 3]
          }
        ]
      }
    })
  ],

  test: {
    globals: true, //[cite: 3]
    environment: 'jsdom', //[cite: 3]
    setupFiles: './src/test/setup.ts', //[cite: 3]
  }
});