import { describe, it, expect } from 'vitest';
import {
    GIBS_PRODUCTS, GIBS_SAFE_AGE_SEC, MAX_MISSING_SHARE, TILE_PX, VIEW_MAX_DEG,
    CIRA_DISC_PX, ciraDiscUrl, geosImagePoint, parseCiraSlots, reprojectGeosToDisc,
    discMosaic, discTileUrl, gibsAttempts, hasDarkEastEdge, meteosatImageUrl, missingShare, parseGibsSlots, reprojectMercatorToDisc,
} from './orbitalImage';

const NOW = 1793406000; // 2026-10-31 00:20 UTC
const DEG = Math.PI / 180;

describe('Franges de GOES i Himawari', () => {
    const ir = { slots: [NOW - 3600, NOW - 3000, NOW - 2400, NOW - 1800], light: null };
    const colour = { slots: [NOW - 7200, NOW - 6600, NOW - 6000, NOW - 4800, NOW - 1800], light: null };

    it('amb `light` del worker: la més nova lleugera i l\'anterior, primer el color i després l\'infraroig', () => {
        // GeoColor de NESDIS: lleuger de seguida (30 min); infraroig de GIBS, 50 min.
        const slots = { ir: { ...ir, light: NOW - 3000 }, colour: { ...colour, light: NOW - 1800 } };
        expect(gibsAttempts(slots, NOW, GIBS_PRODUCTS.goes)).toEqual([
            { product: 'colour', slot: NOW - 1800 },
            { product: 'colour', slot: NOW - 4800 },
            { product: 'ir', slot: NOW - 3000 },
            { product: 'ir', slot: NOW - 3600 },
        ]);
    });

    it('sense `light` (worker antic): les mateixes edats segures, 90 min el color i 50 l\'infraroig', () => {
        expect(gibsAttempts({ ir, colour }, NOW, GIBS_PRODUCTS.goes)).toEqual([
            { product: 'colour', slot: NOW - 6000 },
            { product: 'colour', slot: NOW - 6600 },
            { product: 'ir', slot: NOW - 3000 },
            { product: 'ir', slot: NOW - 3600 },
        ]);
    });

    it("l'Himawari, només infraroig; sense color al worker, el GOES també", () => {
        expect(gibsAttempts({ ir, colour }, NOW, GIBS_PRODUCTS.himawari).every((a) => a.product === 'ir')).toBe(true);
        expect(gibsAttempts({ ir, colour: null }, NOW, GIBS_PRODUCTS.goes).every((a) => a.product === 'ir')).toBe(true);
    });

    it('sense la llista del worker, infraroig a hores calculades amb la mateixa edat segura', () => {
        const attempts = gibsAttempts(null, NOW, GIBS_PRODUCTS.goes);
        expect(attempts).toHaveLength(2);
        expect(attempts.every((a) => a.product === 'ir' && a.slot % 600 === 0 && a.slot <= NOW - GIBS_SAFE_AGE_SEC.ir)).toBe(true);
    });

    it('llegeix la resposta de /hd/{goes|himawari}/latest', () => {
        expect(parseGibsSlots({ ir: { latest: 5, slots: [1, 2], light: 1 }, colour: null })).toEqual({ ir: { slots: [1, 2], light: 1 }, colour: null });
        expect(parseGibsSlots({ ir: { slots: [1] }, colour: { slots: [1, 'x'], light: 'x' } }))
            .toEqual({ ir: { slots: [1], light: null }, colour: { slots: [1], light: null } });
        expect(parseGibsSlots(null)).toBeNull();
        expect(parseGibsSlots({ colour: { slots: [1] } })).toBeNull();
    });
});

// Mercator de nivell 3: on cau un lloc (px dins el món de 2.048 px).
const WORLD = TILE_PX * 8;
const mercX = (lon: number) => ((lon + 180) / 360) * WORLD;
const mercY = (lat: number) => ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2)) / Math.PI) / 2) * WORLD;

