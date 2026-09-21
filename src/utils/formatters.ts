// src/utils/formatters.ts
import { TRANSLATIONS, Language } from '../translations';
import { TranslationMap, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { safeNum } from './weatherMath';
import { isMostlyCloudy } from './rules/cloudRules';

// Re-exportem tipus si cal, però preferim usar els importats
export type WeatherUnit = 'C' | 'F';

// --- FUNCIONS DE TEXT (Nova llar per getWeatherLabel) ---

/**
 * Obté l'etiqueta de text (Ex: "Pluja lleugera") per a un codi WMO
 * Mogut des de weatherLogic.ts per desacoblar física de traducció
 */
export const getWeatherLabel = (
  current: StrictCurrentWeather | undefined,
  language: Language,
  cloudCover?: number | null
): string => {
  const tr = (TRANSLATIONS[language] || TRANSLATIONS['ca']) as TranslationMap;
  if (!tr || !current) return "";
  const code = safeNum(current.weather_code, 0);
  // Mateixa variant que la icona (Cloudy): dins del codi 2, a partir de CLOUDS.MOSTLY_CLOUDY.
  if (isMostlyCloudy(code, cloudCover) && tr.wmoMostlyCloudy) return tr.wmoMostlyCloudy;
  return tr.wmo[code] || "---";
};

// --- FORMATADORS NUMÈRICS I DE DATA ---

export const formatTemp = (tempC: number | null | undefined, unit: WeatherUnit): number | null => {
  if (tempC === null || tempC === undefined) return null; 
  
  if (unit === 'F') return Math.round((tempC * 9/5) + 32);
  return Math.round(tempC);
};

export const getUnitLabel = (unit: WeatherUnit): string => {
  return unit === 'F' ? '°F' : '°C';
};

// [NETEJA] Abans hi havia 3 còpies locals idèntiques d'aquesta mateixa taula
// (ForecastSection.tsx, DayDetailModal.tsx, i el mapa inline aquí sota).
export const getSafeLocale = (lang: Language): string => {
  switch (lang) {
    case 'es': return 'es-ES';
    case 'fr': return 'fr-FR';
    case 'en': return 'en-US';
    case 'ca':
    default: return 'ca-ES';
  }
};

export const formatDate = (
  dateString: string | undefined,
  lang: Language,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!dateString) return "";

  try {
      const date = dateString.includes('T')
        ? new Date(dateString)
        : new Date(`${dateString}T00:00:00`);

      if (isNaN(date.getTime())) return "";

      return new Intl.DateTimeFormat(getSafeLocale(lang), options).format(date);
  } catch {
      return "";
  }
};

export const formatTime = (dateString: string | undefined, lang: Language): string => {
  if (!dateString) return "--:--";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "--:--";

    return date.toLocaleTimeString(getSafeLocale(lang), {
        hour: '2-digit',
        minute: '2-digit'
    });
  } catch {
    return "--:--";
  }
};

/** Durada en hores i minuts ("12h 10m") a partir de segons, o "--" si no hi ha dada (mai un "0h 00m" inventat). */
export const formatHoursMinutes = (totalSeconds: number | null | undefined): string => {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) return '--';
  const totalMin = Math.round(totalSeconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

export const formatPrecipitation = (precipitationTotal: number | null, snowfall: number | null): string => {
  const safePrecip = precipitationTotal ?? 0;
  const safeSnow = snowfall ?? 0;

  if (safeSnow >= 0.2) {
    return safeSnow < 1 
      ? `${safeSnow.toFixed(1)} cm` 
      : `${Math.round(safeSnow)} cm`;
  }
  
  if (safePrecip < 1 && safePrecip > 0) {
    return `${safePrecip.toFixed(1)} mm`;
  }
  return `${Math.round(safePrecip)} mm`;
};