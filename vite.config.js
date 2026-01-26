// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/meteoai/', 
  
  build: {
    sourcemap: true,
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Això permet que funcioni en local (npm run dev)
      devOptions: {
        enabled: true
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon-96x96.png', 'maskable-icon.png'],
      manifest: {
        name: 'MeteoToni AI',
        short_name: 'MeteoToni',
        description: 'Previsió meteorològica intel·ligent amb models ECMWF i AROME.',
        theme_color: '#05060A',
        background_color: '#05060A',
        display: 'standalone',
        orientation: 'any',
        scope: '/meteoai/',
        start_url: '/meteoai/',
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
             src: 'maskable-icon.png',
             sizes: '512x512',
             type: 'image/png',
             purpose: 'maskable' 
          }
        ],
        screenshots: [
          {
            src: 'screenshot-mobile.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Previsió al detall'
          },
          {
            src: 'screenshot-desktop.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Panell de control'
          }
        ]
      }
    })
  ],

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  }
});