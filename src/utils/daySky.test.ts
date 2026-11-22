import { describe, it, expect } from 'vitest';
import { buildDaySky, mainPrecipCenter, skyKindOfCode, skyKindsPresent, skyStripBackground, SKY_COLORS, type SkyHour } from './daySky';

const hours = (kinds: Array<SkyHour['kind']>, isDay: (h: number) => boolean = h => h >= 8 && h < 18): SkyHour[] =>
    kinds.map((kind, hour) => ({ hour, kind, isDay: isDay(hour) }));

describe('skyKindOfCode', () => {
    it('classifica els codis del motor en el cel que es pinta', () => {
        expect([0, 1, 2, 3].map(skyKindOfCode)).toEqual(['clear', 'clear', 'partly', 'cloudy']);
        expect([45, 48].map(skyKindOfCode)).toEqual(['fog', 'fog']);
        expect([51, 55, 61, 65, 80, 82].map(skyKindOfCode)).toEqual(Array(6).fill('rain'));
        expect([56, 57, 66, 67].map(skyKindOfCode)).toEqual(Array(4).fill('rain'));
        expect([71, 75, 77, 85, 86].map(skyKindOfCode)).toEqual(Array(5).fill('snow'));
        expect([68, 69].map(skyKindOfCode)).toEqual(['snow', 'snow']);   // aiguaneu
        expect([95, 96, 99].map(skyKindOfCode)).toEqual(['storm', 'storm', 'storm']);
    });

    it('sense codi no s\'inventa cap cel', () => {
        expect(skyKindOfCode(null)).toBeNull();
        expect(skyKindOfCode(undefined)).toBeNull();
        expect(skyKindOfCode(Number.NaN)).toBeNull();
    });
});

describe('buildDaySky', () => {
    it('agrupa per data amb l\'hora del rellotge, el codi del motor i el dia o la nit de l\'API', () => {
        const time = ['2026-11-22T00:00', '2026-11-22T12:00', '2026-11-23T00:00', '2026-11-23T13:00'];
        const sky = buildDaySky(
            { time, is_day: [0, 1, 0, 1] },
            { '2026-11-22': [0, 3], '2026-11-23': [61, null] }
        );
        expect(sky['2026-11-22']).toEqual([
            { hour: 0, kind: 'clear', isDay: false },
            { hour: 12, kind: 'cloudy', isDay: true },
        ]);
        expect(sky['2026-11-23']).toEqual([
            { hour: 0, kind: 'rain', isDay: false },
            { hour: 13, kind: null, isDay: true },
        ]);
    });

    it('sense sèrie horària no hi ha franja', () => {
        expect(buildDaySky(null, {})).toEqual({});
        expect(buildDaySky({}, {})).toEqual({});
    });
});

describe('skyStripBackground', () => {
    it('fusiona les hores seguides del mateix color i separa el dia de la nit', () => {
        const bg = skyStripBackground(hours([...Array(8).fill('clear'), ...Array(10).fill('clear'), ...Array(6).fill('clear')]));
        expect(bg).toBe(
            `linear-gradient(90deg, ${SKY_COLORS.clear.night} 0% 33.333%, ${SKY_COLORS.clear.day} 33.333% 75%, ${SKY_COLORS.clear.night} 75% 100%)`
        );
    });

    it('les hores que falten o no tenen codi queden transparents', () => {
        const bg = skyStripBackground([
            { hour: 0, kind: 'rain', isDay: false },
            { hour: 1, kind: null, isDay: false },
        ]);
        expect(bg).toBe(`linear-gradient(90deg, ${SKY_COLORS.rain.night} 0% 4.167%, transparent 4.167% 8.333%)`);
        expect(skyStripBackground([])).toBe('none');
    });
});

describe('mainPrecipCenter', () => {
    it('és el centre del tram de precipitació més llarg', () => {
        const kinds: Array<SkyHour['kind']> = Array(24).fill('cloudy');
        kinds[3] = 'rain';                                   // una hora soltada de matinada
        kinds[19] = 'rain'; kinds[20] = 'rain'; kinds[21] = 'storm';
        expect(mainPrecipCenter(hours(kinds))).toBeCloseTo(20.5 / 24);
    });

    it('sense precipitació no n\'hi ha', () => {
        expect(mainPrecipCenter(hours(Array(24).fill('partly')))).toBeNull();
    });
});

describe('skyKindsPresent', () => {
    it('recull els tipus de cel de tots els dies', () => {
        const kinds = skyKindsPresent([hours(['clear', 'rain']), hours(['clear', null, 'fog'])]);
        expect([...kinds].sort()).toEqual(['clear', 'fog', 'rain']);
    });
});
