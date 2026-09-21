// src/hooks/useDayDetailData.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDayDetailData } from './useDayDetailData';
import { useChartData } from './useChartData';
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
        // 00:00, nit, calma (vent 1), cel serè, gener: la correcció resta 3,5 × (6−1)/6 ≈ 2,9°.
        expect(result.current.hourlyData[0].temp).toBeLessThan(3 - 2);
        // 12:00, de dia: cru.
        expect(result.current.hourlyData[12].temp).toBe(3 + 12 / 4);
    });

    it('les línies dels models també van corregides i alineades amb la principal', () => {
        const { result } = renderHook(() => useDayDetailData(data, 0));
        const { hourlyData, comparisonData } = result.current;
        expect(comparisonData?.aifs.map(p => p.time)).toEqual(hourlyData.map(p => p.time));
        expect(comparisonData?.gfs[0].temp).toBeLessThan(2 - 2);
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
