// src/hooks/useAromeWorker.ts
import { useCallback } from 'react';
import * as Sentry from "@sentry/react";
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import type { WeatherData } from '../types/weather'; // 1. NOU IMPORT

const AROME_TIMEOUT_MS = 4000; // 4 segons màxim per al càlcul físic

export function useAromeWorker() {
  // 2. CORRECCIÓ: 'highRes' ara accepta 'WeatherData' brut de l'API
  const runAromeWorker = useCallback((base: ExtendedWeatherData, highRes: WeatherData) => {
      return new Promise<ExtendedWeatherData>((resolve, reject) => {
          const startTime = performance.now();
          
          // 1. Monitoratge: Inici del Worker
          Sentry.addBreadcrumb({
              category: 'arome-worker',
              message: 'Starting AROME High-Res Calculation',
              level: 'info'
          });

          // Importem el worker dinàmicament
          const worker = new Worker(new URL('../workers/arome.worker.ts', import.meta.url), { type: 'module' });
          
          // 2. Kill Switch: Timeout de seguretat
          const timeoutId = setTimeout(() => {
              worker.terminate();
              const msg = `AROME Worker Timeout (${AROME_TIMEOUT_MS}ms) - Aborting`;
              console.warn(`⚠️ ${msg}`);
              
              Sentry.addBreadcrumb({
                  category: 'arome-worker',
                  message: 'Worker Timed Out - Fallback to Standard Model',
                  level: 'warning'
              });
              
              // No fem reject, sinó que resolem amb les dades base per no mostrar error a l'usuari
              // Simplement perdem l'alta resolució, però l'app funciona.
              resolve(base); 
          }, AROME_TIMEOUT_MS);

          worker.onmessage = (e) => {
              clearTimeout(timeoutId); // Cancelem el timeout si ha acabat a temps
              
              if (e.data.success) {
                  const duration = Math.round(performance.now() - startTime);
                  // Monitoratge: Èxit i rendiment
                  Sentry.addBreadcrumb({
                      category: 'arome-worker',
                      message: `Calculation Success in ${duration}ms`,
                      level: 'info'
                  });
                  resolve(e.data.data);
              } else {
                  // Si el worker falla, capturem l'error però no trenquem l'app
                  console.error("Worker Calculation Error:", e.data.error);
                  reject(new Error(e.data.error));
              }
              worker.terminate(); 
          };
          
          worker.onerror = (err) => {
              clearTimeout(timeoutId);
              console.error("Worker Critical Error:", err);
              reject(err);
              worker.terminate();
          };
          
          worker.postMessage({ baseData: base, highResData: highRes });
      });
  }, []);

  return { runAromeWorker };
}