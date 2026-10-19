// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    analyseLightningPixels,
    summariseLightning,
    isInsideLightningCoverage,
    compassIndex,
    compassPhraseCa,
    lightningBand,
    lightningMinutesAgo,
    getLightningNearby,
    clearLightningCache,
    type SlotAnalysis
} from './lightningService';

// Quadre de 100 × 100 px a 1 km/px centrat a l'usuari (fila 0 = nord), com el que demana el servei.
const W = 100;
const blank = () => new Uint8ClampedArray(W * W * 4);
/** Pinta un bloc de píxels amb llamps (groc pàl·lid per defecte; `green` baix = vermell, intens). */
const paint = (data: Uint8ClampedArray, x0: number, y0: number, size = 2, green = 0xed) => {
    for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) {
        const o = (y * W + x) * 4;
        data[o] = 0xff; data[o + 1] = green; data[o + 2] = 0xa2; data[o + 3] = 255;
    }
};

describe('analyseLightningPixels', () => {
    it('distància i rumb del píxel més proper: un nucli 20 km a l\'est', () => {
        const data = blank();
        paint(data, 70, 49); // x 70–71 → 20,5 km a l'est del centre (50), mig km al nord
        expect(analyseLightningPixels(data, W, W, 1)).toEqual({ nearestKm: 21, bearingDeg: 89, intense: false, pixels: 4 });
    });

    it('nord-oest: 9,5 km amunt i 9,5 km a l\'esquerra → 13 km a 315°', () => {
        const data = blank();
        paint(data, 39, 39);
        expect(analyseLightningPixels(data, W, W, 1)).toMatchObject({ nearestKm: 13, bearingDeg: 315 });
    });

    it('menys de 4 píxels dins el cercle: no compta (soroll o un llamp a la vora)', () => {
        const data = blank();
        paint(data, 60, 60, 1);
        paint(data, 61, 60, 1);
        paint(data, 62, 60, 1);
        expect(analyseLightningPixels(data, W, W, 1)).toBeNull();
    });

    it('les cantonades del quadre (fora del cercle de 50 km) no compten', () => {
        const data = blank();
        paint(data, 0, 0, 4); // a ~69 km
        expect(analyseLightningPixels(data, W, W, 1)).toBeNull();
    });

    it('vermell (10 llamps o més en 5 min) és intens', () => {
        const data = blank();
        paint(data, 50, 20, 2, 0x42);
        expect(analyseLightningPixels(data, W, W, 1)?.intense).toBe(true);
    });
});

describe('summariseLightning', () => {
    const slot = 1792447500; // 22:05Z
    const a = (km: number, intense = false): SlotAnalysis => ({ nearestKm: km, bearingDeg: 90, intense, pixels: 10 });

    it('distància de la franja més nova amb llamps i final d\'aquesta franja (per calcular els minuts en mostrar-ho)', () => {
        const slots = [slot, slot - 300, slot - 600];
        const summary = summariseLightning(slots, [null, a(18), a(30, true)]);
        // Franja de les 22:00 (la més nova amb llamps): acaba a les 22:05.
        expect(summary).toEqual({ nearestKm: 18, bearingDeg: 90, observedAt: slot, intense: true, activeSlots: 2 });
        expect(lightningMinutesAgo(summary!, (slot + 12 * 60) * 1000)).toBe(12);
        expect(lightningMinutesAgo(summary!, (slot - 60) * 1000)).toBe(0);
    });

    it('cap franja amb llamps: null', () => {
        expect(summariseLightning([slot, slot - 300], [null, null])).toBeNull();
    });
});

describe('utilitats', () => {
    it('cobertura del Lightning Imager: Europa i Àfrica sí, Amèrica i Àsia no', () => {
        expect(isInsideLightningCoverage(41.4, 2.17)).toBe(true);
        expect(isInsideLightningCoverage(-1.3, 36.8)).toBe(true);
        expect(isInsideLightningCoverage(40.7, -74)).toBe(false);
        expect(isInsideLightningCoverage(35.7, 139.7)).toBe(false);
        expect(isInsideLightningCoverage(78, 15)).toBe(false);
    });

    it('rumb de 8 punts i frase en català', () => {
        expect([0, 44, 46, 90, 180, 225, 270, 315, 359].map(compassIndex)).toEqual([0, 1, 1, 2, 4, 5, 6, 7, 0]);
        expect(compassPhraseCa(87)).toBe("a l'est");
        expect(compassPhraseCa(320)).toBe('al nord-oest');
    });

    it('banda de distància per a les claus de la IA: trams de 10 km', () => {
        const at = (km: number) => ({ nearestKm: km, bearingDeg: 0, observedAt: 0, intense: false, activeSlots: 1 });
        expect([null, at(0), at(10), at(11), at(23), at(30), at(31), at(50)].map(lightningBand))
            .toEqual(['l0', 'l1', 'l1', 'l2', 'l3', 'l3', 'l4', 'l5']);
    });
});

