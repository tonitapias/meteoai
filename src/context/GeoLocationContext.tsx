import React, { createContext, useContext, useCallback } from 'react';
import * as Sentry from "@sentry/react";

// Actualitzem la interfície perquè ara també retorni el nom del lloc
interface GeoLocationContextType {
  getCoordinates: () => Promise<{ lat: number; lon: number; name: string }>;
}

const GeoLocationContext = createContext<GeoLocationContextType | undefined>(undefined);

export const GeoLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  const getCoordinates = useCallback((): Promise<{ lat: number; lon: number; name: string }> => {
    return new Promise(async (resolve, reject) => {
      
      if (!navigator.geolocation) {
        reject(new Error("GEOLOCATION_NOT_SUPPORTED"));
        return;
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
        // 1. Intentem Alta Precisió primer (més ràpid en mòbils moderns)
        let pos = await getPosition(true).catch(async (err) => {
            // Si fa timeout l'alta precisió, ho intentem amb baixa (fallback com al Header)
            if (err.code === 3) {
                console.warn("⚠️ GPS Timeout. Reintentant amb baixa precisió...");
                return await getPosition(false);
            }
            throw err;
        });

        // 2. Traduïm les coordenades al nom del poble (còpia de Header.tsx)
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

        resolve({ lat: latitude, lon: longitude, name: finalName });

      } catch (err: any) {
         // Gestió d'errors globals
         console.warn("Error GPS (Context):", err.message);
         Sentry.captureException(new Error(`Geolocation Error: ${err.message}`), { 
            tags: { service: 'GeolocationContext' },
            extra: { code: err.code, message: err.message }
         });

         if (err.code === 1) reject(new Error("PERMISSION_DENIED"));
         else if (err.code === 3) reject(new Error("TIMEOUT"));
         else reject(new Error("POSITION_UNAVAILABLE"));
      }
    });
  }, []);

  return (
    <GeoLocationContext.Provider value={{ getCoordinates }}>
      {children}
    </GeoLocationContext.Provider>
  );
};

export const useGeoLocation = () => {
  const context = useContext(GeoLocationContext);
  if (!context) throw new Error('useGeoLocation ha de fer-se servir dins un GeoLocationProvider');
  return context;
};