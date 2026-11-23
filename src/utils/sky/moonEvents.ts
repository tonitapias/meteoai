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

export function moonRiseSetAround(nowMs: number, lat: number, lon: number): MoonRiseSetAround {
  const empty: MoonRiseSetAround = { up: false, riseMs: null, setMs: null };
  if (!Number.isFinite(nowMs) || !Number.isFinite(lat) || !Number.isFinite(lon)) return empty;
  const rises: number[] = [];
  const sets: number[] = [];
  const base = Math.floor(nowMs / DAY) * DAY;
  try {
    for (let k = -2; k <= 3; k++) {
      const r = SunCalc.getMoonTimes(new Date(base + k * DAY), lat, lon);
      if (r.rise instanceof Date && !isNaN(r.rise.getTime())) rises.push(r.rise.getTime());
      if (r.set instanceof Date && !isNaN(r.set.getTime())) sets.push(r.set.getTime());
    }
  } catch {
    return empty;
  }
  rises.sort((a, b) => a - b);
  sets.sort((a, b) => a - b);
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
