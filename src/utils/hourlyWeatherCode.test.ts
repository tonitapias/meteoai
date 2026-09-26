import { describe, it, expect } from 'vitest';
import { getHourlyWeatherCode, getHourCodesByDate, resolveFreezingLevel, resolveIsDay } from './hourlyWeatherCode';
import { buildRegionalHourlyRows } from './regionalHourlyRows';
import { getInversionCorrectedTemp, MAX_INVERSION_CORRECTION_C } from './rules/temperatureCorrections';
import type { ExtendedWeatherData, StrictCurrentWeather } from '../types/weatherLogicTypes';

// Sèrie horària mínima de 3 hores (00:00, 01:00, 02:00 del 2026-09-19)
const TIMES = ['2026-09-19T00:00', '2026-09-19T01:00', '2026-09-19T02:00'];

describe('resolveFreezingLevel', () => {
    it('usa el valor de la sèrie pròpia quan hi és', () => {
        const h = { freezing_level_height: [null, 3900, null] };
        expect(resolveFreezingLevel(h, 1, 500, 14)).toBe(3900);
    });

    it('recorre als models de comparació en ordre ecmwf → gfs → icon', () => {
        const h = { freezing_level_height: [null, null, null] };
        const cmp = {
            ecmwf: [{}, { freezing_level_height: null }, {}],
            gfs: [{}, { freezing_level_height: 3830 }, {}],
            icon: [{}, { freezing_level_height: 4010 }, {}]
        };
        expect(resolveFreezingLevel(h, 1, 500, 14, cmp)).toBe(3830);
    });

    it('extrapola amb 6,5 °C/km sense clamp com a últim recurs', () => {
        expect(resolveFreezingLevel({}, 0, 500, 13)).toBeCloseTo(500 + 13 / 0.0065, 5);
        // Fa prou fred perquè la isoterma quedi per sota de l'elevació: es reflecteix.
        expect(resolveFreezingLevel({}, 0, 500, -6)).toBeLessThan(500);
    });
});

describe('resolveIsDay', () => {
    it("l'is_day de l'API mana sobre l'aproximació per hora sencera", () => {
        // 07:00 amb sortida a les 07:35: l'API diu nit, l'heurística diria dia.
        expect(resolveIsDay({ is_day: [0] }, 0, () => true)).toBe(false);
        expect(resolveIsDay({ is_day: [1] }, 0, () => false)).toBe(true);
    });

    it("només usa la reserva si l'API no porta is_day", () => {
        expect(resolveIsDay({}, 0, () => true)).toBe(true);
        expect(resolveIsDay({ is_day: [null] }, 0, () => false)).toBe(false);
    });
});

describe('getHourlyWeatherCode', () => {
    const base = {
        time: TIMES,
        temperature_2m: [14, 14, 14],
        relative_humidity_2m: [99, 99, 99],   // saturat: T−Td ≈ 0,15 °C
        precipitation: [0, 0, 0],
        cloud_cover_low: [100, 100, 100],   // la boira n'implica una capa baixa (CLOUDS.FOG_MIN_LOW)
        cloud_cover_mid: [0, 0, 0],
        cloud_cover_high: [0, 0, 0],
        weather_code: [0, 0, 0],
        wind_speed_10m: [2, 2, 2]
    };

    it('retorna null si l\'hora no té temperatura real', () => {
        expect(getHourlyWeatherCode({ ...base, temperature_2m: [null, 14, 14] }, 0, 500)).toBeNull();
    });

    it('marca boira si la visibilitat de la sèrie és crítica i la saturació ho confirma', () => {
        expect(getHourlyWeatherCode({ ...base, visibility: [300, 300, 300] }, 0, 500)).toBe(45);
    });

    it('visibilitat crítica SENSE saturació (T−Td ≈ 0,8 °C) no marca boira', () => {
        const h = { ...base, relative_humidity_2m: [95, 95, 95], visibility: [300, 300, 300] };
        expect(getHourlyWeatherCode(h, 0, 500)).not.toBe(45);
    });

    it('sense visibilitat ni codi de boira NO fabrica boira', () => {
        expect(getHourlyWeatherCode({ ...base, visibility: [null, null, null] }, 0, 500)).not.toBe(45);
    });

    it('sense capa baixa al model (núvols baixos 20 %) la boira no es confirma', () => {
        const h = { ...base, cloud_cover_low: [20, 20, 20], visibility: [300, 300, 300] };
        expect(getHourlyWeatherCode(h, 0, 500)).not.toBe(45);
    });

    it('DOCTRINA RISC ZERO: sense dada de núvols baixos (null a la sèrie) la boira es manté', () => {
        const h = { ...base, cloud_cover_low: [null, null, null], visibility: [300, 300, 300] };
        expect(getHourlyWeatherCode(h, 0, 500)).toBe(45);
    });

    it('la mateixa sèrie saturada a T <= 0 °C dona boira GEBRADORA (48), no 45', () => {
        const h = { ...base, temperature_2m: [-3, -3, -3], visibility: [300, 300, 300] };
        expect(getHourlyWeatherCode(h, 0, 500)).toBe(48);
    });

    it('la pluja engelant del model (66) arriba intacta a una hora de superfície gelada', () => {
        const h = {
            ...base,
            temperature_2m: [-2, -2, -2],
            relative_humidity_2m: [92, 92, 92],
            precipitation: [1.2, 1.2, 1.2],
            cloud_cover_low: [100, 100, 100],
            weather_code: [66, 66, 66],
            freezing_level_height: [0, 0, 0]
        };
        expect(getHourlyWeatherCode(h, 0, 500)).toBe(66);
    });
});

