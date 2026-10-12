// src/utils/solar/solarFormat.ts
// Format de xifres del modal Cicle solar: compte enrere (idèntic a la targeta), Δ de durada, graus,
// lectura de la posició, intervals, coordenades i UV. Punt decimal sempre (toFixed), com UvModal i la targeta.
import type { Language } from '../../translations';
import { getCardinalLabel } from '../astronomyMath';
import { getUVCategory } from '../uvIndexUtils';
import { fill, type SolarStrings } from '../../components/solar/solarI18n';
import type { TimeText } from './solarDay';
import { formatDateStr } from './solarTime';

/** Signe menys tipogràfic (U+2212) per a xifres negatives. */
export const MINUS = '−';
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Graus enters, amb el signe menys tipogràfic; −0 => "0°". */
export function degText(v: number): string {
  const r = Math.round(v);
  return r < 0 ? `${MINUS}${-r}°` : `${r === 0 ? 0 : r}°`;
}

/** Azimut "97° E" (0-359°, punt cardinal de 16 en l'idioma); sense dada => "—". */
export function azText(az: number | null, lang: Language): string {
  return az === null ? '—' : `${((Math.round(az) % 360) + 360) % 360}° ${getCardinalLabel(az, lang)}`;
}

/** Primera lletra en majúscula segons la llengua ("dimecres, 7…" => "Dimecres, 7…"). */
export function capitalize(s: string, locale: string): string {
  return s ? s.charAt(0).toLocaleUpperCase(locale) + s.slice(1) : s;
}

/** Compte enrere amb el format exacte de SunArcWidget: arrodonit avall, "3h 12m" sense zeros; negatiu => null. */
export function formatCountdown(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const d = Math.floor(ms / 1000);
  return `${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m`;
}

/** Δ de durada del dia en format llarg sense signe ("2 min 46 s", "42 s", "1h 05m"); |Δ| < 1 s => signe 0 i text buit. */
export function formatDeltaLong(sec: number): { sign: -1 | 0 | 1; text: string } {
  if (!Number.isFinite(sec) || Math.abs(sec) < 1) return { sign: 0, text: '' };
  const s = Math.round(Math.abs(sec));
  const sign = sec < 0 ? -1 : 1;
  if (s < 60) return { sign, text: `${s} s` };
  if (s < 3600) {
    const m = Math.floor(s / 60), r = s % 60;
    return { sign, text: r === 0 ? `${m} min` : `${m} min ${r} s` };
  }
  const totalMin = Math.round(s / 60);
  return { sign, text: `${Math.floor(totalMin / 60)}h ${pad2(totalMin % 60)}m` };
}

/** Δ compacta amb signe ("−2:46", "+0:05", "0:00"; a partir d'una hora "+1:05:00"). */
export function formatDeltaCompact(sec: number): string {
  const s = Number.isFinite(sec) ? Math.round(Math.abs(sec)) : 0;
  if (s === 0) return '0:00';
  const sign = sec < 0 ? MINUS : '+';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${sign}${h}:${pad2(m)}:${pad2(r)}` : `${sign}${m}:${pad2(r)}`;
}

/** Graus enters amb signe (U+2212); el que arrodoneix a 0 és "0°". */
export function signedDeg(alt: number): string {
  const r = Math.round(alt);
  if (!Number.isFinite(r) || r === 0) return '0°';
  return r > 0 ? `+${r}°` : `${MINUS}${-r}°`;
}

/** Ombra d'un objecte vertical en múltiples de la seva alçada: 1 decimal per sota de 10, enter a partir de 10; sol < 5° => null. */
export function shadowRatio(alt: number): string | null {
  if (!Number.isFinite(alt) || alt < 5) return null;
  const r = 1 / Math.tan((alt * Math.PI) / 180);
  const oneDecimal = r.toFixed(1);
  return Number(oneDecimal) < 10 ? oneDecimal : String(Math.round(r));
}

/** Lectura de la posició: "225° SO · +31° · ombra 1.6× cap a NE" (l'ombra, només amb el sol ≥ 5°). */
export function readoutCoords(az: number, alt: number, lang: Language, t: Pick<SolarStrings, 'shadow'>): string {
  const base = `${azText(az, lang)} · ${signedDeg(alt)}`;
  const r = shadowRatio(alt);
  return r === null ? base : `${base} · ${fill(t.shadow, { r, dir: getCardinalLabel(az + 180, lang) })}`;
}

const timeOf = (v: string | TimeText | null | undefined): string | null =>
  v == null ? null : typeof v === 'string' ? v : v.text;

/** Interval d'hores "07:34–08:29"; només inici "22:35 …"; només final "… 02:56"; cap => null. */
export function formatRange(a: string | TimeText | null | undefined, b: string | TimeText | null | undefined): string | null {
  const s = timeOf(a), e = timeOf(b);
  if (s !== null && e !== null) return `${s}–${e}`;
  if (s !== null) return `${s} …`;
  if (e !== null) return `… ${e}`;
  return null;
}

/** Coordenades amb 2 decimals i hemisferi: "41.98° N 2.82° E"; oest = "W" en anglès, "O" en ca/es/fr. */
export function formatLatLon(lat: number, lon: number, lang: Language): string {
  const west = lang === 'en' ? 'W' : 'O';
  // Espai no separable dins de cada coordenada: "2.82° E" mai es parteix entre dues línies.
  return `${Math.abs(lat).toFixed(2)}°\u00A0${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(2)}°\u00A0${lon < 0 ? west : 'E'}`;
}

/**
 * Data darrere de "fins" / "hasta el" / "until" / "jusqu'au" (plantilles noForecast, uvUntil, sourceForecast).
 * Català: "al 14 d’octubre", però "a l’1" i "a l’11" (s'apostrofa); francès: "1er novembre".
 */
export function untilDateText(dateStr: string, lang: Language, locale: string): string {
  const text = formatDateStr(dateStr, locale, 'dayMonthLong');
  const day = Number(dateStr.slice(8, 10));
  if (lang === 'ca') return day === 1 || day === 11 ? `a l’${text}` : `al ${text}`;
  if (lang === 'fr' && day === 1) return text.replace(/^1(?=\s)/, '1er');
  return text;
}

/** Distància del migdia solar a les 12:00 (minuts amb signe) en text: "1h 36m després de les 12:00", "36 min abans…". */
export function formatOffsetFromNoon(min: number, t: Pick<SolarStrings, 'noonAfter' | 'noonBefore' | 'noonExact'>): string {
  const m = Math.round(min);
  if (!Number.isFinite(m) || m === 0) return t.noonExact;
  const a = Math.abs(m);
  const d = a >= 60 ? `${Math.floor(a / 60)}h ${pad2(a % 60)}m` : `${a} min`;
  return fill(m > 0 ? t.noonAfter : t.noonBefore, { d });
}

// Dins del modal (fons fosc) el vermell i el porpra de la categoria UV passen al to 400 per contrast.
const UV_CLASS_REMAP: Readonly<Record<string, string>> = {
  'text-red-500': 'text-red-400',
  'text-purple-500': 'text-purple-400',
};

/** UV amb un decimal (com la targeta) i la classe de color de la seva categoria; dada absent => null. */
export function uvDisplay(v: number | null | undefined): { text: string; cls: string } | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const cls = getUVCategory(v).color;
  return { text: v.toFixed(1), cls: UV_CLASS_REMAP[cls] ?? cls };
}
