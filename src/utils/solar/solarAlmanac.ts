// src/utils/solar/solarAlmanac.ts
// Files del "Calendari solar" (avui + 14 dies des de la data local VIVA): sortida i posta resoltes, durada,
// Δ respecte del dia anterior (suncalc, segons), UV d'Open-Meteo (només on n'hi ha) i fraccions de la
// microbarra de llum. 16 càlculs lite (15 dies + l'anterior); el component els fa en muntar-se, diferit.
import type { Language } from '../../translations';
import { getUVCategory } from '../uvIndexUtils';
import { formatHoursMinutes } from '../formatters';
import { fill, type SolarStrings } from '../../components/solar/solarI18n';
import { type ZoneCtx, addDays, formatDateStr } from './solarTime';
import { type TimeText, astroLengthFor, buildSolarDay } from './solarDay';
import { capitalize, formatDeltaCompact, formatDeltaLong, untilDateText, uvDisplay } from './solarFormat';
import { type SolarDaily, dailyIndexOf, lastUvDate, omEdgesFor } from './solarForecast';

/** Files del calendari: avui + 14. */
export const ALMANAC_DAYS = 15;

export type Trend = 'up' | 'down' | 'flat';
export type TrendClass = 'sm-tr-up' | 'sm-tr-down' | 'sm-tr-flat';

export interface AlmanacRow {
  dateStr: string;
  /** Dies des d'avui (0..14). */
  offset: number;
  /** "Avui", "dj. 8" o, el dia 1 de mes, "dg. 1 de nov." (text complet de l'aria). */
  label: string;
  /** Etiqueta visible de la columna estreta: "Avui"/"Auj." o "dj. 8". */
  labelMain: string;
  /** Segona línia petita, només el dia 1 de mes: "nov." (si no, el mes no hi cabria i es tallaria). */
  labelSub: string | null;
  /** "HH:MM" del parell resolt (el "+1" només va a l'aria); "—" si no n'hi ha (dies polars). */
  rise: string;
  set: string;
  /** Durada del dia ("11h 29m"; polar "24h 00m" / "0h 00m"). */
  len: string;
  /** Δ astronòmica respecte del dia anterior, en segons. */
  deltaSec: number | null;
  /** "−2:46", "+0:05", "0:00". */
  deltaCompact: string;
  trend: Trend;
  trendCls: TrendClass;
  /** UV amb un decimal (com la targeta de previsió) o null si Open-Meteo no en dona per a aquest dia. */
  uv: string | null;
  uvClass: string;
  /** Fraccions del dia de 24 h on surt i es pon el sol (microbarra): polar dia 0/1, polar nit 0/0. */
  riseFrac: number;
  setFrac: number;
  polar: 'none' | 'day' | 'night';
  /** Nom accessible: comença amb `label` (WCAG 2.5.3). */
  aria: string;
}

export interface AlmanacInput {
  liveDate: string;
  zone: ZoneCtx;
  lat: number;
  lon: number;
  daily: SolarDaily | null | undefined;
  locale: string;
  t: SolarStrings;
  lang: Language;
}

const DASH = '—';
const FLAT_SEC = 1;

/** Data llarga per a l'aria de la fila: "Dimecres 7 d’octubre" (majúscula inicial i sense la coma de l'Intl). */
export function almanacLongDate(dateStr: string, locale: string): string {
  return capitalize(formatDateStr(dateStr, locale, 'long').replace(/,\s*/, ' '), locale);
}

const frac = (ms: number | null, start: number, end: number, fallback: number): number => {
  if (ms === null || !(end > start)) return fallback;
  const f = (ms - start) / (end - start);
  return Math.round(Math.min(1, Math.max(0, f)) * 10000) / 10000;
};

const trendOf = (delta: number | null): Trend =>
  delta === null || Math.abs(delta) < FLAT_SEC ? 'flat' : delta > 0 ? 'up' : 'down';

const TREND_CLASS: Readonly<Record<Trend, TrendClass>> = { up: 'sm-tr-up', down: 'sm-tr-down', flat: 'sm-tr-flat' };

/** Hora per a l'aria, amb el dia (l'endemà / el dia anterior) si cau fora de la data. */
const ariaTime = (label: TimeText | null, t: SolarStrings): string => {
  if (!label) return DASH;
  if (label.shift === 1) return `${label.text} ${t.nextDaySr}`;
  if (label.shift === -1) return `${label.text} ${t.prevDaySr}`;
  return label.text;
};

/** Text de la Δ per a l'aria: "2 min 46 s menys que ahir" (fila 0) / "… que el dia anterior", o "Igual que…". */
const ariaDelta = (delta: number | null, isToday: boolean, t: SolarStrings): string | null => {
  if (delta === null) return null;
  const { sign, text } = formatDeltaLong(delta);
  if (sign === 0) return isToday ? t.sameAsYesterday : t.sameAsPrev;
  const rest = sign > 0
    ? (isToday ? t.vsYesterdayLonger : t.vsPrevLonger)
    : (isToday ? t.vsYesterdayShorter : t.vsPrevShorter);
  return `${text} ${rest}`;
};

