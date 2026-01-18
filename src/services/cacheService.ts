// src/services/cacheService.ts
import { get, set, del, entries, delMany, IDBValidKey } from 'idb-keyval';

const WEATHER_PREFIX = 'meteoai_v7_cache_';
const AI_PREFIX = 'meteoai_ai_';
const MAX_AGE_WEATHER = 15 * 60 * 1000; // 15 minuts

// Definim la "forma" de les dades guardades
interface CacheItem<T> {
  timestamp: number;
  data: T;
}

export const cacheService = {
  /**
   * Guarda dades amb tipat genèric
   */
  set: async <T>(key: string, data: T): Promise<void> => {
    try {
      const payload: CacheItem<T> = {
        timestamp: Date.now(),
        data: data
      };
      await set(key, payload);
    } catch (err) {
      console.error("❌ Error guardant a DB:", err);
    }
  },

  /**
   * Recupera dades. Utilitza <T> per indicar què esperes rebre.
   */
  get: async <T>(key: string, maxAge: number = MAX_AGE_WEATHER): Promise<T | null> => {
    try {
      const item = await get<CacheItem<T>>(key);
      
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
  remove: async (key: string): Promise<void> => {
    await del(key);
  },

  /**
   * Neteja automàtica
   */
  clean: async (): Promise<void> => {
    try {
      const allEntries = await entries();
      const keysToDelete: IDBValidKey[] = [];
      const now = Date.now();

      for (const [key, val] of allEntries) {
        // 'val' ve com 'any' des de la llibreria, fem un cast segur
        if (typeof key === 'string' && (key.startsWith(WEATHER_PREFIX) || key.startsWith(AI_PREFIX))) {
           const item = val as CacheItem<unknown>;
           if (item && item.timestamp && (now - item.timestamp > 24 * 60 * 60 * 1000)) {
               keysToDelete.push(key);
           }
        }
      }

      if (keysToDelete.length > 0) {
          await delMany(keysToDelete);
      }
    } catch (err) {
      console.error("Error netejant DB:", err);
    }
  },

  // Generadors de claus
  generateWeatherKey: (lat: number, lon: number): string => 
    `${WEATHER_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`,
    
  generateAiKey: (ts: string | number, lat: number, lon: number, lang: string): string => 
    `${AI_PREFIX}${ts}_${lat}_${lon}_${lang}`
};