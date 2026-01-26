// src/services/cacheService.ts
import { get, set, del, entries, delMany, IDBValidKey } from 'idb-keyval';
import * as Sentry from "@sentry/react";

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
      
      // TELEMETRIA: Registrem l'escriptura (nivell debug per no saturar)
      Sentry.addBreadcrumb({
        category: 'cache',
        message: `Write Success: ${key}`,
        level: 'info'
      });
    } catch (err) {
      console.error("❌ Error guardant a DB:", err);
      Sentry.captureException(err, { tags: { service: 'CacheService', action: 'set' } });
    }
  },

  /**
   * Recupera dades. Utilitza <T> per indicar què esperes rebre.
   */
  get: async <T>(key: string, maxAge: number = MAX_AGE_WEATHER): Promise<T | null> => {
    try {
      const item = await get<CacheItem<T>>(key);
      
      if (!item) {
        // TELEMETRIA: Cache Miss (No existeix)
        Sentry.addBreadcrumb({
            category: 'cache',
            message: `MISS (Not found): ${key}`,
            level: 'info'
        });
        return null;
      }

      const { timestamp, data } = item;
      const age = Date.now() - timestamp;

      if (age < maxAge) {
        // TELEMETRIA: Cache Hit (Èxit)
        Sentry.addBreadcrumb({
            category: 'cache',
            message: `HIT (${Math.round(age / 1000)}s old): ${key}`,
            level: 'info'
        });
        return data; // Dades fresques
      } else {
        // Caducat: Esborrem i retornem null
        // TELEMETRIA: Cache Expired
        Sentry.addBreadcrumb({
            category: 'cache',
            message: `EXPIRED (${Math.round(age / 60000)}m old): ${key}`,
            level: 'warning'
        });
        await del(key);
        return null;
      }
    } catch (err) {
      console.error("Error llegint DB:", err);
      Sentry.captureException(err, { tags: { service: 'CacheService', action: 'get' } });
      return null;
    }
  },

  /**
   * Esborra un element concret
   */
  remove: async (key: string): Promise<void> => {
    try {
        await del(key);
    } catch (err) {
        console.error("Error esborrant key:", err);
    }
  },

  /**
   * Neteja automàtica
   */
  clean: async (): Promise<void> => {
    try {
      const allEntries = await entries();
      const keysToDelete: IDBValidKey[] = [];
      const now = Date.now();
      let deletedCount = 0;

      for (const [key, val] of allEntries) {
        // 'val' ve com 'any' des de la llibreria, fem un cast segur
        if (typeof key === 'string' && (key.startsWith(WEATHER_PREFIX) || key.startsWith(AI_PREFIX))) {
           const item = val as CacheItem<unknown>;
           // Netegem coses de més de 24h per mantenir la DB lleugera
           if (item && item.timestamp && (now - item.timestamp > 24 * 60 * 60 * 1000)) {
               keysToDelete.push(key);
               deletedCount++;
           }
        }
      }

      if (keysToDelete.length > 0) {
          await delMany(keysToDelete);
          // eslint-disable-next-line no-console
          console.log(`🧹 Cache Cleaned: ${deletedCount} items removed`);
      }
    } catch (err) {
      console.error("Error netejant DB:", err);
      Sentry.captureException(err, { tags: { service: 'CacheService', action: 'clean' } });
    }
  },

  // Generadors de claus
  generateWeatherKey: (lat: number, lon: number, unit: string): string => 
    `${WEATHER_PREFIX}${lat.toFixed(3)}_${lon.toFixed(3)}_${unit}`,
    
  generateAiKey: (ts: string | number, lat: number, lon: number, lang: string): string => 
    `${AI_PREFIX}${ts}_${lat}_${lon}_${lang}`
};