describe('Taulers del disc', () => {
    it('el GOES: cinc columnes de 180° O a 45° E, totes les files, i sense els racons que no veu', () => {
        const mosaic = discMosaic(-75.2);
        expect(mosaic.westLon).toBe(-180);
        expect(mosaic.width).toBe(5 * TILE_PX);
        expect(mosaic.rowMin).toBe(0);
        expect(mosaic.height).toBe(8 * TILE_PX);
        expect(mosaic.tiles.some((t) => t.x === 2 && t.y === 3)).toBe(true);
        // De 0° a 45° E i de 66,5° a 85° N: a més de 82° del punt de sota el satèl·lit.
        expect(mosaic.tiles.some((t) => t.x === 4 && t.y === 0)).toBe(false);
        expect(mosaic.tiles.length).toBeGreaterThan(25);
        expect(mosaic.tiles.length).toBeLessThan(40);
    });

    it("l'Himawari travessa 180°: la columna de 180° a 225° és el tauler x = 0, a la dreta del mosaic", () => {
        const mosaic = discMosaic(140.7);
        expect(mosaic.westLon).toBe(45);
        expect(mosaic.width).toBe(4 * TILE_PX);
        const wrapped = mosaic.tiles.filter((t) => t.x === 0);
        expect(wrapped.length).toBeGreaterThan(0);
        expect(wrapped.every((t) => t.left === 3 * TILE_PX)).toBe(true);
    });

    it('cap lloc que el satèl·lit veu no queda sense tauler', () => {
        for (const subLon of [-75.2, 140.7]) {
            const mosaic = discMosaic(subLon);
            for (let lat = -VIEW_MAX_DEG; lat <= VIEW_MAX_DEG; lat += 1.5) {
                for (let dLon = -VIEW_MAX_DEG; dLon <= VIEW_MAX_DEG; dLon += 1.5) {
                    if (Math.cos(lat * DEG) * Math.cos(dLon * DEG) < Math.cos(VIEW_MAX_DEG * DEG)) continue;
                    const col = Math.floor(((subLon + dLon - mosaic.westLon) / 360) * WORLD / TILE_PX);
                    const row = Math.floor(mercY(lat) / TILE_PX);
                    expect(mosaic.tiles.some((t) => t.left === col * TILE_PX && t.y === row), `${lat}, ${subLon + dLon}`).toBe(true);
                }
            }
        }
    });

    it('la vora fosca de 180°: només els taulers de la darrera columna (135° E a 180°)', () => {
        const tiles = discMosaic(140.7).tiles;
        expect(tiles.filter(hasDarkEastEdge).every((t) => t.x === 7)).toBe(true);
        expect(tiles.some(hasDarkEastEdge)).toBe(true);
        expect(discMosaic(-75.2).tiles.some(hasDarkEastEdge)).toBe(false);
    });

    it("l'adreça és la dels taulers HD del radar", () => {
        const url = discTileUrl('https://sat.example', 'himawari', { product: 'ir', slot: NOW }, { x: 0, y: 3, left: 768, top: 768 });
        expect(url).toBe(`https://sat.example/hd/gibs/v1/himawari/ir/${NOW}/3/0/3.png`);
    });

    it('el Meteosat, el disc just al quadre i a l\'hora de les capacitats', () => {
        const url = meteosatImageUrl(Date.UTC(2026, 9, 31, 0, 0));
        // Adreça pròpia de la capa: la general /geoserver/wms tardava 13-16 s (2026-11-09).
        expect(url.startsWith('https://view.eumetsat.int/geoserver/mtg_fd/rgb_geocolour/ows?')).toBe(true);
        expect(url).toContain('&layers=rgb_geocolour&');
        expect(url).toContain('crs=AUTO:42003,9001,0,0&bbox=-6378137,-6378137,6378137,6378137');
        expect(url).toContain('time=2026-10-31T00:00:00.000Z');
    });
});

