import { describe, it, expect } from 'vitest';
import {
    GIBS_SAFE_AGE_SEC, IR_MAX_DARK_SHARE, SOURCE_PX, darkShare, gibsWmsUrl, meteosatImageUrl, parseGibsSlots, pickGibsSlots,
    reprojectToDisc, sourceParts,
} from './orbitalImage';

const NOW = 1793406000; // 2026-10-31 00:20 UTC

describe('Hora de la imatge de GIBS', () => {
    const slots = { ir: [NOW - 3600, NOW - 3000, NOW - 2400, NOW - 1800], colour: [NOW - 7200, NOW - 6600, NOW - 6000, NOW - 4800] };

    it('GeoColor amb almenys 90 min, de la més nova a la més vella', () => {
        expect(pickGibsSlots(slots, NOW, true)).toEqual({ product: 'colour', candidates: [NOW - 6000, NOW - 6600, NOW - 7200] });
    });

    it('sense GeoColor prou vell (o a Himawari), infraroig amb almenys 50 min', () => {
        // 50 min justos ja compten.
        expect(pickGibsSlots({ ...slots, colour: [NOW - 1200] }, NOW, true)).toEqual({ product: 'ir', candidates: [NOW - 3000, NOW - 3600] });
        expect(pickGibsSlots({ ...slots, colour: null }, NOW, true).product).toBe('ir');
        expect(pickGibsSlots(slots, NOW, false).product).toBe('ir');
    });

    it('sense la llista del worker, hores calculades amb la mateixa edat segura', () => {
        const { product, candidates } = pickGibsSlots(null, NOW, true);
        expect(product).toBe('ir');
        expect(candidates).toHaveLength(3);
        expect(candidates.every((c) => c % 600 === 0 && c <= NOW - GIBS_SAFE_AGE_SEC.ir)).toBe(true);
    });

    it('llegeix la resposta de /hd/{goes|himawari}/latest', () => {
        expect(parseGibsSlots({ ir: { latest: 5, slots: [1, 2] }, colour: null })).toEqual({ ir: [1, 2], colour: null });
        expect(parseGibsSlots({ ir: { slots: [1] }, colour: { slots: [1, 'x'] } })).toEqual({ ir: [1], colour: [1] });
        expect(parseGibsSlots(null)).toBeNull();
    });
});

describe('Finestra que es demana a GIBS', () => {
    it("el GOES, d'una peça", () => {
        expect(sourceParts(-75.2)).toEqual([{ lonMin: -157.2, lonMax: 6.8, x: 0, width: SOURCE_PX }]);
    });

    it("l'Himawari travessa l'antimeridià: dues peces que fan la finestra sencera", () => {
        const parts = sourceParts(140.7);
        expect(parts).toHaveLength(2);
        expect(parts[0]).toMatchObject({ lonMax: 180, x: 0 });
        expect(parts[1]).toMatchObject({ lonMin: -180, x: parts[0].width });
        expect(parts[0].width + parts[1].width).toBe(SOURCE_PX);
        expect(parts[1].lonMax).toBe(-137.3);
        expect(parts[0].lonMin).toBe(58.7);
    });

    it('el WMS 1.3.0 en EPSG:4326 porta el quadre en latitud, longitud', () => {
        const url = gibsWmsUrl('Himawari_AHI_Band13_Clean_Infrared', NOW, sourceParts(140.7)[1]);
        expect(url).toContain('BBOX=-82,-180,82,-137.3');
        expect(url).toContain('TIME=2026-10-31T00:20:00Z');
        expect(url).toContain('FORMAT=image/jpeg');
    });

    it('el Meteosat, el disc just al quadre i a l\'hora de les capacitats', () => {
        const url = meteosatImageUrl(Date.UTC(2026, 9, 31, 0, 0));
        expect(url).toContain('crs=AUTO:42003,9001,0,0&bbox=-6378137,-6378137,6378137,6378137');
        expect(url).toContain('time=2026-10-31T00:00:00.000Z');
    });
});

describe('Reprojecció al disc', () => {
    // Una finestra on cada píxel diu la seva columna i fila: així es veu d'on surt cada punt del disc.
    const W = 164;
    const H = 164;
    const src = new Uint32Array(W * H).map((_, k) => 0xff000000 | ((k % W) << 8) | Math.floor(k / W));
    const SIZE = 101;
    const disc = reprojectToDisc(src, W, H, SIZE);
    const at = (i: number, j: number) => ({ col: (disc[j * SIZE + i] >>> 8) & 0xff, row: disc[j * SIZE + i] & 0xff, alpha: disc[j * SIZE + i] >>> 24 });

    it('el centre del disc surt del centre de la finestra', () => {
        expect(at(50, 50)).toEqual({ col: 82, row: 82, alpha: 255 });
    });

    it('nord a dalt, est a la dreta, i fora del disc transparent', () => {
        expect(at(50, 20).row).toBeLessThan(82);
        expect(at(80, 50).col).toBeGreaterThan(82);
        expect(at(0, 0).alpha).toBe(0);
    });

    it("a mig radi cap a l'est, uns 30° de longitud (sin 30° = 0,5)", () => {
        // El píxel 75 és a 0,495 radis: 29,7°, columna 82 + 29.
        expect(at(75, 50).col).toBe(111);
    });

    it('el limbe que el satèl·lit no veu queda negre, no transparent', () => {
        const big = 401;
        const edge = reprojectToDisc(src, W, H, big)[200 * big + 400];
        // A 0,9975 radis de l'equador: 86° de longitud, més enllà dels 82° de la finestra.
        expect(edge).toBe(0xff000000);
    });

    it('un infraroig sencer no té negre; una franja buida, tot; una a mig omplir, prou per descartar-la', () => {
        expect(darkShare(disc, SIZE)).toBe(0);
        expect(darkShare(new Uint32Array(SIZE * SIZE).fill(0xff000000), SIZE)).toBe(1);
        // Com la de les 02:20 del 31-10: res a l'est de 180° (el terç dret del disc de l'Himawari).
        const holed = disc.map((px, k) => ((k % SIZE) > SIZE * 0.83 ? 0xff000000 : px));
        expect(darkShare(holed, SIZE)).toBeGreaterThan(IR_MAX_DARK_SHARE);
    });
});
