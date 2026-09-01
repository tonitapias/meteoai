// src/hooks/useWeather.ts
import { useState, useRef } from 'react'; // <-- FIX: Eliminat useEffect
import * as Sentry from "@sentry/react"; 
import type { ExtendedWeatherData } from '../types/weatherLogicTypes'; // [FIX] Import correcte
import type { AirQualityData } from '../types/weather';
import { useAromeWorker } from './useAromeWorker'; 
import { WeatherUnit } from '../utils/formatters';
import { Language, TRANSLATIONS } from '../translations';
import { WeatherRepository } from '../repositories/WeatherRepository';
import { SENTRY_TAGS, FETCH_ERROR_TYPES } from '../constants/errorConstants';

export type WeatherFetchResult = 
    | { success: true }
    | { 
        success: false; 
        error: string; 
        type: typeof FETCH_ERROR_TYPES[keyof typeof FETCH_ERROR_TYPES] 
      };

export function useWeather(lang: Language, unit: WeatherUnit) {
  const [weatherData, setWeatherData] = useState<ExtendedWeatherData | null>(null);
  const [aqiData, setAqiData] = useState<AirQualityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mantenim el hook del worker aquí per respectar el cicle de vida de React
  const { runAromeWorker } = useAromeWorker();

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  // Ref per evitar duplicitat de crides (Debounce/Throttle manual)
  const lastFetchRef = useRef<{ lat: number; lon: number; unit: WeatherUnit; time: number } | null>(null);

  // [FIX PRECISIÓ] Ref d'"últim guanyador": si l'usuari canvia d'ubicació abans
  // que respongui la petició anterior (més lenta, o amb reintents), i aquesta
  // arriba després que la de la ubicació nova, aplicar-la en silenci mostraria
  // el temps de la ciutat vella sota el nom de la nova. Cada crida es numera;
  // només s'aplica el resultat si encara és la petició més recent en arribar.
  const requestIdRef = useRef(0);

  const fetchWeatherByCoords = async (lat: number, lon: number, locationName: string, country?: string): Promise<WeatherFetchResult> => {
    const now = Date.now();

    // Evitem crides repetides en menys de 3 segons
    if (lastFetchRef.current &&
        lastFetchRef.current.lat === lat &&
        lastFetchRef.current.lon === lon &&
        lastFetchRef.current.unit === unit &&
        (now - lastFetchRef.current.time) < 3000) {
        return { success: true };
    }

    const requestId = ++requestIdRef.current;
    const isStale = () => requestIdRef.current !== requestId;

    setLoading(true);
    setError(null);
    lastFetchRef.current = { lat, lon, unit, time: now };

    try {
      const response = await WeatherRepository.get(
          lat,
          lon,
          unit,
          lang,
          locationName,
          country,
          runAromeWorker
      );

      // Una petició més nova ja ha començat: descartem aquest resultat obsolet
      // en lloc de sobreescriure la pantalla amb dades d'una ubicació antiga.
      if (isStale()) return { success: true };

      setWeatherData(response.data);
      setAqiData(response.aqi);

      return { success: true };

    } catch (err: unknown) {
      if (isStale()) return { success: true };

      const errorMessage = err instanceof Error ? err.message : String(err);

      Sentry.captureException(err, {
          tags: { service: SENTRY_TAGS.SERVICE_WEATHER_API },
          extra: { lat, lon, unit }
      });

      setError(t.fetchError || "Error obtenint dades");

      return {
          success: false,
          error: errorMessage,
          type: FETCH_ERROR_TYPES.NETWORK
      };
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  return {
    weatherData,
    aqiData,
    loading,
    error,
    fetchWeatherByCoords
  };
}