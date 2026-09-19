// src/utils/weatherLogic.test.ts
import { describe, it, expect } from 'vitest';

// Imports directes als fitxers on viuen ara les funcions
import { getRealTimeWeatherCode } from './weatherLogic';
import { injectHighResModels } from './regionalModelEngine';
import { calculateReliability } from './rules/reliabilityRules';
import { ExtendedWeatherData, StrictDailyWeather, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { REGIONAL_MODELS } from '../constants/regionalModels';

const AROME_MODEL = REGIONAL_MODELS.find(m => m.id === 'AROME_HD')!;

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

    // POLÍTICA DE BOIRA (vegeu resolveFog / HUMIDITY.FOG_MAX_SPREAD): senyal de boira del
    // model (codi 45/48 o visibilitat < 1 km) I saturació de superfície (T−Td <= 0,5 °C).
    it('hauria de detectar BOIRA si el model la preveu i la saturació ho confirma', () => {
        const current = createCurrent(45, 10, 0, 100);
        current.relative_humidity_2m = 100;

        const result = getRealTimeWeatherCode(current, [0], 0, 3000, 0);
        expect(result).toBe(45);
    });

    it('hauria de detectar BOIRA per visibilitat < 1 km si la saturació ho confirma', () => {
        const current = createCurrent(0, 10, 0, 0);
        current.relative_humidity_2m = 99;
        current.visibility = 400;

        const result = getRealTimeWeatherCode(current, [0], 0, 3000, 0);
        expect(result).toBe(45);
    });

    it('la saturació SOLA (sense cap senyal de boira del model) no fabrica boira', () => {
        const current = createCurrent(3, 10, 0, 100);
        current.relative_humidity_2m = 100;

        const result = getRealTimeWeatherCode(current, [0], 0, 3000, 0);
        expect(result).toBe(3);
    });

    it('un senyal de boira del model SENSE saturació no es converteix en icona de boira', () => {
        // Cas real (Vic, nit del 18 al 19/09/2026): ICON deia codi 45 i visibilitat 840 m,
        // però AROME/el sensor tenien 15,2 °C i HR 96 % (T−Td = 0,6 °C) i els METAR
        // propers marcaven CAVOK. Amb HR 94 % (T−Td ≈ 1 °C), tampoc.
        for (const rh of [96, 94]) {
            const current = createCurrent(45, 15.2, 0, 0);
            current.relative_humidity_2m = rh;
            current.visibility = 840;

            const result = getRealTimeWeatherCode(current, [0], 0, 3000, 500);
            expect(result).not.toBe(45);
            expect(result).not.toBe(48);
        }
    });

    it('amb saturació però amb pluja, el codi de precipitació mana sobre la boira', () => {
        const current = createCurrent(45, 10, 1.2, 100);
        current.relative_humidity_2m = 100;
        current.visibility = 300;

        const result = getRealTimeWeatherCode(current, [1.2], 100, 3000, 0);
        expect(result).toBe(61);
    });

    it('boira amb T <= 0 °C sortida per visibilitat (sense codi 48 del model) és GEBRADORA', () => {
        const current = createCurrent(0, -4, 0, 0);
        current.relative_humidity_2m = 100;
        current.visibility = 400;

        expect(getRealTimeWeatherCode(current, [0], 0, 0, 500)).toBe(48);
    });

    it('boira amb T > 0 °C mai és gebradora encara que el model digui 48', () => {
        const current = createCurrent(48, 3, 0, 100);
        current.relative_humidity_2m = 100;

        expect(getRealTimeWeatherCode(current, [0], 0, 3000, 0)).toBe(45);
    });

    // PLUJA/PLUGIM ENGELANT: abans determineSnowCode els convertia sempre en neu a T <= 1 °C
    // (i applyThermalLock els rebaixava per sobre), així que 56/57/66/67 no sortien MAI del
    // motor: una pluja engelant a -1 °C es pintava com "Nevada moderada".
    it('la pluja i el plugim engelants (56/57/66/67) sobreviuen a T <= 1 °C i NO es converteixen en neu', () => {
        const cases: Array<[number, number]> = [[56, 0.3], [57, 1], [66, 1], [67, 3]];
        for (const [code, mm] of cases) {
            for (const temp of [-5, -1, 0, 1]) {
                const current = createCurrent(code, temp, mm, 100);
                expect(getRealTimeWeatherCode(current, [mm], 0, 100, 0)).toBe(code);
            }
        }
    });

    it('la pluja engelant es rebaixa a pluja líquida quan la superfície és càlida', () => {
        const cases: Array<[number, number]> = [[56, 51], [57, 53], [66, 61], [67, 63]];
        for (const [code, liquid] of cases) {
            const current = createCurrent(code, 8, 1, 100);
            // Cota de gel alta: no hi ha cap base tèrmica per a gel ni neu.
            expect(getRealTimeWeatherCode(current, [1], 0, 3000, 0)).toBe(liquid);
        }
    });

    it('la pluja engelant sense precipitació real (telemetria) no es manté', () => {
        const current = createCurrent(66, -1, 0, 100);
        expect(getRealTimeWeatherCode(current, [0], 0, 100, 0)).toBe(3);
    });

    it('la pluja normal a <= 1 °C continua convertint-se en neu (no és engelant)', () => {
        const current = createCurrent(63, -1, 1, 100);
        expect(getRealTimeWeatherCode(current, [1], 0, 100, 0)).toBe(73);
    });

    it('DOCTRINA RISC ZERO: sense temperatura real, ha de tornar null (mai un 0ºC fals)', () => {
        // Un 0ºC fals aquí podria fer que determineSnowCode/applyThermalLock
        // mostressin neu en ple estiu si la temperatura real fos, per exemple, 30ºC.
        const current = {
            weather_code: 61,
            precipitation: 1,
            relative_humidity_2m: 80,
            cloud_cover_low: 50,
        } as unknown as StrictCurrentWeather;

        const result = getRealTimeWeatherCode(current, [1], 80, 3000, 0);
        expect(result).toBe(null);
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
             temperature_2m: 20,
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

describe('injectHighResModels - Fusió AROME', () => {
     it('hauria de sobreescriure dades "Current" amb AROME', () => {
         const baseData = {
             current: { temperature_2m: 10, weather_code: 3 },
             hourly: { temperature_2m: [10, 10] }
         } as unknown as ExtendedWeatherData;

         const regionalData = {
             current: { temperature_2m: 12, weather_code: 61 },
             hourly: { temperature_2m: [12, 12] }
         } as unknown as ExtendedWeatherData;

         const result = injectHighResModels(baseData, regionalData, AROME_MODEL);

         expect(result.current.temperature_2m).toBe(12);
         expect(result.current.weather_code).toBe(61);
         expect(result.current.source).toBe('AROME HD');
     });

     it('hauria de gestionar correctament si falten dades AROME', () => {
         const baseData = { current: { temperature_2m: 10 } } as unknown as ExtendedWeatherData;
         const result = injectHighResModels(baseData, null as unknown as ExtendedWeatherData, AROME_MODEL);
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

   it('DOCTRINA RISC ZERO: ECMWF (5è paràmetre) participa de debò a la comparació, no es descarta', () => {
     // Best/GFS/ICON coincideixen bé (com al test anterior, que dona ALTA
     // sense ECMWF), però ECMWF discrepa molt — abans es baixava però mai
     // s'incloïa aquí, així que aquest cas hauria donat ALTA fals.
     const result = calculateReliability(
       { temperature_2m_max: [20] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [20.5] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [19.5] } as unknown as StrictDailyWeather,
       0,
       { temperature_2m_max: [30] } as unknown as StrictDailyWeather
     );
     expect(result.level).toBe('low');
   });

   it('sense ECMWF disponible, el comportament és idèntic al d\'abans (3 models)', () => {
     const result = calculateReliability(
       { temperature_2m_max: [20], precipitation_probability_max: [0] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [20.5], precipitation_probability_max: [0] } as unknown as StrictDailyWeather,
       { temperature_2m_max: [19.5], precipitation_probability_max: [0] } as unknown as StrictDailyWeather,
       0,
       null
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