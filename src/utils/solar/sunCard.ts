// src/utils/solar/sunCard.ts
// Targeta Cicle solar del tauler (direcció "Cel viu"): la mateixa corba d'alçada, la mateixa rampa de color
// del cel i les mateixes fases de llum que el modal, a escala de targeta. Pur, sense React.
//
// No importa solarChart ni solarFormat a propòsit: tots dos arrosseguen el diccionari del modal (solarI18n),
// que viu al seu tros de codi diferit. Els formats d'aquí en són còpies exactes (sunCard.test.ts ho comprova).
import type { Language } from '../../translations';
import { getCardinalLabel } from '../astronomyMath';
import { type SolarDayModel, rangeAltMax, refractionDeg } from './solarDay';
import { SKY_BASE, hashSeed, mixLinear, mulberry32, skyColorAt } from './solarSky';

/** Sistema de coordenades de l'SVG (s'estira a la caixa: preserveAspectRatio none + traços sense escalar). */
export const CARD_W = 400;
export const CARD_H = 150;
/** Marge de dalt per a l'etiqueta del migdia. */
const TOP = 20;
/** La vora de baix és −18° (fi del crepuscle astronòmic); per sota, la corba surt de la caixa. */
const ALT_FLOOR = -18;
/** Part del color del cel que entra a la targeta (la resta és SKY_BASE). */
export const SKY_CARD_MIX = 0.66;
/** Per sota d'aquesta alçada geomètrica del sol, el cel de la targeta té estrelles. */
export const CARD_STARS_GEO = -10;

const r1 = (v: number) => Math.round(v * 10) / 10;
const f1 = (v: number) => r1(v).toFixed(1);

export interface SunCardBand { y: number; h: number }
export interface SunCardTick { x: number; label: string }

export interface SunCardGeom {
  /** Sostre de l'eix (múltiple de 10 per sobre del migdia + 8°, entre 30 i 90), com el modal. */
  altMax: number;
  /** y de l'horitzó. */
  yH: number;
  /** Corba de les 97 mostres aparents ('' en un model lite). */
  curve: string;
  /** Franges d'alçada que acoloreixen la corba: dia (≥ 6°), daurada [−4°, 6°), blava [−6°, −4°). */
  clip: { day: SunCardBand; gold: SunCardBand; blue: SunCardBand };
  /** Migdia solar: punt de la corba; null si el sol no passa de 2° (nit polar). */
  noon: { x: number; y: number } | null;
  /** x de la sortida i la posta sobre l'horitzó; null si cauen fora del dia o el dia és polar. */
  riseX: number | null;
  setX: number | null;
  /** Marques de 06, 12 i 18 h (minuts reals del dia: correctes els dies de canvi d'hora). */
  ticks: SunCardTick[];
  /** x d'un minut del dia. */
  x(min: number): number;
  /** y d'una alçada APARENT (sense límit per baix: la corba pot sortir de la caixa). */
  y(alt: number): number;
}

type GeomModel = Pick<SolarDayModel, 'altApp' | 'spanMin' | 'startMs' | 'endMs' | 't' | 'polar' | 'hourTicks'
  | 'noonMin' | 'noonAltApp'>;

const TICK_LABELS = new Set(['06', '12', '18']);

