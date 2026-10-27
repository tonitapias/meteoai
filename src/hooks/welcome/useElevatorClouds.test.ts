import { describe, expect, it } from 'vitest';
import { parseElevatorClouds } from './useElevatorClouds';

describe('parseElevatorClouds', () => {
  it('llegeix les tres cobertures i treu la cota de neu de la isoterma de 0 °C', () => {
    const clouds = parseElevatorClouds({ current: { cloud_cover_low: 34, cloud_cover_mid: 0, cloud_cover_high: 9, freezing_level_height: 4230 } });
    expect(clouds).toEqual({ low: 34, mid: 0, high: 9, snowLevel: 3930 });
  });

  it('sense isoterma, sense cota de neu; sense alguna cobertura, res', () => {
    expect(parseElevatorClouds({ current: { cloud_cover_low: 10, cloud_cover_mid: 20, cloud_cover_high: 30 } })?.snowLevel).toBeNull();
    expect(parseElevatorClouds({ current: { cloud_cover_low: 10, cloud_cover_mid: null, cloud_cover_high: 30 } })).toBeNull();
    expect(parseElevatorClouds(null)).toBeNull();
    expect(parseElevatorClouds({ error: true, reason: 'quota' })).toBeNull();
  });

  it('retalla els valors fora de 0–100 %', () => {
    expect(parseElevatorClouds({ current: { cloud_cover_low: 104, cloud_cover_mid: -3, cloud_cover_high: 50 } })).toMatchObject({ low: 100, mid: 0 });
  });
});
