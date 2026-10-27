import { describe, expect, it } from 'vitest';
import { parsePlaceWeather, parseSeaState } from './useAntipodesWeather';

// Respostes reals d'Open-Meteo (27-10-2026, 19:04 UTC), retallades: les antípodes de Barcelona, al Pacífic.
const THERE = {
  utc_offset_seconds: -43200,
  timezone: 'Etc/GMT+12',
  current: { temperature_2m: 11.5, apparent_temperature: 10.1, weather_code: 0, cloud_cover: 16, wind_speed_10m: 3.7, wind_direction_10m: 346 },
  daily: { daylight_duration: [49415.71] },
};
const MARINE = { current: { wave_height: 2.48, wave_period: 8.15, sea_surface_temperature: 14.2 } };

describe('parsePlaceWeather', () => {
  it("llegeix el temps d'ara, l'hora local i la durada del dia", () => {
    expect(parsePlaceWeather(THERE)).toEqual({
      temperature: 11.5, apparent: 10.1, code: 0, cloudCover: 16, windSpeed: 3.7, windDir: 346, utcOffsetSec: -43200, daylightSec: 49415.71,
    });
  });

  it("sense l'hora local o sense dades d'ara, res", () => {
    expect(parsePlaceWeather({ current: THERE.current })).toBeNull();
    expect(parsePlaceWeather({ utc_offset_seconds: 0 })).toBeNull();
    expect(parsePlaceWeather(null)).toBeNull();
  });

  it('les dades que falten queden en null, no en zero', () => {
    expect(parsePlaceWeather({ utc_offset_seconds: 3600, current: { temperature_2m: null } })).toMatchObject({ temperature: null, code: null, daylightSec: null });
  });
});

describe('parseSeaState', () => {
  it('al mar, les onades i l\'aigua; a terra (sense onades), null', () => {
    expect(parseSeaState(MARINE)).toEqual({ waveHeight: 2.48, wavePeriod: 8.15, seaTemp: 14.2 });
    expect(parseSeaState({ current: { wave_height: null, wave_period: null } })).toBeNull();
    expect(parseSeaState(null)).toBeNull();
  });
});
