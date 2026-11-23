import { describe, it, expect } from 'vitest';
import {
    buildDayColumn, findDryWindow, isNotableGust, isWetHour, temperatureScale, hourFraction, rowOffsetOf,
    type DayColumnRow
} from './dayColumn';
import type { HourlyChartPoint } from './hourlyChartSeries';
import type { SkyKind } from './daySky';

const DATE = '2026-11-24';
const TIMES = Array.from({ length: 24 }, (_, h) => `${DATE}T${String(h).padStart(2, '0')}:00`);

const point = (time: string, temp: number | null, extra: Partial<HourlyChartPoint> = {}): HourlyChartPoint => ({
    time, temp, rain: 0, precip: 0, wind: 5, gusts: 10, snowLevel: null, regional: false, isDay: true, ...extra
});

const hourlyOf = (overrides: Record<string, unknown[]> = {}) => ({
    time: TIMES,
    temperature_2m: TIMES.map(() => 14),
    is_day: TIMES.map((_, h) => (h >= 8 && h < 18 ? 1 : 0)),
    weather_code: TIMES.map(() => 0),
    cloud_cover_low: TIMES.map(() => 0), cloud_cover_mid: TIMES.map(() => 0), cloud_cover_high: TIMES.map(() => 0),
    precipitation: TIMES.map(() => 0),
    precipitation_probability: TIMES.map(() => 0),
    wind_speed_10m: TIMES.map(() => 5),
    wind_direction_10m: TIMES.map(() => 320),
    apparent_temperature: TIMES.map(() => 13),
    ...overrides
});

const INDICES = TIMES.map((_, i) => i);

describe('buildDayColumn', () => {
    it("una fila per hora, amb la temperatura de la línia principal (la del gràfic) i l'hora de la data", () => {
        const primary = TIMES.map((t, h) => point(t, 10 + h / 2));
        const rows = buildDayColumn({ hourly: hourlyOf(), dayIndices: INDICES, primary, comparison: null, elevation: 0, unit: 'C' });
        expect(rows).toHaveLength(24);
        expect(rows[0].hour).toBe(0);
        expect(rows[23].hour).toBe(23);
        expect(rows[6].temp).toBe(13);
        expect(rows[6].windDir).toBe(320);
    });

    it('el cel surt dels codis del motor: pluja a les hores de pluja', () => {
        const hourly = hourlyOf({
            weather_code: TIMES.map((_, h) => (h === 15 ? 61 : 0)),
            precipitation: TIMES.map((_, h) => (h === 15 ? 1.2 : 0)),
            precipitation_probability: TIMES.map((_, h) => (h === 15 ? 80 : 0)),
        });
        const primary = TIMES.map(t => point(t, 14));
        const rows = buildDayColumn({ hourly, dayIndices: INDICES, primary, comparison: null, elevation: 0, unit: 'C' });
        expect(rows[15].kind).toBe('rain');
        expect(rows[10].kind).toBe('clear');
    });

    it('el marge entre models només hi és amb dos models o més a aquella hora', () => {
        const primary = TIMES.map(t => point(t, 14));
        const comparison = {
            ecmwf: TIMES.map(t => point(t, 9)),
            gfs: TIMES.map((t, h) => point(t, h === 3 ? null : 15)),
            icon: [],
        };
        const rows = buildDayColumn({ hourly: hourlyOf(), dayIndices: INDICES, primary, comparison, elevation: 0, unit: 'C' });
        expect(rows[0].bandLow).toBe(9);
        expect(rows[0].bandHigh).toBe(15);
        // A les 3 h només en queda un (ECMWF): no hi ha marge que dibuixar.
        expect(rows[3].bandLow).toBeNull();
        expect(rows[3].bandHigh).toBeNull();
    });

    it('la sensació tèrmica només hi és quan se separa 3° o més de la temperatura', () => {
        const hourly = hourlyOf({ apparent_temperature: TIMES.map((_, h) => (h === 7 ? 9 : 12)) });
        const primary = TIMES.map(t => point(t, 14));
        const rows = buildDayColumn({ hourly, dayIndices: INDICES, primary, comparison: null, elevation: 0, unit: 'C' });
        expect(rows[7].feels).toBe(9);
        expect(rows[8].feels).toBeNull(); // 12° contra 14°: no es nota prou
    });

    it('en Fahrenheit la sensació es compara en graus Celsius i es mostra en F', () => {
        const hourly = hourlyOf({ apparent_temperature: TIMES.map(() => 10) });
        const primary = TIMES.map(t => point(t, 59)); // 15 °C
        const rows = buildDayColumn({ hourly, dayIndices: INDICES, primary, comparison: null, elevation: 0, unit: 'F' });
        expect(rows[0].feels).toBeCloseTo(50);
    });

    it("la ratxa només hi és quan és notable; una dada que falta queda null (cap 0 fals)", () => {
        const primary = TIMES.map((t, h) => point(t, h === 5 ? null : 14, { gusts: h === 12 ? 48 : 12, wind: h === 20 ? null : 6 }));
        const rows = buildDayColumn({ hourly: hourlyOf(), dayIndices: INDICES, primary, comparison: null, elevation: 0, unit: 'C' });
        expect(rows[12].gust).toBe(48);
        expect(rows[11].gust).toBeNull();
        expect(rows[5].temp).toBeNull();
    });
});

