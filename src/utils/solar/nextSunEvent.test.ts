// src/utils/solar/nextSunEvent.test.ts
// La pròxima sortida o posta (nom accessible de la targeta Cicle solar): la mateixa que compta enrere la targeta.
import { describe, it, expect, beforeEach } from 'vitest';
import { nextSunEvent } from './nextSunEvent';
import { clearSolarDayCache } from './solarDay';

// Girona, 2026-10-07 (CEST, UTC+2): hores locals d'Open-Meteo a menys de 10 min de suncalc (es fan servir), com a
// SunPanel.test.tsx.
const DAILY = {
  time: ['2026-10-07', '2026-10-08'],
  sunrise: ['2026-10-07T07:51', '2026-10-08T07:52'],
  sunset: ['2026-10-07T19:20', '2026-10-08T19:18'],
};
const at = (iso: string) => Date.parse(iso);
const girona = (nowMs: number, daily: typeof DAILY | undefined = DAILY) =>
  nextSunEvent(nowMs, 41.98, 2.82, 'Europe/Madrid', 7200, daily);

beforeEach(() => clearSolarDayCache());

describe('nextSunEvent', () => {
  it("abans de sortir el sol, la sortida d'avui", () => {
    expect(girona(at('2026-10-07T03:00:00Z'))).toEqual({ kind: 'sunrise', time: '07:51' }); // 05:00 local
  });

  it("de dia, la posta d'avui", () => {
    expect(girona(at('2026-10-07T14:07:00Z'))).toEqual({ kind: 'sunset', time: '19:20' }); // 16:07 local
  });

  it('després de la posta, la sortida de demà (amb la seva hora, no la d\'avui)', () => {
    expect(girona(at('2026-10-07T19:00:00Z'))).toEqual({ kind: 'sunrise', time: '07:52' }); // 21:00 local
  });

  it("sense hores d'Open-Meteo, l'hora astronòmica (a pocs minuts de la d'Open-Meteo)", () => {
    const next = girona(at('2026-10-07T14:07:00Z'), undefined);
    expect(next?.kind).toBe('sunset');
    expect(next?.time).toMatch(/^19:[12]\d$/);
  });

  it('nit polar: cap sortida ni posta', () => {
    // Longyearbyen (78° N) a mitjan desembre.
    expect(nextSunEvent(at('2026-12-15T11:00:00Z'), 78.22, 15.65, 'Arctic/Longyearbyen', 3600, undefined)).toBeNull();
  });

  it('sense coordenades vàlides, null (mai una hora inventada)', () => {
    expect(nextSunEvent(at('2026-10-07T14:07:00Z'), undefined, 2.82, 'Europe/Madrid', 7200, DAILY)).toBeNull();
    expect(nextSunEvent(at('2026-10-07T14:07:00Z'), 95, 2.82, 'Europe/Madrid', 7200, DAILY)).toBeNull();
    expect(nextSunEvent(Number.NaN, 41.98, 2.82, 'Europe/Madrid', 7200, DAILY)).toBeNull();
  });
});
