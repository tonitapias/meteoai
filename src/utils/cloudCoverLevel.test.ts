import { describe, it, expect } from 'vitest';
import { cloudCoverLevel, effectiveCloudCoverNow, CLOUD_LEVEL_LABEL } from './cloudCoverLevel';
import { WEATHER_THRESHOLDS } from '../constants/weatherConfig';

const { CLOUDS } = WEATHER_THRESHOLDS;

describe('cloudCoverLevel — llindars de CLOUDS', () => {
  it('talla a FEW, SCATTERED i OVERCAST (el llindar ja és del nivell de dalt)', () => {
    expect(cloudCoverLevel(0)).toBe('clear');
    expect(cloudCoverLevel(CLOUDS.FEW - 0.1)).toBe('clear');
    expect(cloudCoverLevel(CLOUDS.FEW)).toBe('partial');
    expect(cloudCoverLevel(CLOUDS.SCATTERED - 0.1)).toBe('partial');
    expect(cloudCoverLevel(CLOUDS.SCATTERED)).toBe('veryCloudy');
    expect(cloudCoverLevel(CLOUDS.OVERCAST - 0.1)).toBe('veryCloudy');
    expect(cloudCoverLevel(CLOUDS.OVERCAST)).toBe('overcast');
    expect(cloudCoverLevel(100)).toBe('overcast');
  });

  it('té etiqueta per a cada nivell en els 4 idiomes', () => {
    for (const labels of Object.values(CLOUD_LEVEL_LABEL)) {
      for (const k of ['clear', 'partial', 'veryCloudy', 'overcast', 'unknown'] as const) expect(labels[k]).toBeTruthy();
    }
  });
});

describe('effectiveCloudCoverNow', () => {
  it('pondera baixos 1, mitjans 0,6 i alts 0,3, amb sostre de 100', () => {
    expect(effectiveCloudCoverNow(20, 10, 30)).toBeCloseTo(35);
    expect(effectiveCloudCoverNow(46, 100, 100)).toBe(100);
  });

  it('una capa que falta compta com a 0; si falten totes, null (no 0 %)', () => {
    expect(effectiveCloudCoverNow(12, null, 64)).toBeCloseTo(12 + 0.3 * 64);
    expect(effectiveCloudCoverNow(undefined, NaN, 50)).toBeCloseTo(15);
    expect(effectiveCloudCoverNow(null, undefined, NaN)).toBeNull();
    expect(effectiveCloudCoverNow(0, 0, 0)).toBe(0);
  });
});