describe('isNotableGust', () => {
    it('a partir de 40 km/h sempre', () => {
        expect(isNotableGust(40, 35)).toBe(true);
        expect(isNotableGust(39, 35)).toBe(false);
    });
    it('o 15 km/h per sobre del vent mitjà, si ja passa de 25', () => {
        expect(isNotableGust(30, 12)).toBe(true);
        expect(isNotableGust(30, 18)).toBe(false);
        expect(isNotableGust(20, 2)).toBe(false); // +18, però és una brisa
    });
    it('sense ratxa no és notable', () => {
        expect(isNotableGust(null, 10)).toBe(false);
    });
});

// Barcelona, dimarts 24/11/2026: pluja fins a les 2, ruixat de 15 a 17 i pluja de 19 a 23.
const SKY = 'rrpoppnpPPOOOOORROorrrrp';
const KIND: Record<string, SkyKind> = { r: 'rain', R: 'rain', p: 'partly', P: 'partly', o: 'cloudy', O: 'cloudy', n: 'clear' };
const MM = [0.3, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.1, 0, 0, 0.1, 0.2, 0.5, 0.1, 0];
const rowOf = (hour: number, kind: SkyKind | null, precip = 0): DayColumnRow => ({
    time: `${DATE}T${String(hour).padStart(2, '0')}:00`, hour, kind, isDay: true, temp: 14, feels: null,
    bandLow: null, bandHigh: null, precipProb: 0, precip, snowfall: 0, wind: 5, windDir: null, gust: null
});
const barcelona = () => SKY.split('').map((c, h) => rowOf(h, KIND[c], MM[h]));

describe('findDryWindow', () => {
    it('el tram sec més llarg del dia: de les 2 a les 15 h (13 h)', () => {
        expect(findDryWindow(barcelona())).toEqual({ firstRow: 2, lastRow: 14, from: 2, to: 15, hours: 13 });
    });

    it('un dia sense pluja no té finestra seca (ja ho diu la columna)', () => {
        expect(findDryWindow(TIMES.map((_, h) => rowOf(h, 'clear')))).toBeNull();
    });

    it('massa curta (menys de 3 h) no surt', () => {
        const rows = TIMES.map((_, h) => rowOf(h, h % 3 === 0 ? 'rain' : 'cloudy', h % 3 === 0 ? 0.4 : 0));
        expect(findDryWindow(rows)).toBeNull();
    });

    it('una hora sense dades talla el tram', () => {
        const rows = barcelona();
        rows[5] = rowOf(5, null);
        expect(findDryWindow(rows)).toEqual({ firstRow: 6, lastRow: 14, from: 6, to: 15, hours: 9 });
    });

    it("pluja sense codi de pluja (només mm) també és una hora mullada", () => {
        expect(isWetHour(rowOf(3, 'cloudy', 0.2))).toBe(true);
        expect(isWetHour({ kind: 'cloudy', precip: 0, snowfall: 0.5 })).toBe(true);
        expect(isWetHour(rowOf(3, 'cloudy', 0))).toBe(false);
    });

    it('un tram que arriba a mitjanit acaba a les 24 h', () => {
        const rows = TIMES.map((_, h) => rowOf(h, h < 4 ? 'rain' : 'cloudy', h < 4 ? 1 : 0));
        expect(findDryWindow(rows)).toMatchObject({ from: 4, to: 24, hours: 20 });
    });
});

describe('temperatureScale', () => {
    it("hi caben la temperatura, la sensació i el marge de totes les hores, i les guies són múltiples del pas", () => {
        const rows = [rowOf(0, 'clear'), rowOf(1, 'clear')];
        rows[0] = { ...rows[0], temp: 12, bandLow: 7.1, bandHigh: 13.1 };
        rows[1] = { ...rows[1], temp: 16, feels: 17.5 };
        const scale = temperatureScale(rows)!;
        expect(scale.min).toBeCloseTo(7.1);
        expect(scale.max).toBeCloseTo(17.5);
        expect(scale.ticks).toEqual([8, 12, 16]);
    });

    it("un dia gairebé pla s'eixampla fins a 8° perquè 2° no semblin 20", () => {
        const rows = [{ ...rowOf(0, 'clear'), temp: 14 }, { ...rowOf(1, 'clear'), temp: 15 }];
        const scale = temperatureScale(rows)!;
        expect(scale.max - scale.min).toBe(8);
        expect(scale.min).toBeCloseTo(10.5);
    });

    it('sense cap temperatura no hi ha escala', () => {
        expect(temperatureScale([{ ...rowOf(0, 'clear'), temp: null }])).toBeNull();
    });
});

describe('hourFraction i rowOffsetOf', () => {
    it("llegeix l'hora d'un ISO sense passar per Date", () => {
        expect(hourFraction('2026-11-24T07:49')).toBeCloseTo(7 + 49 / 60);
        expect(hourFraction(undefined)).toBeNull();
        expect(hourFraction('2026-11-24')).toBeNull();
    });

    it("troba la fila per l'hora (un dia de canvi d'hora no en té una per índex)", () => {
        const rows = barcelona().filter(r => r.hour !== 2); // 23 files: el dia que es perd una hora
        expect(rowOffsetOf(rows, 7.5)).toBeCloseTo(6.5);
        expect(rowOffsetOf(rows, 2.5)).toBeNull();
        expect(rowOffsetOf(rows, null)).toBeNull();
    });
});
