// src/repositories/WeatherRepository.ts
import * as Sentry from "@sentry/react";
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { normalizeModelData } from '../utils/normData';
import { injectBaseRainEvidence } from '../utils/regionalModelEngine';
import { injectEngineSnowfall } from '../utils/engineSnowfall';
import { injectAifsTemperatureBlend } from '../utils/aifsTemperatureBlend';
import { injectTropicalRainGate } from '../utils/tropicalRainGate';
import { rollSnapshotForward } from '../utils/offlineSnapshot';
import { isRegionalModelActive, selectRegionalModel, type RegionalModel } from '../constants/regionalModels';
import type { AirQualityData, WeatherData } from '../types/weather';
import { getRegionalHDData } from '../services/weatherApi';
import { fetchAllWeatherData } from '../services/weatherService';
import type { WeatherUnit } from '../utils/formatters';
import { cacheService, type CacheEntry } from '../services/cacheService';
import { SENTRY_TAGS } from '../constants/errorConstants';
import type { Language } from '../translations';
import { CACHE_TTL, OFFLINE_SNAPSHOT } from '../constants/cacheConfig';

// Paquet desat a la cache. `regionalMissing`: el lloc té model regional però aquesta vegada no s'ha pogut fer servir
// (vegeu CACHE_TTL.WEATHER_REGIONAL_RETRY); `cachedAt` permet aplicar-li el TTL curt. Els paquets antics no porten
// cap dels dos camps i es tracten com sempre.
interface WeatherCachePacket {
    weather: ExtendedWeatherData;
    aqi: AirQualityData | null;
    regionalMissing?: boolean;
    cachedAt?: number;
}

// Tipus de retorn
export interface WeatherRepositoryResponse {
    success: true;
    data: ExtendedWeatherData;
    aqi: AirQualityData | null;
}

export interface WeatherRepositoryOptions {
    /**
     * Previsió nova que arriba DESPRÉS d'haver tornat la desada perquè la petició tardava massa
     * (OFFLINE_SNAPSHOT.WAIT_BEFORE_FALLBACK_MS). Ja s'ha desat a la cache.
     */
    onLateResult?: (response: WeatherRepositoryResponse) => void;
}

// Tipus per a la funció del Worker (per injectar-la)
// [CORRECCIÓ] Substituït 'any' per 'WeatherData' (Tipatge estricte)
type RegionalModelWorkerFn = (currentData: ExtendedWeatherData, regionalData: WeatherData, model: RegionalModel) => Promise<ExtendedWeatherData>;

// Què passa primer: arriba la previsió nova, la petició falla o s'acaba l'espera.
type FirstOutcome =
    | { kind: 'fresh'; response: WeatherRepositoryResponse }
    | { kind: 'failed'; error: unknown }
    | { kind: 'slow' };

