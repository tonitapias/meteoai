// src/utils/solar/solarTime.ts
// Rellotge local del modal Cicle solar: límits del dia local (DST i línia de canvi de data), hores
// "HH:MM" i dates, sempre en el fus de la UBICACIÓ (mai el del navegador). Formatadors Intl en
// memòria cau de mòdul: a la segona obertura del modal no se'n construeix cap.

/** Fus de la ubicació. `tz` null => tot va amb el desplaçament fix d'Open-Meteo. */
export interface ZoneCtx { tz: string | null; fixedOffsetSec: number }

const MIN_MS = 60000;
const DAY_MS = 86400000;

// --- Formatadors en memòria cau ---

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const invalidZones = new Set<string>();

/** Formatador `formatToParts` (en-US, h23) d'un fus, o null si el fus no és vàlid. */
const getPartsFormatter = (tz: string): Intl.DateTimeFormat | null => {
  const cached = partsFormatters.get(tz);
  if (cached) return cached;
  if (invalidZones.has(tz)) return null;
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    partsFormatters.set(tz, f);
    return f;
  } catch {
    invalidZones.add(tz);
    return null;
  }
};

/** Valida el fus una sola vegada; si no és vàlid (o falta) es fa servir el desplaçament fix. */
export function makeZoneCtx(tz: string | null | undefined, utcOffsetSec: number | null | undefined): ZoneCtx {
  const fixedOffsetSec = typeof utcOffsetSec === 'number' && Number.isFinite(utcOffsetSec) ? utcOffsetSec : 0;
  const name = typeof tz === 'string' ? tz.trim() : '';
  return { tz: name !== '' && getPartsFormatter(name) ? name : null, fixedOffsetSec };
}

/** Desplaçament (ms) del rellotge local respecte d'UTC a l'instant `ms`. Una hora '24' es llegeix com a 0. */
export function offsetMsAt(ms: number, z: ZoneCtx): number {
  const f = z.tz ? getPartsFormatter(z.tz) : null;
  if (!f || !Number.isFinite(ms)) return z.fixedOffsetSec * 1000;
  let y = 0, mo = 0, d = 0, h = 0, mi = 0, s = 0;
  for (const p of f.formatToParts(new Date(ms))) {
    switch (p.type) {
      case 'year': y = Number(p.value); break;
      case 'month': mo = Number(p.value); break;
      case 'day': d = Number(p.value); break;
      case 'hour': h = p.value === '24' ? 0 : Number(p.value); break;
      case 'minute': mi = Number(p.value); break;
      case 'second': s = Number(p.value); break;
    }
  }
  return Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(ms / 1000) * 1000;
}

// --- Dates "YYYY-MM-DD" ---

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Mitjanit UTC de la data, o null si no és una data vàlida. */
const utcMidnight = (dateStr: string): number | null => {
  const m = DATE_RE.exec(dateStr);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const g = Date.UTC(y, mo - 1, d);
  // Rebutja dates que no existeixen (31 de febrer...).
  return new Date(g).getUTCDate() === d ? g : null;
};

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Suma dies a una data local (aritmètica pura de calendari, sense fus). Entrada no vàlida: es retorna tal qual. */
export function addDays(dateStr: string, n: number): string {
  const g = utcMidnight(dateStr);
  return g === null ? dateStr : isoDate(g + Math.round(n) * DAY_MS);
}

/** Dies de `a` a `b` (b − a), o NaN si alguna data no és vàlida. */
export function diffDays(a: string, b: string): number {
  const ga = utcMidnight(a), gb = utcMidnight(b);
  return ga === null || gb === null ? NaN : Math.round((gb - ga) / DAY_MS);
}

/** Data local "YYYY-MM-DD" de l'instant `ms` a la ubicació. */
export function localDateOf(ms: number, z: ZoneCtx): string {
  return isoDate(ms + offsetMsAt(ms, z));
}

/**
 * Primer instant del dia local `dateStr`. Dues passades d'offset i, dels dos candidats, el MÉS
 * PRIMERENC que ja cau en aquesta data local (sense aquesta regla, Santiago, l'Havana i Beirut, que
 * canvien d'hora a les 00:00, fallen). Data no vàlida: NaN.
 */
export function zonedDayStartMs(dateStr: string, z: ZoneCtx): number {
  const g = utcMidnight(dateStr);
  if (g === null) return NaN;
  const t1 = g - offsetMsAt(g, z);
  if (!z.tz) return t1;
  const t2 = g - offsetMsAt(t1, z);
  const ok = [t1, t2].filter(t => localDateOf(t, z) === dateStr).sort((a, b) => a - b);
  return ok.length > 0 ? ok[0] : t1;
}

const WALL_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

/**
 * Instant UTC d'una hora local "YYYY-MM-DDTHH:MM" (format d'Open-Meteo) a la ubicació. Hora ambigua (la
 * repetida de la tardor): la primera de les dues. Hora inexistent (el salt de la primavera): es desplaça
 * endavant la durada del salt, com la desambiguació "compatible" de Temporal (les 03:00 d'un dia que salta de
 * 03:00 a 04:00 cauen a les 04:00, no una hora abans). Mai llança: text no vàlid => null.
 */