describe('getLightningNearby', () => {
    const LATEST = 1792447500; // 22:05Z
    beforeEach(() => {
        clearLightningCache();
        // Node no té createImageBitmap: sense això el servei ni tan sols ho provaria. Aquí no es descodifica res.
        vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('sense descodificador'); }));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    const latestResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    const notYet = () => new Response('<ServiceExceptionReport><ServiceException code="InvalidDimensionValue">x</ServiceException></ServiceExceptionReport>',
        { status: 200, headers: { 'Content-Type': 'text/xml' } });
    /** /lightning/latest amb `latest` i, per a les franges, `slot(url)`. */
    const worker = (slot: (url: string) => Response, latest: unknown = { latest: LATEST, cadence: 300, source: 'caps' }) =>
        vi.fn(async (url: string) => (String(url).includes('/lightning/latest') ? latestResponse(latest) : slot(String(url))));

    it('fora de l\'abast del Lightning Imager: null sense cap petició', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        expect(await getLightningNearby(40.7, -74)).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('navegador sense createImageBitmap: null sense cap petició', async () => {
        vi.stubGlobal('createImageBitmap', undefined);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        expect(await getLightningNearby(41.4, 2.17)).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Lightning Imager aturat (/lightning/latest null): null sense demanar cap franja', async () => {
        const fetchMock = worker(notYet, null);
        vi.stubGlobal('fetch', fetchMock);
        expect(await getLightningNearby(41.4, 2.17)).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('hora calculada pel worker (sense caps): no es mira cap franja i no és "cap llamp"', async () => {
        const fetchMock = worker(notYet, { latest: LATEST, cadence: 300, source: 'computed' });
        vi.stubGlobal('fetch', fetchMock);
        expect(await getLightningNearby(41.4, 2.17)).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('demana les 6 franges dels últims 30 min (quadre de 100 px en png8) i comparteix el resultat 4 min', async () => {
        const fetchMock = worker(notYet);
        vi.stubGlobal('fetch', fetchMock);

        expect(await getLightningNearby(41.4, 2.17)).toBeNull();
        const wms = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('li_afa'));
        expect(wms).toHaveLength(6);
        expect(wms[0]).toContain('time=2026-10-19T22:05:00Z');
        expect(wms[5]).toContain('time=2026-10-19T21:40:00Z');
        expect(wms[0]).toContain('width=100&height=100&format=image/png8');

        // El tauler i la IA demanen el mateix lloc: no es torna a consultar.
        await getLightningNearby(41.4, 2.17);
        expect(fetchMock).toHaveBeenCalledTimes(7);
    });

    it('si el worker no respon: undefined, no es desa i les fallades seguides esperen 1, 2... min', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const fetchMock = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        vi.stubGlobal('fetch', fetchMock);

        expect(await getLightningNearby(41.4, 2.17)).toBeUndefined();
        // Dins del primer minut no es torna a provar.
        expect(await getLightningNearby(41.4, 2.17)).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(61_000);
        expect(await getLightningNearby(41.4, 2.17)).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // Segona fallada seguida: 2 min.
        vi.advanceTimersByTime(61_000);
        await getLightningNearby(41.4, 2.17);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        vi.advanceTimersByTime(60_000);
        await getLightningNearby(41.4, 2.17);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('cap franja llegible (EUMETSAT 502): undefined, no "cap llamp"', async () => {
        vi.stubGlobal('fetch', worker(() => new Response('', { status: 502 })));
        expect(await getLightningNearby(41.4, 2.17)).toBeUndefined();
    });

    it('algunes franges sense llegir i les altres sense llamps: undefined (potser eren a les que han fallat)', async () => {
        vi.stubGlobal('fetch', worker((url) => (url.includes('T22:05:00Z') ? new Response('', { status: 502 }) : notYet())));
        expect(await getLightningNearby(41.4, 2.17)).toBeUndefined();
    });

    it('una ServiceException que no és de franja no publicada compta com a fallada', async () => {
        const transient = () => new Response('<ServiceExceptionReport><ServiceException>Unable to obtain connection</ServiceException></ServiceExceptionReport>',
            { status: 200, headers: { 'Content-Type': 'text/xml' } });
        vi.stubGlobal('fetch', worker(transient));
        expect(await getLightningNearby(41.4, 2.17)).toBeUndefined();
    });
});
