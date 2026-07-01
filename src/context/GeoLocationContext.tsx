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

        // Traduïm les coordenades al nom del poble
        const { latitude, longitude } = pos.coords;
        let finalName = "Ubicació detectada";

        try {
            const resp = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ca`
            );
            if (resp.ok) {
                const data = await resp.json();
                finalName = data.locality || data.city || data.town || data.village || "La Meva Ubicació";
            }
        } catch (e) {
            console.warn("No s'ha pogut traduir el nom de la ciutat", e);
        }

        return { lat: latitude, lon: longitude, name: finalName }; // Substituïm resolve per return

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