describe('getHourCodesByDate', () => {
    const series = {
        time: ['2026-09-19T22:00', '2026-09-19T23:00', '2026-09-20T00:00', '2026-09-20T01:00', '2026-09-20T02:00'],
        temperature_2m: [15, 15, 14, null, 14],
        relative_humidity_2m: [60, 60, 60, 60, 60],
        precipitation: [0, 0, 1.2, 0, 0],
        cloud_cover_low: [50, 50, 100, 100, 50],
        cloud_cover_mid: [0, 0, 0, 0, 0],
        cloud_cover_high: [0, 0, 0, 0, 0],
        weather_code: [0, 0, 61, 3, 0],
        wind_speed_10m: [2, 2, 2, 2, 2]
    };

    it("agrupa els codis del motor per dia local i conserva l'ordre horari", () => {
        const out = getHourCodesByDate(series, 500);
        expect(Object.keys(out)).toEqual(['2026-09-19', '2026-09-20']);
        expect(out['2026-09-19']).toHaveLength(2);
        expect(out['2026-09-20']).toHaveLength(3);
    });

    it("cada codi és exactament el de getHourlyWeatherCode (mateixa font que l'evolució horària)", () => {
        const out = getHourCodesByDate(series, 500);
        const flat = [...out['2026-09-19'], ...out['2026-09-20']];
        flat.forEach((c, i) => expect(c).toBe(getHourlyWeatherCode(series, i, 500)));
    });

    it('una hora sense temperatura dona null (mai un codi inventat) i la pluja es filtra per mm', () => {
        const out = getHourCodesByDate(series, 500);
        expect(out['2026-09-20'][1]).toBeNull();
        expect(out['2026-09-20'][0]).toBe(61);
    });

    it('sense sèrie de temps torna un objecte buit', () => {
        expect(getHourCodesByDate({}, 0)).toEqual({});
        expect(getHourCodesByDate({ time: 'x' }, 0)).toEqual({});
    });
});

/**
 * REGRESSIÓ (informe d'usuari): el modal AROME no marcava boira però l'evolució
 * horària i "Previsió per hores" sí. Causa: AROME HD no publica weather_code,
 * visibility ni freezing_level_height; el modal els omplia amb marcadors i la resta
 * de l'app amb els valors del model global (ICON: boira, visibilitat < 1 km).
 * La mateixa hora ha de donar la mateixa icona en totes les pantalles.
 */
