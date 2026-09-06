// src/repositories/WeatherRepository.ts
import * as Sentry from "@sentry/react";
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { normalizeModelData } from '../utils/normData';
import { selectRegionalModel, type RegionalModel } from '../constants/regionalModels';
import type { AirQualityData, WeatherData } from '../types/weather';
import { getRegionalHDData } from '../services/weatherApi';
import { fetchAllWeatherData } from '../services/weatherService';
import type { WeatherUnit } from '../utils/formatters';
import { cacheService } from '../services/cacheService'; 
import { SENTRY_TAGS } from '../constants/errorConstants';
import type { Language } from '../translations';

// Tipus de retorn
interface WeatherRepositoryResponse {
    success: true;
    data: ExtendedWeatherData;
    aqi: AirQualityData | null;
}

// Tipus per a la funció del Worker (per injectar-la)
// [CORRECCIÓ] Substituït 'any' per 'WeatherData' (Tipatge estricte)
type RegionalModelWorkerFn = (currentData: ExtendedWeatherData, regionalData: WeatherData, model: RegionalModel) => Promise<ExtendedWeatherData>;

const CACHE_TTL = 15 * 60 * 1000; 

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
            const cachedPacket = await cacheService.get<{ weather: ExtendedWeatherData; aqi: AirQualityData | null }>(cacheKey, CACHE_TTL);
            if (cachedPacket) {
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

        // 4. Finalització i Normalització de lloc
        // [FIX] Càsting segur al spread per satisfer TS sense alterar el runtime JS
        processedData.location = { 
            ...(processedData.location as Record<string, unknown>), 
            name: geoData.city,
            country: geoData.country,
            latitude: lat,
            longitude: lon 
        };

        const packet = {
            weather: processedData,
            aqi: fetchedAqi
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