// src/services/weatherService.ts
import * as Sentry from "@sentry/react";
import { getWeatherData, getAirQualityData } from './weatherApi';
import { reverseGeocode, type GeocodeResult } from './geocodingService';
import type { Language } from '../translations';
import type { WeatherUnit } from '../utils/formatters';
import type { AirQualityData, WeatherData } from '../types/weather';
import { SENTRY_TAGS } from '../constants/errorConstants';

// Definim la interfície de resposta (Idèntica a l'anterior)
export interface FetchResult {
  weatherRaw: WeatherData;
  geoData: GeocodeResult;
  // null si l'API de qualitat de l'aire ha fallat: és un servidor a part i un giny secundari.
  aqiData: AirQualityData | null;
}

/**
 * Servei d'Orquestració de Dades Meteorològiques.
 * Centralitza la lògica de demanar dades a Open-Meteo, Qualitat de l'Aire i Geocoding en paral·lel.
 */
export const fetchAllWeatherData = async (
  lat: number, 
  lon: number, 
  unit: WeatherUnit,
  lang: Language,
  locationName?: string,
  country?: string
): Promise<FetchResult> => {
  
  try {
      // 1. Iniciem les peticions en paral·lel per màxima velocitat (Non-blocking)
      const weatherPromise = getWeatherData(lat, lon, unit);
      // La qualitat de l'aire ve d'un altre servidor d'Open-Meteo (air-quality-api): si falla, abans feia caure tot el
      // Promise.all i l'usuari es quedava sense previsió per un giny secundari. Ara es mostra la previsió sense aquest
      // giny (que ja sap pintar "sense dades"). L'error ja el reporta fetchWithRetry a Sentry.
      const aqiPromise: Promise<AirQualityData | null> = getAirQualityData(lat, lon).catch(() => null);
      
      // 2. Lògica condicional per al nom de la ubicació
      // Si és "La Meva Ubicació" (GPS), fem geocoding invers. Si no, usem el text proporcionat.
      const namePromise: Promise<GeocodeResult> = (locationName === "La Meva Ubicació" || !locationName) 
        ? reverseGeocode(lat, lon, lang)
        : Promise.resolve({ city: locationName || "Ubicació actual", country: country || "Local" });

      // 3. Esperem que tot acabi (Promise.all)
      const [weatherRaw, geoData, aqiData] = await Promise.all([
        weatherPromise,
        namePromise,
        aqiPromise
      ]);

      return { weatherRaw, geoData, aqiData };

  } catch (error) {
      // 4. Captura d'errors centralitzada al servei
      Sentry.captureException(error, {
        tags: { 
            service: SENTRY_TAGS.SERVICE_WEATHER_API,
            action: 'fetchAllWeatherData'
        },
        extra: { lat, lon, unit, lang }
      });
      
      // Re-llancem l'error perquè el Repositori el gestioni i notifiqui a la UI
      throw error;
  }
};