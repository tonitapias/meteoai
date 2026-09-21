// src/utils/chartUtils.test.ts
import { describe, it, expect } from 'vitest';
import {
    calculateAxis,
    calculateNiceTicks,
    generateGraphPoints,
    generateSmoothPath,
    generateBandPath,
    indexToX,
    xToIndex,
    valueToY,
    ChartDataPoint,
    GraphPoint
} from './chartUtils';

describe('Chart Logic Engine (chartUtils)', () => {
    
    // 1. EIXOS: valors "rodons" que contenen tots els punts
    describe('calculateNiceTicks', () => {
        it('tria marques rodones que contenen tot el rang', () => {
            const axis = calculateNiceTicks(12.6, 27, { steps: [1, 2, 4, 5, 10] });
            expect(axis.ticks).toEqual([12, 16, 20, 24, 28]);
            expect(axis.min).toBe(12);
            expect(axis.max).toBe(28);
        });

        it('el domini sempre conté els valors, sigui quin sigui el rang', () => {
            for (const [lo, hi] of [[0, 3.2], [-4.3, 6.1], [1480, 4530], [0.02, 0.9], [-30, -12], [95, 100]]) {
                const axis = calculateNiceTicks(lo, hi);
                expect(axis.min).toBeLessThanOrEqual(lo);
                expect(axis.max).toBeGreaterThanOrEqual(hi);
                expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
                expect(axis.ticks.length).toBeLessThanOrEqual(8);
            }
        });

        it("un rang sense amplada (tots els valors iguals) s'obre una mica perquè hi hagi eix", () => {
            const axis = calculateNiceTicks(20, 20);
            expect(axis.min).toBeLessThan(20);
            expect(axis.max).toBeGreaterThan(20);
        });

        it('no arrossega errors de coma flotant a les marques (0,1 + 0,2 ≠ 0,30000000000000004)', () => {
            const axis = calculateNiceTicks(0, 0.6, { target: 3 });
            for (const t of axis.ticks) expect(t).toBe(Number(t.toFixed(6)));
        });
    });

    describe('calculateAxis', () => {
        it('la probabilitat (i humitat/núvols) va SEMPRE de 0 a 100', () => {
            expect(calculateAxis([12, 40], 'rain')).toEqual({ min: 0, max: 100, ticks: [0, 50, 100] });
            expect(calculateAxis([], 'humidity').max).toBe(100);
        });

        it("el volum de pluja parteix de zero i té un mínim d'1 mm (un plugim no omple el gràfic)", () => {
            const drizzle = calculateAxis([0, 0.1], 'precip');
            expect(drizzle.min).toBe(0);
            expect(drizzle.max).toBeGreaterThanOrEqual(1);
            const storm = calculateAxis([0, 8.5], 'precip');
            expect(storm.max).toBeGreaterThanOrEqual(8.5);
            expect(storm.max).toBeLessThanOrEqual(12);
        });

        it("el vent parteix de zero i té un mínim de 10 km/h (una calma no s'escala fins a semblar ventada)", () => {
            const calm = calculateAxis([2, 4], 'wind');
            expect(calm.min).toBe(0);
            expect(calm.max).toBeGreaterThanOrEqual(10);
            expect(calculateAxis([5, 27], 'wind').max).toBeGreaterThanOrEqual(27);
        });

        it("la temperatura s'ajusta al rang real (no parteix de zero)", () => {
            const axis = calculateAxis([12.6, 27], 'temp');
            expect(axis.min).toBeGreaterThan(0);
            expect(axis.min).toBeLessThanOrEqual(12.6);
            expect(axis.max).toBeGreaterThanOrEqual(27);
        });

        it("la cota de neu s'ajusta al rang, en metres", () => {
            const axis = calculateAxis([1480, 4530], 'snowLevel');
            expect(axis.min).toBeLessThanOrEqual(1480);
            expect(axis.max).toBeGreaterThanOrEqual(4530);
        });

        it('sense valors, un eix per defecte en lloc de petar', () => {
            expect(calculateAxis([], 'temp').ticks.length).toBeGreaterThan(1);
            expect(calculateAxis([Number.NaN], 'wind').ticks.length).toBeGreaterThan(1);
        });
    });

    // 1b. MARGES PROPIS I CONVERSIONS X ↔ ÍNDEX
    describe('marges i coordenades', () => {
        const dims = { width: 200, height: 100, paddingX: 10, paddingY: 10, paddingLeft: 40, paddingRight: 20, paddingTop: 30, paddingBottom: 20 };

        it('els marges propis manen sobre paddingX/paddingY; sense ells, els simètrics de sempre', () => {
            expect(indexToX(0, 5, dims)).toBe(40);
            expect(indexToX(4, 5, dims)).toBe(180);
            expect(indexToX(0, 5, { width: 200, height: 100, paddingX: 10, paddingY: 10 })).toBe(10);
            expect(indexToX(4, 5, { width: 200, height: 100, paddingX: 10, paddingY: 10 })).toBe(190);
        });

        it('valueToY: el mínim del domini cau a la base útil i el màxim al sostre útil', () => {
            expect(valueToY(0, dims, { min: 0, max: 10 })).toBe(80);
            expect(valueToY(10, dims, { min: 0, max: 10 })).toBe(30);
        });

        it("xToIndex és la inversa d'indexToX i mai surt de la sèrie", () => {
            for (let i = 0; i < 24; i++) expect(xToIndex(indexToX(i, 24, dims), 24, dims)).toBe(i);
            expect(xToIndex(-500, 24, dims)).toBe(0);
            expect(xToIndex(5000, 24, dims)).toBe(23);
            expect(xToIndex(100, 1, dims)).toBe(0);
        });

        it('generateGraphPoints usa els marges propis i retalla al sostre útil, no al paddingY', () => {
            const pts = generateGraphPoints([{ time: 't0', v: 0 }, { time: 't1', v: 1000 }], dims, { min: 0, max: 10 }, 'v');
            expect(pts[0].x).toBe(40);
            expect(pts[0].y).toBe(80);
            expect(pts[1].x).toBe(180);
            expect(pts[1].y).toBe(30);
        });
    });

    // 2. TESTEJEM QUE NO SURTI DE LA GRÀFICA (Clamping)
    describe('generateGraphPoints', () => {
        const dims = { width: 100, height: 100, paddingX: 0, paddingY: 10 };
        // Alçada útil = 100 - 10 (paddingY) = 90. 
        // El sostre visual és a Y=10.

        it('mai hauria de generar coordenades Y per sobre del padding superior', () => {
            const data: ChartDataPoint[] = [
                { time: '10:00', val: 50 }, // Valor normal
                { time: '11:00', val: 1000 } // Valor EXTREM que trencaria la gràfica
            ];
            
            // Definim un domini normal (0 a 100)
            const domain = { min: 0, max: 100 };

            const points = generateGraphPoints(data, dims, domain, 'val');

            // El punt normal hauria d'estar bé
            expect(points[0].y).toBeGreaterThan(10);

            // El punt extrem (1000) hauria de ser "clamped" al sostre (10), no negatiu
            expect(points[1].y).toBe(10); 
        });

        it('hauria de gestionar valors nuls correctament', () => {
            const data: ChartDataPoint[] = [
                { time: '10:00', val: null }
            ];
            const domain = { min: 0, max: 100 };
            const points = generateGraphPoints(data, dims, domain, 'val');

            // Si és null, el posem fora de pantalla per baix (height + 10 = 110)
            expect(points[0].y).toBe(110);
            expect(points[0].value).toBeNull();
        });
    });

    // 3. UN FORAT DE DADES TALLA EL TRAÇ (mai s'inventen les hores que cap model ha donat)
    describe('generateSmoothPath', () => {
        const pt = (x: number, value: number | null): GraphPoint => ({ x, y: value === null ? 110 : 100 - value, value, time: `t${x}` });

        it('uneix amb corbes els punts consecutius amb dada', () => {
            const path = generateSmoothPath([pt(0, 10), pt(10, 20), pt(20, 30)], 100);
            expect(path.match(/M/g)).toHaveLength(1);
            expect(path.match(/C/g)).toHaveLength(2);
        });

        it('una hora sense dada al mig talla el traç en dos trams, sense unir els veïns', () => {
            const path = generateSmoothPath([pt(0, 10), pt(10, 20), pt(20, null), pt(30, 40), pt(40, 50)], 100);
            expect(path.match(/M/g)).toHaveLength(2);
            expect(path.match(/C/g)).toHaveLength(2);
            // Cap corba no pot anar del punt x=10 al punt x=30 (saltant el forat).
            expect(path).not.toMatch(/10,\d+ .*30,\d+.*30,\d+/);
        });

        it('sense cap tram (buit, un sol punt o tot nuls) no dibuixa res', () => {
            expect(generateSmoothPath([], 100)).toBe('');
            expect(generateSmoothPath([pt(0, 10)], 100)).toBe('');
            expect(generateSmoothPath([pt(0, null), pt(10, null)], 100)).toBe('');
            // Un punt aïllat entre dos forats tampoc fa tram.
            expect(generateSmoothPath([pt(0, null), pt(10, 5), pt(20, null)], 100)).toBe('');
        });
    });
    // 4. BANDA DE MODELS: l'àrea entre el model més alt i el més baix de cada hora
    describe('generateBandPath', () => {
        const b = (x: number, top: number, bottom: number) => ({ x, top, bottom });

        it("tanca una àrea: baixa la vora superior d'esquerra a dreta i torna per la inferior", () => {
            const d = generateBandPath([b(0, 10, 30), b(10, 12, 34), b(20, 8, 28)]);
            expect(d.match(/M/g)).toHaveLength(1);
            expect(d.match(/Z/g)).toHaveLength(1);
            // 2 corbes a la vora superior + 2 a la inferior.
            expect(d.match(/C/g)).toHaveLength(4);
            expect(d.startsWith('M 0,10')).toBe(true);
            // Salta del final de la vora superior (x=20,y=8) al final de la inferior (x=20,y=28).
            expect(d).toContain('L 20,28');
        });

        it("una hora sense banda (menys de 2 models) talla l'àrea en dos trams", () => {
            const d = generateBandPath([b(0, 10, 30), b(10, 12, 34), null, b(30, 9, 25), b(40, 11, 27)]);
            expect(d.match(/M/g)).toHaveLength(2);
            expect(d.match(/Z/g)).toHaveLength(2);
        });

        it("un tram d'una sola hora no té àrea, i sense res no dibuixa res", () => {
            expect(generateBandPath([])).toBe('');
            expect(generateBandPath([b(0, 10, 30)])).toBe('');
            expect(generateBandPath([b(0, 10, 30), null, b(20, 9, 25)])).toBe('');
        });
    });
});