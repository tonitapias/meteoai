// src/utils/sky/nightSky.test.ts
// La nit del plafó «Aquesta nit»: finestra de posta a sortida (també de matinada i de dia), nit polar, foscor, lluna,
// el cel de cada hora retallat a la finestra i el regle de 3 en 3 hores. Barcelona, 23 → 24/11/2026 (UTC+1).
import { describe, it, expect, beforeEach } from 'vitest';
import { buildNightSky, cloudHiddenSpans, findNightWindow, nextNightWindow, nightFraction, skyCellsFor } from './nightSky';
import { makeZoneCtx, localClock } from '../solar/solarTime';
import { clearSolarDayCache } from '../solar/solarDay';
import type { SkyHour, SkyKind } from '../daySky';

const BCN = { lat: 41.38879, lon: 2.15899 };
const zone = makeZoneCtx('Europe/Madrid', 3600);
const at = (iso: string) => new Date(iso).getTime();
const clock = (ms: number | null | undefined) => (typeof ms === 'number' ? localClock(ms, zone) : null);
const minutesApart = (a: string | null, b: string) => {
  if (!a) return Infinity;
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  return Math.abs(m(a) - m(b));
};

beforeEach(() => clearSolarDayCache());

describe('findNightWindow', () => {
  it('a les 19:26 és la nit en curs: de la posta (17:26) a la sortida de demà (07:50)', () => {
    const w = findNightWindow(at('2026-11-23T18:26:00Z'), BCN.lat, BCN.lon, zone)!;
    expect(w.polar).toBe('none');
    expect(minutesApart(clock(w.startMs), '17:26')).toBeLessThanOrEqual(1);
    expect(minutesApart(clock(w.endMs), '07:50')).toBeLessThanOrEqual(1);
  });

  it('de dia (15:15) és la nit que ve; de matinada (03:00), la que encara dura', () => {
    const day = findNightWindow(at('2026-11-23T14:15:00Z'), BCN.lat, BCN.lon, zone)!;
    const late = findNightWindow(at('2026-11-24T02:00:00Z'), BCN.lat, BCN.lon, zone)!;
    const evening = findNightWindow(at('2026-11-23T18:26:00Z'), BCN.lat, BCN.lon, zone)!;
    expect(day.startMs).toBe(evening.startMs);
    expect(late.startMs).toBe(evening.startMs);
    expect(late.endMs).toBe(evening.endMs);
  });

  it('un cop ha sortit el sol, la de la nit següent', () => {
    const w = findNightWindow(at('2026-11-24T07:00:00Z'), BCN.lat, BCN.lon, zone)!;
    expect(new Date(w.startMs).toISOString().slice(0, 10)).toBe('2026-11-24');
    const next = nextNightWindow(findNightWindow(at('2026-11-23T18:26:00Z'), BCN.lat, BCN.lon, zone)!, BCN.lat, BCN.lon, zone)!;
    expect(next.startMs).toBe(w.startMs);
  });

  it('fa servir les hores d\'Open-Meteo quan quadren amb l\'astronomia (com el modal)', () => {
    const daily = { time: ['2026-11-23', '2026-11-24'], sunrise: ['2026-11-23T07:48', '2026-11-24T07:49'], sunset: ['2026-11-23T17:27', '2026-11-24T17:26'] };
    const w = findNightWindow(at('2026-11-23T18:26:00Z'), BCN.lat, BCN.lon, zone, daily)!;
    expect(clock(w.startMs)).toBe('17:27');
    expect(clock(w.endMs)).toBe('07:49');
  });

  it('nit polar (Longyearbyen al novembre): 24 h de migdia a migdia; sol de mitjanit: cap nit', () => {
    const svalbard = makeZoneCtx('Arctic/Longyearbyen', 3600);
    const w = findNightWindow(at('2026-11-23T18:00:00Z'), 78.22, 15.65, svalbard)!;
    expect(w.polar).toBe('night');
    expect(w.endMs - w.startMs).toBe(86400000);
    expect(localClock(w.startMs, svalbard)).toBe('12:00');
    expect(findNightWindow(at('2026-06-21T12:00:00Z'), 78.22, 15.65, makeZoneCtx('Arctic/Longyearbyen', 7200))).toBeNull();
  });
});

