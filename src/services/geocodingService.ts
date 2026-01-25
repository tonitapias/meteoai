// src/services/geocodingService.ts
import { Language } from '../translations';

export interface GeocodeResult {
  city: string;
  country: string;
}

// CONFIGURACIÓ: Constants globals provinents de l'entorn
const GEO_API_URL = import.meta.env.VITE_API_GEOCODING || "https://api.bigdatacloud.net/data/reverse-geocode-client";
// Timeout de seguretat (si no està definit al .env, usa 2 segons)
const GEO_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT) ? 2000 : 2000; 
// Nota: Deixo 2000ms específic per geocoding perquè ha de ser ràpid, 
// o pots fer servir 'Number(import.meta.env.VITE_API_TIMEOUT)' si vols els 10s globals.

/**
 * Servei de geocodificació inversa. 
 */
export const reverseGeocode = async (
  lat: number,
  lon: number,
  lang: Language = 'ca'
): Promise<GeocodeResult> => {
  
  const FALLBACK: GeocodeResult = { city: "Ubicació actual", country: "Local" };

  try {
    const response = await Promise.race([
      fetch(`${GEO_API_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), GEO_TIMEOUT_MS)
      )
    ]);

    if (!response || !response.ok) throw new Error('API Error');

    const data = await response.json();
    
    // Normalització de dades
    return {
      city: data.city || data.locality || data.principalSubdivision || "Ubicació desconeguda",
      country: data.countryName || "Local"
    };
  } catch (error) {
    console.warn("Geocoding error, usant fallback:", error);
    return FALLBACK;
  }
};