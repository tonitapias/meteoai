// src/services/cacheService.ts
import { get, set, del, entries, clear } from 'idb-keyval';

// DEFINIM LA VERSIÓ ACTUAL DE LA MEMÒRIA
const CACHE_VERSION = 'v2_indexeddb_fast'; 

const CACHE_PREFIX = 'meteoai_cache_';
const VERSION_KEY = 'meteoai_version_control';

interface CacheItem<T> {
    data: T;
    timestamp: number;
    version: string;
}

export const cacheService = {
    // Generadors de claus
    generateWeatherKey: (lat: number, lon: number, unit: string): string => {
        return `${CACHE_PREFIX}weather_${lat.toFixed(4)}_${lon.toFixed(4)}_${unit}`;
    },

    generateAiKey: (elevation: string, lat: number, lon: number, lang: string): string => {
        return `${CACHE_PREFIX}ai_${elevation}_${lat.toFixed(2)}_${lon.toFixed(2)}_${lang}`;
    },

    // SET: Guardem de forma asíncrona a IndexedDB
    set: async <T>(key: string, data: T): Promise<void> => {
        try {
            const item: CacheItem<T> = {
                data,
                timestamp: Date.now(),
                version: CACHE_VERSION
            };
            await set(key, item);
        } catch (error) {
            console.warn('⚠️ Cache Write Error (IndexedDB):', error);
        }
    },

    // GET: Recuperem sense bloquejar el fil principal
    get: async <T>(key: string, ttlMs: number): Promise<T | null> => {
        try {
            const item = await get<CacheItem<T>>(key);
            
            if (!item) return null;

            const now = Date.now();

            // 1. Comprovació de TTL
            if (now - item.timestamp > ttlMs) {
                await del(key); 
                return null;
            }

            // 2. Comprovació de Versió
            if (item.version !== CACHE_VERSION) {
                console.warn(`♻️ Dada obsoleta detectada (${key}). Netejant...`);
                await del(key);
                return null;
            }

            return item.data;
        } catch (error) {
            console.error('❌ Cache Read Error:', error);
            // En cas de corrupció de la BD, intentem netejar la clau problemàtica
            try { await del(key); } catch { /* ignore error */ } 
            return null;
        }
    },

    // CLEAN: Neteja intel·ligent asíncrona
    clean: async (): Promise<void> => {
        try {
            const storedVersion = await get<string>(VERSION_KEY);

            // DETECCIÓ D'ACTUALITZACIÓ
            if (storedVersion !== CACHE_VERSION) {
                console.warn(`🚀 Nova arquitectura de Cache (${CACHE_VERSION}). Purgant dades antigues...`);
                
                await clear(); // IndexedDB
                
                try {
                    localStorage.clear(); // Legacy LocalStorage
                } catch (e) {
                    console.warn('Could not clear legacy localStorage', e);
                }

                await set(VERSION_KEY, CACHE_VERSION);
                return;
            }

            // MANTENIMENT RUTINARI (TTL)
            const allEntries = await entries();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            const now = Date.now();

            for (const [key, value] of allEntries) {
                if (typeof key === 'string' && key.startsWith(CACHE_PREFIX)) {
                    const item = value as CacheItem<unknown>;
                    if (!item.timestamp || (now - item.timestamp > ONE_DAY)) {
                        await del(key);
                    }
                }
            }

        } catch (error) {
            console.error('⚠️ Cache Cleanup Warning:', error);
        }
    }
};