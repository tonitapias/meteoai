// src/utils/lunationCalendar.ts
// El calendari de la lunació del modal Fase lunar: de quina lunació són els dies (la d'ara o la següent), fins on es pot
// navegar, els dies alineats per setmanes amb l'etiqueta de les quatre fases principals, les fases a l'hora exacta amb el
// nom tradicional de la plena i si és superlluna, i la plena de la lunació següent. Pur, sense React: el modal ho calcula
// en un sol useMemo amb dependències primitives.
import { getMoonPhase, getMoonPhaseName, lunationAt, type Lunation } from './lunarPhases';
import { getMoonCompassPosition, getMoonDistanceCategory } from './astronomyMath';
import { addDays, diffDays, formatDateStr, localClock, localDateOf, makeZoneCtx } from './solar/solarTime';
import type { Language } from '../translations';

export type PhaseTag = 'new' | 'fq' | 'full' | 'lq';

// Noms folklòrics anglosaxons tradicionals de la plena (hemisferi nord), un per mes. Curiositat cultural, no dada
// científica: a l'hemisferi sud no es mostren (l'associació estacional s'inverteix).
export const FOLK_FULL_MOON_NAMES: Record<Language, string[]> = {
  ca: ['Lluna del Llop', 'Lluna de Neu', 'Lluna del Cuc', 'Lluna Rosa', 'Lluna de les Flors', 'Lluna de Maduixa', 'Lluna del Cérvol', 'Lluna de l\'Esturió', 'Lluna de la Collita', 'Lluna del Caçador', 'Lluna del Castor', 'Lluna Freda'],
  es: ['Luna del Lobo', 'Luna de Nieve', 'Luna del Gusano', 'Luna Rosa', 'Luna de las Flores', 'Luna de Fresa', 'Luna del Ciervo', 'Luna del Esturión', 'Luna de la Cosecha', 'Luna del Cazador', 'Luna del Castor', 'Luna Fría'],
  en: ['Wolf Moon', 'Snow Moon', 'Worm Moon', 'Pink Moon', 'Flower Moon', 'Strawberry Moon', 'Buck Moon', 'Sturgeon Moon', 'Harvest Moon', "Hunter's Moon", 'Beaver Moon', 'Cold Moon'],
  fr: ['Lune du Loup', 'Lune de Neige', 'Lune des Vers', 'Lune Rose', 'Lune des Fleurs', 'Lune des Fraises', 'Lune du Cerf', "Lune de l'Esturgeon", 'Lune des Moissons', 'Lune du Chasseur', 'Lune du Castor', 'Lune Froide'],
};

export interface LunationDay {
  dateStr: string;
  /** Dies respecte d'avui (negatiu: passat). */
  offset: number;
  num: number;
  /** Fase al migdia UTC (el dia d'avui, el modal hi posa la de l'hora real). */
  noonPhase: number;
  tag: PhaseTag | null;
}

export interface LunationPhaseRow {
  key: 'new0' | 'fq' | 'full' | 'lq' | 'new1';
  ms: number;
  phase: number;
  name: string;
  /** Data local "YYYY-MM-DD" i hora local "HH:MM". */
  dateStr: string;
  time: string;
  offset: number;
  past: boolean;
  folk: string | null;
  superMoon: boolean;
}

export interface LunationView {
  minOffset: number;
  maxOffset: number;
  /** El calendari mostra la lunació següent (el dia triat hi cau). */
  gridIsNext: boolean;
  /** Nom tradicional si el dia triat és el de la plena, el d'abans o el de després. */
  folkName: string | null;
  first: string;
  last: string;
  /** Caselles buides abans del primer dia (la setmana comença en dilluns). */
  lead: number;
  days: LunationDay[];
  lengthD: number;
  lengthH: number;
  phases: LunationPhaseRow[];
  /** La plena de la lunació següent (per a l'enllaç), si el calendari mostra la d'ara. */
  nextFull: { offset: number; dateStr: string; folk: string | null; superMoon: boolean } | null;
}

export interface LunationViewInput {
  nowMs: number;
  /** Data local d'avui i del dia triat ("YYYY-MM-DD"). */
  liveDate: string;
  viewDate: string;
  isToday: boolean;
  timezone: string | null;
  utcOffsetSec: number;
  lat: number;
  lon: number;
  lang: Language;
}

const utcNoonMs = (dateStr: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : NaN;
};

