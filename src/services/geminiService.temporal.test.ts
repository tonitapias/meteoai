// @vitest-environment node
import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';

vi.mock('./cacheService', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        generateAiKey: vi.fn().mockReturnValue('test-ai-key'),
    },
}));

import { getGeminiAnalysis, evaluateRulesRisk } from './geminiService';
import { cacheService } from './cacheService';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Simulació del desfasament temporal de la IA (24/11/2026). Cas real: dilluns a les 23:00, la IA deia que "demà" hi
// hauria ratxes de més de 60 km/h, i al model eren dimecres. Cada escenari construeix el prompt amb el codi real
// (getGeminiAnalysis, amb el fetch interceptat) i mira on situa el perill: ratxes, pluja forta, tempesta o neu.
//
// `expected` és el que hauria de dir; `today` és el que diu ara mateix, si és diferent, amb la causa de la diagnosi
// (tots quatre corregits el 24/11: C1, la finestra començava a l'hora següent quan current.time no era en punt; C2, el
// pic de "més enllà" barrejava dies; C3, el prompt no deia quin dia era ni marcava el dia de les hores; C4, la clau de
// memòria cau no portava la data).
// El test fixa el comportament d'avui: quan una correcció el canvia, cal treure el `today` de l'escenari.
// Amb AI_TEMPORAL_REPORT=1 i --reporter=verbose, en acabar s'escriu la taula de resultats (a stderr).

interface Place {
    timezone: string;
    utc_offset_seconds: number;
    latitude: number;
    longitude: number;
    elevation: number;
}

const BARCELONA: Place = { timezone: 'Europe/Madrid', utc_offset_seconds: 3600, latitude: 41.39, longitude: 2.17, elevation: 12 };
const LAS_PALMAS: Place = { timezone: 'Atlantic/Canary', utc_offset_seconds: 0, latitude: 28.12, longitude: -15.43, elevation: 8 };
const NEW_YORK: Place = { timezone: 'America/New_York', utc_offset_seconds: -18000, latitude: 40.71, longitude: -74.01, elevation: 10 };
/** Un punt de muntanya per a la neu (Pirineu, 1.500 m). */
const PYRENEES: Place = { timezone: 'Europe/Madrid', utc_offset_seconds: 3600, latitude: 42.43, longitude: 1.93, elevation: 1500 };

/** Dilluns 23/11/2026, el primer dia de la previsió (sense past_days). */
const MONDAY = 23;
const FORECAST_DAYS = 7;

/** Hora local sense zona, com les d'Open-Meteo amb timezone=auto ("2026-11-23T23:00"). `hour` pot passar de 23. */
const localTime = (day: number, hour: number, minute = 0): string =>
    new Date(Date.UTC(2026, 10, day, hour, minute)).toISOString().slice(0, 16);

/** Valors de cada hora quan l'escenari no en diu res: cel serè, sec i en calma. */
const DEFAULT_HOUR = {
    weather_code: 1, visibility: 20000, temperature_2m: 12, apparent_temperature: 11, relative_humidity_2m: 70,
    precipitation: 0, precipitation_probability: 0, snowfall: 0, cloud_cover_low: 10, cloud_cover_mid: 0, cloud_cover_high: 0,
    wind_speed_10m: 8, wind_gusts_10m: 15, cape: 0, freezing_level_height: 2500,
};
type HourlyKey = keyof typeof DEFAULT_HOUR;
type HourValues = Partial<Record<HourlyKey, number>>;

/** Els mateixos valors el dia `day` de les `from` a les `to` (incloses). */
const hoursBetween = (day: number, from: number, to: number, values: HourValues): Record<string, HourValues> =>
    Object.fromEntries(Array.from({ length: to - from + 1 }, (_, k) => [localTime(day, from + k), values]));

interface Scenario {
    place?: Place;
    /** current.time tal com l'envia Open-Meteo: l'inici del quart d'hora en curs ("2026-11-23T23:15"). */
    now: string;
    /** Valors de totes les hores (i del bloc current), per sobre de DEFAULT_HOUR. */
    base?: HourValues;
    /** Valors d'hores concretes, per hora local. */
    hours?: Record<string, HourValues>;
    /** Dies passats al principi de la sèrie (el paràmetre past_days d'Open-Meteo). */
    pastDays?: number;
}

