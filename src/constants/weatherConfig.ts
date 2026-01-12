// src/constants/weatherConfig.ts

export interface WeatherThresholds {
  PRECIPITATION: {
    LIGHT: number;
    MODERATE: number;
    HEAVY: number;
    EXTREME: number;
    INTENSIFY_FACTOR: number;
    DECREASE_FACTOR: number;
  };
  WIND: {
    MODERATE: number;
    STRONG: number;
    EXTREME: number;
  };
  TEMP: {
    FREEZING: number;
    COLD: number;
    MILD: number;
    WARM: number;
    HOT: number;
    EXTREME_HEAT: number;
  };
  HUMIDITY: {
    HIGH: number;
  };
  RELIABILITY: {
    TEMP_DIFF_HIGH: number;
    TEMP_DIFF_MED: number;
    RAIN_DIFF_HIGH: number;
    RAIN_DIFF_MED: number;
  };
  ALERTS: {
    CAPE_STORM: number;
    PRECIP_SUM_HIGH: number;
    UV_HIGH: number;
    UV_EXTREME: number;
    AQI_BAD: number;
  };
  DEFAULTS: {
    FREEZING_LEVEL_AVG: number;
    MAX_DISPLAY_SNOW_LEVEL: number;
  };
}

export const WEATHER_THRESHOLDS: WeatherThresholds = {
  PRECIPITATION: {
    // LLINDARS ESTÀNDARD DE LA INDÚSTRIA
    // < 0.25mm: "Traça" (No es considera pluja activa per a l'usuari)
    // >= 0.25mm: Comença a ploure
    LIGHT: 0.25,    
    MODERATE: 1.5,  // Pluja normal
    HEAVY: 4.0,     // Pluja forta
    EXTREME: 10.0,  // Aiguat / Tempesta
    
    INTENSIFY_FACTOR: 1.5,
    DECREASE_FACTOR: 0.5
  },
  WIND: {
    MODERATE: 20,
    STRONG: 50,    // Avís Groc
    EXTREME: 80    // Avís Taronja/Vermell
  },
  TEMP: {
    FREEZING: 0,
    COLD: 10,
    MILD: 18,
    WARM: 25,
    HOT: 32,
    EXTREME_HEAT: 35
  },
  HUMIDITY: {
    HIGH: 65
  },
  RELIABILITY: {
    TEMP_DIFF_HIGH: 4,
    TEMP_DIFF_MED: 2.5,
    RAIN_DIFF_HIGH: 40,
    RAIN_DIFF_MED: 25
  },
  ALERTS: {
    CAPE_STORM: 2000,
    PRECIP_SUM_HIGH: 30,
    UV_HIGH: 7,
    UV_EXTREME: 10,
    AQI_BAD: 100
  },
  DEFAULTS: {
    FREEZING_LEVEL_AVG: 2500,  // Valor per defecte si no hi ha dades de cota de neu
    MAX_DISPLAY_SNOW_LEVEL: 4000 // Si la cota de neu és superior a 4000m, no mostrem el widget
  }
};