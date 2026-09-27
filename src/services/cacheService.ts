// src/services/cacheService.ts
import { get, set, del, entries, keys } from 'idb-keyval';
import { CACHE_TTL } from '../constants/cacheConfig';

// DEFINIM LA VERSIÓ ACTUAL DE LA MEMÒRIA
const CACHE_VERSION = 'v2_indexeddb_fast';

const CACHE_PREFIX = 'meteoai_cache_';
const VERSION_KEY = 'meteoai_version_control';

// Espai de noms comú a TOTA la persistència pròpia de l'app (cache
// IndexedDB i preferències a LocalStorage — vegeu usePreferences.ts).
// GitHub Pages serveix diverses apps de l'usuari sota el mateix origen
// (p. ex. tonitapias.github.io/meteo, el predecessor d'aquesta app):
// localStorage i IndexedDB es comparteixen per ORIGEN, no per ruta, així
// que un clear() global esborraria també les dades de qualsevol altra
// app al mateix domini. Per això cap neteja "total" fa mai un clear()
// cru: sempre filtra per aquest prefix abans d'esborrar.
const APP_KEY_PREFIX = 'meteoai_';

interface CacheItem<T> {
    data: T;
    timestamp: number;
    version: string;
}

/** Entrada llegida amb getEntry: les dades i quan es van desar. */
export interface CacheEntry<T> {
    data: T;
    savedAt: number;
}

// Clau de previsió (generateWeatherKey) desglossada: lat, lon, unitat i idioma.
const WEATHER_KEY_PATTERN = new RegExp(`^${CACHE_PREFIX}weather_(-?\\d+(?:\\.\\d+)?)_(-?\\d+(?:\\.\\d+)?)_(\\w+)_(\\w+)$`);

// Distància ortodròmica (km) entre dos punts.
const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
};

// NETEJA D'ÀMBIT SEGUR: esborra només claus pròpies d'aquesta app (IndexedDB
// + LocalStorage), mai la resta de l'origen. Exportat perquè el reinici
// manual de Footer.tsx ("SYSTEM ONLINE" -> reset) faci servir exactament
// la mateixa lògica, en lloc de repetir un clear() global propi.
const clearAppStorage = async (): Promise<void> => {
    try {
        const allEntries = await entries();
        await Promise.all(
            allEntries
                .filter(([key]) => typeof key === 'string' && key.startsWith(APP_KEY_PREFIX))
                .map(([key]) => del(key))
        );
    } catch (e) {
        console.warn('Could not clear IndexedDB cache', e);
    }

    try {
        Object.keys(localStorage)
            .filter((key) => key.startsWith(APP_KEY_PREFIX))
            .forEach((key) => localStorage.removeItem(key));
    } catch (e) {
        console.warn('Could not clear legacy localStorage', e);
    }
};

export const cacheService = {
    // Generadors de claus
    // [FIX PRECISIÓ] La clau incloïa lat/lon/unitat però no l'idioma, tot i que
    // el paquet cachejat porta el nom de lloc ja traduït (geoData.city): canviar
    // d'idioma dins del TTL retornava el nom de ciutat en l'idioma antic.
    generateWeatherKey: (lat: number, lon: number, unit: string, lang: string): string => {
        return `${CACHE_PREFIX}weather_${lat.toFixed(4)}_${lon.toFixed(4)}_${unit}_${lang}`;
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

    // GET ENTRY: com get, però sense TTL: torna també les dades caducades (fins a CACHE_TTL.CLEANUP) amb l'instant en què
    // es van desar, i és qui la crida qui decideix si encara són fresques. La previsió caducada ja no s'esborra en
    // llegir-la: és la que es mostra si no n'arriba cap de nova (vegeu WeatherRepository).
    getEntry: async <T>(key: string): Promise<CacheEntry<T> | null> => {
        try {
            const item = await get<CacheItem<T>>(key);
            if (!item) return null;

            if (item.version !== CACHE_VERSION || typeof item.timestamp !== 'number' || Date.now() - item.timestamp > CACHE_TTL.CLEANUP) {
                await del(key);
                return null;
            }

            return { data: item.data, savedAt: item.timestamp };
        } catch (error) {
            console.error('❌ Cache Read Error:', error);
            try { await del(key); } catch { /* ignore error */ }
            return null;
        }
    },

    // Claus de previsió desades (mateixa unitat i idioma) a menys de `maxKm` del punt, de la més propera a la més llunyana.
    // Serveix per trobar una previsió desada quan el GPS dona unes coordenades una mica diferents de les de la clau.
    findWeatherKeysNear: async (lat: number, lon: number, unit: string, lang: string, maxKm: number): Promise<Array<{ key: string; distanceKm: number }>> => {
        try {
            const found: Array<{ key: string; distanceKm: number }> = [];
            (await keys()).forEach(key => {
                const match = typeof key === 'string' ? WEATHER_KEY_PATTERN.exec(key) : null;
                if (!match || match[3] !== unit || match[4] !== lang) return;
                const km = distanceKm(lat, lon, Number(match[1]), Number(match[2]));
                if (km <= maxKm) found.push({ key: key as string, distanceKm: km });
            });
            return found.sort((a, b) => a.distanceKm - b.distanceKm);
        } catch (error) {
            console.warn('⚠️ Cache Keys Error (IndexedDB):', error);
            return [];
        }
    },

    // CLEAN: Neteja intel·ligent asíncrona
    clean: async (): Promise<void> => {
        try {
            const storedVersion = await get<string>(VERSION_KEY);

            // DETECCIÓ D'ACTUALITZACIÓ
            if (storedVersion !== CACHE_VERSION) {
                console.warn(`🚀 Nova arquitectura de Cache (${CACHE_VERSION}). Purgant dades antigues...`);

                await clearAppStorage();

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
    },

    // Reinici manual complet (botó de diagnòstic a Footer.tsx): mateixa
    // neteja d'àmbit segur que la migració de versió, exposada perquè cap
    // altre punt de l'app torni a fer un clear() global pel seu compte.
    clearAppStorage
};