// src/hooks/useWeatherQuery.ts
import { getWeatherData, getAirQualityData, WeatherData } from '../services/weatherApi';
import { reverseGeocode, GeocodeResult } from '../services/geocodingService';
import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';
// IMPORTACIÓ ACTUALITZADA: Importem el tipus estricte
import { AirQualityData } from '../types/weather';

// Definim què retornarà aquesta funció exactament
export interface FetchResult {
  weatherRaw: WeatherData;
  geoData: GeocodeResult;
  // UPDATED: Tipat estricte aquí també
  aqiData: AirQualityData;
}

/**
 * Orquestrador de peticions de xarxa.
 * Centralitza la lògica de demanar dades a Open-Meteo i Geocoding.
 */
export const fetchAllWeatherData = async (
  lat: number, 
  lon: number, 
  unit: WeatherUnit,
  lang: Language,
  locationName?: string,
  country?: string
): Promise<FetchResult> => {
  
  // 1. Iniciem les peticions en paral·lel
  const weatherPromise = getWeatherData(lat, lon, unit);
  const aqiPromise = getAirQualityData(lat, lon);
  
  // 2. Lògica condicional per al nom de la ubicació
  // Si és "La Meva Ubicació" (GPS), fem geocoding invers. Si no, usem el text proporcionat.
  const namePromise: Promise<GeocodeResult> = (locationName === "La Meva Ubicació") 
    ? reverseGeocode(lat, lon, lang)
    : Promise.resolve({ city: locationName || "Ubicació actual", country: country || "Local" });

  // 3. Esperem totes les respostes (Tipat segur gràcies al Pas 1)
  const [weatherRaw, geoData, aqiData] = await Promise.all<[
    Promise<WeatherData>,
    Promise<GeocodeResult>,
    // UPDATED: Promesa tipada correctament
    Promise<AirQualityData>
  ]>([weatherPromise, namePromise, aqiPromise]);

  return { weatherRaw, geoData, aqiData };
};