// src/utils/detailCardLabel.test.ts
// Nom accessible de les targetes de la graella de ginys: "nom valor · Detall", com els destacats d'Ara; sense dada, només
// el nom (mai un 0 inventat).
import { describe, it, expect } from 'vitest';
import { buildDetailCardLabel, type DetailCardInput } from './detailCardLabel';
import { effectiveCloudCoverNow } from './cloudCoverLevel';
import { getMoonPhaseName, getNamedMoonPhase } from './lunarPhases';

const NOW = Date.UTC(2026, 9, 25, 16, 0);

describe('buildDetailCardLabel — amb dades', () => {
    it('temperatura (arrodonida, en la unitat de l\'usuari)', () => {
        expect(buildDetailCardLabel({ id: 'temperature', celsius: 18.4, unit: 'C' }, 'ca')).toBe('Temperatura 18° · Detall');
        expect(buildDetailCardLabel({ id: 'temperature', celsius: 18.4, unit: 'F' }, 'ca')).toBe('Temperatura 65° · Detall');
    });

    it("vent: velocitat i d'on ve, com la brúixola", () => {
        expect(buildDetailCardLabel({ id: 'wind', kmh: 6.3, degrees: 225 }, 'ca')).toBe('Vent 6 km/h SO · Detall');
        expect(buildDetailCardLabel({ id: 'wind', kmh: 6.3, degrees: 225 }, 'en')).toBe('Wind 6 km/h SW · Details');
        // Sense direcció, la velocitat sola.
        expect(buildDetailCardLabel({ id: 'wind', kmh: 6.3, degrees: null }, 'ca')).toBe('Vent 6 km/h · Detall');
    });

    it('pressió, aire i visibilitat: les mateixes frases que els destacats d\'Ara', () => {
        expect(buildDetailCardLabel({ id: 'pressure', hpa: 1007.4 }, 'ca')).toBe('Pressió 1007 hPa · Detall');
        expect(buildDetailCardLabel({ id: 'aqi', current: { european_aqi: 23 } }, 'ca')).toBe("Qualitat de l'aire raonable · Detall");
        expect(buildDetailCardLabel({ id: 'visibility', meters: 44200, bound: null }, 'ca')).toBe('Visibilitat 44,2 km · Detall');
        expect(buildDetailCardLabel({ id: 'pressure', hpa: 1007.4 }, 'fr')).toBe('Pression 1007 hPa · Détails');
    });

    it('UV amb el decimal del giny, núvols, rosada, CAPE i cota de neu', () => {
        expect(buildDetailCardLabel({ id: 'uv', index: 3 }, 'ca')).toBe('Índex UV 3,0 · Detall');
        const clouds = Math.round(effectiveCloudCoverNow(70, 20, 10)!);
        expect(buildDetailCardLabel({ id: 'cloudLayers', low: 70, mid: 20, high: 10 }, 'ca')).toBe(`Capes de núvols ${clouds} % · Detall`);
        expect(buildDetailCardLabel({ id: 'cloudLayers', low: 70, mid: 20, high: 10 }, 'en')).toBe(`Cloud layers ${clouds}% · Details`);
        expect(buildDetailCardLabel({ id: 'dewPoint', celsius: 5.4 }, 'ca')).toBe('Punt de rosada 5° · Detall');
        expect(buildDetailCardLabel({ id: 'cape', jkg: 120.4 }, 'ca')).toBe('CAPE 120 J/kg · Detall');
        // Cota = nivell de congelació − 300 m (calculateSnowLevel), en peus amb °F.
        expect(buildDetailCardLabel({ id: 'snowLevel', freezingLevel: 1800, unit: 'C' }, 'ca')).toBe('Cota de neu 1500 m · Detall');
        expect(buildDetailCardLabel({ id: 'snowLevel', freezingLevel: 1800, unit: 'F' }, 'en')).toBe('Snow level 4921 ft · Details');
    });

    it('lluna (el nom del dia) i sol (la pròxima sortida o posta)', () => {
        const phase = getMoonPhaseName(getNamedMoonPhase(new Date(NOW)), 'ca');
        expect(buildDetailCardLabel({ id: 'moon', nowMs: NOW }, 'ca')).toBe(`Fase lunar, ${phase} · Detall`);
        expect(buildDetailCardLabel({ id: 'sun', next: { kind: 'sunset', time: '17:25' } }, 'ca')).toBe('Cicle solar, posta de sol a les 17:25 · Detall');
        expect(buildDetailCardLabel({ id: 'sun', next: { kind: 'sunrise', time: '07:52' } }, 'es')).toBe('Ciclo solar, salida del sol a las 07:52 · Detalle');
    });

    it('un 0 real és un valor (CAPE 0: atmosfera estable; UV 0: de nit)', () => {
        expect(buildDetailCardLabel({ id: 'cape', jkg: 0 }, 'ca')).toBe('CAPE 0 J/kg · Detall');
        expect(buildDetailCardLabel({ id: 'uv', index: 0 }, 'ca')).toBe('Índex UV 0,0 · Detall');
    });
});

describe('buildDetailCardLabel — sense dades', () => {
    const EMPTY: DetailCardInput[] = [
        { id: 'temperature', celsius: null, unit: 'C' },
        { id: 'wind', kmh: undefined, degrees: 225 },
        { id: 'uv', index: null },
        { id: 'visibility', meters: null, bound: null },
        { id: 'cloudLayers', low: undefined, mid: undefined, high: undefined },
        { id: 'pressure', hpa: undefined },
        { id: 'dewPoint', celsius: undefined },
        { id: 'cape', jkg: null },
        { id: 'aqi', current: undefined },
        { id: 'moon', nowMs: Number.NaN },
        { id: 'sun', next: null },
        { id: 'snowLevel', freezingLevel: null, unit: 'C' },
    ];

    it('només el nom, sense cap xifra', () => {
        expect(EMPTY.map(i => buildDetailCardLabel(i, 'ca'))).toEqual([
            'Temperatura · Detall', 'Vent · Detall', 'Índex UV · Detall', 'Visibilitat · Detall', 'Capes de núvols · Detall',
            'Pressió · Detall', 'Punt de rosada · Detall', 'CAPE · Detall', "Qualitat de l'aire · Detall", 'Fase lunar · Detall',
            'Cicle solar · Detall', 'Cota de neu · Detall',
        ]);
        for (const label of EMPTY.map(i => buildDetailCardLabel(i, 'ca'))) expect(label).not.toMatch(/\d/);
    });

    it('en els quatre idiomes, i un idioma desconegut cau al català', () => {
        expect(buildDetailCardLabel({ id: 'wind', kmh: null, degrees: null }, 'es')).toBe('Viento · Detalle');
        expect(buildDetailCardLabel({ id: 'wind', kmh: null, degrees: null }, 'en')).toBe('Wind · Details');
        expect(buildDetailCardLabel({ id: 'wind', kmh: null, degrees: null }, 'fr')).toBe('Vent · Détails');
        expect(buildDetailCardLabel({ id: 'wind', kmh: null, degrees: null }, 'de')).toBe('Vent · Detall');
    });
});
