// src/services/geminiService.ts
import { ExtendedWeatherData, StrictCurrentWeather } from '../types/weatherLogicTypes';
import { prepareContextForAI } from '../utils/aiContext';
import { getHourlyWeatherCode, getHourlyEffectiveCloudCover, getHourlyDisplayTemp, type HourlySeries } from '../utils/hourlyWeatherCode';
import { isMostlyCloudy } from '../utils/rules/cloudRules';
import { isSleetCode } from '../utils/rules/winterRules';
import { resolveDustAdvisory, type DustKind } from '../utils/rules/aerosolRules';
import { getInversionCorrectedApparent, getInversionCorrectedTemp } from '../utils/rules/temperatureCorrections';
import { getSafeMonthFromIso } from '../utils/weatherMath';
import * as Sentry from "@sentry/react";
import { cacheService } from './cacheService'; 
import { 
    GEMINI_PROXY_URL, 
    AI_CACHE_TTL 
} from '../constants/aiConfig';

// --- CONTRACTE D'INTERFÍCIES (RISC ZERO AMB MÀXIMA PRECISIÓ TÈRMICA) ---

export type TacticalRiskLevel = 'GREEN' | 'AMBER' | 'RED';
export type TacticalHazardType = 'NONE' | 'WIND' | 'RAIN' | 'THERMAL' | 'HEAT' | 'COLD' | 'CONVECTIVE' | 'VISIBILITY' | 'SNOW_ICE' | 'AIR_QUALITY';
export type TacticalTipCategory = 'SKY' | 'THERMAL' | 'WIND' | 'HAZARD';

export interface TacticalTip {
    category: TacticalTipCategory;
    text: string;
}

export interface AICacheData {
    risk_level: TacticalRiskLevel;
    hazard_type: TacticalHazardType;
    tactical_reasoning?: string;
    text: string;
    tips: TacticalTip[];
    // Quin motor ha generat aquesta anàlisi. Es guarda també a la cache,
    // així una resposta servida des de cache manté la seva procedència real.
    engine?: 'gemini' | 'groq' | 'emergency' | 'unknown';
}

interface RawLLMResponse {
    risk_level?: unknown;
    hazard_type?: unknown;
    tactical_reasoning?: unknown;
    text?: unknown;
    tips?: unknown;
}

type LocatableData = {
    latitude?: number;
    longitude?: number;
    location?: { latitude?: number; longitude?: number };
    timezone?: string;
    utc_offset_seconds?: number;
    model?: string;
    model_name?: string;
};

interface ModelTacticalInfo {
    name: string;
    type: 'HD_LOCAL' | 'GLOBAL' | 'ESTANDARD';
    description: string;
}

/**
 * RESOLUCIÓ HORÀRIA (BLINDADA CONTRA DOUBLE-OFFSET I COMPATIBLE AMB fusos horaris)
 */
