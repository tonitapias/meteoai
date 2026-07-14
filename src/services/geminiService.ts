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

interface AICacheData {
    text: string;
    tips: string[];
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
 * MOTOR DE RESOLUCIÓ HORÀRIA TÀCTICA
 * Formateja l'hora respectant exclusivament la zona horària de la localització consultada,
 * blindant el sistema contra el desplaçament horari del dispositiu de l'usuari.
 */
const getTacticalHourStr = (
    timeRaw: number | string, 
    timezone?: string, 
    utcOffsetSeconds?: number
): string => {
    try {
        // Cas 1: Si disposem d'identificador IANA (ex: "Europe/Madrid", "America/New_York")
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
            const str = timeRaw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timeRaw) ? timeRaw : `${timeRaw}Z`;
            const date = new Date(str);
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

        // Cas 2: Si és una cadena ISO local del model (ex: Open-Meteo "2026-07-14T14:00"),
        // representa l'hora exacta a la població. N'extreiem el bloc horari sense mutacions.
        if (typeof timeRaw === 'string') {
            const match = timeRaw.match(/T?(\d{2}:\d{2})/);
            if (match && match[1]) {
                return match[1];
            }
        }

        // Cas 3: Unix Timestamp amb desplaçament UTC explícit en segons
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
 * MOTOR DE DETECCIO I CALIBRACIÓ DE MODELS
 * Classifica el model de la telemetria per indicar a la IA el nivell de fiabilitat
 * en fenòmens locals (mesoescala HD vs global sinòptic).
 */
const getTacticalModelInfo = (weatherData: ExtendedWeatherData): ModelTacticalInfo => {
    try {
        const safeData = weatherData as unknown as Record<string, unknown>;
        const currentObj = safeData.current as Record<string, unknown> | undefined;
        const hourlyObj = safeData.hourly as Record<string, unknown> | undefined;

        const rawModel = safeData.model ?? safeData.model_name ?? currentObj?.model ?? hourlyObj?.model ?? "Estàndard";
        const modelStr = String(rawModel).trim();
        const modelLower = modelStr.toLowerCase();

        // Models d'Alta Resolució (Mesoescala HD - Alta fiabilitat en orografia, tempestes i vents locals)
        if (/arome|wrf|harmonie|icon_d2|icon-d2|ukmo_2km|hrrr|cosmo/i.test(modelLower)) {
            return {
                name: modelStr.toUpperCase(),
                type: 'HD_LOCAL',
                description: "Model d'Alta Resolució (Mesoescala HD). Màxima fiabilitat per a ruixats locals, ràfegues de vent de relleu i canvis tèrmics bruscos."
            };
        }

        // Models Globals (Sinòptics - Alta fiabilitat en tendències generals i estabilitat de masses d'aire)
        if (/ecmwf|gfs|icon|gem|cfs|arpege/i.test(modelLower)) {
            return {
                name: modelStr.toUpperCase(),
                type: 'GLOBAL',
                description: "Model Global Sinòptic. Gran fiabilitat per avaluar la tendència general, fronts atmosfèrics i estabilitat a escala regional."
            };
        }

        return {
            name: modelStr !== "Estàndard" ? modelStr : "Model Integrat",
            type: 'ESTANDARD',
            description: "Telemetria meteorològica estàndard combinada."
        };
    } catch {
        return {
            name: "Model Integrat",
            type: 'ESTANDARD',
            description: "Telemetria meteorològica estàndard combinada."
        };
    }
};

/**
 * MOTOR DE DESXIFRATGE WMO (World Meteorological Organization)
 * Tradueix els codis numèrics de precipitació i tempestes a descripcions tàctiques exactes
 * per evitar que la IA confongui un plugim amb una tempesta convectiva.
 */
const getTacticalWeatherDescription = (code: number | null | undefined): string => {
    if (code === null || code === undefined) return "Estat atmosfèric no determinat";
    switch (code) {
        case 0: return "Cel ras / Clar i serè";
        case 1:
        case 2:
        case 3: return "De poc núvol a cobert / Evolució diürna";
        case 45:
        case 48: return "Boira o boira gebradora (Reducció severa de visibilitat)";
        case 51:
        case 53:
        case 55: return "Plugim feble, moderat o dens (Drizzle)";
        case 56:
        case 57: return "Plugim gelant (Risc de plaques de gel humit)";
        case 61:
        case 63:
        case 65: return "Pluja contínua (Feble, moderada o intensa)";
        case 66:
        case 67: return "Pluja gelant intensa (Perill extrem de gel negre)";
        case 71:
        case 73:
        case 75: return "Nevada contínua (Feble, moderada o copiosa)";
        case 77: return "Neu granulada / Granissa feble";
        case 80:
        case 81:
        case 82: return "Ruixats o xàfecs de pluja convectius (Arribada brusca)";
        case 85:
        case 86: return "Ruixats de neu intensos / Torb";
        case 95: return "TEMPESTA ELÈCTRICA ACTIVA (Risc de llamps i ràfegues severes)";
        case 96:
        case 99: return "TEMPESTA ELÈCTRICA SEVERA AMB GRANISSA O PEDRA (Perill atmosfèric alt)";
        default: return `Codi WMO ${code}`;
    }
};

/**
 * MOTOR D'ANÀLISI DE QUALITAT DE L'AIRE (AQI)
 * Classifica l'índex AQI europeu o americà en nivells de confort atmosfèric.
 */
const getTacticalAqiDescription = (aqi: number | null | undefined): string => {
    if (aqi === null || aqi === undefined) return "N/D";
    if (aqi <= 50) return `${aqi} (Bona / Aire net)`;
    if (aqi <= 100) return `${aqi} (Moderada / Acceptable)`;
    if (aqi <= 150) return `${aqi} (Desfavorable per a grups sensibles)`;
    return `${aqi} (ALERTA: Qualitat de l'aire deficient / Contaminació o pols en suspensió)`;
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
        
        // Extracció tàctica de l'estat dia/nit (is_day)
        const isDayRaw = (weatherData.current as Record<string, unknown>).is_day;
        const isDay = typeof isDayRaw === 'number' ? isDayRaw : 1;
        const descripcioPeriole = isDay === 1 ? "DIA (Llum solar activa)" : "NIT (Fosc, radiació solar zero)";

        // Extracció del Model Meteorològic
        const modelInfo = getTacticalModelInfo(weatherData);

        // Extracció de telemetria avançada actual (UV, AQI i WMO Weather Code)
        const currentObj = weatherData.current as Record<string, unknown>;
        const currentWmoCode = typeof currentObj.weather_code === 'number' ? currentObj.weather_code : (typeof currentObj.weathercode === 'number' ? currentObj.weathercode : null);
        const currentUv = typeof currentObj.uv_index === 'number' ? currentObj.uv_index : (typeof currentObj.uv_index_max === 'number' ? currentObj.uv_index_max : null);
        const currentAqi = typeof currentObj.european_aqi === 'number' ? currentObj.european_aqi : (typeof currentObj.us_aqi === 'number' ? currentObj.us_aqi : null);

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
            const hourlyObj = weatherData.hourly as Record<string, unknown>;
            let startIndex = -1;

            const currentTimeRaw = currentObj?.time;

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
                            return trueUtcMs >= nowMs - (30 * 60 * 1000);
                        }
                    }
                });
            }

            if (startIndex === -1) startIndex = 0;
            const endIndex = Math.min(startIndex + 6, times.length); 

            const slices: string[] = [];
            for (let i = startIndex; i < endIndex; i++) {
                const timeRaw = times[i];
                if (timeRaw === undefined || timeRaw === null) continue;

                const hourStr = getTacticalHourStr(timeRaw, tz, utcOffset);
                const temp = weatherData.hourly.temperature_2m?.[i] ?? '--';
                const wind = weatherData.hourly.wind_speed_10m?.[i] ?? '--';
                const gusts = weatherData.hourly.wind_gusts_10m?.[i] ?? '--';
                const precip = weatherData.hourly.precipitation?.[i] ?? 0;
                const prob = weatherData.hourly.precipitation_probability?.[i] ?? 0;

                // Telemetria horària avançada (WMO, UV i Qualitat de l'aire)
                const wmoArr = (hourlyObj.weather_code ?? hourlyObj.weathercode) as (number | null)[] | undefined;
                const wmoHour = wmoArr?.[i] ?? null;
                const wmoDesc = getTacticalWeatherDescription(wmoHour);

                const uvArr = (hourlyObj.uv_index ?? hourlyObj.uv_index_max) as (number | null)[] | undefined;
                const uvHour = uvArr?.[i] ?? (isDay === 0 ? 0 : null);
                const uvStr = uvHour !== null ? `UV: ${uvHour}` : "UV: N/D";

                const aqiArr = (hourlyObj.european_aqi ?? hourlyObj.us_aqi) as (number | null)[] | undefined;
                const aqiHour = aqiArr?.[i] ?? null;
                const aqiStr = getTacticalAqiDescription(aqiHour);

                slices.push(`[${hourStr}] Estat: ${wmoDesc} | Temp: ${temp}ºC | Pluja: ${precip}mm (Prob: ${prob}%) | Vent: ${wind}km/h (Ratxes: ${gusts}km/h) | ${uvStr} | AQI: ${aqiStr}`);
            }
            finestraPrevista = slices.join('\n');
        }

        const prompts = AI_PROMPTS[language] || AI_PROMPTS['en'] || AI_PROMPTS['ca'];
        const targetLanguage = TARGET_LANGUAGES[language] || 'English';

        const terminologyRule = 
            language === 'ca' ? '- DIRECTIVA LINGÜÍSTICA CRÍTICA: Has d\'escriure en un català central impecable, natural i genuí (normativa IEC). ZERO ANGLICISMES i ZERO calcs del castellà. Revisa estrictament l\'ortografia. Vocabulari obligatori: fes servir "ruixat" o "xàfec" (mai "xubasco"), "matinada" (mai "madrugada"). Per al vent, utilitza SEMPRE "ratxes" o "ràfegues" (ESTRICTAMENT PROHIBIT escriure "ràtzes" o inventar faltes d\'ortografia).' :
            language === 'es' ? '- Utiliza términos claros, precisos y naturales en español normativo. CERO ANGLICISMOS.' :
            language === 'fr' ? '- Utilisez un vocabulaire météorologique clair, naturel et professionnel en français.' :
            '- Use clear, accessible, and professional weather terminology.';
            
        const prompt = `
          ROL: Ets un Meteoròleg Expert i Divulgador Científic d'Alt Nivell. La teva missió és oferir una previsió clara, fiable, hiper-realista i de lectura ràpida (scannable) per a qualsevol usuari, avaluant tota la dinàmica atmosfèrica.
          
          ESTAT ACTUAL (Telemetria en temps real):
          Estat Atmosfèric: ${getTacticalWeatherDescription(currentWmoCode)}
          Temperatura: ${weatherData.current.temperature_2m}ºC | Pluja actual: ${weatherData.current.precipitation}mm
          Índex UV Actual: ${currentUv !== null ? currentUv : 'N/D'} | Qualitat de l'Aire (AQI): ${getTacticalAqiDescription(currentAqi)}
          PERÍODE TEMPORAL: ${descripcioPeriole}
          MODEL METEOROLÒGIC UTILITZAT: ${modelInfo.name} (${modelInfo.description})

          EVOLUCIÓ PREVISTA (PROPERES 6 HORES - HORA LOCAL DE LA ZONA CONSULTADA):
          ${finestraPrevista}
          
          TASKA: ${prompts.task}
          
          REGLES DE REDACCIÓ TÀCTICA (HIPER-REALISME I FIABILITAT - INNEGOCIABLES):
          1. NI PATERNALISME NI ARGOT EXCESSIU:
             - PROHIBIT el paternalisme: No recomanis roba, paraigües, cremes solars ni donis consells obvis de nen petit ("beu aigua", "vés amb compte"). L'usuari només vol saber el temps real amb precisió científica per prendre decisions pròpies.
             - PROHIBIT l'argot acadèmic dens o incomprensible: Explica els fenòmens com ho faria el millor meteoròleg televisiú o aeronàutic: amb autoritat, precisió i claredat.

          2. ANÀLISI INTEGRAL DE TELEMETRIA (WMO, UV, AIRE I VENT):
             - Tipus de Precipitació (WMO): No parlis només de "pluja". Distingeix clarament si la telemetria marca plugim feble, un xàfec convectiu, neu o el risc sever d'una TEMPESTA ELÈCTRICA amb granissa/pedra.
             - Radiació UV: Si és de DIA i l'índex UV és alt (>= 6) o extrem (>= 8), esmenta la incidència de la radiació solar en l'evolució diürna o l'entorn. Si és NIT, ignora l'UV completament.
             - Qualitat de l'Aire (AQI): Si l'AQI mostra nivells moderats (> 50) o desfavorable/alerta (> 100), assenyala l'estat de l'aire (inversió tèrmica, pols en suspensió o calima) perquè és vital per a activitats a l'exterior o esportistes.

          3. DIRECTIVA DE CONDICIONS I PERILLS SEVERS:
             - Si detectes tempestes elèctriques (WMO 95-99), vent/ratxes > 60 km/h, pluja > 5 mm o AQI en Alerta, emet un avís clar, directe i objectiu sobre l'impacte atmosfèric real en l'entorn.
             - Aprofita la calibració del model: Si és un model HD (AROME/WRF), dóna màxima certesa als fenòmens convectius i canvis ràpids.

          4. LIMITACIONS DEL MODEL:
             - Llegeix NOMÉS la taula d'Evolució Prevista. PROHIBIT inventar dades, parlar de l'endemà o d'hores fora de la finestra de 6 hores.

          5. TERMINOLOGIA I IDIOMA:
             - Has de respondre EXCLUSIVAMENT en ${targetLanguage}.
             ${terminologyRule}

          OBJECTIUS DE LA RESPOSTA (JSON):
          - "text": Un paràgraf fluid, natural i directe explicant de manera realista l'estat del cel, el tipus de precipitació, la temperatura i els factors atmosfèrics rellevants per a les properes 6 hores (màxim 2 o 3 frases).
          - "tips": 2 Punts Clau de Previsió o conclusions ràpides que es puguin llegir en 3 segons (ex: "El model AROME adverteix d'un xàfec convectiu amb tempesta a mitja tarda", "Índex UV extrem (8) amb aire net i excel·lent visibilitat", "Ambient serè però amb qualitat de l'aire moderada per pols en suspensió"). MAI consells de roba o material.

          IDIOMA DE SORTIDA: ${targetLanguage}
          FORMAT: JSON pur (sense markdown).
          {"text": "...", "tips": ["...", "..."]}
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
                console.error("❌ Groq ha retornat una resposta buida o format invàlid.");
                Sentry.addBreadcrumb({
                    category: 'ai-api',
                    message: 'Groq empty response',
                    level: 'warning'
                });
                return null;
            }

            const cleanText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                console.error("❌ La resposta no conté estructura JSON.");
                Sentry.addBreadcrumb({
                    category: 'ai-api',
                    message: 'Invalid JSON format from Groq',
                    level: 'error'
                });
                return null;
            }
            
            try {
                const parsed = JSON.parse(jsonMatch[0]) as AICacheData;

                if (parsed.text && Array.isArray(parsed.tips)) {
                    await cacheService.set(cacheKey, parsed);
                    return parsed;
                } else {
                    console.error("❌ El JSON no té l'estructura 'text' i 'tips[]' esperada.");
                }
            } catch (parseError) {
                console.error("❌ Error crític fent JSON.parse:", parseError);
                Sentry.captureException(parseError, { tags: { service: 'GeminiService', type: 'parse_error' } });
            }

            return null;

        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error) {
                 console.error(`❌ Error de Xarxa/Timeout:`, fetchError.message);
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