// src/utils/detailTeaser.ts
// Valors d'ara de la vista completa que la vista essencial no ensenya, per a la targeta "Vols més detall?".
// Cada valor surt de la mateixa font i amb el mateix format que el seu giny: si la targeta diu 1019 hPa,
// el giny de pressió també ha de dir 1019.
import { getMoonPhaseName, getNamedMoonPhase } from './lunarPhases';
import { AQI_TRANSLATIONS, extractAqiData, getAqiLevel, getAqiSafeLang } from './aqiLevel';
import { formatVisibilityKm, resolveCurrentDisplayVisibility } from './visibilityDisplay';

export type DetailTeaserKey = 'pressure' | 'air' | 'moon' | 'visibility';

export interface DetailTeaserItem {
  key: DetailTeaserKey;
  text: string;
}

export interface DetailTeaserTemplates {
  teaserPressure: string;
  teaserAir: string;
  teaserVisibility: string;
}

interface DetailTeaserInput {
  current: { pressure_msl?: unknown; visibility?: unknown; precipitation?: unknown } | null | undefined;
  /** aqiData.current, el mateix objecte que rep AqiWidget. */
  aqiCurrent: unknown;
  /** Codi de temps de la capçalera (política de boira), el mateix que rep VisibilityWidget. */
  effectiveCode: number | null | undefined;
  /** Rellotge de l'app (ms), el mateix instant que fa servir la targeta Fase lunar. */
  nowMs: number;
  lang: string;
  templates: DetailTeaserTemplates;
}

const fill = (template: string, value: string) => template.replace('{v}', value);

export function buildDetailTeaser({ current, aqiCurrent, effectiveCode, nowMs, lang, templates }: DetailTeaserInput): DetailTeaserItem[] {
  const items: DetailTeaserItem[] = [];

  // CircularGauge arrodoneix a l'enter.
  const pressure = current?.pressure_msl;
  if (typeof pressure === 'number' && Number.isFinite(pressure)) {
    items.push({ key: 'pressure', text: fill(templates.teaserPressure, String(Math.round(pressure))) });
  }

  const aqi = extractAqiData(aqiCurrent);
  if (aqi) {
    const label = AQI_TRANSLATIONS[getAqiSafeLang(lang)][getAqiLevel(aqi)];
    items.push({ key: 'air', text: fill(templates.teaserAir, label.toLocaleLowerCase(lang)) });
  }

  // Nom del dia (getNamedMoonPhase): el dia de la plena és "Lluna Plena", com a la targeta Fase lunar.
  const phase = getNamedMoonPhase(new Date(nowMs));
  if (Number.isFinite(phase)) {
    items.push({ key: 'moon', text: getMoonPhaseName(phase, lang) });
  }

  const { meters, bound } = resolveCurrentDisplayVisibility(current, effectiveCode);
  if (meters !== null) {
    items.push({ key: 'visibility', text: fill(templates.teaserVisibility, formatVisibilityKm(Math.max(0, meters), bound, getAqiSafeLang(lang))) });
  }

  return items;
}
