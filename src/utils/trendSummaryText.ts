// src/utils/trendSummaryText.ts
// Text del resum de la setmana (trendSummary.ts) en cada idioma. Cada idioma té les seves frases senceres, no una
// plantilla traduïda paraula per paraula: les preposicions i els articles dels dies canvien d'una llengua a l'altra
// (ca "fins a dissabte", es "hasta el sábado", fr "jusqu'à samedi", en "until Saturday").
import type { Language } from '../translations';
import { formatPrecipitation } from './formatters';
import type { MovingShape, PrecipSummary, TempShape, TrendSummary, TrendUncertainty } from './trendSummary';

export interface TrendSummaryText {
    /** Màximes i, si canvien de veritat, mínimes. */
    temperature: string;
    /** Avís quan el canvi anunciat encara no és segur, o null. */
    uncertain: string | null;
    /** Pluja o neu de la setmana (o que no se'n preveu), o null si no hi ha res a dir. */
    precip: string | null;
}

/** Nom del dia (índex dins la llista del resum), en minúscula on la llengua ho demana ("dissabte", "Saturday"). */
type DayName = (day: number) => string;
type DaysText = (runs: Array<[number, number]>, day: DayName) => string;
type TurnShape = Extract<TempShape, { kind: 'valley' | 'peak' }>;

interface LanguageText {
    max: (s: TempShape, day: DayName) => string;
    min: (s: MovingShape, day: DayName) => string;
    uncertain: (u: TrendUncertainty, day: DayName) => string;
    /** Llista de dies: els trams de 3 o més dies seguits es diuen "de X a Y". */
    days: DaysText;
    rain: (days: string, upTo: string | null, severalDays: boolean) => string;
    snow: (days: string, upTo: string | null, severalDays: boolean) => string;
    dry: string;
}

const r = (v: number): number => Math.round(v) || 0;   // "|| 0": mai "-0°"
const isSingle = (first: number, last: number) => first === last;

/** "entre 16° i 18°", o "de 18°" si arrodonides són iguals. */
const rangeText = (low: number, high: number, between: string, and: string, equal: string): string =>
    r(low) === r(high) ? `${equal} ${r(low)}°` : `${between} ${r(low)}° ${and} ${r(high)}°`;

/** Uneix "a, b i c" amb la conjunció de cada idioma. */
const joinList = (items: string[], and: string): string =>
    items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;

/** Trams de dies seguits: [2, 3, 4, 6] → [[2, 4], [6, 6]]. */
const dayRuns = (days: ReadonlyArray<number>): Array<[number, number]> => {
    const runs: Array<[number, number]> = [];
    for (const d of days) {
        const last = runs[runs.length - 1];
        if (last && d === last[1] + 1) last[1] = d;
        else runs.push([d, d]);
    }
    return runs;
};

/** Un tram de 1-2 dies es diu dia per dia; de 3 o més, amb `range`. */
const listDays = (runs: Array<[number, number]>, day: DayName, single: (d: string) => string, range: (a: string, b: string) => string, and: string): string =>
    joinList(runs.flatMap(([a, b]) => (b - a >= 2 ? [range(day(a), day(b))] : Array.from({ length: b - a + 1 }, (_, i) => single(day(a + i))))), and);

