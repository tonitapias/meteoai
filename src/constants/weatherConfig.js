// src/constants/weatherConfig.js

export const WEATHER_THRESHOLDS = {
  PRECIPITATION: {
    LIGHT: 0.1,    // AJUSTAT: Ara detecta plugim fi (>0.1mm) en lloc d'esperar a 0.2mm
    HEAVY: 2.0,    // mm/h - Pluja forta
    EXTREME: 10.0, // mm/h - Aiguat violent
    INTENSIFY_FACTOR: 1.5, // Si la tendència puja un 50%
    DECREASE_FACTOR: 0.5   // Si la tendència baixa un 50%
  },
  WIND: {
    MODERATE: 20,  // km/h
    STRONG: 50,    // km/h - Avís groc
    EXTREME: 80    // km/h - Avís taronja/vermell
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
    HIGH: 65 // Per calcular xafogor
  },
  RELIABILITY: {
    TEMP_DIFF_HIGH: 4,   // Diferència greu entre models
    TEMP_DIFF_MED: 2.5,
    RAIN_DIFF_HIGH: 40,  // Diferència greu en probabilitat
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