import { describe, it, expect } from 'vitest';
import { adjustForStorms } from './stormRules';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { CAPE, CLOUDS } = WEATHER_THRESHOLDS;

describe('adjustForStorms — calibrat contra tempesta observada (METAR), vegeu stormRules.ts', () => {
    it('plugim feble amb CAPE alt i cel tapat és tempesta (mesurat: trons a ±1 h el 41-60 % de les vegades)', () => {
        // El cas de Roses (27-09-2026): ECMWF 9 km, codi 51, 0,1 mm/h, CAPE 1300, cel tapat.
        expect(adjustForStorms(51, 1300, 90, 0.1)).toBe(95);
    });

    it('quatre gotes (0,1 mm) ja n\'hi ha prou: exigir més pluja empitjora el CSI a tots els terminis', () => {
        expect(adjustForStorms(61, CAPE.MIN_STORM + 1, CLOUDS.STORM_BASE + 1, 0.1)).toBe(95);
        expect(adjustForStorms(3, CAPE.MIN_STORM + 1, CLOUDS.STORM_BASE + 1, 0.1)).toBe(95);
    });

    it('sense prou energia, o amb el cel poc tapat, no hi ha tempesta', () => {
        expect(adjustForStorms(51, CAPE.MIN_STORM, 90, 0.3)).toBe(51);
        expect(adjustForStorms(51, 1300, CLOUDS.STORM_BASE, 0.3)).toBe(51);
    });

    it('sense precipitació no pinta tempesta (amb CAPE molt alt, només cel variable)', () => {
        expect(adjustForStorms(3, 1500, 90, 0)).toBe(3);
        expect(adjustForStorms(3, CAPE.HIGH_STORM + 1, 90, 0)).toBe(2);
    });

    it('no rebaixa un codi de tempesta amb calamarsa que ja portava el model', () => {
        expect(adjustForStorms(99, 1300, 90, 2)).toBe(99);
    });
});
