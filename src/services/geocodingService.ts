// src/services/geocodingService.ts
import { Language } from '../translations';

export interface GeocodeResult {
  city: string;
  country: string;
}

/**
 * Servei de geocodificació inversa. 
 * Manté el timeout de 2s i la lògica de fallback de l'app original per seguretat.
 */
export const reverseGeocode = async (
  lat: number,
  lon: number,
  lang: Language = 'ca'
): Promise<GeocodeResult> => {
  const TIMEOUT_MS = 2000;
  // Fallback per defecte en cas d'error crític
  const FALLBACK: GeocodeResult = { city: "Ubicació actual", country: "Local" };

  try {
    const response = await Promise.race([
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`),
      new Promise<Response>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      )
    ]);

    if (!response || !response.ok) throw new Error('API Error');

    const data = await response.json();
    
    // Normalització de dades per evitar 'undefined'
    return {
      city: data.city || data.locality || data.principalSubdivision || "Ubicació desconeguda",
      country: data.countryName || "Local"
    };
  } catch (error) {
    console.warn("Geocoding error, usant fallback:", error);
    return FALLBACK;
  }
};