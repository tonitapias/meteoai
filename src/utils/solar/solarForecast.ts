// src/utils/solar/solarForecast.ts
// Fila de previsió d'Open-Meteo (UV, hores de sol, radiació, qualitat de la posta) per a una DATA local:
// l'índex es busca per data a daily.time, mai per desplaçament respecte d'avui. Pur.
import { estimateSunsetQuality } from '../astronomyMath';

type Series<T> = ReadonlyArray<T | null | undefined> | null | undefined;

/** Part de `daily` que fa servir el modal (StrictDailyWeather hi encaixa). */
export interface SolarDaily {
  time?: Series<string>;
  sunrise?: Series<string>;
  sunset?: Series<string>;
  uv_index_max?: Series<number>;
  uv_index_clear_sky_max?: Series<number>;
  sunshine_duration?: Series<number>;
  shortwave_radiation_sum?: Series<number>;
}

/** Part de `hourly` que fa servir la qualitat de la posta (StrictHourlyWeather hi encaixa). */
export interface SolarHourly {
  time?: Series<string>;
  cloud_cover_mid?: Series<number>;
  cloud_cover_high?: Series<number>;
  relative_humidity_2m?: Series<number>;
}

export interface ForecastRow {
  /** Hi ha almenys una dada de previsió (UV, UV amb cel serè, sol o radiació) per a aquest dia. */
  available: boolean;
  uvMax: number | null;
  uvClear: number | null;
  sunshineSec: number | null;
  /** % d'hores de sol sobre la durada del dia, retallat a 100; null si no hi ha durada (nit polar) o sol. */
  pct: number | null;
  /** MJ/m² del dia. */
  radiation: number | null;
  /** Índex 0–100 (estimació) amb el núvol mitjà/alt i la humitat de l'hora de la posta; null si falta alguna dada. */
  sunsetQuality: number | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const numAt = (arr: Series<number>, idx: number): number | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const strAt = (arr: Series<string>, idx: number): string | null => {
  const v = Array.isArray(arr) ? arr[idx] : undefined;
  return typeof v === 'string' ? v : null;
};

/** Índex de la data local "YYYY-MM-DD" a daily.time, o −1. */
export function dailyIndexOf(daily: SolarDaily | null | undefined, dateStr: string): number {
  const times = daily?.time;
  if (!Array.isArray(times)) return -1;
  for (let i = 0; i < times.length; i++) {
    const v = times[i];
    if (typeof v === 'string' && v.slice(0, 10) === dateStr) return i;
  }
  return -1;
}

/** Sortida i posta d'Open-Meteo ("YYYY-MM-DDTHH:MM") d'una data, o null si la data no hi és. */
export function omEdgesFor(daily: SolarDaily | null | undefined, dateStr: string): { omRise: string | null; omSet: string | null } {
  const idx = dailyIndexOf(daily, dateStr);
  if (idx < 0) return { omRise: null, omSet: null };
  return { omRise: strAt(daily?.sunrise, idx), omSet: strAt(daily?.sunset, idx) };
}

/**
 * Índex de l'hora horària que conté la posta (mateixa regla que abans: "YYYY-MM-DDTHH", hora truncada, de
 * manera que una posta a les 19:20 fa servir la franja de les 19:00). Sense franja o text no vàlid: null.
 */
export function sunsetHourIndex(hourlyTimes: Series<string>, sunsetIso: string | null | undefined): number | null {
  if (!Array.isArray(hourlyTimes) || typeof sunsetIso !== 'string' || !DATE_RE.test(sunsetIso) || sunsetIso.length < 13) return null;
  const key = sunsetIso.slice(0, 13);
  for (let i = 0; i < hourlyTimes.length; i++) {
    const v = hourlyTimes[i];
    if (typeof v === 'string' && v.slice(0, 13) === key) return i;
  }
  return null;
}

/**
 * Previsió del dia `dateStr`. Null si no hi ha `daily` o la data no hi és (més enllà de l'horitzó d'Open-Meteo);
 * `available` false si la data hi és però totes les dades són buides.
 */
export function forecastFor(
  daily: SolarDaily | null | undefined,
  hourly: SolarHourly | null | undefined,
  dateStr: string,
  dayLengthSec: number | null | undefined
): ForecastRow | null {
  const idx = dailyIndexOf(daily, dateStr);
  if (idx < 0 || !daily) return null;
  const uvMax = numAt(daily.uv_index_max, idx);
  const uvClear = numAt(daily.uv_index_clear_sky_max, idx);
  const sunshineSec = numAt(daily.sunshine_duration, idx);
  const radiation = numAt(daily.shortwave_radiation_sum, idx);
  const len = typeof dayLengthSec === 'number' && Number.isFinite(dayLengthSec) ? dayLengthSec : null;
  const pct = sunshineSec !== null && len !== null && len > 0
    ? Math.min(100, Math.round((sunshineSec / len) * 100))
    : null;

  let sunsetQuality: number | null = null;
  const h = sunsetHourIndex(hourly?.time, strAt(daily.sunset, idx));
  if (h !== null && hourly) {
    sunsetQuality = estimateSunsetQuality(
      numAt(hourly.cloud_cover_mid, h), numAt(hourly.cloud_cover_high, h), numAt(hourly.relative_humidity_2m, h)
    );
  }

  return {
    available: uvMax !== null || uvClear !== null || sunshineSec !== null || radiation !== null,
    uvMax, uvClear, sunshineSec, pct, radiation, sunsetQuality,
  };
}

const FORECAST_KEYS = ['uv_index_max', 'uv_index_clear_sky_max', 'sunshine_duration', 'shortwave_radiation_sum'] as const;

/** Últim dia de daily.time amb alguna dada de previsió (UV, sol o radiació), o null. */
export function lastForecastDate(daily: SolarDaily | null | undefined): string | null {
  const times = daily?.time;
  if (!daily || !Array.isArray(times)) return null;
  for (let i = times.length - 1; i >= 0; i--) {
    const d = times[i];
    if (typeof d !== 'string' || !DATE_RE.test(d)) continue;
    if (FORECAST_KEYS.some(k => numAt(daily[k], i) !== null)) return d.slice(0, 10);
  }
  return null;
}

/** Últim dia de daily.time que té sortida i posta d'Open-Meteo (per al peu de fonts), o null. */
export function lastDailyDate(daily: SolarDaily | null | undefined): string | null {
  const times = daily?.time;
  if (!daily || !Array.isArray(times)) return null;
  for (let i = times.length - 1; i >= 0; i--) {
    const d = times[i];
    if (typeof d === 'string' && DATE_RE.test(d) && strAt(daily.sunrise, i) !== null && strAt(daily.sunset, i) !== null) {
      return d.slice(0, 10);
    }
  }
  return null;
}

/** Últim dia amb índex UV numèric (línia "UV previst fins al…" del calendari), o null. */
export function lastUvDate(daily: SolarDaily | null | undefined): string | null {
  const times = daily?.time;
  if (!daily || !Array.isArray(times)) return null;
  for (let i = times.length - 1; i >= 0; i--) {
    const d = times[i];
    if (typeof d === 'string' && DATE_RE.test(d) && numAt(daily.uv_index_max, i) !== null) return d.slice(0, 10);
  }
  return null;
}