const getTacticalHourStr = (
    timeRaw: number | string, 
    timezone?: string, 
    utcOffsetSeconds?: number
): string => {
    try {
        if (typeof timeRaw === 'string') {
            const hasExplicitTz = timeRaw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timeRaw);
            if (!hasExplicitTz) {
                const match = timeRaw.match(/T?(\d{2}:\d{2})/);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }

        if (timezone && typeof timeRaw === 'number') {
            const formatter = new Intl.DateTimeFormat('ca-ES', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            return formatter.format(new Date(timeRaw * 1000));
        }

        if (timezone && typeof timeRaw === 'string') {
            const date = new Date(timeRaw);
            if (!isNaN(date.getTime())) {
                const formatter = new Intl.DateTimeFormat('ca-ES', {
                    timeZone: timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                return formatter.format(date);
            }
        }

        if (typeof timeRaw === 'number') {
            const offset = utcOffsetSeconds ?? 0;
            const locationDate = new Date((timeRaw + offset) * 1000);
            const hours = locationDate.getUTCHours().toString().padStart(2, '0');
            const minutes = locationDate.getUTCMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        return "--:--";
    } catch {
        return "--:--";
    }
};

/**
 * IDENTIFICACIÓ CLARA DE MODELS
 */
const getTacticalModelInfo = (weatherData: ExtendedWeatherData): ModelTacticalInfo => {
    try {
        const safeData = weatherData as unknown as Record<string, unknown>;
        const currentObj = safeData.current as Record<string, unknown> | undefined;
        const hourlyObj = safeData.hourly as Record<string, unknown> | undefined;

        const rawModel = safeData.model ?? safeData.model_name ?? currentObj?.model ?? hourlyObj?.model ?? "Estàndard";
        const modelStr = String(rawModel).trim();
        const modelLower = modelStr.toLowerCase();

        if (/arome|wrf|harmonie|icon_d2|icon-d2|ukmo_2km|hrrr|cosmo/i.test(modelLower)) {
            return {
                name: modelStr.toUpperCase(),
                type: 'HD_LOCAL',
                description: "Model d'alta precisió local. Molt fiable per a vents de vall, orografia i tempestes ràpides."
            };
        }

        if (/ecmwf|gfs|icon|gem|cfs|arpege/i.test(modelLower)) {
            return {
                name: modelStr.toUpperCase(),
                type: 'GLOBAL',
                description: "Model global general. Molt fiable per veure l'evolució del dia i estabilitat regional."
            };
        }

        return {
            name: modelStr !== "Estàndard" ? modelStr : "Model Integrat",
            type: 'ESTANDARD',
            description: "Dades meteorològiques combinades d'alta precisió."
        };
    } catch {
        return {
            name: "Model Integrat",
            type: 'ESTANDARD',
            description: "Dades meteorològiques combinades d'alta precisió."
        };
    }
};

/**
 * DESXIFRATGE WMO ENTENEDOR
 */
const getTacticalWeatherDescription = (code: number | null | undefined, temp: number | null | undefined = null, cloudCover: number | null | undefined = null): string => {
    if (code === null || code === undefined) return "Estat del cel no determinat";
    
    const isFreezing = temp !== null && temp !== undefined && temp <= 3.0;

    switch (code) {
        case 0: return "Cel ras / Completament serè";
        case 1: return "Majoritàriament serè (pocs núvols)";
        // Mateix criteri que la capçalera i les icones: dins del 2, per sobre de CLOUDS.MOSTLY_CLOUDY és "molt ennuvolat".
        case 2: return isMostlyCloudy(code, cloudCover) ? "Molt ennuvolat (cel majoritàriament tapat, amb clarianes)" : "Parcialment ennuvolat (cel variable)";
        case 3: return "Cobert (cel completament tapat)";
        case 45: return "Boira o boira baixa (Visibilitat reduïda)";
        case 48: return !isFreezing ? "Boira densa o humitat alta" : "Boira gebradora (Risc de gel o gebre)";
        case 51:
        case 53:
        case 55: return "Plugim feble o continu";
        case 56:
        case 57: return !isFreezing ? "Plugim intens" : "Plugim gelant (Risc de gel humit al terra)";
        case 61:
        case 63:
        case 65: return "Pluja contínua (Feble, moderada o forta)";
        case 66:
        case 67: return !isFreezing ? "Pluja contínua intensa" : "Pluja gelant (Risc alt de gel al terra)";
        // Aiguaneu (68 feble, 69 moderat/fort): el deriva l'app (Open-Meteo no el publica) a la franja
        // 1-4 °C amb la cota de gel prop del terra. Sense aquest cas la IA rebia el text literal "Codi WMO 69".
        case 68:
        case 69: return "Aiguaneu (Pluja i neu barrejades; superfícies relliscoses)";
        case 71:
        case 73:
        case 75: return !isFreezing ? "Pluja moderada o intensa" : "Nevada contínua (Feble, moderada o copiosa)";
        case 77: return !isFreezing ? "Ruixats febles" : "Neu granulada / Granissa feble";
        case 80:
        case 81:
        case 82: return "Ruixats o xàfecs de pluja (Arribada ràpida)";
        case 85:
        case 86: return !isFreezing ? "Ruixats de pluja intensos" : "Ruixats de neu intensos o torb";
        case 95: return "Tempesta (Risc de llamps i vent fort)";
        case 96:
        case 99: return "Tempesta forta amb pedra o granissa";
        default: return `Codi WMO ${code}`;
    }
};

/**
 * ANÀLISI DE QUALITAT DE L'AIRE (AQI)
 * Les bandes viuen en una sola taula: la descripció que llegeix la IA i la banda que entra a la clau de cache
 * (vegeu getGeminiAnalysis) surten de la mateixa font, i no es poden desincronitzar.
 */
const AQI_BANDS: Record<'EU' | 'US', ReadonlyArray<{ max: number; label: string }>> = {
    EU: [
        { max: 20, label: 'Bona / Aire net' },
        { max: 40, label: 'Acceptable' },
        { max: 60, label: 'Moderada / Regular' },
        { max: 80, label: 'Deficient / Mala qualitat' },
        { max: 100, label: 'Molt deficient / Precaució gent sensible' },
    ],
    US: [
        { max: 50, label: 'Bona / Aire net' },
        { max: 100, label: 'Moderada / Acceptable' },
        { max: 150, label: 'Desfavorable per a persones sensibles' },
        { max: 200, label: 'Deficient / Insalubre' },
    ],
};
const AQI_ALERT_LABEL: Record<'EU' | 'US', string> = {
    EU: "ALERTA: Qualitat de l'aire dolenta / Contaminació alta",
    US: "ALERTA: Qualitat de l'aire dolenta / Pols o calima alta",
};

/** Índex de banda (0 = la millor; bands.length = "ALERTA"), o -1 si no hi ha dada. */
const getAqiBandIndex = (aqi: number | null | undefined, scale: 'EU' | 'US'): number => {
    if (aqi === null || aqi === undefined || aqi < 0) return -1;
    const idx = AQI_BANDS[scale].findIndex(b => aqi <= b.max);
    return idx === -1 ? AQI_BANDS[scale].length : idx;
};

const getTacticalAqiDescription = (aqi: number | null | undefined, scale: 'EU' | 'US' = 'EU'): string => {
    const band = getAqiBandIndex(aqi, scale);
    if (band === -1) return "N/D";
    const label = band < AQI_BANDS[scale].length ? AQI_BANDS[scale][band].label : AQI_ALERT_LABEL[scale];
    return `${aqi} (${label})`;
};

/**
 * CONFORT TÈRMIC CONCÌS I DIRECTE
 */
const getTacticalComfortDescription = (
    temp: number | null | undefined, 
    apparentTemp: number | null | undefined, 
    humidity: number | null | undefined
): string => {
    if (temp === null || temp === undefined || apparentTemp === null || apparentTemp === undefined) {
        return "Dades de temperatura incompletes";
    }
    
    const diff = apparentTemp - temp;
    const humStr = (humidity !== null && humidity !== undefined) ? `${humidity}%` : "N/D";

    if (temp >= 24 && diff >= 2.0) {
        if (apparentTemp >= 38) {
            return `ALERTA PER CALOR INTENSA (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
        }
        if (apparentTemp >= 32) {
            return `CALOR I XAFOGOR (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
        }
        return `Calor humida (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
    }

    if (temp <= 12 && diff <= -2.5) {
        return `FRED INTENS PEL VENT (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
    }

    return `Confort tèrmic normal (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
};

/**
 * --- TALLAFOCS DETERMINISTA (DOCTRINA RISC ZERO) ---
 */
// Compartida entre la intervenció normal (resposta fresca de la IA) i la
// revalidació sobre una resposta servida des de cache — vegeu getGeminiAnalysis.
const RISK_HIERARCHY: Record<TacticalRiskLevel, number> = { 'GREEN': 0, 'AMBER': 1, 'RED': 2 };

/** Latitud de la ubicació (sense ella no es pot saber quin hemisferi és a l'hivern); undefined si falta. */
const resolveLatitude = (weatherData: ExtendedWeatherData): number | undefined => {
    const d = weatherData as unknown as LocatableData;
    const lat = d.latitude ?? d.location?.latitude;
    return typeof lat === 'number' && !isNaN(lat) ? lat : undefined;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Pluja horària mínima per comptar l'hora com "amb pluja": el mateix 0,2 mm que usa l'app per dir que plou (aiContext.calculateIsRaining). */
const RAIN_HOUR_MIN_MM = 0.2;

/**
 * `dustKind`: l'avís de pols/partícules d'ARA (resolveDustAdvisory). El prompt del worker diu que amb la línia
 * "Aerosols" el risc és AMBER / AIR_QUALITY, però Gemini Flash-Lite no ho complia de manera estable: amb les
 * mateixes dades sortia GREEN, GREEN i AMBER en tres crides seguides, i segons l'idioma. Com la resta de perills,
 * la regla és determinista aquí i la IA només la redacta.
 */
const evaluateDeterministicRisk = (
    weatherData: ExtendedWeatherData,
    startIndex: number,
    endIndex: number,
    dustKind: DustKind = null
): { risk: TacticalRiskLevel, hazard: TacticalHazardType | null } => {
    let maxRisk: TacticalRiskLevel = 'GREEN';
    let detectedHazard: TacticalHazardType | null = null;

    try {
        const hourly = weatherData.hourly as unknown as HourlySeries | undefined;
        if (!hourly) return { risk: 'GREEN', hazard: null };

        const wmoArr = (hourly.weather_code ?? hourly.weathercode) as (number | null)[] | undefined;
        const gustsArr = hourly.wind_gusts_10m as (number | null)[] | undefined;
        const precipArr = hourly.precipitation as (number | null)[] | undefined;
        const elevation = typeof weatherData.elevation === 'number' ? weatherData.elevation : 0;
        const latitude = resolveLatitude(weatherData);

        const upgradeRisk = (newRisk: TacticalRiskLevel, newHazard: TacticalHazardType) => {
            const hierarchy = { 'GREEN': 0, 'AMBER': 1, 'RED': 2 };
            // Només sobreescrivim l'hazard quan la severitat puja estrictament,
            // o quan encara no n'hi ha cap assignat. Abans, un '>=' feia que
            // dues hores amb el mateix nivell de risc "es robessin" l'hazard
            // l'una a l'altra segons l'ordre del bucle (guanyava sempre la
            // darrera detectada, no la primera).
            if (hierarchy[newRisk] > hierarchy[maxRisk]) {
                maxRisk = newRisk;
                detectedHazard = newHazard;
            } else if (detectedHazard === null && hierarchy[newRisk] === hierarchy[maxRisk]) {
                detectedHazard = newHazard;
            }
        };

        for (let i = startIndex; i < endIndex; i++) {
            const wmo = wmoArr?.[i];
            const gust = gustsArr?.[i];
            // La temperatura que veu l'usuari (amb la correcció d'inversió), no la crua del model: una nit serena i
            // en calma d'hivern amb +2 °C al model i -1 °C a la pantalla és una nit de gelada, i la IA no la veia.
            const temp = getHourlyDisplayTemp(hourly, i, latitude);
            const precip = precipArr?.[i];

            // Tempesta i neu/gel: es mantenen sobre el codi BRUT del model (doctrina "les dades
            // crues sempre guanyen": és millor un avís de més que un de menys).
            const rawSevere = wmo !== undefined && wmo !== null;
            if (rawSevere && (wmo === 95 || wmo === 96 || wmo === 99)) upgradeRisk(wmo === 99 ? 'RED' : 'AMBER', 'CONVECTIVE');
            else if (rawSevere && [56, 57, 66, 67, 71, 73, 75, 77, 85, 86].includes(wmo as number)) upgradeRisk('AMBER', 'SNOW_ICE');
            else {
                // Boira: NOMÉS si la política de boira la confirma (senyal del model + saturació
                // de superfície, vegeu visibilityRules.resolveFog). El codi 45/48 brut d'ICON
                // dona ~4 vegades més hores de boira de les reals i posava AMBER a la ciutat
                // amb el cel serè; el mateix codi que veu l'usuari a la icona és el que compta.
                const engineCode = getHourlyWeatherCode(hourly, i, elevation, weatherData.hourlyComparison);
                // La gebradora (48) diposita gebre i deixa gel a terra: el risc dominant és el de gel.
                if (engineCode === 48) upgradeRisk('AMBER', 'SNOW_ICE');
                else if (engineCode === 45) upgradeRisk('AMBER', 'VISIBILITY');
                // Aiguaneu (68/69): el deriva l'app a partir d'un codi de pluja brut (Open-Meteo no el publica),
                // així que el filtre del codi brut d'aquí dalt no el veu. Pluja i neu barrejades a 1-4 °C deixen
                // les superfícies relliscoses (mateix perill que la neu o el gel), i és el que veu l'usuari.
                else if (engineCode !== null && isSleetCode(engineCode)) upgradeRisk('AMBER', 'SNOW_ICE');
            }

            // Pluja en mm/h independent del codi WMO (abans no hi havia cap
            // comprovació de precipitació aquí: una pluja contínua forta sense
            // classificar-se com a tempesta no activava mai el tallafocs).
            // Es comprova després del WMO perquè, si la mateixa hora ja és
            // CONVECTIVE/SNOW_ICE/VISIBILITY, aquell hazard més específic té
            // preferència sobre un "RAIN" genèric quan empaten en severitat.
            if (typeof precip === 'number') {
                if (precip > 20) upgradeRisk('RED', 'RAIN');
                else if (precip >= 5) upgradeRisk('AMBER', 'RAIN');
            }

            if (typeof gust === 'number') {
                if (gust >= 80) upgradeRisk('RED', 'WIND');
                else if (gust >= 50) upgradeRisk('AMBER', 'WIND');
            }

            if (typeof temp === 'number') {
                if (temp >= 40) upgradeRisk('RED', 'HEAT');
                else if (temp >= 35) upgradeRisk('AMBER', 'HEAT');
                // -10 °C: el llindar RED del prompt del worker (T <= -10ºC). Aquí hi havia -8, més antic que el prompt.
                else if (temp <= -10) upgradeRisk('RED', 'COLD');
                else if (temp <= 0) upgradeRisk('AMBER', 'COLD');
            }
        }

        // Després del bucle: en un empat d'AMBER, un perill meteorològic (vent, pluja...) té preferència sobre l'aire.
        if (dustKind !== null) upgradeRisk('AMBER', 'AIR_QUALITY');
    } catch (e) {
        console.warn("⚠️ Error en l'avaluació matemàtica del tallafocs", e);
    }

    return { risk: maxRisk, hazard: detectedHazard };
};

interface WindowRow {
    hour: string;
    temp: number | null;
    gust: number | null;
    precip: number;
    prob: number;
}

/**
 * Xifres exactes de la finestra (mínima/màxima, ràfega màxima, pluja total/pic/inici/final), calculades aquí.
 * Abans la IA les havia de treure de la taula i les llegia malament: amb 14, 17, 20 i 23 mm/h escrivia
 * "acumulacions de 23 mil·límetres" quan en queien ~80, i amb pluja a partir de les 12:00 deia "intermitent"
 * sense cap hora. Els models petits no sumen ni troben màxims de manera fiable.
 */
const buildWindowSummary = (rows: WindowRow[]): string => {
    if (rows.length === 0) return '';
    const lines: string[] = [];
    const at = (i: number) => (i === 0 ? `${rows[i].hour}, ara` : rows[i].hour);

    const temps = rows.map((r, i) => ({ i, v: r.temp })).filter((x): x is { i: number; v: number } => x.v !== null);
    if (temps.length > 0) {
        const lo = temps.reduce((a, b) => (b.v < a.v ? b : a));
        const hi = temps.reduce((a, b) => (b.v > a.v ? b : a));
        lines.push(`Temperatura: mínima ${lo.v}ºC (${at(lo.i)}) | màxima ${hi.v}ºC (${at(hi.i)})`);
    }

    const gusts = rows.map((r, i) => ({ i, v: r.gust })).filter((x): x is { i: number; v: number } => x.v !== null);
    if (gusts.length > 0) {
        const top = gusts.reduce((a, b) => (b.v > a.v ? b : a));
        lines.push(`Ràfega màxima: ${top.v}km/h (${at(top.i)})`);
    }

    const wet = rows.map((r, i) => ({ i, v: r.precip })).filter(x => x.v >= RAIN_HOUR_MIN_MM);
    if (wet.length === 0) {
        lines.push(`Pluja: cap hora amb pluja apreciable (totes < ${RAIN_HOUR_MIN_MM}mm/h)`);
    } else {
        const total = round1(wet.reduce((s, x) => s + x.v, 0));
        const peak = wet.reduce((a, b) => (b.v > a.v ? b : a));
        const first = wet[0].i;
        const last = wet[wet.length - 1].i;
        const notes: string[] = [];
        if (wet.length < last - first + 1) notes.push('amb pauses');
        if (last === rows.length - 1) notes.push('continua al final de la finestra');
        // La intensitat (mm/h) va PRIMER i el total etiquetat com a acumulat: amb "26mm en total" davant, Gemini el comparava
        // amb el llindar RED de "> 20 mm/h" i escalava a RED una tempesta de només 8 mm/h.
        lines.push(`Pluja: intensitat màxima ${round1(peak.v)}mm/h (${at(peak.i)}) | acumulat de totes les hores ${total}mm (no és una intensitat) | hores amb pluja: de ${at(first)} a ${at(last)}${notes.length ? ` (${notes.join('; ')})` : ''}`);
    }

    lines.push(`Probabilitat màxima de pluja: ${Math.max(...rows.map(r => r.prob))}%`);
    return lines.join('\n          ');
};

/** Qualitat de l'aire de l'API d'aire d'Open-Meteo (es carrega a part de la previsió): la forma mínima que la IA en llegeix. */
export interface AiAirQualityInput {
    current?: Record<string, unknown>;
    hourly?: Record<string, unknown>;
}

/**
 * `effectiveCode`: el codi de temps que veu l'usuari a la capçalera (ja passat per la política de
 * boira i la resta de l'orquestrador). Si falta, es cau al codi brut del model.
 * `aqiData`: qualitat de l'aire. NO ve dins la previsió, així que abans la IA rebia sempre
 * "Qualitat Aire: N/D" i no podia parlar de contaminació ni de calima.
 * `effectiveCloudCover`: % efectiu de núvols d'"ara" (el que decideix el codi de cel), perquè el cel actual
 * es descrigui igual que a la capçalera ("Molt ennuvolat" dins del codi 2). Les hores de la taula el
 * calculen de la seva pròpia sèrie.
 */
export const getGeminiAnalysis = async (
    weatherData: ExtendedWeatherData,
    language: string,
    effectiveCode: number | null = null,
    aqiData: AiAirQualityInput | null = null,
    effectiveCloudCover: number | null = null
): Promise<AICacheData | null> => {
    if (!GEMINI_PROXY_URL || GEMINI_PROXY_URL.includes("EL_TEU_SUBDOMINI")) {
        console.warn("⚠️ IA Desactivada: Manca configuració PROXY_URL"); 
        return null;
    }

    try {
        if (!weatherData?.current || !weatherData.hourly || !weatherData.daily) return null;

        const context = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
        if (!context) return null;

        const safeData = weatherData as unknown as LocatableData;
        const lat = safeData.latitude ?? safeData.location?.latitude ?? 0;
        const lon = safeData.longitude ?? safeData.location?.longitude ?? 0;
        const tz = safeData.timezone;
        const utcOffset = safeData.utc_offset_seconds;
        
        const isDayRaw = (weatherData.current as Record<string, unknown>).is_day;
        const isDay = typeof isDayRaw === 'number' ? isDayRaw : 1;
        const descripcioPeriole = isDay === 1 ? "DIA (Llum solar activa)" : "NIT (Fosc, sense radiació solar)";

        const modelInfo = getTacticalModelInfo(weatherData);

        const currentObj = weatherData.current as Record<string, unknown>;
        const hourlyObj = weatherData.hourly as Record<string, unknown>;

        const currentTempNum = typeof weatherData.current.temperature_2m === 'number' ? weatherData.current.temperature_2m : null;
        const currentWmoCode = typeof currentObj.weather_code === 'number' ? currentObj.weather_code : (typeof currentObj.weathercode === 'number' ? currentObj.weathercode : null);
        const currentUv = typeof currentObj.uv_index === 'number' ? currentObj.uv_index : (typeof currentObj.uv_index_max === 'number' ? currentObj.uv_index_max : null);
        const currentApparentTemp = typeof currentObj.apparent_temperature === 'number' ? currentObj.apparent_temperature : null;
        const currentHumidity = typeof currentObj.relative_humidity_2m === 'number' ? currentObj.relative_humidity_2m : (typeof currentObj.humidity === 'number' ? currentObj.humidity : null);

        // La qualitat de l'aire ve de l'API d'aire (aqiData); els camps de la previsió queden com a reserva.
        const aqiCurrentObj: Record<string, unknown> = aqiData?.current ?? {};
        const aqiHourlyObj: Record<string, unknown> = aqiData?.hourly ?? {};
        const pickNum = (...vals: unknown[]): number | null => {
            for (const v of vals) if (typeof v === 'number' && !isNaN(v)) return v;
            return null;
        };
        const currentEuAqi = pickNum(aqiCurrentObj.european_aqi, currentObj.european_aqi);
        const currentUsAqi = pickNum(aqiCurrentObj.us_aqi, currentObj.us_aqi);
        const hasEuAqi = currentEuAqi !== null || Array.isArray(aqiHourlyObj.european_aqi) || Array.isArray(hourlyObj.european_aqi);
        const aqiScale: 'EU' | 'US' = hasEuAqi ? 'EU' : 'US';
        const currentAqi = currentEuAqi ?? currentUsAqi;

        // Avís d'aerosols (pols/partícules del CAMS, vegeu utils/rules/aerosolRules.ts): només s'afegeix a la
        // telemetria quan salta. La línia diu explícitament que NO és visibilitat ni boira: amb la formulació
        // anterior ("el cel pot veure's enterbolit"), Gemini triava VISIBILITY ("BOIRA DENSA O VISIBILITAT
        // REDUÏDA") en un lloc amb HR del 12 %, perquè llavors el worker no tenia cap perill de qualitat de
        // l'aire; ara hi és (AIR_QUALITY) i la línia hi apunta. Amb els METAR, la pols només baixa la
        // visibilitat observada en el 13 % de les hores en què salta l'avís.
        const dustAdvisory = resolveDustAdvisory(aqiCurrentObj, currentHumidity, typeof currentObj.precipitation === 'number' ? currentObj.precipitation : null);
        const aerosolLine = dustAdvisory.kind === 'dust'
            ? `
          Aerosols: POLS EN SUSPENSIÓ (calima) — pols ${Math.round(dustAdvisory.dust ?? 0)} µg/m³. Mesura de qualitat de l'aire (salut), NO de visibilitat ni de boira: no en derivis boira ni visibilitat reduïda.`
            : dustAdvisory.kind === 'particles'
                ? `
          Aerosols: PARTÍCULES EN SUSPENSIÓ — PM10 ${Math.round(dustAdvisory.pm10 ?? 0)} µg/m³. Mesura de qualitat de l'aire (salut), NO de visibilitat ni de boira: no en derivis boira ni visibilitat reduïda.`
                : '';

        const currentTimeRaw = currentObj?.time;
        const currentHourStr = (typeof currentTimeRaw === 'string' || typeof currentTimeRaw === 'number')
            ? getTacticalHourStr(currentTimeRaw, tz, utcOffset)
            : getTacticalHourStr(Math.floor(Date.now() / 1000), tz, utcOffset);

        // Temperatura d'"ara" tal com la mostra la capçalera (amb la correcció d'inversió), no la crua del model.
        const latitude = resolveLatitude(weatherData);
        const currentDisplayTemp = currentTempNum !== null
            ? round1(getInversionCorrectedTemp(
                weatherData.current as unknown as StrictCurrentWeather,
                getSafeMonthFromIso(typeof currentTimeRaw === 'string' ? currentTimeRaw : undefined),
                latitude
            ))
            : null;
        // Sensació d'"ara" com la de la capçalera: amb la mateixa correcció d'inversió que la temperatura.
        const currentDisplayApparentRaw = getInversionCorrectedApparent(currentApparentTemp, currentTempNum, currentDisplayTemp);
        const currentDisplayApparent = currentDisplayApparentRaw !== null ? round1(currentDisplayApparentRaw) : null;
        const currentPrecipStr = typeof currentObj.precipitation === 'number' ? `${currentObj.precipitation}mm` : 'N/D';

        // La resposta en cache s'ha d'haver generat per a la MATEIXA situació, no només per al mateix lloc: sense això, si
        // a les 10:00 fa sol i a les 10:40 comença a ploure, dins l'hora de cache la IA seguia dient "cel serè" (i GREEN)
        // mentre la capçalera ja mostrava pluja. Són els mateixos senyals que fan tornar a cridar el hook (useWeatherAI).
        const situationKey = [
            effectiveCode ?? currentWmoCode ?? 'x',
            isMostlyCloudy(effectiveCode ?? currentWmoCode, effectiveCloudCover) ? 'mc' : 'c',
            dustAdvisory.kind ?? 'n',
            getAqiBandIndex(currentAqi, aqiScale)
        ].join('-');
        const elevationKey = context.location.elevation.toString();
        const cacheKey = cacheService.generateAiKey(`${elevationKey}_${modelInfo.name}_${situationKey}`, lat, lon, language);

        // [FIX PRECISIÓ] Finestra d'avaluació (properes ~6h) calculada ABANS de
        // consultar la cache, perquè el tallafocs determinista pugui revalidar-se
        // també en un cache hit (vegeu més avall) — abans només s'executava en
        // una resposta fresca de la IA. La cache d'IA dura fins a 60 min mentre
        // que les dades meteo es refresquen cada 15 min: sense això, un perill
        // que apareix als últims ~45 min d'una finestra de cache no activava mai
        // el tallafocs fins que la pròpia cache expirava.
        const computeEvalWindow = (): { start: number; end: number } => {
            if (!weatherData.hourly || !Array.isArray(weatherData.hourly.time) || weatherData.hourly.time.length === 0) {
                return { start: 0, end: 0 };
            }
            const times = weatherData.hourly.time;
            let startIndex = -1;

            if (currentTimeRaw !== undefined && currentTimeRaw !== null) {
                startIndex = times.findIndex(t => t === currentTimeRaw);
                if (startIndex === -1 && typeof currentTimeRaw === 'string') {
                    startIndex = times.findIndex(t => String(t).localeCompare(String(currentTimeRaw)) >= 0);
                }
            }

            if (startIndex === -1) {
                const nowMs = Date.now();
                const utcOffsetMs = (utcOffset || 0) * 1000;

                startIndex = times.findIndex(t => {
                    if (typeof t === 'number') {
                        return (t * 1000) >= nowMs - (30 * 60 * 1000);
                    } else {
                        const str = String(t);
                        const hasTz = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str);
                        if (hasTz) {
                            return new Date(str).getTime() >= nowMs - (30 * 60 * 1000);
                        } else {
                            const fakeUtcMs = new Date(`${str}Z`).getTime();
                            const trueUtcMs = fakeUtcMs - utcOffsetMs;
                            return !isNaN(trueUtcMs) && trueUtcMs >= nowMs - (30 * 60 * 1000);
                        }
                    }
                });
            }

            if (startIndex === -1) startIndex = 0;
            const endIndex = Math.min(startIndex + 6, times.length);
            return { start: startIndex, end: endIndex };
        };

        const { start: evalStartIndex, end: evalEndIndex } = computeEvalWindow();

        try {
            const cachedData = await cacheService.get<AICacheData>(cacheKey, AI_CACHE_TTL);
            if (cachedData) {
                // Revalidem el tallafocs contra les dades ACTUALS (no les que hi
                // havia quan es va generar la resposta en cache). És un simple
                // escombratge d'arrays, barat, i és exactament el que garanteix
                // que "les dades crues sempre guanyen" també dins la finestra
                // de cache, no només en una crida fresca a la IA.
                try {
                    const deterministicEval = evaluateDeterministicRisk(weatherData, evalStartIndex, evalEndIndex, dustAdvisory.kind);
                    if (RISK_HIERARCHY[deterministicEval.risk] > RISK_HIERARCHY[cachedData.risk_level]) {
                        console.warn(`🛡️ TALLAFOCS (revalidat sobre cache): les dades actuals forcen '${deterministicEval.risk}' per '${deterministicEval.hazard}' — la cache encara deia '${cachedData.risk_level}'.`);
                        return {
                            ...cachedData,
                            risk_level: deterministicEval.risk,
                            hazard_type: deterministicEval.hazard ?? cachedData.hazard_type
                        };
                    }
                } catch (evalError) {
                    console.warn("⚠️ Error revalidant el tallafocs sobre la resposta en cache:", evalError);
                }
                return cachedData;
            }
        } catch (dbError) {
            console.warn("⚠️ Error llegint Cache IA:", dbError);
        }

        let finestraPrevista = "Sense dades horàries.";
        let windowSummary = '';

        if (weatherData.hourly && Array.isArray(weatherData.hourly.time) && weatherData.hourly.time.length > 0) {
            const times = weatherData.hourly.time;
            const startIndex = evalStartIndex;
            const endIndex = evalEndIndex;

            const tableRows: string[] = [
                "| HORA | ESTAT DEL CEL | TEMP | SENSACIÓ | HUMITAT | PLUJA (PROB%) | VENT (RÀFEGUES) | UV | AQI |",
                "|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|"
            ];

            const hourlyElevation = typeof weatherData.elevation === 'number' ? weatherData.elevation : 0;
            const windowRows: WindowRow[] = [];
            const windArr = weatherData.hourly.wind_speed_10m as (number | null)[] | undefined;
            const gustsArr = weatherData.hourly.wind_gusts_10m as (number | null)[] | undefined;
            const precipArr = weatherData.hourly.precipitation as (number | null)[] | undefined;
            const probArr = weatherData.hourly.precipitation_probability as (number | null)[] | undefined;

            // Qualitat de l'aire per hores: s'alinea pel TEXT de l'hora ("2026-09-19T03:00", tots dos amb timezone
            // auto), no per índex, perquè les dues sèries no tenen per què començar a la mateixa hora.
            const aqiIndexByTime = new Map<string, number>();
            if (Array.isArray(aqiHourlyObj.time)) {
                aqiHourlyObj.time.forEach((t: unknown, j: number) => { if (typeof t === 'string') aqiIndexByTime.set(t, j); });
            }
            const aqiSeries = (aqiHourlyObj.european_aqi ?? aqiHourlyObj.us_aqi) as (number | null)[] | undefined;

            for (let i = startIndex; i < endIndex; i++) {
                const timeRaw = times[i];
                if (timeRaw === undefined || timeRaw === null) continue;

                const hourStr = getTacticalHourStr(timeRaw, tz, utcOffset);
                // Temperatura mostrada (amb la correcció d'inversió), arrodonida al dècim: el càlcul dona xifres llargues.
                const tempDisplay = getHourlyDisplayTemp(hourlyObj as HourlySeries, i, latitude);
                const tempNum = tempDisplay !== null ? round1(tempDisplay) : null;
                const tempStr = tempNum !== null ? tempNum : '--';
                
                const windHour = windArr?.[i];
                const windStr = typeof windHour === 'number' ? windHour : '--';
                
                const gustsHour = gustsArr?.[i];
                const gustsStr = typeof gustsHour === 'number' ? gustsHour : '--';
                
                const precipHour = precipArr?.[i];
                const precipStr = typeof precipHour === 'number' ? precipHour : 0;
                
                const probHour = probArr?.[i];
                const probStr = typeof probHour === 'number' ? probHour : 0;

                // Mateix codi que les icones de l'app (utils/hourlyWeatherCode.ts); si l'hora no té
                // temperatura real, l'orquestrador no dona codi i es cau al brut del model.
                const wmoArr = (hourlyObj.weather_code ?? hourlyObj.weathercode) as (number | null)[] | undefined;
                const wmoHour = getHourlyWeatherCode(hourlyObj, i, hourlyElevation, weatherData.hourlyComparison) ?? wmoArr?.[i] ?? null;
                const wmoDesc = getTacticalWeatherDescription(wmoHour, tempNum, getHourlyEffectiveCloudCover(hourlyObj as HourlySeries, i));

                // Sensació amb la mateixa correcció d'inversió que la columna TEMP (vegeu getInversionCorrectedApparent).
                const apparentArr = (hourlyObj.apparent_temperature) as (number | null)[] | undefined;
                const rawTempArr = hourlyObj.temperature_2m as (number | null)[] | undefined;
                const apparentHour = getInversionCorrectedApparent(apparentArr?.[i], rawTempArr?.[i], tempDisplay);
                const apparentStr = apparentHour !== null ? `${round1(apparentHour)}ºC` : "--ºC";

                const humArr = (hourlyObj.relative_humidity_2m ?? hourlyObj.humidity) as (number | null)[] | undefined;
                const humHour = humArr?.[i] ?? null;
                const humStr = humHour !== null ? `${humHour}%` : "--%";

                const uvArr = (hourlyObj.uv_index ?? hourlyObj.uv_index_max) as (number | null)[] | undefined;
                const uvHour = uvArr?.[i] ?? (isDay === 0 ? 0 : null);
                const uvStr = uvHour !== null ? `${uvHour}` : "N/D";

                const aqiArr = (hourlyObj.european_aqi ?? hourlyObj.us_aqi) as (number | null)[] | undefined;
                const aqiJ = typeof timeRaw === 'string' ? aqiIndexByTime.get(timeRaw) : undefined;
                const aqiHour = aqiArr?.[i] ?? (aqiJ !== undefined ? aqiSeries?.[aqiJ] : null) ?? null;
                const aqiStr = getTacticalAqiDescription(aqiHour, aqiScale);

                tableRows.push(`| ${hourStr} | ${wmoDesc} | ${tempStr}ºC | ${apparentStr} | ${humStr} | ${precipStr}mm (${probStr}%) | ${windStr}km/h (${gustsStr}km/h) | ${uvStr} | ${aqiStr} |`);
                windowRows.push({
                    hour: hourStr,
                    temp: tempNum,
                    gust: typeof gustsHour === 'number' ? gustsHour : null,
                    precip: precipStr,
                    prob: probStr
                });
            }
            finestraPrevista = tableRows.join('\n');
            windowSummary = buildWindowSummary(windowRows);
        }

        // Prompt descarregat d'instruccions: Només telemetria en brut per al Worker
        const prompt = `
          TELEMETRIA TÀCTICA EN TEMPS REAL - HORITZÓ 6 HORES:
          
          HORA LOCAL ACTUAL A LA ZONA: ${currentHourStr} (${descripcioPeriole})
          Estat del Cel: ${getTacticalWeatherDescription(effectiveCode ?? currentWmoCode, currentTempNum, effectiveCloudCover)}
          Temperatura Real: ${currentDisplayTemp !== null ? `${currentDisplayTemp}ºC` : 'N/D'} | Humitat Relativa: ${currentHumidity !== null ? `${currentHumidity}%` : 'N/D'}
          Confort Tèrmic: ${getTacticalComfortDescription(currentDisplayTemp, currentDisplayApparent, currentHumidity)}
          Pluja actual: ${currentPrecipStr} | Índex UV: ${currentUv !== null ? currentUv : 'N/D'} | Qualitat Aire: ${getTacticalAqiDescription(currentAqi, aqiScale)}${aerosolLine}
          MODEL EN ÚS: ${modelInfo.name}
${windowSummary ? `
          RESUM CALCULAT DE LA FINESTRA (xifres exactes: usa-les tal qual, no sumis ni recalculis):
          ${windowSummary}
` : ''}
          MATRIU D'EVOLUCIÓ PREVISTA (6 HORES):
          ${finestraPrevista}
        `;

        try {
            const response = await fetch(GEMINI_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: prompt, 
                    lang: language,
                    model: 'gemini-3.5-flash-lite' 
                }),
                signal: AbortSignal.timeout(30000) 
            });

            if (!response.ok) {
                console.error(`❌ Error Proxy: ${response.status} ${response.statusText}`);
                Sentry.captureMessage(`Error del Worker meteoai-proxy: HTTP ${response.status}`, 'warning');
                return null; 
            }

            const data = await response.json();
            const engineUsed = typeof data?.engine === 'string' ? data.engine : 'unknown';
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rawText) {
                console.error("❌ El Worker ha retornat una resposta buida o format invàlid.");
                return null;
            }
            
            try {
                // El Worker garanteix JSON, parseig directe:
                const parsed = JSON.parse(rawText.trim()) as RawLLMResponse;

                // Marcatge de motor independent de l'idioma: abans es detectava
                // l'escut d'emergència cercant text traduït dins tactical_reasoning,
                // cosa que només funcionava quan l'idioma era català.
                if (engineUsed === 'emergency') {
                    Sentry.captureMessage(`Worker fallback activat (escut d'emergència) per a l'idioma "${language}": Gemini i Groq han fallat.`, 'warning');
                } else if (engineUsed === 'groq') {
                    Sentry.addBreadcrumb({
                        category: 'ai-api',
                        message: 'Resposta servida pel fallback de Groq (Gemini ha fallat)',
                        level: 'info'
                    });
                }

                // Execució del tallafocs matemàtic fora del bucle IA
                const deterministicEval = evaluateDeterministicRisk(weatherData, evalStartIndex, evalEndIndex, dustAdvisory.kind);

                if (typeof parsed.text === 'string' && parsed.text.trim().length > 0) {
                    
                    const validRisks: TacticalRiskLevel[] = ['GREEN', 'AMBER', 'RED'];
                    const rawRisk = String(parsed.risk_level ?? 'AMBER').toUpperCase() as TacticalRiskLevel;
                    const safeRiskLevel: TacticalRiskLevel = validRisks.includes(rawRisk) ? rawRisk : 'AMBER';

                    const validHazards: TacticalHazardType[] = ['NONE', 'WIND', 'RAIN', 'THERMAL', 'HEAT', 'COLD', 'CONVECTIVE', 'VISIBILITY', 'SNOW_ICE', 'AIR_QUALITY'];
                    const rawHazard = String(parsed.hazard_type ?? 'NONE').toUpperCase() as TacticalHazardType;
                    const safeHazardType: TacticalHazardType = validHazards.includes(rawHazard) ? rawHazard : 'NONE';

                    // --- INTERVENCIÓ DE SEGURETAT TÀCTICA (TALLAFOCS) ---
                    let finalRiskLevel = safeRiskLevel;
                    let finalHazardType = safeHazardType;

                    if (RISK_HIERARCHY[deterministicEval.risk] > RISK_HIERARCHY[safeRiskLevel]) {
                        console.warn(`🛡️ TALLAFOCS DE SEGURETAT ACTIVAT: La IA ha avaluat '${safeRiskLevel}', però les dades crues forcen '${deterministicEval.risk}' a causa de '${deterministicEval.hazard}'.`);
                        finalRiskLevel = deterministicEval.risk;
                        finalHazardType = deterministicEval.hazard ?? safeHazardType;
                    } else if (safeHazardType === 'NONE' && deterministicEval.hazard !== null) {
                        finalHazardType = deterministicEval.hazard;
                    }

                    const validCategories: TacticalTipCategory[] = ['SKY', 'THERMAL', 'WIND', 'HAZARD'];
                    const rawTipsArray = Array.isArray(parsed.tips) ? parsed.tips : [];
                    
                    const safeTips: TacticalTip[] = rawTipsArray
                        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
                        .map(item => {
                            const rawCat = String(item.category ?? 'SKY').toUpperCase() as TacticalTipCategory;
                            const safeCat: TacticalTipCategory = validCategories.includes(rawCat) ? rawCat : 'SKY';
                            const safeText = typeof item.text === 'string' ? item.text.trim() : '';
                            return { category: safeCat, text: safeText };
                        })
                        .filter(tip => tip.text.length > 0)
                        .slice(0, 2);

                    const validatedData: AICacheData = {
                        risk_level: finalRiskLevel,
                        hazard_type: finalHazardType,
                        tactical_reasoning: typeof parsed.tactical_reasoning === 'string' ? parsed.tactical_reasoning : undefined,
                        text: parsed.text.trim(),
                        tips: safeTips,
                        engine: (engineUsed === 'gemini' || engineUsed === 'groq' || engineUsed === 'emergency')
                            ? engineUsed
                            : 'unknown'
                    };

                    // L'escut d'emergència del worker (Gemini i Groq caiguts) no és una anàlisi: si es guardés, un error
                    // de segons es quedaria enganxat una hora sencera (semàfor AMBER inclòs) encara que el servei ja
                    // s'hagués recuperat. Es mostra, però no es cacheja: la propera càrrega ho torna a provar.
                    if (validatedData.engine !== 'emergency') {
                        await cacheService.set(cacheKey, validatedData);
                    }
                    return validatedData;
                }
            } catch (parseError) {
                console.error("❌ Error crític fent JSON.parse de la resposta IA:", parseError);
                Sentry.captureException(parseError, { tags: { service: 'GeminiService', type: 'parse_error' } });
            }

            return null;

        } catch (fetchError) {
            if (fetchError instanceof Error) {
                 console.error(`❌ Error de Xarxa/Timeout amb el Worker:`, fetchError.message);
            }
            return null;
        }

    } catch (e) {
        console.error("❌ Error de Lògica General a GeminiService:", e);
        Sentry.captureException(e, { tags: { service: 'GeminiService', type: 'logic_error' } });
        return null;
    }
};