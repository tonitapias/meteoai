// src/services/geminiService.ts
import { prepareContextForAI, ExtendedWeatherData } from '../utils/weatherLogic'; 
import * as Sentry from "@sentry/react";
import { get, set } from 'idb-keyval';
import { TRANSLATIONS } from '../translations'; 

// --- CONFIGURACIÓ ---
const PROXY_URL = "https://meteoai-proxy.tonitapias.workers.dev"; 

const CACHE_TTL = 60 * 60 * 1000; 

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

interface CacheEntry {
    data: AICacheData;
    timestamp: number;
}

// Tipus auxiliar per coordenades
type LocatableData = {
    latitude?: number;
    longitude?: number;
    location?: { latitude?: number; longitude?: number };
};

export const getGeminiAnalysis = async (weatherData: ExtendedWeatherData, language: string): Promise<AICacheData | null> => {
    if (!PROXY_URL || PROXY_URL.includes("EL_TEU_SUBDOMINI")) {
        console.error("❌ Error: Has de configurar la PROXY_URL a geminiService.ts");
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
        
        const cacheKey = `gemini_${lat.toFixed(3)}_${lon.toFixed(3)}_${context.location.elevation}_${language}`;
        
        // 4. Verificació de Caché (Asíncrona amb IndexedDB)
        try {
            const cached = await get<CacheEntry>(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
                return cached.data;
            }
        } catch (dbError) {
            console.warn("⚠️ Error llegint IndexedDB:", dbError);
            Sentry.captureException(dbError, { tags: { service: 'IndexedDB' } });
        }

        // 5. Construcció del Prompt (DINÀMIC I SEGUR)
        // Recuperem les traduccions o fem fallback a 'ca'
        const t = TRANSLATIONS[language as keyof typeof TRANSLATIONS] || TRANSLATIONS['ca'];
        
        // Valors per defecte "hardcoded" per seguretat (circuit breaker)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const role = (t as any).ai_system_role || "Actua com un Meteoròleg Expert.";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tone = (t as any).ai_tone_instruction || "Fes servir un to professional però proper.";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const task = (t as any).ai_task_instruction || "Analitza les dades i fes un resum breu.";

        const targetLanguage = LANG_MAP[language] || 'Catalan';

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

        // 8. Guardar a IndexedDB (Asíncron)
        if (parsed.text && Array.isArray(parsed.tips)) {
            const entry: CacheEntry = { data: parsed, timestamp: Date.now() };
            set(cacheKey, entry).catch(err => console.warn("Error guardant a DB", err));
            return parsed;
        }

        return null;

    } catch (e) {
        console.error("Gemini Proxy Error:", e);
        Sentry.captureException(e, { tags: { service: 'GeminiProxy' } });
        return null;
    }
};