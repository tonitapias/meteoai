// src/utils/uvIndexUtils.ts
// Categorització de l'índex UV, extreta de UVIndexWidget.tsx perquè un fitxer de component
// (.tsx) no hauria d'exportar constants/funcions no-component (trenca el Fast Refresh) i
// perquè SolarModal.tsx necessita reutilitzar exactament la mateixa font de veritat de colors
// i llindars de risc UV, no duplicar-la.
import { Language } from '../translations';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';

export interface UVCategory {
  label: Record<Language, string>;
  action: Record<Language, string>;
  color: string;
  glow: string;
}

// DOCTRINA RISC ZERO: Diccionari tàctic purificat
export const getUVCategory = (uv: number): UVCategory => {
  if (uv < 3) return {
    label: { ca: 'BAIX', es: 'BAJO', en: 'LOW', fr: 'FAIBLE' },
    action: { ca: 'SENSE RISC', es: 'SIN RIESGO', en: 'SAFE', fr: 'SANS RISQUE' },
    color: 'text-emerald-400', glow: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]'
  };
  if (uv < 6) return {
    label: { ca: 'MODERAT', es: 'MODERADO', en: 'MODERATE', fr: 'MODÉRÉ' },
    action: { ca: 'PROT. RECOMENADA', es: 'PROT. RECOMENDADA', en: 'PROTECTION REC.', fr: 'PROT. RECOMMANDÉE' },
    color: 'text-amber-400', glow: 'drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]'
  };
  if (uv < 8) return {
    label: { ca: 'ALT', es: 'ALTO', en: 'HIGH', fr: 'ÉLEVÉ' },
    action: { ca: 'PROT. OBLIGATÒRIA', es: 'PROT. OBLIGATORIA', en: 'PROTECTION REQ.', fr: 'PROT. OBLIGATOIRE' },
    color: 'text-orange-500', glow: 'drop-shadow-[0_0_12px_rgba(249,115,22,0.7)]'
  };
  if (uv < 11) return {
    label: { ca: 'MOLT ALT', es: 'M. ALTO', en: 'V. HIGH', fr: 'T. ÉLEVÉ' },
    action: { ca: 'EVITAR EXPOSICIÓ', es: 'EVITAR EXPOSICIÓN', en: 'AVOID EXPOSURE', fr: 'ÉVITER L\'EXPO.' },
    color: 'text-red-500', glow: 'drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]'
  };
  return {
    label: { ca: 'EXTREM', es: 'EXTREMO', en: 'EXTREME', fr: 'EXTRÊME' },
    action: { ca: 'RISC DE QUEMADURA', es: 'RIESGO QUEMADURA', en: 'BURN RISK', fr: 'RISQUE BRÛLURE' },
    color: 'text-purple-500', glow: 'drop-shadow-[0_0_20px_rgba(168,85,247,0.9)]'
  };
};

// Valor UV "ara mateix": prioritza current.uv_index real, després cerca l'hora exacta a
// hourly.uv_index, i només cau a daily.uv_index_max (que no és horari) durant les hores de
// dia si cap dels dos anteriors té dada. De nit, sempre 0 — l'UV real mai és negatiu ni fals
// fora d'hores de sol. Extreta d'ExpertWidgets.tsx perquè UvModal.tsx necessita exactament el
// mateix valor "ara" sense duplicar l'heurística.
export const getCurrentUV = (weatherData: ExtendedWeatherData): number | undefined => {
  const { current, hourly, daily } = weatherData;
  if (current?.is_day === 0) return 0;
  if (typeof current?.uv_index === 'number') return current.uv_index;

  if (Array.isArray(hourly?.uv_index) && Array.isArray(hourly?.time) && typeof current?.time === 'string') {
    const hourPrefix = current.time.substring(0, 13);
    const idx = hourly.time.findIndex(t => typeof t === 'string' && t.startsWith(hourPrefix));

    if (idx !== -1 && typeof hourly.uv_index[idx] === 'number') {
      return hourly.uv_index[idx] as number;
    }
  }

  const locationHour = typeof current?.time === 'string'
    ? Number(current.time.substring(11, 13))
    : new Date().getHours();
  const isLikelyNight = !Number.isNaN(locationHour) && (locationHour < 6 || locationHour > 21);

  if (!isLikelyNight && current?.is_day !== 0) {
    if (Array.isArray(daily?.uv_index_max) && typeof daily.uv_index_max[0] === 'number') {
      return daily.uv_index_max[0];
    }
  } else if (isLikelyNight) {
    return 0;
  }

  return undefined;
};
