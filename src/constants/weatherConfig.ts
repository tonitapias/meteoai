// src/constants/weatherConfig.ts

export interface WeatherThresholds {
  PRECIPITATION: {
    TRACE: number; // Mínim per considerar "pluja" visualment (0.1mm)
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
    // 0.1mm elimina el "soroll" de 0.02mm que donava icones de pluja sense aigua real
    TRACE: 0.1,    
    LIGHT: 0.25,    
    MODERATE: 1.5,  
    HEAVY: 4.0,     
    EXTREME: 10.0,  
    
    INTENSIFY_FACTOR: 1.5,
    DECREASE_FACTOR: 0.5
  },
  WIND: {
    MODERATE: 20,
    STRONG: 50,
    EXTREME: 80
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
    FREEZING_LEVEL_AVG: 2500,
    MAX_DISPLAY_SNOW_LEVEL: 4000
  }
};