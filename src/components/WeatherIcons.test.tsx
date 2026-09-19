import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { getWeatherIcon } from './WeatherIcons';

/** HTML renderitzat de la icona d'un estat (l'estructura de marques és el que la fa distingible). */
const html = (code: number | null, isDay = true, cloudCover?: number | null) => {
    const { container, unmount } = render(<div>{getWeatherIcon(code, 'w-8 h-8', isDay, 0, 0, null, 0, cloudCover)}</div>);
    const out = container.innerHTML;
    unmount();
    return out;
};

/** Nombre de traços (<path>) de la icona: en pluja i neu, més marques = més intensitat. */
const marks = (code: number) => {
    const { container, unmount } = render(<div>{getWeatherIcon(code, 'w-8 h-8', true)}</div>);
    const n = container.querySelectorAll('path').length;
    unmount();
    return n;
};

type Case = [code: number, isDay?: boolean, cloudCover?: number | null];

describe('getWeatherIcon — cada estat del temps és una icona diferent', () => {
    const distinct = (label: string, cases: Case[]) => {
        it(label, () => {
            const set = new Set(cases.map(([c, day, cc]) => html(c, day ?? true, cc)));
            expect(set.size).toBe(cases.length);
        });
    };

    distinct('família de la boira: boira, gebradora i cel cobert', [[45], [48], [3]]);
    distinct('cel de dia: serè, majorment serè, parcial, molt ennuvolat i cobert', [[0], [1], [2, true, 55], [2, true, 80], [3]]);
    distinct('cel de nit: serè, majorment serè, parcial, molt ennuvolat', [[0, false], [1, false], [2, false, 55], [2, false, 80]]);
    distinct('plugim, pluja per intensitat i ruixat', [[51], [61], [63], [65], [81]]);
    distinct('engelant vs normal: plugim i pluja', [[51], [56], [61], [66]]);
    distinct('neu per intensitat, aiguaneu i pluja', [[71], [73], [75], [68], [69], [63]]);
    distinct('tempesta amb i sense calamarsa', [[95], [96]]);

    it('la pluja i la neu pengen més marques com més intensitat', () => {
        expect(marks(61)).toBeLessThan(marks(63));
        expect(marks(63)).toBeLessThan(marks(65));
        expect(marks(71)).toBeLessThan(marks(73));
        expect(marks(73)).toBeLessThan(marks(75));
    });

    it('96 i 99 (calamarsa) comparteixen icona i és diferent de la de la tempesta normal', () => {
        expect(html(96)).toBe(html(99));
        expect(html(96)).not.toBe(html(95));
    });

    it('els grans i els ruixats de neu (només via codi diari cru) també tenen icona de neu', () => {
        expect(html(77)).toBe(html(71));
        expect(html(85)).toBe(html(73));
        expect(html(86)).toBe(html(75));
    });

    it('sense % de núvols el codi 2 es pinta com a "parcial" (no es fingeix cap variant)', () => {
        expect(html(2, true, null)).toBe(html(2, true, 55));
        expect(html(2, true, undefined)).toBe(html(2, true, 55));
    });

    it("sense codi es mostra l'estat de 'sense dades', no una icona de temps", () => {
        expect(html(null)).not.toBe(html(0));
    });
});
