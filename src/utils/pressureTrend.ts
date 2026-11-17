// src/utils/pressureTrend.ts
// Tendència de la pressió en 3 h amb la terminologia dels butlletins marítims (vegeu README §8 i WEATHER_THRESHOLDS.PRESSURE):
// estable / pujant-baixant lentament / pujant-baixant / ràpidament / molt ràpidament. La fan servir el giny de Detall i
// el modal de Pressió. Abans el giny tenia una escala pròpia amb un sol calaix per a "Estable / pujant": amb −0,1 hPa
// deia "Estable / pujant" mentre el modal deia "Baixant lentament" (auditoria d'UX del 16/11/2026, B2).
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';
import type { Language } from '../translations';

const { PRESSURE } = WEATHER_THRESHOLDS;

export type PressureTrendKey =
  | 'stable'
  | 'risingSlow' | 'rising' | 'risingRapid' | 'risingVeryRapid'
  | 'fallingSlow' | 'falling' | 'fallingRapid' | 'fallingVeryRapid';

export function classifyPressureTrend(delta3h: number): PressureTrendKey {
  const abs = Math.abs(delta3h);
  if (abs < PRESSURE.STABLE) return 'stable';
  const up = delta3h > 0;
  if (abs <= PRESSURE.SLOW) return up ? 'risingSlow' : 'fallingSlow';
  if (abs <= PRESSURE.MODERATE) return up ? 'rising' : 'falling';
  if (abs <= PRESSURE.RAPID) return up ? 'risingRapid' : 'fallingRapid';
  return up ? 'risingVeryRapid' : 'fallingVeryRapid';
}

/** Mateixes etiquetes que el modal de Pressió. */
export const PRESSURE_TREND_LABEL: Record<Language, Record<PressureTrendKey, string>> = {
  ca: {
    stable: 'Estable', risingSlow: 'Pujant lentament', fallingSlow: 'Baixant lentament', rising: 'Pujant', falling: 'Baixant',
    risingRapid: 'Pujant ràpidament', fallingRapid: 'Baixant ràpidament', risingVeryRapid: 'Pujant molt ràpidament', fallingVeryRapid: 'Baixant molt ràpidament',
  },
  es: {
    stable: 'Estable', risingSlow: 'Subiendo lentamente', fallingSlow: 'Bajando lentamente', rising: 'Subiendo', falling: 'Bajando',
    risingRapid: 'Subiendo rápidamente', fallingRapid: 'Bajando rápidamente', risingVeryRapid: 'Subiendo muy rápido', fallingVeryRapid: 'Bajando muy rápido',
  },
  en: {
    stable: 'Steady', risingSlow: 'Rising slowly', fallingSlow: 'Falling slowly', rising: 'Rising', falling: 'Falling',
    risingRapid: 'Rising quickly', fallingRapid: 'Falling quickly', risingVeryRapid: 'Rising very rapidly', fallingVeryRapid: 'Falling very rapidly',
  },
  fr: {
    stable: 'Stable', risingSlow: 'Hausse lente', fallingSlow: 'Baisse lente', rising: 'En hausse', falling: 'En baisse',
    risingRapid: 'Hausse rapide', fallingRapid: 'Baisse rapide', risingVeryRapid: 'Hausse très rapide', fallingVeryRapid: 'Baisse très rapide',
  },
};
