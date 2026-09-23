// src/utils/regionalModelEngine.ts
import { z } from 'zod';
import type { ExtendedWeatherData, StrictHourlyWeather, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { HourlyDataSchema, CurrentDataSchema } from '../schemas/weatherSchema';
import { buildModelSuffixRegex, REGIONAL_TEMP_FLAG_KEY, type RegionalModel } from '../constants/regionalModels';
import { MEASURABLE_RAIN_MM, rainProbabilityWithModelEvidence } from './rainEvidence';

// --- 1. SCHEMAS & TIPUS INTERNS (Idèntic a l'original per seguretat) ---
const RegionalModelCleanedSchema = z.object({
    current: CurrentDataSchema.optional(),
    hourly: HourlyDataSchema.optional(),
    minutely_15: z.object({
        time: z.array(z.string()),
        precipitation: z.array(z.number().nullable())
    }).passthrough().optional()
});

type CleanedSource = z.infer<typeof RegionalModelCleanedSchema>;

// --- 2. HELPERS UTILS (Funcions pures) ---

// [NETEJA] Abans hardcodejava només el sufix d'AROME; ara la regex es genera
// a partir del registre de models regionals (regionalModels.ts) perquè cobreixi
// també ICON-D2/HRRR/HRDPS sense mantenir una còpia local de la llista.
const MODEL_SUFFIX_REGEX = buildModelSuffixRegex();

const cleanKeys = (obj: Record<string, unknown> | undefined): Record<string, unknown> => {
    if (!obj) return {};
    const clean: Record<string, unknown> = {};
    Object.keys(obj).forEach(key => {
        const cleanKey = key.replace(MODEL_SUFFIX_REGEX, '');
        clean[cleanKey] = obj[key];
    });
    return clean;
};

const normalizeTime = (t: unknown): number => {
    if (!t) return 0;
    const date = new Date(String(t));
    if (isNaN(date.getTime())) return 0;
    date.setMinutes(0, 0, 0); 
    return date.getTime();
};

// --- 3. SUB-INJECTORS (Modularització de la lògica) ---

const injectCurrent = (target: ExtendedWeatherData, source: CleanedSource, model: RegionalModel) => {
    if (!source.current || !target.current) return;

    const CURRENT_FIELDS_TO_OVERWRITE: (keyof StrictCurrentWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 
        'is_day', 'precipitation', 'rain', 'showers', 
        'weather_code', 'cloud_cover', 'cloud_cover_low', 
        'cloud_cover_mid', 'cloud_cover_high', 
        'wind_speed_10m', 'wind_gusts_10m', 'visibility'
    ];

    const targetCurrent = target.current as Record<string, unknown>;

    // [FIX PRECISIÓ] Abans es marcava 'AROME HD' encara que cap camp de sota
    // fos vàlid (p.ex. AROME retorna 'current' estructuralment però amb tots
    // els valors nuls per una fallada parcial puntual). Això feia que la UI
    // mostrés la insígnia d'alta resolució amb dades que en realitat venien
    // íntegrament del model global de reserva — procedència enganyosa que
    // contradiu la doctrina Risc Zero. Ara només marquem la font com a model
    // regional si com a mínim un camp real s'ha sobreescrit de debò.
    let anyFieldOverwritten = false;
    CURRENT_FIELDS_TO_OVERWRITE.forEach(k => {
            const val = (source.current as Record<string, unknown>)[k];
            if (val != null && !isNaN(Number(val))) {
                targetCurrent[k] = val;
                anyFieldOverwritten = true;
            }
    });
    if (anyFieldOverwritten) {
        target.current.source = model.label;
    }
};

const injectMinutely = (target: ExtendedWeatherData, source: CleanedSource) => {
    if (!source.minutely_15) return;
    
    if (source.minutely_15.time.length > 0) {
        target.minutely_15 = source.minutely_15 as unknown as { time: string[]; precipitation: number[]; [key: string]: unknown };
    }
};

/** Probabilitat de pluja (%) que l'evidència regional ha escrit a les hores, per dia ("YYYY-MM-DD" → la més alta d'aquell dia). */
type BoostedRainProbabilityByDate = Map<string, number>;

interface HourlyInjectionResult {
    /** Dies amb almenys una hora on l'evidència regional ha pujat la probabilitat de pluja, i el valor més alt. */
    boostedByDate: BoostedRainProbabilityByDate;
    /** Dies amb almenys una hora on el model regional ha escrit la pluja. */
    regionalPrecipDates: Set<string>;
}

const HOUR_MS = 3600000;

/**
 * Pluja màxima (mm) d'una sèrie determinista (el model regional, o la sèrie mostrada) a l'hora `index` i a les dues
 * veïnes (±1 h), o null si cap no en porta dada.
 * Una previsió puntual d'un model determinista té errors de fase d'ordre d'una hora: mirar el veïnat fa que una pluja
 * prevista a les 15 h que arriba a les 16 h no faci perdre l'evidència (vegeu rainEvidence.ts). Només compten les
 * veïnes que són realment l'hora anterior o la següent (un forat a la sèrie no s'estén).
 */
const neighbourhoodPrecip = (times: ReadonlyArray<unknown>, precip: ReadonlyArray<number | null> | undefined, index: number): number | null => {
    if (!Array.isArray(precip)) return null;
    let max: number | null = null;
    for (const j of [index - 1, index, index + 1]) {
        const value = precip[j];
        if (typeof value !== 'number' || isNaN(value)) continue;
        if (j !== index && Math.abs(normalizeTime(times[j]) - normalizeTime(times[index])) !== HOUR_MS) continue;
        max = max === null ? value : Math.max(max, value);
    }
    return max;
};

const injectHourly = (target: ExtendedWeatherData, source: CleanedSource, masterTimeLength: number): HourlyInjectionResult => {
    const result: HourlyInjectionResult = { boostedByDate: new Map(), regionalPrecipDates: new Set() };
    if (!source.hourly || !target.hourly || !target.hourly.time) return result;

    const HOURLY_FIELDS: (keyof StrictHourlyWeather)[] = [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'precipitation', 'weather_code',
        'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
        'wind_speed_10m', 'wind_gusts_10m',
        'cape', 'freezing_level_height', 'visibility'
    ];

    const globalTimeIndexMap = new Map<number, number>();
    target.hourly.time.forEach((t, i) => globalTimeIndexMap.set(normalizeTime(t), i));
    const sourceTimes = source.hourly.time;
    const sourcePrecip = source.hourly.precipitation as Array<number | null> | undefined;

    sourceTimes.forEach((timeValue, sourceIndex) => {
        const timeKey = normalizeTime(timeValue);
        const globalIndex = globalTimeIndexMap.get(timeKey);

        if (globalIndex !== undefined) {
            const tH = target.hourly as Record<string, (number | null)[]>;
            const date = String(target.hourly.time[globalIndex]).slice(0, 10);

            HOURLY_FIELDS.forEach(field => {
                // Accés segur
                const srcArr = (source.hourly as Record<string, number[] | undefined>)[field];
                if (Array.isArray(srcArr)) {
                        const val = srcArr[sourceIndex];
                        if (val != null && !isNaN(Number(val))) {
                            if (!tH[field]) tH[field] = new Array(masterTimeLength).fill(null);
                            tH[field][globalIndex] = val;
                            if (field === 'precipitation') result.regionalPrecipDates.add(date);
                        }
                }
            });

            // Proveniència: la sèrie horària barreja model regional (primers dies) i global (la resta)
            // i el gràfic setmanal ha de poder assenyalar on es produeix el salt. Només es marca
            // l'hora si la temperatura regional era vàlida i s'ha escrit de debò.
            const regionalTemp = (source.hourly as Record<string, number[] | undefined>).temperature_2m?.[sourceIndex];
            if (regionalTemp != null && !isNaN(Number(regionalTemp))) {
                if (!tH[REGIONAL_TEMP_FLAG_KEY]) tH[REGIONAL_TEMP_FLAG_KEY] = new Array(masterTimeLength).fill(null);
                tH[REGIONAL_TEMP_FLAG_KEY][globalIndex] = 1;
            }

            // Probabilitat de pluja: la de l'ensemble global més l'evidència del model regional, calibrada contra
            // pluja observada (vegeu rainEvidence.ts). Només la puja, i només quan hi ha pluja mesurable dins de ±1 h.
            const regionalMm = neighbourhoodPrecip(sourceTimes, sourcePrecip, sourceIndex);
            if (regionalMm !== null && regionalMm >= MEASURABLE_RAIN_MM) {
                if (!tH.precipitation_probability) tH.precipitation_probability = new Array(masterTimeLength).fill(0);
                const currentProb = tH.precipitation_probability[globalIndex] || 0;
                const updatedProb = rainProbabilityWithModelEvidence(currentProb, regionalMm);
                if (updatedProb > currentProb) {
                    tH.precipitation_probability[globalIndex] = updatedProb;
                    // El dia d'aquesta hora també ho ha de saber (vegeu injectDailyRainProbability).
                    result.boostedByDate.set(date, Math.max(result.boostedByDate.get(date) ?? 0, updatedProb));
                }
            }
        }
    });

    return result;
};

/**
 * Porta l'evidència de pluja de les hores a la probabilitat DIÀRIA (`precipitation_probability_max`, que és el
 * màxim de les probabilitats horàries). Sense això només arribava a la taula horària: la llista de 7 dies i el gràfic
 * de tendència (que llegeixen la diària) deien, p. ex., 18 % d'un dia que la taula donava més alt.
 *
 * Només se sap de segur el que s'ha escrit a les hores: la probabilitat diària puja fins a aquest valor, mai baixa i
 * un dia que no s'ha tocat queda com estava. No es refà cap màxim a partir de totes les hores. No es muta `daily`
 * de les dades base: se'n fa una còpia.
 */
const injectDailyRainProbability = (target: ExtendedWeatherData, boostedByDate: BoostedRainProbabilityByDate) => {
    const daily = target.daily;
    if (boostedByDate.size === 0 || !daily || !Array.isArray(daily.time)) return;

    const current = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max : [];
    const raised: Array<number | null> = daily.time.map((_, i) => {
        const existing = current[i];
        return typeof existing === 'number' && !isNaN(existing) ? existing : null;
    });

    daily.time.forEach((day, i) => {
        const boosted = boostedByDate.get(String(day).slice(0, 10));
        if (boosted === undefined) return;
        raised[i] = raised[i] === null ? boosted : Math.max(raised[i] as number, boosted);
    });

    target.daily = { ...daily, precipitation_probability_max: raised };
};

// Un dia té 24 hores, 23 o 25 el dia del canvi d'hora.
const MIN_DAY_HOURS = 23;
const MAX_DAY_HOURS = 25;

/**
 * El total de pluja d'un dia és la INTEGRAL de la pluja horària: el que la targeta diu ha de ser la suma del que diu
 * la taula d'hores. `daily.precipitation_sum` és del model global, però la taula porta el model regional a les hores
 * que en té; sense això llista, gràfic i detall deien un total i les hores un altre (mesurat: 9 de 33 dies de pluja
 * difereixen >= 1 mm o >= 30 %; p. ex. 18,1 mm al diari i 4,1 mm a les hores).
 *
 * Verificat amb 12.749 dies-estació: el diari coincideix amb la suma de les hores del mateix model global, i quan
 * els dos totals difereixen >= 1 mm cap dels dos no prediu millor les hores de pluja observades (5,8 h contra 5,7 h),
 * així que el que decideix és la coherència. Només es toca un dia si el model regional hi ha escrit pluja i tota la
 * seva sèrie horària té dada (mai un total parcial fet passar per complet); si no, queda el valor diari.
 * Es sumen hores de 0,1 mm, així que el total es dona a 0,1 mm. No es muta `daily` de les dades base.
 */
const injectDailyPrecipitationTotal = (target: ExtendedWeatherData, regionalPrecipDates: Set<string>) => {
    const daily = target.daily;
    const hourly = target.hourly as unknown as Record<string, unknown> | undefined;
    if (regionalPrecipDates.size === 0 || !daily || !Array.isArray(daily.time)) return;
    if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.precipitation)) return;

    const perDate = new Map<string, { sum: number; hours: number; complete: boolean }>();
    (hourly.time as unknown[]).forEach((t, i) => {
        const date = String(t).slice(0, 10);
        if (!regionalPrecipDates.has(date)) return;
        const entry = perDate.get(date) ?? { sum: 0, hours: 0, complete: true };
        const value = (hourly.precipitation as unknown[])[i];
        entry.hours += 1;
        if (typeof value === 'number' && !isNaN(value)) entry.sum += value;
        else entry.complete = false;
        perDate.set(date, entry);
    });

    const current = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : [];
    const totals: Array<number | null> = daily.time.map((_, i) => {
        const existing = current[i];
        return typeof existing === 'number' && !isNaN(existing) ? existing : null;
    });

    let changed = false;
    daily.time.forEach((day, i) => {
        const entry = perDate.get(String(day).slice(0, 10));
        if (!entry || !entry.complete || entry.hours < MIN_DAY_HOURS || entry.hours > MAX_DAY_HOURS) return;
        totals[i] = Math.round(entry.sum * 10) / 10;
        changed = true;
    });

    if (changed) target.daily = { ...daily, precipitation_sum: totals };
};