describe('Reprojecció al disc', () => {
    // Un mosaic on cada píxel diu la seva columna i fila (12 bits cada una): així es veu d'on surt cada punt.
    const mosaicOf = (subLon: number) => {
        const mosaic = discMosaic(subLon);
        const src = new Uint32Array(mosaic.width * mosaic.height)
            .map((_, k) => (0xff000000 | ((k % mosaic.width) << 12) | Math.floor(k / mosaic.width)) >>> 0);
        return { mosaic, src };
    };
    const SIZE = 101;
    const goes = mosaicOf(-75.2);
    const disc = reprojectMercatorToDisc(goes.src, goes.mosaic, -75.2, SIZE);
    const at = (d: Uint32Array, i: number, j: number, size = SIZE) => ({ col: (d[j * size + i] >>> 12) & 0xfff, row: d[j * size + i] & 0xfff, alpha: d[j * size + i] >>> 24 });

    it('el centre del disc surt del punt de sota el satèl·lit', () => {
        expect(at(disc, 50, 50)).toEqual({ col: Math.floor(mercX(-75.2)), row: WORLD / 2, alpha: 255 });
    });

    it('nord a dalt, est a la dreta, i fora del disc transparent', () => {
        expect(at(disc, 50, 20).row).toBeLessThan(WORLD / 2);
        expect(at(disc, 80, 50).col).toBeGreaterThan(mercX(-75.2));
        expect(at(disc, 0, 0).alpha).toBe(0);
    });

    it("a mig radi cap a l'est, uns 30° de longitud (sin Δλ = x a l'equador); a mig radi cap al nord, 30° de latitud", () => {
        // El píxel 75 és a 0,495 radis.
        const x = (2 * 75 + 1) / SIZE - 1;
        expect(Math.abs(at(disc, 75, 50).col - mercX(-75.2 + Math.asin(x) / DEG))).toBeLessThanOrEqual(1);
        const y = 1 - (2 * 25 + 1) / SIZE;
        expect(Math.abs(at(disc, 50, 25).row - mercY(Math.asin(y) / DEG))).toBeLessThanOrEqual(1);
    });

    it("l'Himawari, passat 180°, pren la columna del tauler de l'altra banda", () => {
        const himawari = mosaicOf(140.7);
        const d = reprojectMercatorToDisc(himawari.src, himawari.mosaic, 140.7, SIZE);
        // 60° a l'est: 200,7° = 159,3° O, a 155,7° de la vora oest del mosaic (45° E).
        const x = Math.sin(60 * DEG);
        const i = Math.round(((x + 1) * SIZE - 1) / 2);
        const lon = 140.7 + Math.asin((2 * i + 1) / SIZE - 1) / DEG;
        expect(Math.abs(at(d, i, 50).col - ((lon - 45) / 360) * WORLD)).toBeLessThanOrEqual(1);
        expect(at(d, i, 50).col).toBeGreaterThan(3 * TILE_PX);
    });

    it('el limbe que el satèl·lit no veu queda negre, no transparent', () => {
        const big = 401;
        const edge = reprojectMercatorToDisc(goes.src, goes.mosaic, -75.2, big)[200 * big + 400];
        // A 0,9975 radis de l'equador: 86°, més enllà dels 82°.
        expect(edge).toBe(0xff000000);
    });

    it('forats: un tauler que falta compta sempre; el negre, només a l\'infraroig', () => {
        expect(missingShare(disc, SIZE, true)).toBe(0);
        const transparent = disc.map((px, k) => ((k % SIZE) > SIZE * 0.7 ? 0 : px));
        expect(missingShare(transparent, SIZE, false)).toBeGreaterThan(MAX_MISSING_SHARE);
        // Un GeoColor de nit sobre el mar és negre (1, 1, 1) però opac: no és cap forat.
        const night = disc.map((px, k) => ((k % SIZE) > SIZE * 0.7 ? 0xff010101 : px));
        expect(missingShare(night, SIZE, false)).toBe(0);
        expect(missingShare(night, SIZE, true)).toBeGreaterThan(MAX_MISSING_SHARE);
    });
});

