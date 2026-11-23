// src/utils/sky/nightVerdict.ts
// La frase del plafó «Aquesta nit»: quin cel farà (del cel previst hora a hora, la franja de Previsió), si hi haurà
// lluna i si el cel canvia a mitja nit. Regles simples i deterministes; els textos són a components/sky/skyI18n.ts.
import type { SkyKind } from '../daySky';
import type { MoonSample, NightSkyCell } from './nightSky';

export type NightSkyClass = 'clear' | 'mixed' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'unknown';
export type MoonPresence = 'bright' | 'some' | 'none';
export type NightTitle =
  | 'clearMoon' | 'clearDark' | 'clear' | 'mixedMoon' | 'mixed' | 'cloudyMoon' | 'cloudy'
  | 'rain' | 'snow' | 'storm' | 'unknown';

export interface NightVerdict {
  sky: NightSkyClass;
  moon: MoonPresence;
  title: NightTitle;
  /** El cel s'obre (o es tapa) a partir de `atMs` i ja no canvia fins a l'alba. */
  change: { kind: 'opens' | 'closes'; atMs: number } | null;
}

const OPEN: ReadonlySet<SkyKind> = new Set(['clear', 'partly']);
const PRECIP: ReadonlySet<SkyKind> = new Set(['rain', 'snow', 'storm']);
const HOUR = 3600000;

/** Hores mínimes de cel obert (o tapat) seguides fins a l'alba perquè compti com a canvi. */
export const CHANGE_MIN_HOURS = 3;
/** Part de la nit amb dades del cel per sota de la qual no es diu res del cel. */
export const MIN_KNOWN_SHARE = 0.5;
/** Part de la nit amb precipitació a partir de la qual és «nit de pluja/neu/tempestes». */
export const PRECIP_SHARE = 0.3;
/** Part de la nit amb cel obert (serè o clarianes) per ser «serè» (≥) o «tapat» (≤ el complement). */
export const CLEAR_SHARE = 0.75;
/** Lluna «ben visible»: il·luminada almenys aquest % i a sobre de l'horitzó almenys aquesta part de la nit. */
export const BRIGHT_MOON_PCT = 60;
export const BRIGHT_MOON_UP_SHARE = 0.4;
/** Per sota d'aquest % (o sense sortir en tota la nit) la lluna no compta: nit fosca. */
export const DARK_MOON_PCT = 10;

const dur = (c: NightSkyCell) => c.endMs - c.startMs;

/** Classe del cel de la nit (només les hores amb codi). */
export function classifyNightSky(cells: ReadonlyArray<NightSkyCell>, windowMs: number): NightSkyClass {
  const known = cells.filter(c => c.kind !== null);
  const knownMs = known.reduce((s, c) => s + dur(c), 0);
  if (windowMs <= 0 || knownMs < windowMs * MIN_KNOWN_SHARE) return 'unknown';
  const by = (kinds: ReadonlySet<SkyKind>) => known.filter(c => kinds.has(c.kind as SkyKind)).reduce((s, c) => s + dur(c), 0);
  const precipMs = by(PRECIP);
  if (precipMs >= knownMs * PRECIP_SHARE) {
    const ofKind = (k: SkyKind) => known.filter(c => c.kind === k).reduce((s, c) => s + dur(c), 0);
    const ranked = (['storm', 'snow', 'rain'] as const).map(k => [k, ofKind(k)] as const).sort((a, b) => b[1] - a[1]);
    return ranked[0][0];
  }
  const openShare = by(OPEN) / knownMs;
  if (openShare >= CLEAR_SHARE) return 'clear';
  if (openShare <= 1 - CLEAR_SHARE) return 'cloudy';
  return 'mixed';
}

/**
 * Canvi de cel: el primer instant a partir del qual tot el que queda de nit és obert (s'obre) o tapat (es tapa) durant
 * almenys CHANGE_MIN_HOURS, quan abans d'aquest instant hi havia almenys una hora majoritàriament de l'altre signe.
 */
export function nightSkyChange(cells: ReadonlyArray<NightSkyCell>): NightVerdict['change'] {
  const known = cells.filter(c => c.kind !== null);
  for (let k = 1; k < known.length; k++) {
    const after = known.slice(k), before = known.slice(0, k);
    const afterMs = after.reduce((s, c) => s + dur(c), 0);
    const beforeMs = before.reduce((s, c) => s + dur(c), 0);
    if (afterMs < CHANGE_MIN_HOURS * HOUR || beforeMs < HOUR) continue;
    const openBefore = before.filter(c => OPEN.has(c.kind as SkyKind)).reduce((s, c) => s + dur(c), 0) / beforeMs;
    const allOpen = after.every(c => OPEN.has(c.kind as SkyKind));
    const allClosed = after.every(c => !OPEN.has(c.kind as SkyKind));
    if (allOpen && openBefore < 0.5) return { kind: 'opens', atMs: after[0].startMs };
    if (allClosed && openBefore >= 0.5) return { kind: 'closes', atMs: after[0].startMs };
  }
  return null;
}

/** Com hi és la lluna aquesta nit: ben visible, una part o gens. */
export function moonPresence(samples: ReadonlyArray<MoonSample>, illuminationPct: number): MoonPresence {
  if (samples.length === 0) return 'none';
  const upShare = samples.filter(s => s.alt > 0).length / samples.length;
  if (upShare === 0 || illuminationPct < DARK_MOON_PCT) return 'none';
  if (illuminationPct >= BRIGHT_MOON_PCT && upShare >= BRIGHT_MOON_UP_SHARE) return 'bright';
  return 'some';
}

const TITLES: Record<Exclude<NightSkyClass, 'rain' | 'snow' | 'storm' | 'unknown'>, Record<MoonPresence, NightTitle>> = {
  clear: { bright: 'clearMoon', some: 'clear', none: 'clearDark' },
  mixed: { bright: 'mixedMoon', some: 'mixed', none: 'mixed' },
  cloudy: { bright: 'cloudyMoon', some: 'cloudy', none: 'cloudy' },
};

export function nightVerdict(
  cells: ReadonlyArray<NightSkyCell>, windowMs: number, samples: ReadonlyArray<MoonSample>, illuminationPct: number,
): NightVerdict {
  const sky = classifyNightSky(cells, windowMs);
  const moon = moonPresence(samples, illuminationPct);
  const title: NightTitle = sky === 'clear' || sky === 'mixed' || sky === 'cloudy' ? TITLES[sky][moon] : sky;
  return { sky, moon, title, change: sky === 'unknown' ? null : nightSkyChange(cells) };
}
