// src/hooks/useDayDetailData.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDayDetailData } from './useDayDetailData';
import { useChartData } from './useChartData';
import { MAX_INVERSION_CORRECTION_C } from '../utils/rules/temperatureCorrections';

// Correcció d'una nit serena de gener amb vent d'1 km/h (el de les dades de sota): MAX × (6 − 1) / 6.
const CALM_CORRECTION = MAX_INVERSION_CORRECTION_C * 5 / 6;
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Dos dies d'hivern a Girona (nit serena i en calma a primera hora): 2026-01-15 i 2026-01-16.
const HOURS = 48;
const time = Array.from({ length: HOURS }, (_, i) => {
    const day = i < 24 ? '15' : '16';
    return `2026-01-${day}T${String(i % 24).padStart(2, '0')}:00`;
});
const isDayAt = (i: number) => (i % 24 >= 8 && i % 24 <= 17 ? 1 : 0);
const rowOf = (base: number) => (_: unknown, i: number) => ({
    temperature_2m: base + (i % 24) / 4,
    is_day: isDayAt(i),
    wind_speed_10m: 1,
    cloud_cover_low: 0,
    cloud_cover_mid: 0,
    cloud_cover_high: 0,
    precipitation: 0,
    precipitation_probability: 5,
    freezing_level_height: 1500
});

const data = {
    latitude: 41.98,
    longitude: 2.82,
    utc_offset_seconds: 3600,
    timezone: 'Europe/Madrid',
    elevation: 100,
    location: { name: 'Girona', latitude: 41.98, longitude: 2.82 },
    current: { time: '2026-01-15T00:00', temperature_2m: 3, is_day: 0 },
    hourly: {
        time,
        temperature_2m: Array.from({ length: HOURS }, (_, i) => 3 + (i % 24) / 4),
        is_day: Array.from({ length: HOURS }, (_, i) => isDayAt(i)),
        wind_speed_10m: Array.from({ length: HOURS }, () => 1),
        cloud_cover_low: Array.from({ length: HOURS }, () => 0),
        cloud_cover_mid: Array.from({ length: HOURS }, () => 0),
        cloud_cover_high: Array.from({ length: HOURS }, () => 0),
        precipitation: Array.from({ length: HOURS }, () => 0),
        precipitation_probability: Array.from({ length: HOURS }, () => 5),
        freezing_level_height: Array.from({ length: HOURS }, () => 1500)
    },
    hourlyComparison: {
        ecmwf: Array.from({ length: HOURS }, rowOf(4)),
        gfs: Array.from({ length: HOURS }, rowOf(2)),
        icon: Array.from({ length: HOURS }, rowOf(3)),
        aifs: Array.from({ length: HOURS }, rowOf(3.5))
    },
    daily: {
        time: ['2026-01-15', '2026-01-16'],
        temperature_2m_max: [9, 9],
        temperature_2m_min: [3, 3],
        precipitation_sum: [0, 0],
        wind_speed_10m_max: [5, 5],
        sunrise: ['2026-01-15T07:55', '2026-01-16T07:54'],
        sunset: ['2026-01-15T17:30', '2026-01-16T17:31'],
        uv_index_max: [2, 2]
    }
} as unknown as ExtendedWeatherData;

