// src/constants/weatherConfig.ts

export const WEATHER_THRESHOLDS = {
  // Llindars de precipitació (mm)
  PRECIPITATION: {
    TRACE: 0.1,    // Mínim per considerar que plou
    LIGHT: 0.5,    // Pluja feble
    MODERATE: 1.5, // Pluja moderada
    HEAVY: 4.0,    // Pluja forta
    INTENSIFY_FACTOR: 1.5 // Factor per considerar que la pluja s'intensifica (AI)
  },

  // Cobertura de núvols (%)
  CLOUDS: {
    FEW: 15,       // 0-15%: Serè
    SCATTERED: 45, // 15-45%: Parcialment ennuvolat
    BROKEN: 85,    // 45-85%: Molt ennuvolat
    OVERCAST: 85,  // >85%: Cobert
    STORM_BASE: 60 // Mínim de núvols per considerar tempesta
  },

  // Humitat i Boira
  HUMIDITY: {
    HIGH: 92,        // Humitat alta (per forçar icona variable)
    FOG_BASE: 96,    // Humitat mínima per boira
    DEW_SPREAD: 1.2  // Diferència màxima Temp-Rosada per boira
  },

  // Inestabilitat (J/kg)
  CAPE: {
    MIN_STORM: 1200,   // Mínim per risc de tempesta
    HIGH_STORM: 2000,  // Risc sever o tempesta seca
    EXTREME: 3000      // Situació perillosa
  },

  // Vent (km/h)
  WIND: {
    LIGHT: 20,     // < 20 km/h
    MODERATE: 40,  // 20-40 km/h
    STRONG: 60,    // 40-60 km/h
    EXTREME: 90    // > 90 km/h
  },

  // Temperatures (ºC) - NOU BLOC PER EVITAR L'ERROR
  TEMP: {
    FREEZING: 0,     // Gelada
    COLD: 10,        // Fred
    MILD: 18,        // Suau
    WARM: 25,        // Càlid
    HOT: 30,         // Calor
    EXTREME_HEAT: 35 // Calor extrema
  },

  // Alertes generals - NOU BLOC
  ALERTS: {
    CAPE_STORM: 1500,     // Llindar per alerta de tempesta
    PRECIP_SUM_HIGH: 20,  // mm acumulats per alerta de pluja
    UV_HIGH: 6,           // Índex UV alt
    UV_EXTREME: 10,       // Índex UV extrem
    AQI_BAD: 60           // Qualitat aire dolenta
  },

  // Neu i Fred
  SNOW: {
    TEMP_SNOW: 1,      // Temperatura aire <= 1ºC -> Neu segura
    TEMP_MIX: 4,       // Temperatura aire <= 4ºC -> Possible aiguaneu
    FREEZING_BUFFER: 300 // Metres per sota de la cota 0 on pot nevar
  },

  // Visibilitat (m)
  VISIBILITY: {
    POOR: 1000, // Menys d'1km es considera boira si no plou
    GOOD: 10000
  },

  // Configuració per defecte de l'UI
  DEFAULTS: {
    MAX_DISPLAY_SNOW_LEVEL: 3500, // Només mostrem cota neu si és inferior a això
  }
} as const;