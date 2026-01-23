// src/services/geminiService.ts
import { prepareContextForAI, ExtendedWeatherData } from '../utils/weatherLogic'; 
import * as Sentry from "@sentry/react";
import { get, set } from 'idb-keyval';

// --- CONFIGURACIÓ ---
const PROXY_URL = "https://meteoai-proxy.tonitapias.workers.dev"; 

const CACHE_TTL = 60 * 60 * 1000; 
// [CORRECCIÓ LINT] Eliminat DB_STORE_KEY ja que no s'usava

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

        // 5. Construcció del Prompt
        const targetLanguage = LANG_MAP[language] || 'Catalan';
        const toneInstruction = language === 'ca' 
            ? "Fes servir un to proper i meteopàtic, com un home del temps local experimentat." 
            : "Use a professional yet friendly meteorologist tone.";

        const prompt = `
          ACT COM: Expert Meteorologist.
          CONTEXT: ${JSON.stringify(context)}
          TASK: Analyze this weather data and generate a short, helpful summary.
          
          RULES:
          1. NO expliquis els números (ja els veig al gràfic). INTERPRETA'LS.
          2. Destaca fenòmens perillosos (vent fort, pluja intensa, fred extrem) SI N'HI HA.
          3. Sigues honest amb la incertesa.
          4. SENSE CLIXÉS.
          5. IDIOMA DE SORTIDA: ${targetLanguage}.
          6. ${toneInstruction}

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