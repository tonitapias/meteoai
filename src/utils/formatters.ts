// src/utils/formatters.ts

// Definim tipus per a major seguretat (Constants/Utils)
export type WeatherUnit = 'C' | 'F';
export type Language = 'ca' | 'es' | 'en' | 'fr';

// MILLORA DE SEGURETAT: Acceptem number | null | undefined
export const formatTemp = (tempC: number | null | undefined, unit: WeatherUnit): number | null => {
  if (tempC === null || tempC === undefined) return null; // Retornem null per indicar "sense dades"
  
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
  if (!dateString) return ""; // Protecció contra dates buides

  const locales: Record<Language, string> = { 
    ca: 'ca-ES', 
    es: 'es-ES', 
    en: 'en-US', 
    fr: 'fr-FR' 
  };
  
  try {
      // Mantenim la lògica original de detecció de dates
      const date = dateString.includes('T') 
        ? new Date(dateString) 
        : new Date(`${dateString}T00:00:00`);
        
      if (isNaN(date.getTime())) return ""; // Protecció contra dates invàlides

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

/**
 * Formata la precipitació triant intel·ligentment entre mm (pluja) o cm (neu).
 * @param precipitationTotal - Total de precipitació (equivalent aigua mm)
 * @param snowfall - Total de neu (cm)
 * @returns String formatat (ex: "15 mm" o "5 cm")
 */
export const formatPrecipitation = (precipitationTotal: number | null, snowfall: number | null): string => {
  // Gestió de nuls: Si no hi ha dades, assumim 0 per evitar "undefined mm"
  const safePrecip = precipitationTotal ?? 0;
  const safeSnow = snowfall ?? 0;

  // Si hi ha neu acumulada significativa (> 0.2 cm), mostrem la neu
  if (safeSnow >= 0.2) {
    // Si és menys d'1 cm, mostrem decimals, sinó enter arrodonit
    return safeSnow < 1 
      ? `${safeSnow.toFixed(1)} cm` 
      : `${Math.round(safeSnow)} cm`;
  }
  
  // Si no és neu, és pluja (mm)
  if (safePrecip < 1 && safePrecip > 0) {
    return `${safePrecip.toFixed(1)} mm`;
  }
  return `${Math.round(safePrecip)} mm`;
};