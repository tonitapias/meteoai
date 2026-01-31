// src/types/global.d.ts

// Aquest fitxer estén les definicions de tipus globals de TypeScript
// sense necessitat d'importar-lo explícitament.

export {}; // Això converteix el fitxer en un mòdul

declare global {
    interface Performance {
        memory?: {
            /** Mida de la heap de JS usada en bytes (només Chrome/Chromium) */
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
        }
    }
}