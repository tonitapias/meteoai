// src/types/weatherLogicTypes.ts
import { WeatherData } from './weather';

// Definim el mapa de traduccions necessari per la IA i la UI
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
  aiNoData: string;
  aiSummaryVariable: string;
  aiSummaryVariableNight: string;
  aiSummaryOvercast: string;
  aiSummaryFog: string;
  aiSummaryFreezingFog: string;
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
  alertFreezingRain: string;
  alertSleet: string;
  wmoMostlyCloudy: string;
  dustLabel: string;
  alertDust: string;
  particlesLabel: string;
  alertParticles: string;
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
  aiConfidenceTemp: string;
  aiConfidenceRainMod: string;
  aiConfidenceRainLow: string;
  aiConfidenceHintHigh: string;
  aiConfidenceHintTemp: string;
  aiConfidenceHintRain: string;
  aiConfidenceHintBoth: string;
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
  wind_direction_10m?: number;
  visibility?: number;
  cloud_cover?: number;
  is_day: number;
  precipitation?: number;
  rain?: number;
  showers?: number;
  cloud_cover_low?: number;
  cloud_cover_mid?: number;
  cloud_cover_high?: number;
  pressure_msl?: number;
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
  wind_direction_10m?: (number | null)[];
  snow_depth?: (number | null)[];
  relative_humidity_2m: (number | null)[];
  freezing_level_height?: (number | null)[];
  cloud_cover_low?: (number | null)[];
  cloud_cover_mid?: (number | null)[];
  cloud_cover_high?: (number | null)[];
  uv_index?: (number | null)[];
  uv_index_clear_sky?: (number | null)[];
  pressure_msl?: (number | null)[];
  dew_point_2m?: (number | null)[];
  visibility?: (number | null)[];
  [key: string]: unknown;
}

export interface StrictDailyWeather {
  time: string[];
  weather_code?: (number | null)[]; // AFEGIT: Tipatge estricte
  precipitation_probability_max?: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum?: (number | null)[];
  snowfall_sum?: (number | null)[]; // AFEGIT: Tipatge estricte per neu
  uv_index_max?: (number | null)[];
  uv_index_clear_sky_max?: (number | null)[];
  daylight_duration?: (number | null)[];
  sunshine_duration?: (number | null)[];
  shortwave_radiation_sum?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
  sunrise?: string[];
  sunset?: string[];
  elevation?: number;
  [key: string]: unknown;
}

/**
 * [NETEJA] Forma real de `WeatherData['location']` (veure weather.ts), reafirmada
 * aquí perquè `ExtendedWeatherData['location']` es perd com a `{}` en algun punt
 * de la cadena `Omit`/mapped-type — vegeu el comentari de `getSafeLatitude` a
 * weatherMath.ts. Abans d'aquest tipus compartit, 5 fitxers (DashboardContent.tsx,
 * DashboardModals.tsx, DebugPanel.tsx, useDataController.ts, useCurrentWeatherLogic.ts)
 * es declaraven cadascun la seva pròpia interfície local `LocationMeta`, ja
 * divergents entre elles (algunes amb latitude/longitude opcionals, altres no).
 */
export interface LocationMeta {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  [key: string]: unknown;
}

export interface ExtendedWeatherData extends Omit<WeatherData, 'current' | 'hourly' | 'daily'> {
  current: StrictCurrentWeather;
  hourly: StrictHourlyWeather;
  daily: StrictDailyWeather;
  hourlyComparison?: {
    ecmwf: Record<string, unknown>[];
    gfs: Record<string, unknown>[];
    icon: Record<string, unknown>[];
    aifs: Record<string, unknown>[];
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
  // null = no es pot comparar cap model (o falten les dades d'ara): la insígnia no es mostra.
  confidenceLevel: 'high' | 'medium' | 'low' | null;
  // Color de la insígnia. No sempre és el del nivell: un dubte només de temperatura és ambre, no vermell.
  confidenceColor: 'green' | 'amber' | 'red' | null;
  // Frase que explica la insígnia (es mostra en passar-hi per sobre).
  confidenceHint: string;
  alerts: Alert[];
}

export interface ReliabilityResult {
    level: 'low' | 'medium' | 'high';
    type: 'general' | 'temp' | 'precip' | 'divergent' | 'ok';
    value: number | string;
}

/** Acord entre models de les pròximes 6 hores (utils/rules/shortRangeAgreementRules.ts): la insígnia de l'anàlisi +6h. */
export interface ShortRangeAgreement {
    level: 'low' | 'medium' | 'high';
    /** Què fa baixar el nivell (null si és alt): la temperatura, la pluja o totes dues. */
    cause: 'temp' | 'rain' | 'both' | null;
    /**
     * Marge de la temperatura mostrada, en °C: en 8 de cada 10 finestres de la calibració l'error de totes les hores
     * hi cap. Només quan la temperatura és la causa (sola o amb la pluja); si no, null.
     */
    tempMarginC: number | null;
}