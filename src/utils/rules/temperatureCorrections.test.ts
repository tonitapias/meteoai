import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInversionCorrectedTemp } from './temperatureCorrections';
import { StrictCurrentWeather } from '../../types/weatherLogicTypes';

describe('getInversionCorrectedTemp', () => {
  // Mock de la data per simular que és gener (hivern, risc d'inversió alt)
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 2, 0)); // 15 de Gener a les 02:00 AM
  });

  const baseWeather: Partial<StrictCurrentWeather> = {
    temperature_2m: 5.0,
    wind_speed_10m: 0,
    cloud_cover_low: 0,
    cloud_cover_mid: 0,
    cloud_cover_high: 0,
    is_day: 0, // Nit
  };

  it('ha de retornar la temperatura original si no hi ha risc d’inversió (és de dia)', () => {
    const dayWeather = { ...baseWeather, is_day: 1 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(dayWeather);
    expect(result).toBe(5.0);
  });

  it('ha d’aplicar la correcció màxima (3.5°C) amb vent en calma (0 km/h)', () => {
    const calmWeather = { ...baseWeather, wind_speed_10m: 0 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(calmWeather);
    // 5.0 - 3.5 = 1.5
    expect(result).toBeCloseTo(1.5);
  });

  it('ha de reduir la correcció a mesura que augmenta el vent (3 km/h)', () => {
    const breezyWeather = { ...baseWeather, wind_speed_10m: 3 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(breezyWeather);
    // inversionStrength = (6 - 3) / 6 = 0.5
    // correction = 3.5 * 0.5 = 1.75
    // 5.0 - 1.75 = 3.25
    expect(result).toBeCloseTo(3.25);
  });

  it('no ha d’aplicar cap correcció si el vent és superior a 6 km/h', () => {
    const windyWeather = { ...baseWeather, wind_speed_10m: 7 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(windyWeather);
    expect(result).toBe(5.0);
  });

  it('ha d’aplicar el guardrail de seguretat (màxim 4°C de correcció)', () => {
    // Tot i que la fórmula dóna 3.5, provem que el safeNum i la lògica no explotin
    const extremeWeather = { ...baseWeather, temperature_2m: 10, wind_speed_10m: 0 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(extremeWeather);
    expect(result).toBeGreaterThanOrEqual(6.0); // 10 - 4 = 6
  });
});