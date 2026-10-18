import { describe, it, expect } from 'vitest';
import {
  addDaysToDateStr,
  getCardinalLabel,
  getMoonDistanceCategory,
  getMoonDistanceGaugePercent,
  getMoonRiseSetForDate,
  getNextMoonEvent,
  estimateSunsetQuality,
  getMoonCompassPosition,
} from './astronomyMath';

describe('addDaysToDateStr', () => {
  it('adds days within the same month', () => {
    expect(addDaysToDateStr('2026-09-06', 1)).toBe('2026-09-07');
    expect(addDaysToDateStr('2026-09-06', 14)).toBe('2026-09-20');
  });

  it('rolls over month and year boundaries', () => {
    expect(addDaysToDateStr('2026-09-28', 5)).toBe('2026-10-03');
    expect(addDaysToDateStr('2026-12-30', 5)).toBe('2027-01-04');
  });

  it('handles a leap-year February correctly', () => {
    expect(addDaysToDateStr('2028-02-27', 2)).toBe('2028-02-29');
    expect(addDaysToDateStr('2028-02-27', 3)).toBe('2028-03-01');
  });

  it('returns undefined for invalid input instead of throwing', () => {
    expect(addDaysToDateStr(undefined, 1)).toBeUndefined();
    expect(addDaysToDateStr('not-a-date', 1)).toBeUndefined();
  });
});

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

describe('getMoonCompassPosition', () => {
  it('returns a plausible reading for a real location/date and null for invalid coords', () => {
    const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
    expect(getMoonCompassPosition(noon, NaN, 2.16)).toBeNull();

    const moon = getMoonCompassPosition(noon, 41.39, 2.16);
    expect(moon).not.toBeNull();
    expect(moon!.distanceKm).toBeGreaterThan(300000);
    expect(moon!.distanceKm).toBeLessThan(410000);
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

  it('el dia d\'una plena de matinada (26-10-2026 04:12 UTC, USNO) diu "avui", no la de la lunació següent', () => {
    const result = getNextMoonEvent('full', new Date(Date.UTC(2026, 9, 26, 10, 0, 0)), 45);
    expect(result!.daysAhead).toBe(0);
    expect(result!.date.toISOString().slice(0, 10)).toBe('2026-10-26');
  });

  it('una plena d\'ahir ja no compta: la pròxima és la de la lunació següent', () => {
    // Plena real: 24-11-2026 14:53 UTC → el 25-11 la pròxima és la del 24-12 (01:28 UTC).
    const result = getNextMoonEvent('full', new Date(Date.UTC(2026, 10, 25, 18, 0, 0)), 45);
    expect(result!.date.toISOString().slice(0, 10)).toBe('2026-12-24');
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
