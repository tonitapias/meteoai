// src/utils/cloudCoverLevel.ts
// Cobertura efectiva "ara" i el seu nivell (Serè / Parcialment ennuvolat / Molt ennuvolat / Cobert), compartits
// pel giny Capes de núvols (CloudLayersWidget) i el seu modal (CloudLayersModal): la targeta i el modal han
// de mostrar el mateix número i la mateixa etiqueta. El % és el de calculateEffectiveCloudCover (cloudRules.ts),
// el que també tria la icona de cel.
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import { calculateEffectiveCloudCover } from './rules/cloudRules';
import type { Language } from '../translations';

const { CLOUDS } = WEATHER_THRESHOLDS;

export type CloudCoverLevel = 'clear' | 'partial' | 'veryCloudy' | 'overcast';

const num = (v: unknown): number | null => (typeof v === 'number' && !isNaN(v) ? v : null);

/** Cobertura efectiva amb les tres capes; una capa que falta compta com a 0. null només si falten totes tres. */
export function effectiveCloudCoverNow(low: unknown, mid: unknown, high: unknown): number | null {
  const l = num(low), m = num(mid), h = num(high);
  if (l === null && m === null && h === null) return null;
  return calculateEffectiveCloudCover(l ?? 0, m ?? 0, h ?? 0);
}

export function cloudCoverLevel(effective: number): CloudCoverLevel {
  if (effective < CLOUDS.FEW) return 'clear';
  if (effective < CLOUDS.SCATTERED) return 'partial';
  if (effective < CLOUDS.OVERCAST) return 'veryCloudy';
  return 'overcast';
}

export const CLOUD_LEVEL_LABEL: Record<Language, Record<CloudCoverLevel | 'unknown', string>> = {
  ca: { clear: 'Serè', partial: 'Parcialment Ennuvolat', veryCloudy: 'Molt Ennuvolat', overcast: 'Cobert', unknown: 'Desconegut' },
  es: { clear: 'Despejado', partial: 'Parcialmente Nublado', veryCloudy: 'Muy Nublado', overcast: 'Cubierto', unknown: 'Desconocido' },
  en: { clear: 'Clear', partial: 'Partly Cloudy', veryCloudy: 'Very Cloudy', overcast: 'Overcast', unknown: 'Unknown' },
  fr: { clear: 'Dégagé', partial: 'Partiellement Nuageux', veryCloudy: 'Très Nuageux', overcast: 'Couvert', unknown: 'Inconnu' },
};
