// src/utils/chartUtils.test.ts
import { describe, it, expect } from 'vitest';
import { calculateYDomain, generateGraphPoints, generateSmoothPath, generateBandPath, ChartDataPoint, GraphPoint } from './chartUtils';

describe('Chart Logic Engine (chartUtils)', () => {
    
    // 1. TESTEJEM ELS MARGES DE SEGURETAT (El problema que teníem)
    describe('calculateYDomain', () => {
        it('hauria de donar un marge del 110% per probabilitat de pluja', () => {
            // Simulem dades que arriben al 100%
            const values = [0, 50, 100]; 
            const domain = calculateYDomain(values, 'rain');
            
            expect(domain.min).toBe(0);
            expect(domain.max).toBe(110); // Verifiquem que deixa aire per dalt
        });

        it('hauria de donar un marge DOBLE (2.0x) per volum de precipitació', () => {
            // Cas pluja forta: 10mm
            const values = [0, 5, 10];
            const domain = calculateYDomain(values, 'precip');

            expect(domain.min).toBe(0);
            expect(domain.max).toBe(20); // 10 * 2.0 = 20 (Molt d'aire)
        });

        it('hauria de respectar el mínim de 1mm per precipitació quasi nul·la', () => {
            // Cas pluja ridícula: 0.1mm
            const values = [0, 0.1];
            const domain = calculateYDomain(values, 'precip');

            // Max real és 0.1, però forcem base 1. Llavors 1 * 2.0 = 2.
            expect(domain.max).toBe(2); 
        });

        it('hauria de donar un marge del 10% per temperatura', () => {
            const values = [10, 20]; // Rang de 10
            const domain = calculateYDomain(values, 'temp');

            // Marge = 10 * 0.1 = 1.
            // Min = 10 - 1 = 9
            // Max = 20 + 1 = 21
            expect(domain.min).toBe(9);
            expect(domain.max).toBe(21);
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