const caRange = (low: number, high: number) => rangeText(low, high, 'entre', 'i', 'de');
const caDays: DaysText = (runs, day) => listDays(runs, day, d => d, (a, b) => `de ${a} a ${b}`, 'i');
const caTurn = (subject: string, s: TurnShape, day: DayName): string => {
    const [there, back] = s.kind === 'valley' ? ['baixen', 'pugen'] : ['pugen', 'baixen'];
    const when = caDays([[s.firstDay, s.lastDay]], day);
    // "dijous i divendres i després" es llegeix malament: amb dos dies, coma abans del segon "i".
    return `${subject} ${there} fins a ${r(s.extreme)}° ${when}${when.includes(' i ') ? ',' : ''} i després ${back} fins a ${r(s.end)}°.`;
};
const CA: LanguageText = {
    max: (s, day) => {
        const verb = (s.kind === 'gradual' || s.kind === 'step') && s.dir === 'up' ? 'pugen' : 'baixen';
        switch (s.kind) {
            case 'stable':
                return r(s.low) === r(s.high)
                    ? `Màximes sense grans canvis tota la setmana: al voltant de ${r(s.low)}°.`
                    : `Màximes sense grans canvis tota la setmana: entre ${r(s.low)}° i ${r(s.high)}°.`;
            case 'variable':
                return `Setmana de pujades i baixades: màximes entre ${r(s.low)}° i ${r(s.high)}°.`;
            case 'valley':
            case 'peak':
                return caTurn('Les màximes', s, day);
            case 'gradual':
                return `Les màximes ${verb} de mica en mica: de ${r(s.from.value)}° ${day(s.from.day)} a ${r(s.to.value)}° ${day(s.to.day)}.`;
            case 'step': {
                const { before, after } = s;
                const head = isSingle(before.firstDay, before.lastDay)
                    ? `de ${r(before.low)}° ${day(before.lastDay)}`
                    : `${caRange(before.low, before.high)} fins a ${day(before.lastDay)}`;
                const tail = isSingle(after.firstDay, after.lastDay)
                    ? `${day(after.firstDay)} ${verb} a ${r(after.extreme.value)}°`
                    : `a partir de ${day(after.firstDay)} ${verb} fins a ${r(after.extreme.value)}°`;
                return `Màximes ${head}; ${tail}.`;
            }
        }
    },
    min: (s, day) => {
        if (s.kind === 'valley' || s.kind === 'peak') return caTurn('Les mínimes', s, day);
        const verb = s.dir === 'up' ? 'pugen' : 'baixen';
        if (s.kind === 'gradual') {
            return `Les mínimes ${verb} de mica en mica: de ${r(s.from.value)}° ${day(s.from.day)} a ${r(s.to.value)}° ${day(s.to.day)}.`;
        }
        const { before, after } = s;
        const arrival = isSingle(after.firstDay, after.lastDay)
            ? `a ${r(after.extreme.value)}° ${day(after.firstDay)}`
            : `fins a ${r(after.extreme.value)}°`;
        return isSingle(before.firstDay, before.lastDay)
            ? `Les mínimes ${verb} de ${r(before.low)}° ${day(before.lastDay)} ${arrival}.`
            : `Les mínimes, ${caRange(before.low, before.high)} fins a ${day(before.lastDay)}, ${verb} ${arrival}.`;
    },
    uncertain: (u, day) =>
        `Encara no és segur: ${day(u.day)} la ${u.temp === 'max' ? 'màxima' : 'mínima'} pot anar de ${r(u.low)}° a ${r(u.high)}°.`,
    days: caDays,
    rain: (days, upTo, several) => `Pot ploure ${days}${upTo ? ` (fins a ${upTo}${several ? ' en un dia' : ''})` : ''}.`,
    snow: (days, upTo, several) => `Pot nevar ${days}${upTo ? ` (fins a ${upTo}${several ? ' en un dia' : ''})` : ''}.`,
    dry: 'No es preveu pluja.'
};

