// src/utils/sky/moonEvents.ts
// Sortida i posta de la lluna «al voltant d'ara»: si és a dalt, quan va sortir i quan es pondrà; si és a baix, quan
// sortirà i quan es pondrà després. Abans la targeta donava les del dia local i, de nit, deia «↓ 06:26» per una posta
// que ja havia passat aquell matí (la pròxima era l'endemà a les 07:46).
import * as SunCalc from 'suncalc';

const DAY = 86400000;

export interface MoonRiseSetAround {
  /** La lluna és a sobre de l'horitzó ara. */
  up: boolean;
  /** A dalt: la sortida d'aquest pas (ja passada). A baix: la pròxima sortida. */
  riseMs: number | null;
  /** La pròxima posta (a dalt: la d'aquest pas; a baix: la que segueix la pròxima sortida). */
  setMs: number | null;
}

/**
 * Les sortides i postes de la lluna entre dos instants (inclosos), ordenades. Són les de SunCalc.getMoonTimes: el limb
 * superior a l'horitzó, amb la refracció (la convenció de l'USNO i de timeanddate). Les fan servir el modal Fase lunar, la
 * fila de la lluna i l'arc del plafó «Aquesta nit», que abans buscava el pas del centre del disc per 0° i donava la
 * sortida uns 2,5 min més tard i la posta uns 2,5 min abans que el modal.
 */
export function moonTimesBetween(fromMs: number, toMs: number, lat: number, lon: number): { rises: number[]; sets: number[] } {
  const rises: number[] = [];
  const sets: number[] = [];
  if (![fromMs, toMs, lat, lon].every(Number.isFinite) || toMs < fromMs) return { rises, sets };
  const inside = (d: unknown): d is Date => d instanceof Date && d.getTime() >= fromMs && d.getTime() <= toMs;
  // getMoonTimes mira el dia UTC de la data que rep.
  for (let day = Math.floor(fromMs / DAY) * DAY; day <= toMs; day += DAY) {
    const r = SunCalc.getMoonTimes(new Date(day), lat, lon);
    if (inside(r.rise)) rises.push(r.rise.getTime());
    if (inside(r.set)) sets.push(r.set.getTime());
  }
  // Un esdeveniment a tocar de mitjanit UTC pot sortir als dos dies (dues del mateix tipus disten ~24 h 50 min).
  const tidy = (list: number[]) => list.sort((a, b) => a - b).filter((t, i, all) => i === 0 || t - all[i - 1] > 3600000);
  return { rises: tidy(rises), sets: tidy(sets) };
}

export function moonRiseSetAround(nowMs: number, lat: number, lon: number): MoonRiseSetAround {
  const empty: MoonRiseSetAround = { up: false, riseMs: null, setMs: null };
  if (!Number.isFinite(nowMs) || !Number.isFinite(lat) || !Number.isFinite(lon)) return empty;
  const base = Math.floor(nowMs / DAY) * DAY;
  let rises: number[];
  let sets: number[];
  try {
    ({ rises, sets } = moonTimesBetween(base - 2 * DAY, base + 4 * DAY - 1, lat, lon));
  } catch {
    return empty;
  }
  const lastRise = [...rises].reverse().find(t => t <= nowMs);
  const lastSet = [...sets].reverse().find(t => t <= nowMs);
  const up = lastRise !== undefined || lastSet !== undefined
    ? lastRise !== undefined && (lastSet === undefined || lastRise > lastSet)
    : SunCalc.getMoonPosition(new Date(nowMs), lat, lon).altitude > 0;
  if (up) {
    return { up, riseMs: lastRise ?? null, setMs: sets.find(t => t > nowMs) ?? null };
  }
  const riseMs = rises.find(t => t > nowMs) ?? null;
  const setMs = riseMs === null ? null : sets.find(t => t > riseMs) ?? null;
  return { up, riseMs, setMs };
}
