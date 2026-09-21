import { describe, it, expect } from 'vitest';
import { summarizeDayParts, partOfHour, DAY_PARTS, type DayPartRow } from './dayParts';

const row = (h: number, over: Partial<DayPartRow> = {}): DayPartRow => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    temp: 20,
    code: 0,
    precipProb: 0,
    precipSum: 0,
    snowfall: 0,
    windSpeed: 5,
    isDay: h >= 7 && h < 20,
    cloudCover: 0,
    ...over
});

const fullDay = (over: (h: number) => Partial<DayPartRow> = () => ({})): DayPartRow[] =>
    Array.from({ length: 24 }, (_, h) => row(h, over(h)));

const part = (rows: DayPartRow[], key: string) => summarizeDayParts(rows).find(p => p.key === key);

describe('partOfHour', () => {
    it('reparteix les 24 hores en 4 franges de 6', () => {
        expect(partOfHour(0)).toBe('night');
        expect(partOfHour(5)).toBe('night');
        expect(partOfHour(6)).toBe('morning');
        expect(partOfHour(11)).toBe('morning');
        expect(partOfHour(12)).toBe('afternoon');
        expect(partOfHour(17)).toBe('afternoon');
        expect(partOfHour(18)).toBe('evening');
        expect(partOfHour(23)).toBe('evening');
        expect(DAY_PARTS.map(p => p.key)).toEqual(['night', 'morning', 'afternoon', 'evening']);
    });

    it('una hora fora de rang no és de cap franja', () => {
        expect(partOfHour(24)).toBeNull();
        expect(partOfHour(-1)).toBeNull();
    });
});

describe('summarizeDayParts', () => {
    it('resumeix cada franja amb les seves hores (rang de temperatura, vent, pluja)', () => {
        const rows = fullDay(h => ({
            temp: h === 15 ? 29 : h === 6 ? 17 : 22,
            windSpeed: h === 13 ? 30 : 5,
            precipProb: h === 17 ? 60 : 0,
            precipSum: h === 17 ? 1.5 : 0
        }));
        const morning = part(rows, 'morning');
        expect(morning).toMatchObject({ from: 6, to: 12, tempMin: 17, tempMax: 22 });
        const afternoon = part(rows, 'afternoon');
        expect(afternoon).toMatchObject({ tempMin: 22, tempMax: 29, windMax: 30, precipProbMax: 60, precipSum: 1.5 });
    });

    it('una franja sense hores no existeix (dia a mitges)', () => {
        const rows = [row(14), row(15), row(20)];
        expect(summarizeDayParts(rows).map(p => p.key)).toEqual(['afternoon', 'evening']);
    });

    it('sense cap fila no hi ha franges', () => {
        expect(summarizeDayParts([])).toEqual([]);
    });

    it('una magnitud sense dada és null, mai un 0 fals', () => {
        const rows = fullDay(() => ({ temp: null, precipProb: null, precipSum: null, snowfall: null, windSpeed: null, cloudCover: null }));
        const night = part(rows, 'night');
        expect(night).toMatchObject({
            tempMin: null, tempMax: null, precipProbMax: null, precipSum: null, snowfall: null, windMax: null, avgClouds: null
        });
    });

    it('les dades que hi són compten encara que en falti alguna hora', () => {
        const rows = fullDay(h => (h === 8 ? { temp: null, precipSum: null } : { temp: h }));
        const morning = part(rows, 'morning');
        expect(morning?.tempMin).toBe(6);
        expect(morning?.tempMax).toBe(11);
        expect(morning?.precipSum).toBe(0);
    });

    it('els dies amb hores en un altre ordre o fusos ("HH:MM" invàlid) no petan', () => {
        const rows = [row(9), { ...row(10), hour: '--:--' }];
        expect(summarizeDayParts(rows).map(p => p.key)).toEqual(['morning']);
    });

    describe('dia o nit', () => {
        it('la major part de la franja decideix sol o lluna', () => {
            const rows = fullDay();
            expect(part(rows, 'night')?.isDay).toBe(false);
            expect(part(rows, 'morning')?.isDay).toBe(true);
            expect(part(rows, 'afternoon')?.isDay).toBe(true);
            // 18-24 h: de dia fins a les 19, de nit de 20 a 23 → majoritàriament de nit.
            expect(part(rows, 'evening')?.isDay).toBe(false);
        });
    });

    describe('icona de la franja', () => {
        it('cel serè: el que diuen els núvols de la franja', () => {
            expect(part(fullDay(() => ({ code: 0, cloudCover: 0 })), 'morning')?.code).toBe(0);
            expect(part(fullDay(() => ({ code: 3, cloudCover: 95 })), 'morning')?.code).toBe(3);
        });

        it('sense núvols, el cel més ennuvolat que hagi donat el motor', () => {
            const rows = fullDay(h => ({ cloudCover: null, code: h === 9 ? 2 : 0 }));
            expect(part(rows, 'morning')?.code).toBe(2);
        });

        it('la pluja d\'UNA sola hora es veu: la precipitació més severa mana sobre el cel', () => {
            const rows = fullDay(h => ({ code: h === 14 ? 63 : 0, cloudCover: 10 }));
            expect(part(rows, 'afternoon')?.code).toBe(63);
            // ...però només a la seva franja.
            expect(part(rows, 'morning')?.code).toBe(0);
        });

        it('entre dues precipitacions, la més severa (tempesta > pluja)', () => {
            const rows = fullDay(h => ({ code: h === 13 ? 61 : h === 16 ? 95 : 0 }));
            expect(part(rows, 'afternoon')?.code).toBe(95);
        });

        it('la boira d\'una sola hora no pinta tota la franja, però sí si en ocupa la meitat o més', () => {
            const oneHour = fullDay(h => ({ code: h === 6 ? 45 : 0, cloudCover: 0 }));
            expect(part(oneHour, 'morning')?.code).toBe(0);

            const half = fullDay(h => ({ code: h >= 6 && h < 9 ? 45 : 0, cloudCover: 0 }));
            expect(part(half, 'morning')?.code).toBe(45);
        });

        it('sense cap codi (motor sense dada) la franja no té icona, no s\'inventa un cel', () => {
            expect(part(fullDay(() => ({ code: null })), 'morning')?.code).toBeNull();
        });
    });
});
