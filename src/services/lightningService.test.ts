// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    analyseLightningPixels,
    analyseNowcoastPixels,
    lightningSourceAt,
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

describe('analyseNowcoastPixels', () => {
    // Densitat de nowCOAST: cel·les de 8 km (8 × 8 px a 1 km/px) amb els colors de la seva paleta.
    const cell = (data: Uint8ClampedArray, cx: number, cy: number, hex: string) => {
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
        for (let y = cy * 8; y < cy * 8 + 8; y++) for (let x = cx * 8; x < cx * 8 + 8; x++) {
            const o = (y * W + x) * 4;
            data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        }
    };

    it('tempesta amb vora groga: la distància és a les cel·les d\'1 o més, no a la vora (difuminat)', () => {
        const data = blank();
        // A l'est, de més a prop a més lluny: vora groga (0,25), 1–2,5, i un nucli de 10–15.
        cell(data, 7, 6, 'ffec78'); // x 56–63 → 6–14 km
        cell(data, 8, 6, 'ffa400'); // x 64–71 → 14–22 km
        cell(data, 9, 6, 'ff0000');
        const a = analyseNowcoastPixels(data, W, W, 1);
        expect(a).toMatchObject({ nearestKm: 15, bearingDeg: 88, intense: false });
    });

    it('llamp aïllat (taca que no arriba a 1): la distància és al seu pic', () => {
        const data = blank();
        cell(data, 4, 6, 'ffffcc'); // 0,1, més a prop (x 32–39)
        cell(data, 3, 6, 'ffff00'); // 0,5, el pic (x 24–31)
        cell(data, 2, 6, 'ffffcc');
        const a = analyseNowcoastPixels(data, W, W, 1);
        expect(a).toMatchObject({ nearestKm: 19, bearingDeg: 272 });
    });

    it('25 o més dins el cercle és intens; un color desconegut compta com a llamp', () => {
        const data = blank();
        cell(data, 6, 2, 'cc0066');
        expect(analyseNowcoastPixels(data, W, W, 1)?.intense).toBe(true);
        const other = blank();
        cell(other, 6, 6, '123456');
        expect(analyseNowcoastPixels(other, W, W, 1)).toMatchObject({ nearestKm: 1, intense: false });
    });

    it('sense res dins el cercle de 50 km: null', () => {
        const data = blank();
        cell(data, 0, 0, 'ff0000'); // cantonada, a més de 50 km
        expect(analyseNowcoastPixels(data, W, W, 1)).toBeNull();
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

    it('nowCOAST: l\'etiqueta ja és el final de la finestra de 15 min, i porta la font', () => {
        const window = 1792447200; // 22:00Z
        const summary = summariseLightning([window, window - 900], [a(12), null], 'nowcoast');
        expect(summary).toEqual({ nearestKm: 12, bearingDeg: 90, observedAt: window, intense: false, activeSlots: 1, source: 'nowcoast' });
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

    it('font de cada ubicació, la mateixa que el radar: nowCOAST a l\'oest de 60° O i al nord de 25° S', () => {
        expect(lightningSourceAt(41.4, 2.17)).toBe('mtg'); // Barcelona
        expect(lightningSourceAt(40.7, -74)).toBe('nowcoast'); // Nova York
        expect(lightningSourceAt(-3.12, -60.02)).toBe('nowcoast'); // Manaus
        expect(lightningSourceAt(-1.45, -48.5)).toBe('mtg'); // Belém
        expect(lightningSourceAt(-34.6, -58.4)).toBe('mtg'); // Buenos Aires
        expect(lightningSourceAt(-33.4, -70.6)).toBeNull(); // Santiago de Xile
        expect(lightningSourceAt(35.7, 139.7)).toBeNull(); // Tòquio
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

    it('sense cap font (ni MTG ni nowCOAST): null sense cap petició', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        expect(await getLightningNearby(35.7, 139.7)).toBeNull();
        expect(await getLightningNearby(-33.4, -70.6)).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('a Amèrica: /lightning/americas/latest i les 2 finestres de 15 min de nowCOAST (100 px en png)', async () => {
        const WINDOW = 1792447200; // 22:00Z
        const fetchMock = vi.fn(async (url: string) => (String(url).includes('/lightning/americas/latest')
            ? latestResponse({ latest: WINDOW, cadence: 900, source: 'caps' })
            : new Response('', { status: 502 })));
        vi.stubGlobal('fetch', fetchMock);

        expect(await getLightningNearby(40.7, -74)).toBeUndefined();
        const urls = fetchMock.mock.calls.map(([u]) => String(u));
        expect(urls[0]).toContain('/lightning/americas/latest');
        const wms = urls.filter((u) => u.includes('nowcoast.noaa.gov'));
        expect(wms).toHaveLength(2);
        expect(wms[0]).toContain('time=2026-10-19T22:00:00Z');
        expect(wms[1]).toContain('time=2026-10-19T21:45:00Z');
        expect(wms[0].startsWith('https://nowcoast.noaa.gov/geoserver/lightning_detection/ldn_lightning_strike_density/ows?service=WMS&version=1.3.0&request=GetMap&layers=ldn_lightning_strike_density&')).toBe(true);
        expect(wms[0]).toContain('width=100&height=100&format=image/png&transparent=true');
        expect(urls.some((u) => u.includes('li_afa'))).toBe(false);
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
        // Adreça pròpia de la capa: la general /geoserver/wms tardava 13-16 s (2026-11-09).
        expect(wms.every((u) => u.startsWith('https://view.eumetsat.int/geoserver/mtg_fd/li_afa/ows?') && u.includes('&layers=li_afa&'))).toBe(true);

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
