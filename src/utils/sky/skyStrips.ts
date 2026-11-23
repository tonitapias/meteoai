// src/utils/sky/skyStrips.ts
// Les franges de la pestanya Cel: la de llum del sol (nit, crepuscles astronòmic i nàutic, hora blava, hora daurada,
// dia) i la del cel previst de la nit. Les dues es pinten com la franja del cel de Previsió: un degradat amb talls nets.
import { geometricAltitude, lightPhase, type LightPhase, type SolarDayModel } from '../solar/solarDay';
import { SKY_COLORS } from '../daySky';
import type { NightSkyCell } from './nightSky';

/** Colors de cada fase de llum: de fosc a clar, perquè s'ordenin també per lluminositat (no només per to). */
export const LIGHT_COLORS: Readonly<Record<LightPhase, string>> = {
  night: '#0d1226',
  astro: '#18213f',
  nautical: '#26386b',
  blue: '#3d5fa8',
  golden: '#c98a35',
  day: '#e9b949',
};

export interface ColorSpan { from: number; to: number; color: string }

const pct = (v: number) => `${Number((Math.min(1, Math.max(0, v)) * 100).toFixed(3))}%`;

/** Degradat CSS amb talls nets; els buits queden transparents (s'hi veu la pista). 'none' sense trams. */
export function spansBackground(spans: ReadonlyArray<ColorSpan>): string {
  if (spans.length === 0) return 'none';
  const stops: string[] = [];
  let cursor = 0;
  for (const s of [...spans].sort((a, b) => a.from - b.from)) {
    if (s.from > cursor + 1e-6) stops.push(`transparent ${pct(cursor)} ${pct(s.from)}`);
    stops.push(`${s.color} ${pct(s.from)} ${pct(s.to)}`);
    cursor = s.to;
  }
  if (cursor < 1 - 1e-6) stops.push(`transparent ${pct(cursor)} 100%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** Fases de llum d'un dia sencer (les 97 mostres del model del modal), en fraccions del dia. Model lite: cap. */
export function dayLightSpans(model: Pick<SolarDayModel, 'altApp'>): ColorSpan[] {
  const n = model.altApp.length - 1;
  if (n < 1) return [];
  const out: Array<ColorSpan & { phase: LightPhase }> = [];
  for (let i = 0; i <= n; i++) {
    const phase = lightPhase(geometricAltitude(model.altApp[i]));
    const from = Math.max(0, (i - 0.5) / n), to = Math.min(1, (i + 0.5) / n);
    const last = out[out.length - 1];
    if (last && last.phase === phase) last.to = to;
    else out.push({ from, to, color: LIGHT_COLORS[phase], phase });
  }
  return out.map(({ from, to, color }) => ({ from, to, color }));
}

/** El cel previst d'un dia sencer, hora a hora, amb els colors de dia i de nit de la franja de Previsió (com la seva fila). */
export function daySkySpans(cells: ReadonlyArray<NightSkyCell>): ColorSpan[] {
  return cells.flatMap(c => (c.kind ? [{ from: c.from, to: c.to, color: SKY_COLORS[c.kind][c.isDay ? 'day' : 'night'] }] : []));
}

/**
 * El cel previst de la nit, hora a hora, amb els colors de nit de la franja de Previsió. Sempre els de nit: la finestra
 * comença a la posta, i l'hora de la posta (is_day = 1 a l'API) sortia amb el groc del sol en una franja de nit.
 */
export function nightSkySpans(cells: ReadonlyArray<NightSkyCell>): ColorSpan[] {
  return cells.flatMap(c => (c.kind ? [{ from: c.from, to: c.to, color: SKY_COLORS[c.kind].night }] : []));
}
