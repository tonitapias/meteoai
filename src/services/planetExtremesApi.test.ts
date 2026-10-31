import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizePlanetExtremes, fetchPlanetExtremes, resetPlanetExtremesCache, isComplete } from './planetExtremesApi';

const station = (over: Record<string, unknown> = {}) => ({
    id: 'MSSM', name: 'San Miguel', country: 'SV', lat: 13.45, lon: -88.123, elevM: 92,
    time: '2026-10-30T21:50:00.000Z', value: 36, ...over,
});

const BODY = {
    metar: {
        updatedAt: '2026-10-30T22:27:00.000Z', stations: 5144, discarded: 25,
        hottest: [station()], coldest: [], wetBulb: [station({ id: 'SKCG', value: 28, tempC: 31, dewC: 27 })],
        gustKmh: [], lowPressure: [],
    },
    events: {
        updatedAt: '2026-10-30T22:27:00.000Z',
        fires: { count: 212, byCountry: [{ country: 'AU', count: 44 }], largest: { country: 'AU', hectares: 59795, lat: -18.8, lon: 125.2 } },
        floods: { count: 14, byCountry: [{ country: 'IN', count: 1 }] },
        volcanoes: [],
    },
    cyclones: {
        updatedAt: '2026-10-30T22:27:00.000Z',
        cyclones: [{ id: 'E1', name: 'In-fa', source: 'JTWC', track: [{ time: '2026-10-30T18:00:00.000Z', lat: 20.5, lon: 143.4, windKt: 115 }] }],
    },
};

describe('normalizePlanetExtremes', () => {
    it('accepta la resposta del worker tal com arriba', () => {
        const data = normalizePlanetExtremes(BODY);
        expect(isComplete(data)).toBe(true);
        expect(data.metar?.hottest[0].name).toBe('San Miguel');
        expect(data.metar?.wetBulb[0]).toMatchObject({ tempC: 31, dewC: 27 });
        expect(data.events?.fires.largest?.hectares).toBe(59795);
        expect(data.cyclones?.cyclones[0].track).toHaveLength(1);
    });

    it('un bloc null o mal format queda a null sense fer caure la resta', () => {
        const data = normalizePlanetExtremes({ ...BODY, events: null, metar: { stations: 'x' } });
        expect(data.metar).toBeNull();
        expect(data.events).toBeNull();
        expect(data.cyclones).not.toBeNull();
        expect(isComplete(data)).toBe(false);
    });

    it('descarta els rècords i els ciclons incomplets', () => {
        const data = normalizePlanetExtremes({
            ...BODY,
            metar: { ...BODY.metar, hottest: [station({ value: 'calor' }), station({ lat: undefined }), station()] },
            cyclones: { updatedAt: 'x', cyclones: [{ id: 'E2', name: 'Buit', track: [] }, BODY.cyclones.cyclones[0]] },
        });
        expect(data.metar?.hottest).toHaveLength(1);
        expect(data.cyclones?.cyclones.map((c) => c.name)).toEqual(['In-fa']);
    });

    it('qualsevol cosa estranya dona tots els blocs a null', () => {
        expect(normalizePlanetExtremes('<html>')).toEqual({ metar: null, events: null, cyclones: null });
    });
});

describe('fetchPlanetExtremes', () => {
    beforeEach(() => resetPlanetExtremesCache());
    afterEach(() => vi.unstubAllGlobals());

    it('comparteix una sola petició i la recorda', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(BODY), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const [a, b] = await Promise.all([fetchPlanetExtremes(), fetchPlanetExtremes()]);
        await fetchPlanetExtremes();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
    });

    it('no recorda una resposta incompleta: la següent petició torna a anar al worker', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ...BODY, events: null }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await fetchPlanetExtremes();
        await fetchPlanetExtremes();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('un error del worker es propaga', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('Massa peticions', { status: 429 })));
        await expect(fetchPlanetExtremes()).rejects.toThrow('429');
    });
});