describe('buildNightSky', () => {
  const kinds = (pattern: SkyKind[]): SkyHour[] => pattern.map((kind, hour) => ({ hour, kind, isDay: hour >= 8 && hour < 17 }));
  const daySky = {
    '2026-11-23': kinds(Array.from({ length: 24 }, (_, h) => (h < 21 ? 'cloudy' : 'partly'))),
    '2026-11-24': kinds(Array.from({ length: 24 }, (_, h) => (h < 2 ? 'cloudy' : 'clear'))),
  };
  const model = () => buildNightSky({ nowMs: at('2026-11-23T18:26:00Z'), ...BCN, zone, daySky })!;

  it('nit fosca de 19:03 a 06:12, i la franja de foscor comença daurada i passa per la nit', () => {
    const m = model();
    expect(minutesApart(clock(m.dark?.startMs), '19:03')).toBeLessThanOrEqual(1);
    expect(minutesApart(clock(m.dark?.endMs), '06:12')).toBeLessThanOrEqual(1);
    expect(m.darkness[0].phase).toBe('golden');
    expect(m.darkness[0].from).toBe(0);
    expect(m.darkness[m.darkness.length - 1].to).toBe(1);
    expect(m.darkness.map(s => s.phase)).toContain('night');
  });

  it('la lluna (ja sortida a les 16:13) culmina a 71° cap a les 23:55 i es pon a les 07:46', () => {
    const m = model();
    expect(m.moonRiseMs).toBeNull();
    expect(m.moonPeak!.alt).toBeGreaterThan(70);
    expect(m.moonPeak!.alt).toBeLessThan(73);
    expect(minutesApart(clock(m.moonPeak!.ms), '23:55')).toBeLessThanOrEqual(10);
    expect(minutesApart(clock(m.moonSetMs), '07:46')).toBeLessThanOrEqual(3);
    expect(m.moon[0].f).toBe(0);
    expect(m.moon[m.moon.length - 1].f).toBe(1);
  });

  it('el cel de cada hora, retallat a la finestra: la primera hora comença a la posta', () => {
    const m = model();
    expect(m.sky[0].from).toBe(0);
    expect(clock(m.sky[0].startMs)).toBe(clock(m.startMs));
    expect(m.sky[m.sky.length - 1].to).toBeCloseTo(1, 9);
    expect(m.sky.find(c => clock(c.startMs) === '21:00')?.kind).toBe('partly');
    expect(m.sky.find(c => clock(c.startMs) === '03:00')?.kind).toBe('clear');
    // La lluna, tapada de la posta a les 21 h i de 00 a 02 h.
    const hidden = cloudHiddenSpans(m.sky);
    expect(hidden).toHaveLength(2);
    expect(hidden[0].from).toBe(0);
    expect(clock(m.startMs + hidden[1].from * (m.endMs - m.startMs))).toBe('00:00');
  });

  it('el regle marca 18, 21, 00, 03 i 06', () => {
    expect(model().ticks.map(t => t.label)).toEqual(['18', '21', '00', '03', '06']);
  });

  it('sense franja del cel, cap hora (i cap rang de núvols)', () => {
    const m = buildNightSky({ nowMs: at('2026-11-23T18:26:00Z'), ...BCN, zone })!;
    expect(m.sky).toEqual([]);
    expect(m.cloudRange).toBeNull();
  });

  it('el rang de núvols és la cobertura efectiva de les hores de la nit', () => {
    const times: string[] = [];
    const low: number[] = [], high: number[] = [];
    for (const d of ['2026-11-23', '2026-11-24']) {
      for (let h = 0; h < 24; h++) {
        times.push(`${d}T${String(h).padStart(2, '0')}:00`);
        low.push(h === 20 && d === '2026-11-23' ? 80 : 10);
        high.push(0);
      }
    }
    const hourly = { time: times, cloud_cover_low: low, cloud_cover_mid: low.map(() => 0), cloud_cover_high: high };
    const m = buildNightSky({ nowMs: at('2026-11-23T18:26:00Z'), ...BCN, zone, daySky, hourly })!;
    expect(m.cloudRange).toEqual({ min: 10, max: 80 });
  });

  it('nightFraction: dins de la finestra, la seva fracció; fora, null', () => {
    const m = model();
    expect(nightFraction(m.startMs, m)).toBe(0);
    expect(nightFraction(m.endMs + 1, m)).toBeNull();
  });
});

describe('skyCellsFor (el dia del plafó del sol)', () => {
  it('les 24 hores d\'avui, de 00 a 24 h, amb el seu codi i si és de dia', () => {
    const daySky = { '2026-11-23': Array.from({ length: 24 }, (_, hour) => ({ hour, kind: (hour < 12 ? 'clear' : 'cloudy') as SkyKind, isDay: hour >= 8 && hour < 17 })) };
    const start = Date.parse('2026-11-22T23:00:00Z'), end = Date.parse('2026-11-23T23:00:00Z');
    const { cells } = skyCellsFor({ startMs: start, endMs: end }, zone, daySky);
    expect(cells).toHaveLength(24);
    expect(cells[0].from).toBe(0);
    expect(cells[23].to).toBeCloseTo(1, 9);
    expect(cells.filter(c => c.isDay)).toHaveLength(9);
    // El sol, tapat de les 12 a les 17 h (les hores de dia amb núvol).
    const hidden = cloudHiddenSpans(cells.filter(c => c.isDay));
    expect(hidden).toEqual([{ from: 12 / 24, to: 17 / 24 }]);
  });
});
