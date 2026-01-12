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