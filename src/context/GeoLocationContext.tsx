import React, { createContext, useContext, useCallback } from 'react';
import * as Sentry from "@sentry/react";

interface GeoLocationContextType {
  getCoordinates: () => Promise<{ lat: number; lon: number; name: string }>;
}

const GeoLocationContext = createContext<GeoLocationContextType | undefined>(undefined);

export const GeoLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  // 1. Convertim la funció directament a async, eliminant el "new Promise" manual
  const getCoordinates = useCallback(async (): Promise<{ lat: number; lon: number; name: string }> => {
      
      if (!navigator.geolocation) {
        throw new Error("GEOLOCATION_NOT_SUPPORTED"); // Substituïm reject per throw
      }

      // Funció interna per intentar aconseguir la posició (còpia de Header.tsx)
      const getPosition = (highAccuracy: boolean): Promise<GeolocationPosition> => {
        return new Promise((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, {
                enableHighAccuracy: highAccuracy,
                timeout: highAccuracy ? 5000 : 15000, // 5s alta, 15s baixa
                maximumAge: 60000 
            });
        });
      };

      try {
        // 2. Intentem Alta Precisió primer (canviem let per const)
        const pos = await getPosition(true).catch(async (err) => {
            // Si fa timeout l'alta precisió, ho intentem amb baixa (fallback com al Header)
            if (err.code === 3) {
                console.warn("⚠️ GPS Timeout. Reintentant amb baixa precisió...");
                return await getPosition(false);
            }
            throw err;
        });

        // [FIX PRECISIÓ] Abans es traduïen aquí mateix les coordenades a un nom de
        // poble amb una crida pròpia i `localityLanguage=ca` fixat, ignorant
        // l'idioma real de l'app. En lloc de duplicar-ho, retornem el sentinel
        // "La Meva Ubicació": fetchAllWeatherData (weatherService.ts) ja detecta
        // aquest valor i fa la seva pròpia geocodificació inversa amb `reverseGeocode`
        // passant l'idioma correcte i retornant també el país (que aquí no
        // s'arribava mai a proporcionar).
        const { latitude, longitude } = pos.coords;
        return { lat: latitude, lon: longitude, name: "La Meva Ubicació" };

      } catch (err: unknown) {
         // 3. Eliminem l'ús de "any" aplicant Type Narrowing estricte
         const isGeoError = err !== null && typeof err === 'object' && 'code' in err;
         const code = isGeoError ? (err as GeolocationPositionError).code : 0;
         const message = err instanceof Error ? err.message : String(err);

         console.warn("Error GPS (Context):", message);
         Sentry.captureException(new Error(`Geolocation Error: ${message}`), { 
            tags: { service: 'GeolocationContext' },
            extra: { code, message }
         });

         if (code === 1) throw new Error("PERMISSION_DENIED");
         else if (code === 3) throw new Error("TIMEOUT");
         else throw new Error("POSITION_UNAVAILABLE");
      }
  }, []);

  return (
    <GeoLocationContext.Provider value={{ getCoordinates }}>
      {children}
    </GeoLocationContext.Provider>
  );
};

// 4. Silenciem exclusivament aquí el linter perquè el Fast Refresh de Vite 
// permeti exportar aquest hook sense donar el "Warning".
// eslint-disable-next-line react-refresh/only-export-components
export const useGeoLocation = () => {
  const context = useContext(GeoLocationContext);
  if (!context) throw new Error('useGeoLocation ha de fer-se servir dins un GeoLocationProvider');
  return context;
};