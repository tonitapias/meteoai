import { describe, it, expect } from 'vitest';
// Importem l'original (V1) i el nou (V2)
import { injectHighResModels } from './aromeEngine';
import { injectHighResModelsV2 } from './aromeEngineV2';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// --- MOCK DATA FACTORIES ---

const createBaseData = (): ExtendedWeatherData => ({
    current: {
        time: "2024-01-29T12:00",
        interval: 900,
        temperature_2m: 15,
        relative_humidity_2m: 50,
        apparent_temperature: 14,
        is_day: 1,
        precipitation: 0,
        rain: 0,
        showers: 0,
        weather_code: 0,
        cloud_cover: 0,
        cloud_cover_low: 0,
        cloud_cover_mid: 0,
        cloud_cover_high: 0,
        wind_speed_10m: 10,
        wind_gusts_10m: 15,
        wind_direction_10m: 180,
        visibility: 10000,
        source: 'ECMWF'
    },
    hourly: {
        // 3 hores de dades base
        time: ["2024-01-29T12:00", "2024-01-29T13:00", "2024-01-29T14:00"], 
        temperature_2m: [15, 16, 15],
        relative_humidity_2m: [50, 50, 55],
        apparent_temperature: [14, 15, 14],
        precipitation: [0, 0, 0],
        weather_code: [0, 0, 1],
        cloud_cover: [0, 10, 20],
        cloud_cover_low: [0, 0, 0],
        cloud_cover_mid: [0, 0, 0],
        cloud_cover_high: [0, 0, 0],
        wind_speed_10m: [10, 10, 12],
        wind_gusts_10m: [15, 15, 20],
        wind_direction_10m: [180, 180, 190],
        cape: [0, 0, 0],
        freezing_level_height: [2000, 2100, 2000],
        visibility: [10000, 10000, 9000]
    }
} as unknown as ExtendedWeatherData);

const createHighResData = (): ExtendedWeatherData => ({
    current: {
        time: "2024-01-29T12:00",
        interval: 900,
        temperature_2m: 14.2, // AROME és més precís
        relative_humidity_2m: 55,
        apparent_temperature: 13.5,
        is_day: 1,
        precipitation: 0.5,
        rain: 0.5,
        showers: 0,
        weather_code: 51,
        cloud_cover: 80,
        cloud_cover_low: 80,
        cloud_cover_mid: 20,
        cloud_cover_high: 0,
        wind_speed_10m: 12,
        wind_gusts_10m: 25,
        wind_direction_10m: 185,
        visibility: 8000,
        // Sense source, l'engine l'ha d'afegir
    },
    hourly: {
        // Simulem que AROME només cobreix les primeres 2 hores (cas real de desincronització)
        time: ["2024-01-29T12:00", "2024-01-29T13:00"], 
        temperature_2m: [14.2, 15.1],
        relative_humidity_2m: [55, 60],
        apparent_temperature: [13.5, 14.0],
        precipitation: [0.5, 3.0], 
        weather_code: [51, 61],
        cloud_cover: [80, 100],
        cloud_cover_low: [80, 100],
        cloud_cover_mid: [20, 50],
        cloud_cover_high: [0, 0],
        wind_speed_10m: [12, 14],
        wind_gusts_10m: [25, 30],
        wind_direction_10m: [185, 190],
        cape: [50, 100],
        freezing_level_height: [1900, 1950],
        visibility: [8000, 5000]
    },
    minutely_15: {
        time: ["2024-01-29T12:00", "2024-01-29T12:15"],
        precipitation: [0.5, 1.2]
    }
} as unknown as ExtendedWeatherData);

describe('AROME Engine V1 vs V2 Parity Check', () => {
    
    it('PARITY: Ambdós motors han de retornar resultats EXACTES amb input estàndard', () => {
        const base = createBaseData();
        const highRes = createHighResData();
        
        const v1 = injectHighResModels(base, highRes);
        const v2 = injectHighResModelsV2(base, highRes);
        
        expect(v2).toEqual(v1);
    });

    it('PARITY: Ambdós han de gestionar NULL highResData igual (retornar base intacta)', () => {
        const base = createBaseData();
        
        const v1 = injectHighResModels(base, null);
        const v2 = injectHighResModelsV2(base, null);
        
        expect(v2).toEqual(v1);
        expect(v2).toEqual(base); // Doble comprovació
    });

    it('PARITY: Resistència a dades corruptes (Zod Fallback)', () => {
        const base = createBaseData();
        // Simulem dades que trenquen l'esquema
        const corrupted = {
            current: { temperature_2m: "invalid-string" }, 
            hourly: null
        } as unknown as ExtendedWeatherData;
        
        const v1 = injectHighResModels(base, corrupted);
        const v2 = injectHighResModelsV2(base, corrupted);
        
        // Ambdós haurien d'ignorar les dades corruptes i retornar la base
        expect(v2).toEqual(v1);
        expect(v2.current?.temperature_2m).toBe(15); 
    });

    it('PARITY: Gestió de "forats" temporals (Sparse Data)', () => {
        const base = createBaseData();
        const partialHighRes = createHighResData();
        
        // Simulem que només arriba una hora solta al mig
        partialHighRes.hourly!.time = ["2024-01-29T13:00"]; 
        partialHighRes.hourly!.temperature_2m = [10];
        
        const v1 = injectHighResModels(base, partialHighRes);
        const v2 = injectHighResModelsV2(base, partialHighRes);
        
        // L'algoritme de mapatge d'índexs per temps ha de coincidir exactament
        expect(v2).toEqual(v1);
        expect(v2.hourly?.temperature_2m?.[1]).toBe(10); // A les 13:00
    });
});