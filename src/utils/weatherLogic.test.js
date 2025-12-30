// src/utils/weatherLogic.test.js
import { describe, it, expect } from 'vitest';
import { getRealTimeWeatherCode } from './weatherLogic';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

// Mock de dades bàsiques per no haver d'escriure tot l'objecte cada vegada
const mockCurrent = {
  weather_code: 3, // Núvol
  temperature_2m: 15,
  relative_humidity_2m: 80,
  visibility: 10000,
  is_day: 1
};

describe('getRealTimeWeatherCode', () => {
  
  it('hauria de detectar NEU si la temperatura és baixa (0ºC) i hi ha precipitació', () => {
    const current = { ...mockCurrent, temperature_2m: 0, weather_code: 61 }; // Code 61 = Pluja
    const minutelyPrecip = [1.0, 1.0]; // Està plovent
    
    // Cridem la funció: (current, minutely, prob, freezingLevel, elevation)
    // Posem cota de neu a 200m i nosaltres estem a 0m
    const result = getRealTimeWeatherCode(current, minutelyPrecip, 100, 200, 0);
    
    // Esperem que el codi canviï a 73 (Neu moderada) o 71/75
    // Segons la teva lògica, amb 1.0mm hauria de ser neu
    expect(result).toBeGreaterThanOrEqual(71); 
    expect(result).toBeLessThanOrEqual(75);
  });

  it('hauria de respectar la TEMPESTA (code 95) encara que plogui molt', () => {
    // Si l'API ja diu que hi ha tempesta elèctrica (95)
    const current = { ...mockCurrent, weather_code: 95 };
    const minutelyPrecip = [5.0, 5.0]; // Diluvi universal
    
    const result = getRealTimeWeatherCode(current, minutelyPrecip);
    
    // No l'hauria de canviar a "pluja forta" (65), s'ha de mantenir en tempesta
    expect(result).toBe(95);
  });

  it('hauria de forçar PLUJA si el radar diu que plou però la icona és Sol', () => {
    const current = { ...mockCurrent, weather_code: 0 }; // Sol
    const minutelyPrecip = [1.0, 1.0]; // Radar diu pluja
    
    const result = getRealTimeWeatherCode(current, minutelyPrecip);
    
    // Hauria de canviar a algun codi de pluja (51-67 o 80-82)
    const isRain = (result >= 51 && result <= 67) || (result >= 80 && result <= 82);
    expect(isRain).toBe(true);
  });

  it('hauria de detectar BOIRA si la visibilitat és molt baixa', () => {
    const current = { ...mockCurrent, weather_code: 3, visibility: 200 }; // Visibilitat 200m
    const minutelyPrecip = [0, 0]; // No plou
    
    const result = getRealTimeWeatherCode(current, minutelyPrecip);
    
    expect(result).toBe(45); // Codi de boira
  });
});