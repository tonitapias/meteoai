// src/utils/weatherLogic.test.ts
import { describe, it, expect } from 'vitest';

// Imports directes als fitxers on viuen ara les funcions
import { getRealTimeWeatherCode } from './weatherLogic';
import { injectHighResModelsV2 } from './aromeEngineV2';
import { calculateReliability } from './rules/reliabilityRules';
import { ExtendedWeatherData, StrictDailyWeather, StrictCurrentWeather } from '../types/weatherLogicTypes';

describe('weatherLogic - getRealTimeWeatherCode', () => {
    
    const createCurrent = (code: number, temp: number, rain: number, cloud: number, cape = 0): StrictCurrentWeather => ({
        time: '2024-01-01T12:00',
        weather_code: code,
        temperature_2m: temp,
        precipitation: rain,
        relative_humidity_2m: 80,
        cloud_cover_low: cloud,
        cloud_cover_mid: cloud,
        cloud_cover_high: cloud,
        wind_speed_10m: 10,
        apparent_temperature: temp,
        is_day: 1,
        cape: cape 
    });

    it('hauria de detectar NEU si la temperatura és baixa (0ºC) i hi ha precipitació', () => {
        const current = createCurrent(61, 0, 0.2, 100);
        const minutelyPrecip = [0.2];
        const result = getRealTimeWeatherCode(current, minutelyPrecip, 100, 200, 500); 
        expect(result).toBe(71); 
    });

    it('hauria de respectar la TEMPESTA (code 95) encara que el radar digui pluja lleugera', () => {
        const current = createCurrent(95, 15, 0.5, 100);
        const minutelyPrecip = [0.5];
        const result = getRealTimeWeatherCode(current, minutelyPrecip, 50, 3000, 0);
        expect(result).toBe(95);
    });

    it('hauria de forçar PLUJA si el radar detecta aigua però el model diu núvol (code 3)', () => {
        const current = createCurrent(3, 15, 0, 100); 
        const minutelyPrecip = [2.0];
        const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0);
        expect(result).toBe(63); 
    });

    it('hauria de detectar BOIRA per saturació (Dew Point Spread)', () => {
        const current = createCurrent(3, 10, 0, 100);
        current.relative_humidity_2m = 100;
        
        const minutelyPrecip = [0];
        const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0);
        expect(result).toBe(45);
    });
});

describe('Noves Millores Físiques (AROME i Boira)', () => {
     it('hauria de detectar PLUJA FINA si la font és AROME (Sensibilitat TRACE 0.1mm)', () => {
         const current = { 
             weather_code: 3, 
             temperature_2m: 15,
             precipitation: 0.15, 
             cloud_cover_low: 100,
             source: 'arome' 
         } as unknown as StrictCurrentWeather;
         
         const minutelyPrecip = [0.15];
         const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0);
         expect(result).toBe(61); 
     });

     it('hauria de ponderar correctament els núvols ALTS (Cirrus)', () => {
         const current = {
             weather_code: 0,
             cloud_cover_low: 0,
             cloud_cover_mid: 0,
             cloud_cover_high: 100,
             is_day: 1
         } as unknown as StrictCurrentWeather;

         const minutelyPrecip = [0];
         const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0);
         expect([1, 2]).toContain(result); 
     });

     it('hauria de convertir PLUJA en TEMPESTA si hi ha CAPE alt', () => {
         const current = {
             weather_code: 61, 
             temperature_2m: 25,
             precipitation: 5.0,
             cloud_cover_low: 100,
             cloud_cover_mid: 100,
             cloud_cover_high: 100,
             cape: 1600
         } as unknown as StrictCurrentWeather;

         const minutelyPrecip = [1.0];
         const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0);
         expect(result).toBe(95); 
     });
});

describe('injectHighResModelsV2 - Fusió AROME', () => {
     it('hauria de sobreescriure dades "Current" amb AROME', () => {
         const baseData = {
             current: { temperature_2m: 10, weather_code: 3 },
             hourly: { temperature_2m: [10, 10] }
         } as unknown as ExtendedWeatherData;

         const aromeData = {
             current: { temperature_2m: 12, weather_code: 61 }, 
             hourly: { temperature_2m: [12, 12] }
         } as unknown as ExtendedWeatherData;

         const result = injectHighResModelsV2(baseData, aromeData);

         expect(result.current.temperature_2m).toBe(12);
         expect(result.current.weather_code).toBe(61);
         expect(result.current.source).toBe('AROME HD');
     });

     it('hauria de gestionar correctament si falten dades AROME', () => {
         const baseData = { current: { temperature_2m: 10 } } as unknown as ExtendedWeatherData;
         const result = injectHighResModelsV2(baseData, null as unknown as ExtendedWeatherData);
         expect(result).toEqual(baseData);
     });
});

describe('Càlcul de Fiabilitat (Reliability)', () => {
   it('hauria de marcar fiabilitat BAIXA si els models discrepen molt', () => {
     const result = calculateReliability(
       { temperature_2m_max: [20] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [10] } as unknown as StrictDailyWeather, 
       { temperature_2m_max: [15] } as unknown as StrictDailyWeather,
       0
     );
     expect(result.level).toBe('low');
   });

   it('hauria de marcar fiabilitat ALTA si els models coincideixen', () => {
     const result = calculateReliability(
       { temperature_2m_max: [20], precipitation_probability_max: [0] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [20.5], precipitation_probability_max: [0] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [19.5], precipitation_probability_max: [0] } as unknown as StrictDailyWeather,
       0
     );
     expect(result.level).toBe('high');
   });

   it('DOCTRINA RISC ZERO: una dada absent d\'un model no s\'ha de fingir com un 0ºC real', () => {
     // GFS no té dada per a aquest dia (array buit). Best=20, ICON=19 coincideixen bé.
     // Abans del fix, l'absència de GFS es convertia en un fals 0ºC via safeNum,
     // disparant un diffTemp fals de 20 graus i una fiabilitat BAIXA fictícia.
     const result = calculateReliability(
       { temperature_2m_max: [20] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [19] } as unknown as StrictDailyWeather,
       0
     );
     expect(result.level).toBe('high');
   });

   it('hauria de marcar fiabilitat MITJANA (no ALTA ni BAIXA) si cap model té dada comparable', () => {
     const result = calculateReliability(
       { temperature_2m_max: [] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [] } as unknown as StrictDailyWeather,
       0
     );
     expect(result.level).toBe('medium');
     expect(result.type).toBe('general');
   });
});