// src/constants/weatherConfig.js

export const WEATHER_THRESHOLDS = {
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
  }
};