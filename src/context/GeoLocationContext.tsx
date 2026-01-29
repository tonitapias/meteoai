import React, { createContext, useContext, useCallback } from 'react';
import * as Sentry from "@sentry/react";

// Definim què retornarà aquest context (només la funció de coordenades)
interface GeoLocationContextType {
  getCoordinates: () => Promise<{ lat: number; lon: number }>;
}

const GeoLocationContext = createContext<GeoLocationContextType | undefined>(undefined);

export const GeoLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  // Aquesta funció converteix la callback antiga de GPS en una Promesa moderna
  // Això permetrà fer servir "await" a l'App.tsx i netejar molt el codi.
  const getCoordinates = useCallback((): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      
      // 1. Comprovació de suport del navegador
      if (!navigator.geolocation) {
        reject(new Error("GEOLOCATION_NOT_SUPPORTED"));
        return;
      }

      // 2. Configuració robusta (Igual que tenies a l'App, per mantenir fiabilitat)
      const geoOptions = { 
        enableHighAccuracy: false, // Estalvi de bateria i més ràpid
        timeout: 15000,            // 15 segons (prou temps per mòbils lents)
        maximumAge: 300000         // 5 minuts de cache (per no forçar el xip GPS)
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // ÈXIT: Retornem les dades netes
          resolve({ 
            lat: pos.coords.latitude, 
            lon: pos.coords.longitude 
          });
        },
        (err) => {
          // ERROR: Gestionem el log tècnic aquí (Sentry) per no embrutar la UI
          console.warn("Error GPS (Context):", err.message);

          // Capturem l'error a Sentry amb tot el detall tècnic
          Sentry.captureException(new Error(`Geolocation Error: ${err.message}`), { 
            tags: { service: 'GeolocationContext' },
            extra: { 
              code: err.code, // 1: Denegat, 2: No disponible, 3: Timeout
              message: err.message 
            }
          });

          // Retornem l'error perquè l'App decideixi quin missatge mostrar a l'usuari
          // Simplifiquem l'error per saber si és timeout o permís
          if (err.code === 1) reject(new Error("PERMISSION_DENIED"));
          else if (err.code === 3) reject(new Error("TIMEOUT"));
          else reject(new Error("POSITION_UNAVAILABLE"));
        },
        geoOptions
      );
    });
  }, []);

  return (
    <GeoLocationContext.Provider value={{ getCoordinates }}>
      {children}
    </GeoLocationContext.Provider>
  );
};

// Hook personalitzat per utilitzar-lo fàcilment
// eslint-disable-next-line react-refresh/only-export-components
export const useGeoLocation = () => {
  const context = useContext(GeoLocationContext);
  if (!context) {
    throw new Error('useGeoLocation ha de fer-se servir dins un GeoLocationProvider');
  }
  return context;
};