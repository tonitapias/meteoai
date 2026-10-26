// src/utils/lunarPhases.test.ts
// Font de veritat independent: taules de fases de l'USNO (aa.usno.navy.mil/api/moon/phases/year),
// en UTC i arrodonides al minut. N = lluna nova, Q1 = quart creixent, F = plena, Q3 = quart minvant.
import { describe, it, expect } from 'vitest';
import * as SunCalc from 'suncalc';
import { principalPhaseMs, getMoonPhase, getMoonAgeDays, getMoonPhaseName, getNamedMoonPhase } from './lunarPhases';

const USNO_2026_2027 = [
  'F 2026-01-03T10:03', 'Q3 2026-01-10T15:48', 'N 2026-01-18T19:52', 'Q1 2026-01-26T04:47',
  'F 2026-02-01T22:09', 'Q3 2026-02-09T12:43', 'N 2026-02-17T12:01', 'Q1 2026-02-24T12:27',
  'F 2026-03-03T11:38', 'Q3 2026-03-11T09:38', 'N 2026-03-19T01:23', 'Q1 2026-03-25T19:18',
  'F 2026-04-02T02:12', 'Q3 2026-04-10T04:51', 'N 2026-04-17T11:52', 'Q1 2026-04-24T02:32',
  'F 2026-05-01T17:23', 'Q3 2026-05-09T21:10', 'N 2026-05-16T20:01', 'Q1 2026-05-23T11:11',
  'F 2026-05-31T08:45', 'Q3 2026-06-08T10:00', 'N 2026-06-15T02:54', 'Q1 2026-06-21T21:55',
  'F 2026-06-29T23:56', 'Q3 2026-07-07T19:29', 'N 2026-07-14T09:43', 'Q1 2026-07-21T11:05',
  'F 2026-07-29T14:36', 'Q3 2026-08-06T02:21', 'N 2026-08-12T17:37', 'Q1 2026-08-20T02:46',
  'F 2026-08-28T04:18', 'Q3 2026-09-04T07:51', 'N 2026-09-11T03:27', 'Q1 2026-09-18T20:44',
  'F 2026-09-26T16:49', 'Q3 2026-10-03T13:25', 'N 2026-10-10T15:50', 'Q1 2026-10-18T16:12',
  'F 2026-10-26T04:12', 'Q3 2026-11-01T20:28', 'N 2026-11-09T07:02', 'Q1 2026-11-17T11:48',
  'F 2026-11-24T14:53', 'Q3 2026-12-01T06:08', 'N 2026-12-09T00:52', 'Q1 2026-12-17T05:42',
  'F 2026-12-24T01:28', 'Q3 2026-12-30T18:59',
  'N 2027-01-07T20:24', 'Q1 2027-01-15T20:34', 'F 2027-01-22T12:17', 'Q3 2027-01-29T10:55',
  'N 2027-02-06T15:56', 'Q1 2027-02-14T07:58', 'F 2027-02-20T23:23', 'Q3 2027-02-28T05:16',
  'N 2027-03-08T09:29', 'Q1 2027-03-15T16:25', 'F 2027-03-22T10:44', 'Q3 2027-03-30T00:54',
  'N 2027-04-06T23:51', 'Q1 2027-04-13T22:56', 'F 2027-04-20T22:27', 'Q3 2027-04-28T20:18',
  'N 2027-05-06T10:58', 'Q1 2027-05-13T04:44', 'F 2027-05-20T10:59', 'Q3 2027-05-28T13:58',
  'N 2027-06-04T19:40', 'Q1 2027-06-11T10:56', 'F 2027-06-19T00:44', 'Q3 2027-06-27T04:54',
  'N 2027-07-04T03:02', 'Q1 2027-07-10T18:39', 'F 2027-07-18T15:45', 'Q3 2027-07-26T16:55',
  'N 2027-08-02T10:05', 'Q1 2027-08-09T04:54', 'F 2027-08-17T07:29', 'Q3 2027-08-25T02:27',
  'N 2027-08-31T17:41', 'Q1 2027-09-07T18:31', 'F 2027-09-15T23:03', 'Q3 2027-09-23T10:20',
  'N 2027-09-30T02:36', 'Q1 2027-10-07T11:47', 'F 2027-10-15T13:47', 'Q3 2027-10-22T17:29',
  'N 2027-10-29T13:36', 'Q1 2027-11-06T08:00', 'F 2027-11-14T03:26', 'Q3 2027-11-21T00:48',
  'N 2027-11-28T03:24', 'Q1 2027-12-06T05:22', 'F 2027-12-13T16:09', 'Q3 2027-12-20T09:11',
  'N 2027-12-27T20:12',
].map((row) => {
  const [code, iso] = row.split(' ');
  return { code, ms: Date.parse(`${iso}:00Z`), phase: { N: 0, Q1: 0.25, F: 0.5, Q3: 0.75 }[code]! };
});

const MIN_MS = 60000;
const LUNATION_MS = 29.530588861 * 86400000;
const K0_MS = principalPhaseMs(0);
// k de la fase principal més propera a un instant, ja amb la fracció del tipus de fase demanat.
const kFor = (ms: number, phase: number) => Math.round((ms - K0_MS) / LUNATION_MS - phase) + phase;

