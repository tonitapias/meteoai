// src/utils/rules/shearRules.test.ts
import { describe, it, expect } from 'vitest';
import { bulkShear, classifyShear, getBulkShearKmh } from './shearRules';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';

type Comparison = ExtendedWeatherData['hourlyComparison'];
const row = (s10: number | null, d10: number | null, s500: number | null, d500: number | null) =>
    ({ wind_speed_10m: s10, wind_direction_10m: d10, wind_speed_500hPa: s500, wind_direction_500hPa: d500 });

describe('bulkShear', () => {
    it('el mateix vent a baix i a dalt no té cisallament', () => {
        expect(bulkShear(40, 250, 40, 250)).toBeCloseTo(0, 5);
    });

    it('és la diferència VECTORIAL, no la de velocitats', () => {
        // 20 km/h del sud a 10 m i 60 km/h de l'oest a 500 hPa: √(60² + 20²) ≈ 63,2 km/h
        expect(bulkShear(20, 180, 60, 270)).toBeCloseTo(Math.hypot(60, 20), 5);
        // mateixa velocitat en sentits oposats: el doble
        expect(bulkShear(30, 0, 30, 180)).toBeCloseTo(60, 5);
    });
});

describe('classifyShear (10 i 20 m/s)', () => {
    it('< 36 km/h feble, 36-71 moderat, >= 72 fort', () => {
        expect(classifyShear(35.9)).toBe('weak');
        expect(classifyShear(36)).toBe('moderate');
        expect(classifyShear(71.9)).toBe('moderate');
        expect(classifyShear(72)).toBe('strong');
    });
});

describe('getBulkShearKmh', () => {
    it('fa servir ECMWF quan té els quatre valors', () => {
        const comparison = { ecmwf: [row(20, 180, 60, 270)], gfs: [row(0, 0, 0, 0)], icon: [], aifs: [] } as unknown as Comparison;
        expect(getBulkShearKmh(comparison, 0)).toBeCloseTo(Math.hypot(60, 20), 5);
    });

    it('si a ECMWF li falta alguna dada, passa al model següent sencer (GFS)', () => {
        const comparison = { ecmwf: [row(20, 180, null, 270)], gfs: [row(30, 0, 30, 180)], icon: [], aifs: [] } as unknown as Comparison;
        expect(getBulkShearKmh(comparison, 0)).toBeCloseTo(60, 5);
    });

    it('mai no barreja models: el vent de 10 m d\'un i el de 500 hPa d\'un altre no fan cap cisallament', () => {
        const comparison = { ecmwf: [row(20, 180, null, null)], gfs: [row(null, null, 60, 270)], icon: [], aifs: [] } as unknown as Comparison;
        expect(getBulkShearKmh(comparison, 0)).toBeNull();
    });

    it('sense comparació o fora de rang: null', () => {
        expect(getBulkShearKmh(undefined, 0)).toBeNull();
        const comparison = { ecmwf: [row(20, 180, 60, 270)], gfs: [], icon: [], aifs: [] } as unknown as Comparison;
        expect(getBulkShearKmh(comparison, 5)).toBeNull();
    });
});
