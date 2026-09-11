// src/services/geocodingService.ts
import * as Sentry from "@sentry/react";
import { Language } from '../translations';
import { fetchWithTimeout } from '../utils/networkUtils';

// TIPUS EXPORTABLES (Per usar al Header)
export interface GeoSearchResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export interface GeocodeResult {
  city: string;
  country: string;
}

// CONFIGURACIÓ
const GEO_API_URL = import.meta.env.VITE_API_GEOCODING || "https://api.bigdatacloud.net/data/reverse-geocode-client";
const SEARCH_API_URL = "https://geocoding-api.open-meteo.com/v1/search";
const GEO_TIMEOUT_MS = 2000; 

/**
 * Servei de geocodificació inversa (Coords -> Nom Ciutat)
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
    
    // Normalització de dades amb Optional Chaining per seguretat extra
    return {
      city: data?.city || data?.locality || data?.principalSubdivision || "Ubicació desconeguda",
      country: data?.countryName || "Local"
    };
  } catch (error) {
    console.warn("Geocoding service unavailable (using fallback):", error);
    return FALLBACK;
  }
};

/**
 * Servei de cerca de ciutats (Text -> Llista Coords)
 */
export const searchCity = async (query: string): Promise<GeoSearchResult[]> => {
    try {
        // [FIX] Abans era l'única crida de xarxa de tota l'app sense timeout: si
        // l'API es penjava, la cerca de Header.tsx es quedava en isSearching=true
        // per sempre, sense error ni possibilitat de reintent.
        const response = await fetchWithTimeout(
          `${SEARCH_API_URL}?name=${encodeURIComponent(query)}&count=5&language=ca&format=json`,
          GEO_TIMEOUT_MS
        );

        if (!response.ok) throw new Error(`Geocoding Search Error: ${response.status}`);
        
        const data = await response.json();
        return data.results || [];

    } catch (error) {
        // Monitoratge d'errors centralitzat (excepte timeouts: com a alertsApi.ts,
        // un timeout de xarxa mentre l'usuari escriu és esperat, no un error a vigilar)
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        console.error("Geocoding Search Error:", error);
        if (!isTimeout) {
            Sentry.captureException(error, {
                tags: { service: 'GeocodingAPI', type: 'search_failed' },
                extra: { query }
            });
        }
        return []; // Retorn segur: array buit en lloc de petar
    }
};