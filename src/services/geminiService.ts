// src/services/geminiService.ts
import { prepareContextForAI, ExtendedWeatherData } from '../utils/weatherLogic'; 
import * as Sentry from "@sentry/react";
import { TRANSLATIONS } from '../translations'; 
import { cacheService } from './cacheService'; 

// --- CONFIGURACIÓ ---
// Utilitzem la variable d'entorn o el fallback per defecte
const PROXY_URL = import.meta.env.VITE_PROXY_URL || "https://meteoai-proxy.tonitapias.workers.dev"; 

const AI_CACHE_TTL = 60 * 60 * 1000; 

const LANG_MAP: Record<string, string> = {
    'ca': 'Catalan',
    'es': 'Spanish',
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian'
};

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
    if (!PROXY_URL || PROXY_URL.includes("EL_TEU_SUBDOMINI")) {
        console.error("❌ Error: Has de configurar la PROXY_URL a l'arxiu .env");
        return null;
    }

    try {
        // 1. Validació de dades
        if (!weatherData?.current || !weatherData.hourly || !weatherData.daily) return null;

        // 2. Preparació del context
        const context = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
        if (!context) return null;

        // 3. Generació de Clau Única
        const safeData = weatherData as unknown as LocatableData;
        const lat = safeData.latitude ?? safeData.location?.latitude ?? 0;
        const lon = safeData.longitude ?? safeData.location?.longitude ?? 0;
        
        const timestampKey = context.location.elevation.toString(); 
        const cacheKey = cacheService.generateAiKey(timestampKey, lat, lon, language);
        
        // 4. Verificació de Caché
        try {
            const cachedData = await cacheService.get<AICacheData>(cacheKey, AI_CACHE_TTL);
            if (cachedData) {
                return cachedData;
            }
        } catch (dbError) {
            console.warn("⚠️ Error llegint Cache IA:", dbError);
        }

        // 5. Construcció del Prompt
        const t = TRANSLATIONS[language as keyof typeof TRANSLATIONS];
        const fallbackT = TRANSLATIONS['en'] || TRANSLATIONS['ca'];
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getStr = (key: string, defaultText: string) => (t as any)?.[key] || (fallbackT as any)?.[key] || defaultText;

        const role = getStr('ai_system_role', "Act as an Expert Meteorologist.");
        const tone = getStr('ai_tone_instruction', "Use a professional but approachable tone.");
        const task = getStr('ai_task_instruction', "Analyze the data and provide a short summary.");

        const targetLanguage = LANG_MAP[language] || 'English';

        const prompt = `
          ACT COM: ${role}
          CONTEXT: ${JSON.stringify(context)}
          TASK: ${task}
          
          RULES:
          1. ${tone}
          2. SENSE CLIXÉS.
          3. IDIOMA DE SORTIDA: ${targetLanguage}.

          OBJECTIUS DE LA RESPOSTA (JSON):
          - "text": Un paràgraf fluid (màxim 4 frases).
          - "tips": 2 recomanacions tàctiques.

          FORMAT REQUERIT (JSON pur, sense markdown):
          {"text": "...", "tips": ["...", "..."]}
        `;

        // 6. Crida al Proxy
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!rawText) return null;

        // 7. Parseig
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        
        const parsed = JSON.parse(jsonMatch[0]) as AICacheData;

        // 8. Guardar a Cache
        if (parsed.text && Array.isArray(parsed.tips)) {
            await cacheService.set(cacheKey, parsed);
            return parsed;
        }

        return null;

    } catch (e) {
        console.error("Gemini Proxy Error:", e);
        Sentry.captureException(e, { tags: { service: 'GeminiProxy' } });
        return null;
    }
};