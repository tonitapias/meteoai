// src/types/weatherModels.ts
import type { WeatherData } from './weather';

// --- DEFINICIÓ DE TIPUS ESTRICTES ---

export interface TranslationMap {
  wmo: Record<number, string>;
  aiRainHeavy: string;
  aiRainMod: string;
  aiRainLight: string;
  aiRainStopping: string;
  aiRainMore: string;
  aiIntroMorning: string;
  aiIntroAfternoon: string;
  aiIntroNight: string;
  aiSummaryClear: string;
  aiSummaryVariable: string;
  aiSummaryVariableNight: string;
  aiSummaryOvercast: string;
  aiSummaryFog: string;
  alertVisibility: string;
  aiSummarySnow: string;
  aiSummaryCloudy: string;
  aiRainChance: string;
  aiRainNone: string;
  aiTempFreezing: string;
  aiTempCold: string;
  aiTempCool: string;
  aiTempMild: string;
  aiTempWarm: string;
  aiTempHot: string;
  aiHeatIndex?: string;
  storm: string;
  alertStorm: string;
  snow: string;
  alertSnow: string;
  rain: string;
  alertRain: string;
  wind: string;
  tipWindbreaker: string;
  alertWindHigh: string;
  alertWindExtreme: string;
  heat: string;
  alertHeatExtreme: string;
  tipHydration: string;
  tipSunscreen: string;
  alertHeatHigh: string;
  sun: string;
  alertUV: string;
  aqi: string;
  alertAir: string;
  cold: string;
  alertColdExtreme: string;
  tipCoat: string;
  tipThermal: string;
  tipLayers: string;
  tipUmbrella: string;
  tipCalm: string;
  aiWindStrong: string;
  aiWindMod: string;
  aiConfidence: string;
  aiConfidenceLow: string;
  aiConfidenceMod: string;
  [key: string]: unknown;
}

export interface Alert {
  type: string;
  msg: string;
  level: 'high' | 'warning' | 'info';
}

export interface StrictCurrentWeather {
  time: string;
  weather_code: number;
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_gusts_10m?: number;
  visibility?: number;
  cloud_cover?: number;
  is_day: number;
  precipitation?: number;
  rain?: number;
  showers?: number;
  cloud_cover_low?: number;
  cloud_cover_mid?: number;
  cloud_cover_high?: number;
  source?: string;
  minutely15?: number[];
  [key: string]: unknown;
}

export interface StrictHourlyWeather {
  time: string[];
  precipitation_probability?: (number | null)[];
  precipitation: (number | null)[];
  temperature_2m: (number | null)[];
  cape?: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  snow_depth?: (number | null)[];
  relative_humidity_2m: (number | null)[];
  freezing_level_height?: (number | null)[];
  [key: string]: unknown;
}

export interface StrictDailyWeather {
  time: string[];
  precipitation_probability_max?: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum?: (number | null)[];
  uv_index_max?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
  sunrise?: string[];
  sunset?: string[];
  elevation?: number;
  [key: string]: unknown;
}

// Estén la WeatherData original però forçant els tipus estrictes que hem definit
export interface ExtendedWeatherData extends Omit<WeatherData, 'current' | 'hourly' | 'daily'> {
  current: StrictCurrentWeather;
  hourly: StrictHourlyWeather;
  daily: StrictDailyWeather;
  hourlyComparison?: {
    ecmwf: Record<string, unknown>[];
    gfs: Record<string, unknown>[];
    icon: Record<string, unknown>[];
  };
  dailyComparison?: {
    ecmwf: Record<string, unknown>;
    gfs: Record<string, unknown>;
    icon: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface AIPredictionResult {
  text: string;
  tips: string[];
  confidence: string;
  confidenceLevel: string;
  alerts: Alert[];
}

export interface ReliabilityResult {
    level: 'low' | 'medium' | 'high';
    type: 'general' | 'temp' | 'precip' | 'divergent' | 'ok';
    value: number | string;
}