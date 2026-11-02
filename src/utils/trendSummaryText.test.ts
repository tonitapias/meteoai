import { describe, it, expect } from 'vitest';
import { summarizeTrend, type TrendSummaryDay } from './trendSummary';
import { describeTrend } from './trendSummaryText';
import type { Language } from '../translations';

const NAMES: Record<Language, string[]> = {
    ca: ['dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte', 'diumenge', 'dilluns'],
    es: ['martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo', 'lunes'],
    fr: ['mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'lundi'],
    en: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday'],
};

const describe7 = (days: TrendSummaryDay[], lang: Language = 'ca') => describeTrend(summarizeTrend(days)!, NAMES[lang], lang);

const week = (maxes: number[], mins: number[] = maxes.map(() => 10), extra: Partial<TrendSummaryDay> = {}): TrendSummaryDay[] =>
    maxes.map((max, i) => ({ max, min: mins[i], ...extra }));

// Girona, 2-11-2026 (vegeu trendSummary.test.ts), amb la pluja i els rangs probables reals del gràfic.
const GIRONA: TrendSummaryDay[] = [
    { max: 16, min: 9, precipProb: 80, precipSum: 0.3 },
    { max: 18, min: 8, precipProb: 75, precipSum: 1 },
    { max: 18, min: 5, precipProb: 15, precipSum: 0 },
    { max: 18, min: 5, precipProb: 11, precipSum: 0 },
    { max: 17, min: 5, precipProb: 12, precipSum: 0.6 },
    { max: 20, min: 11, precipProb: 19, precipSum: 0 },
    { max: 21, min: 15, precipProb: 18, precipSum: 0.3, maxProbable: { low: 19.2, high: 25.7 }, minProbable: { low: 10.1, high: 18.5 } },
];

describe('describeTrend — la setmana de Girona en els quatre idiomes', () => {
    it('català: diu on canvien les màximes, la vall de les mínimes i la pluja; cap "poc segur"', () => {
        expect(describe7(GIRONA)).toEqual({
            temperature: 'Màximes entre 16° i 18° fins a dissabte; a partir de diumenge pugen fins a 21°. '
                + 'Les mínimes baixen fins a 5° de dijous a dissabte i després pugen fins a 15°.',
            uncertain: null,
            precip: 'Pot ploure dimarts i dimecres (fins a 1 mm en un dia).'
        });
    });

    it('castellà', () => {
        expect(describe7(GIRONA, 'es')).toEqual({
            temperature: 'Máximas entre 16° y 18° hasta el sábado; a partir del domingo suben hasta 21°. '
                + 'Las mínimas bajan hasta 5° del jueves al sábado y después suben hasta 15°.',
            uncertain: null,
            precip: 'Puede llover el martes y el miércoles (hasta 1 mm en un día).'
        });
    });

    it('francès', () => {
        expect(describe7(GIRONA, 'fr')).toEqual({
            temperature: "Maximales entre 16° et 18° jusqu'à samedi ; à partir de dimanche, elles montent jusqu'à 21°. "
                + "Les minimales baissent jusqu'à 5° de jeudi à samedi, puis remontent jusqu'à 15°.",
            uncertain: null,
            precip: "Pluie possible mardi et mercredi (jusqu'à 1 mm sur une journée)."
        });
    });

    it('anglès', () => {
        expect(describe7(GIRONA, 'en')).toEqual({
            temperature: 'Highs between 16° and 18° until Saturday; from Sunday they rise to 21°. '
                + 'Lows fall to 5° from Thursday to Saturday, then rise to 15°.',
            uncertain: null,
            precip: 'Rain possible Tuesday and Wednesday (up to 1 mm in a day).'
        });
    });
});

describe('describeTrend — cada forma de la setmana', () => {
    it('de mica en mica, amb el dia de sortida i el d\'arribada', () => {
        expect(describe7(week([18, 19, 21, 22, 24, 25, 27])).temperature)
            .toBe('Les màximes pugen de mica en mica: de 18° dimarts a 27° dilluns.');
        expect(describe7(week([18, 19, 21, 22, 24, 25, 27]), 'es').temperature)
            .toBe('Las máximas suben poco a poco: de 18° el martes a 27° el lunes.');
    });

    it('sense grans canvis i de pujades i baixades', () => {
        expect(describe7(week([24, 25, 24, 26, 25, 24, 25])).temperature).toBe('Màximes sense grans canvis tota la setmana: entre 24° i 26°.');
        expect(describe7(week([24.2, 24.4, 24, 24.3, 23.9, 24, 24.1])).temperature).toBe('Màximes sense grans canvis tota la setmana: al voltant de 24°.');
        expect(describe7(week([30, 34, 27, 33, 28, 31, 26])).temperature).toBe('Setmana de pujades i baixades: màximes entre 26° i 34°.');
        expect(describe7(week([30, 34, 27, 33, 28, 31, 26]), 'en').temperature).toBe('Up-and-down week: highs between 26° and 34°.');
    });

    it('vall i cim: fins on arriben, quins dies, i fins on tornen', () => {
        expect(describe7(week([24, 26, 28, 30, 27, 25, 23])).temperature)
            .toBe('Les màximes pugen fins a 30° divendres i després baixen fins a 23°.');
        expect(describe7(week([24, 26, 28, 30, 27, 25, 23]), 'en').temperature)
            .toBe('Highs rise to 30° on Friday, then fall to 23°.');
        // Amb dos dies al fons, una coma abans del segon "i" ("dijous i divendres, i després").
        expect(describe7(week([30, 26, 22, 22.5, 26, 28, 30])).temperature)
            .toBe('Les màximes baixen fins a 22° dijous i divendres, i després pugen fins a 30°.');
        expect(describe7(week([30, 26, 22, 22.5, 26, 28, 30]), 'es').temperature)
            .toBe('Las máximas bajan hasta 22° el jueves y el viernes, y después suben hasta 30°.');
        expect(describe7(week([30, 26, 22, 22.5, 26, 28, 30]), 'fr').temperature)
            .toBe("Les maximales baissent jusqu'à 22° jeudi et vendredi, puis remontent jusqu'à 30°.");
    });

    it('un graó d\'un sol dia al principi o al final es diu amb el nom del dia', () => {
        // Només dimarts és fresc.
        expect(describe7(week([11, 18, 19, 19, 18, 19, 19])).temperature)
            .toBe("Màximes d'11° dimarts; a partir de dimecres pugen fins a 19°.");
        // Només dilluns és més fred.
        expect(describe7(week([20, 21, 20, 21, 20, 21, 14])).temperature)
            .toBe('Màximes entre 20° i 21° fins a diumenge; dilluns baixen a 14°.');
        expect(describe7(week([20, 21, 20, 21, 20, 21, 14]), 'en').temperature)
            .toBe('Highs between 20° and 21° until Sunday; on Monday they fall to 14°.');
    });

    it('en català, "de" s\'apostrofa davant d\'1 i d\'11, i mai no surt "-0°"', () => {
        const cold = week([1, 1.2, 0.8, -3, -3.4, -2.8, -3.1], [-0.3, -1, -2, -6, -7, -6, -7]);
        const text = describe7(cold).temperature;
        expect(text).toBe("Màximes d'1° fins a dijous; a partir de divendres baixen fins a -3°. "
            + 'Les mínimes, entre -2° i 0° fins a dijous, baixen fins a -7°.');
        expect(text).not.toContain('-0°');
        expect(text).not.toMatch(/\bde 11?°/);
    });
});

describe('describeTrend — incertesa i pluja', () => {
    it('l\'avís diu el dia i el rang, amb les mateixes xifres que el bigoti', () => {
        const milano = week([14.4, 13, 13.4, 10.9, 11.7, 12.4, 9.9]);
        milano[6] = { ...milano[6], maxProbable: { low: 7.9, high: 15.6 } };
        expect(describe7(milano)).toMatchObject({
            temperature: 'Les màximes baixen de mica en mica: de 14° dimarts a 10° dilluns.',
            uncertain: 'Encara no és segur: dilluns la màxima pot anar de 8° a 16°.'
        });
        expect(describe7(milano, 'en').uncertain).toBe("Not certain yet: Monday's high could be anywhere from 8° to 16°.");
    });

    it('els dies de pluja seguits es diuen "de X a Y"; un sol dia, sense "en un dia"', () => {
        const rainy = week([20, 20, 20, 20, 20, 20, 20], undefined, { precipProb: 10, precipSum: 0 });
        [0, 1, 2, 4].forEach(i => { rainy[i] = { ...rainy[i], precipProb: 60, precipSum: i + 1 }; });
        expect(describe7(rainy).precip).toBe('Pot ploure de dimarts a dijous i dissabte (fins a 5 mm en un dia).');
        expect(describe7(rainy, 'es').precip).toBe('Puede llover del martes al jueves y el sábado (hasta 5 mm en un día).');

        const oneDay = week([20, 20, 20, 20, 20, 20, 20], undefined, { precipProb: 10, precipSum: 0 });
        oneDay[1] = { ...oneDay[1], precipProb: 50, precipSum: 3.4 };
        expect(describe7(oneDay).precip).toBe('Pot ploure dimecres (fins a 3 mm).');
        oneDay[1] = { ...oneDay[1], precipSum: 0 };
        expect(describe7(oneDay).precip).toBe('Pot ploure dimecres.');
    });

    it('la neu es diu a part, en cm', () => {
        const snowy = week([2, 1, 0, 1, 2, 3, 2], undefined, { precipProb: 10, precipSum: 0, snowSum: 0 });
        snowy[4] = { ...snowy[4], precipProb: 70, precipSum: 3, snowSum: 4.2 };
        expect(describe7(snowy).precip).toBe('Pot nevar dissabte (fins a 4 cm).');
    });

    it('setmana seca: "No es preveu pluja"; sense dades de pluja, no es diu res', () => {
        expect(describe7(week([20, 20, 20, 20, 20, 20, 20], undefined, { precipProb: 5, precipSum: 0 })).precip).toBe('No es preveu pluja.');
        expect(describe7(week([20, 20, 20, 20, 20, 20, 20])).precip).toBeNull();
    });
});
