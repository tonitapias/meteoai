// src/services/cacheService.js
import { get, set, del, entries, delMany } from 'idb-keyval';

const WEATHER_PREFIX = 'meteoai_v7_cache_';
const AI_PREFIX = 'meteoai_ai_';
const MAX_AGE_WEATHER = 15 * 60 * 1000; // 15 minuts
const MAX_AGE_AI = 24 * 60 * 60 * 1000; // 24 hores (Per defecte)

export const cacheService = {
  /**
   * Guarda dades (Simple i net amb idb-keyval)
   */
  set: async (key, data) => {
    try {
      const payload = {
        timestamp: Date.now(),
        data: data
      };
      await set(key, payload);
      console.log("💾 Dades guardades a IndexedDB");
    } catch (err) {
      console.error("❌ Error guardant a DB:", err);
    }
  },

  /**
   * Recupera dades comprovant la caducitat
   */
  get: async (key, maxAge = MAX_AGE_WEATHER) => {
    try {
      const item = await get(key);
      
      if (!item) return null;

      const { timestamp, data } = item;
      const age = Date.now() - timestamp;

      if (age < maxAge) {
        return data; // Dades fresques
      } else {
        // Caducat: Esborrem i retornem null
        await del(key);
        return null;
      }
    } catch (err) {
      console.error("Error llegint DB:", err);
      return null;
    }
  },

  /**
   * Esborra un element concret
   */
  remove: async (key) => {
    await del(key);
  },

  /**
   * Neteja automàtica de dades velles (> 24h)
   * Ara molt més eficient iterant entrades
   */
  clean: async () => {
    try {
      const allEntries = await entries();
      const keysToDelete = [];
      const now = Date.now();

      for (const [key, val] of allEntries) {
        // Verifiquem que sigui una clau nostra (string) i que hagi caducat (>24h absolut)
        if (typeof key === 'string' && (key.startsWith(WEATHER_PREFIX) || key.startsWith(AI_PREFIX))) {
           if (val && val.timestamp && (now - val.timestamp > 24 * 60 * 60 * 1000)) {
               keysToDelete.push(key);
           }
        }
      }

      if (keysToDelete.length > 0) {
          await delMany(keysToDelete);
          console.log(`🧹 Netejats ${keysToDelete.length} elements antics de la caché.`);
      }
    } catch (err) {
      console.error("Error netejant DB:", err);
    }
  },

  // Generadors de claus (Es mantenen igual)
  generateWeatherKey: (lat, lon) => `${WEATHER_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`,
  generateAiKey: (ts, lat, lon, lang) => `${AI_PREFIX}${ts}_${lat}_${lon}_${lang}`
};