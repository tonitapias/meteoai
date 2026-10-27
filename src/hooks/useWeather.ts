// src/hooks/useWeather.ts
import { useState, useRef, useCallback } from 'react';
import * as Sentry from "@sentry/react"; 
import type { ExtendedWeatherData } from '../types/weatherLogicTypes'; // [FIX] Import correcte
import type { AirQualityData } from '../types/weather';
import { useRegionalModelWorker } from './useRegionalModelWorker';
import { WeatherUnit } from '../utils/formatters';
import { Language, TRANSLATIONS } from '../translations';
import { WeatherRepository } from '../repositories/WeatherRepository';
import { SENTRY_TAGS, FETCH_ERROR_TYPES } from '../constants/errorConstants';
import type { LoadedPlace, PlaceOrigin } from '../utils/placeLink';

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
  // El lloc de `weatherData` tal com s'ha demanat: coordenades exactes (les del GPS, no les d'una previsió desada d'un
  // altre punt ni les d'un paquet de la cau) i si és la posició de l'usuari o un lloc consultat. Per a l'enllaç i per
  // compartir (vegeu placeForLink); canvia sempre juntament amb `weatherData`.
  const [loadedPlace, setLoadedPlace] = useState<LoadedPlace | null>(null);

  // Mantenim el hook del worker aquí per respectar el cicle de vida de React
  const { runRegionalModelWorker } = useRegionalModelWorker();

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ca'];

  // Ref per evitar duplicitat de crides (Debounce/Throttle manual)
  const lastFetchRef = useRef<{ lat: number; lon: number; unit: WeatherUnit; origin: PlaceOrigin; time: number } | null>(null);

  // [FIX PRECISIÓ] Ref d'"últim guanyador": si l'usuari canvia d'ubicació abans
  // que respongui la petició anterior (més lenta, o amb reintents), i aquesta
  // arriba després que la de la ubicació nova, aplicar-la en silenci mostraria
  // el temps de la ciutat vella sota el nom de la nova. Cada crida es numera;
  // només s'aplica el resultat si encara és la petició més recent en arribar.
  const requestIdRef = useRef(0);

  // Última ubicació carregada amb ÈXIT i quan (per tornar-la a demanar quan les
  // dades envelleixen — vegeu useRefreshOnResume). Una càrrega explícita la posa
  // a null en començar i només es reomple si acaba bé: mentre hi ha una petició
  // en curs, o si ha fallat, no hi ha res "carregat" que refrescar (i un refresc
  // en segon pla no pot trepitjar el requestId d'una càrrega de l'usuari).
  const loadedRef = useRef<{ lat: number; lon: number; name: string; country?: string; origin: PlaceOrigin; at: number } | null>(null);

  // [FIX] Embolcallat en useCallback: sense això, cada render d'aquest hook
  // (p. ex. cada tick de rellotge de 60s que passa per useAppController)
  // generava una nova referència de funció, que es propagava a
  // useAppActions.handleGetCurrentLocation (que la té com a dependència) i
  // d'allà a tot el que consumeix el context — trencant qualsevol intent de
  // memoització aigües avall encara que res rellevant hagués canviat.
  //
  // `silent` = refresc en segon pla d'una ubicació ja a pantalla: no posa
  // `loading` (parpellejaria el capçal) i, si falla, no posa `error`, perquè
  // DashboardContent pinta l'ErrorBanner EN LLOC del panell i una caiguda de
  // xarxa passatgera esborraria una previsió perfectament vàlida.
  const loadWeather = useCallback(async (lat: number, lon: number, locationName: string, country: string | undefined, origin: PlaceOrigin, silent: boolean): Promise<WeatherFetchResult> => {
    const now = Date.now();

    // Evitem crides repetides en menys de 3 segons (amb l'origen: el mateix punt triat amb el GPS just després de
    // cercar-lo ha de passar a ser "la meva posició")
    if (lastFetchRef.current &&
        lastFetchRef.current.lat === lat &&
        lastFetchRef.current.lon === lon &&
        lastFetchRef.current.unit === unit &&
        lastFetchRef.current.origin === origin &&
        (now - lastFetchRef.current.time) < 3000) {
        return { success: true };
    }

    const requestId = ++requestIdRef.current;
    const isStale = () => requestIdRef.current !== requestId;

    if (!silent) {
      loadedRef.current = null;
      setLoading(true);
      setError(null);
    }
    lastFetchRef.current = { lat, lon, unit, origin, time: now };

    // Amb una previsió desada a la pantalla (`offlineSnapshot`), "carregada" vol dir quan es va desar: així
    // useRefreshOnResume la torna a demanar en tornar la connexió, en tornar a l'app i amb el seu comprovador.
    const applyResponse = (response: { data: ExtendedWeatherData; aqi: AirQualityData | null }) => {
      setWeatherData(response.data);
      setAqiData(response.aqi);
      setLoadedPlace({ lat, lon, name: locationName, country, origin });
      loadedRef.current = { lat, lon, name: locationName, country, origin, at: response.data.offlineSnapshot?.savedAt ?? Date.now() };
    };

    try {
      const response = await WeatherRepository.get(
          lat,
          lon,
          unit,
          lang,
          locationName,
          country,
          runRegionalModelWorker,
          {
            // La petició tardava massa i s'ha mostrat la previsió desada: quan arriba la nova, la substitueix (si
            // l'usuari no ha demanat res més mentrestant).
            onLateResult: (late) => {
              if (!isStale()) applyResponse(late);
            }
          }
      );

      // Una petició més nova ja ha començat: descartem aquest resultat obsolet
      // en lloc de sobreescriure la pantalla amb dades d'una ubicació antiga.
      if (isStale()) return { success: true };

      applyResponse(response);

      return { success: true };

    } catch (err: unknown) {
      if (isStale()) return { success: true };

      const errorMessage = err instanceof Error ? err.message : String(err);

      // Un refresc en segon pla sense connexió és esperable (el desvetlla de la
      // xarxa en tornar del segon pla no és instantani; 'online' el reintenta):
      // no cal omplir Sentry amb això.
      const expectedOffline = silent && typeof navigator !== 'undefined' && navigator.onLine === false;
      if (!expectedOffline) {
        Sentry.captureException(err, {
            tags: { service: SENTRY_TAGS.SERVICE_WEATHER_API },
            extra: { lat, lon, unit }
        });
      }

      if (!silent) setError(t.fetchError || "Error obtenint dades");

      return {
          success: false,
          error: errorMessage,
          type: FETCH_ERROR_TYPES.NETWORK
      };
    } finally {
      if (!silent && !isStale()) setLoading(false);
    }
  }, [lang, unit, t, runRegionalModelWorker]);

  // `origin`: 'gps' només des dels botons de localitzar; cercador, favorits i enllaços són llocs consultats.
  const fetchWeatherByCoords = useCallback(
    (lat: number, lon: number, locationName: string, country?: string, origin: PlaceOrigin = 'consulted'): Promise<WeatherFetchResult> =>
      loadWeather(lat, lon, locationName, country, origin, false),
    [loadWeather]
  );

  // Refresc silenciós de la ubicació carregada amb les mateixes coordenades,
  // nom, país i origen. No fa res si no n'hi ha cap (vegeu loadedRef).
  const refreshLoadedLocation = useCallback(async (): Promise<WeatherFetchResult | null> => {
    const loaded = loadedRef.current;
    if (!loaded) return null;
    return loadWeather(loaded.lat, loaded.lon, loaded.name, loaded.country, loaded.origin, true);
  }, [loadWeather]);

  const getLastLoadedAt = useCallback(() => loadedRef.current?.at ?? null, []);

  // Tornar a la benvinguda (botó Inici del tauler): es buida la pantalla i es desfà tot el que hi podria tornar a
  // carregar el lloc: la petició en curs i el resultat tardà d'una previsió desada (requestIdRef), el refresc en segon
  // pla (loadedRef) i l'antirrebot de 3 s (triar el mateix lloc just després l'ha de carregar de nou).
  const clearWeather = useCallback(() => {
    requestIdRef.current++;
    loadedRef.current = null;
    lastFetchRef.current = null;
    setWeatherData(null);
    setAqiData(null);
    setLoadedPlace(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    weatherData,
    loadedPlace,
    aqiData,
    loading,
    error,
    fetchWeatherByCoords,
    refreshLoadedLocation,
    getLastLoadedAt,
    clearWeather
  };
}