describe('useDayDetailData: gràfic del detall de dia', () => {
    it('agafa les hores del dia demanat, sense les de l\'altre', () => {
        const { result } = renderHook(() => useDayDetailData(data, 1));
        expect(result.current.hourlyData).toHaveLength(24);
        expect(result.current.hourlyData.every(p => p.time.startsWith('2026-01-16'))).toBe(true);
        expect(result.current.comparisonData?.gfs).toHaveLength(24);
    });

    it('la temperatura de la nit va corregida per inversió (3° cru → menys)', () => {
        const { result } = renderHook(() => useDayDetailData(data, 0));
        // 00:00, nit, calma (vent 1), cel serè, gener: la correcció resta MAX × (6−1)/6.
        expect(result.current.hourlyData[0].temp).toBeCloseTo(3 - CALM_CORRECTION, 5);
        // 12:00, de dia: cru.
        expect(result.current.hourlyData[12].temp).toBe(3 + 12 / 4);
    });

    it('les línies dels models també van corregides i alineades amb la principal', () => {
        const { result } = renderHook(() => useDayDetailData(data, 0));
        const { hourlyData, comparisonData } = result.current;
        expect(comparisonData?.aifs.map(p => p.time)).toEqual(hourlyData.map(p => p.time));
        expect(comparisonData?.gfs[0].temp).toBeCloseTo(2 - CALM_CORRECTION, 5);
        expect(comparisonData?.gfs[12].temp).toBe(2 + 12 / 4);
    });

    it('la mateixa hora surt IGUAL al tauler d\'Expert i al detall de dia (no poden divergir)', () => {
        const dash = renderHook(() => useChartData(data, 0, 'C'));
        const detail = renderHook(() => useDayDetailData(data, 0));

        const dashSeries = dash.result.current.chartSeries;
        expect(dashSeries?.primary.length).toBe(24);
        dashSeries?.primary.forEach((p, i) => {
            expect(p).toEqual(detail.result.current.hourlyData[i]);
        });
        expect(dashSeries?.comparison?.icon).toEqual(detail.result.current.comparisonData?.icon);
    });

    it('sense weatherData o sense dia seleccionat: buit i null, sense petar', () => {
        const none = renderHook(() => useDayDetailData(null, null));
        expect(none.result.current.hourlyData).toEqual([]);
        expect(none.result.current.comparisonData).toBeNull();
        expect(none.result.current.snowLevelText).toBe('---');
    });

    it("nowIndex és l'hora actual dins el dia si el dia és avui (current.time = 2026-01-15T00:00) i null si no ho és", () => {
        const today = renderHook(() => useDayDetailData(data, 0));
        expect(today.result.current.nowIndex).toBe(0);
        const tomorrow = renderHook(() => useDayDetailData(data, 1));
        expect(tomorrow.result.current.nowIndex).toBeNull();
        const none = renderHook(() => useDayDetailData(null, null));
        expect(none.result.current.nowIndex).toBeNull();
    });

    it('la cota de neu del resum surt de la mateixa sèrie que dibuixa el gràfic', () => {
        const { result } = renderHook(() => useDayDetailData(data, 0));
        // freezing_level 1500 m − buffer de cota → mateix valor a totes les hores → "NNNm" sense rang.
        expect(result.current.snowLevelText).toMatch(/^\d+m$/);
        expect(result.current.hourlyData.every(p => p.snowLevel === result.current.hourlyData[0].snowLevel)).toBe(true);
    });
});

// Setembre a Sabadell (mesurat amb dades reals d'Open-Meteo): el valor DIARI és del model global
// (27,6°/17,5°, vent 15 km/h) però les hores d'aquest dia porten el model regional (AROME HD: 29,1°/21,4°,
// vent 13 km/h). El detall d'un dia ha de dir el mateix a la capçalera, al gràfic i a la taula.
const SEP_TIME = Array.from({ length: 48 }, (_, i) => `2026-09-${i < 24 ? '21' : '22'}T${String(i % 24).padStart(2, '0')}:00`);
const sepTemp = (i: number) => (i % 24 === 15 ? 29.1 : i % 24 === 6 ? 21.4 : 25);
const sepDay = (i: number) => (i % 24 >= 7 && i % 24 <= 19 ? 1 : 0);
const flat = (n: number, v: number | null) => Array.from({ length: n }, () => v);

