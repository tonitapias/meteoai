// src/hooks/controllers/useDataController.ts
import { useWeather } from '../useWeather';
import { useWeatherCalculations } from '../useWeatherCalculations';
import { useWeatherTheme } from '../useWeatherTheme';
import { useWeatherAI } from '../useWeatherAI';
import { useRefreshOnResume } from '../useRefreshOnResume';
import { useLightningNearby } from '../useLightningNearby';
import { useGeoLocation } from '../../context/GeoLocationContext';
import { selectRegionalModel } from '../../constants/regionalModels';
import type { Language } from '../../translations';
import type { WeatherUnit } from '../../utils/formatters';
import type { LocationMeta } from '../../types/weatherLogicTypes';

interface DataControllerProps {
  lang: Language;
  unit: WeatherUnit;
  now: Date;
}

export function useDataController({ lang, unit, now }: DataControllerProps) {
  // 1. Obtenció de Dades Pures
  const { weatherData, loadedPlace, aqiData, loading, error, fetchWeatherByCoords, refreshLoadedLocation, getLastLoadedAt } = useWeather(lang, unit);
  const { getCoordinates } = useGeoLocation();

  // Sense això la previsió només es carregava en canviar d'ubicació i, amb l'app
  // oberta hores, la finestra de 24 h no avançava mai.
  useRefreshOnResume({ getLastLoadedAt, refresh: refreshLoadedLocation });

  // 2. Física i Matemàtiques (Calculations)
  // Necessiten 'now' per saber la posició del sol
  const calculations = useWeatherCalculations(weatherData, unit, now);

  // 3. Estètica basada en Dades (Theme)
  const theme = useWeatherTheme(weatherData, calculations.effectiveWeatherCode);

  // Forcem el tipatge de location per corregir la pèrdua d'inferència del compilador
  const loc = weatherData?.location as LocationMeta | undefined;

  // 4. Llamps observats a prop (Meteosat-12): avís del tauler i telemetria de la IA.
  const { lightning, settled: lightningSettled } = useLightningNearby(loc?.latitude, loc?.longitude);

  // 5. Intel·ligència (AI)
  const { aiAnalysis } = useWeatherAI(weatherData, aqiData, lang, unit, calculations.reliability, calculations.effectiveWeatherCode, calculations.effectiveCloudCover, lightning, lightningSettled);

  // Fusionem Theme dins de Calculations (com es feia abans) per consistència
  const calculationsWithTheme = {
    ...calculations,
    currentBg: theme.currentBg
  };

  const activeRegionalModel = loc
    ? selectRegionalModel(loc.latitude, loc.longitude)
    : null;

  return {
    state: {
      weatherData,
      loadedPlace,
      aqiData,
      loading,
      error,
      calculations: calculationsWithTheme,
      aiAnalysis,
      lightning
    },
    actions: {
      fetchWeatherByCoords,
      // Torna a demanar la ubicació carregada sense esquelet de càrrega (botó "Reintenta" de la previsió desada).
      refreshLoadedLocation,
      getCoordinates
    },
    flags: {
      activeRegionalModel
    }
  };
}