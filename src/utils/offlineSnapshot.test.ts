// src/utils/offlineSnapshot.test.ts
import { describe, it, expect } from 'vitest';
import { rollSnapshotForward, locationHourPrefix } from './offlineSnapshot';
import { REGIONAL_TEMP_FLAG_KEY } from '../constants/regionalModels';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Previsió desada a Girona el 27-09 a les 10:30 (hora local, UTC+2): 3 dies d'hores des del 27 a les 00:00, AROME HD
// les primeres 36 hores. Cada valor horari és el seu índex (temperatura i) per poder seguir-lo després de retallar.
const HOURS = 72;
const hourTimes = Array.from({ length: HOURS }, (_, i) => new Date(Date.UTC(2026, 8, 27) + i * 3_600_000).toISOString().slice(0, 16));
const quarterTimes = (hours: number) =>
    Array.from({ length: hours * 4 }, (_, i) => new Date(Date.UTC(2026, 8, 27) + i * 900_000).toISOString().slice(0, 16));

const saved = (overrides: Partial<Record<string, unknown>> = {}): ExtendedWeatherData => ({
    timezone: 'Europe/Madrid',
    utc_offset_seconds: 7200,
    current: { time: '2026-09-27T10:30', temperature_2m: 999, precipitation: 0, visibility: 24000, source: 'AROME HD', interval: 900 },
    hourly: {
        time: hourTimes,
        temperature_2m: hourTimes.map((_, i) => i),
        precipitation: hourTimes.map((_, i) => (i === 13 ? 2 : 0)),
        visibility: hourTimes.map((_, i) => (i === 13 ? null : 20000)),
        weather_code: hourTimes.map(() => 3),
        [REGIONAL_TEMP_FLAG_KEY]: hourTimes.map((_, i) => (i < 36 ? 1 : null))
    },
    daily: { time: ['2026-09-27', '2026-09-28', '2026-09-29'], temperature_2m_max: [1, 2, 3] },
    hourlyComparison: {
        ecmwf: hourTimes.map((_, i) => ({ temperature_2m: 100 + i })),
        gfs: hourTimes.map(() => ({})), icon: hourTimes.map(() => ({})), aifs: hourTimes.map(() => ({}))
    },
    dailyComparison: { ecmwf: { temperature_2m_max: [11, 12, 13] }, gfs: {}, icon: {} },
    minutely_15: { time: quarterTimes(48), precipitation: quarterTimes(48).map((_, i) => i) },
    ...overrides
}) as unknown as ExtendedWeatherData;

// Instant UTC; a Girona (UTC+2) és 2 hores més.
const at = (isoUtc: string) => new Date(isoUtc);
const series = (data: ExtendedWeatherData | null, key: string) => (data?.hourly as unknown as Record<string, unknown[]>)[key];

describe('rollSnapshotForward — el mateix dia', () => {
    const rolled = rollSnapshotForward(saved(), at('2026-09-27T11:10:00Z')); // 13:10 a Girona

    it('l\'"ara" passa a ser l\'hora actual del lloc, amb els valors horaris d\'aquesta hora', () => {
        expect(rolled?.current.time).toBe('2026-09-27T13:00');
        expect(rolled?.current.temperature_2m).toBe(13);
        expect(rolled?.current.weather_code).toBe(3);
    });

    it('els acumulats d\'"ara" són un quart de l\'hora (com els dona Open-Meteo)', () => {
        expect(rolled?.current.precipitation).toBe(0.5);
    });

    it('un valor que falta a l\'hora actual queda null, mai el de l\'hora desada', () => {
        expect(rolled?.current.visibility).toBeNull();
    });

    it('conserva la font regional si l\'hora actual és del model regional, i la resta de camps', () => {
        expect(rolled?.current.source).toBe('AROME HD');
        expect(rolled?.current.interval).toBe(900);
    });

    it('no retalla res: les sèries ja comencen avui', () => {
        expect(series(rolled, 'time')).toHaveLength(HOURS);
        expect(rolled?.daily.time[0]).toBe('2026-09-27');
    });

    it('desada dins de l\'hora actual: es conserva el seu "ara" (quart d\'hora, més precís que l\'horari)', () => {
        const sameHour = rollSnapshotForward(saved(), at('2026-09-27T08:50:00Z')); // 10:50, desada a les 10:30
        expect(sameHour?.current.time).toBe('2026-09-27T10:30');
        expect(sameHour?.current.temperature_2m).toBe(999);
        expect(sameHour?.current.visibility).toBe(24000);
    });

    it('no muta la previsió desada', () => {
        const original = saved();
        rollSnapshotForward(original, at('2026-09-27T11:10:00Z'));
        expect(original.current.time).toBe('2026-09-27T10:30');
        expect(original.current.temperature_2m).toBe(999);
    });
});

