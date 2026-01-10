// src/services/cacheService.js

const DB_NAME = 'MeteoAIDB';
const STORE_NAME = 'weather_cache';
const DB_VERSION = 1;
const WEATHER_PREFIX = 'meteoai_v7_cache_';
const AI_PREFIX = 'meteoai_ai_';
const MAX_AGE_WEATHER = 15 * 60 * 1000; // 15 minuts

// --- PETIT MOTOR INDEXEDDB (Sense llibreries externes) ---
const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  
  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  };

  request.onsuccess = (event) => resolve(event.target.result);
  request.onerror = (event) => reject(event.target.error);
});

const dbAction = async (type, callback) => {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, type);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
// -------------------------------------------------------

export const cacheService = {
  /**
   * Guarda dades (Asíncron)
   */
  set: async (key, data) => {
    try {
      const payload = {
        timestamp: Date.now(),
        data: data
      };
      await dbAction('readwrite', (store) => store.put(payload, key));
      console.log("💾 Dades guardades a IndexedDB");
    } catch (err) {
      console.error("❌ Error guardant a DB:", err);
    }
  },

  /**
   * Recupera dades (Asíncron)
   */
  get: async (key, maxAge = MAX_AGE_WEATHER) => {
    try {
      const item = await dbAction('readonly', (store) => store.get(key));
      
      if (!item) return null;

      const { timestamp, data } = item;
      const age = Date.now() - timestamp;

      if (age < maxAge) {
        return data; // Dades fresques
      } else {
        // Caducat: Esborrem silenciosament
        cacheService.remove(key);
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
    try {
      await dbAction('readwrite', (store) => store.delete(key));
    } catch(e) {}
  },

  /**
   * Neteja automàtica de dades velles (> 24h)
   */
  clean: async () => {
    try {
      const db = await dbPromise;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      const now = Date.now();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const key = cursor.key;
          const val = cursor.value;

          // Si és una dada nostra i té més de 24h -> ESBORRAR
          if (typeof key === 'string' && (key.startsWith(WEATHER_PREFIX) || key.startsWith(AI_PREFIX))) {
             if (val.timestamp && (now - val.timestamp > 24 * 60 * 60 * 1000)) {
                 cursor.delete();
                 console.log(`🧹 Netejat element antic: ${key}`);
             }
          }
          cursor.continue();
        }
      };
    } catch (err) {
      console.error("Error netejant DB:", err);
    }
  },

  // Generadors de claus (Igual que abans)
  generateWeatherKey: (lat, lon) => `${WEATHER_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`,
  generateAiKey: (ts, lat, lon, lang) => `${AI_PREFIX}${ts}_${lat}_${lon}_${lang}`
};