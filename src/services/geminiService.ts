// src/services/geminiService.ts
import { prepareContextForAI, ExtendedWeatherData } from '../utils/weatherLogic'; 
import * as Sentry from "@sentry/react";
import { cacheService } from './cacheService'; 
import { AI_PROMPTS } from '../constants/aiPrompts';

// Importem la configuració centralitzada
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

// Tipus auxiliar per coordenades
type LocatableData = {
    latitude?: number;
    longitude?: number;
    location?: { latitude?: number; longitude?: number };
};

export const getGeminiAnalysis = async (weatherData: ExtendedWeatherData, language: string): Promise<AICacheData | null> => {
    // Validació de seguretat de la configuració
    if (!GEMINI_PROXY_URL || GEMINI_PROXY_URL.includes("EL_TEU_SUBDOMINI")) {
        // CANVI: Warn en lloc d'Error per no embrutar logs si algú fa un fork sense config
        console.warn("⚠️ IA Desactivada: Manca configuració PROXY_URL"); 
        return null;
    }

    try {
        // 1. Validació de dades
        if (!weatherData?.current || !weatherData.hourly || !weatherData.daily) return null;

        // 2. Preparació del context
        const context = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
        if (!context) return null;

        // 3. Generació de Clau Única per a la Cache
        const safeData = weatherData as unknown as LocatableData;
        const lat = safeData.latitude ?? safeData.location?.latitude ?? 0;
        const lon = safeData.longitude ?? safeData.location?.longitude ?? 0;
        
        // Usem l'elevació com a part de la clau (context geogràfic únic)
        const elevationKey = context.location.elevation.toString(); 
        const cacheKey = cacheService.generateAiKey(elevationKey, lat, lon, language);
        
        // 4. Verificació de Caché (Estalvi de peticions)
        try {
            const cachedData = await cacheService.get<AICacheData>(cacheKey, AI_CACHE_TTL);
            if (cachedData) {
                return cachedData;
            }
        } catch (dbError) {
            console.warn("⚠️ Error llegint Cache IA:", dbError);
        }

        // 5. Construcció del Prompt (Enginyeria de Prompts)
        const prompts = AI_PROMPTS[language] || AI_PROMPTS['en'] || AI_PROMPTS['ca'];

        const role = prompts.role;
        const tone = prompts.tone;
        const task = prompts.task;

        const targetLanguage = TARGET_LANGUAGES[language] || 'English';

        const prompt = `
          ROL: ${role}
          
          DADES (Context JSON):
          ${JSON.stringify(context)}
          
          TASKA: ${task}
          
          REGLES CRÍTIQUES DE COHERÈNCIA (OBLIGATÒRIES):
          1. JERARQUIA D'INFORMACIÓ:
             - 1r: ALERTES o Perills (si n'hi ha).
             - 2n: Precipitació imminent (si plou ARA o risc > 50%).
             - 3r: Sensació tèrmica i vent (només si destaca).
          
          2. LLINDARS DE PLUJA (Thresholds):
             - Probabilitat < 20%: NO esmentis la pluja. Parla de núvols o sol.
             - Probabilitat 20% - 50%: Fes servir "possible" o "risc de".
             - Probabilitat > 50%: Dona-ho per fet ("s'espera", "tindrem").
             - Si "is_raining": true -> Està plovent ARA.

          3. LLINDARS DE VENT:
             - < 20 km/h: Ignora'l.
             - > 40 km/h: Esmenta'l com a factor molest/perillós.
          
          4. ESTIL:
             - ${tone}
             - DIRECTE: No comencis amb "Segons les dades...".

          5. TERMINOLOGIA I TRADUCCIÓ (MOLT IMPORTANT):
             ${language === 'ca' ? '- "Wind Gusts" o "Gusts" s\'ha de traduir SEMPRE com "Ratxes de vent" o "Ràfegues". MAI facis servir "Gusts de vent" (això és incorrecte).' : ''}
             - Evita traduccions literals que sonin robòtiques.
             - Fes servir un llenguatge natural i fluid.

          OBJECTIUS DE LA RESPOSTA (JSON):
          - "text": Un paràgraf fluid (màxim 3-4 frases) centrat en l'impacte (mullar-se, fred/calor, perill).
          - "tips": 2 consells pràctics i curts.

          IDIOMA DE SORTIDA: ${targetLanguage}
          FORMAT: JSON pur (sense markdown).
          {"text": "...", "tips": ["...", "..."]}
        `;

        // 6. Crida al Proxy amb TIMEOUT (IMPLEMENTACIÓ DE SEGURETAT)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT);

        try {
            const response = await fetch(GEMINI_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
                signal: controller.signal 
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // MILLORA PAS 2: Gestió silenciosa d'errors HTTP
                // No llancem Error, només log i retornem null
                console.warn(`⚠️ IA Proxy Error: ${response.status} ${response.statusText}`);
                Sentry.addBreadcrumb({
                    category: 'ai-api',
                    message: `Proxy Error ${response.status}`,
                    level: 'warning'
                });
                return null; 
            }

            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!rawText) return null;

            // 7. Parseig i validació bàsica
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;
            
            const parsed = JSON.parse(jsonMatch[0]) as AICacheData;

            // 8. Guardar a Cache si el format és correcte
            if (parsed.text && Array.isArray(parsed.tips)) {
                await cacheService.set(cacheKey, parsed);
                return parsed;
            }

            return null;

        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // MILLORA PAS 2: Gestió silenciosa de xarxa/timeout
            if (fetchError instanceof Error) {
                 // Diferenciem Timeout d'altres errors de xarxa
                 const msg = fetchError.name === 'AbortError' 
                    ? `Gemini Timeout (${AI_REQUEST_TIMEOUT}ms)` 
                    : `Gemini Network Error: ${fetchError.message}`;

                 console.warn(`⚠️ ${msg}`);
                 
                 // Sentry Breadcrumb (Informació de context, no ERROR)
                 Sentry.addBreadcrumb({
                    category: 'ai-network',
                    message: msg,
                    level: 'warning'
                 });
            }
            return null; // Silent failover
        }

    } catch (e) {
        // Captura global d'errors de LÒGICA (Aquests sí que són bugs reals)
        console.error("Gemini Logic Error:", e);
        Sentry.captureException(e, { tags: { service: 'GeminiService', type: 'logic_error' } });
        return null;
    }
};