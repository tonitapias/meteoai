// src/utils/sky/moonEvents.test.ts
// Sortida i posta de la lluna al voltant d'ara (Barcelona, 23/11/2026, UTC+1): de nit, la posta de DEMÀ (07:46), no la
// d'aquell matí (06:26) que donava la targeta d'abans.
import { describe, it, expect } from 'vitest';
import { moonRiseSetAround, moonTimesBetween } from './moonEvents';
import { localClock, localDateOf, makeZoneCtx } from '../solar/solarTime';

const BCN = { lat: 41.38879, lon: 2.15899 };
const zone = makeZoneCtx('Europe/Madrid', 3600);
const at = (iso: string) => new Date(iso).getTime();
const near = (ms: number | null, hhmm: string, date: string) => {
  expect(ms).not.toBeNull();
  expect(localDateOf(ms as number, zone)).toBe(date);
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  expect(Math.abs(m(localClock(ms as number, zone)) - m(hhmm))).toBeLessThanOrEqual(2);
};

describe('moonRiseSetAround', () => {
  it('a les 19:26, amb la lluna a dalt: va sortir a les 16:13 i es pon demà a les 07:46', () => {
    const r = moonRiseSetAround(at('2026-11-23T18:26:00Z'), BCN.lat, BCN.lon);
    expect(r.up).toBe(true);
    near(r.riseMs, '16:13', '2026-11-23');
    near(r.setMs, '07:46', '2026-11-24');
  });

  it('a les 12:00, amb la lluna a baix: surt a les 16:13 i es pon demà a les 07:46', () => {
    const r = moonRiseSetAround(at('2026-11-23T11:00:00Z'), BCN.lat, BCN.lon);
    expect(r.up).toBe(false);
    near(r.riseMs, '16:13', '2026-11-23');
    near(r.setMs, '07:46', '2026-11-24');
  });

  it('coordenades no vàlides: res', () => {
    expect(moonRiseSetAround(at('2026-11-23T18:26:00Z'), NaN, 2)).toEqual({ up: false, riseMs: null, setMs: null });
  });
});

describe('moonTimesBetween', () => {
  it('les de getMoonTimes dins del tram, ordenades i sense repetir (24 → 28/11: les hores de timeanddate)', () => {
    const { rises, sets } = moonTimesBetween(at('2026-11-23T23:00:00Z'), at('2026-11-28T23:00:00Z'), BCN.lat, BCN.lon);
    expect(rises.map(ms => localClock(ms, zone))).toEqual(['16:57', '17:53', '19:02', '20:19', '21:38']);
    expect(sets.map(ms => localClock(ms, zone))).toEqual(['07:46', '09:04', '10:13', '11:10', '11:54']);
  });

  it('els extrems hi compten; fora del tram o amb dades no vàlides, res', () => {
    const [rise] = moonTimesBetween(at('2026-11-28T00:00:00Z'), at('2026-11-29T00:00:00Z'), BCN.lat, BCN.lon).rises;
    expect(moonTimesBetween(rise, rise, BCN.lat, BCN.lon).rises).toEqual([rise]);
    expect(moonTimesBetween(rise + 1, rise + 3600000, BCN.lat, BCN.lon).rises).toEqual([]);
    expect(moonTimesBetween(rise, rise - 1, BCN.lat, BCN.lon)).toEqual({ rises: [], sets: [] });
    expect(moonTimesBetween(rise, rise + 86400000, NaN, BCN.lon)).toEqual({ rises: [], sets: [] });
  });
});
