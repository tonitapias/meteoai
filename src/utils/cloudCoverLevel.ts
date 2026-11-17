// src/utils/cloudCoverLevel.ts
// Cobertura efectiva "ara" i el seu estat del cel, compartits pel giny Capes de núvols (CloudLayersWidget) i el seu
// modal (CloudLayersModal): la targeta i el modal han de mostrar el mateix número i la mateixa etiqueta. El % és el
// de calculateEffectiveCloudCover (cloudRules.ts), el que també tria la icona de cel.
//
// L'estat és EL MATEIX que el de la capçalera i la icona: surt del codi de cel que adjustBaseSkyCode tria amb aquest %
// (0 serè, 1 majorment serè, 2 parcialment ennuvolat, 3 cobert) i, dins del 2, de la variant "molt ennuvolat"
// d'isMostlyCloudy (per sobre de CLOUDS.MOSTLY_CLOUDY). Les etiquetes són les de la capçalera (tr.wmo[0..3] i
// tr.wmoMostlyCloudy). Abans aquest fitxer tenia una escala pròpia de 4 estats (talls a 15/45/85 %) amb les etiquetes
// un graó per sota: un 43 % era "Majorment serè" a dalt i "Parcialment ennuvolat" a Detall, i un 62 % "Parcialment
// ennuvolat" a dalt i "Molt ennuvolat" a Detall.
import { adjustBaseSkyCode, calculateEffectiveCloudCover, isMostlyCloudy } from './rules/cloudRules';
import { TRANSLATIONS, type Language } from '../translations';

export type CloudCoverLevel = 'clear' | 'mostlyClear' | 'partial' | 'veryCloudy' | 'overcast';

const num = (v: unknown): number | null => (typeof v === 'number' && !isNaN(v) ? v : null);

/** Cobertura efectiva amb les tres capes; una capa que falta compta com a 0. null només si falten totes tres. */
export function effectiveCloudCoverNow(low: unknown, mid: unknown, high: unknown): number | null {
  const l = num(low), m = num(mid), h = num(high);
  if (l === null && m === null && h === null) return null;
  return calculateEffectiveCloudCover(l ?? 0, m ?? 0, h ?? 0);
}

/** Estat del cel per a una cobertura efectiva: el mateix codi (i variant) que la capçalera i la icona. */
export function cloudCoverLevel(effective: number): CloudCoverLevel {
  const code = adjustBaseSkyCode(0, effective);
  if (code === 3) return 'overcast';
  if (code === 2) return isMostlyCloudy(code, effective) ? 'veryCloudy' : 'partial';
  return code === 1 ? 'mostlyClear' : 'clear';
}

/** Codi de cel de cada nivell (el de tr.wmo); 'veryCloudy' és el 2 amb l'etiqueta tr.wmoMostlyCloudy. */
const LEVEL_CODE: Record<Exclude<CloudCoverLevel, 'veryCloudy'>, 0 | 1 | 2 | 3> = {
  clear: 0, mostlyClear: 1, partial: 2, overcast: 3,
};

const UNKNOWN_LABEL: Record<Language, string> = { ca: 'Desconegut', es: 'Desconocido', en: 'Unknown', fr: 'Inconnu' };

// tr.wmo és en minúscula en castellà, anglès i francès ("cielo despejado"): la primera lletra en majúscula.
const capFirst = (s: string, lang: Language): string => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);

const buildLabels = (lang: Language): Record<CloudCoverLevel | 'unknown', string> => {
  const tr = TRANSLATIONS[lang] ?? TRANSLATIONS.ca;
  const wmo = tr.wmo as Record<number, string>;
  return {
    clear: capFirst(wmo[LEVEL_CODE.clear], lang),
    mostlyClear: capFirst(wmo[LEVEL_CODE.mostlyClear], lang),
    partial: capFirst(wmo[LEVEL_CODE.partial], lang),
    veryCloudy: capFirst(tr.wmoMostlyCloudy, lang),
    overcast: capFirst(wmo[LEVEL_CODE.overcast], lang),
    unknown: UNKNOWN_LABEL[lang],
  };
};

/** Etiquetes de cada nivell: les mateixes paraules que la capçalera (getWeatherLabel), en cada idioma. */
export const CLOUD_LEVEL_LABEL: Record<Language, Record<CloudCoverLevel | 'unknown', string>> = {
  ca: buildLabels('ca'),
  es: buildLabels('es'),
  en: buildLabels('en'),
  fr: buildLabels('fr'),
};