const esRange = (low: number, high: number) => rangeText(low, high, 'entre', 'y', 'de');
const esDays: DaysText = (runs, day) => listDays(runs, day, d => `el ${d}`, (a, b) => `del ${a} al ${b}`, 'y');
const esTurn = (subject: string, s: TurnShape, day: DayName): string => {
    const [there, back] = s.kind === 'valley' ? ['bajan', 'suben'] : ['suben', 'bajan'];
    const when = esDays([[s.firstDay, s.lastDay]], day);
    return `${subject} ${there} hasta ${r(s.extreme)}° ${when}${when.includes(' y ') ? ',' : ''} y después ${back} hasta ${r(s.end)}°.`;
};
const ES: LanguageText = {
    max: (s, day) => {
        const verb = (s.kind === 'gradual' || s.kind === 'step') && s.dir === 'up' ? 'suben' : 'bajan';
        switch (s.kind) {
            case 'stable':
                return r(s.low) === r(s.high)
                    ? `Máximas sin grandes cambios toda la semana: en torno a ${r(s.low)}°.`
                    : `Máximas sin grandes cambios toda la semana: entre ${r(s.low)}° y ${r(s.high)}°.`;
            case 'variable':
                return `Semana de subidas y bajadas: máximas entre ${r(s.low)}° y ${r(s.high)}°.`;
            case 'valley':
            case 'peak':
                return esTurn('Las máximas', s, day);
            case 'gradual':
                return `Las máximas ${verb} poco a poco: de ${r(s.from.value)}° el ${day(s.from.day)} a ${r(s.to.value)}° el ${day(s.to.day)}.`;
            case 'step': {
                const { before, after } = s;
                const head = isSingle(before.firstDay, before.lastDay)
                    ? `de ${r(before.low)}° el ${day(before.lastDay)}`
                    : `${esRange(before.low, before.high)} hasta el ${day(before.lastDay)}`;
                const tail = isSingle(after.firstDay, after.lastDay)
                    ? `el ${day(after.firstDay)} ${verb} a ${r(after.extreme.value)}°`
                    : `a partir del ${day(after.firstDay)} ${verb} hasta ${r(after.extreme.value)}°`;
                return `Máximas ${head}; ${tail}.`;
            }
        }
    },
    min: (s, day) => {
        if (s.kind === 'valley' || s.kind === 'peak') return esTurn('Las mínimas', s, day);
        const verb = s.dir === 'up' ? 'suben' : 'bajan';
        if (s.kind === 'gradual') {
            return `Las mínimas ${verb} poco a poco: de ${r(s.from.value)}° el ${day(s.from.day)} a ${r(s.to.value)}° el ${day(s.to.day)}.`;
        }
        const { before, after } = s;
        const arrival = isSingle(after.firstDay, after.lastDay)
            ? `a ${r(after.extreme.value)}° el ${day(after.firstDay)}`
            : `hasta ${r(after.extreme.value)}°`;
        return isSingle(before.firstDay, before.lastDay)
            ? `Las mínimas ${verb} de ${r(before.low)}° el ${day(before.lastDay)} ${arrival}.`
            : `Las mínimas, ${esRange(before.low, before.high)} hasta el ${day(before.lastDay)}, ${verb} ${arrival}.`;
    },
    uncertain: (u, day) =>
        `Aún no es seguro: el ${day(u.day)} la ${u.temp === 'max' ? 'máxima' : 'mínima'} puede ir de ${r(u.low)}° a ${r(u.high)}°.`,
    days: esDays,
    rain: (days, upTo, several) => `Puede llover ${days}${upTo ? ` (hasta ${upTo}${several ? ' en un día' : ''})` : ''}.`,
    snow: (days, upTo, several) => `Puede nevar ${days}${upTo ? ` (hasta ${upTo}${several ? ' en un día' : ''})` : ''}.`,
    dry: 'No se prevé lluvia.'
};

