// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getHazardFallbackTips } from './hazardTips';
import type { TacticalHazardType } from '../services/geminiService';
import type { Language } from '../translations';

describe('getHazardFallbackTips', () => {
    it('un avís AMBER de vent sense consells en rep un de vent', () => {
        expect(getHazardFallbackTips('AMBER', 'WIND', 'ca')).toEqual([
            { category: 'WIND', text: 'Ràfegues fortes: Assegureu objectes solts i eviteu zones arbrades' },
        ]);
    });

    it('RED també, amb la categoria del perill (fred → THERMAL, tempesta → HAZARD, pluja → SKY)', () => {
        expect(getHazardFallbackTips('RED', 'COLD', 'en')[0].category).toBe('THERMAL');
        expect(getHazardFallbackTips('RED', 'CONVECTIVE', 'es')[0].category).toBe('HAZARD');
        expect(getHazardFallbackTips('AMBER', 'RAIN', 'fr')[0].category).toBe('SKY');
    });

    it('GREEN, sense nivell o sense perill: cap consell (la regla de ferro continua valent)', () => {
        expect(getHazardFallbackTips('GREEN', 'WIND', 'ca')).toEqual([]);
        expect(getHazardFallbackTips(undefined, 'WIND', 'ca')).toEqual([]);
        expect(getHazardFallbackTips('AMBER', 'NONE', 'ca')).toEqual([]);
        expect(getHazardFallbackTips('AMBER', undefined, 'ca')).toEqual([]);
    });

    it('els 4 idiomes tenen un consell per a cada perill, amb el format "Causa: Efecte" i 15 paraules com a molt', () => {
        const langs: Language[] = ['ca', 'es', 'en', 'fr'];
        const hazards: TacticalHazardType[] = ['WIND', 'RAIN', 'HEAT', 'COLD', 'THERMAL', 'CONVECTIVE', 'SNOW_ICE', 'VISIBILITY', 'AIR_QUALITY'];
        for (const lang of langs) {
            for (const hazard of hazards) {
                const [tip] = getHazardFallbackTips('AMBER', hazard, lang);
                expect(tip?.text, `${lang}/${hazard}`).toMatch(/^[^:]+ ?: \S/);
                expect(tip.text.split(/\s+/).filter(w => w !== ':').length, `${lang}/${hazard}`).toBeLessThanOrEqual(15);
            }
        }
    });
});