/**
 * Les 15 files del calendari a partir de `liveDate`. La Δ és sempre astronòmica (la mateixa definició que
 * l'heroi); sortida/posta i durada, el parell resolt (Open-Meteo si quadra, si no suncalc). Coordenades o
 * data no vàlides: [].
 */
export function buildAlmanacRows(input: AlmanacInput): AlmanacRow[] {
  const { liveDate, zone, lat, lon, daily, locale, t, lang } = input;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  let prevAstro = astroLengthFor(addDays(liveDate, -1), lat, lon, zone);
  const rows: AlmanacRow[] = [];
  for (let offset = 0; offset < ALMANAC_DAYS; offset++) {
    const dateStr = addDays(liveDate, offset);
    const { omRise, omSet } = omEdgesFor(daily, dateStr);
    const m = buildSolarDay({ dateStr, lat, lon, zone, omRise, omSet }, { lite: true });
    if (!m) return [];

    const delta = m.astroLengthSec !== null && prevAstro !== null ? m.astroLengthSec - prevAstro : null;
    prevAstro = m.astroLengthSec;
    const trend = trendOf(delta);

    const idx = dailyIndexOf(daily, dateStr);
    const uvRaw = idx >= 0 && Array.isArray(daily?.uv_index_max) ? daily.uv_index_max[idx] : null;
    const uv = uvDisplay(uvRaw, lang);

    const label = offset === 0
      ? t.today
      : formatDateStr(dateStr, locale, Number(dateStr.slice(8, 10)) === 1 ? 'weekdayDayMonth' : 'weekdayDay');
    const len = formatHoursMinutes(m.dayLengthSec);

    let riseFrac: number, setFrac: number;
    if (m.polar === 'day') { riseFrac = 0; setFrac = 1; }
    else if (m.polar === 'night') { riseFrac = 0; setFrac = 0; }
    else {
      riseFrac = frac(m.t.sunrise, m.startMs, m.endMs, 0);
      setFrac = frac(m.t.sunset, m.startMs, m.endMs, m.t.sunrise === null ? 0 : 1);
    }

    const date = almanacLongDate(dateStr, locale);
    let aria: string;
    if (m.polar !== 'none') {
      aria = fill(t.rowAriaPolar, { label, date, state: m.polar === 'day' ? t.polarDayTitle : t.polarNightTitle, len });
    } else {
      const d = ariaDelta(delta, offset === 0, t);
      aria = fill(t.rowAria, { label, date, rise: ariaTime(m.riseLabel, t), set: ariaTime(m.setLabel, t), len, delta: d ?? '' });
      if (d === null) aria = aria.replace(/,\s*$/, '');
    }
    if (uv && typeof uvRaw === 'number') aria += fill(t.rowAriaUv, { uv: uv.text, cat: getUVCategory(uvRaw).label[lang] });

    const dayNum = Number(dateStr.slice(8, 10));
    rows.push({
      dateStr, offset, label,
      labelMain: offset === 0 ? t.todayShort : formatDateStr(dateStr, locale, 'weekdayDay'),
      labelSub: offset !== 0 && dayNum === 1 ? formatDateStr(dateStr, locale, 'month') : null,
      rise: m.polar === 'none' && m.riseLabel ? m.riseLabel.text : DASH,
      set: m.polar === 'none' && m.setLabel ? m.setLabel.text : DASH,
      len,
      deltaSec: delta,
      deltaCompact: delta === null ? '' : formatDeltaCompact(Math.abs(delta) < FLAT_SEC ? 0 : delta),
      trend, trendCls: TREND_CLASS[trend],
      uv: uv ? uv.text : null,
      uvClass: uv ? uv.cls : '',
      riseFrac, setFrac,
      polar: m.polar,
      aria,
    });
  }
  return rows;
}

/** Rang de dates del calendari: "7 d’oct. – 21 d’oct.". */
export function almanacRangeLabel(liveDate: string, locale: string): string {
  return `${formatDateStr(liveDate, locale, 'dayMonth')} – ${formatDateStr(addDays(liveDate, ALMANAC_DAYS - 1), locale, 'dayMonth')}`;
}

/** Línia "UV previst fins al {date}" (últim dia amb UV numèric), o null si no n'hi ha cap. */
export function almanacUvUntilLine(
  daily: SolarDaily | null | undefined, t: SolarStrings, locale: string, lang: Language,
): string | null {
  const last = lastUvDate(daily);
  return last ? fill(t.uvUntil, { date: untilDateText(last, lang, locale) }) : null;
}
