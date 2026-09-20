import { describe, it, expect } from 'vitest';
import { getAbsoluteColor, buildCapsuleGradient } from './temperatureColors';

describe('getAbsoluteColor', () => {
    it('cada temperatura té el color de la seva banda (els límits són inclosos per dalt)', () => {
        expect(getAbsoluteColor(-20)).toBe('#3b82f6');
        expect(getAbsoluteColor(-5)).toBe('#3b82f6');
        expect(getAbsoluteColor(-4.9)).toBe('#06b6d4');
        expect(getAbsoluteColor(5)).toBe('#06b6d4');
        expect(getAbsoluteColor(12)).toBe('#10b981');
        expect(getAbsoluteColor(20)).toBe('#a3e635');
        expect(getAbsoluteColor(26)).toBe('#fbbf24');
        expect(getAbsoluteColor(32)).toBe('#f97316');
        expect(getAbsoluteColor(32.1)).toBe('#ef4444');
        expect(getAbsoluteColor(50)).toBe('#ef4444');
    });
});

describe('buildCapsuleGradient', () => {
    it('comença amb el color de la màxima i acaba amb el de la mínima', () => {
        const g = buildCapsuleGradient(35, 19);
        expect(g.startsWith('linear-gradient(to bottom, #ef4444 0%')).toBe(true);
        expect(g.endsWith('#a3e635 100%)')).toBe(true);
    });

    it('passa pel color net de cada banda que hi ha entremig, a la seva alçada real', () => {
        // 35° -> 19°: el taronja (centre 29°) cau al 37,5 % i l'ambre (23°) al 75 % del recorregut.
        expect(buildCapsuleGradient(35, 19)).toBe(
            'linear-gradient(to bottom, #ef4444 0%, #f97316 37.5%, #fbbf24 75%, #a3e635 100%)'
        );
    });

    it('un dia de rang curt dins una sola banda no afegeix parades intermèdies', () => {
        expect(buildCapsuleGradient(27, 24)).toBe('linear-gradient(to bottom, #f97316 0%, #fbbf24 100%)');
        expect(buildCapsuleGradient(22, 21)).toBe('linear-gradient(to bottom, #fbbf24 0%, #fbbf24 100%)');
    });

    it('un dia molt ample (de gel a calor) passa per totes les bandes, ordenades de calor a fred', () => {
        const g = buildCapsuleGradient(36, -10);
        const colors = [...g.matchAll(/#[0-9a-f]{6}/g)].map(m => m[0]);
        expect(colors).toEqual(['#ef4444', '#f97316', '#fbbf24', '#a3e635', '#10b981', '#06b6d4', '#3b82f6']);
        const pcts = [...g.matchAll(/([\d.]+)%/g)].map(m => Number(m[1]));
        expect([...pcts].sort((a, b) => a - b)).toEqual(pcts);   // posicions creixents: cap parada creuada
    });

    it('si màxima i mínima coincideixen (o vénen girades), torna un color pla en lloc d\'un degradat trencat', () => {
        expect(buildCapsuleGradient(25, 25)).toBe('#fbbf24');
        expect(buildCapsuleGradient(10, 20)).toBe('#10b981');
    });
});
