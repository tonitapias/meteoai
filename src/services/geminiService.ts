// src/services/geminiService.ts
import { prepareContextForAI, ExtendedWeatherData } from '../utils/weatherLogic'; 

// --- CONFIGURACIÓ ---
// Posa aquí la URL que has copiat de Cloudflare
const PROXY_URL = "https://meteoai-proxy.tonitapias.workers.dev"; 

const CACHE_TTL = 30 * 60 * 1000; // 30 minuts de caché
const STORAGE_KEY = 'meteoai_gemini_cache';

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

// Tipus auxiliar
type LocatableData = {
    latitude?: number;
    longitude?: number;
    location?: { latitude?: number; longitude?: number };
};

// --- GESTIÓ DE CACHÉ LOCAL ---
const loadCacheFromStorage = (): Map<string, CacheEntry> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return new Map(Object.entries(parsed));
    }
  } catch {
    console.warn("⚠️ No s'ha pogut carregar la cache del localStorage.");
  }
  return new Map();
};

const aiResponseCache = loadCacheFromStorage();

const saveCacheToStorage = (key: string, data: AICacheData) => {
    aiResponseCache.set(key, { data, timestamp: Date.now() });
    
    // Neteja automàtica
    const now = Date.now();
    for (const [k, v] of aiResponseCache.entries()) {
        if (now - v.timestamp > CACHE_TTL) aiResponseCache.delete(k);
    }

    try {
        const obj = Object.fromEntries(aiResponseCache);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
        console.warn("⚠️ No s'ha pogut guardar la cache al localStorage.");
    }
};

export const getGeminiAnalysis = async (weatherData: ExtendedWeatherData, language: string): Promise<AICacheData | null> => {
    // NOTA: Ja no comprovem API_KEY aquí perquè està al servidor
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

        // 3. Clau de Caché
        const safeData = weatherData as unknown as LocatableData;
        const lat = safeData.latitude ?? safeData.location?.latitude ?? 0;
        const lon = safeData.longitude ?? safeData.location?.longitude ?? 0;
        const cacheKey = `${lat}-${lon}-${context.location.elevation}-${context.timestamp}-${language}`;
        
        // 4. Verificació de Caché
        const cached = aiResponseCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        // 5. Construcció del Prompt (Igual que abans)
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

        // 6. CRIDA SEGURA AL PROXY (Canvi principal)
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);

        const data = await response.json();
        
        // Extreure el text de la resposta de Google (que ve dins del JSON del proxy)
        // Estructura: candidates[0].content.parts[0].text
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!rawText) return null;

        // 7. Neteja i parseig del JSON intern de la IA
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        
        const parsed = JSON.parse(jsonMatch[0]) as AICacheData;

        // 8. Guardar a Caché
        if (parsed.text && Array.isArray(parsed.tips)) {
            saveCacheToStorage(cacheKey, parsed);
            return parsed;
        }

        return null;

    } catch (e) {
        console.error("Gemini Proxy Error:", e);
        return null;
    }
};