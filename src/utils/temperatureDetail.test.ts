import { describe, it, expect } from 'vitest';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import {
    buildTemperatureWindow,
    classifyTemperatureTrend,
    findCurrentHourIndex,
    getFeelsCause,
    getThermalBand,
    positionInRange,
    summarizeTemperature,
    toUserTemp,
    toUserTempDelta,
    type TemperaturePoint,
} from './temperatureDetail';
import { resolveTodayExtremes } from './dailyExtremes';

// Juny: fora de l'hivern, la correcció d'inversió no hi toca i les xifres són les del model (excepte on es diu).
const hours = (day: string, from: number, n: number) =>
    Array.from({ length: n }, (_, i) => `${day}T${String(from + i).padStart(2, '0')}:00`);

const makeWeather = (over: Partial<Record<string, unknown>> = {}): ExtendedWeatherData => ({
    current: {
        time: '2026-06-10T12:15', temperature_2m: 24.6, apparent_temperature: 26.1, relative_humidity_2m: 55,
        wind_speed_10m: 8, is_day: 1, weather_code: 1, cloud_cover_low: 10, cloud_cover_mid: 0, cloud_cover_high: 0,
    },
    hourly: {
        time: hours('2026-06-10', 10, 8),
        temperature_2m: [21, 22, 24, 25, 26, 27, 25, 22],
        apparent_temperature: [21.5, 22.5, 25, 26.5, 27, 28.5, 25, 21],
        relative_humidity_2m: [60, 58, 55, 50, 48, 45, 50, 60],
        wind_speed_10m: [5, 6, 8, 10, 12, 12, 10, 8],
        is_day: [1, 1, 1, 1, 1, 1, 1, 1],
    },
    daily: { time: ['2026-06-10'], temperature_2m_max: [28], temperature_2m_min: [16] },
    location: { name: 'Girona', latitude: 41.98, longitude: 2.82 },
    ...over,
} as unknown as ExtendedWeatherData);

const pts = (temps: (number | null)[], feels?: (number | null)[]): TemperaturePoint[] =>
    temps.map((temp, i) => ({ time: `2026-06-10T${String(i).padStart(2, '0')}:00`, temp, feels: feels?.[i] ?? temp, isDay: true }));

describe('findCurrentHourIndex', () => {
    it('troba l\'hora actual comparant per hora (current.time porta minuts)', () => {
        expect(findCurrentHourIndex(hours('2026-06-10', 10, 8), '2026-06-10T12:15')).toBe(2);
    });
    it('-1 sense hora o amb dades estranyes', () => {
        expect(findCurrentHourIndex(hours('2026-06-10', 10, 2), '2026-06-11T12:15')).toBe(-1);
        expect(findCurrentHourIndex(null, '2026-06-10T12:15')).toBe(-1);
        expect(findCurrentHourIndex(hours('2026-06-10', 10, 2), undefined)).toBe(-1);
    });
});

describe('buildTemperatureWindow', () => {
    it('comença a l\'hora actual i "ara" és la lectura de current (la de la capçalera), no l\'hora en punt', () => {
        const w = buildTemperatureWindow(makeWeather(), 48);
        expect(w).toHaveLength(6); // de les 12 h a les 17 h: no n'hi ha més
        expect(w[0].time).toBe('2026-06-10T12:00');
        expect(w[0].temp).toBe(24.6);
        expect(w[0].feels).toBe(26.1);
        expect(w[1].temp).toBe(25);
        expect(w[1].feels).toBe(26.5);
    });

    it('talla la finestra a les hores demanades', () => {
        expect(buildTemperatureWindow(makeWeather(), 3).map(p => p.time.slice(11, 13))).toEqual(['12', '13', '14']);
    });

    it('una hora sense dada és null (mai un 0 °C fals)', () => {
        const base = makeWeather();
        const w = buildTemperatureWindow({
            ...base,
            hourly: { ...base.hourly, temperature_2m: [21, 22, 24, null, 26, 27, 25, 22], apparent_temperature: [21, 22, 24, 25, null, 27, 25, 22] },
        } as ExtendedWeatherData, 48);
        expect(w[1].temp).toBeNull();
        expect(w[2].feels).toBeNull();
        expect(w[2].temp).toBe(26);
    });

    it('sense l\'hora actual a les dades horàries, buida', () => {
        const base = makeWeather();
        expect(buildTemperatureWindow({ ...base, current: { ...base.current, time: '2026-06-12T09:00' } } as ExtendedWeatherData, 48)).toEqual([]);
        expect(buildTemperatureWindow(null, 48)).toEqual([]);
    });

    it('a l\'hivern, de nit, en calma i serè, la sensació baixa tant com la temperatura (correcció d\'inversió)', () => {
        const w = buildTemperatureWindow(makeWeather({
            current: { time: '2026-01-15T03:10', temperature_2m: 2, apparent_temperature: 0, relative_humidity_2m: 90, wind_speed_10m: 0, is_day: 1, weather_code: 0 },
            hourly: {
                time: hours('2026-01-15', 3, 2),
                temperature_2m: [2, 1], apparent_temperature: [0, -1], relative_humidity_2m: [90, 92],
                wind_speed_10m: [0, 0], is_day: [0, 0], cloud_cover_low: [0, 0], cloud_cover_mid: [0, 0], cloud_cover_high: [0, 0],
            },
        }), 48);
        // Hora de les 4 h: vent 0 -> correcció sencera (1,75 °C) a la temperatura i a la sensació.
        expect(w[1].temp).toBeCloseTo(1 - 1.75, 5);
        expect(w[1].feels).toBeCloseTo(-1 - 1.75, 5);
        // La diferència entre totes dues (l'efecte del vent i la humitat) és la del model.
        expect((w[1].feels as number) - (w[1].temp as number)).toBeCloseTo(-2, 5);
    });
});