describe('buildRegionalHourlyRows — homogeneïtat amb la resta de l\'app', () => {
    // Sèrie crua d'AROME: sense weather_code, visibility ni freezing_level_height.
    // Saturada (T−Td < 0,5 °C): amb el senyal d'ICON, la boira ha de sortir a tot arreu.
    const arome = {
        time: TIMES,
        temperature_2m: [16.3, 15.7, 15.3],
        relative_humidity_2m: [99, 99, 98],
        precipitation: [0, 0, 0],
        cloud_cover_low: [0, 0, 0],
        cloud_cover_mid: [0, 0, 0],
        cloud_cover_high: [0, 0, 0],
        wind_speed_10m: [6, 6, 4],
        wind_gusts_10m: [10, 9, 8],
        wind_direction_10m: [200, 210, 220],
        cape: [0, 0, 0],
        weather_code: [null, null, null],
        visibility: [null, null, null],
        freezing_level_height: [null, null, null],
        is_day: [0, 0, 0]
    };

    // Dades combinades tal com les veuen Forecast24h/DayDetailModal: valors d'AROME on
    // n'hi ha; on no (weather_code, visibility, freezing_level_height) els d'ICON.
    const merged = {
        ...arome,
        cloud_cover_low: [100, 100, 100],   // la boira n'implica una capa baixa (CLOUDS.FOG_MIN_LOW)
        weather_code: [45, 45, 45],
        visibility: [1360, 840, 820],
        freezing_level_height: [3990, 4010, 4020]
    };
    const baseData = { elevation: 504, hourly: merged, hourlyComparison: {} } as unknown as ExtendedWeatherData;

    // 00:10 hora local (UTC+2) del 2026-09-19
    const now = new Date('2026-09-18T22:10:00Z');
    const args = { hourly: arome, elevation: 504, utcOffsetSeconds: 7200, latitude: 41.9, now };

    it('la icona de cada fila és exactament la que calcula la resta de l\'app', () => {
        const rows = buildRegionalHourlyRows({ ...args, baseData });
        expect(rows).toHaveLength(3);
        rows.forEach((row, i) => {
            expect(row.code).toBe(getHourlyWeatherCode(merged, i, 504, baseData.hourlyComparison));
            expect(row.code).toBe(45); // la boira és la mateixa a tot arreu
        });
    });

    it("la cota 0 °C mostrada és la real del model, no l'extrapolació de la temperatura", () => {
        const rows = buildRegionalHourlyRows({ ...args, baseData });
        expect(rows.map(r => r.freezingLevel)).toEqual([3990, 4010, 4020]);
    });

    it('sense dades combinades, calcula igualment sobre la sèrie crua (sense boira inventada)', () => {
        const rows = buildRegionalHourlyRows(args);
        expect(rows).toHaveLength(3);
        rows.forEach(r => expect(r.code).not.toBe(45));
    });

    it("descarta les hores ja passades a la ubicació", () => {
        // 01:30 hora local: la fila de les 00:00 ja no s'ha de mostrar
        const later = new Date('2026-09-18T23:30:00Z');
        const rows = buildRegionalHourlyRows({ ...args, baseData, now: later });
        expect(rows.map(r => r.hour)).toEqual([1, 2]);
    });

    it('la temperatura mostrada porta la mateixa correcció d\'inversió que la resta', () => {
        // Nit d'hivern, calma i cel serè: correcció màxima (MAX_INVERSION_CORRECTION_C) a l'app
        const winter = { ...arome, time: ['2026-01-10T00:00'], temperature_2m: [2], wind_speed_10m: [0], is_day: [0] };
        const rows = buildRegionalHourlyRows({
            hourly: winter, elevation: 504, utcOffsetSeconds: 3600, latitude: 41.9,
            now: new Date('2026-01-09T23:10:00Z')
        });
        const expected = getInversionCorrectedTemp(
            { temperature_2m: 2, is_day: 0, wind_speed_10m: 0, cloud_cover_low: 0, cloud_cover_mid: 0, cloud_cover_high: 0 } as unknown as StrictCurrentWeather,
            0, 41.9
        );
        expect(expected).toBeCloseTo(2 - MAX_INVERSION_CORRECTION_C, 5);
        expect(rows[0].temp).toBeCloseTo(expected, 5);
    });
});

/**
 * Cas real (Vic, nit del 18 al 19/09/2026): ICON preveia codi 45 i visibilitat 840–1360 m,
 * però AROME (i el sensor XEMA de Vic) tenien HR 94–96 % i T−Td 0,6–1,0 °C, i els METAR
 * propers marcaven CAVOK. La boira NO s'ha de mostrar a cap pantalla.
 */
describe("buildRegionalHourlyRows — senyal de boira d'ICON sense saturació d'AROME", () => {
    const arome = {
        time: TIMES,
        temperature_2m: [15.9, 15.2, 15.0],
        relative_humidity_2m: [95, 96, 94],
        precipitation: [0, 0, 0],
        cloud_cover_low: [0, 0, 0],
        cloud_cover_mid: [0, 0, 0],
        cloud_cover_high: [0, 0, 0],
        wind_speed_10m: [4, 2, 2],
        wind_gusts_10m: [6, 4, 4],
        wind_direction_10m: [200, 210, 220],
        cape: [0, 0, 0],
        weather_code: [null, null, null],
        visibility: [null, null, null],
        freezing_level_height: [null, null, null],
        is_day: [0, 0, 0]
    };
    const merged = { ...arome, weather_code: [45, 45, 45], visibility: [1360, 840, 820], freezing_level_height: [3990, 4010, 4020] };
    const baseData = { elevation: 504, hourly: merged, hourlyComparison: {} } as unknown as ExtendedWeatherData;
    const now = new Date('2026-09-18T22:10:00Z'); // 00:10 hora local (UTC+2)

    it('cap pantalla mostra boira i totes donen el mateix codi', () => {
        const rows = buildRegionalHourlyRows({ hourly: arome, elevation: 504, utcOffsetSeconds: 7200, latitude: 41.9, baseData, now });
        expect(rows).toHaveLength(3);
        rows.forEach((row, i) => {
            expect(row.code).toBe(getHourlyWeatherCode(merged, i, 504, baseData.hourlyComparison));
            expect(row.code).not.toBe(45);
            expect(row.code).not.toBe(48);
        });
    });
});