const raceWithDeadline = async (network: Promise<WeatherRepositoryResponse>, waitMs: number): Promise<FirstOutcome> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<FirstOutcome>(resolve => {
        timer = setTimeout(() => resolve({ kind: 'slow' }), waitMs);
    });
    try {
        return await Promise.race([
            network.then(
                (response): FirstOutcome => ({ kind: 'fresh', response }),
                (error): FirstOutcome => ({ kind: 'failed', error })
            ),
            deadline
        ]);
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Obté una previsió nova (API -> Regional Model Worker) i la desa a la cache.
 */
const fetchFreshWeather = async (
    lat: number,
    lon: number,
    unit: WeatherUnit,
    lang: Language,
    cacheKey: string,
    locationName?: string,
    country?: string,
    runRegionalModelWorker?: RegionalModelWorkerFn
): Promise<WeatherRepositoryResponse> => {
    // 2. Peticions de Xarxa (API)
    // [FIX PRECISIÓ] El model regional no depèn de cap resultat de fetchAllWeatherData
    // (només necessita lat/lon), així que abans s'esperava seqüencialment
    // sense cap motiu — una llatència extra sencera a cada consulta dins la
    // zona de cobertura (França/Catalunya, el públic principal de l'app).
    // L'iniciem en paral·lel; capturem la seva fallada aquí mateix (no dins
    // el Promise.all) perquè un error del model regional mai faci caure la
    // petició principal de meteo.
    const regionalModel = selectRegionalModel(lat, lon);
    const shouldFetchRegional = !!regionalModel && !!runRegionalModelWorker;
    const regionalPromise: Promise<WeatherData | null> = shouldFetchRegional
        ? getRegionalHDData(lat, lon, regionalModel).catch((regionalErr) => {
            Sentry.captureException(regionalErr, {
                tags: {
                    service: SENTRY_TAGS.SERVICE_REGIONAL_MODEL_WORKER,
                    type: SENTRY_TAGS.TYPE_FALLBACK
                },
                level: 'warning'
            });
            return null;
        })
        : Promise.resolve(null);

    const [{ weatherRaw, geoData, aqiData: fetchedAqi }, regionalRaw] = await Promise.all([
        fetchAllWeatherData(lat, lon, unit, lang, locationName, country),
        regionalPromise
    ]);

    let processedData = normalizeModelData(weatherRaw);

    // 3. Integració del model regional (si la petició ha tingut èxit)
    if (regionalRaw && regionalModel && runRegionalModelWorker) {
        try {
            processedData = await runRegionalModelWorker(processedData, regionalRaw, regionalModel);
        } catch (regionalErr) {
            Sentry.captureException(regionalErr, {
                tags: {
                    service: SENTRY_TAGS.SERVICE_REGIONAL_MODEL_WORKER,
                    type: SENTRY_TAGS.TYPE_FALLBACK
                },
                level: 'warning'
            });
        }
    }

    // 3a. Al tròpic sense model regional, les hores passen pel filtre de pluja tropical del motor (vegeu
    // utils/tropicalRainGate.ts): la marca va a la sèrie perquè totes les pantalles l'apliquin igual.
    processedData = injectTropicalRainGate(processedData, lat, lon);

    // 3b. Probabilitat de pluja coherent amb la pluja mostrada a les hores sense model regional
    // (la pluja és d'un model determinista i la probabilitat, de l'ensemble d'ICON; vegeu injectBaseRainEvidence).
    processedData = injectBaseRainEvidence(processedData);

    // 3c. Temperatura dels dies 4-7 barrejada amb AIFS (vegeu aifsTemperatureBlend.ts). Va DESPRÉS de 3b, que
    // reconeix les hores on la sèrie principal és ICON comparant-ne la temperatura, i ABANS de la neu, que ha de
    // sortir de la mateixa temperatura que la icona.
    processedData = injectAifsTemperatureBlend(processedData);

    // 3d. Neu acumulada amb la mateixa pluja i el mateix motor que la icona de cada hora (vegeu engineSnowfall.ts).
    processedData = injectEngineSnowfall(processedData);

    // 4. Finalització i Normalització de lloc
    // [FIX] Càsting segur al spread per satisfer TS sense alterar el runtime JS
    processedData.location = {
        ...(processedData.location as Record<string, unknown>),
        name: geoData.city,
        country: geoData.country,
        latitude: lat,
        longitude: lon
    };

    // El lloc té model regional però la sèrie no en porta (petició fallida, worker fallit o esgotat —que torna les
    // dades base—, o resposta sense dades): l'usuari veu igualment la previsió global ara mateix, però el paquet
    // es marca perquè la cache només el reaprofiti uns minuts.
    const regionalMissing = shouldFetchRegional && !isRegionalModelActive(processedData.current?.source);

    const packet: WeatherCachePacket = {
        weather: processedData,
        aqi: fetchedAqi,
        ...(regionalMissing ? { regionalMissing: true, cachedAt: Date.now() } : {})
    };

    // 5. Guardar a Cache
    await cacheService.set(cacheKey, packet).catch(console.error);

    // 5b. Un cop per sessió, s'esborren les previsions desades de fa més de 24 h (vegeu cacheService.pruneOldWeather).
    // Sense esperar-la: no endarrereix la resposta.
    cacheService.pruneOldWeatherOnce();

    return {
        success: true,
        data: processedData,
        aqi: fetchedAqi
    };
};

/**
 * Previsió desada per mostrar quan no n'arriba cap de nova: la del mateix punt o, si no n'hi ha (el GPS dona
 * coordenades una mica diferents cada cop), la més propera dins d'OFFLINE_SNAPSHOT.MAX_DISTANCE_KM. S'avança fins a
 * l'hora actual (vegeu utils/offlineSnapshot.ts) i porta la marca `offlineSnapshot`. Sense qualitat de l'aire: la
 * desada seria d'una altra hora i el giny ja sap mostrar que no n'hi ha.
 */
const findOfflineSnapshot = async (
    saved: CacheEntry<WeatherCachePacket> | null,
    cacheKey: string,
    lat: number,
    lon: number,
    unit: WeatherUnit,
    lang: Language
): Promise<WeatherRepositoryResponse | null> => {
    const now = new Date();
    const fromEntry = (entry: CacheEntry<WeatherCachePacket> | null, distanceKm: number | null): WeatherRepositoryResponse | null => {
        const weather = entry?.data?.weather;
        const rolled = weather ? rollSnapshotForward(weather, now) : null;
        if (!entry || !weather || !rolled) return null;
        const issuedAt = typeof weather.current?.time === 'string' ? weather.current.time : null;
        return {
            success: true,
            data: { ...rolled, offlineSnapshot: { savedAt: entry.savedAt, issuedAt, distanceKm } },
            aqi: null
        };
    };

    const exact = fromEntry(saved, null);
    if (exact) return exact;

    const nearby = await cacheService.findWeatherKeysNear(lat, lon, unit, lang, OFFLINE_SNAPSHOT.MAX_DISTANCE_KM);
    for (const { key, distanceKm } of nearby) {
        if (key === cacheKey) continue;
        const found = fromEntry(await cacheService.getEntry<WeatherCachePacket>(key), distanceKm);
        if (found) return found;
    }
    return null;
};

export const WeatherRepository = {
    /**
     * Obté les dades meteorològiques (Cache -> API -> Regional Model Worker). Si la petició falla o tarda massa,
     * torna l'última previsió desada del lloc amb la marca `offlineSnapshot` en lloc de fallar.
     */
    async get(
        lat: number,
        lon: number,
        unit: WeatherUnit,
        lang: Language,
        locationName?: string,
        country?: string,
        runRegionalModelWorker?: RegionalModelWorkerFn,
        options: WeatherRepositoryOptions = {}
    ): Promise<WeatherRepositoryResponse> {

        const cacheKey = cacheService.generateWeatherKey(lat, lon, unit, lang);

        // 1. Intentar Cache Local
        // Es llegeix sense TTL (getEntry): si és fresca es fa servir tal qual; si no, és la previsió desada que es
        // mostrarà si la petició nova falla (pas 6).
        let saved: CacheEntry<WeatherCachePacket> | null = null;
        try {
            saved = await cacheService.getEntry<WeatherCachePacket>(cacheKey);
            const cachedPacket = saved?.data;
            const fresh = !!saved && Date.now() - saved.savedAt <= CACHE_TTL.WEATHER;
            // Sense model regional (fallada puntual o permanent) el paquet només val CACHE_TTL.WEATHER_REGIONAL_RETRY:
            // passat aquest temps es torna a demanar tot per donar una altra oportunitat al model regional.
            const regionalRetryDue = !!cachedPacket?.regionalMissing
                && (typeof cachedPacket.cachedAt !== 'number' || Date.now() - cachedPacket.cachedAt > CACHE_TTL.WEATHER_REGIONAL_RETRY);
            if (cachedPacket && fresh && !regionalRetryDue) {
                return {
                    success: true,
                    data: cachedPacket.weather,
                    aqi: cachedPacket.aqi
                };
            }
        } catch (e) {
            console.warn("Cache read error", e);
        }

        // 2-5. Previsió nova (vegeu fetchFreshWeather)
        const network = fetchFreshWeather(lat, lon, unit, lang, cacheKey, locationName, country, runRegionalModelWorker);

        // 6. Previsió desada si la nova falla o tarda massa
        // Sense connexió declarada no cal esperar: la petició segueix igualment per si el navegador s'equivoca.
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const first = await raceWithDeadline(network, offline ? 0 : OFFLINE_SNAPSHOT.WAIT_BEFORE_FALLBACK_MS);
        if (first.kind === 'fresh') return first.response;

        const snapshot = await findOfflineSnapshot(saved, cacheKey, lat, lon, unit, lang);
        if (!snapshot) {
            if (first.kind === 'failed') throw first.error;
            return network; // Lenta però sense cap previsió desada: s'espera com sempre.
        }

        // Lenta: la petició continua; si acaba bé, ja és a la cache i qui ha demanat les dades la rep aquí.
        // Si falla, l'error ja s'ha reportat a Sentry (fetchWithRetry / fetchAllWeatherData).
        if (first.kind === 'slow') {
            network.then(
                (response) => options.onLateResult?.(response),
                () => { /* ja reportat */ }
            );
        }
        return snapshot;
    }
};
