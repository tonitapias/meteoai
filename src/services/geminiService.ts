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
 * ANÀLISI DE QUALITAT DE L'AIRE (AQI)
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
        
        if (weatherData.hourly && Array.isArray(weatherData.hourly.time) && weatherData.hourly.time.length > 0) {
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

            const tempArr = weatherData.hourly.temperature_2m as (number | null)[] | undefined;
            const windArr = weatherData.hourly.wind_speed_10m as (number | null)[] | undefined;
            const gustsArr = weatherData.hourly.wind_gusts_10m as (number | null)[] | undefined;
            const precipArr = weatherData.hourly.precipitation as (number | null)[] | undefined;
            const probArr = weatherData.hourly.precipitation_probability as (number | null)[] | undefined;

            for (let i = startIndex; i < endIndex; i++) {
                const timeRaw = times[i];
                if (timeRaw === undefined || timeRaw === null) continue;

                const hourStr = getTacticalHourStr(timeRaw, tz, utcOffset);
                const tempHour = tempArr?.[i];
                const tempNum = typeof tempHour === 'number' ? tempHour : null;
                const tempStr = tempNum !== null ? tempNum : '--';
                
                const windHour = windArr?.[i];
                const windStr = typeof windHour === 'number' ? windHour : '--';
                
                const gustsHour = gustsArr?.[i];
                const gustsStr = typeof gustsHour === 'number' ? gustsHour : '--';
                
                const precipHour = precipArr?.[i];
                const precipStr = typeof precipHour === 'number' ? precipHour : 0;
                
                const probHour = probArr?.[i];
                const probStr = typeof probHour === 'number' ? probHour : 0;

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

                tableRows.push(`| ${hourStr} | ${wmoDesc} | ${tempStr}ºC | ${apparentStr} | ${humStr} | ${precipStr}mm (${probStr}%) | ${windStr}km/h (${gustsStr}km/h) | ${uvStr} | ${aqiStr} |`);
            }
            finestraPrevista = tableRows.join('\n');
        }

        const prompts = AI_PROMPTS[language] || AI_PROMPTS['en'] || AI_PROMPTS['ca'];
        const targetLanguage = TARGET_LANGUAGES[language] || 'English';

        // REGLA CLÍNICA DE FLUIDESA I TRACTAMENT EQUILIBRAT DE TIPS
        const terminologyRule = 
            language === 'ca' ? `- DIRECTIVA LINGÜÍSTICA: Tò expert de guia de muntanya. 
             - AL CAMP TEXT: Descriu l'escenari sense llistes, arrodonint enters. Prohibit donar consells o adreçar-se a l'usuari aquí.
             - AL CAMP TIPS: Si no hi ha perill ni res clau a destacar (dia rutinari), retorna []. Si hi ha dada rellevant, usa el format 'Fenomen: Consell/Avís'. Màxim 15 paraules.` :
            language === 'es' ? '- Tono de experto. En "text": solo describe escenario, sin listas ni consejos. En "tips": retorna [] si no hay nada clave. Si hay peligro o dato relevante, usa "Fenómeno: Consejo". Máx 15 palabras.' :
            language === 'fr' ? '- Ton expert. Dans "text": scénario sans listes ni conseils. Dans "tips": retourne [] si la météo est routinière. Sinon, format "Phénomène: Avis". Max 15 mots.' :
            '- Expert tone. In "text": scenario description only, no lists or advice. In "tips": return [] if weather is routine. Otherwise, use "Phenomenon: Advice". Max 15 words.';
            
        const prompt = `
          TELEMETRIA TÀCTICA EN TEMPS REAL - HORITZÓ 6 HORES:
          
          HORA LOCAL ACTUAL A LA ZONA: ${currentHourStr} (${descripcioPeriole})
          Estat del Cel: ${getTacticalWeatherDescription(currentWmoCode, currentTempNum)}
          Temperatura Real: ${weatherData.current.temperature_2m}ºC | Humitat Relativa: ${currentHumidity !== null ? `${currentHumidity}%` : 'N/D'}
          Confort Tèrmic: ${getTacticalComfortDescription(currentTempNum, currentApparentTemp, currentHumidity)}
          Pluja actual: ${weatherData.current.precipitation}mm | Índex UV: ${currentUv !== null ? currentUv : 'N/D'} | Qualitat Aire: ${getTacticalAqiDescription(currentAqi, aqiScale)}
          MODEL EN ÚS: ${modelInfo.name}

          MATRIU D'EVOLUCIÓ PREVISTA (6 HORES):
          ${finestraPrevista}
          
          TASCA ESPECÍFICA: ${prompts.task}
          
          REQUERIMENTS COMUNICATIUS CLÍNICS:
          1. AVALUACIÓ DE RISC MATEMÀTICA: Determina el "risk_level":
             - "GREEN" (Sense Risc): Vent < 50 km/h, Temp 0ºC a 34ºC, Pluja < 5mm/h.
             - "AMBER" (Precaució): Ràfegues 50-80 km/h, Temp 35ºC-39ºC o < 0ºC, Pluja forta, Visibilitat baixa, RISC COMBINAT (Pluja + Vent > 35 km/h + Temp < 10ºC).
             - "RED" (Perill): Ràfegues > 80 km/h, Temp >= 40ºC o < -8ºC, Tempestat forta.
          2. TIPUS DE PERILL ("hazard_type"): "NONE", "WIND", "HEAT", "COLD", "CONVECTIVE", "VISIBILITY" o "SNOW_ICE".
          3. SÍNTESI FLUIDA AL CAMP 'TEXT': Redacta l'ESCENARI. Arrodoneix a l'enter (ZERO decimals). Prohibit llistes aïllades. REGLA CRÍTICA: Prohibit consells humans aquí.
          4. CAMP 'TIPS' (AVISOS PRÀCTICS): Genera de 0 a 2 punts. TENS L'OBLIGACIÓ de retornar [] si el temps és tranquil i sense interès. Si hi ha un factor clau, usa l'estructura "[Fenomen]: [Conseqüència]". No superis les 15 paraules per tip.
          5. IDIOMA: Respon exclusivament en ${targetLanguage}.
          ${terminologyRule}
        `;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT);

        try {
            const response = await fetch(GEMINI_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: prompt, 
                    lang: language,
                    model: 'openai/gpt-oss-120b' 
                }),
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
                return null;
            }

            const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                console.error("❌ La resposta del Worker no conté una estructura JSON vàlida.");
                return null;
            }
            
            try {
                const parsed = JSON.parse(jsonMatch[0]) as RawLLMResponse;

                // RISC ZERO: Desacoplem validació del Text de l'existència rigorosa del camp Tips.
                if (typeof parsed.text === 'string' && parsed.text.trim().length > 0) {
                    
                    const validRisks: TacticalRiskLevel[] = ['GREEN', 'AMBER', 'RED'];
                    const rawRisk = String(parsed.risk_level ?? 'AMBER').toUpperCase() as TacticalRiskLevel;
                    const safeRiskLevel: TacticalRiskLevel = validRisks.includes(rawRisk) ? rawRisk : 'AMBER';

                    const validHazards: TacticalHazardType[] = ['NONE', 'WIND', 'THERMAL', 'HEAT', 'COLD', 'CONVECTIVE', 'VISIBILITY', 'SNOW_ICE'];
                    const rawHazard = String(parsed.hazard_type ?? 'NONE').toUpperCase() as TacticalHazardType;
                    const safeHazardType: TacticalHazardType = validHazards.includes(rawHazard) ? rawHazard : 'NONE';

                    const validCategories: TacticalTipCategory[] = ['SKY', 'THERMAL', 'WIND', 'HAZARD'];
                    
                    // Saniteig Defensiu de Tips: Si és null, undefined o s'ha omès, recau en un array buit [].
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
                        risk_level: safeRiskLevel,
                        hazard_type: safeHazardType,
                        tactical_reasoning: typeof parsed.tactical_reasoning === 'string' ? parsed.tactical_reasoning : undefined,
                        text: parsed.text.trim(),
                        tips: safeTips 
                    };

                    await cacheService.set(cacheKey, validatedData);
                    return validatedData;
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
            }
            return null;
        }

    } catch (e) {
        console.error("❌ Error de Lògica General a GeminiService:", e);
        Sentry.captureException(e, { tags: { service: 'GeminiService', type: 'logic_error' } });
        return null;
    }
};