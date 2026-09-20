import { describe, it, expect } from 'vitest';
import { hoursOfDate, resolveDailyExtremes, averageDaylightClouds, type HourlyPoint } from './dailyExtremes';

// Una hora del chart horari complet amb els camps que llegeix la correcció d'inversió.
const hour = (time: string, temp: number | null, extra: Record<string, unknown> = {}): HourlyPoint => ({
    time, temp, cloud: 0, cloudLow: 0, cloudMid: 0, cloudHigh: 0, wind: 0, isDay: 1, ...extra
});

// Un dia de 24 hores: nit (isDay 0) a `night`, dia (isDay 1) a `day`.
const dayOf = (date: string, night: number, day: number, extra: Record<string, unknown> = {}): HourlyPoint[] =>
    Array.from({ length: 24 }, (_, h) => {
        const isDay = h >= 8 && h < 19 ? 1 : 0;
        return hour(`${date}T${String(h).padStart(2, '0')}:00`, isDay ? day : night, { isDay, ...extra });
    });

describe('resolveDailyExtremes', () => {
    it('sense hores del dia torna els valors crus del model, i un valor absent continua sent null (mai 0)', () => {
        expect(resolveDailyExtremes(20, 10, [])).toMatchObject({ max: 20, min: 10 });
        expect(resolveDailyExtremes(null, null, [])).toMatchObject({ max: null, min: null });
        expect(resolveDailyExtremes(null, 7, [])).toMatchObject({ max: null, min: 7 });
    });

    it('amb hores, la màxima i la mínima surten de les hores i no del valor diari cru', () => {
        const hours = dayOf('2026-09-21', 14, 27);
        expect(resolveDailyExtremes(30, 11, hours)).toMatchObject({ max: 27, min: 14 });
    });

    it('les hores sense temperatura (null) s\'ignoren; si totes en falten, es torna als valors crus', () => {
        const hours = [hour('2026-09-21T00:00', null), hour('2026-09-21T12:00', 22), hour('2026-09-21T13:00', null)];
        expect(resolveDailyExtremes(30, 11, hours)).toMatchObject({ max: 22, min: 22 });
        expect(resolveDailyExtremes(30, 11, [hour('2026-09-21T00:00', null)])).toMatchObject({ max: 30, min: 11 });
    });

    describe('procedència (model regional o global)', () => {
        it('sense marca a les hores, cap extrem no és regional', () => {
            expect(resolveDailyExtremes(30, 11, dayOf('2026-09-21', 14, 27))).toMatchObject({ maxRegional: false, minRegional: false });
            expect(resolveDailyExtremes(30, 11, [])).toMatchObject({ maxRegional: false, minRegional: false });
        });

        it('cada extrem és regional segons la seva hora: la màxima pot ser regional i la mínima no', () => {
            const base = dayOf('2026-09-21', 14, 27);   // hores 8-18 de dia (27°), la resta de nit (14°)
            const isSunHour = (i: number) => i >= 8 && i < 19;

            // Només les hores de sol (on hi ha la màxima) són regionals; la mínima, de nit, és del global.
            const sunRegional = base.map((h, i) => ({ ...h, regionalTemp: isSunHour(i) }));
            expect(resolveDailyExtremes(30, 11, sunRegional)).toMatchObject({ max: 27, maxRegional: true, min: 14, minRegional: false });

            // I al revés: només la nit és regional.
            const nightRegional = base.map((h, i) => ({ ...h, regionalTemp: !isSunHour(i) }));
            expect(resolveDailyExtremes(30, 11, nightRegional)).toMatchObject({ maxRegional: false, minRegional: true });
        });

        it('el valor cru de reserva (sense hores) mai no compta com a regional', () => {
            expect(resolveDailyExtremes(35, 19, [])).toMatchObject({ maxRegional: false, minRegional: false });
        });
    });

    it('a l\'hivern, nit serena i gairebé en calma: la mínima baixa per la inversió tèrmica i la màxima no', () => {
        // vent 3 km/h -> força 0,5 -> correcció 1,75°
        const hours = dayOf('2026-01-12', 10, 18, { wind: 3 });
        const { max, min } = resolveDailyExtremes(20, 10, hours, 41.9);
        expect(max).toBe(18);
        expect(min).toBeCloseTo(8.25, 5);
    });

    it('amb vent (> 6 km/h), amb núvols o a l\'estiu la inversió no s\'aplica', () => {
        expect(resolveDailyExtremes(20, 10, dayOf('2026-01-12', 10, 18, { wind: 12 }), 41.9).min).toBe(10);
        expect(resolveDailyExtremes(20, 10, dayOf('2026-01-12', 10, 18, { wind: 3, cloudLow: 80 }), 41.9).min).toBe(10);
        expect(resolveDailyExtremes(20, 10, dayOf('2026-07-12', 10, 18, { wind: 3 }), 41.9).min).toBe(10);
    });

    it('a l\'Hemisferi Sud l\'hivern cau al juliol: amb latitud negativa la correcció s\'aplica', () => {
        const hours = dayOf('2026-07-12', 10, 18, { wind: 3 });
        expect(resolveDailyExtremes(20, 10, hours, -34.6).min).toBeCloseTo(8.25, 5);
        expect(resolveDailyExtremes(20, 10, hours, 41.9).min).toBe(10);
    });
});

describe('hoursOfDate', () => {
    const hours = [...dayOf('2026-09-21', 14, 27), ...dayOf('2026-09-22', 15, 28)];

    it('només torna les hores de la data demanada', () => {
        expect(hoursOfDate(hours, '2026-09-22')).toHaveLength(24);
        expect(hoursOfDate(hours, '2026-09-22').every(h => h.time.startsWith('2026-09-22'))).toBe(true);
        expect(hoursOfDate(hours, '2026-09-23')).toEqual([]);
    });

    it('sense dades horàries (undefined, null o no-array) torna buit', () => {
        expect(hoursOfDate(undefined, '2026-09-22')).toEqual([]);
        expect(hoursOfDate(null, '2026-09-22')).toEqual([]);
        expect(hoursOfDate('x' as unknown as HourlyPoint[], '2026-09-22')).toEqual([]);
    });
});

describe('averageDaylightClouds', () => {
    it('fa la mitjana només de les hores de sol', () => {
        const hours = [
            hour('2026-09-21T03:00', 10, { isDay: 0, cloud: 100 }),
            hour('2026-09-21T10:00', 20, { isDay: 1, cloud: 20 }),
            hour('2026-09-21T14:00', 25, { isDay: 1, cloud: 60 }),
        ];
        expect(averageDaylightClouds(hours)).toBe(40);
    });

    it('sense hores de sol torna null (no s\'inventa un cel)', () => {
        expect(averageDaylightClouds([])).toBeNull();
        expect(averageDaylightClouds([hour('2026-09-21T03:00', 10, { isDay: 0, cloud: 100 })])).toBeNull();
    });

    it('un valor de núvols no numèric compta com 0', () => {
        const hours = [hour('2026-09-21T10:00', 20, { cloud: 'x' }), hour('2026-09-21T11:00', 20, { cloud: 80 })];
        expect(averageDaylightClouds(hours)).toBe(40);
    });
});
