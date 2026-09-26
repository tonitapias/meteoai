// src/repositories/WeatherRepository.ts
import * as Sentry from "@sentry/react";
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { normalizeModelData } from '../utils/normData';
import { injectBaseRainEvidence } from '../utils/regionalModelEngine';
import { injectEngineSnowfall } from '../utils/engineSnowfall';
import { isRegionalModelActive, selectRegionalModel, type RegionalModel } from '../constants/regionalModels';
import type { AirQualityData, WeatherData } from '../types/weather';
import { getRegionalHDData } from '../services/weatherApi';
import { fetchAllWeatherData } from '../services/weatherService';
import type { WeatherUnit } from '../utils/formatters';
import { cacheService } from '../services/cacheService'; 
import { SENTRY_TAGS } from '../constants/errorConstants';
import type { Language } from '../translations';
import { CACHE_TTL } from '../constants/cacheConfig';

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
interface WeatherRepositoryResponse {
    success: true;
    data: ExtendedWeatherData;
    aqi: AirQualityData | null;
}

// Tipus per a la funció del Worker (per injectar-la)
// [CORRECCIÓ] Substituït 'any' per 'WeatherData' (Tipatge estricte)
type RegionalModelWorkerFn = (currentData: ExtendedWeatherData, regionalData: WeatherData, model: RegionalModel) => Promise<ExtendedWeatherData>;

export const WeatherRepository = {
    /**
     * Obté les dades meteorològiques (Cache -> API -> Regional Model Worker)
     */
    async get(
        lat: number, 
        lon: number, 
        unit: WeatherUnit, 
        lang: Language, 
        locationName?: string,
        country?: string,
        runRegionalModelWorker?: RegionalModelWorkerFn
    ): Promise<WeatherRepositoryResponse> {
        
        const cacheKey = cacheService.generateWeatherKey(lat, lon, unit, lang);

        // 1. Intentar Cache Local
        try {
            const cachedPacket = await cacheService.get<WeatherCachePacket>(cacheKey, CACHE_TTL.WEATHER);
            // Sense model regional (fallada puntual o permanent) el paquet només val CACHE_TTL.WEATHER_REGIONAL_RETRY:
            // passat aquest temps es torna a demanar tot per donar una altra oportunitat al model regional.
            const regionalRetryDue = !!cachedPacket?.regionalMissing
                && (typeof cachedPacket.cachedAt !== 'number' || Date.now() - cachedPacket.cachedAt > CACHE_TTL.WEATHER_REGIONAL_RETRY);
            if (cachedPacket && !regionalRetryDue) {
                return { 
                    success: true, 
                    data: cachedPacket.weather, 
                    aqi: cachedPacket.aqi 
                };
            }
        } catch (e) {
            console.warn("Cache read error", e);
        }

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

        // 3b. Probabilitat de pluja coherent amb la pluja mostrada a les hores sense model regional
        // (la pluja és d'un model determinista i la probabilitat, de l'ensemble d'ICON; vegeu injectBaseRainEvidence).
        processedData = injectBaseRainEvidence(processedData);

        // 3c. Neu acumulada amb la mateixa pluja i el mateix motor que la icona de cada hora (vegeu engineSnowfall.ts).
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
        
        return { 
            success: true, 
            data: processedData, 
            aqi: fetchedAqi 
        };
    }
};