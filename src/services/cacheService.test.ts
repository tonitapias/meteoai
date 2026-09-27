// src/services/cacheService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cacheService } from './cacheService';
import { CACHE_TTL } from '../constants/cacheConfig';

// IndexedDB en memòria.
const { db } = vi.hoisted(() => ({ db: new Map<string, unknown>() }));
vi.mock('idb-keyval', () => ({
    get: vi.fn(async (key: string) => db.get(key)),
    set: vi.fn(async (key: string, value: unknown) => { db.set(key, value); }),
    del: vi.fn(async (key: string) => { db.delete(key); }),
    entries: vi.fn(async () => [...db.entries()]),
    keys: vi.fn(async () => [...db.keys()])
}));

const T0 = new Date('2026-09-27T10:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;

describe('cacheService.getEntry — la previsió caducada no s\'esborra', () => {
    beforeEach(() => {
        db.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(T0);
    });
    afterEach(() => { vi.useRealTimers(); });

    it('torna les dades caducades amb l\'instant en què es van desar (get, amb TTL, les descartaria)', async () => {
        await cacheService.set('k', { a: 1 });
        vi.setSystemTime(T0 + 3 * HOUR);

        expect(await cacheService.getEntry('k')).toEqual({ data: { a: 1 }, savedAt: T0 });
        expect(db.has('k')).toBe(true);
    });

    it('passades 24 h l\'esborra', async () => {
        await cacheService.set('k', { a: 1 });
        vi.setSystemTime(T0 + CACHE_TTL.CLEANUP + 1000);

        expect(await cacheService.getEntry('k')).toBeNull();
        expect(db.has('k')).toBe(false);
    });

    it('una entrada d\'una altra versió de la cache s\'esborra', async () => {
        db.set('k', { data: { a: 1 }, timestamp: T0, version: 'v1_antiga' });

        expect(await cacheService.getEntry('k')).toBeNull();
        expect(db.has('k')).toBe(false);
    });

    it('sense entrada, null', async () => {
        expect(await cacheService.getEntry('no-hi-és')).toBeNull();
    });
});

describe('cacheService.findWeatherKeysNear', () => {
    beforeEach(() => { db.clear(); });

    const key = (lat: number, lon: number, unit = 'C', lang = 'ca') => cacheService.generateWeatherKey(lat, lon, unit, lang);

    it('només previsions de la mateixa unitat i idioma dins del radi, de la més propera a la més llunyana', async () => {
        const girona = key(41.98, 2.82);
        const salt = key(41.9750, 2.7900);        // ~2,5 km
        const banyoles = key(42.1197, 2.7667);    // ~16 km
        const barcelona = key(41.3874, 2.1686);   // ~86 km
        [girona, salt, banyoles, barcelona, key(41.98, 2.82, 'C', 'es'), key(41.98, 2.82, 'F', 'ca'),
            cacheService.generateAiKey('100', 41.98, 2.82, 'ca'), 'meteoai_version_control']
            .forEach(k => db.set(k, {}));

        const found = await cacheService.findWeatherKeysNear(41.9801, 2.8201, 'C', 'ca', 20);

        expect(found.map(f => f.key)).toEqual([girona, salt, banyoles]);
        expect(found[0].distanceKm).toBeLessThan(0.1);
        expect(found[1].distanceKm).toBeCloseTo(2.6, 0);
        expect(found[2].distanceKm).toBeCloseTo(16, 0);
    });

    it('llegeix bé les coordenades negatives (hemisferi sud i oest)', async () => {
        const capeTown = key(-33.92, 18.42);
        const lima = key(-12.05, -77.04);
        db.set(capeTown, {});
        db.set(lima, {});

        expect((await cacheService.findWeatherKeysNear(-33.921, 18.421, 'C', 'ca', 20)).map(f => f.key)).toEqual([capeTown]);
        expect((await cacheService.findWeatherKeysNear(-12.051, -77.041, 'C', 'ca', 20)).map(f => f.key)).toEqual([lima]);
    });
});
