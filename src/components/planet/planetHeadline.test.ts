import { describe, it, expect, vi, afterEach } from 'vitest';
import { planetHeadlineText, loadPlanetHeadline } from './planetHeadline';
import { summarizeCyclone } from '../../utils/planetExtremes';
import { resetPlanetExtremesCache } from '../../services/planetExtremesApi';
import type { ActiveCyclone } from '../../services/planetExtremesApi';

const NOW = Date.parse('2026-10-30T22:00:00Z');

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

    const respond = (cyclones: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ metar: null, events: null, cyclones }))));

    it('amb un cicló de categoria 4 dona el text; sense, cap', async () => {
        respond({ updatedAt: '2026-10-30T22:00:00Z', cyclones: [IN_FA, cyclone('Feble', 50, 15, 130)] });
        expect(await loadPlanetHeadline('ca', NOW)).toEqual({ status: 'ready', headline: { text: 'Tifó de categoria 4 al Pacífic', compactText: 'tifó de categoria 4 al Pacífic' } });

        resetPlanetExtremesCache();
        respond({ updatedAt: '2026-10-30T22:00:00Z', cyclones: [cyclone('Feble', 50, 15, 130)] });
        expect(await loadPlanetHeadline('ca', NOW)).toEqual({ status: 'ready', headline: null });
    });

    it('si el worker encara no té els ciclons, ho diu perquè es torni a provar', async () => {
        respond(null);
        expect(await loadPlanetHeadline('ca', NOW)).toEqual({ status: 'incomplete' });
    });
});
