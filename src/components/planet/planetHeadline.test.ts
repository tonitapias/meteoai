import { describe, it, expect, vi, afterEach } from 'vitest';
import { planetHeadlineText, loadPlanetHeadline, protagonistHeadline } from './planetHeadline';
import { summarizeCyclone } from '../../utils/planetExtremes';
import { resetPlanetExtremesCache } from '../../services/planetExtremesApi';
import type { ActiveCyclone, GdacsAlert, StationRecord } from '../../services/planetExtremesApi';

const NOW = Date.parse('2026-10-30T22:00:00Z');
const NBSP = String.fromCharCode(160);

const cyclone = (name: string, windKt: number, lat: number, lon: number): ActiveCyclone => ({
    id: name, name, source: 'JTWC',
    track: [
        { time: '2026-10-30T12:00:00Z', lat: lat - 0.5, lon: lon + 0.5, windKt: windKt - 5 },
        { time: '2026-10-30T18:00:00Z', lat, lon, windKt },
    ],
});

const IN_FA = cyclone('In-fa', 115, 20.5, 143.4);

describe('Text del xip', () => {
    it('diu el tipus, la categoria i l\'oceà, en cada idioma', () => {
        const summary = summarizeCyclone(IN_FA);
        expect(planetHeadlineText(summary, 'ca')).toEqual({ text: 'Tifó de categoria 4 al Pacífic', compactText: 'tifó de categoria 4 al Pacífic' });
        expect(planetHeadlineText(summary, 'es').text).toBe('Tifón de categoría 4 en el Pacífico');
        expect(planetHeadlineText(summary, 'en').text).toBe('Category 4 typhoon in the Pacific');
        expect(planetHeadlineText(summary, 'fr').text).toBe('Typhon de catégorie 4 dans le Pacifique');
    });

    it("un huracà de categoria 5 a l'Atlàntic", () => {
        const summary = summarizeCyclone(cyclone('Ana', 140, 25, -70));
        expect(planetHeadlineText(summary, 'ca').text).toBe("Huracà de categoria 5 a l'Atlàntic");
    });
});

describe('loadPlanetHeadline', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        resetPlanetExtremesCache();
    });

    const METAR = { updatedAt: '2026-10-30T22:00:00Z', stations: 5000, discarded: 0, hottest: [], coldest: [], wetBulb: [], gustKmh: [], lowPressure: [] };
    const EVENTS = { updatedAt: '2026-10-30T22:00:00Z', fires: { count: 0, byCountry: [], largest: null }, floods: { count: 0, byCountry: [] }, volcanoes: [], alerts: [] };
    const respond = (cyclones: unknown, metar: unknown = METAR, events: unknown = EVENTS) =>
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ metar, events, cyclones }))));

    it('amb un cicló de categoria 4 dona el text i la seva fitxa; sense, cap', async () => {
        respond({ updatedAt: '2026-10-30T22:00:00Z', cyclones: [IN_FA, cyclone('Feble', 50, 15, 130)] });
        expect(await loadPlanetHeadline('ca', NOW)).toEqual({
            status: 'ready',
            headline: { text: 'Tifó de categoria 4 al Pacífic', compactText: 'tifó de categoria 4 al Pacífic', entry: { kind: 'cyclone', id: 'In-fa' }, icon: 'cyclone' },
        });

        resetPlanetExtremesCache();
        respond({ updatedAt: '2026-10-30T22:00:00Z', cyclones: [cyclone('Feble', 50, 15, 130)] });
        expect(await loadPlanetHeadline('ca', NOW)).toEqual({ status: 'ready', headline: null });
    });

    it('si al worker encara li falta algun bloc, ho diu perquè es torni a provar', async () => {
        respond(null);
        expect(await loadPlanetHeadline('ca', NOW)).toEqual({ status: 'incomplete' });
        resetPlanetExtremesCache();
        respond({ updatedAt: '2026-10-30T22:00:00Z', cyclones: [IN_FA] }, null);
        expect(await loadPlanetHeadline('ca', NOW)).toEqual({ status: 'incomplete' });
    });
});

describe('Els altres protagonistes al xip', () => {
    const MURASU: GdacsAlert = { type: 'TC', level: 'red', name: 'Murasu', country: 'IN', from: '2026-11-01T00:00:00.000Z', url: null };
    const station = (over: Partial<StationRecord>): StationRecord => ({ id: 'X', name: 'Doha', country: 'QA', lat: 25.3, lon: 51.6, elevM: 20, time: '2026-07-20T12:00:00Z', value: 31.4, ...over });

    it("l'alerta vermella d'un cicló sense fitxa porta a la llista de fenòmens", () => {
        expect(protagonistHeadline({ kind: 'alert', alert: MURASU, cycloneId: null }, 'ca')).toEqual({
            text: 'Alerta vermella: cicló tropical Murasu · Índia',
            compactText: 'alerta vermella: cicló tropical Murasu · Índia',
            entry: { kind: 'list', tab: 'events' },
            icon: 'cyclone',
        });
        expect(protagonistHeadline({ kind: 'alert', alert: MURASU, cycloneId: 'E9' }, 'en').entry).toEqual({ kind: 'cyclone', id: 'E9' });
    });

    it('la calor humida de perill i els rècords obren la seva fitxa', () => {
        expect(protagonistHeadline({ kind: 'wetBulb', station: station({}) }, 'ca')).toMatchObject({
            text: `Calor humida de 31${NBSP}°C a Doha (Qatar)`, entry: { kind: 'record', record: 'wetBulb' }, icon: 'heat',
        });
        expect(protagonistHeadline({ kind: 'record', record: 'gust', station: station({ value: 160 }) }, 'ca')).toMatchObject({
            text: `Ratxa de 160${NBSP}km/h a Doha (Qatar)`, entry: { kind: 'record', record: 'gust' }, icon: 'wind',
        });
    });
});
