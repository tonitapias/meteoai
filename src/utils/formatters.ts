// src/utils/formatters.ts

// Definim tipus per a major seguretat (Constants/Utils)
export type WeatherUnit = 'C' | 'F';
export type Language = 'ca' | 'es' | 'en' | 'fr';

export const formatTemp = (tempC: number, unit: WeatherUnit): number => {
  if (unit === 'F') return Math.round((tempC * 9/5) + 32);
  return Math.round(tempC);
};

export const getUnitLabel = (unit: WeatherUnit): string => {
  return unit === 'F' ? '°F' : '°C';
};

export const formatDate = (
  dateString: string, 
  lang: Language, 
  options?: Intl.DateTimeFormatOptions
): string => {
  const locales: Record<Language, string> = { 
    ca: 'ca-ES', 
    es: 'es-ES', 
    en: 'en-US', 
    fr: 'fr-FR' 
  };
  
  // Mantenim la lògica original de detecció de dates
  const date = dateString.includes('T') 
    ? new Date(dateString) 
    : new Date(`${dateString}T00:00:00`);
    
  return new Intl.DateTimeFormat(locales[lang], options).format(date);
};

export const formatTime = (dateString: string, lang: Language): string => {
  const locales: Record<Language, string> = { 
    ca: 'ca-ES', 
    es: 'es-ES', 
    en: 'en-US', 
    fr: 'fr-FR' 
  };
  return new Date(dateString).toLocaleTimeString(locales[lang], {
    hour: '2-digit', 
    minute: '2-digit'
  });
};

/**
 * Formata la precipitació triant intel·ligentment entre mm (pluja) o cm (neu).
 * @param precipitationTotal - Total de precipitació (equivalent aigua mm)
 * @param snowfall - Total de neu (cm)
 * @returns String formatat (ex: "15 mm" o "5 cm")
 */
export const formatPrecipitation = (precipitationTotal: number, snowfall: number): string => {
  // Si hi ha neu acumulada significativa (> 0.2 cm), mostrem la neu
  if (snowfall && snowfall >= 0.2) {
    // Si és menys d'1 cm, mostrem decimals, sinó enter arrodonit
    return snowfall < 1 
      ? `${snowfall.toFixed(1)} cm` 
      : `${Math.round(snowfall)} cm`;
  }
  
  // Si no és neu, és pluja (mm)
  if (precipitationTotal < 1 && precipitationTotal > 0) {
    return `${precipitationTotal.toFixed(1)} mm`;
  }
  return `${Math.round(precipitationTotal)} mm`;
};