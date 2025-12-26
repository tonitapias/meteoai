// src/constants/weatherConfig.js

export const WEATHER_THRESHOLDS = {
  PRECIPITATION: {
    LIGHT: 0.2,    // mm/h - Pluja feble
    HEAVY: 2.0,    // mm/h - Pluja forta (llindar original)
    EXTREME: 10.0, // mm/h - Aiguat
    INTENSIFY_FACTOR: 1.5, // Si la pluja futura és 1.5x l'actual, s'intensifica
    DECREASE_FACTOR: 0.5   // Si és 0.5x, minva
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
    TEMP_DIFF_HIGH: 4,   // Diferència greu entre models (graus)
    TEMP_DIFF_MED: 2.5,  // Diferència moderada
    RAIN_DIFF_HIGH: 40,  // Diferència greu en probabilitat (%)
    RAIN_DIFF_MED: 25
  },
  ALERTS: {
    CAPE_STORM: 2000, // Energia potencial per tempestes
    PRECIP_SUM_HIGH: 30, // mm acumulats diaris
    UV_HIGH: 7,
    UV_EXTREME: 10,
    AQI_BAD: 100
  }
};