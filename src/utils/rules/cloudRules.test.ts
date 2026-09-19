import { describe, it, expect } from 'vitest';
import { isMostlyCloudy } from './cloudRules';
import { getWeatherLabel } from '../formatters';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';
import type { StrictCurrentWeather } from '../../types/weatherLogicTypes';

const { MOSTLY_CLOUDY } = WEATHER_THRESHOLDS.CLOUDS;

describe('isMostlyCloudy', () => {
    it('només dins del codi 2 i per sobre del llindar (estricte)', () => {
        expect(isMostlyCloudy(2, MOSTLY_CLOUDY)).toBe(false);
        expect(isMostlyCloudy(2, MOSTLY_CLOUDY + 0.1)).toBe(true);
        expect(isMostlyCloudy(2, 85)).toBe(true);
        expect(isMostlyCloudy(2, 60)).toBe(false);
    });

    it('els altres codis de cel no tenen variant', () => {
        for (const code of [0, 1, 3, 45, 61]) expect(isMostlyCloudy(code, 80)).toBe(false);
    });

    it('DOCTRINA RISC ZERO: sense % de núvols (null/undefined) no es fingeix cap variant', () => {
        expect(isMostlyCloudy(2, null)).toBe(false);
        expect(isMostlyCloudy(2, undefined)).toBe(false);
        expect(isMostlyCloudy(null, 80)).toBe(false);
    });
});

describe('getWeatherLabel — variant "molt ennuvolat"', () => {
    const cur = (code: number) => ({ weather_code: code } as unknown as StrictCurrentWeather);

    it('el codi 2 amb molts núvols es diu "Molt ennuvolat" i la resta "Parcialment ennuvolat"', () => {
        expect(getWeatherLabel(cur(2), 'ca', 80)).toBe('Molt ennuvolat');
        expect(getWeatherLabel(cur(2), 'ca', 55)).toBe('Parcialment ennuvolat');
        expect(getWeatherLabel(cur(2), 'ca')).toBe('Parcialment ennuvolat');
    });

    it('funciona als 4 idiomes i no toca els altres codis', () => {
        for (const lang of ['ca', 'es', 'en', 'fr'] as const) {
            expect(getWeatherLabel(cur(2), lang, 80)).not.toBe(getWeatherLabel(cur(2), lang, 55));
            expect(getWeatherLabel(cur(3), lang, 80)).toBe(getWeatherLabel(cur(3), lang));
        }
    });

    it("l'aiguaneu (68/69) té etiqueta als 4 idiomes", () => {
        for (const lang of ['ca', 'es', 'en', 'fr'] as const) {
            expect(getWeatherLabel(cur(68), lang)).not.toBe('---');
            expect(getWeatherLabel(cur(69), lang)).not.toBe('---');
        }
    });
});
