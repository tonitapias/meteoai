// src/constants/cacheConfig.ts

// Prefixos per a les claus d'IndexedDB
// Canviar la versió (ex: de v7 a v8) forçarà a invalidar la cache antiga automàticament
// perquè l'app deixarà de trobar les claus velles. Útil després de grans updates.
export const CACHE_PREFIXES = {
  WEATHER: 'meteoai_v7_cache_',
  AI: 'meteoai_ai_'
};

// Temps de vida (Time To Live) de les dades en mil·lisegons
export const CACHE_TTL = {
  WEATHER: 15 * 60 * 1000,       // 15 minuts (Dades meteorològiques fresques)
  // Paquet d'un lloc amb model regional on el model regional NO s'ha pogut fer servir (petició fallida, worker
  // fallit o esgotat, resposta sense dades): només es reaprofita 2 minuts perquè la càrrega següent el torni a provar.
  // Amb els 15 minuts sencers, una fallada puntual del worker deixava "MODEL GLOBAL" un quart d'hora (Girona, 26-09-2026).
  // No es deixa sense cache del tot perquè hi ha punts dins d'una caixa regional però fora del domini real del model
  // (vegeu CHMI a regionalModels.ts) on la fallada és permanent: així tenen igualment una cache, curta.
  WEATHER_REGIONAL_RETRY: 2 * 60 * 1000,
  CLEANUP: 24 * 60 * 60 * 1000   // 24 hores (Temps màxim per netejar brossa antiga de la DB)
};

// Previsió desada quan no n'arriba cap de nova (vegeu utils/offlineSnapshot.ts i WeatherRepository). Com a molt té
// CACHE_TTL.CLEANUP (24 h): més vella ja s'esborra.
export const OFFLINE_SNAPSHOT = {
  // Espera màxima de la petició abans de mostrar la previsió desada (la petició continua i, si acaba bé, la substitueix).
  // Una càrrega normal, amb el model regional i el seu worker (fins a 4 s), tarda uns 2-6 s; amb mala cobertura, els
  // 3 intents de 10 s de fetchWithRetry deixaven l'esquelet de càrrega més de mig minut.
  WAIT_BEFORE_FALLBACK_MS: 8000,
  // Distància màxima fins a una previsió desada d'un altre punt (el GPS dona coordenades una mica diferents cada cop, o
  // l'usuari s'ha mogut). L'avís diu de quin lloc és i a quants km.
  MAX_DISTANCE_KM: 20
};