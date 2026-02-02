// src/utils/chartUtils.test.ts
import { describe, it, expect } from 'vitest';
import { calculateYDomain, generateGraphPoints, ChartDataPoint } from './chartUtils';

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
});