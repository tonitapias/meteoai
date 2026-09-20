import { describe, it, expect } from 'vitest';
import { injectHighResModels } from './regionalModelEngine';
import { generateHourlyChartData } from './weatherMappers';
import { hoursOfDate, resolveDailyExtremes } from './dailyExtremes';
import { REGIONAL_MODELS, REGIONAL_TEMP_FLAG_KEY } from '../constants/regionalModels';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const AROME_MODEL = REGIONAL_MODELS.find(m => m.id === 'AROME_HD')!;

// 48 hores (21 i 22 de setembre): 20° de nit i 28° de 10 a 16 h al model global.
const HOURS = Array.from({ length: 48 }, (_, i) => {
    const day = i < 24 ? '21' : '22';
    return `2026-09-${day}T${String(i % 24).padStart(2, '0')}:00`;
});
const globalTemp = (i: number) => (i % 24 >= 10 && i % 24 <= 16 ? 28 : 20);

const baseData = () => ({
    current: { temperature_2m: 20, is_day: 1, time: HOURS[0] },
    hourly: {
        time: [...HOURS],
        temperature_2m: HOURS.map((_, i) => globalTemp(i)),
        is_day: HOURS.map((_, i) => (i % 24 >= 7 && i % 24 <= 19 ? 1 : 0)),
    },
}) as unknown as ExtendedWeatherData;

// El model regional només arriba a les primeres 30 hores (tot el dia 21 i fins a les 05 h del 22) i és 3° més càlid.
const regionalData = (temps?: Array<number | null>) => {
    const times = HOURS.slice(0, 30);
    return {
        current: { temperature_2m: 23 },
        hourly: { time: times, temperature_2m: temps ?? times.map((_, i) => globalTemp(i) + 3) },
    } as unknown as ExtendedWeatherData;
};

const flag = (data: ExtendedWeatherData) =>
    (data.hourly as unknown as Record<string, Array<number | null>>)[REGIONAL_TEMP_FLAG_KEY];

describe('injectHighResModels — marca de procedència de la temperatura', () => {
    it('marca només les hores on el model regional ha escrit una temperatura', () => {
        const result = injectHighResModels(baseData(), regionalData(), AROME_MODEL);
        const f = flag(result);
        expect(f).toHaveLength(48);
        expect(f.slice(0, 30).every(v => v === 1)).toBe(true);
        expect(f.slice(30).every(v => v === null)).toBe(true);
    });

    it('una hora on el model regional no té temperatura (null) no es marca i conserva la global', () => {
        const temps = Array.from({ length: 30 }, (_, i) => (i === 3 ? null : 25));
        const result = injectHighResModels(baseData(), regionalData(temps), AROME_MODEL);
        expect(flag(result)[3]).toBeNull();
        expect(flag(result)[2]).toBe(1);
        expect(result.hourly.temperature_2m[3]).toBe(20);
    });

    it('sense model regional no s\'afegeix cap marca', () => {
        const base = baseData();
        expect(flag(injectHighResModels(base, null, AROME_MODEL))).toBeUndefined();
    });
});

describe('procedència de les extremes diàries (de la fusió a la previsió setmanal)', () => {
    const chartData = generateHourlyChartData(injectHighResModels(baseData(), regionalData(), AROME_MODEL), 0, 'C');

    it('el chart horari diu quines hores tenen temperatura regional', () => {
        expect(chartData.slice(0, 30).every(h => h.regionalTemp === true)).toBe(true);
        expect(chartData.slice(30).every(h => h.regionalTemp === false)).toBe(true);
    });

    it('un dia sencer del model regional en té regionals la màxima (31°) i la mínima (23°)', () => {
        const d = resolveDailyExtremes(null, null, hoursOfDate(chartData, '2026-09-21'));
        expect(d).toMatchObject({ max: 31, maxRegional: true, min: 23, minRegional: true });
    });

    it('un dia només regional a la matinada (fins a les 05 h) és del model global: les extremes surten de la resta del dia', () => {
        const d = resolveDailyExtremes(null, null, hoursOfDate(chartData, '2026-09-22'));
        expect(d).toMatchObject({ max: 28, maxRegional: false, min: 20, minRegional: false });
    });

    it('amb dades sense la marca (p. ex. caché d\'abans) cap hora no es considera regional', () => {
        const old = generateHourlyChartData(baseData(), 0, 'C');
        expect(old.every(h => h.regionalTemp === false)).toBe(true);
    });

    it('una temperatura de reserva (d\'un altre model) no es marca com a regional', () => {
        // Sense temperatura primària a cap hora: el mapper la treu d'ECMWF; encara que la marca digués 1, no és regional.
        const data = baseData();
        (data.hourly as unknown as Record<string, unknown>).temperature_2m = HOURS.map(() => null);
        (data.hourly as unknown as Record<string, unknown>)[REGIONAL_TEMP_FLAG_KEY] = HOURS.map(() => 1);
        (data as unknown as Record<string, unknown>).hourlyComparison = {
            ecmwf: HOURS.map(() => ({ temperature_2m: 18 })), gfs: [], icon: [], aifs: [],
        };
        const rows = generateHourlyChartData(data, 0, 'C');
        expect(rows[0]).toMatchObject({ temp: 18, tempSource: 'ecmwf', regionalTemp: false });
    });
});
