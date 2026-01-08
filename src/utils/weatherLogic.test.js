// src/utils/weatherLogic.test.js
import { describe, it, expect } from 'vitest';
import { getRealTimeWeatherCode, injectHighResModels, calculateReliability } from './weatherLogic';

// ==============================================
// 1. TESTS DE CODIS DE TEMPS (El que ja tenies)
// ==============================================

// Mock de dades bàsiques
const mockCurrent = {
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
    
    expect(result).toBeGreaterThanOrEqual(71); 
    expect(result).toBeLessThanOrEqual(75);
  });

  it('hauria de respectar la TEMPESTA (code 95) encara que plogui molt', () => {
    const current = { ...mockCurrent, weather_code: 95 };
    const minutelyPrecip = [5.0, 5.0]; 
    
    const result = getRealTimeWeatherCode(current, minutelyPrecip);
    expect(result).toBe(95);
  });

  it('hauria de forçar PLUJA si el radar diu que plou però la icona és Sol', () => {
    const current = { ...mockCurrent, weather_code: 0 }; 
    const minutelyPrecip = [1.0, 1.0]; 
    
    const result = getRealTimeWeatherCode(current, minutelyPrecip);
    const isRain = (result >= 51 && result <= 67) || (result >= 80 && result <= 82);
    expect(isRain).toBe(true);
  });

  it('hauria de detectar BOIRA si la visibilitat és molt baixa', () => {
    const current = { ...mockCurrent, weather_code: 3, visibility: 200 }; 
    const minutelyPrecip = [0, 0]; 
    
    const result = getRealTimeWeatherCode(current, minutelyPrecip);
    expect(result).toBe(45); 
  });
});

// ==============================================
// 2. TESTS DEL MOTOR DE FUSIÓ (NOU)
// ==============================================

describe('Motor de Fusió (InjectHighResModels)', () => {

  it('hauria de fusionar correctament les dades AROME sobre les dades base ECMWF', () => {
    // Simulem dades base (ECMWF)
    const baseData = {
      hourly: {
        time: ['2024-01-01T10:00', '2024-01-01T11:00', '2024-01-01T12:00'],
        temperature_2m: [10, 11, 12],
        precipitation: [0, 0, 0] // El model base diu que NO plou
      },
      current: {
        time: '2024-01-01T11:05',
        temperature_2m: 11,
        precipitation: 0
      }
    };

    // Simulem dades AROME (Alta resolució)
    const highResData = {
      hourly: {
        time: ['2024-01-01T10:00', '2024-01-01T11:00', '2024-01-01T12:00'],
        temperature_2m: [10.5, 11.5, 12.5], 
        precipitation: [0, 5.0, 0] // AROME diu que SÍ plou a les 11:00
      },
      current: {
        temperature_2m: 11.5,
        precipitation: 5.0,
        weather_code: 61
      }
    };

    const result = injectHighResModels(baseData, highResData);

    // 1. Comprovem la fusió horària (índex 1 = 11:00)
    expect(result.hourly.precipitation[1]).toBe(5.0); // Ha d'haver agafat la pluja d'AROME
    expect(result.hourly.temperature_2m[1]).toBe(11.5); // Ha d'haver agafat la temp d'AROME

    // 2. Comprovem la fusió "Current"
    expect(result.current.temperature_2m).toBe(11.5);
    expect(result.current.source).toBe('AROME HD'); // Marca d'aigua
  });

  it('hauria de gestionar correctament si falten dades AROME', () => {
    const baseData = { current: { temp: 10 } };
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

    expect(result.level).toBe('low');
    expect(result.type).toBe('temp'); // El problema és la temperatura
  });

  it('hauria de marcar fiabilitat ALTA si els models coincideixen', () => {
    const result = calculateReliability(
      { temperature_2m_max: [20] }, 
      { temperature_2m_max: [20.5] }, 
      { temperature_2m_max: [19.8] }
    );

    expect(result.level).toBe('high');
  });
});