const frRange = (low: number, high: number) => rangeText(low, high, 'entre', 'et', 'de');
const frDays: DaysText = (runs, day) => listDays(runs, day, d => d, (a, b) => `de ${a} à ${b}`, 'et');
const frTurn = (subject: string, s: TurnShape, day: DayName): string => {
    const [there, back] = s.kind === 'valley' ? ['baissent', 'remontent'] : ['montent', 'redescendent'];
    return `${subject} ${there} jusqu'à ${r(s.extreme)}° ${frDays([[s.firstDay, s.lastDay]], day)}, puis ${back} jusqu'à ${r(s.end)}°.`;
};
const FR: LanguageText = {
    max: (s, day) => {
        const verb = (s.kind === 'gradual' || s.kind === 'step') && s.dir === 'up' ? 'montent' : 'baissent';
        switch (s.kind) {
            case 'stable':
                return r(s.low) === r(s.high)
                    ? `Maximales sans grands changements toute la semaine : autour de ${r(s.low)}°.`
                    : `Maximales sans grands changements toute la semaine : entre ${r(s.low)}° et ${r(s.high)}°.`;
            case 'variable':
                return `Semaine en dents de scie : maximales entre ${r(s.low)}° et ${r(s.high)}°.`;
            case 'valley':
            case 'peak':
                return frTurn('Les maximales', s, day);
            case 'gradual':
                return `Les maximales ${verb} peu à peu : de ${r(s.from.value)}° ${day(s.from.day)} à ${r(s.to.value)}° ${day(s.to.day)}.`;
            case 'step': {
                const { before, after } = s;
                const head = isSingle(before.firstDay, before.lastDay)
                    ? `de ${r(before.low)}° ${day(before.lastDay)}`
                    : `${frRange(before.low, before.high)} jusqu'à ${day(before.lastDay)}`;
                const tail = isSingle(after.firstDay, after.lastDay)
                    ? `${day(after.firstDay)}, elles ${verb} à ${r(after.extreme.value)}°`
                    : `à partir de ${day(after.firstDay)}, elles ${verb} jusqu'à ${r(after.extreme.value)}°`;
                return `Maximales ${head} ; ${tail}.`;
            }
        }
    },
    min: (s, day) => {
        if (s.kind === 'valley' || s.kind === 'peak') return frTurn('Les minimales', s, day);
        const verb = s.dir === 'up' ? 'montent' : 'baissent';
        if (s.kind === 'gradual') {
            return `Les minimales ${verb} peu à peu : de ${r(s.from.value)}° ${day(s.from.day)} à ${r(s.to.value)}° ${day(s.to.day)}.`;
        }
        const { before, after } = s;
        const arrival = isSingle(after.firstDay, after.lastDay)
            ? `à ${r(after.extreme.value)}° ${day(after.firstDay)}`
            : `jusqu'à ${r(after.extreme.value)}°`;
        return isSingle(before.firstDay, before.lastDay)
            ? `Les minimales ${verb} de ${r(before.low)}° ${day(before.lastDay)} ${arrival}.`
            : `Les minimales, ${frRange(before.low, before.high)} jusqu'à ${day(before.lastDay)}, ${verb} ${arrival}.`;
    },
    uncertain: (u, day) =>
        `Rien n'est encore sûr : ${day(u.day)}, la ${u.temp === 'max' ? 'maximale' : 'minimale'} pourrait aller de ${r(u.low)}° à ${r(u.high)}°.`,
    days: frDays,
    rain: (days, upTo, several) => `Pluie possible ${days}${upTo ? ` (jusqu'à ${upTo}${several ? ' sur une journée' : ''})` : ''}.`,
    snow: (days, upTo, several) => `Neige possible ${days}${upTo ? ` (jusqu'à ${upTo}${several ? ' sur une journée' : ''})` : ''}.`,
    dry: 'Pas de pluie prévue.'
};

const enRange = (low: number, high: number) => rangeText(low, high, 'between', 'and', 'around');
const enDays: DaysText = (runs, day) => listDays(runs, day, d => d, (a, b) => `${a} to ${b}`, 'and');
const enTurn = (subject: string, s: TurnShape, day: DayName): string => {
    const [there, back] = s.kind === 'valley' ? ['fall', 'rise'] : ['rise', 'fall'];
    const when = s.lastDay - s.firstDay >= 2
        ? `from ${day(s.firstDay)} to ${day(s.lastDay)}`
        : `on ${enDays([[s.firstDay, s.lastDay]], day)}`;
    return `${subject} ${there} to ${r(s.extreme)}° ${when}, then ${back} to ${r(s.end)}°.`;
};
const EN: LanguageText = {
    max: (s, day) => {
        const verb = (s.kind === 'gradual' || s.kind === 'step') && s.dir === 'up' ? 'rise' : 'fall';
        switch (s.kind) {
            case 'stable':
                return r(s.low) === r(s.high)
                    ? `Highs hold steady all week: around ${r(s.low)}°.`
                    : `Highs hold steady all week: between ${r(s.low)}° and ${r(s.high)}°.`;
            case 'variable':
                return `Up-and-down week: highs between ${r(s.low)}° and ${r(s.high)}°.`;
            case 'valley':
            case 'peak':
                return enTurn('Highs', s, day);
            case 'gradual':
                return `Highs ${verb} gradually: from ${r(s.from.value)}° on ${day(s.from.day)} to ${r(s.to.value)}° on ${day(s.to.day)}.`;
            case 'step': {
                const { before, after } = s;
                const head = isSingle(before.firstDay, before.lastDay)
                    ? `of ${r(before.low)}° on ${day(before.lastDay)}`
                    : `${enRange(before.low, before.high)} until ${day(before.lastDay)}`;
                const tail = isSingle(after.firstDay, after.lastDay)
                    ? `on ${day(after.firstDay)} they ${verb} to ${r(after.extreme.value)}°`
                    : `from ${day(after.firstDay)} they ${verb} to ${r(after.extreme.value)}°`;
                return `Highs ${head}; ${tail}.`;
            }
        }
    },
    min: (s, day) => {
        if (s.kind === 'valley' || s.kind === 'peak') return enTurn('Lows', s, day);
        const verb = s.dir === 'up' ? 'rise' : 'fall';
        if (s.kind === 'gradual') {
            return `Lows ${verb} gradually: from ${r(s.from.value)}° on ${day(s.from.day)} to ${r(s.to.value)}° on ${day(s.to.day)}.`;
        }
        const { before, after } = s;
        const arrival = `to ${r(after.extreme.value)}°${isSingle(after.firstDay, after.lastDay) ? ` on ${day(after.firstDay)}` : ''}`;
        return isSingle(before.firstDay, before.lastDay)
            ? `Lows ${verb} from ${r(before.low)}° on ${day(before.lastDay)} ${arrival}.`
            : `Lows stay ${enRange(before.low, before.high)} until ${day(before.lastDay)}, then ${verb} ${arrival}.`;
    },
    uncertain: (u, day) =>
        `Not certain yet: ${day(u.day)}'s ${u.temp === 'max' ? 'high' : 'low'} could be anywhere from ${r(u.low)}° to ${r(u.high)}°.`,
    days: enDays,
    rain: (days, upTo, several) => `Rain possible ${days}${upTo ? ` (up to ${upTo}${several ? ' in a day' : ''})` : ''}.`,
    snow: (days, upTo, several) => `Snow possible ${days}${upTo ? ` (up to ${upTo}${several ? ' in a day' : ''})` : ''}.`,
    dry: 'No rain expected.'
};

const TEXT: Record<Language, LanguageText> = { ca: CA, es: ES, fr: FR, en: EN };

/** En català, "de" s'apostrofa davant d'1 i d'11 ("d'11°", "d'1°"): les xifres es llegeixen "u" i "onze". */
const elideCatalan = (text: string): string => text.replace(/\bde (11?°)/g, "d'$1");

const describePrecip = (p: PrecipSummary, t: LanguageText, day: DayName, lang: Language): string | null => {
    const parts: string[] = [];
    if (p.rainDays.length > 0) {
        const upTo = p.maxRain !== null ? formatPrecipitation(p.maxRain, 0, lang) : null;
        parts.push(t.rain(t.days(dayRuns(p.rainDays), day), upTo, p.rainDays.length > 1));
    }
    if (p.snowDays.length > 0) {
        const upTo = p.maxSnow !== null ? formatPrecipitation(0, p.maxSnow, lang) : null;
        parts.push(t.snow(t.days(dayRuns(p.snowDays), day), upTo, p.snowDays.length > 1));
    }
    if (parts.length > 0) return parts.join(' ');
    return p.dry ? t.dry : null;
};

/** `dayNames[i]`: nom del dia `i` del resum, tal com el diu la llengua ("dimarts", "martes", "mardi", "Tuesday"). */
export const describeTrend = (summary: TrendSummary, dayNames: ReadonlyArray<string>, lang: Language): TrendSummaryText => {
    const t = TEXT[lang] ?? TEXT.ca;
    const day: DayName = d => dayNames[d] ?? '';
    const fix = lang === 'ca' ? elideCatalan : (s: string) => s;
    const temperature = [t.max(summary.max, day), summary.min ? t.min(summary.min, day) : null]
        .filter((s): s is string => s !== null)
        .join(' ');
    const precip = describePrecip(summary.precip, t, day, lang);
    return {
        temperature: fix(temperature),
        uncertain: summary.uncertain ? fix(t.uncertain(summary.uncertain, day)) : null,
        precip: precip !== null ? fix(precip) : null
    };
};