const buildWeather = ({ place = BARCELONA, now, base = {}, hours = {}, pastDays = 0 }: Scenario): ExtendedWeatherData => {
    const days = FORECAST_DAYS + pastDays;
    const time = Array.from({ length: days * 24 }, (_, i) => localTime(MONDAY - pastDays, i));
    const valueAt = (t: string, key: HourlyKey): number => hours[t]?.[key] ?? base[key] ?? DEFAULT_HOUR[key];
    const isDayAt = (t: string) => {
        const h = Number(t.slice(11, 13));
        return h >= 8 && h < 18 ? 1 : 0;
    };
    const hourly = Object.fromEntries((Object.keys(DEFAULT_HOUR) as HourlyKey[]).map(key => [key, time.map(t => valueAt(t, key))]));
    return {
        ...place,
        current: {
            time: now, weather_code: 1, temperature_2m: base.temperature_2m ?? DEFAULT_HOUR.temperature_2m,
            apparent_temperature: base.apparent_temperature ?? DEFAULT_HOUR.apparent_temperature, relative_humidity_2m: 70,
            wind_speed_10m: 6, wind_gusts_10m: 14, is_day: isDayAt(now), precipitation: 0,
        },
        hourly: { time, ...hourly, is_day: time.map(isDayAt) },
        daily: { time: Array.from({ length: days }, (_, d) => localTime(MONDAY - pastDays + d, 0).slice(0, 10)) },
        hourlyComparison: {},
    } as unknown as ExtendedWeatherData;
};

