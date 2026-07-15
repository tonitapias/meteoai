// src/services/geminiService.ts
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { prepareContextForAI } from '../utils/aiContext';
import * as Sentry from "@sentry/react";
import { cacheService } from './cacheService'; 
import { AI_PROMPTS } from '../constants/aiPrompts';
import { 
    GEMINI_PROXY_URL, 
    AI_CACHE_TTL, 
    AI_REQUEST_TIMEOUT, 
    TARGET_LANGUAGES 
} from '../constants/aiConfig';

// --- CONTRACTE D'INTERFÍCIES (RISC ZERO AMB MÀXIMA PRECISIÓ TÈRMICA) ---

export type TacticalRiskLevel = 'GREEN' | 'AMBER' | 'RED';
export type TacticalHazardType = 'NONE' | 'WIND' | 'THERMAL' | 'HEAT' | 'COLD' | 'CONVECTIVE' | 'VISIBILITY' | 'SNOW_ICE';
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
 * RESOLUCIÓ HORÀRIA (BLINDADA CONTRA DOUBLE-OFFSET)
 * Formateja l'hora respectant exclusivament la zona horària de la localització consultada.
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
 * Utilitza descripcions entenedores per a l'usuari general en lloc d'argot sinòptic.
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
 * DESXIFRATGE WMO ENTENEDOR (AMB ESCUT TERMODINÀMIC)
 * Tradueix els codis WMO amb paraules del dia a dia evitant absurds físics com neu amb calor.
 */
