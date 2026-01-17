// src/utils/weatherLogic.test.ts
import { describe, it, expect } from 'vitest';
import { getRealTimeWeatherCode, injectHighResModels, calculateReliability, ExtendedWeatherData } from './weatherLogic';

// ==============================================
// 1. TESTS DE CODIS DE TEMPS (CASOS BÀSICS)
// ==============================================

const mockCurrent: any = {
  weather_code: 3, 
  temperature_2m: 15,
  relative_humidity_2m: 80,
  visibility: 10000,
  is_day: 1,
  cloud_cover: 50,
  cloud_cover_low: 50,
  cloud_cover_mid: 0,
  cloud_cover_high: 0
};

describe('getRealTimeWeatherCode - Detecció Intel·ligent', () => {
  
  it('hauria de detectar NEU si la temperatura és baixa (0ºC) i hi ha precipitació', () => {
    const current = { ...mockCurrent, temperature_2m: 0, weather_code: 61 }; 
    const minutelyPrecip = [1.0, 1.0]; 
    const result = getRealTimeWeatherCode(current, minutelyPrecip, 100, 200, 0);
    expect(result).toBeGreaterThanOrEqual(71); 
    expect(result).toBeLessThanOrEqual(75);
  });

  it('hauria de respectar la TEMPESTA (code 95) encara que el radar digui pluja lleugera', () => {
    const current = { ...mockCurrent, weather_code: 95 };
    const minutelyPrecip = [0.5]; 
    const result = getRealTimeWeatherCode(current, minutelyPrecip, 100, 3000, 0);
    expect(result).toBe(95); 
  });

  it('hauria de forçar PLUJA si el radar detecta aigua però el model diu núvol (code 3)', () => {
    const current = { ...mockCurrent, weather_code: 3 }; 
    const minutelyPrecip = [2.0]; 
    const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0);
    const isRain = (result >= 51 && result <= 67) || (result >= 80 && result <= 82);
    expect(isRain).toBe(true);
  });
});

// ==============================================
// 2. TESTS NOUS: MILLORES AROME I FÍSICA
// ==============================================

describe('Noves Millores Físiques (AROME i Boira)', () => {

    it('hauria de detectar BOIRA per saturació (Dew Point Spread)', () => {
        const current = { 
            ...mockCurrent, 
            weather_code: 3, 
            temperature_2m: 10,
            relative_humidity_2m: 99,
            cloud_cover_low: 60 
        };
        const result = getRealTimeWeatherCode(current, [], 0, 3000, 0);
        expect(result).toBe(45); 
    });

    it('hauria de detectar PLUJA FINA si la font és AROME (Sensibilitat TRACE 0.1mm)', () => {
        const current = { 
            ...mockCurrent, 
            source: 'AROME HD', 
            weather_code: 3, 
            precipitation: 0 
        };
        // CORRECCIÓ TEST: Validem amb 0.15mm perquè 0.03mm (test anterior) és < TRACE i s'ha d'ignorar.
        const minutelyPrecip = [0.15]; 
        const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0);
        expect(result).toBe(61); 
    });

    it('hauria de ponderar correctament els núvols ALTS (Cirrus)', () => {
        const current = { 
            ...mockCurrent, 
            weather_code: 3, 
            cloud_cover_low: 0,
            cloud_cover_mid: 0,
            cloud_cover_high: 100 
        };
        const result = getRealTimeWeatherCode(current, [], 0, 3000, 0);
        expect(result).toBeLessThanOrEqual(1); // Esperem sol o parcialment ennuvolat
    });

    it('hauria de convertir PLUJA en TEMPESTA si hi ha CAPE alt', () => {
        const current = { 
            ...mockCurrent, 
            weather_code: 3,
            cloud_cover_low: 80 
        };
        
        // CORRECCIÓ TEST: Afegim pluja (1.0mm) per validar que l'energia (CAPE) converteix la pluja en tempesta.
        // Sense pluja, la lògica correcta és NO mostrar tempesta (evitar falsos positius).
        const minutelyPrecip = [1.0];
        
        const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0, 1600);
        expect(result).toBe(95); 
    });
});

// ==============================================
// 3. TESTS DE FUSIÓ DE MODELS (AROME)
// ==============================================

describe('injectHighResModels - Fusió AROME', () => {
  it('hauria de sobreescriure dades "Current" amb AROME', () => {
    const baseData: Partial<ExtendedWeatherData> = { 
        current: { 
            temperature_2m: 10, 
            wind_speed_10m: 20,
            weather_code: 3,
            time: '2023-01-01T12:00'
        } as any,
        hourly: { time: ['2023-01-01T12:00', '2023-01-01T13:00'], temperature_2m: [10, 11] } as any
    };

    const aromeData = {
        current: { temperature_2m: 12.5, wind_speed_10m: 25, weather_code: 61, precipitation: 5.0 },
        hourly: { time: ['2023-01-01T12:00', '2023-01-01T13:00'], temperature_2m: [12.5, 11.5], precipitation: [5.0, 5.0] }
    };

    const result = injectHighResModels(baseData as ExtendedWeatherData, aromeData);
    expect(result.hourly.precipitation[0]).toBe(5.0); 
    expect(result.hourly.temperature_2m[0]).toBe(12.5); 
    expect(result.current.temperature_2m).toBe(12.5);
    expect(result.current.source).toBe('AROME HD'); 
  });

  it('hauria de gestionar correctament si falten dades AROME', () => {
    const baseData = { current: { temperature_2m: 10 } } as any;
    const result = injectHighResModels(baseData, null);
    expect(result).toEqual(baseData); 
  });
});

// ==============================================
// 4. TESTS DE FIABILITAT
// ==============================================

describe('Càlcul de Fiabilitat (Reliability)', () => {
  it('hauria de marcar fiabilitat BAIXA si els models discrepen molt', () => {
    const result = calculateReliability(
      { temperature_2m_max: [20] }, 
      { temperature_2m_max: [10] }, 
      { temperature_2m_max: [18] }
    );
    expect(result?.level).toBe('low');
    expect(result?.type).toBe('temp');
  });

  it('hauria de marcar fiabilitat ALTA si els models coincideixen', () => {
    const result = calculateReliability(
      { temperature_2m_max: [20], precipitation_probability_max: [0] }, 
      { temperature_2m_max: [20.5], precipitation_probability_max: [0] }, 
      { temperature_2m_max: [19.8], precipitation_probability_max: [10] }
    );
    expect(result?.level).toBe('high');
  });
});