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
  CLEANUP: 24 * 60 * 60 * 1000   // 24 hores (Temps màxim per netejar brossa antiga de la DB)
};