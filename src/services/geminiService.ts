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
 * MOTOR DE RESOLUCIÓ HORÀRIA TÀCTICA (BLINDAT CONTRA DOUBLE-OFFSET)
 * Formateja l'hora respectant exclusivament la zona horària de la localització consultada,
 * evitant que cadenes ISO locals d'Open-Meteo es converteixin erròniament a UTC.
 */
const getTacticalHourStr = (
    timeRaw: number | string, 
    timezone?: string, 
    utcOffsetSeconds?: number
): string => {
    try {
        // Cas 1: Si és una cadena ISO local del model SENSE identificador de zona (ex: Open-Meteo "2026-07-14T14:00"),
        // AIXÒ JA ÉS L'HORA EXACTA A LA CIUTAT/CIM. N'extreiem les hores directament!
        if (typeof timeRaw === 'string') {
            const hasExplicitTz = timeRaw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timeRaw);
            if (!hasExplicitTz) {
                const match = timeRaw.match(/T?(\d{2}:\d{2})/);
                if (match && match[1]) {
                    return match[1];
                }
            }
        }

        // Cas 2: Si disposem de Unix Timestamp o ISO amb offset real i identificador IANA (ex: "America/Los_Angeles")
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

        // Cas 3: Unix Timestamp amb desplaçament UTC explícit en segons sense IANA
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
                description: "Model d'Alta Resolució (Mesoescala HD). Màxima precisió en orografia, vents de vall i tempestes convectives."
            };
        }

        // Models Globals (Sinòptics - Alta fiabilitat en tendències generals i estabilitat de masses d'aire)
        if (/ecmwf|gfs|icon|gem|cfs|arpege/i.test(modelLower)) {
            return {
                name: modelStr.toUpperCase(),
                type: 'GLOBAL',
                description: "Model Global Sinòptic. Alta fiabilitat per a estabilitat regional i evolució de masses d'aire a escala general."
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
 * MOTOR DE DESXIFRATGE WMO AMB ESCUT TERMODINÀMIC (DOCTRINA RISC ZERO)
 * Tradueix els codis WMO evitant absurds físics com "boira gebradora" o "neu" amb temperatures positives.
 */
const getTacticalWeatherDescription = (code: number | null | undefined, temp: number | null | undefined = null): string => {
    if (code === null || code === undefined) return "Estat atmosfèric no determinat";
    
    // Escut Termodinàmic Invertit (Risc Zero): Exigeix <= 3ºC per permetre lèxic gèlid.
    const isFreezing = temp !== null && temp !== undefined && temp <= 3.0;

    switch (code) {
        case 0: return "Cel ras / Clar i serè";
        case 1:
        case 2:
        case 3: return "De poc núvol a cobert / Evolució diürna";
        case 45: return "Boira o boira baixa de vall (Visibilitat reduïda)";
        case 48: return !isFreezing ? "Boira densa o humitat alta (Visibilitat reduïda)" : "Boira gebradora (Risc de plaques de gel i visibilitat gèlida)";
        case 51:
        case 53:
        case 55: return "Plugim feble, moderat o dens (Drizzle)";
        case 56:
        case 57: return !isFreezing ? "Plugim dens" : "Plugim gelant (Risc de plaques de gel humit)";
        case 61:
        case 63:
        case 65: return "Pluja contínua (Feble, moderada o intensa)";
        case 66:
        case 67: return !isFreezing ? "Pluja contínua intensa" : "Pluja gelant intensa (Perill extrem de gel negre)";
        case 71:
        case 73:
        case 75: return !isFreezing ? "Pluja moderada o intensa" : "Nevada contínua (Feble, moderada o copiosa)";
        case 77: return !isFreezing ? "Ruixats febles" : "Neu granulada / Granissa feble";
        case 80:
        case 81:
        case 82: return "Ruixats o xàfecs de pluja convectius (Arribada brusca)";
        case 85:
        case 86: return !isFreezing ? "Ruixats de pluja intensos" : "Ruixats de neu intensos / Torb";
        case 95: return "TEMPESTA ELÈCTRICA ACTIVA (Risc de llamps i ràfegues severes)";
        case 96:
        case 99: return "TEMPESTA ELÈCTRICA SEVERA AMB GRANISSA O PEDRA (Perill atmosfèric alt)";
        default: return `Codi WMO ${code}`;
    }
};

/**
 * MOTOR D'ANÀLISI DE QUALITAT DE L'AIRE (AQI) - CALIBRACIÓ DOBLE ESCALA
 * Aplica els llindars exactes de l'EEA (Europa, 0-100+) o de l'EPA (EUA, 0-500)
 * segons la telemetria disponible per evitar camuflar episodis de contaminació.
 */
const getTacticalAqiDescription = (aqi: number | null | undefined, scale: 'EU' | 'US' = 'EU'): string => {
    if (aqi === null || aqi === undefined || aqi < 0) return "N/D";
    
    if (scale === 'EU') {
        // Escala EAQI (Agència Europea de Medi Ambient)
        if (aqi <= 20) return `${aqi} (Bona / Aire net)`;
        if (aqi <= 40) return `${aqi} (Acceptable / Regular)`;
        if (aqi <= 60) return `${aqi} (Moderada)`;
        if (aqi <= 80) return `${aqi} (Deficient / Mala qualitat)`;
        if (aqi <= 100) return `${aqi} (Molt deficient / Grups sensibles)`;
        return `${aqi} (ALERTA EXTREMA: Qualitat de l'aire perillosa / Contaminació severa)`;
    } else {
        // Escala US AQI (EPA - Agència de Protecció Ambiental dels EUA)
        if (aqi <= 50) return `${aqi} (Bona / Aire net)`;
        if (aqi <= 100) return `${aqi} (Moderada / Acceptable)`;
        if (aqi <= 150) return `${aqi} (Desfavorable per a grups sensibles)`;
        if (aqi <= 200) return `${aqi} (Deficient / Insalubre)`;
        return `${aqi} (ALERTA EXTREMA: Qualitat de l'aire perillosa / Pols o calima severa)`;
    }
};

/**
 * MOTOR D'ANÀLISI DE CONFORT TÈRMIC I XAFOGOR (DOCTRINA RISC ZERO)
 * Avaluació tàctica de la relació entre temperatura seca, humitat relativa i sensació tèrmica
 * per detectar episodis d'estrès tèrmic (xafogor per humitat) o refredament per vent (wind chill).
 */
const getTacticalComfortDescription = (
    temp: number | null | undefined, 
    apparentTemp: number | null | undefined, 
    humidity: number | null | undefined
): string => {
    if (temp === null || temp === undefined || apparentTemp === null || apparentTemp === undefined) {
        return "Telemetria tèrmica incompleta";
    }
    
    const diff = apparentTemp - temp;
    const humStr = (humidity !== null && humidity !== undefined) ? `${humidity}%` : "N/D";

    // Episodi de XAFOGOR (Sensació tèrmica superior a la temperatura real per alta humitat)
    if (temp >= 24 && diff >= 2.0) {
        if (apparentTemp >= 38) {
            return `ALERTA EXTREMA DE XAFOGOR (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr}) - Perill sever d'esgotament o cop de calor`;
        }
        if (apparentTemp >= 32) {
            return `XAFOGOR INTENSA (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr}) - Precaució per fatiga tèrmica i sudoració ineficient`;
        }
        return `Xafogor moderada (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
    }

    // Episodi de REFREDAMENT PER VENT / WIND CHILL (Sensació inferior a la temperatura real)
    if (temp <= 12 && diff <= -2.5) {
        return `REFREDAMENT PER VENT / AMBIENT GÈLID (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr}) - Risc d'hipotèrmia ràpida en exposició`;
    }

    return `Confort tèrmic estàndard (Sensació: ${apparentTemp.toFixed(1)}ºC | Humitat: ${humStr})`;
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

        // Extracció de telemetria avançada actual (WMO, Xafogor, Humitat, UV, AQI i Hora Local)
        const currentObj = weatherData.current as Record<string, unknown>;
        const hourlyObj = weatherData.hourly as Record<string, unknown>;

        const currentTempNum = typeof weatherData.current.temperature_2m === 'number' ? weatherData.current.temperature_2m : null;
        const currentWmoCode = typeof currentObj.weather_code === 'number' ? currentObj.weather_code : (typeof currentObj.weathercode === 'number' ? currentObj.weathercode : null);
        const currentUv = typeof currentObj.uv_index === 'number' ? currentObj.uv_index : (typeof currentObj.uv_index_max === 'number' ? currentObj.uv_index_max : null);
        const currentApparentTemp = typeof currentObj.apparent_temperature === 'number' ? currentObj.apparent_temperature : null;
        const currentHumidity = typeof currentObj.relative_humidity_2m === 'number' ? currentObj.relative_humidity_2m : (typeof currentObj.humidity === 'number' ? currentObj.humidity : null);

        // Detecció automàtica i rigorosa de l'escala de Qualitat de l'Aire disponible ('EU' o 'US')
        const hasEuAqi = typeof currentObj.european_aqi === 'number' || Array.isArray(hourlyObj.european_aqi);
        const aqiScale: 'EU' | 'US' = hasEuAqi ? 'EU' : 'US';
        const currentAqi = typeof currentObj.european_aqi === 'number' ? currentObj.european_aqi : (typeof currentObj.us_aqi === 'number' ? currentObj.us_aqi : null);

        // Càlcul blindat de l'Hora Local Actual (Protecció Risc Zero contra tipatge estricte)
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
                const tempNum = typeof temp === 'number' ? temp : null;
                const wind = weatherData.hourly.wind_speed_10m?.[i] ?? '--';
                const gusts = weatherData.hourly.wind_gusts_10m?.[i] ?? '--';
                const precip = weatherData.hourly.precipitation?.[i] ?? 0;
                const prob = weatherData.hourly.precipitation_probability?.[i] ?? 0;

                // Telemetria horària avançada amb Escut Termodinàmic
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
                const uvStr = uvHour !== null ? `UV: ${uvHour}` : "UV: N/D";

                const aqiArr = (hourlyObj.european_aqi ?? hourlyObj.us_aqi) as (number | null)[] | undefined;
                const aqiHour = aqiArr?.[i] ?? null;
                const aqiStr = getTacticalAqiDescription(aqiHour, aqiScale);

                slices.push(`[${hourStr}] Estat: ${wmoDesc} | Temp: ${temp}ºC (Sensació/Xafogor: ${apparentStr}) | Humitat: ${humStr} | Pluja: ${precip}mm (Prob: ${prob}%) | Vent: ${wind}km/h (Ratxes: ${gusts}km/h) | ${uvStr} | AQI (${aqiScale}): ${aqiStr}`);
            }
            finestraPrevista = slices.join('\n');
        }

        const prompts = AI_PROMPTS[language] || AI_PROMPTS['en'] || AI_PROMPTS['ca'];
        const targetLanguage = TARGET_LANGUAGES[language] || 'English';

        const terminologyRule = 
            language === 'ca' ? '- DIRECTIVA LINGÜÍSTICA CRÍTICA: Has d\'escriure en un català central impecable, natural i genuí (normativa IEC). ZERO ANGLICISMES i ZERO calcs del castellà. Revisa estrictament l\'ortografia. Vocabulari obligatori: fes servir "ruixat" o "xàfec" (mai "xubasco"), "matinada" (mai "madrugada"), "xafogor" (mai "bochorno"). Per al vent, utilitza SEMPRE "ratxes" o "ràfegues" (ESTRICTAMENT PROHIBIT escriure "ràtzes" o inventar faltes d\'ortografia).' :
            language === 'es' ? '- Utiliza términos claros, precisos y naturales en español normativo. CERO ANGLICISMOS. Usa "bochorno" o "sensación térmica elevada" según corresponda.' :
            language === 'fr' ? '- Utilisez un vocabulaire météorologique clair, naturel et professionnel en français (ex: "chaleur lourde" ou "température ressentie").' :
            '- Use clear, accessible, and professional weather terminology (e.g., mugginess, heat index, apparent temperature, wind chill).';
            
        const prompt = `
          ROL: Ets un Meteoròleg Expert, Físic Atmosfèric i Divulgador Científic d'Alt Nivell. La teva missió és oferir un part meteorològic tàctic, precís, de lectura ràpida (scannable) i cronològicament exacte per a qualsevol usuari.
          
          ESTAT ACTUAL (Telemetria en temps real - ANCORATGE TEMPORAL):
          HORA LOCAL ACTUAL A LA ZONA CONSULTADA: ${currentHourStr} (${descripcioPeriole})
          Estat Atmosfèric: ${getTacticalWeatherDescription(currentWmoCode, currentTempNum)}
          Temperatura Real: ${weatherData.current.temperature_2m}ºC | Humitat Relativa: ${currentHumidity !== null ? `${currentHumidity}%` : 'N/D'}
          Confort Tèrmic i Xafogor: ${getTacticalComfortDescription(currentTempNum, currentApparentTemp, currentHumidity)}
          Pluja actual: ${weatherData.current.precipitation}mm | Índex UV Actual: ${currentUv !== null ? currentUv : 'N/D'} | Qualitat de l'Aire (${aqiScale === 'EU' ? 'EAQI Europeu' : 'US AQI'}): ${getTacticalAqiDescription(currentAqi, aqiScale)}
          MODEL METEOROLÒGIC UTILITZAT: ${modelInfo.name} (${modelInfo.description})

          EVOLUCIÓ PREVISTA (PROPERES 6 HORES DES DE LES ${currentHourStr}):
          ${finestraPrevista}
          
          TASKA: ${prompts.task}
          
          DIRECTIVES TÀCTIQUES DE REDACCIÓ (INNEGOCIABLES - DOCTRINA RISC ZERO):
          
          1. ENFOCAMENT METEOROLÒGIC PUR (ZERO PATERNALISME):
             - Utilitza SEMPRE un llenguatge purament descriptiu, científic i objectiu per exposar els fets atmosfèrics.
             - Si no plou, descriu-ho en positiu: "Finestra d'estabilitat 100% seca", "Absència total de precipitació" o "Atmosfera estable". NO utilitzis mai expressions de consell com "no caldrà paraigua", "no agafeu abric" o "beveu aigua".
          
          2. ANÀLISI DE PATRÓ I TENDÈNCIA (CADENA DE PENSAMENT):
             - Abans de redactar, avalua el gradient de la taula: La temperatura cau o puja ràpidament? La humitat es dispara en poques hores? Hi ha un canvi de règim de vents?
             - Explica la relació entre variables: Si la sensació tèrmica és alta per la humitat, parla d'amorrosiment o xafogor; si el vent desploma la sensació a l'hivern, parla d'efecte gèlid (wind chill). Si és NIT, ignora la radiació UV.
          
          3. DIRECTIVA CRÍTICA DE COHERÈNCIA TEMPORAL (ZERO AL·LUCINACIONS):
             - Ancóra't ESTRICTAMENT en l'HORA LOCAL ACTUAL (${currentHourStr}) i en les etiquetes [HH:MM] de la taula. 
             - Respecta el progrés del dia: Si la consulta és a la tarda/vespre (ex: 18:00), utilitza ancoratges reals com "durant el capvespre", "a última hora de la tarda" o "en entrar la nit". NO al·lucinis referències al "matí" o al "migdia".
          
          4. CALIBRACIÓ D'INCERTESA I PERILLS SEVERS:
             - Modula el to segons la física del model: Aprofita la resolució de ${modelInfo.name}. En fenòmens convectius (xàfecs WMO 80-82 o tempestes WMO 95-99), parla de "probabilitat de ruixats irregulars" o "inestabilitat localitzada". En estabilitat o pluja estratiforme (WMO 61-63), parla amb certesa absoluta.
             - Si detectes perills severs (tempestes elèctriques, xafogor extrema >= 38ºC, ratxes > 60 km/h, pluja > 5 mm o AQI en Alerta), emet un avís clar i objectiu sobre l'impacte atmosfèric.

          5. LIMITACIONS DEL MODEL:
             - Llegeix NOMÉS la taula d'Evolució Prevista. PROHIBIT inventar dades, parlar de l'endemà o d'hores fora de la finestra de 6 hores.

          6. TERMINOLOGIA I IDIOMA:
             - Has de respondre EXCLUSIVAMENT en ${targetLanguage}.
             ${terminologyRule}

          OBJECTIUS DE LA RESPOSTA (JSON):
          - "text": Un paràgraf fluid, natural, directe i cronològicament exacte explicant l'evolució del cel, la temperatura/xafogor, el vent i els factors rellevants per a les properes 6 hores (màxim 2 o 3 frases denses en informació).
          - "tips": Llista EXACTA de 2 Punts Clau d'Observació Pràctica sota aquesta estricta estructura de slots:
              * Posició [0]: Reservat EXCLUSIVAMENT per a l'estat del cel, tendència de precipitació o fiabilitat del model (ex: "El model AROME confirma estabilitat seca tota la matinada", "Risc de xàfecs convectius locals a mitja tarda").
              * Posició [1]: Reservat EXCLUSIVAMENT per a confort tèrmic (xafogor/fred), vent o qualitat de l'aire (ex: "Xafogor moderada per humitat del 66% amb sensació de 30ºC", "Vent suau de component marítim sense ratxes destacables", "Qualitat de l'aire regular (EAQI 45) per pols en suspensió").
          - MAI incloguis consells de roba, material ni expressions paternals ("no cal paraigua").

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