const buildSeptember = (opts: {
    regionalFlags?: boolean[];
    hourlyWind?: boolean;
    hourlyProb?: (i: number) => number;
    comparison?: boolean;
    hourlyGusts?: boolean;
} = {}): ExtendedWeatherData => {
    const { regionalFlags = [true, true], hourlyWind = true, hourlyProb = () => 0, comparison = true, hourlyGusts = false } = opts;
    const dailyOf = (max: number, min: number) => ({
        temperature_2m_max: [max, max], temperature_2m_min: [min, min], precipitation_sum: [0, 0]
    });
    return {
        latitude: 41.55, longitude: 2.11, utc_offset_seconds: 7200, timezone: 'Europe/Madrid', elevation: 200,
        location: { name: 'Sabadell', latitude: 41.55, longitude: 2.11 },
        current: { time: '2026-09-21T12:00', temperature_2m: 30, is_day: 1, source: 'AROME HD' },
        hourly: {
            time: SEP_TIME,
            temperature_2m: SEP_TIME.map((_, i) => sepTemp(i)),
            regional_temperature_2m: SEP_TIME.map((_, i) => (regionalFlags[i < 24 ? 0 : 1] ? 1 : null)),
            is_day: SEP_TIME.map((_, i) => sepDay(i)),
            ...(hourlyWind ? { wind_speed_10m: SEP_TIME.map((_, i) => (i % 24 === 12 ? 13 : 5)) } : {}),
            ...(hourlyGusts ? { wind_gusts_10m: SEP_TIME.map((_, i) => (i % 24 === 15 ? 34 : 8)) } : {}),
            cloud_cover_low: flat(48, 0), cloud_cover_mid: flat(48, 0), cloud_cover_high: flat(48, 0),
            precipitation: flat(48, 0),
            precipitation_probability: SEP_TIME.map((_, i) => hourlyProb(i))
        },
        ...(comparison ? {
            dailyComparison: {
                ecmwf: dailyOf(28.4, 18.5), gfs: dailyOf(26.9, 17), icon: dailyOf(28, 19)
            }
        } : {}),
        daily: {
            time: ['2026-09-21', '2026-09-22'],
            ...dailyOf(27.6, 17.5),
            wind_speed_10m_max: [15, 15],
            wind_gusts_10m_max: [30, 30],
            sunshine_duration: [30000, 35280],
            precipitation_probability_max: [10, 10],
            sunrise: ['2026-09-21T07:38', '2026-09-22T07:39'],
            sunset: ['2026-09-21T19:51', '2026-09-22T19:49'],
            uv_index_max: [5.8, 5.8]
        }
    } as unknown as ExtendedWeatherData;
};

describe('useDayDetailData: capçalera coherent amb el gràfic i la llista', () => {
    it('la màxima i la mínima són les de les hores (model regional), no el valor diari cru del model global', () => {
        const { result } = renderHook(() => useDayDetailData(buildSeptember(), 1));
        expect(result.current.extremes?.max).toBe(29.1);
        expect(result.current.extremes?.min).toBe(21.4);
    });

    it("coincideixen amb les de la sèrie que dibuixa el gràfic del mateix detall (setembre: sense correcció d'inversió)", () => {
        const { result } = renderHook(() => useDayDetailData(buildSeptember(), 1));
        const temps = result.current.hourlyData.map(p => p.temp as number);
        expect(result.current.extremes?.max).toBe(Math.max(...temps));
        expect(result.current.extremes?.min).toBe(Math.min(...temps));
    });

    it("la mínima d'una nit d'hivern serena i en calma va corregida per inversió, com a la llista", () => {
        const { result } = renderHook(() => useDayDetailData(data, 0));
        // El valor diari cru diu 3°; la nit calmada i serena de gener n'és més freda (la mateixa correcció que a les hores).
        expect(result.current.extremes?.min).toBeCloseTo(3 - CALM_CORRECTION, 5);
    });

    it('marca el dia com a regional només si la seva màxima o mínima surt d\'una hora regional', () => {
        const regional = renderHook(() => useDayDetailData(buildSeptember({ regionalFlags: [true, true] }), 1));
        expect(regional.result.current.isRegionalDay).toBe(true);

        // Dia 22 sense hores regionals (més enllà de l'abast del model): és del model global.
        const global = renderHook(() => useDayDetailData(buildSeptember({ regionalFlags: [true, false] }), 1));
        expect(global.result.current.isRegionalDay).toBe(false);
    });

    it('el vent màxim surt de les hores de la taula i, sense vent horari, del valor diari', () => {
        const fromHours = renderHook(() => useDayDetailData(buildSeptember(), 1));
        expect(fromHours.result.current.windMax).toBe(13);

        const noHourly = renderHook(() => useDayDetailData(buildSeptember({ hourlyWind: false }), 1));
        expect(noHourly.result.current.windMax).toBe(15);
    });

    it('la probabilitat de pluja és la diària o la de la taula si és més alta (mai un 0 % sobre una hora al 70 %)', () => {
        const boosted = renderHook(() => useDayDetailData(buildSeptember({ hourlyProb: i => (i === 24 + 17 ? 70 : 0) }), 1));
        expect(boosted.result.current.precipProbMax).toBe(70);

        // El dia 0 no té cap hora amb pluja: manen els 10 % diaris.
        const dailyOnly = renderHook(() => useDayDetailData(buildSeptember({ hourlyProb: i => (i === 24 + 17 ? 70 : 0) }), 0));
        expect(dailyOnly.result.current.precipProbMax).toBe(10);
    });

    it("l'acord entre models surt dels models globals i el rang inclou la xifra mostrada", () => {
        const { result } = renderHook(() => useDayDetailData(buildSeptember(), 1));
        expect(result.current.spread?.reliability).toBe('high');
        // Models: 27,6 (diari) · 28,4 · 26,9 · 28,0; la mostrada (29,1) també hi entra.
        expect(result.current.spread?.maxRange).toEqual({ low: 26.9, high: 29.1 });
        expect(result.current.spread?.minRange).toEqual({ low: 17, high: 21.4 });
    });

    it('sense comparació de models no s\'inventa cap fiabilitat ni cap rang', () => {
        const { result } = renderHook(() => useDayDetailData(buildSeptember({ comparison: false }), 1));
        expect(result.current.spread?.reliability).toBeNull();
        expect(result.current.spread?.maxRange).toBeNull();
    });

    it('sense weatherData o sense dia seleccionat tot és null, sense petar', () => {
        const none = renderHook(() => useDayDetailData(null, null));
        expect(none.result.current.extremes).toBeNull();
        expect(none.result.current.windMax).toBeNull();
        expect(none.result.current.precipProbMax).toBeNull();
        expect(none.result.current.spread).toBeNull();
        expect(none.result.current.isRegionalDay).toBe(false);
    });
});

