// src/utils/aromeEngine.test.ts

import { describe, it, expect } from 'vitest';
import { injectHighResModels } from './aromeEngine';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// --- MOCK DATA HELPER ---
// Creem dades falses COMPLETES per satisfer l'esquema estricte Zod
// (Afegim camps com wind, humidity, code, etc. que són obligatoris)

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
        wind_speed_10m: 10,
        wind_direction_10m: 180,
        source: 'ECMWF'
    },
    hourly: {
        time: ["2024-01-29T12:00", "2024-01-29T13:00"],
        temperature_2m: [15, 16],
        relative_humidity_2m: [50, 50],
        apparent_temperature: [14, 15],
        precipitation: [0, 0],
        weather_code: [0, 0],
        wind_speed_10m: [10, 10],
        wind_direction_10m: [180, 180]
    }
} as unknown as ExtendedWeatherData);

const createHighResData = (): ExtendedWeatherData => ({
    current: {
        time: "2024-01-29T12:00",
        interval: 900,
        temperature_2m: 14.5, // DADA CLAU: Temperatura AROME diferent
        relative_humidity_2m: 55,
        apparent_temperature: 13.5,
        is_day: 1,
        precipitation: 0,
        rain: 0,
        showers: 0,
        weather_code: 0,
        cloud_cover: 0,
        wind_speed_10m: 12,
        wind_direction_10m: 185,
    },
    hourly: {
        time: ["2024-01-29T12:00", "2024-01-29T13:00"],
        temperature_2m: [14.5, 15.5],
        relative_humidity_2m: [55, 55],
        apparent_temperature: [13.5, 14.5],
        precipitation: [0, 2.5], // DADA CLAU: AROME detecta pluja a les 13:00
        weather_code: [0, 51],
        wind_speed_10m: [12, 12],
        wind_direction_10m: [185, 185]
    }
} as unknown as ExtendedWeatherData);

describe('AROME Engine Logic', () => {
    
    it('HAURIA de retornar les dades base intactes si no hi ha dades AROME', () => {
        const base = createBaseData();
        const result = injectHighResModels(base, null);
        
        expect(result).toEqual(base);
        expect(result.current?.temperature_2m).toBe(15);
    });

    it('HAURIA de sobreescriure la temperatura actual amb la de AROME', () => {
        const base = createBaseData();
        const highRes = createHighResData();
        
        const result = injectHighResModels(base, highRes);
        
        // Verifiquem que ha agafat el valor 14.5 (High Res) i no 15 (Base)
        expect(result.current?.temperature_2m).toBe(14.5);
        // Verifiquem que marca l'origen com AROME
        expect(result.current?.source).toBe('AROME HD');
    });

    it('HAURIA de fusionar els arrays horaris correctament', () => {
        const base = createBaseData();
        const highRes = createHighResData();
        
        const result = injectHighResModels(base, highRes);
        
        // Verifiquem que a l'hora 13:00, la precipitació és 2.5 (del model AROME)
        // L'índex 1 correspon a les 13:00 segons el nostre mock
        expect(result.hourly?.precipitation?.[1]).toBe(2.5);
    });

    it('HAURIA de ser resistent a dades corruptes (Safety Check)', () => {
        const base = createBaseData();
        // Simulem dades "brutes" o mal formades que podrien venir de l'API
        // Això fallarà la validació Zod, i gràcies al fix del logger, no petarà
        const corruptedData = {
            current: { temperature_2m: "no-number" }, // Tipus incorrecte
            hourly: null
        } as unknown as ExtendedWeatherData;

        const result = injectHighResModels(base, corruptedData);

        // El sistema hauria de detectar l'error i retornar la base sense explotar
        expect(result).toBeDefined();
        expect(result.current?.temperature_2m).toBe(15); // Es manté l'original
    });
});