describe('summarizeTemperature', () => {
    it('extrems, tendència a 3 h i canvi més brusc', () => {
        const s = summarizeTemperature(pts([20, 19, 17, 14, 12, 12, 13, 18]));
        expect(s.min).toMatchObject({ value: 12, index: 4 }); // en empat, la més propera
        expect(s.max).toMatchObject({ value: 20, index: 0 });
        expect(s.trend3h).toBe(-6);
        expect(s.steepest3h).toEqual({ fromIndex: 1, toIndex: 4, delta: -7 }); // 19 -> 12
    });

    it('les hores sense dada no compten', () => {
        const s = summarizeTemperature(pts([null, 5, null, -1, 0, null]));
        expect(s.min?.value).toBe(-1);
        expect(s.trend3h).toBeNull();
        expect(s.frostHours).toBe(2); // -1 i 0
        expect(s.firstFrost).toMatchObject({ value: -1, index: 3 });
    });

    it('hores de calor i sensació extrema', () => {
        const s = summarizeTemperature(pts([29, 31, 33, 30, 27], [30, 34, 37, 32, 28]));
        expect(s.heatHours).toBe(3);
        expect(s.firstHeat?.index).toBe(1);
        expect(s.feelsMax).toMatchObject({ value: 37, index: 2 });
        expect(s.frostHours).toBe(0);
        expect(s.firstFrost).toBeNull();
    });

    it('finestra buida', () => {
        const s = summarizeTemperature([]);
        expect(s.min).toBeNull();
        expect(s.max).toBeNull();
        expect(s.trend3h).toBeNull();
        expect(s.steepest3h).toBeNull();
    });
});

describe('classificacions', () => {
    it('tendència: estable per sota d\'1 °C en 3 h', () => {
        expect(classifyTemperatureTrend(null)).toBe('steady');
        expect(classifyTemperatureTrend(0.9)).toBe('steady');
        expect(classifyTemperatureTrend(-0.9)).toBe('steady');
        expect(classifyTemperatureTrend(1)).toBe('rising');
        expect(classifyTemperatureTrend(-2.5)).toBe('falling');
    });

    it('franja tèrmica amb les vores del text de l\'anàlisi (aiContext)', () => {
        expect(getThermalBand(0)).toBe('freezing');
        expect(getThermalBand(0.1)).toBe('cold');
        expect(getThermalBand(10)).toBe('cool');
        expect(getThermalBand(15)).toBe('mild');
        expect(getThermalBand(25)).toBe('warm');
        expect(getThermalBand(30)).toBe('hot');
        expect(getThermalBand(35)).toBe('extreme');
    });

    it('causa de la sensació, només quan és evident', () => {
        expect(getFeelsCause(10, 9.5, 30, 50)).toBe('none');
        expect(getFeelsCause(10, 6, 25, 50)).toBe('wind');
        expect(getFeelsCause(10, 8, 4, 50)).toBe('colder');
        expect(getFeelsCause(28, 31, 5, 70)).toBe('humidity');
        expect(getFeelsCause(12, 14, 5, 80)).toBe('warmer'); // humit però fresc: no és xafogor
        expect(getFeelsCause(null, 8, 4, 50)).toBe('none');
    });

    it('posició dins el rang', () => {
        expect(positionInRange(15, 10, 20)).toBe(0.5);
        expect(positionInRange(25, 10, 20)).toBe(1);
        expect(positionInRange(12, 12, 12)).toBe(0.5);
        expect(positionInRange(null, 10, 20)).toBeNull();
    });

    it('unitats: una diferència no porta el +32', () => {
        expect(toUserTemp(10, 'C')).toBe(10);
        expect(toUserTemp(10, 'F')).toBe(50);
        expect(toUserTempDelta(5, 'F')).toBe(9);
        expect(toUserTempDelta(5, 'C')).toBe(5);
    });
});

describe('resolveTodayExtremes (font única de la capçalera i del giny)', () => {
    it('amb hores d\'avui, els extrems surten de les hores (no del diari del model global)', () => {
        expect(resolveTodayExtremes(makeWeather())).toEqual({ max: 27, min: 21 });
    });
    it('sense dia, el diari tal com ve (o null)', () => {
        const base = makeWeather();
        expect(resolveTodayExtremes({ ...base, daily: { time: [], temperature_2m_max: [28], temperature_2m_min: [16] } } as unknown as ExtendedWeatherData))
            .toEqual({ max: 28, min: 16 });
        expect(resolveTodayExtremes(null)).toEqual({ max: null, min: null });
    });
});
