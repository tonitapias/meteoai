// src/hooks/welcome/useAntipodesWeather.ts
// El temps de l'arribada de l'ascensor cap avall: ara mateix a les antípodes i a casa, per comparar-los, i l'estat del
// mar a les antípodes. Dues consultes mínimes a Open-Meteo (coordenades arrodonides a 0,01°) que es fan quan algú troba
// el secret i arriben durant la baixada. Si tarden o fallen, l'arribada ho diu i el viatge segueix igual.
import { useEffect, useState } from 'react';
import { OPEN_METEO_FORECAST_URL } from '../../constants/apiConfig';
import { fetchWithTimeout } from '../../utils/networkUtils';
import type { WeatherUnit } from '../../utils/formatters';

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const TIMEOUT_MS = 9000;

export interface PlaceWeather {
  temperature: number | null;
  apparent: number | null;
  code: number | null;
  cloudCover: number | null;
  windSpeed: number | null;
  /** D'on ve el vent (graus). */
  windDir: number | null;
  /** Diferència de l'hora local amb l'UTC, en segons (el fus del lloc; al mar, el nàutic). */
  utcOffsetSec: number;
  daylightSec: number | null;
}

export interface SeaState { waveHeight: number; wavePeriod: number | null; seaTemp: number | null }

export type AntipodesWeather =
  | { status: 'loading' }
  | { status: 'ready'; here: PlaceWeather; there: PlaceWeather; sea: SeaState | null }
  | { status: 'failed' };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Un lloc de la resposta d'Open-Meteo (`current` i el primer dia de `daily`); null si no hi ha l'hora local. */
export function parsePlaceWeather(json: unknown): PlaceWeather | null {
  const data = json as { utc_offset_seconds?: unknown; current?: Record<string, unknown>; daily?: { daylight_duration?: unknown[] } } | null;
  const offset = num(data?.utc_offset_seconds);
  const current = data?.current;
  if (offset === null || !current) return null;
  return {
    temperature: num(current.temperature_2m),
    apparent: num(current.apparent_temperature),
    code: num(current.weather_code),
    cloudCover: num(current.cloud_cover),
    windSpeed: num(current.wind_speed_10m),
    windDir: num(current.wind_direction_10m),
    utcOffsetSec: offset,
    daylightSec: num(data?.daily?.daylight_duration?.[0]),
  };
}

/** L'estat del mar; null a terra ferma (on l'API del mar no dona onades). */
export function parseSeaState(json: unknown): SeaState | null {
  const current = (json as { current?: Record<string, unknown> } | null)?.current;
  const waveHeight = num(current?.wave_height);
  if (waveHeight === null) return null;
  return { waveHeight, wavePeriod: num(current?.wave_period), seaTemp: num(current?.sea_surface_temperature) };
}

const coord = (v: number) => v.toFixed(2);

export function useAntipodesWeather(home: { lat: number; lon: number }, there: { lat: number; lon: number }, unit: WeatherUnit): AntipodesWeather {
  const [state, setState] = useState<AntipodesWeather>({ status: 'loading' });
  const { lat: homeLat, lon: homeLon } = home;
  const { lat, lon } = there;

  useEffect(() => {
    let alive = true;
    const imperial = unit === 'F';
    const forecast = new URLSearchParams({
      latitude: `${coord(homeLat)},${coord(lat)}`,
      longitude: `${coord(homeLon)},${coord(lon)}`,
      current: 'temperature_2m,apparent_temperature,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
      daily: 'daylight_duration',
      timezone: 'auto',
      forecast_days: '1',
      ...(imperial ? { temperature_unit: 'fahrenheit', wind_speed_unit: 'mph' } : {}),
    });
    const marine = new URLSearchParams({
      latitude: coord(lat),
      longitude: coord(lon),
      current: 'wave_height,wave_period,sea_surface_temperature',
      timezone: 'GMT',
      ...(imperial ? { temperature_unit: 'fahrenheit', length_unit: 'imperial' } : {}),
    });
    const getJson = (url: string) => fetchWithTimeout(url, TIMEOUT_MS).then(response => (response.ok ? response.json() : null));
    Promise.all([
      getJson(`${OPEN_METEO_FORECAST_URL}?${forecast.toString()}`),
      // El mar és opcional: si falla, l'arribada no en parla.
      getJson(`${MARINE_URL}?${marine.toString()}`).catch(() => null),
    ])
      .then(([places, sea]) => {
        if (!alive) return;
        const list = Array.isArray(places) ? places : [];
        const here = parsePlaceWeather(list[0]);
        const thereWeather = parsePlaceWeather(list[1]);
        setState(here && thereWeather ? { status: 'ready', here, there: thereWeather, sea: parseSeaState(sea) } : { status: 'failed' });
      })
      .catch(() => { if (alive) setState({ status: 'failed' }); });
    return () => { alive = false; };
  }, [homeLat, homeLon, lat, lon, unit]);

  return state;
}