/** Geometria de la targeta per a un dia (no depèn de l'hora: es calcula un cop per dia i lloc). */
export function buildSunCardGeom(model: GeomModel): SunCardGeom {
  const span = model.spanMin > 0 ? model.spanMin : 1440;
  const altMax = rangeAltMax([model.noonAltApp]);
  const x = (min: number) => (min / span) * CARD_W;
  const y = (alt: number) => TOP + ((altMax - Math.min(alt, altMax)) / (altMax - ALT_FLOOR)) * (CARD_H - TOP);
  // Llindars GEOMÈTRICS a l'escala aparent de la corba (la mateixa refracció que suncalc).
  const yGeo = (geo: number) => y(geo + refractionDeg(geo));
  const band = (y0: number, y1: number): SunCardBand => ({ y: r1(y0), h: r1(Math.max(0, y1 - y0)) });

  const n = model.altApp.length;
  let curve = '';
  for (let i = 0; i < n; i++) {
    curve += `${i === 0 ? 'M' : 'L'}${f1(x((i * span) / (n - 1)))},${f1(y(Math.max(-90, model.altApp[i])))}`;
  }

  const edge = (ms: number | null) =>
    ms === null || model.polar !== 'none' || ms < model.startMs || ms >= model.endMs ? null : r1(x((ms - model.startMs) / 60000));

  return {
    altMax,
    yH: r1(y(0)),
    curve,
    clip: {
      day: band(-10, yGeo(6)),
      gold: band(yGeo(6), yGeo(-4)),
      blue: band(yGeo(-4), yGeo(-6)),
    },
    noon: model.noonAltApp >= 2 ? { x: r1(x(model.noonMin)), y: r1(y(model.noonAltApp)) } : null,
    riseX: edge(model.t.sunrise),
    setX: edge(model.t.sunset),
    ticks: model.hourTicks.filter(tk => TICK_LABELS.has(tk.label)).map(tk => ({ x: r1(x(tk.min)), label: tk.label })),
    x,
    y,
  };
}

/** Estrelles del cel de nit en un sol <path> de cercles petits: mateix dia i lloc => mateixes estrelles. */
export function sunCardStars(model: Pick<SolarDayModel, 'dateStr' | 'lat' | 'lon'>, yH: number, count = 28): string {
  const rand = mulberry32(hashSeed(`card|${model.dateStr}|${model.lat.toFixed(3)}|${model.lon.toFixed(3)}`));
  const yTop = 6, yBot = Math.max(yTop + 1, yH - 10);
  let d = '';
  for (let k = 0; k < count; k++) {
    const cx = rand() * CARD_W, cy = yTop + rand() * (yBot - yTop), r = r1(0.55 + rand() * 0.5);
    d += `M${f1(cx - r)},${f1(cy)}a${r},${r} 0 1,0 ${r1(2 * r)},0a${r},${r} 0 1,0 -${r1(2 * r)},0`;
  }
  return d;
}

/**
 * Fons de la caixa del gràfic: el cel d'ARA (no el de cada hora): de dalt fins a l'horitzó, del color del cel
 * 14° per sobre del sol al de l'horitzó; per sota, el terra (el mateix to, enfosquit). De dia surt blau, a la
 * posta càlid i de nit gairebé negre.
 */
export function sunCardSky(geoNow: number, yH: number): string {
  const top = mixLinear(skyColorAt(geoNow + 14), SKY_BASE, SKY_CARD_MIX);
  const hor = mixLinear(skyColorAt(geoNow - 1.5), SKY_BASE, SKY_CARD_MIX);
  const ground = mixLinear(hor, '#05070f', 0.28);
  const p = `${r1((yH / CARD_H) * 100)}%`;
  return `linear-gradient(180deg,${top} 0%,${hor} ${p},${ground} ${p},${ground} 100%)`;
}

// --- Formats: còpies exactes de solarFormat (paritat amb el modal Cicle solar) ---

export const MINUS = '−';
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Compte enrere "3h 12m", arrodonit avall; negatiu => null. */
export function formatCountdown(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const d = Math.floor(ms / 1000);
  return `${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m`;
}

/** Δ de durada del dia sense signe ("2 min 46 s", "42 s", "1h 05m"); |Δ| < 1 s => signe 0 i text buit. */
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

/** Graus enters ("39°", "−18°"). */
export function degText(v: number): string {
  const r = Math.round(v);
  return r < 0 ? `${MINUS}${-r}°` : `${r === 0 ? 0 : r}°`;
}

/** Graus enters amb signe ("+16°", "−33°", "0°"). */
export function signedDeg(alt: number): string {
  const r = Math.round(alt);
  if (!Number.isFinite(r) || r === 0) return '0°';
  return r > 0 ? `+${r}°` : `${MINUS}${-r}°`;
}

/** Azimut "102° ESE"; sense dada => "—". */
export function azText(az: number | null, lang: Language): string {
  return az === null ? '—' : `${((Math.round(az) % 360) + 360) % 360}° ${getCardinalLabel(az, lang)}`;
}
