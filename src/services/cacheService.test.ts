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

describe('cacheService.pruneOldWeather — poda de previsions velles', () => {
    beforeEach(() => {
        db.clear();
        localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(T0);
    });
    afterEach(() => { vi.useRealTimers(); });

    const weatherKey = (lat: number) => cacheService.generateWeatherKey(lat, 2.82, 'C', 'ca');
    const savedAgo = (ms: number, version = 'v2_indexeddb_fast') => ({ data: { weather: {} }, timestamp: T0 - ms, version });

    it('esborra les previsions de més de 24 h i conserva les altres, que la desada sense connexió encara pot mostrar', async () => {
        const ages = { fresca: 10 * 60 * 1000, fa23h: 23 * HOUR, just24h: CACHE_TTL.CLEANUP, passat24h: CACHE_TTL.CLEANUP + 1, fa30dies: 30 * 24 * HOUR };
        const keyOf = Object.fromEntries(Object.keys(ages).map((name, i) => [name, weatherKey(40 + i)]));
        Object.entries(ages).forEach(([name, ms]) => db.set(keyOf[name], savedAgo(ms)));

        await cacheService.pruneOldWeather();

        expect(db.has(keyOf.fresca)).toBe(true);
        expect(db.has(keyOf.fa23h)).toBe(true);
        expect(db.has(keyOf.just24h)).toBe(true);
        expect(db.has(keyOf.passat24h)).toBe(false);
        expect(db.has(keyOf.fa30dies)).toBe(false);
        // Les conservades són exactament les que getEntry torna.
        expect(await cacheService.getEntry(keyOf.fa23h)).toEqual({ data: { weather: {} }, savedAt: T0 - 23 * HOUR });
        expect(await cacheService.getEntry(keyOf.just24h)).not.toBeNull();
    });

    it('esborra les previsions d\'una altra versió de la cache o mal formades (getEntry tampoc no les tornaria)', async () => {
        db.set(weatherKey(40), savedAgo(HOUR, 'v1_antiga'));
        db.set(weatherKey(41), { data: {}, version: 'v2_indexeddb_fast' });
        db.set(weatherKey(42), 'brossa');

        await cacheService.pruneOldWeather();

        expect(db.size).toBe(0);
    });

    it('no toca res que no sigui una previsió: IA, clau de versió, altres claus de l\'app o de l\'origen, preferències', async () => {
        const untouched = [
            cacheService.generateAiKey('100', 41.98, 2.82, 'ca'),
            'meteoai_version_control',
            'meteoai_altra_cosa',
            'meteo_app_germana_weather_1_2_C_ca'
        ];
        untouched.forEach(k => db.set(k, savedAgo(30 * 24 * HOUR)));
        localStorage.setItem('meteoai_favorites', '[{"name":"Girona"}]');
        localStorage.setItem('meteoai_lang', 'ca');

        await cacheService.pruneOldWeather();

        expect([...db.keys()]).toEqual(untouched);
        expect(localStorage.getItem('meteoai_favorites')).toBe('[{"name":"Girona"}]');
        expect(localStorage.getItem('meteoai_lang')).toBe('ca');
    });

    it('si IndexedDB falla, avisa i no llança', async () => {
        const { keys } = await import('idb-keyval');
        vi.mocked(keys).mockRejectedValueOnce(new Error('IDB tancada'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(cacheService.pruneOldWeather()).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('cacheService.pruneOldWeatherOnce — un cop per sessió i sense purga total', () => {
    // Mòdul nou a cada prova: el "ja s'ha fet" és de la sessió (estat del mòdul).
    let fresh: typeof cacheService;
    beforeEach(async () => {
        db.clear();
        localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(T0);
        vi.resetModules();
        ({ cacheService: fresh } = await import('./cacheService'));
    });
    afterEach(() => { vi.useRealTimers(); });

    const old = () => ({ data: {}, timestamp: T0 - 2 * CACHE_TTL.CLEANUP, version: 'v2_indexeddb_fast' });

    it('només poda la primera vegada', async () => {
        db.set(cacheService.generateWeatherKey(41, 2, 'C', 'ca'), old());
        await fresh.pruneOldWeatherOnce();
        expect(db.size).toBe(0);

        db.set(cacheService.generateWeatherKey(42, 2, 'C', 'ca'), old());
        await fresh.pruneOldWeatherOnce();
        expect(db.size).toBe(1);
    });

    it('sense la clau de versió (usuaris nous) no esborra preferències, preferits ni previsions recents, ni escriu la clau', async () => {
        const recent = cacheService.generateWeatherKey(41.98, 2.82, 'C', 'ca');
        const ai = cacheService.generateAiKey('100', 41.98, 2.82, 'ca');
        db.set(recent, { data: {}, timestamp: T0 - HOUR, version: 'v2_indexeddb_fast' });
        db.set(ai, { data: {}, timestamp: T0 - HOUR, version: 'v2_indexeddb_fast' });
        localStorage.setItem('meteoai_favorites', '[{"name":"Girona"}]');
        localStorage.setItem('meteoai_unit', 'C');

        await fresh.pruneOldWeatherOnce();

        expect([...db.keys()]).toEqual([recent, ai]);
        expect(localStorage.getItem('meteoai_favorites')).toBe('[{"name":"Girona"}]');
        expect(localStorage.getItem('meteoai_unit')).toBe('C');
    });
});
