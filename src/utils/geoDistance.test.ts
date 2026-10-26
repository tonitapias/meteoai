// src/utils/geoDistance.test.ts
import { describe, it, expect } from 'vitest';
import { distanceKm, isSamePlace } from './geoDistance';

describe('distanceKm', () => {
    it('Girona - Barcelona fa uns 86 km', () => {
        expect(distanceKm(41.98, 2.82, 41.39, 2.17)).toBeGreaterThan(80);
        expect(distanceKm(41.98, 2.82, 41.39, 2.17)).toBeLessThan(90);
    });
});

describe('isSamePlace', () => {
    it('dos pobles que es diuen igual no són el mateix lloc', () => {
        expect(isSamePlace(
            { name: 'Sant Pere', latitude: 41.26, longitude: 1.77 },
            { name: 'Sant Pere', latitude: 42.19, longitude: 3.08 }
        )).toBe(false);
    });

    it('el mateix lloc amb coordenades del GPS una mica diferents sí que ho és', () => {
        expect(isSamePlace(
            { name: 'Girona', latitude: 41.9794, longitude: 2.8214 },
            { name: 'Girona', latitude: 41.9812, longitude: 2.8240 }
        )).toBe(true);
    });

    it('el mateix lloc amb el nom en un altre idioma també', () => {
        expect(isSamePlace(
            { name: 'Londres', latitude: 51.5085, longitude: -0.1257 },
            { name: 'London', latitude: 51.5085, longitude: -0.1257 }
        )).toBe(true);
    });

    it('sense coordenades, es compara el nom', () => {
        expect(isSamePlace({ name: 'Girona' }, { name: 'Girona', latitude: 41.98, longitude: 2.82 })).toBe(true);
        expect(isSamePlace({ name: 'Girona' }, { name: 'Olot' })).toBe(false);
        expect(isSamePlace({}, {})).toBe(false);
    });
});
