// src/utils/formatters.ts
import { TRANSLATIONS, Language } from '../translations';
import { TranslationMap, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { safeNum } from './weatherMath';
import { isMostlyCloudy } from './rules/cloudRules';
import { precipKind } from './precipKind';

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

/**
 * Nombre amb decimals en el format de l'idioma: "18,3" en català, castellà i francès, "18.3" en anglès. Abans alguns ginys
 * feien toFixed() i deien "18.3°" al costat d'un "3,9°" d'un altre. `trimZero`: sense ",0" final ("2" i no "2,0").
 */
export const formatDecimal = (value: number, lang: Language | string, digits = 1, trimZero = false): string =>
  value.toLocaleString(getSafeLocale(lang as Language), {
    minimumFractionDigits: trimZero ? 0 : digits,
    maximumFractionDigits: digits,
    useGrouping: false
  });

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

/**
 * Una quantitat amb la seva unitat: un decimal per sota d'1 ("0,4 mm"; "0.4 mm" en anglès), enters a partir d'1 i
 * "<0,1" per a una traça que arrodonida seria 0,0.
 */
export const formatAmount = (value: number | null | undefined, unit: 'mm' | 'cm', lang: Language = 'ca'): string => {
  const v = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  if (v === 0) return `0 ${unit}`;
  if (v < 0.05) return `<${formatDecimal(0.1, lang)} ${unit}`;
  return v < 1 ? `${formatDecimal(v, lang)} ${unit}` : `${Math.round(v)} ${unit}`;
};

/**
 * Pluja en mm i neu en cm: la xifra és de neu (cm) si la neu és el que més cau, i de pluja (mm) si no (precipKind.ts).
 * `precipitationTotal` són els mm d'aigua de tot (neu inclosa) i `snowfall` els cm de neu.
 */
export const formatPrecipitation = (precipitationTotal: number | null, snowfall: number | null, lang: Language = 'ca'): string =>
  precipKind(precipitationTotal, snowfall) === 'snow'
    ? formatAmount(snowfall, 'cm', lang)
    : formatAmount(precipitationTotal, 'mm', lang);