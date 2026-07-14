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
        
        const elevationKey = context.location.elevation.toString(); 
        const cacheKey = cacheService.generateAiKey(elevationKey, lat, lon, language);
        
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
            const nowMs = Date.now();
            const times = weatherData.hourly.time;
            
            let startIndex = times.findIndex(t => {
                const tMs = typeof t === 'number' ? t * 1000 : new Date(t).getTime();
                return tMs >= nowMs - (30 * 60 * 1000);
            });

            if (startIndex === -1) startIndex = 0;
            const endIndex = Math.min(startIndex + 6, times.length); 

            const slices = [];
            for (let i = startIndex; i < endIndex; i++) {
                const timeRaw = times[i];
                const dateObj = new Date(typeof timeRaw === 'number' ? timeRaw * 1000 : timeRaw);
                const hourStr = `${dateObj.getHours().toString().padStart(2, '0')}:00`;

                const temp = weatherData.hourly.temperature_2m?.[i] ?? '--';
                const wind = weatherData.hourly.wind_speed_10m?.[i] ?? '--';
                const gusts = weatherData.hourly.wind_gusts_10m?.[i] ?? '--';
                const precip = weatherData.hourly.precipitation?.[i] ?? 0;
                const prob = weatherData.hourly.precipitation_probability?.[i] ?? 0;

                slices.push(`[${hourStr}] Temp: ${temp}ºC | Vent: ${wind}km/h | Ratxes: ${gusts}km/h | Pluja: ${precip}mm (Prob: ${prob}%)`);
            }
            finestraPrevista = slices.join('\n');
        }

        const prompts = AI_PROMPTS[language] || AI_PROMPTS['en'] || AI_PROMPTS['ca'];
        const targetLanguage = TARGET_LANGUAGES[language] || 'English';

        const terminologyRule = 
            language === 'ca' ? '- DIRECTIVA LINGÜÍSTICA CRÍTICA: Has d\'escriure en un català central impecable, natural i genuí (normativa IEC). ZERO ANGLICISMES i ZERO calcs del castellà. Revisa estrictament l\'ortografia. Vocabulari obligatori: fes servir "ruixat" o "xàfec" (mai "xubasco"), "matinada" (mai "madrugada"). Per al vent, utilitza SEMPRE "ratxes" o "ràfegues" (ESTRICTAMENT PROHIBIT escriure "ràtzes" o inventar faltes d\'ortografia). MAI utilitzis la paraula "umbrella".' :
            language === 'es' ? '- Utiliza términos cercanos y naturales. CERO ANGLICISMOS: es obligatorio traducirlo todo al español (ex: usa "paraguas", NUNCA la palabra "umbrella").' :
            language === 'fr' ? '- Utilisez des termes naturels et familiers. ZÉRO ANGLICISME : traduisez tout en français correct (ex: utilisez "parapluie", JAMAIS le mot "umbrella").' :
            '- Use natural and approachable terms like "wind gusts", "showers" or "cooling down".';
        const prompt = `
          ROL: ${prompts.role}
          
          ESTAT ACTUAL (Ara mateix):
          Temperatura: ${weatherData.current.temperature_2m}ºC
          Pluja actual: ${weatherData.current.precipitation}mm

          EVOLUCIÓ PREVISTA (PROPERES 6 HORES):
          ${finestraPrevista}
          
          TASKA: ${prompts.task}
          
          REGLES DE REDACCIÓ (OBLIGATÒRIES):
          1. ENFOCAMENT PRÀCTIC I PROPER:
             - En condicions normals, explica de manera senzilla i amable com evolucionarà el temps.
          
          2. PROTOCOL DE RISC (MOLT IMPORTANT):
             - Si detectes anomalies a la taula de dades (ex: vent o ratxes > 60 km/h, precipitacions intenses > 5 mm, o caigudes brusques de temperatura de més de 5ºC), CANVIA EL TO IMMEDIATAMENT.
             - Emet un avís clar, directe i objectiu de precaució. En aquests casos, la seguretat passa per davant de l'amabilitat.
          
          3. LIMITACIONS DEL MODEL:
             - Llegeix NOMÉS la taula d'Evolució Prevista.
             - PROHIBIT inventar dades o parlar de l'endemà.
             - PROHIBIT començar la resposta amb "Segons les dades..." o "Hola,".

          3. TERMINOLOGIA I IDIOMA:
             - Has de respondre EXCLUSIVAMENT en ${targetLanguage}.
             ${terminologyRule}

          OBJECTIUS DE LA RESPOSTA (JSON):
          - "text": Un paràgraf amable, directe i fàcil de llegir (màxim 3 frases curtes).
          - "tips": 2 consells molt pràctics i quotidians.

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
                // ARA SÍ QUE FEM SERVIR SENTRY I LA VARIABLE parseError
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