const getTacticalWeatherDescription = (code: number | null | undefined, temp: number | null | undefined = null): string => {
    if (code === null || code === undefined) return "Estat del cel no determinat";
    
    const isFreezing = temp !== null && temp !== undefined && temp <= 3.0;

    switch (code) {
        case 0: return "Cel ras / Completament serè";
        case 1:
        case 2:
        case 3: return "De poc núvol a cobert";
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
 * ANÀLISI DE QUALITAT DE L'AIRE (AQI) - ENTENEDOR
 */
const getTacticalAqiDescription = (aqi: number | null | undefined, scale: 'EU' | 'US' = 'EU'): string => {
    if (aqi === null || aqi === undefined || aqi < 0) return "N/D";
    
    if (scale === 'EU') {
        if (aqi <= 20) return `${aqi} (Bona / Aire net)`;
        if (aqi <= 40) return `${aqi} (Acceptable)`;
        if (aqi <= 60) return `${aqi} (Moderada / Regular)`;
        if (aqi <= 80) return `${aqi} (Deficient / Mala qualitat)`;
        if (aqi <= 100) return `${aqi} (Molt deficient / Precaució gent sensible)`;
        return `${aqi} (ALERTA: Qualitat de l'aire dolenta / Contaminació alta)`;
    } else {
        if (aqi <= 50) return `${aqi} (Bona / Aire net)`;
        if (aqi <= 100) return `${aqi} (Moderada / Acceptable)`;
        if (aqi <= 150) return `${aqi} (Desfavorable per a persones sensibles)`;
        if (aqi <= 200) return `${aqi} (Deficient / Insalubre)`;
        return `${aqi} (ALERTA: Qualitat de l'aire dolenta / Pols o calima alta)`;
    }
};

/**
 * CONFORT TÈRMIC CONCÌS I DIRECTE
 * Textos nets, sense contradiccions i amb consells directes per al dia a dia.
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
            return `ALERTA PER CALOR INTENSA (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr}) - Evita esforços al sol i hidrata't`;
        }
        if (apparentTemp >= 32) {
            return `CALOR I XAFOGOR (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr}) - Ambient pesat i sudorós`;
        }
        return `Calor humida (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
    }

    if (temp <= 12 && diff <= -2.5) {
        return `FRED INTENS PEL VENT (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr}) - El vent accentua el fred, abrica't bé`;
    }

    return `Confort tèrmic normal (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
};

export const getGeminiAnalysis = async (weatherData: ExtendedWeatherData, language: string): Promise<AICacheData | null> => {
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

        const hasEuAqi = typeof currentObj.european_aqi === 'number' || Array.isArray(hourlyObj.european_aqi);
        const aqiScale: 'EU' | 'US' = hasEuAqi ? 'EU' : 'US';
        const currentAqi = typeof currentObj.european_aqi === 'number' ? currentObj.european_aqi : (typeof currentObj.us_aqi === 'number' ? currentObj.us_aqi : null);

        const currentTimeRaw = currentObj?.time;
        const currentHourStr = (typeof currentTimeRaw === 'string' || typeof currentTimeRaw === 'number')
            ? getTacticalHourStr(currentTimeRaw, tz, utcOffset) 
            : getTacticalHourStr(Math.floor(Date.now() / 1000), tz, utcOffset);

        const elevationKey = context.location.elevation.toString(); 
        const cacheKey = cacheService.generateAiKey(`${elevationKey}_${modelInfo.name}`, lat, lon, language);
        
        try {
            const cachedData = await cacheService.get<AICacheData>(cacheKey, AI_CACHE_TTL);
            if (cachedData) {
                return cachedData;
            }
        } catch (dbError) {
            console.warn("⚠️ Error llegint Cache IA:", dbError);
        }

        let finestraPrevista = "Sense dades horàries.";
        if (weatherData.hourly && Array.isArray(weatherData.hourly.time)) {
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

            const tableRows: string[] = [
                "| HORA | ESTAT DEL CEL | TEMP | SENSACIÓ | HUMITAT | PLUJA (PROB%) | VENT (RÀFEGUES) | UV | AQI |",
                "|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|"
            ];

            for (let i = startIndex; i < endIndex; i++) {
                const timeRaw = times[i];
                if (timeRaw === undefined || timeRaw === null) continue;

                const hourStr = getTacticalHourStr(timeRaw, tz, utcOffset);
                const temp = weatherData.hourly.temperature_2m?.[i] ?? '--';
                const tempNum = typeof temp === 'number' ? temp : null;
                const wind = weatherData.hourly.wind_speed_10m?.[i] ?? '--';
                const gusts = weatherData.hourly.wind_gusts_10m?.[i] ?? '--';
                const precip = weatherData.hourly.precipitation?.[i] ?? 0;
                const prob = weatherData.hourly.precipitation_probability?.[i] ?? 0;

                const wmoArr = (hourlyObj.weather_code ?? hourlyObj.weathercode) as (number | null)[] | undefined;
                const wmoHour = wmoArr?.[i] ?? null;
                const wmoDesc = getTacticalWeatherDescription(wmoHour, tempNum);

                const apparentArr = (hourlyObj.apparent_temperature) as (number | null)[] | undefined;
                const apparentHour = apparentArr?.[i] ?? null;
                const apparentStr = apparentHour !== null ? `${apparentHour}ºC` : "--ºC";

                const humArr = (hourlyObj.relative_humidity_2m ?? hourlyObj.humidity) as (number | null)[] | undefined;
                const humHour = humArr?.[i] ?? null;
                const humStr = humHour !== null ? `${humHour}%` : "--%";

                const uvArr = (hourlyObj.uv_index ?? hourlyObj.uv_index_max) as (number | null)[] | undefined;
                const uvHour = uvArr?.[i] ?? (isDay === 0 ? 0 : null);
                const uvStr = uvHour !== null ? `${uvHour}` : "N/D";

                const aqiArr = (hourlyObj.european_aqi ?? hourlyObj.us_aqi) as (number | null)[] | undefined;
                const aqiHour = aqiArr?.[i] ?? null;
                const aqiStr = getTacticalAqiDescription(aqiHour, aqiScale);

                tableRows.push(`| ${hourStr} | ${wmoDesc} | ${temp}ºC | ${apparentStr} | ${humStr} | ${precip}mm (${prob}%) | ${wind}km/h (${gusts}km/h) | ${uvStr} | ${aqiStr} |`);
            }
            finestraPrevista = tableRows.join('\n');
        }

        const prompts = AI_PROMPTS[language] || AI_PROMPTS['en'] || AI_PROMPTS['ca'];
        const targetLanguage = TARGET_LANGUAGES[language] || 'English';

        const terminologyRule = 
            language === 'ca' ? `- DIRECTIVA LINGÜÍSTICA CRÍTICA: Escriu en un català central impecable, natural, clar i modern. ZERO ANGLICISMES i ZERO calcs del castellà ("bochorno", "xubasco").
             - ROTACIÓ LÈXICA: Alterna de manera natural i directa entre: "xafogor", "calor humida", "ambient pesat" o "sensació de fred pel vent".
             - VENTS I FENÒMENS: Utilitza SEMPRE "ràfegues" o "cop de vent". Per a la pluja, usa "ruixats" o "xàfecs".` :
            language === 'es' ? '- Utiliza términos claros, precisos y naturales en español normativo. CERO ANGLICISMOS. Alterna entre "bochorno", "calor húmedo" y "sensación de frío por el viento".' :
            language === 'fr' ? '- Utilisez un vocabulaire météorologique clair, naturel et accessible en français (ex: "chaleur lourde", "refroidissement éolien" ou "température ressentie").' :
            '- Use clear, accessible, and friendly weather terminology (rotate between: mugginess, heat stress, humid heat, apparent temperature, wind chill).';
            
        const prompt = `
          ANÀLISI METEOROLÒGICA EN TEMPS REAL - DADES ACTUALS:
          
          HORA LOCAL ACTUAL A LA ZONA: ${currentHourStr} (${descripcioPeriole})
          Estat del Cel: ${getTacticalWeatherDescription(currentWmoCode, currentTempNum)}
          Temperatura Real: ${weatherData.current.temperature_2m}ºC | Humitat Relativa: ${currentHumidity !== null ? `${currentHumidity}%` : 'N/D'}
          Confort Tèrmic i Sensació: ${getTacticalComfortDescription(currentTempNum, currentApparentTemp, currentHumidity)}
          Pluja actual: ${weatherData.current.precipitation}mm | Índex UV Actual: ${currentUv !== null ? currentUv : 'N/D'} | Qualitat de l'Aire: ${getTacticalAqiDescription(currentAqi, aqiScale)}
          MODEL METEOROLÒGIC UTILITZAT: ${modelInfo.name} (${modelInfo.description})

          TAULA D'EVOLUCIÓ PREVISTA (PROPERES 6 HORES DES DE LES ${currentHourStr}):
          ${finestraPrevista}
          
          TASCA ESPECÍFICA: ${prompts.task}
          
          REQUERIMENTS COMUNICATIUS DE LA RESPOSTA:
          1. ANCORATGE TEMPORAL ESTRICTE: Centra la previsió en l'evolució de les 6 hores de la taula. Si és tarda o nit, prohibit fer referències al matí.
          2. AVALUACIÓ DE RISC METEOROLÒGIC: Determina el "risk_level" de la finestra: "GREEN" (temps tranquil i segur), "AMBER" (canvis de temps, ràfegues moderades, fred o calor intensa), "RED" (alerta meteorològica important com tempestes, pedra, vent >60km/h o calor sufocant).
          3. TIPO DE PERILL ("hazard_type"): Tria estrictament un entre: "NONE", "WIND" (vent fort), "HEAT" (calor o xafogor), "COLD" (fred intens pel vent), "CONVECTIVE" (tempestes), "VISIBILITY" (boira) o "SNOW_ICE" (neu o gel).
          4. CATEGORITZACIÓ DE PUNTS CLAU: Genera EXACTAMENT 2 punts d'observació a l'array "tips". Cada objecte ha de tenir una clau "category" triada estrictament entre ["SKY", "THERMAL", "WIND", "HAZARD"] i una clau "text" amb la descripció entenedora i directa.
          5. IDIOMA I LÈXIC: Respon exclusivament en ${targetLanguage}, evitant tecnicismes incomprensibles.
          ${terminologyRule}
          
          RECORDATORI: La resposta ha de ser exclusivament el JSON estricte sol·licitat en les regles de sistema.
        `;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT);

        try {
            const response = await fetch(GEMINI_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt, lang: language }),
                signal: controller.signal 
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`❌ Error Proxy: ${response.status} ${response.statusText}`);
                Sentry.addBreadcrumb({
                    category: 'ai-api',
                    message: `Proxy Error ${response.status}`,
                    level: 'warning'
                });
                return null; 
            }

            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!rawText) {
                console.error("❌ El Worker ha retornat una resposta buida o format invàlid.");
                Sentry.addBreadcrumb({
                    category: 'ai-api',
                    message: 'Worker empty response',
                    level: 'warning'
                });
                return null;
            }

            const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                console.error("❌ La resposta del Worker no conté una estructura JSON vàlida.");
                Sentry.addBreadcrumb({
                    category: 'ai-api',
                    message: 'Invalid JSON format from Worker',
                    level: 'error'
                });
                return null;
            }
            
            try {
                const parsed = JSON.parse(jsonMatch[0]) as RawLLMResponse;

                if (typeof parsed.text === 'string' && Array.isArray(parsed.tips)) {
                    
                    const validRisks: TacticalRiskLevel[] = ['GREEN', 'AMBER', 'RED'];
                    const rawRisk = String(parsed.risk_level ?? 'AMBER').toUpperCase() as TacticalRiskLevel;
                    const safeRiskLevel: TacticalRiskLevel = validRisks.includes(rawRisk) ? rawRisk : 'AMBER';

                    const validHazards: TacticalHazardType[] = ['NONE', 'WIND', 'THERMAL', 'HEAT', 'COLD', 'CONVECTIVE', 'VISIBILITY', 'SNOW_ICE'];
                    const rawHazard = String(parsed.hazard_type ?? 'NONE').toUpperCase() as TacticalHazardType;
                    const safeHazardType: TacticalHazardType = validHazards.includes(rawHazard) ? rawHazard : 'NONE';

                    const validCategories: TacticalTipCategory[] = ['SKY', 'THERMAL', 'WIND', 'HAZARD'];
                    const safeTips: TacticalTip[] = parsed.tips
                        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
                        .map(item => {
                            const rawCat = String(item.category ?? 'SKY').toUpperCase() as TacticalTipCategory;
                            const safeCat: TacticalTipCategory = validCategories.includes(rawCat) ? rawCat : 'SKY';
                            const safeText = typeof item.text === 'string' ? item.text.trim() : '';
                            return { category: safeCat, text: safeText };
                        })
                        .filter(tip => tip.text.length > 0)
                        .slice(0, 2);

                    if (safeTips.length === 2 && parsed.text.trim().length > 0) {
                        const validatedData: AICacheData = {
                            risk_level: safeRiskLevel,
                            hazard_type: safeHazardType,
                            tactical_reasoning: typeof parsed.tactical_reasoning === 'string' ? parsed.tactical_reasoning : undefined,
                            text: parsed.text.trim(),
                            tips: safeTips
                        };

                        await cacheService.set(cacheKey, validatedData);
                        return validatedData;
                    } else {
                        console.error("❌ La IA ha retornat menys de 2 tips vàlids o un text buit.", parsed);
                    }
                } else {
                    console.error("❌ El JSON no té l'estructura 'text' (string) i 'tips' (array) esperada.", parsed);
                }
            } catch (parseError) {
                console.error("❌ Error crític fent JSON.parse de la resposta IA:", parseError);
                Sentry.captureException(parseError, { tags: { service: 'GeminiService', type: 'parse_error' } });
            }

            return null;

        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error) {
                 console.error(`❌ Error de Xarxa/Timeout amb el Worker:`, fetchError.message);
                 Sentry.addBreadcrumb({
                    category: 'ai-network',
                    message: fetchError.message,
                    level: 'warning'
                 });
            }
            return null;
        }

    } catch (e) {
        console.error("❌ Error de Lògica General a GeminiService:", e);
        Sentry.captureException(e, { tags: { service: 'GeminiService', type: 'logic_error' } });
        return null;
    }
};