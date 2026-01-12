// src/utils/weatherLogic.test.ts
import { describe, it, expect } from 'vitest';
import { getRealTimeWeatherCode, injectHighResModels, calculateReliability, ExtendedWeatherData } from './weatherLogic';

// ==============================================
// 1. TESTS DE CODIS DE TEMPS
// ==============================================

// Mock de dades bàsiques
const mockCurrent: any = {
  weather_code: 3, 
  temperature_2m: 15,
  relative_humidity_2m: 80,
  visibility: 10000,
  is_day: 1
};

describe('getRealTimeWeatherCode - Detecció Intel·ligent', () => {
  
  it('hauria de detectar NEU si la temperatura és baixa (0ºC) i hi ha precipitació', () => {
    const current = { ...mockCurrent, temperature_2m: 0, weather_code: 61 }; 
    const minutelyPrecip = [1.0, 1.0]; 
    
    // Test amb cota de neu a 200m i elevació 0m
    const result = getRealTimeWeatherCode(current, minutelyPrecip, 100, 200, 0);
    
    // Els codis de neu són 71, 73, 75
    expect(result).toBeGreaterThanOrEqual(71); 
    expect(result).toBeLessThanOrEqual(75);
  });

  it('hauria de respectar la TEMPESTA (code 95) encara que el radar digui pluja lleugera', () => {
    const current = { ...mockCurrent, weather_code: 95 };
    const minutelyPrecip = [0.5]; // Pluja lleugera
    
    const result = getRealTimeWeatherCode(current, minutelyPrecip, 100, 3000, 0);
    expect(result).toBe(95); // Ha de mantenir tempesta
  });

  it('hauria de forçar PLUJA si el radar detecta aigua però el model diu núvol (code 3)', () => {
    const current = { ...mockCurrent, weather_code: 3 }; // Ennuvolat
    const minutelyPrecip = [2.0]; // Pluja moderada al radar
    
    const result = getRealTimeWeatherCode(current, minutelyPrecip, 0, 3000, 0);
    // Ha de canviar a un codi de pluja (51-67 o 80-82)
    const isRain = (result >= 51 && result <= 67) || (result >= 80 && result <= 82);
    expect(isRain).toBe(true);
  });
});

// ==============================================
// 2. TESTS DE FUSIÓ DE MODELS (AROME)
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

    // Fem un cast a ExtendedWeatherData per simular l'objecte real
    const result = injectHighResModels(baseData as ExtendedWeatherData, aromeData);

    // 1. Comprovem la fusió "Hourly" (index 1 hauria de ser 11.5)
    // Nota: La lògica de injectHighResModels actualitza l'array original en posicions coincidents
    expect(result.hourly.precipitation[0]).toBe(5.0); // Ha d'haver agafat la pluja d'AROME
    expect(result.hourly.temperature_2m[0]).toBe(12.5); // Ha d'haver agafat la temp d'AROME

    // 2. Comprovem la fusió "Current"
    expect(result.current.temperature_2m).toBe(12.5);
    expect(result.current.source).toBe('AROME HD'); // Marca d'aigua
  });

  it('hauria de gestionar correctament si falten dades AROME', () => {
    const baseData = { current: { temperature_2m: 10 } } as any;
    const result = injectHighResModels(baseData, null);
    expect(result).toEqual(baseData); // Ha de retornar el base sense tocar
  });
});

// ==============================================
// 3. TESTS DE FIABILITAT
// ==============================================

describe('Càlcul de Fiabilitat (Reliability)', () => {
  it('hauria de marcar fiabilitat BAIXA si els models discrepen molt', () => {
    // Model 1: 20ºC, Model 2: 10ºC -> Discrepància enorme
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