describe('rollSnapshotForward — passada la mitjanit', () => {
    const rolled = rollSnapshotForward(saved(), at('2026-09-28T07:20:00Z')); // 09:20 del 28 a Girona

    it('totes les sèries tornen a començar avui a les 00:00, alineades', () => {
        expect(series(rolled, 'time')[0]).toBe('2026-09-28T00:00');
        expect(series(rolled, 'time')).toHaveLength(HOURS - 24);
        expect(series(rolled, 'temperature_2m')[0]).toBe(24);
        expect(series(rolled, REGIONAL_TEMP_FLAG_KEY)).toHaveLength(HOURS - 24);
        expect(rolled?.hourlyComparison?.ecmwf[0]).toEqual({ temperature_2m: 124 });
        expect(rolled?.hourlyComparison?.gfs).toHaveLength(HOURS - 24);
    });

    it('els dies també: daily[0] torna a ser avui', () => {
        expect(rolled?.daily.time).toEqual(['2026-09-28', '2026-09-29']);
        expect(rolled?.daily.temperature_2m_max).toEqual([2, 3]);
        expect(rolled?.dailyComparison?.ecmwf.temperature_2m_max).toEqual([12, 13]);
    });

    it('l\'"ara" és l\'hora actual de la sèrie retallada', () => {
        expect(rolled?.current.time).toBe('2026-09-28T09:00');
        expect(rolled?.current.temperature_2m).toBe(33);
    });

    it('la pluja minutal també comença avui', () => {
        const minutely = rolled?.minutely_15 as { time: string[]; precipitation: number[] };
        expect(minutely.time[0]).toBe('2026-09-28T00:00');
        expect(minutely.precipitation[0]).toBe(96);
    });

    it('si l\'hora actual ja no és del model regional, la font d\'"ara" deixa de ser-ho', () => {
        const later = rollSnapshotForward(saved(), at('2026-09-28T12:00:00Z')); // 14:00 del 28 = hora 38
        expect(later?.current.temperature_2m).toBe(38);
        expect(later?.current.source).toBeUndefined();
    });
});

describe('rollSnapshotForward — quan no es pot fer servir', () => {
    it('la previsió desada no arriba fins a l\'hora actual', () => {
        expect(rollSnapshotForward(saved(), at('2026-09-30T02:00:00Z'))).toBeNull();
    });

    it('els dies desats no inclouen avui', () => {
        const data = saved({ daily: { time: ['2026-09-27'], temperature_2m_max: [1] } });
        expect(rollSnapshotForward(data, at('2026-09-28T07:20:00Z'))).toBeNull();
    });

    it('sense zona horària ni desplaçament no se sap quina hora és al lloc', () => {
        const data = saved({ timezone: undefined, utc_offset_seconds: undefined });
        expect(rollSnapshotForward(data, at('2026-09-27T11:10:00Z'))).toBeNull();
    });

    it('la pluja minutal que ja no arriba a l\'hora actual es treu (l\'"ara" faria servir l\'últim quart)', () => {
        const data = saved({ minutely_15: { time: quarterTimes(12), precipitation: quarterTimes(12).map(() => 1) } });
        const rolled = rollSnapshotForward(data, at('2026-09-27T11:10:00Z'));
        expect(rolled?.current.time).toBe('2026-09-27T13:00');
        expect(rolled?.minutely_15).toBeUndefined();
    });
});

describe('locationHourPrefix', () => {
    it('fa servir la zona horària del lloc (22:30 UTC ja és l\'endemà a Girona)', () => {
        expect(locationHourPrefix(at('2026-09-27T22:30:00Z'), 'Europe/Madrid', 7200)).toBe('2026-09-28T00');
    });

    it('amb una zona desconeguda, el desplaçament de la resposta', () => {
        expect(locationHourPrefix(at('2026-09-27T22:30:00Z'), 'No/Existeix', 7200)).toBe('2026-09-28T00');
    });

    it('la zona horària té en compte el canvi d\'hora (el desplaçament desat, no)', () => {
        // 25-10-2026 a les 03:00 locals es torna a l'horari d'hivern (UTC+1).
        expect(locationHourPrefix(at('2026-10-25T12:00:00Z'), 'Europe/Madrid', 7200)).toBe('2026-10-25T13');
    });
});