describe("L'Himawari en GeoColor de CIRA", () => {
    const SUB = 140.7;

    it('les franges de /hd/himawari/disc/latest, de la més nova a la més vella; i la imatge, pel worker', () => {
        expect(parseCiraSlots({ slots: [NOW - 600, NOW, 'x'] })).toEqual([NOW, NOW - 600]);
        expect(parseCiraSlots({ slots: [], off: true })).toEqual([]);
        expect(parseCiraSlots(null)).toBeNull();
        expect(ciraDiscUrl('https://sat.example', NOW)).toBe(`https://sat.example/hd/himawari/disc/${NOW}.png`);
    });

    it('la vista del satèl·lit: el punt de sota al centre (344), est a la dreta i nord a dalt', () => {
        const centre = geosImagePoint(0, SUB, SUB);
        expect(centre.u).toBeCloseTo(344, 6);
        expect(centre.v).toBeCloseTo(344, 6);
        expect(geosImagePoint(0, SUB + 10, SUB).u).toBeGreaterThan(344);
        expect(geosImagePoint(10, SUB, SUB).v).toBeLessThan(344);
    });

    it("a 45° a l'est sobre l'equador, l'angle que es veu des de 42.164 km (no el sin 45° de l'ortogràfica)", () => {
        // A l'equador, la latitud geocèntrica és la geodèsica i el radi, l'equatorial.
        const a = 6378.137;
        const scanDeg = Math.atan((a * Math.sin(45 * DEG)) / (42164 - a * Math.cos(45 * DEG))) / DEG;
        const degPerPx = (65536 / 20466275) * (5500 / CIRA_DISC_PX);
        expect(geosImagePoint(0, SUB + 45, SUB).u).toBeCloseTo(344 + scanDeg / degPerPx, 3);
        // Uns 267 px del centre: 27 més que l'ortogràfica amb el mateix radi (340 · sin 45° = 240).
        expect(geosImagePoint(0, SUB + 45, SUB).u - 344).toBeGreaterThan(265);
    });

    it("l'horitzó cau a les vores mesurades del disc de CIRA (4–684 a l'equador, 5–683 de pol a pol)", () => {
        // Des de 42.164 km, l'horitzó de l'equador és a acos(a / 42164) = 81,3°.
        const limb = Math.acos(6378.137 / 42164) / DEG;
        expect(Math.abs(geosImagePoint(0, SUB + limb, SUB).u - 684)).toBeLessThan(1);
        expect(Math.abs(geosImagePoint(0, SUB - limb, SUB).u - 4)).toBeLessThan(1);
        expect(Math.abs(geosImagePoint(81.2, SUB, SUB).v - 5)).toBeLessThan(1.5);
    });

    it('al disc ortogràfic: centre del centre, est a la dreta, fora transparent i més enllà de l\'horitzó negre', () => {
        // Cada píxel de la imatge de CIRA diu la seva columna i fila.
        const src = new Uint32Array(CIRA_DISC_PX * CIRA_DISC_PX).map((_, k) => (0xff000000 | ((k % CIRA_DISC_PX) << 12) | Math.floor(k / CIRA_DISC_PX)) >>> 0);
        const SIZE = 101;
        const disc = reprojectGeosToDisc(src, CIRA_DISC_PX, SUB, SIZE);
        const at = (i: number, j: number) => ({ col: (disc[j * SIZE + i] >>> 12) & 0xfff, row: disc[j * SIZE + i] & 0xfff, alpha: disc[j * SIZE + i] >>> 24 });
        expect(at(50, 50)).toEqual({ col: 344, row: 344, alpha: 255 });
        expect(at(80, 50).col).toBeGreaterThan(344);
        expect(at(50, 20).row).toBeLessThan(344);
        expect(at(0, 0).alpha).toBe(0);
        // A 0,995 radis: 84°, darrere l'horitzó del satèl·lit.
        const big = 401;
        expect(reprojectGeosToDisc(src, CIRA_DISC_PX, SUB, big)[200 * big + 399]).toBe(0xff000000);
    });
});