/** Camps que han de coincidir exactament perquè una hora de la sèrie principal sigui la d'ICON (best_match = ICON). */
const ICON_IDENTITY_FIELDS = ['temperature_2m', 'relative_humidity_2m', 'precipitation'] as const;

/**
 * La sèrie principal d'aquesta hora és una altra que ICON? Sí si algun camp difereix del d'ICON, o si ICON no té
 * aquella hora (valor null: més enllà del seu abast, on el best_match passa a ECMWF) i la sèrie sí. Si coincideixen
 * tots, la sèrie ÉS ICON (Open-Meteo tria ICON com a best_match a molts punts: Girona, Barcelona, Madrid, París...).
 * Si la comparativa d'ICON no porta el camp (no s'ha baixat), no se sap, i es tracta com a no independent.
 */
const isIndependentOfIcon = (hourly: Record<string, unknown>, icon: Record<string, unknown> | undefined, i: number): boolean => {
    if (!icon) return false;
    return ICON_IDENTITY_FIELDS.some(field => {
        const own = (hourly[field] as Array<number | null> | undefined)?.[i];
        if (typeof own !== 'number' || isNaN(own)) return false;
        const other = icon[field];
        if (other === null) return true;
        return typeof other === 'number' && !isNaN(other) && own !== other;
    });
};

