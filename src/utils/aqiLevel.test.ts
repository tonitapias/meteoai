// src/utils/aqiLevel.test.ts
// Bandes, colors i desglossament de contaminants de la qualitat de l'aire: una sola font per al giny, el modal, els
// destacats d'Ara i el nom accessible de la targeta.
import { describe, it, expect } from 'vitest';
import {
    AQI_BANDS, AQI_LEVEL_COLOR, AQI_SCALE_MAX, POLLUTANTS, extractPollutantBreakdown, getAqiLevel, getAqiLevelColor,
    getAqiLevelFor, isAqiAlertLevel,
} from './aqiLevel';
import { PARAMS_AQI_CURRENT } from '../constants/apiConfig';

describe("getAqiLevelFor — l'índex europeu amb les bandes d'Open-Meteo (20/40/60/80/100)", () => {
    it('cada vora, amb el límit dins la banda de sota', () => {
        const cases: [number, string][] = [
            [0, 'good'], [20, 'good'], [21, 'fair'], [40, 'fair'], [41, 'moderate'], [60, 'moderate'],
            [61, 'poor'], [80, 'poor'], [81, 'very_poor'], [100, 'very_poor'], [101, 'extreme'], [400, 'extreme'],
        ];
        for (const [value, level] of cases) expect(getAqiLevelFor(value, 'EAQI'), `EAQI ${value}`).toBe(level);
    });

    it('els casos que abans sortien malament (bandes de concentració del PM10 aplicades a l\'índex)', () => {
        expect(getAqiLevelFor(55, 'EAQI')).toBe('moderate');   // abans "Dolenta"
        expect(getAqiLevelFor(90, 'EAQI')).toBe('very_poor');  // abans "Dolenta"
        expect(getAqiLevelFor(120, 'EAQI')).toBe('extreme');   // abans "Molt dolenta"
    });

    it("l'escala americana (EPA) no canvia", () => {
        const cases: [number, string][] = [
            [50, 'good'], [51, 'moderate'], [100, 'moderate'], [101, 'sensitive'], [151, 'poor'], [201, 'very_poor'], [301, 'hazardous'],
        ];
        for (const [value, level] of cases) expect(getAqiLevelFor(value, 'USAQI'), `USAQI ${value}`).toBe(level);
        expect(getAqiLevel({ value: 120, type: 'USAQI', pm25: null, pm10: null })).toBe('sensitive');
    });

    it("les sis bandes europees ocupen el mateix tros del carril (escala fins a 120)", () => {
        const edges = [0, ...AQI_BANDS.EAQI.map(b => b.max), AQI_SCALE_MAX.EAQI];
        const widths = edges.slice(1).map((e, i) => e - edges[i]);
        expect(new Set(widths)).toEqual(new Set([20]));
    });
});

describe('colors i avís', () => {
    it('cada nivell de cada escala té el seu color (cap cau al gris de "sense dada")', () => {
        for (const scale of ['EAQI', 'USAQI'] as const) {
            const levels = [...AQI_BANDS[scale].map(b => b.level), getAqiLevelFor(Number.MAX_SAFE_INTEGER, scale)];
            for (const level of levels) expect(AQI_LEVEL_COLOR[scale][level], `${scale} ${level}`).toBeDefined();
        }
        expect(getAqiLevelColor('good', 'EAQI').family).toBe('cyan');
        expect(getAqiLevelColor('good', 'USAQI').family).toBe('emerald');
        expect(getAqiLevelColor('sensitive', 'EAQI').family).toBe('slate'); // l'EAQI no té aquest nivell
    });

    it("el llum avisa a partir de dolenta (EAQI) o de sensibles (USAQI), com abans", () => {
        expect(isAqiAlertLevel(getAqiLevelFor(60, 'EAQI'))).toBe(false);
        expect(isAqiAlertLevel(getAqiLevelFor(61, 'EAQI'))).toBe(true);
        expect(isAqiAlertLevel(getAqiLevelFor(100, 'USAQI'))).toBe(false);
        expect(isAqiAlertLevel(getAqiLevelFor(101, 'USAQI'))).toBe(true);
    });
});

describe('extractPollutantBreakdown', () => {
    const current = {
        european_aqi: 90, pm2_5: 115.9, pm10: 116.6, nitrogen_dioxide: 103.1, ozone: 50,
        european_aqi_pm2_5: 90, european_aqi_pm10: 59, european_aqi_nitrogen_dioxide: 81, european_aqi_ozone: 17,
    };

    it('la concentració, el subíndex i el seu nivell, en l\'ordre del giny', () => {
        expect(extractPollutantBreakdown(current)).toEqual([
            { key: 'pm2_5', label: 'PM2.5', value: 115.9, index: 90, level: 'very_poor' },
            { key: 'pm10', label: 'PM10', value: 116.6, index: 59, level: 'moderate' },
            { key: 'nitrogen_dioxide', label: 'NO₂', value: 103.1, index: 81, level: 'very_poor' },
            { key: 'ozone', label: 'O₃', value: 50, index: 17, level: 'good' },
        ]);
    });

    it("el contaminant pitjor té el nivell de l'índex (l'índex n'és el màxim)", () => {
        const worst = extractPollutantBreakdown(current).reduce((a, b) => ((b.index ?? -1) > (a.index ?? -1) ? b : a));
        expect(worst.level).toBe(getAqiLevelFor(current.european_aqi, 'EAQI'));
    });

    it("accepta aqiData sencer (amb .current), com extractAqiData", () => {
        expect(extractPollutantBreakdown({ current })[0].index).toBe(90);
    });

    it('DOCTRINA RISC ZERO: el que falta és null (mai 0), i un 0 real es manté', () => {
        const readings = extractPollutantBreakdown({ pm2_5: 0, european_aqi_pm2_5: 0, pm10: Number.NaN, ozone: 'x' });
        expect(readings[0]).toMatchObject({ value: 0, index: 0, level: 'good' });
        expect(readings[1]).toMatchObject({ value: null, index: null, level: null });
        expect(readings[3]).toMatchObject({ value: null, index: null, level: null });
        expect(extractPollutantBreakdown(null).every(r => r.value === null && r.index === null)).toBe(true);
    });

    it("la crida d'Open-Meteo demana el subíndex de cada contaminant (sense, les barres queden grises)", () => {
        for (const { key } of POLLUTANTS) expect(PARAMS_AQI_CURRENT).toContain(`european_aqi_${key}`);
    });
});
