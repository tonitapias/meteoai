// src/utils/hourlyChartSeries.test.ts
import { describe, it, expect } from 'vitest';
import { buildHourlyChartSeries, findNowIndex } from './hourlyChartSeries';
import { getInversionCorrectedTemp, MAX_INVERSION_CORRECTION_C } from './rules/temperatureCorrections';
import { calculateSnowLevel } from './rules/winterRules';
import type { ExtendedWeatherData, StrictCurrentWeather } from '../types/weatherLogicTypes';

const HOURS = 6;
const timesOf = (date: string) => Array.from({ length: HOURS }, (_, i) => `${date}T${String(i).padStart(2, '0')}:00`);
const fillArr = <T,>(v: T) => Array.from({ length: HOURS }, () => v);
const idx = Array.from({ length: HOURS }, (_, i) => i);

type Hourly = Record<string, unknown>;
type Row = Record<string, unknown>;

// Nit d'hivern serena i en calma a Girona: el cas en què la correcció d'inversió resta el seu màxim (MAX_INVERSION_CORRECTION_C).
const calmClearNight = (over: Hourly = {}): Hourly => ({
    time: timesOf('2026-01-15'),
    temperature_2m: fillArr(5),
    is_day: fillArr(0),
    wind_speed_10m: fillArr(0),
    wind_gusts_10m: fillArr(4),
    cloud_cover_low: fillArr(0),
    cloud_cover_mid: fillArr(0),
    cloud_cover_high: fillArr(0),
    precipitation: fillArr(0),
    precipitation_probability: fillArr(10),
    freezing_level_height: fillArr(1500),
    ...over
});

const modelRows = (over: Row = {}): Row[] =>
    Array.from({ length: HOURS }, () => ({
        temperature_2m: 6,
        is_day: 0,
        wind_speed_10m: 0,
        cloud_cover_low: 0,
        cloud_cover_mid: 0,
        cloud_cover_high: 0,
        precipitation: 0,
        precipitation_probability: 20,
        wind_gusts_10m: 5,
        freezing_level_height: 1800,
        ...over
    }));

const makeData = (hourly: Hourly, comparison?: Partial<Record<'ecmwf' | 'gfs' | 'icon' | 'aifs', Row[]>>, latitude = 41.98) =>
    ({
        location: { name: 'Test', latitude, longitude: 2.82 },
        hourly,
        hourlyComparison: comparison
            ? { ecmwf: [], gfs: [], icon: [], aifs: [], ...comparison }
            : undefined
    }) as unknown as ExtendedWeatherData;

const forecast24hFormula = (temp: number, isDay: number, wind: number, low: number, mid: number, high: number, time: string, lat?: number) =>
    getInversionCorrectedTemp(
        { temperature_2m: temp, is_day: isDay, wind_speed_10m: wind, cloud_cover_low: low, cloud_cover_mid: mid, cloud_cover_high: high } as unknown as StrictCurrentWeather,
        parseInt(time.slice(5, 7), 10) - 1,
        lat
    );