/**
 * Evidència de pluja de la SÈRIE PRINCIPAL, a les hores que no porten model regional (els dies de més enllà del seu
 * abast, o tota la previsió on no n'hi ha cap), QUAN aquesta sèrie no és ICON. La probabilitat de pluja d'Open-Meteo
 * és sempre la de l'ensemble d'ICON, però la pluja mostrada és la del best_match, que segons el punt és ICON o un
 * altre model (Météo-France els primers dies i ECMWF 9 km després, a Roses, Perpinyà, Marsella, Bordeus o Bilbao).
 * Llavors eren dues fonts que es contradeien: "0 %" al costat de 0,3 mm (Roses, 27-09-2026: ECMWF 9 km plovia,
 * l'ensemble d'ICON no). Es fa servir la mateixa corba calibrada que amb el model regional (vegeu rainEvidence.ts),
 * sobre la pluja que es MOSTRA a la taula (±1 h), i el dia n'hereta el màxim.
 *
 * On la sèrie és ICON no es toca: la seva pluja ja és dins de la probabilitat del seu propi ensemble, i sumar-la
 * seria comptar-la dues vegades (mesurat: vegeu rainEvidence.ts). Les hores de model regional tampoc (injectHighResModels
 * ja hi ha aplicat la seva evidència), una hora sense probabilitat no se n'inventa cap i mai no es baixa res.
 * No es muten les dades d'entrada.
 */
