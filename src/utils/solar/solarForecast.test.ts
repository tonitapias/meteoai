import { describe, it, expect } from 'vitest';
import {
  forecastFor, lastForecastDate, lastDailyDate, lastUvDate, sunsetHourIndex, dailyIndexOf, omEdgesFor,
  type SolarDaily, type SolarHourly,
} from './solarForecast';
import { estimateSunsetQuality } from '../astronomyMath';
import type { StrictDailyWeather, StrictHourlyWeather } from '../../types/weatherLogicTypes';

/** daily que comença AHIR (2026-10-06): l'índex d'avui és 1, no 0. */
const daily: SolarDaily = {
  time: ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'],
  sunrise: ['2026-10-06T07:50', '2026-10-07T07:51', '2026-10-08T07:52', '2026-10-09T07:53'],
  sunset: ['2026-10-06T19:22', '2026-10-07T19:20', '2026-10-08T19:18', '2026-10-09T19:17'],
  uv_index_max: [5.2, 5.45, 4.9, null],
  uv_index_clear_sky_max: [6.0, 6.1, 5.9, null],
  sunshine_duration: [30000, 23160, 50000, null],
  shortwave_radiation_sum: [15.1, 14.2, 16.0, null],
};

/** Hores del 2026-10-07 de 17:00 a 21:00, amb núvols i humitat diferents a cada franja. */
const hourly: SolarHourly = {
  time: ['2026-10-07T17:00', '2026-10-07T18:00', '2026-10-07T19:00', '2026-10-07T20:00', '2026-10-07T21:00'],
  cloud_cover_mid: [10, 20, 40, 60, 80],
  cloud_cover_high: [5, 15, 50, 70, 90],
  relative_humidity_2m: [50, 55, 62, 70, 80],
};

describe('dailyIndexOf / omEdgesFor', () => {
  it('l\'índex es busca per data', () => {
    expect(dailyIndexOf(daily, '2026-10-07')).toBe(1);
    expect(dailyIndexOf(daily, '2026-10-20')).toBe(-1);
    expect(dailyIndexOf(null, '2026-10-07')).toBe(-1);
    expect(omEdgesFor(daily, '2026-10-07')).toEqual({ omRise: '2026-10-07T07:51', omSet: '2026-10-07T19:20' });
    expect(omEdgesFor(daily, '2026-10-20')).toEqual({ omRise: null, omSet: null });
    expect(omEdgesFor({ time: ['2026-10-07'] }, '2026-10-07')).toEqual({ omRise: null, omSet: null });
  });
});

describe('sunsetHourIndex', () => {
  it('posta a les 19:20 => franja de les 19:00 (hora truncada)', () => {
    expect(sunsetHourIndex(hourly.time, '2026-10-07T19:20')).toBe(2);
    expect(sunsetHourIndex(hourly.time, '2026-10-07T19:59')).toBe(2);
    expect(sunsetHourIndex(hourly.time, '2026-10-07T20:00')).toBe(3);
  });
  it('sense franja o text no vàlid => null', () => {
    expect(sunsetHourIndex(hourly.time, '2026-10-08T19:18')).toBeNull();
    expect(sunsetHourIndex(hourly.time, 'abc')).toBeNull();
    expect(sunsetHourIndex(hourly.time, null)).toBeNull();
    expect(sunsetHourIndex(undefined, '2026-10-07T19:20')).toBeNull();
  });
});

describe('forecastFor', () => {
  it('Girona 2026-10-07: valors del dia per data (no per desplaçament)', () => {
    const f = forecastFor(daily, hourly, '2026-10-07', 41340);
    expect(f).toEqual({
      available: true,
      uvMax: 5.45, uvClear: 6.1, sunshineSec: 23160,
      pct: 56,                                   // 23160 / 41340 = 56 %
      radiation: 14.2,
      sunsetQuality: estimateSunsetQuality(40, 50, 62),
    });
    expect(f!.sunsetQuality).not.toBeNull();
  });

  it('el % es retalla a 100; nit polar (durada 0) o sense durada => null', () => {
    expect(forecastFor(daily, hourly, '2026-10-08', 41134)!.pct).toBe(100);
    expect(forecastFor(daily, hourly, '2026-10-07', 0)!.pct).toBeNull();
    expect(forecastFor(daily, hourly, '2026-10-07', null)!.pct).toBeNull();
  });

  it('sense franja horària de la posta => qualitat null (la resta hi és)', () => {
    const f = forecastFor(daily, hourly, '2026-10-08', 41134)!;
    expect(f.sunsetQuality).toBeNull();
    expect(f.uvMax).toBe(4.9);
    expect(forecastFor(daily, null, '2026-10-07', 41340)!.sunsetQuality).toBeNull();
  });

  it('data més enllà de daily => null; sense daily => null', () => {
    expect(forecastFor(daily, hourly, '2026-10-16', 40000)).toBeNull();
    expect(forecastFor(null, hourly, '2026-10-07', 40000)).toBeNull();
    expect(forecastFor({}, hourly, '2026-10-07', 40000)).toBeNull();
  });

  it('data present però sense cap dada => available false', () => {
    const f = forecastFor(daily, hourly, '2026-10-09', 40968)!;
    expect(f.available).toBe(false);
    expect([f.uvMax, f.uvClear, f.sunshineSec, f.pct, f.radiation]).toEqual([null, null, null, null, null]);
  });

  it('accepta els tipus estrictes de l\'app', () => {
    const strictDaily = { ...daily, temperature_2m_max: [], temperature_2m_min: [] } as unknown as StrictDailyWeather;
    const strictHourly = hourly as unknown as StrictHourlyWeather;
    expect(forecastFor(strictDaily, strictHourly, '2026-10-07', 41340)?.uvMax).toBe(5.45);
  });
});

describe('últimes dates', () => {
  it('lastForecastDate: últim dia amb alguna dada de previsió (les cues buides no compten)', () => {
    expect(lastForecastDate(daily)).toBe('2026-10-08');
    expect(lastForecastDate({ time: ['2026-10-07', '2026-10-08'], sunshine_duration: [1, 2] })).toBe('2026-10-08');
    expect(lastForecastDate({ time: ['2026-10-07'], uv_index_max: [null] })).toBeNull();
    expect(lastForecastDate(undefined)).toBeNull();
  });
  it('lastDailyDate: últim dia amb sortida i posta; lastUvDate: últim amb UV', () => {
    expect(lastDailyDate(daily)).toBe('2026-10-09');
    expect(lastUvDate(daily)).toBe('2026-10-08');
    expect(lastDailyDate({ time: ['2026-10-07'] })).toBeNull();
  });
});
