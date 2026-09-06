import { describe, it, expect } from 'vitest';
import {
  getCardinalLabel,
  getMoonDistanceCategory,
  getMoonDistanceGaugePercent,
  getMoonRiseSetForDate,
  getNextMoonEvent,
  estimateSunsetQuality,
  getSunCompassPosition,
  getMoonCompassPosition,
  getSunDayTimesSafe,
} from './astronomyMath';

describe('getCardinalLabel', () => {
  it('maps known azimuths to the correct 16-point label', () => {
    expect(getCardinalLabel(0, 'ca')).toBe('N');
    expect(getCardinalLabel(90, 'ca')).toBe('E');
    expect(getCardinalLabel(180, 'ca')).toBe('S');
    expect(getCardinalLabel(270, 'ca')).toBe('O');
  });

  it('wraps a negative or >360 azimuth correctly', () => {
    expect(getCardinalLabel(-90, 'ca')).toBe('O');
    expect(getCardinalLabel(360, 'ca')).toBe('N');
    expect(getCardinalLabel(720 + 90, 'ca')).toBe('E');
  });

  it('uses English cardinal letters for lang=en', () => {
    expect(getCardinalLabel(270, 'en')).toBe('W');
  });

  it('falls back to ca for an unsupported language', () => {
    // @ts-expect-error deliberately invalid language to test the fallback branch
    expect(getCardinalLabel(0, 'xx')).toBe('N');
  });

  it('returns -- for invalid input', () => {
    expect(getCardinalLabel(NaN, 'ca')).toBe('--');
  });
});

describe('getSunCompassPosition / getMoonCompassPosition', () => {
  it('returns a plausible reading for a real location/date and null for invalid coords', () => {
    const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
    const sun = getSunCompassPosition(noon, 41.39, 2.16); // Barcelona
    expect(sun).not.toBeNull();
    expect(sun!.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(sun!.azimuthDeg).toBeLessThan(360);
    expect(sun!.altitudeDeg).toBeGreaterThan(0); // sol alt a migdia d'estiu

    expect(getSunCompassPosition(noon, NaN, 2.16)).toBeNull();

    const moon = getMoonCompassPosition(noon, 41.39, 2.16);
    expect(moon).not.toBeNull();
    expect(moon!.distanceKm).toBeGreaterThan(300000);
    expect(moon!.distanceKm).toBeLessThan(410000);
  });
});

describe('getSunDayTimesSafe', () => {
  it('returns an internally consistent chronological order for a valid day/location', () => {
    const t = getSunDayTimesSafe('2026-06-21', 41.39, 2.16);
    expect(t.sunrise).not.toBeNull();
    expect(t.sunset).not.toBeNull();
    expect(t.sunrise!.getTime()).toBeLessThan(t.solarNoon!.getTime());
    expect(t.solarNoon!.getTime()).toBeLessThan(t.sunset!.getTime());
    expect(t.astronomicalDawn!.getTime()).toBeLessThan(t.civilDawn!.getTime());
    expect(t.civilDawn!.getTime()).toBeLessThan(t.sunrise!.getTime());
  });

  it('returns all-null for invalid input instead of throwing', () => {
    expect(getSunDayTimesSafe(undefined, 41.39, 2.16).sunrise).toBeNull();
    expect(getSunDayTimesSafe('2026-06-21', NaN, 2.16).sunrise).toBeNull();
    expect(getSunDayTimesSafe('not-a-date', 41.39, 2.16).sunrise).toBeNull();
  });
});

describe('getMoonRiseSetForDate', () => {
  it('reproduces a plausible rise/set for a real location without throwing', () => {
    const result = getMoonRiseSetForDate('2026-06-21', 41.39, 2.16, 'Europe/Madrid');
    // Sobre 3 dies de finestra sempre n'hi ha almenys un dels dos (llevat de casos polars, no aplicable aquí)
    expect(result.rise.date || result.set.date).toBeTruthy();
  });

  it('returns empty events for invalid input instead of throwing', () => {
    const result = getMoonRiseSetForDate(undefined, 41.39, 2.16);
    expect(result.rise.date).toBeNull();
    expect(result.set.date).toBeNull();
  });
});

describe('getNextMoonEvent', () => {
  it('finds a full moon within 30 days of a known full moon minus a few days', () => {
    // Lluna plena real coneguda: 2026-01-03 ~10:03 UTC (referència pública d'efemèrides)
    const fromDate = new Date(Date.UTC(2025, 11, 30, 0, 0, 0));
    const result = getNextMoonEvent('full', fromDate, 30);
    expect(result).not.toBeNull();
    expect(result!.daysAhead).toBeGreaterThanOrEqual(0);
    expect(result!.daysAhead).toBeLessThanOrEqual(6);
  });

  it('handles the daysAhead===0 boundary (fromDate is already the event day)', () => {
    const nearFullDate = new Date(Date.UTC(2026, 0, 3, 12, 0, 0));
    const result = getNextMoonEvent('full', nearFullDate, 30);
    expect(result).not.toBeNull();
    expect(result!.daysAhead).toBeLessThanOrEqual(1);
  });

  it('detects a new moon across the phase wraparound (0.97 -> 0.02)', () => {
    const fromDate = new Date(Date.UTC(2025, 11, 16, 0, 0, 0));
    const result = getNextMoonEvent('new', fromDate, 30);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('new');
  });

  it('never returns null for a realistic maxDays given the ~29.53 day synodic month', () => {
    const result = getNextMoonEvent('full', new Date(), 45);
    expect(result).not.toBeNull();
  });
});

describe('getMoonDistanceCategory / getMoonDistanceGaugePercent', () => {
  it('classifies boundary values correctly', () => {
    expect(getMoonDistanceCategory(360000)).toBe('supermoon');
    expect(getMoonDistanceCategory(360001)).toBe('normal');
    expect(getMoonDistanceCategory(405000)).toBe('micromoon');
    expect(getMoonDistanceCategory(404999)).toBe('normal');
    expect(getMoonDistanceCategory(384400)).toBe('normal');
  });

  it('clamps the gauge percent to 0-100', () => {
    expect(getMoonDistanceGaugePercent(300000)).toBe(0);
    expect(getMoonDistanceGaugePercent(500000)).toBe(100);
    expect(getMoonDistanceGaugePercent(384400)).toBeGreaterThan(40);
    expect(getMoonDistanceGaugePercent(384400)).toBeLessThan(60);
  });
});

describe('estimateSunsetQuality', () => {
  it('returns null when any input is missing (Risc Zero — never fabricate a value)', () => {
    expect(estimateSunsetQuality(null, 50, 50)).toBeNull();
    expect(estimateSunsetQuality(50, undefined, 50)).toBeNull();
    expect(estimateSunsetQuality(50, 50, NaN)).toBeNull();
  });

  it('returns a score within 0-100 for valid inputs', () => {
    const score = estimateSunsetQuality(45, 45, 50);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(0);
    expect(score!).toBeLessThanOrEqual(100);
  });
});