export const injectBaseRainEvidence = (data: ExtendedWeatherData): ExtendedWeatherData => {
    const hourly = data?.hourly as unknown as Record<string, unknown> | undefined;
    if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.precipitation_probability)) return data;

    const times = hourly.time as unknown[];
    const precip = hourly.precipitation as Array<number | null> | undefined;
    const regionalHours = hourly[REGIONAL_TEMP_FLAG_KEY] as Array<number | null> | undefined;
    const iconHours = data.hourlyComparison?.icon;
    const probs = [...(hourly.precipitation_probability as Array<number | null>)];
    const boostedByDate: BoostedRainProbabilityByDate = new Map();

    times.forEach((t, i) => {
        if (regionalHours?.[i] === 1) return;
        if (!isIndependentOfIcon(hourly, iconHours?.[i], i)) return;
        const current = probs[i];
        if (typeof current !== 'number' || isNaN(current)) return;
        const mm = neighbourhoodPrecip(times, precip, i);
        if (mm === null || mm < MEASURABLE_RAIN_MM) return;
        const updated = rainProbabilityWithModelEvidence(current, mm);
        if (updated > current) {
            probs[i] = updated;
            const date = String(t).slice(0, 10);
            boostedByDate.set(date, Math.max(boostedByDate.get(date) ?? 0, updated));
        }
    });

    if (boostedByDate.size === 0) return data;

    const target: ExtendedWeatherData = {
        ...data,
        hourly: { ...data.hourly, precipitation_probability: probs } as ExtendedWeatherData['hourly']
    };
    injectDailyRainProbability(target, boostedByDate);
    return target;
};

