import { describe, it, expect } from 'vitest';
import {
    areaPathOf, dayChangesOf, linePathOf, makeXScale, makeYScale, nightBandsOf, segmentsOf, temperatureDomain, temperatureGradientStops,
} from './temperatureChart';
import type { TemperaturePoint } from './temperatureDetail';

const pt = (time: string, temp: number | null, feels: number | null = temp, isDay = true): TemperaturePoint => ({ time, temp, feels, isDay });

describe('temperatureDomain', () => {
    it('inclou temperatura i sensació amb marge, sense deixar mig gràfic buit', () => {
        const d = temperatureDomain([pt('2026-11-19T12:00', 18, 16), pt('2026-11-19T13:00', 20, 17), pt('2026-11-19T14:00', 7, 4)])!;
        expect(d.dataMin).toBe(4);
        expect(d.dataMax).toBe(20);
        expect(d.min).toBeLessThan(4);
        expect(d.min).toBeGreaterThan(0); // abans s'arrodonia a -10
        expect(d.max).toBeGreaterThan(20);
        expect(d.max).toBeLessThan(25);
        expect(d.ticks.every(tk => tk > d.min && tk < d.max)).toBe(true);
        expect(d.ticks.length).toBeGreaterThan(0);
        expect(d.ticks.length).toBeLessThan(5);
    });

    it('la isoterma de 0 °C només quan les dades s\'hi acosten', () => {
        expect(temperatureDomain([pt('a', 3), pt('b', 12)])!.showFreezing).toBe(false);
        expect(temperatureDomain([pt('a', 1.5), pt('b', 12)])!.showFreezing).toBe(true);
        expect(temperatureDomain([pt('a', -4), pt('b', 6)])!.showFreezing).toBe(true);
    });

    it('sense cap valor, null', () => {
        expect(temperatureDomain([pt('a', null, null)])).toBeNull();
        expect(temperatureDomain([])).toBeNull();
    });
});

describe('escales i degradat', () => {
    it('y: el màxim a dalt i el mínim a baix de la zona útil', () => {
        const d = { min: 0, max: 20, dataMin: 0, dataMax: 20, ticks: [10], showFreezing: false };
        const y = makeYScale(d, 10, 90);
        expect(y(20)).toBe(10);
        expect(y(0)).toBe(90);
        expect(y(10)).toBe(50);
        expect(y(99)).toBe(10); // fora del domini, retallat
    });

    it('x: de 0 a 100', () => {
        const x = makeXScale(5);
        expect(x(0)).toBe(0);
        expect(x(4)).toBe(100);
        expect(makeXScale(1)(0)).toBe(0);
    });

    it('el degradat va del color de dalt al de baix passant pel de cada banda', () => {
        const stops = temperatureGradientStops({ min: -2, max: 20, dataMin: -2, dataMax: 20, ticks: [], showFreezing: true });
        expect(stops[0]).toEqual({ offset: 0, color: '#a3e635' }); // 20 °C: llima
        expect(stops[stops.length - 1]).toEqual({ offset: 1, color: '#06b6d4' }); // -2 °C: cian
        // Centres de banda dins (16, 8,5 i 0 °C), de calent a fred.
        expect(stops.map(s => s.color)).toEqual(['#a3e635', '#a3e635', '#10b981', '#06b6d4', '#06b6d4']);
        expect(stops.every((s, i) => i === 0 || s.offset >= stops[i - 1].offset)).toBe(true);
    });
});

describe('traços', () => {
    const x = makeXScale(5);
    const y = (c: number) => 100 - c;

    it('una hora sense dada talla la línia en dos trams', () => {
        const segs = segmentsOf([pt('a', 10), pt('b', 11), pt('c', null), pt('d', 12), pt('e', 13)], 'temp', x, y);
        expect(segs).toHaveLength(2);
        expect(linePathOf(segs)).toBe('M0.00,90.00 L25.00,89.00 M75.00,88.00 L100.00,87.00');
    });

    it('l\'àrea tanca cada tram contra la base i ignora els trams d\'un sol punt', () => {
        const segs = segmentsOf([pt('a', 10), pt('b', null), pt('c', 12), pt('d', 13), pt('e', null)], 'temp', x, y);
        expect(areaPathOf(segs, 95)).toBe('M50.00,95 L50.00,88.00 L75.00,87.00 L75.00,95 Z');
    });
});

describe('nit i canvis de dia', () => {
    it('franges de nit contigües, mitja hora a cada costat', () => {
        const pts = [pt('a', 1, 1, true), pt('b', 1, 1, false), pt('c', 1, 1, false), pt('d', 1, 1, true), pt('e', 1, 1, false)];
        expect(nightBandsOf(pts, makeXScale(5))).toEqual([{ x1: 12.5, x2: 62.5 }, { x1: 87.5, x2: 100 }]);
    });

    it('marca la mitjanit amb "dd/mm"', () => {
        const pts = [pt('2026-11-19T22:00', 1), pt('2026-11-19T23:00', 1), pt('2026-11-20T00:00', 1), pt('2026-11-20T01:00', 1)];
        expect(dayChangesOf(pts, makeXScale(4))).toEqual([{ x: (2 / 3) * 100, label: '20/11' }]);
    });
});