describe('principalPhaseMs (contra les taules de l\'USNO)', () => {
  it('reprodueix les 99 fases principals de 2026-2027 amb menys de 2,5 min d\'error', () => {
    const errorsMin = USNO_2026_2027.map(({ ms, phase }) => Math.abs(principalPhaseMs(kFor(ms, phase)) - ms) / MIN_MS);
    expect(errorsMin).toHaveLength(99);
    expect(Math.max(...errorsMin)).toBeLessThan(2.5);
  });
});

describe('getMoonPhase', () => {
  it('val exactament 0 / 0.25 / 0.5 / 0.75 als instants de l\'USNO (± 3 min)', () => {
    const tolerance = (3 * MIN_MS) / LUNATION_MS;
    for (const { ms, phase } of USNO_2026_2027) {
      const p = getMoonPhase(new Date(ms));
      const diff = Math.abs(p - phase);
      expect(Math.min(diff, 1 - diff), `${new Date(ms).toISOString()} → ${p}`).toBeLessThan(tolerance);
    }
  });

  it('creix de manera contínua (hora a hora durant 2026) i només torna a 0 a la lluna nova', () => {
    let prev = getMoonPhase(new Date(Date.UTC(2026, 0, 1)));
    let wraps = 0;
    for (let t = Date.UTC(2026, 0, 1, 1); t < Date.UTC(2027, 0, 1); t += 3600000) {
      const p = getMoonPhase(new Date(t));
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
      if (p < prev) { wraps++; expect(prev - p).toBeGreaterThan(0.99); }
      else expect(p - prev).toBeLessThan(0.003);
      prev = p;
    }
    expect(wraps).toBe(12); // 12 llunes noves el 2026
  });

  // SunCalc té en compte la latitud lunar (per això una plena no arriba mai al 100 %): mesurat, 2,0 punts
  // de màxim el 2026-2027 (la fórmula antiga, 7,7).
  it('la il·luminació que en deriva l\'app no s\'aparta més de 3 punts de la de SunCalc', () => {
    let maxDiff = 0;
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 3600000) {
      const d = new Date(t);
      const fromPhase = (1 - Math.cos(getMoonPhase(d) * 2 * Math.PI)) / 2;
      maxDiff = Math.max(maxDiff, Math.abs(fromPhase - SunCalc.getMoonIllumination(d).fraction) * 100);
    }
    expect(maxDiff).toBeLessThan(3);
  });

  it('retorna NaN per a una data invàlida', () => {
    expect(getMoonPhase(new Date('no és una data'))).toBeNaN();
  });
});

describe('getMoonAgeDays', () => {
  it('compta els dies des de la lluna nova real (10-10-2026 15:50 UTC)', () => {
    // Amb la lunació mitjana el giny deia "Dia 7": la Lluna en tenia 7,97.
    expect(getMoonAgeDays(new Date(Date.UTC(2026, 9, 18, 15, 0)))).toBe(8);
    expect(getMoonAgeDays(new Date(Date.UTC(2026, 9, 10, 16, 0)))).toBe(0);
    expect(getMoonAgeDays(new Date(Date.UTC(2026, 10, 8, 19, 0)))).toBe(29); // 12 h abans de la nova següent
    expect(getMoonAgeDays(new Date(Date.UTC(2026, 10, 9, 7, 30)))).toBe(0);   // 28 min després
  });

  it('retorna NaN per a una data invàlida', () => {
    expect(getMoonAgeDays(new Date(NaN))).toBeNaN();
  });
});

describe('getNamedMoonPhase (nom del dia)', () => {
    // Plena del 26-10-2026 a les 04:12 UTC (vegeu getNextMoonEvent): tot el dia es diu "Lluna Plena".
    it('el vespre del dia de la plena es diu "Lluna Plena", tot i que la fase real ja passa de 0,52', () => {
        const evening = new Date('2026-10-26T18:26:00Z');
        expect(getMoonPhase(evening)).toBeGreaterThan(0.52);
        expect(getNamedMoonPhase(evening)).toBe(0.5);
        expect(getMoonPhaseName(getNamedMoonPhase(evening), 'ca')).toBe('Lluna Plena');
        expect(getMoonPhaseName(getMoonPhase(evening), 'ca')).toBe('Gibosa Minvant');
    });

    it("l'endemà ja torna a ser la fase real (gibosa minvant)", () => {
        const next = new Date('2026-10-27T18:00:00Z');
        expect(getNamedMoonPhase(next)).toBe(getMoonPhase(next));
        expect(getMoonPhaseName(getNamedMoonPhase(next), 'ca')).toBe('Gibosa Minvant');
    });

    it('també el dia de la lluna nova i dels quarts', () => {
        const nk = principalPhaseMs(330);          // una lluna nova qualsevol
        const sameDayLater = new Date(Math.floor(nk / 86400000) * 86400000 + 86399000);
        expect(getNamedMoonPhase(sameDayLater)).toBe(0);
        const fq = principalPhaseMs(330.25);
        expect(getNamedMoonPhase(new Date(Math.floor(fq / 86400000) * 86400000))).toBe(0.25);
    });

    it('data no vàlida: NaN', () => {
        expect(getNamedMoonPhase(new Date('x'))).toBeNaN();
    });
});
