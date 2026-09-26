// src/utils/aifsTemperatureBlend.ts
// Temperatura dels dies 4 a 7: la de la sèrie principal barrejada amb la d'AIFS (el model d'IA de l'ECMWF, que ja arriba
// a la crida base, vegeu API_MODELS_LIST). Pes d'AIFS: 0 fins a 72 h vista, puja en línia recta fins al 50 % a 120 h i
// s'hi queda; de mitjana, un 25 % el dia 4 i un 50 % els dies 5 a 7.
//
// PER QUÈ: dos models amb errors en part independents s'equivoquen menys de mitjana que cadascun sol. Verificat (set.
// 2026) amb l'arxiu de passades anteriors d'Open-Meteo (temperature_2m_previous_dayN) a 30 aeroports europeus, un any
// sencer (15-09-2025 – 15-09-2026, 42.000 dies-estació per variable als dies 4-7) contra la màxima i la mínima dels METAR,
// amb la correcció d'inversió de l'app aplicada a totes dues sèries (aproximada: l'arxiu no guarda les capes de núvols):
//   - error mitjà de la màxima 1,92 → 1,76 °C (-8,2 %, IC 95 % per dates [-9,5, -6,9], millora 26 de 30 aeroports) i de
//     la mínima 2,02 → 1,78 °C (-11,8 % [-12,8, -10,9], 28 de 30). Dies errats en més de 3 °C: màxima 19,7 → 16,6 %,
//     mínima 22,5 → 17,8 %; en més de 5 °C: 5,6 → 4,0 % i 6,1 → 3,7 %;
//   - per estacions de l'any: mínima -9 a -15 % totes (hivern -12,8 %, 29 de 30, també les nits d'inversió); màxima
//     -10 a -12 % a la tardor, la primavera i l'estiu, i neutra a l'hivern (-1,2 %, IC [-3,2, +0,9]).
//
// PER QUÈ NO ABANS DEL DIA 4: als dies 1-3 la barreja empitjora la màxima (+5 % el dia 2) i un 50 % el dia 4 també la de
// l'hivern (+5,5 %); amb un 25 % el dia 4 no empitjora cap estació de l'any. La rampa en hores evita un salt de
// temperatura a mitjanit a la gràfica horària.
//
// ALTERNATIVES DESCARTADES: la mitjana de l'ensemble de l'ECMWF (una crida més a l'API d'ensembles) no aporta res per
// sobre d'AIFS; ECMWF IFS en lloc d'AIFS guanya la meitat. (L'`ecmwf_ifs025_ensemble_mean` de l'API de previsió torna
// tot nuls, i el de l'API d'ensembles no porta la correcció d'altitud que sí porten els membres.)
//
// CONTRAPARTIDA: AIFS té el cicle diari suau (màxima -1,1 a -1,6 °C de biaix), i la barreja aplana els extrems: els
// dies més calorosos (màxima observada ≥ percentil 90) surten 1,5 °C curts en lloc d'1,0, tot i que amb menys error
// (2,20 → 2,10 °C). LÍMITS: un sol any, aeroports d'Europa occidental i central; si l'ECMWF canvia AIFS, cal tornar-ho a
// mesurar.
//
// Només es toca la temperatura horària, i el punt de rosada i la sensació tèrmica es desplacen el mateix (la humitat
// relativa i l'efecte del vent queden els del model, com a temperatureCorrections.getInversionCorrectedApparent). Els
// diaris crus del model (daily.temperature_2m_max/min) no es toquen: la fiabilitat i el rang probable mesuren el
// desacord entre models amb ells. Una hora sense temperatura d'AIFS o de la sèrie queda tal com ve.
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { extractValidNum } from './weatherMath';

/** Hores vista a partir de les quals AIFS entra a la barreja. */
export const AIFS_BLEND_START_HOURS = 72;
/** Hores vista a partir de les quals AIFS hi pesa el màxim. */
export const AIFS_BLEND_FULL_HOURS = 120;
/** Pes màxim d'AIFS a la temperatura. */
export const AIFS_BLEND_MAX_WEIGHT = 0.5;

const HOUR_MS = 3_600_000;

/** Pes d'AIFS (0 a AIFS_BLEND_MAX_WEIGHT) per a una hora que és a `hoursAhead` hores vista. */
export const aifsBlendWeight = (hoursAhead: number): number => {
    if (!Number.isFinite(hoursAhead) || hoursAhead <= AIFS_BLEND_START_HOURS) return 0;
    const ramp = (hoursAhead - AIFS_BLEND_START_HOURS) / (AIFS_BLEND_FULL_HOURS - AIFS_BLEND_START_HOURS);
    return AIFS_BLEND_MAX_WEIGHT * Math.min(1, ramp);
};

// Les hores d'Open-Meteo són locals i sense zona ("2026-09-26T14:00"), les mateixes que current.time: llegides totes com
// a UTC, la diferència és la real (llevat d'1 h si pel mig hi ha un canvi d'hora, irrellevant per a una rampa de 48 h).
const naiveMs = (value: unknown): number | null => {
    if (typeof value !== 'string') return null;
    const ms = Date.parse(`${value.slice(0, 16)}Z`);
    return Number.isNaN(ms) ? null : ms;
};

type NumericSeries = Array<number | null>;

/** Barreja la temperatura horària amb la d'AIFS a partir del dia 4 (vegeu la capçalera). No muta les dades d'entrada. */
export const injectAifsTemperatureBlend = (data: ExtendedWeatherData): ExtendedWeatherData => {
    const hourly = data?.hourly as unknown as Record<string, unknown> | undefined;
    const aifs = data?.hourlyComparison?.aifs;
    const nowMs = naiveMs(data?.current?.time);
    if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.temperature_2m) || !aifs || nowMs === null) {
        return data;
    }

    const shifted = (key: string): NumericSeries | null =>
        Array.isArray(hourly[key]) ? [...(hourly[key] as NumericSeries)] : null;
    const temperature = [...(hourly.temperature_2m as NumericSeries)];
    const dewPoint = shifted('dew_point_2m');
    const apparent = shifted('apparent_temperature');
    let changed = false;

    (hourly.time as unknown[]).forEach((t, i) => {
        const timeMs = naiveMs(t);
        if (timeMs === null) return;
        const weight = aifsBlendWeight((timeMs - nowMs) / HOUR_MS);
        if (weight === 0) return;
        const own = extractValidNum(temperature[i]);
        const other = extractValidNum(aifs[i]?.temperature_2m);
        if (own === null || other === null) return;

        const delta = weight * (other - own);
        temperature[i] = own + delta;
        for (const series of [dewPoint, apparent]) {
            const value = series ? extractValidNum(series[i]) : null;
            if (series && value !== null) series[i] = value + delta;
        }
        changed = true;
    });

    if (!changed) return data;

    return {
        ...data,
        hourly: {
            ...data.hourly,
            temperature_2m: temperature,
            ...(dewPoint ? { dew_point_2m: dewPoint } : {}),
            ...(apparent ? { apparent_temperature: apparent } : {})
        } as ExtendedWeatherData['hourly']
    };
};
