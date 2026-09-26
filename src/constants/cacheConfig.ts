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