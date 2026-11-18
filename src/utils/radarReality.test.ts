// src/utils/radarReality.test.ts
// L'avís "el radar veu pluja que la previsió no té": intensitat, extensió (rainFractionAround) i la pluja que s'ha avançat.
import { describe, it, expect } from 'vitest';
import { firstForecastRainHour, radarRainIntensity, rainExtent } from './radarReality';
import { kmPerTilePixel, rainFractionAround } from './radarSampling';

describe('radarRainIntensity', () => {
    it('amb els llindars del codi del temps (1,5 i 4 mm/h)', () => {
        expect(radarRainIntensity(0.6)).toBe('light');
        expect(radarRainIntensity(1.33)).toBe('light'); // 25 dBZ
        expect(radarRainIntensity(1.5)).toBe('moderate');
        expect(radarRainIntensity(2.73)).toBe('moderate'); // 30 dBZ
        expect(radarRainIntensity(4)).toBe('moderate');
        expect(radarRainIntensity(11.5)).toBe('heavy'); // 40 dBZ
    });
});

describe('rainExtent', () => {
    it('aïllat per sota del 30 %, àmplia a partir del 60 %, i entremig no es diu res', () => {
        expect(rainExtent(null)).toBeNull();
        expect(rainExtent(0.05)).toBe('local');
        expect(rainExtent(0.45)).toBeNull();
        expect(rainExtent(0.6)).toBe('wide');
        expect(rainExtent(1)).toBe('wide');
    });
});

describe('firstForecastRainHour', () => {
    // Sant Feliu Sasserra, 18-11-2026 a les 23:13 (AROME HD): res fins a la 01:00 i després 4-6 mm/h.
    const hours = [
        { time: '2026-11-18T23:00', precip: 0 },
        { time: '2026-11-19T00:00', precip: 0.1 },
        { time: '2026-11-19T01:00', precip: 4 },
        { time: '2026-11-19T02:00', precip: 6 },
        { time: '2026-11-19T03:00', precip: 6 },
        { time: '2026-11-19T04:00', precip: 1 }
    ];

    it("la primera hora amb pluja (≥ 0,2 mm) de les tres següents a l'actual", () => {
        expect(firstForecastRainHour(hours)).toBe('01:00');
    });

    it("l'hora actual no compta (ja la mira l'avís), ni la pluja de més enllà de 3 h", () => {
        const later = hours.map((h, i) => ({ ...h, precip: i === 0 || i === 4 ? 5 : 0 }));
        expect(firstForecastRainHour(later)).toBeNull();
    });

    it('sense sèrie o amb forats, cap hora', () => {
        expect(firstForecastRainHour(undefined)).toBeNull();
        expect(firstForecastRainHour([])).toBeNull();
        expect(firstForecastRainHour([hours[0], { time: '2026-11-19T00:00', precip: null }])).toBeNull();
    });
});

// Una imatge RGBA de w x h; `wet(x, y)` pinta el píxel de groc NEXRAD (35 dBZ, ~5,6 mm/h).
const image = (w: number, h: number, wet: (x: number, y: number) => boolean, color = [255, 255, 0, 255]) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (wet(x, y)) data.set(color, (y * w + x) * 4);
    return data;
};

describe('rainFractionAround', () => {
    it('tot el voltant amb pluja: 1; només el centre: gairebé 0', () => {
        expect(rainFractionAround(image(21, 21, () => true), 21, 21, 10, 10, 10, 0.5)).toBe(1);
        const lone = rainFractionAround(image(21, 21, (x, y) => x === 10 && y === 10), 21, 21, 10, 10, 10, 0.5);
        expect(lone).toBeGreaterThan(0);
        expect(lone).toBeLessThan(0.01);
    });

    it('mig cercle amb pluja: ~0,5', () => {
        const f = rainFractionAround(image(41, 41, (x) => x < 20), 41, 41, 20, 20, 20, 0.5);
        expect(f).toBeGreaterThan(0.45);
        expect(f).toBeLessThan(0.55);
    });

    it("l'eco més feble que el llindar no compta com a pluja", () => {
        // Cian NEXRAD de 0 dBZ: hi ha eco, però per sota de 0,5 mm/h.
        const faint = image(21, 21, () => true, [4, 233, 231, 255]);
        expect(rainFractionAround(faint, 21, 21, 10, 10, 10, 0.5)).toBe(0);
    });

    it('a la vora de la imatge, només compta la part del cercle que hi és', () => {
        // El lloc a la cantonada: se'n veu un quart de cercle, tot moll. 1, no 0,25 (el que és fora no és "sec").
        expect(rainFractionAround(image(10, 10, () => true), 10, 10, 0, 0, 8, 0.5)).toBe(1);
    });
});

describe('kmPerTilePixel', () => {
    it('al zoom 8 de 512 px, a 42° de latitud, uns 0,23 km per píxel (10 km ≈ 44 px)', () => {
        const km = kmPerTilePixel(42, 8);
        expect(km).toBeCloseTo(0.227, 2);
        expect(Math.round(10 / km)).toBe(44);
    });
});