describe('useDayDetailData: peces del detall ampliat', () => {
    it('la ràfega màxima surt de les hores del dia i, sense ràfegues horàries, del valor diari', () => {
        const fromHours = renderHook(() => useDayDetailData(buildSeptember({ hourlyGusts: true }), 1));
        expect(fromHours.result.current.gustsMax).toBe(34);

        const fromDaily = renderHook(() => useDayDetailData(buildSeptember({ hourlyGusts: false }), 1));
        expect(fromDaily.result.current.gustsMax).toBe(30);
    });

    it('la durada del dia surt de la sortida i la posta (12 h 10 min)', () => {
        const { result } = renderHook(() => useDayDetailData(buildSeptember(), 1));
        expect(result.current.daylightSec).toBe((12 * 60 + 10) * 60);
    });

    it('les hores de sol són les del dia; si no hi ha dada, null (no 0)', () => {
        const withSun = renderHook(() => useDayDetailData(buildSeptember(), 1));
        expect(withSun.result.current.dayData?.sunshineSec).toBe(35280);

        const without = renderHook(() => useDayDetailData(data, 0));
        expect(without.result.current.dayData?.sunshineSec).toBeNull();
    });

    it('la cota de neu només és rellevant si hi pot haver neu (cota baixa, o neu prevista)', () => {
        // El fixture de gener porta una isoterma a 1500 m → cota 1200 m: rellevant.
        const winter = renderHook(() => useDayDetailData(data, 0));
        expect(winter.result.current.snowLevelRelevant).toBe(true);

        // Setembre sense isoterma ni neu: no.
        const summer = renderHook(() => useDayDetailData(buildSeptember(), 1));
        expect(summer.result.current.snowLevelRelevant).toBe(false);
    });

    it('els dies veïns respecten els extrems i els dies que la previsió porta', () => {
        // Només 2 dies (0 i 1): del dia 1 es pot tornar a avui (0) però no hi ha següent.
        const two = renderHook(() => useDayDetailData(buildSeptember(), 1));
        expect(two.result.current.neighbours).toEqual({ prev: 0, next: null });

        // Avui no té anterior.
        const today = renderHook(() => useDayDetailData(buildSeptember(), 0));
        expect(today.result.current.neighbours).toEqual({ prev: null, next: 1 });

        const none = renderHook(() => useDayDetailData(null, null));
        expect(none.result.current.neighbours).toEqual({ prev: null, next: null });
    });

    it('sense weatherData no hi ha cel del dia ni ràfegues', () => {
        const none = renderHook(() => useDayDetailData(null, null));
        expect(none.result.current.dayCode).toBeNull();
        expect(none.result.current.gustsMax).toBeNull();
        expect(none.result.current.daylightSec).toBeNull();
        expect(none.result.current.snowLevelRelevant).toBe(false);
    });
});
