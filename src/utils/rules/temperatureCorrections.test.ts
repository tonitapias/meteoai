import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInversionCorrectedApparent, getInversionCorrectedTemp, MAX_INVERSION_CORRECTION_C } from './temperatureCorrections';
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

  it("la correcció màxima és d'1,75 °C (la meitat de l'antiga: vegeu la verificació a temperatureCorrections.ts)", () => {
    expect(MAX_INVERSION_CORRECTION_C).toBe(1.75);
  });

  it('ha d’aplicar la correcció màxima amb vent en calma (0 km/h)', () => {
    const calmWeather = { ...baseWeather, wind_speed_10m: 0 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(calmWeather);
    // 5.0 - 1.75 = 3.25
    expect(result).toBeCloseTo(5.0 - MAX_INVERSION_CORRECTION_C);
  });

  it('ha de reduir la correcció a mesura que augmenta el vent (3 km/h)', () => {
    const breezyWeather = { ...baseWeather, wind_speed_10m: 3 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(breezyWeather);
    // inversionStrength = (6 - 3) / 6 = 0.5
    // correction = 1.75 * 0.5 = 0.875
    expect(result).toBeCloseTo(5.0 - MAX_INVERSION_CORRECTION_C * 0.5);
  });

  it('no ha d’aplicar cap correcció si el vent és superior a 6 km/h', () => {
    const windyWeather = { ...baseWeather, wind_speed_10m: 7 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(windyWeather);
    expect(result).toBe(5.0);
  });

  it('ha d’aplicar el guardrail de seguretat (màxim 4°C de correcció)', () => {
    // Tot i que la fórmula dóna com a molt MAX_INVERSION_CORRECTION_C, provem que el safeNum i la lògica no explotin
    const extremeWeather = { ...baseWeather, temperature_2m: 10, wind_speed_10m: 0 } as StrictCurrentWeather;
    const result = getInversionCorrectedTemp(extremeWeather);
    expect(result).toBeGreaterThanOrEqual(6.0); // 10 - 4 = 6
  });
});

describe('getInversionCorrectedApparent', () => {
  it('desplaça la sensació tant com la temperatura: la diferència entre totes dues (vent, humitat) no canvia', () => {
    // Model: 2 °C i sensació 1 °C; la correcció d'inversió porta la temperatura a 0,25 °C.
    const shown = 2 - MAX_INVERSION_CORRECTION_C;
    expect(getInversionCorrectedApparent(1, 2, shown)).toBeCloseTo(1 - MAX_INVERSION_CORRECTION_C, 5);
    expect(getInversionCorrectedApparent(1, 2, shown)! - shown).toBeCloseTo(1 - 2, 5);
  });

  it('sense correcció (temperatura mostrada = crua) la sensació queda igual', () => {
    expect(getInversionCorrectedApparent(24.3, 22, 22)).toBe(24.3);
  });

  it('sense sensació: null, mai un 0 fals', () => {
    expect(getInversionCorrectedApparent(null, 2, 0.25)).toBeNull();
    expect(getInversionCorrectedApparent(undefined, 2, 0.25)).toBeNull();
  });

  it('sense alguna de les dues temperatures no se sap la correcció: la sensació es deixa tal com ve', () => {
    expect(getInversionCorrectedApparent(1, null, 0.25)).toBe(1);
    expect(getInversionCorrectedApparent(1, 2, null)).toBe(1);
  });
});