export function wallTimeToUtcMs(wall: string | null | undefined, z: ZoneCtx): number | null {
  if (typeof wall !== 'string') return null;
  const m = WALL_RE.exec(wall);
  if (!m) return null;
  const h = Number(m[2]), mi = Number(m[3]);
  const g0 = utcMidnight(m[1]);
  if (g0 === null || h > 23 || mi > 59) return null;
  const g = g0 + h * 3600000 + mi * MIN_MS;
  const t1 = g - offsetMsAt(g, z);
  if (!z.tz) return t1;
  const t2 = g - offsetMsAt(t1, z);
  // Tercer candidat amb el desfasament de 3 h abans: troba la primera ocurrència d'una hora repetida.
  const t3 = g - offsetMsAt(t1 - 3 * 3600000, z);
  const ok = [t1, t2, t3].filter(t => t + offsetMsAt(t, z) === g).sort((a, b) => a - b);
  return ok.length > 0 ? ok[0] : Math.max(t1, t2);
}

// --- Hores "HH:MM" ---

let clockTable: string[] | null = null;

/** "HH:MM" d'un minut del dia local (taula de 1440 entrades, sense Intl); 1440 => "24:00". */
export function clockForLocalMinute(min: number): string {
  const r = Math.round(min);
  if (r === 1440) return '24:00';
  if (!clockTable) {
    clockTable = new Array<string>(1440);
    for (let i = 0; i < 1440; i++) {
      clockTable[i] = `${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`;
    }
  }
  return clockTable[((r % 1440) + 1440) % 1440];
}

/** Minut del dia local (0..1439, segons truncats) de l'instant `ms`. */
export function localClockMinute(ms: number, z: ZoneCtx): number {
  const local = Math.floor((ms + offsetMsAt(ms, z)) / MIN_MS);
  return ((local % 1440) + 1440) % 1440;
}

/** "HH:MM" local de l'instant (mateix resultat que `formatClockTime` d'astronomyMath, sense crear cap formatador). */
export function localClock(ms: number, z: ZoneCtx): string {
  return Number.isFinite(ms) ? clockForLocalMinute(localClockMinute(ms, z)) : '--:--';
}

/**
 * Canvi d'hora dins del dia [start, end): minut (des de `start`) en què entra en vigor el nou offset i
 * salt en minuts (+60 primavera, −60 tardor). Cerca binària (≤ 12 passos). Se'n suposa com a màxim un.
 */
export function dayDstShift(start: number, end: number, z: ZoneCtx): { atMin: number; deltaMin: number } | null {
  if (!z.tz || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const offA = offsetMsAt(start, z);
  const offB = offsetMsAt(end - 1, z);
  if (offA === offB) return null;
  // Invariant: offset(lo) = offA, offset(hi) = offB (minuts des de start).
  let lo = 0;
  let hi = Math.ceil((end - 1 - start) / MIN_MS);
  for (let i = 0; i < 12 && hi - lo > 1; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (offsetMsAt(start + mid * MIN_MS, z) === offA) lo = mid; else hi = mid;
  }
  return { atMin: hi, deltaMin: Math.round((offB - offA) / MIN_MS) };
}

// --- Dates llegibles ---

/** Estils base amb formatador propi (memòria cau per idioma i estil). */
export type FormatterStyle = 'long' | 'short' | 'weekday' | 'dayMonth' | 'dayMonthLong' | 'month';
/** Estils de `formatDateStr`. `weekdayDay` i `weekdayDayMonth` es componen a partir dels base. */
export type DateStyle = 'long' | 'short' | 'weekdayDay' | 'weekdayDayMonth' | 'dayMonth' | 'dayMonthLong' | 'month';

const FORMATTER_OPTIONS: Record<FormatterStyle, Intl.DateTimeFormatOptions> = {
  long: { weekday: 'long', day: 'numeric', month: 'long' },        // "dimecres, 7 d’octubre"
  short: { weekday: 'short', day: 'numeric', month: 'short' },     // "dc., 7 d’oct."
  weekday: { weekday: 'short' },                                   // "dc."
  dayMonth: { day: 'numeric', month: 'short' },                    // "7 d’oct."
  dayMonthLong: { day: 'numeric', month: 'long' },                 // "7 d’octubre"
  month: { month: 'short' },                                       // "nov."
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Formatador de data en memòria cau (`timeZone:'UTC'`: s'aplica al migdia UTC de la data, mai depèn del navegador). */
export function getDateFormatter(locale: string, style: FormatterStyle): Intl.DateTimeFormat {
  const key = `${locale}|${style}`;
  let f = dateFormatters.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...FORMATTER_OPTIONS[style] });
    } catch {
      f = new Intl.DateTimeFormat('ca-ES', { timeZone: 'UTC', ...FORMATTER_OPTIONS[style] });
    }
    dateFormatters.set(key, f);
  }
  return f;
}

/**
 * Data local "YYYY-MM-DD" en text. `weekdayDay` = "dc. 7" (també en anglès: "Wed 7");
 * `weekdayDayMonth` = "dg. 1 de nov.". Data no vàlida: ''.
 */
export function formatDateStr(dateStr: string, locale: string, style: DateStyle): string {
  const g = utcMidnight(dateStr);
  if (g === null) return '';
  const d = new Date(g + 12 * 3600000);
  switch (style) {
    case 'weekdayDay':
      return `${getDateFormatter(locale, 'weekday').format(d)} ${d.getUTCDate()}`;
    case 'weekdayDayMonth':
      return `${getDateFormatter(locale, 'weekday').format(d)} ${getDateFormatter(locale, 'dayMonth').format(d)}`;
    default:
      return getDateFormatter(locale, style).format(d);
  }
}

/** Desplaçament fix en text ("UTC+2", "UTC+5:30", "UTC−3", "UTC"), per al peu quan no hi ha fus IANA. */
export function formatUtcOffset(sec: number): string {
  if (!Number.isFinite(sec) || Math.round(sec / 60) === 0) return 'UTC';
  const totalMin = Math.round(Math.abs(sec) / 60);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return `UTC${sec < 0 ? '−' : '+'}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}
