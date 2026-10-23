// src/utils/welcome/moonPhaseKey.ts
// Separat de welcomeSky.ts perquè la benvinguda pugui posar el nom de la fase a la línia de dalt sense
// carregar suncalc al paquet inicial (el cel es calcula al tros que es carrega després del primer pintat).

export type MoonPhaseKey = 'new' | 'waxingCrescent' | 'firstQuarter' | 'waxingGibbous' | 'full' | 'waningGibbous' | 'lastQuarter' | 'waningCrescent';

/** Nom de la fase (clau de t.moonPhases), amb els mateixos llindars que la targeta Fase lunar. */
export function moonPhaseKey(phase: number): MoonPhaseKey {
  const p = Number.isFinite(phase) ? Math.max(0, Math.min(1, phase)) : 0;
  if (p < 0.02 || p > 0.98) return 'new';
  if (p < 0.23) return 'waxingCrescent';
  if (p < 0.27) return 'firstQuarter';
  if (p < 0.48) return 'waxingGibbous';
  if (p <= 0.52) return 'full';
  if (p < 0.73) return 'waningGibbous';
  if (p < 0.77) return 'lastQuarter';
  return 'waningCrescent';
}
