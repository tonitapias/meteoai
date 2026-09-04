// src/repositories/WeatherRepository.ts
import * as Sentry from "@sentry/react";
import type { ExtendedWeatherData } from '../types/weatherLogicTypes'; 
import { normalizeModelData } from '../utils/normData'; 
import { isAromeSupported } from '../utils/weatherMath';
import type { AirQualityData, WeatherData } from '../types/weather';
import { getAromeData } from '../services/weatherApi'; 
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
type AromeWorkerFn = (currentData: ExtendedWeatherData, aromeData: WeatherData) => Promise<ExtendedWeatherData>;

const CACHE_TTL = 15 * 60 * 1000; 

export const WeatherRepository = {
    /**
     * Obté les dades meteorològiques (Cache -> API -> Arome Worker)
     */
    async get(
        lat: number, 
        lon: number, 
        unit: WeatherUnit, 
        lang: Language, 
        locationName?: string, 
        country?: string,
        runAromeWorker?: AromeWorkerFn
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
        // [FIX PRECISIÓ] AROME no depèn de cap resultat de fetchAllWeatherData
        // (només necessita lat/lon), així que abans s'esperava seqüencialment
        // sense cap motiu — una llatència extra sencera a cada consulta dins la
        // zona de cobertura (França/Catalunya, el públic principal de l'app).
        // L'iniciem en paral·lel; capturem la seva fallada aquí mateix (no dins
        // el Promise.all) perquè un error d'AROME mai faci caure la petició
        // principal de meteo.
        const shouldFetchArome = isAromeSupported(lat, lon) && !!runAromeWorker;
        const aromePromise: Promise<WeatherData | null> = shouldFetchArome
            ? getAromeData(lat, lon).catch((aromeErr) => {
                Sentry.captureException(aromeErr, {
                    tags: {
                        service: SENTRY_TAGS.SERVICE_AROME_WORKER,
                        type: SENTRY_TAGS.TYPE_FALLBACK
                    },
                    level: 'warning'
                });
                return null;
            })
            : Promise.resolve(null);

        const [{ weatherRaw, geoData, aqiData: fetchedAqi }, aromeRaw] = await Promise.all([
            fetchAllWeatherData(lat, lon, unit, lang, locationName, country),
            aromePromise
        ]);

        let processedData = normalizeModelData(weatherRaw);

        // 3. Integració AROME (si la petició ha tingut èxit)
        if (aromeRaw && runAromeWorker) {
            try {
                processedData = await runAromeWorker(processedData, aromeRaw);
            } catch (aromeErr) {
                Sentry.captureException(aromeErr, {
                    tags: {
                        service: SENTRY_TAGS.SERVICE_AROME_WORKER,
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