/** El prompt que rep el worker i els arguments de la clau de memòria cau. */
const analyse = async (scenario: Scenario): Promise<{ prompt: string; cacheKeyArgs: unknown[] }> => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ engine: 'gemini', candidates: [{ content: { parts: [{ text: JSON.stringify({
            risk_level: 'GREEN', hazard_type: 'NONE', tactical_reasoning: 'x', text: 'Resum.', tips: [],
        }) }] } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(cacheService.generateAiKey).mockClear();
    await getGeminiAnalysis(buildWeather(scenario), 'ca', 1, null, 10);
    const prompt = (JSON.parse(fetchMock.mock.calls[0][1].body as string) as { prompt: string }).prompt;
    return { prompt, cacheKeyArgs: vi.mocked(cacheService.generateAiKey).mock.calls[0] ?? [] };
};

/** Els fenòmens que la línia "MÉS ENLLÀ DE LES 6 HORES" situa en un dia (describeBeyondWindow). */
type Phenomenon = 'ratxes fortes' | 'pluja forta' | 'tempesta' | 'neu';

interface Mention {
    /** El fragment literal del prompt. */
    text: string;
    /** Dia que hi va associat ("demà", "dimecres"...), o null si només hi ha l'hora. */
    day: string | null;
}

/** Un tram d'un fenomen a la línia "més enllà": "<dia> cap a les 14:00" o "<dia> de 12:00 a 18:00", amb el pic o sense. */
const BEYOND_SEGMENT = /^(.+?) (?:cap a les \d{2}:\d{2}|de \d{2}:\d{2} a \d{2}:\d{2})(?: \(fins a (\d+) (?:km|mm)\/h\))?$/;

/**
 * On parla el prompt d'un fenomen (amb el pic `value`, si es dona): a la línia "MÉS ENLLÀ DE LES 6 HORES" (fenòmens
 * separats per "; " i, dins de cada un, els dies per " i ": "ratxes fortes demà (dimarts 24/11) cap a les 06:00 (fins a
 * 55 km/h) i dimecres 25/11 de 12:00 a 18:00 (fins a 75 km/h)") o, dins de les 6 hores, al resum de la finestra
 * ("Ratxa màxima: 65km/h (demà 02:00)", "Pluja: intensitat màxima moderada (12mm/h, demà 02:00; …").
 */
const findMention = (prompt: string, kind: Phenomenon, value?: number): Mention | null => {
    const beyond = prompt.match(/MÉS ENLLÀ DE LES 6 HORES[^:]*: (.+?)\. Esmenta-ho/)?.[1];
    if (beyond) {
        for (const entry of beyond.split('; ')) {
            if (!entry.startsWith(`${kind} `)) continue;
            for (const segment of entry.slice(kind.length + 1).split(' i ')) {
                const m = segment.match(BEYOND_SEGMENT);
                if (m && (value === undefined || Number(m[2]) === value)) return { text: `${kind} ${segment}`, day: m[1] };
            }
        }
    }
    const summary = kind === 'ratxes fortes' ? prompt.match(/Ratxa màxima: (\d+(?:\.\d+)?)km\/h \(([^)]*)\)/)
        : kind === 'pluja forta' ? prompt.match(/Pluja: intensitat màxima [^(]+\((\d+(?:\.\d+)?)mm\/h, ([^;]*);/)
        : null;
    if (summary && (value === undefined || Number(summary[1]) === value)) {
        // Fora de l'hora, el que queda és el dia ("demà"); la primera hora porta ", ara", que no és cap dia.
        const day = summary[2].replace(/\d{2}:\d{2}/, '').replace(/,?\s*ara\s*$/, '').trim();
        return { text: summary[0].replace(/;$/, ''), day: day === '' ? null : day };
    }
    return null;
};

type Verdict = 'correcte' | 'dia equivocat' | 'sense dia' | 'no esmentat';

const verdictFor = (mention: Mention | null, expectedDay: string): Verdict => {
    if (!mention) return 'no esmentat';
    if (mention.day === null) return 'sense dia';
    return mention.day.includes(expectedDay) ? 'correcte' : 'dia equivocat';
};

interface Check {
    name: string;
    run: () => Promise<{ said: string; value: string }>;
    /** El valor correcte. */
    expected: string;
    /** El valor d'avui, si és un altre, i la causa de la diagnosi. */
    today?: { value: string; cause: string };
}

/** Escenari d'un fenomen: què diu el prompt i en quin dia el situa. */
const mentionCheck = (
    name: string,
    scenario: Scenario,
    phenomenon: { kind: Phenomenon; value?: number },
    expectedDay: string,
    expected: Verdict,
    today?: Check['today']
): Check => ({
    name,
    expected,
    today,
    run: async () => {
        const { prompt } = await analyse(scenario);
        const mention = findMention(prompt, phenomenon.kind, phenomenon.value);
        return { said: mention ? mention.text : "(no l'esmenta)", value: verdictFor(mention, expectedDay) };
    },
});

const report: { group: string; name: string; said: string; expected: string; actual: string }[] = [];

const runChecks = (group: string, checks: Check[]) => {
    describe(group, () => {
        for (const check of checks) {
            const title = check.today ? `${check.name} — avui: ${check.today.value} (${check.today.cause})` : check.name;
            it(title, async () => {
                const { said, value } = await check.run();
                report.push({ group, name: check.name, said, expected: check.expected, actual: value });
                expect(value).toBe(check.today ? check.today.value : check.expected);
            });
        }
    });
};

afterEach(() => { vi.unstubAllGlobals(); });

// Els tipus del projecte no inclouen els de Node: process s'hi llegeix des de globalThis.
const reportRequested = (): boolean =>
    !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.AI_TEMPORAL_REPORT;

afterAll(() => {
    if (!reportRequested()) return;
    const rows = report.map(r => `| ${r.group} | ${r.name} | ${r.said} | ${r.expected} | ${r.actual === r.expected ? 'OK' : `**${r.actual}**`} |`);
    console.warn(['', '| Grup | Escenari | Què diu el prompt | Correcte | Avui |', '|---|---|---|---|---|', ...rows, ''].join('\n'));
});

const GUSTS_65 = { kind: 'ratxes fortes', value: 65 } as const;

// --- A. El cas real: ratxes dimecres a la tarda ---
const WEDNESDAY_WIND = hoursBetween(MONDAY + 2, 12, 18, { wind_gusts_10m: 65 });

runChecks('A. Ratxes de 65 km/h dimecres 25/11 de 12:00 a 18:00 (Barcelona)', [
    // A les 00:30 i a les 12:00, dimecres a la tarda queda fora de les 48 hores de la línia "més enllà".
    mentionCheck('dilluns 00:30', { now: localTime(MONDAY, 0, 30), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'no esmentat'),
    mentionCheck('dilluns 12:00', { now: localTime(MONDAY, 12), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'no esmentat'),
    mentionCheck('dilluns 23:00', { now: localTime(MONDAY, 23), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'correcte'),
    mentionCheck('dilluns 23:15', { now: localTime(MONDAY, 23, 15), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'correcte'),
    mentionCheck('dilluns 23:30', { now: localTime(MONDAY, 23, 30), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'correcte'),
    // A les 23:59, Open-Meteo encara envia el quart de les 23:45.
    mentionCheck('dilluns 23:59 (current.time 23:45)', { now: localTime(MONDAY, 23, 45), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'correcte'),
]);

// --- B. Un perill de matinada: és demà, encara que falti poc ---
const TUESDAY_EARLY_WIND = { [localTime(MONDAY + 1, 2)]: { wind_gusts_10m: 65 } };

runChecks('B. Ratxes de 65 km/h demà a primera hora (dimarts 24/11 a les 02:00)', [
    mentionCheck('dilluns 12:00', { now: localTime(MONDAY, 12), hours: TUESDAY_EARLY_WIND }, GUSTS_65, 'demà', 'correcte'),
    mentionCheck('dilluns 23:00', { now: localTime(MONDAY, 23), hours: TUESDAY_EARLY_WIND }, GUSTS_65, 'demà', 'correcte'),
    mentionCheck('dilluns 23:15', { now: localTime(MONDAY, 23, 15), hours: TUESDAY_EARLY_WIND }, GUSTS_65, 'demà', 'correcte'),
]);

// --- C. Altres zones horàries (la suite corre amb TZ=UTC: la màquina no és a la zona de la població) ---
runChecks('C. Una altra zona horària (ratxes dimecres de 12:00 a 18:00, hora local)', [
    mentionCheck('Las Palmas, dilluns 23:00', { place: LAS_PALMAS, now: localTime(MONDAY, 23), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'correcte'),
    mentionCheck('Las Palmas, dilluns 23:15', { place: LAS_PALMAS, now: localTime(MONDAY, 23, 15), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'correcte'),
    mentionCheck('Nova York, dilluns 23:00', { place: NEW_YORK, now: localTime(MONDAY, 23), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'correcte'),
    mentionCheck('Nova York, dilluns 23:15', { place: NEW_YORK, now: localTime(MONDAY, 23, 15), hours: WEDNESDAY_WIND }, GUSTS_65, 'dimecres', 'correcte'),
    {
        name: "Nova York, dilluns 23:15: l'hora del prompt és la de la població, no la de la màquina",
        expected: '23:15',
        run: async () => {
            const { prompt } = await analyse({ place: NEW_YORK, now: localTime(MONDAY, 23, 15) });
            const line = prompt.match(/HORA LOCAL ACTUAL A LA ZONA: (\d{2}:\d{2})/);
            return { said: line ? line[0] : "(no hi ha l'hora)", value: line ? line[1] : '—' };
        },
    },
]);

// --- D. Sèrie que comença abans d'avui ---
runChecks('D. Sèrie amb past_days=1 (comença diumenge 22/11 a les 00:00)', [
    mentionCheck('dilluns 23:00', { now: localTime(MONDAY, 23), hours: WEDNESDAY_WIND, pastDays: 1 }, GUSTS_65, 'dimecres', 'correcte'),
    mentionCheck('dilluns 23:15', { now: localTime(MONDAY, 23, 15), hours: WEDNESDAY_WIND, pastDays: 1 }, GUSTS_65, 'dimecres', 'correcte'),
]);

// --- E. Altres fenòmens: pluja forta, tempesta i neu dimecres a la tarda ---
/** Pluja de 12 mm/h (moderada, per sobre del llindar AMBER de 5 mm/h) i cel tapat. */
const RAIN_HOUR: HourValues = { weather_code: 63, precipitation: 12, precipitation_probability: 90, cloud_cover_low: 100, cloud_cover_mid: 100, relative_humidity_2m: 95 };
const STORM_HOUR: HourValues = { ...RAIN_HOUR, weather_code: 95, cape: 1500 };
/** Neu a 1.500 m amb -2 °C i la cota de gel a 600 m: 2 mm d'aigua, 1,4 cm de neu per hora. */
const SNOW_HOUR: HourValues = { ...RAIN_HOUR, weather_code: 73, precipitation: 2, snowfall: 1.4 };
const SNOW_BASE: HourValues = { temperature_2m: -2, apparent_temperature: -5, freezing_level_height: 600 };

const WEDNESDAY_RAIN = hoursBetween(MONDAY + 2, 14, 16, RAIN_HOUR);
const WEDNESDAY_STORM = hoursBetween(MONDAY + 2, 14, 16, STORM_HOUR);
const WEDNESDAY_SNOW = hoursBetween(MONDAY + 2, 14, 16, SNOW_HOUR);

runChecks('E. Pluja forta, tempesta i neu dimecres 25/11 de 14:00 a 16:00', [
    mentionCheck('pluja forta, dilluns 23:00', { now: localTime(MONDAY, 23), hours: WEDNESDAY_RAIN }, { kind: 'pluja forta', value: 12 }, 'dimecres', 'correcte'),
    mentionCheck('pluja forta, dilluns 23:15', { now: localTime(MONDAY, 23, 15), hours: WEDNESDAY_RAIN }, { kind: 'pluja forta', value: 12 }, 'dimecres', 'correcte'),
    mentionCheck('tempesta, dilluns 23:00', { now: localTime(MONDAY, 23), hours: WEDNESDAY_STORM }, { kind: 'tempesta' }, 'dimecres', 'correcte'),
    mentionCheck('tempesta, dilluns 23:15', { now: localTime(MONDAY, 23, 15), hours: WEDNESDAY_STORM }, { kind: 'tempesta' }, 'dimecres', 'correcte'),
    mentionCheck('neu (Pirineu, 1.500 m), dilluns 23:00', { place: PYRENEES, now: localTime(MONDAY, 23), base: SNOW_BASE, hours: WEDNESDAY_SNOW }, { kind: 'neu' }, 'dimecres', 'correcte'),
    mentionCheck('neu (Pirineu, 1.500 m), dilluns 23:15', { place: PYRENEES, now: localTime(MONDAY, 23, 15), base: SNOW_BASE, hours: WEDNESDAY_SNOW }, { kind: 'neu' }, 'dimecres', 'correcte'),
]);

// --- F. Pluja forta de matinada: és demà, encara que falti poc ---
const TUESDAY_EARLY_RAIN = { [localTime(MONDAY + 1, 2)]: RAIN_HOUR };

runChecks('F. Pluja forta (12 mm/h) demà a primera hora (dimarts 24/11 a les 02:00)', [
    mentionCheck('dilluns 12:00', { now: localTime(MONDAY, 12), hours: TUESDAY_EARLY_RAIN }, { kind: 'pluja forta', value: 12 }, 'demà', 'correcte'),
    mentionCheck('dilluns 23:00', { now: localTime(MONDAY, 23), hours: TUESDAY_EARLY_RAIN }, { kind: 'pluja forta', value: 12 }, 'demà', 'correcte'),
]);

// --- G. Les altres peces temporals del context ---
runChecks('G. Altres propietats temporals del context', [
    {
        name: 'el prompt diu quin dia és avui (dilluns 23/11)',
        expected: 'sí',
        run: async () => {
            const { prompt } = await analyse({ now: localTime(MONDAY, 23), hours: WEDNESDAY_WIND });
            const line = prompt.match(/DIA D'AVUI A LA ZONA: [^\n]*/) ?? prompt.match(/HORA LOCAL ACTUAL A LA ZONA: [^\n]*/);
            return { said: line ? line[0].slice(0, 90) : "(no hi ha l'hora)", value: /dilluns/.test(prompt) && /23\/11/.test(prompt) ? 'sí' : 'no' };
        },
    },
    {
        // La tira de l'app (findNowIndex) marca com a "ara" l'hora en curs: a les 14:15, la de les 14:00.
        name: 'a les 14:15, la fila «ara» del resum és la de les 14:00, com a la tira de l\'app',
        expected: '14:00',
        run: async () => {
            const { prompt } = await analyse({ now: localTime(MONDAY, 14, 15) });
            const now = prompt.match(/\((\d{2}:\d{2}), ara\)/);
            return { said: now ? now[0] : "(cap fila «ara»)", value: now ? now[1] : '—' };
        },
    },
    {
        // La mateixa finestra és la del tallafocs (evaluateRulesRisk): abans, a les 14:15 començava a les 15:00 i una
        // ratxa de 85 km/h a les 14:00 no hi comptava.
        name: "a les 14:15, el tallafocs compta l'hora en curs (ratxa de 85 km/h a les 14:00)",
        expected: 'RED',
        run: async () => {
            const rules = evaluateRulesRisk(buildWeather({ now: localTime(MONDAY, 14, 15), hours: { [localTime(MONDAY, 14)]: { wind_gusts_10m: 85 } } }));
            const hour = rules.risk_detail?.hour ? ` (${rules.risk_detail.hour})` : '';
            return { said: `risc ${rules.risk_level}, perill ${rules.hazard_type}${hour}`, value: rules.risk_level };
        },
    },
    mentionCheck(
        'cada pic de ratxa va amb el seu dia: 55 km/h dimarts a les 06:00 i 75 km/h dimecres a les 15:00 (des de dilluns 23:00)',
        { now: localTime(MONDAY, 23), hours: { [localTime(MONDAY + 1, 6)]: { wind_gusts_10m: 55 }, [localTime(MONDAY + 2, 15)]: { wind_gusts_10m: 75 } } },
        { kind: 'ratxes fortes', value: 75 }, 'dimecres', 'correcte'
    ),
    mentionCheck(
        'cada pic de pluja va amb el seu dia: 6 mm/h dimarts a les 06:00 i 18 mm/h dimecres a les 15:00 (des de dilluns 23:00)',
        { now: localTime(MONDAY, 23), hours: { [localTime(MONDAY + 1, 6)]: { ...RAIN_HOUR, precipitation: 6 }, [localTime(MONDAY + 2, 15)]: { ...RAIN_HOUR, precipitation: 18 } } },
        { kind: 'pluja forta', value: 18 }, 'dimecres', 'correcte'
    ),
    {
        name: 'la clau de memòria cau porta la data local (un altre dia, una altra anàlisi)',
        expected: 'sí',
        run: async () => {
            const { cacheKeyArgs } = await analyse({ now: localTime(MONDAY, 23), hours: WEDNESDAY_WIND });
            return { said: cacheKeyArgs.map(String).join(' · '), value: cacheKeyArgs.some(a => String(a).includes('2026-11-23')) ? 'sí' : 'no' };
        },
    },
    {
        // Mateixa situació (cel serè, sense pluja ni perills) a banda i banda de mitjanit: l'anàlisi de les 23:45 deia
        // "demà" de dimarts, i a les 00:15 dimarts ja és avui.
        name: 'la mateixa situació a les 23:45 i a les 00:15 de l\'endemà dona claus diferents',
        expected: 'diferents',
        run: async () => {
            const before = (await analyse({ now: localTime(MONDAY, 23, 45) })).cacheKeyArgs.map(String).join(' · ');
            const after = (await analyse({ now: localTime(MONDAY + 1, 0, 15) })).cacheKeyArgs.map(String).join(' · ');
            return { said: `${before.split(' · ')[0]} → ${after.split(' · ')[0]}`, value: before === after ? 'iguals' : 'diferents' };
        },
    },
]);