// --- 4. FUNCIÓ PRINCIPAL (Clean Code) ---

export const injectHighResModels = (baseData: ExtendedWeatherData, highResData: ExtendedWeatherData | null, model: RegionalModel): ExtendedWeatherData => {
    if (!baseData) return baseData;
    if (!highResData) return baseData;

    // 1. Shallow Copy (Seguretat)
    const target: ExtendedWeatherData = { ...baseData };
    if (baseData.current) target.current = { ...baseData.current };
    if (baseData.hourly) {
        target.hourly = { ...baseData.hourly };
        Object.keys(target.hourly).forEach((k) => {
            const key = k as keyof StrictHourlyWeather;
            const val = target.hourly![key];
            if (Array.isArray(val)) {
                (target.hourly as Record<string, unknown[]>)[key] = [...val];
            }
        });
    }

    // 2. Neteja i Validació
    const rawCleaned = {
        current: cleanKeys(highResData.current as Record<string, unknown>),
        hourly: { ...cleanKeys(highResData.hourly as Record<string, unknown>), time: highResData.hourly?.time },
        minutely_15: highResData.minutely_15 ? cleanKeys(highResData.minutely_15 as Record<string, unknown>) : undefined
    };

    const validation = RegionalModelCleanedSchema.safeParse(rawCleaned);

    if (!validation.success) {
        console.warn(`⚠️ Regional Model Engine: Invalid structure.`);
        return baseData;
    }

    const source: CleanedSource = validation.data;
    const masterTimeLength = target.hourly?.time?.length || 0;

    // 3. Emplenar buits estructurals
    if (target.hourly && masterTimeLength > 0) {
        (Object.keys(target.hourly) as Array<keyof StrictHourlyWeather>).forEach(key => {
            if (key === 'time') return;
            const arr = target.hourly![key];
            if (Array.isArray(arr)) {
                while (arr.length < masterTimeLength) arr.push(null);
            }
        });
    }

    // 4. Execució modular
    injectCurrent(target, source, model);
    injectMinutely(target, source);
    const hourlyResult = injectHourly(target, source, masterTimeLength);
    injectDailyRainProbability(target, hourlyResult.boostedByDate);
    injectDailyPrecipitationTotal(target, hourlyResult.regionalPrecipDates);

    return target;
};