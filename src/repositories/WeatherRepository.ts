// src/repositories/WeatherRepository.ts
import * as Sentry from "@sentry/react";
import type { ExtendedWeatherData } from '../types/weatherLogicTypes'; 
import { normalizeModelData } from '../utils/normData'; 
import { isAromeSupported } from '../utils/physics';
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
        
        const cacheKey = cacheService.generateWeatherKey(lat, lon, unit);

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

        // 2. Petició de Xarxa (API)
        const { weatherRaw, geoData, aqiData: fetchedAqi } = await fetchAllWeatherData(
            lat, lon, unit, lang, locationName, country
        );

        let processedData = normalizeModelData(weatherRaw);
        
        // 3. Integració AROME (Si està suportat i tenim el worker disponible)
        if (isAromeSupported(lat, lon) && runAromeWorker) {
            try {
                const aromeRaw = await getAromeData(lat, lon);
                // Executem el worker injectat
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