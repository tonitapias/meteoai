// src/services/cacheService.ts

// DEFINIM LA VERSIÓ ACTUAL DE LA MEMÒRIA
// Cada vegada que facis canvis importants a l'estructura de dades (schemas),
// hauràs de canviar aquest valor (ex: 'v2', 'v3') per forçar neteja als usuaris.
const CACHE_VERSION = 'v1_safe_release'; 

const CACHE_PREFIX = 'meteoai_cache_';
const VERSION_KEY = 'meteoai_version_control';

interface CacheItem<T> {
    data: T;
    timestamp: number;
    version: string; // Afegim la versió a cada ítem per seguretat extra
}

export const cacheService = {
    // Generadors de claus (Mantenim igual)
    generateWeatherKey: (lat: number, lon: number, unit: string): string => {
        return `${CACHE_PREFIX}weather_${lat.toFixed(4)}_${lon.toFixed(4)}_${unit}`;
    },

    generateAiKey: (elevation: string, lat: number, lon: number, lang: string): string => {
        return `${CACHE_PREFIX}ai_${elevation}_${lat.toFixed(2)}_${lon.toFixed(2)}_${lang}`;
    },

    // SET: Guardem amb la versió actual
    set: async <T>(key: string, data: T): Promise<void> => {
        try {
            const item: CacheItem<T> = {
                data,
                timestamp: Date.now(),
                version: CACHE_VERSION
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            // Si el localStorage està ple, intentem fer espai
            console.warn('⚠️ Cache Full. Attempting cleanup...', error);
            try {
                localStorage.clear(); // Mesura dràstica d'emergència
            } catch (e) {
                console.error('❌ Cache Write Failed:', e);
            }
        }
    },

    // GET: Recuperem només si existeix i no ha caducat
    get: async <T>(key: string, ttlMs: number): Promise<T | null> => {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;

            const item = JSON.parse(itemStr) as CacheItem<T>;
            const now = Date.now();

            // 1. Comprovació de TTL (Caducitat temporal)
            if (now - item.timestamp > ttlMs) {
                localStorage.removeItem(key);
                return null;
            }

            // 2. Comprovació de Versió (Seguretat estructural)
            // Si la dada guardada és d'una versió anterior, la descartem.
            if (item.version !== CACHE_VERSION) {
                console.warn(`♻️ Dada obsoleta detectada (${key}). Netejant...`);
                localStorage.removeItem(key);
                return null;
            }

            return item.data;
        } catch (error) {
            console.error('❌ Cache Read Error:', error);
            // Si hi ha error de lectura (JSON corrupte), esborrem per seguretat
            localStorage.removeItem(key);
            return null;
        }
    },

    // CLEAN: Neteja intel·ligent i gestió de versions global
    clean: async (): Promise<void> => {
        try {
            const storedVersion = localStorage.getItem(VERSION_KEY);

            // DETECCIÓ D'ACTUALITZACIÓ DE L'APP
            if (storedVersion !== CACHE_VERSION) {
                console.warn(`🚀 Nova versió detectada (${CACHE_VERSION}). Purgant cache antiga...`);
                
                // Esborrem TOTES les claus que comencin pel nostre prefix
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(CACHE_PREFIX)) {
                        keysToRemove.push(key);
                    }
                }
                
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                // Actualitzem la marca de versió
                localStorage.setItem(VERSION_KEY, CACHE_VERSION);
                return; // Si hem purgat tot, no cal comprovar TTL
            }

            // MANTENIMENT RUTINARI (TTL)
            // Si la versió és correcta, busquem ítems caducats individualment
            const ONE_DAY = 24 * 60 * 60 * 1000;
            const now = Date.now();

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CACHE_PREFIX)) {
                    const itemStr = localStorage.getItem(key);
                    if (itemStr) {
                        try {
                            const item = JSON.parse(itemStr) as CacheItem<unknown>;
                            if (now - item.timestamp > ONE_DAY) {
                                localStorage.removeItem(key);
                            }
                        } catch {
                            localStorage.removeItem(key);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('⚠️ Cache Cleanup Warning:', error);
        }
    }
};