describe('buildHourlyChartSeries', () => {
    describe('temperatura principal: mateixa correcció que la resta de l\'app', () => {
        it('resta la inversió tèrmica en una nit d\'hivern serena i en calma (5° → 3,25°)', () => {
            const { primary } = buildHourlyChartSeries(makeData(calmClearNight()), idx, 'C');
            expect(primary).toHaveLength(HOURS);
            expect(primary[0].temp).toBeCloseTo(5 - MAX_INVERSION_CORRECTION_C, 5);
        });

        it('dona exactament el que dona Forecast24h/DayDetail (mateixa funció, mateixos paràmetres)', () => {
            const data = makeData(calmClearNight({ wind_speed_10m: fillArr(3) }));
            const { primary } = buildHourlyChartSeries(data, idx, 'C');
            expect(primary[2].temp).toBeCloseTo(forecast24hFormula(5, 0, 3, 0, 0, 0, '2026-01-15T02:00', 41.98), 5);
        });

        it.each([
            ['de dia', { is_day: fillArr(1) }],
            ['amb vent', { wind_speed_10m: fillArr(12) }],
            ['amb el cel cobert', { cloud_cover_low: fillArr(80) }],
            ['a l\'estiu', { time: timesOf('2026-07-15') }]
        ])('no corregeix res %s', (_label, over) => {
            const { primary } = buildHourlyChartSeries(makeData(calmClearNight(over)), idx, 'C');
            expect(primary[0].temp).toBe(5);
        });

        it('a l\'Hemisferi Sud l\'hivern és maig-setembre: setembre a Buenos Aires sí que corregeix', () => {
            const south = makeData(calmClearNight({ time: timesOf('2026-09-21') }), undefined, -34.6);
            expect(buildHourlyChartSeries(south, idx, 'C').primary[0].temp).toBeCloseTo(5 - MAX_INVERSION_CORRECTION_C, 5);
            const north = makeData(calmClearNight({ time: timesOf('2026-09-21') }), undefined, 41.98);
            expect(buildHourlyChartSeries(north, idx, 'C').primary[0].temp).toBe(5);
        });

        it('la conversió a °F és posterior a la correcció (5° − 1,75° = 3,25° → 38°F)', () => {
            const { primary } = buildHourlyChartSeries(makeData(calmClearNight()), idx, 'F');
            expect(primary[0].temp).toBe(Math.round((5 - MAX_INVERSION_CORRECTION_C) * 9 / 5 + 32));
        });
    });

    describe('DOCTRINA RISC ZERO: el que falta és null, mai un 0 fals ni la dada d\'un altre model', () => {
        it('una hora sense temperatura és null encara que un model en tingui', () => {
            const hourly = calmClearNight({ temperature_2m: [5, 5, null, 5, 5, 5] });
            const { primary } = buildHourlyChartSeries(makeData(hourly, { gfs: modelRows({ temperature_2m: 9 }) }), idx, 'C');
            expect(primary[2].temp).toBeNull();
            expect(primary[1].temp).not.toBeNull();
        });

        it('sense probabilitat, volum ni ràfegues a la sèrie, són null (no 0 %, 0 mm, 0 km/h)', () => {
            const hourly = calmClearNight();
            delete hourly.precipitation_probability;
            delete hourly.precipitation;
            delete hourly.wind_gusts_10m;
            const { primary } = buildHourlyChartSeries(makeData(hourly, { ecmwf: modelRows() }), idx, 'C');
            primary.forEach(p => {
                expect(p.rain).toBeNull();
                expect(p.precip).toBeNull();
                expect(p.gusts).toBeNull();
            });
        });

        it('un 0 real es manté com a 0 (0 mm i 0 % són valors, no absències)', () => {
            const { primary } = buildHourlyChartSeries(makeData(calmClearNight({ precipitation: fillArr(0), precipitation_probability: fillArr(0) })), idx, 'C');
            expect(primary[0].precip).toBe(0);
            expect(primary[0].rain).toBe(0);
        });

        it('sense dades de temps o sense weatherData no peta: sèrie buida', () => {
            expect(buildHourlyChartSeries(null, idx, 'C')).toEqual({ primary: [], comparison: null });
            expect(buildHourlyChartSeries(makeData({}), idx, 'C')).toEqual({ primary: [], comparison: null });
        });

        it('una hora sense marca de temps es descarta de TOTES les sèries (segueixen alineades)', () => {
            const hourly = calmClearNight({ time: ['2026-01-15T00:00', null, '2026-01-15T02:00', '2026-01-15T03:00', '2026-01-15T04:00', '2026-01-15T05:00'] });
            const { primary, comparison } = buildHourlyChartSeries(makeData(hourly, { gfs: modelRows() }), idx, 'C');
            expect(primary).toHaveLength(HOURS - 1);
            expect(comparison?.gfs).toHaveLength(HOURS - 1);
            expect(comparison?.gfs.map(p => p.time)).toEqual(primary.map(p => p.time));
        });
    });

    describe('models de comparació', () => {
        it('cada model queda alineat hora a hora: un forat és un null a la seva posició, no desplaça les altres', () => {
            const rows = modelRows();
            rows[2] = { ...rows[2], temperature_2m: null, precipitation: null, wind_speed_10m: null };
            rows[4] = { ...rows[4], temperature_2m: 11 };
            const { primary, comparison } = buildHourlyChartSeries(makeData(calmClearNight(), { gfs: rows }), idx, 'C');
            expect(comparison?.gfs).toHaveLength(primary.length);
            expect(comparison?.gfs[2].temp).toBeNull();
            expect(comparison?.gfs[4].temp).toBeCloseTo(11 - MAX_INVERSION_CORRECTION_C, 5);
            expect(comparison?.gfs.map(p => p.time)).toEqual(primary.map(p => p.time));
        });

        it('cada model es corregeix amb el SEU vent: amb ventada no hi ha inversió, amb calma sí', () => {
            const { comparison } = buildHourlyChartSeries(
                makeData(calmClearNight(), {
                    gfs: modelRows({ temperature_2m: 6, wind_speed_10m: 20 }),
                    icon: modelRows({ temperature_2m: 6, wind_speed_10m: 0 })
                }),
                idx,
                'C'
            );
            expect(comparison?.gfs[0].temp).toBe(6);
            expect(comparison?.icon[0].temp).toBeCloseTo(6 - MAX_INVERSION_CORRECTION_C, 5);
        });

        it('si un model no publica capes de núvols o vent, s\'usen les de la línia principal en aquella hora', () => {
            const rows = modelRows({ cloud_cover_low: null, cloud_cover_mid: null, cloud_cover_high: null, wind_speed_10m: null });
            const cloudyPrimary = calmClearNight({ cloud_cover_low: fillArr(90) });
            const { comparison } = buildHourlyChartSeries(makeData(cloudyPrimary, { aifs: rows }), idx, 'C');
            // El cel de la principal està cobert → no hi ha inversió → valor cru.
            expect(comparison?.aifs[0].temp).toBe(6);
            // ...però el vent i el volum que s'ensenyen del model segueixen sent NOMÉS els seus (null).
            expect(comparison?.aifs[0].wind).toBeNull();
        });

        it('AIFS no publica probabilitat de pluja ni cota de neu: queden a null, no a 0', () => {
            const aifs = modelRows({ precipitation_probability: undefined, freezing_level_height: undefined, wind_gusts_10m: undefined });
            const { comparison } = buildHourlyChartSeries(makeData(calmClearNight(), { aifs }), idx, 'C');
            comparison?.aifs.forEach(p => {
                expect(p.rain).toBeNull();
                expect(p.snowLevel).toBeNull();
                expect(p.gusts).toBeNull();
                expect(p.temp).not.toBeNull();
            });
        });

        it('un model sense cap dada és una sèrie buida; si cap model en té, comparison és null', () => {
            const empty = Array.from({ length: HOURS }, () => ({}));
            const some = buildHourlyChartSeries(makeData(calmClearNight(), { gfs: modelRows(), icon: empty }), idx, 'C');
            expect(some.comparison?.gfs).toHaveLength(HOURS);
            expect(some.comparison?.icon).toEqual([]);
            expect(some.comparison?.ecmwf).toEqual([]);

            const none = buildHourlyChartSeries(makeData(calmClearNight(), { gfs: empty, icon: empty }), idx, 'C');
            expect(none.comparison).toBeNull();
            expect(buildHourlyChartSeries(makeData(calmClearNight()), idx, 'C').comparison).toBeNull();
        });
    });

    describe('isDay i "ara"', () => {
        it("cada punt porta si és de dia o de nit (la principal, del seu is_day; un model, del seu o el de la principal)", () => {
            const flags = [0, 0, 1, 1, 0, 0];
            const rows = modelRows().map((r, i) => (i === 3 ? { ...r, is_day: null } : { ...r, is_day: flags[i] }));
            const { primary, comparison } = buildHourlyChartSeries(makeData(calmClearNight({ is_day: flags }), { gfs: rows }), idx, 'C');
            expect(primary.map(p => p.isDay)).toEqual([false, false, true, true, false, false]);
            // A l'índex 3 el model no publica is_day: hereta el de la principal (de dia).
            expect(comparison?.gfs.map(p => p.isDay)).toEqual([false, false, true, true, false, false]);
        });

        it("findNowIndex troba l'hora actual per hora (no per minut) i és null si no hi és", () => {
            const points = timesOf('2026-01-15').map(time => ({ time }));
            expect(findNowIndex(points, '2026-01-15T03:45')).toBe(3);
            expect(findNowIndex(points, '2026-01-15T03:00')).toBe(3);
            expect(findNowIndex(points, '2026-01-16T03:00')).toBeNull();
            expect(findNowIndex(points, undefined)).toBeNull();
            expect(findNowIndex(points, '2026-01')).toBeNull();
            expect(findNowIndex([], '2026-01-15T03:00')).toBeNull();
        });
    });

    describe('procedència: hores de la línia principal que vénen d\'un model regional', () => {
        it('marca `regional` només a les hores amb la marca de proveïdor regional; els models mai', () => {
            const hourly = calmClearNight({ regional_temperature_2m: [1, 1, 1, null, null, null] });
            const { primary, comparison } = buildHourlyChartSeries(makeData(hourly, { gfs: modelRows() }), idx, 'C');
            expect(primary.map(p => p.regional)).toEqual([true, true, true, false, false, false]);
            expect(comparison?.gfs.every(p => p.regional === false)).toBe(true);
        });

        it('sense la marca, cap hora és regional', () => {
            const { primary } = buildHourlyChartSeries(makeData(calmClearNight()), idx, 'C');
            expect(primary.every(p => p.regional === false)).toBe(true);
        });
    });

    describe('cota de neu', () => {
        it('la línia principal cau a ECMWF → GFS → ICON quan no en té (els regionals no la publiquen)', () => {
            const hourly = calmClearNight();
            delete hourly.freezing_level_height;
            const { primary } = buildHourlyChartSeries(
                makeData(hourly, {
                    ecmwf: modelRows({ freezing_level_height: null }),
                    gfs: modelRows({ freezing_level_height: 2000 }),
                    icon: modelRows({ freezing_level_height: 2500 })
                }),
                idx,
                'C'
            );
            expect(primary[0].snowLevel).toBe(calculateSnowLevel(2000));
        });

        it('cada model dibuixa la SEVA cota (mai la d\'un altre), i sense cota no hi ha línia', () => {
            const { comparison } = buildHourlyChartSeries(
                makeData(calmClearNight(), {
                    ecmwf: modelRows({ freezing_level_height: null }),
                    gfs: modelRows({ freezing_level_height: 2000 })
                }),
                idx,
                'C'
            );
            expect(comparison?.ecmwf[0].snowLevel).toBeNull();
            expect(comparison?.gfs[0].snowLevel).toBe(calculateSnowLevel(2000));
        });
    });

    describe('coherència entre pantalles', () => {
        it('la mateixa hora dóna el mateix valor tant si es demana en una finestra de 24 h com en la d\'un dia', () => {
            const data = makeData(
                calmClearNight({ temperature_2m: [5, 4, 3, 2, 1, 0], wind_speed_10m: [0, 1, 2, 3, 4, 5] }),
                { gfs: modelRows(), icon: modelRows() }
            );
            const wide = buildHourlyChartSeries(data, [0, 1, 2, 3, 4, 5], 'C');
            const narrow = buildHourlyChartSeries(data, [3, 4], 'C');
            expect(narrow.primary[0]).toEqual(wide.primary[3]);
            expect(narrow.comparison?.gfs[1]).toEqual(wide.comparison?.gfs[4]);
        });

        it('no muta les dades d\'entrada', () => {
            const data = makeData(calmClearNight(), { gfs: modelRows() });
            const before = JSON.stringify(data);
            buildHourlyChartSeries(data, idx, 'F');
            expect(JSON.stringify(data)).toBe(before);
        });
    });
});
