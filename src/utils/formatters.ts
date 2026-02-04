// src/utils/formatters.ts
import { TRANSLATIONS, Language } from '../translations';
import { TranslationMap, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { safeNum } from './physics';

// Re-exportem tipus si cal, però preferim usar els importats
export type WeatherUnit = 'C' | 'F';

// --- FUNCIONS DE TEXT (Nova llar per getWeatherLabel) ---

/**
 * Obté l'etiqueta de text (Ex: "Pluja lleugera") per a un codi WMO
 * Mogut des de weatherLogic.ts per desacoblar física de traducció
 */
export const getWeatherLabel = (current: StrictCurrentWeather | undefined, language: Language): string => {
  const tr = (TRANSLATIONS[language] || TRANSLATIONS['ca']) as TranslationMap;
  if (!tr || !current) return "";
  const code = safeNum(current.weather_code, 0);
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

export const formatDate = (
  dateString: string | undefined, 
  lang: Language, 
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!dateString) return ""; 

  const locales: Record<Language, string> = { 
    ca: 'ca-ES', 
    es: 'es-ES', 
    en: 'en-US', 
    fr: 'fr-FR' 
  };
  
  try {
      const date = dateString.includes('T') 
        ? new Date(dateString) 
        : new Date(`${dateString}T00:00:00`);
        
      if (isNaN(date.getTime())) return ""; 

      return new Intl.DateTimeFormat(locales[lang], options).format(date);
  } catch {
      return "";
  }
};

export const formatTime = (dateString: string | undefined, lang: Language): string => {
  if (!dateString) return "--:--";

  const locales: Record<Language, string> = { 
    ca: 'ca-ES', 
    es: 'es-ES', 
    en: 'en-US', 
    fr: 'fr-FR' 
  };
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "--:--";

    return date.toLocaleTimeString(locales[lang], {
        hour: '2-digit', 
        minute: '2-digit'
    });
  } catch {
    return "--:--";
  }
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