export function buildLunationView(input: LunationViewInput): LunationView | null {
  const { nowMs, liveDate, viewDate, isToday, timezone, utcOffsetSec, lat, lon, lang } = input;
  const current = lunationAt(nowMs);
  const next = current ? lunationAt(current.nextNewMs) : null;
  if (!current || !next || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const zone = makeZoneCtx(timezone, utcOffsetSec);
  const dateOf = (ms: number) => localDateOf(ms, zone);
  const isSouth = lat < 0;
  const folkOf = (fullMs: number) => FOLK_FULL_MOON_NAMES[lang][Number(dateOf(fullMs).slice(5, 7)) - 1];
  const superMoonAt = (ms: number) => {
    const p = getMoonCompassPosition(new Date(ms), lat, lon);
    return !!p && getMoonDistanceCategory(p.distanceKm) === 'supermoon';
  };

  // Les fletxes van de la primera nit de la lunació d'ara fins a l'última de la següent.
  const minOffset = Math.min(0, diffDays(liveDate, dateOf(current.newMs)));
  const maxOffset = Math.max(0, diffDays(liveDate, dateOf(next.nextNewMs)));
  const viewMs = isToday ? nowMs : utcNoonMs(viewDate);
  const grid: Lunation = Number.isFinite(viewMs) && viewMs >= next.newMs ? next : current;
  const gridIsNext = grid === next;

  const viewLunation = lunationAt(Number.isFinite(viewMs) ? viewMs : nowMs);
  const folkName = !isSouth && viewLunation && Math.abs(diffDays(viewDate, dateOf(viewLunation.fullMs))) <= 1
    ? folkOf(viewLunation.fullMs) : null;

  const first = dateOf(grid.newMs);
  const last = dateOf(grid.nextNewMs);
  const tagOf = new Map<string, PhaseTag>([
    [dateOf(grid.newMs), 'new'], [dateOf(grid.firstQuarterMs), 'fq'], [dateOf(grid.fullMs), 'full'],
    [dateOf(grid.lastQuarterMs), 'lq'], [dateOf(grid.nextNewMs), 'new'],
  ]);
  const days: LunationDay[] = Array.from({ length: diffDays(first, last) + 1 }, (_, i) => {
    const dateStr = addDays(first, i);
    return {
      dateStr, offset: diffDays(liveDate, dateStr), num: Number(dateStr.slice(8, 10)),
      noonPhase: getMoonPhase(new Date(utcNoonMs(dateStr))), tag: tagOf.get(dateStr) ?? null,
    };
  });
  const lengthHours = Math.round((grid.nextNewMs - grid.newMs) / 3600000);

  const phases: LunationPhaseRow[] = ([
    ['new0', grid.newMs, 0], ['fq', grid.firstQuarterMs, 0.25], ['full', grid.fullMs, 0.5],
    ['lq', grid.lastQuarterMs, 0.75], ['new1', grid.nextNewMs, 0],
  ] as const).map(([key, ms, phase]) => ({
    key, ms, phase, name: getMoonPhaseName(phase, lang),
    dateStr: dateOf(ms), time: localClock(ms, zone), offset: diffDays(liveDate, dateOf(ms)), past: ms < nowMs,
    folk: key === 'full' && !isSouth ? folkOf(ms) : null, superMoon: key === 'full' && superMoonAt(ms),
  }));

  return {
    minOffset, maxOffset, gridIsNext, folkName, first, last,
    lead: (new Date(utcNoonMs(first)).getUTCDay() + 6) % 7,
    days, lengthD: Math.floor(lengthHours / 24), lengthH: lengthHours % 24, phases,
    nextFull: gridIsNext ? null : {
      offset: diffDays(liveDate, dateOf(next.fullMs)), dateStr: dateOf(next.fullMs),
      folk: isSouth ? null : folkOf(next.fullMs), superMoon: superMoonAt(next.fullMs),
    },
  };
}

/** Inicials dels dies de la setmana de dilluns a diumenge ("dl", "Mo", "lu"...), de l'Intl de l'idioma. */
export function weekdayInitials(locale: string): string[] {
  // 23-11-2026 és dilluns.
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2026, 10, 23 + i, 12))).replace('.', '').slice(0, 2));
}

/** "9 nov. – 9 des." */
export const lunationRangeLabel = (view: Pick<LunationView, 'first' | 'last'>, locale: string): string =>
  `${formatDateStr(view.first, locale, 'dayMonth')} – ${formatDateStr(view.last, locale, 'dayMonth')}`;
