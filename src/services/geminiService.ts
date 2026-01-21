// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prepareContextForAI, ExtendedWeatherData } from '../utils/weatherLogic'; 

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const CACHE_TTL = 30 * 60 * 1000; // 30 minuts de caché
const STORAGE_KEY = 'meteoai_gemini_cache';

let cachedModelName: string | null = null;

const LANG_MAP: Record<string, string> = {
    'ca': 'Catalan',
    'es': 'Spanish',
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian'
};

// --- INTERFÍCIES DE CACHÉ ---
interface AICacheData {
    text: string;
    tips: string[];
}

interface CacheEntry {
    data: AICacheData;
    timestamp: number;
}

// Tipus auxiliar per evitar l'ús de 'any'
type LocatableData = {
    latitude?: number;
    longitude?: number;
    location?: { latitude?: number; longitude?: number };
};

// --- GESTIÓ DE CACHÉ LOCAL (PERSISTÈNCIA) ---
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
    
    // Neteja automàtica d'entrades antigues
    const now = Date.now();
    for (const [k, v] of aiResponseCache.entries()) {
        if (now - v.timestamp > CACHE_TTL) aiResponseCache.delete(k);
    }

    try {
        const obj = Object.fromEntries(aiResponseCache);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
        console.warn("⚠️ No s'ha pogut guardar la cache al localStorage (Quota excedida?)");
    }
};

const getModelName = () => {
    if (cachedModelName) return cachedModelName;
    cachedModelName = "gemini-2.0-flash-exp"; 
    return cachedModelName;
};

export const getGeminiAnalysis = async (weatherData: ExtendedWeatherData, language: string): Promise<AICacheData | null> => {
    if (!API_KEY) return null;

    try {
        // 1. Validació de dades
        if (!weatherData?.current || !weatherData.hourly || !weatherData.daily) return null;

        // 2. Preparació del context reduït
        const context = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
        if (!context) return null;

        // 3. Generació de clau única per caché
        // CORRECCIÓ LINT: Ús de tipatge segur en lloc de 'any'
        const safeData = weatherData as unknown as LocatableData;
        const lat = safeData.latitude ?? safeData.location?.latitude ?? 0;
        const lon = safeData.longitude ?? safeData.location?.longitude ?? 0;

        // Clau composta: Lat-Lon-Elevació-Timestamp-Idioma
        const cacheKey = `${lat}-${lon}-${context.location.elevation}-${context.timestamp}-${language}`;
        
        // 4. Verificació de Caché
        const cached = aiResponseCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        // 5. Configuració del model
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: getModelName() });

        // 6. Construcció del Prompt (Enginyeria de Prompts optimitzada)
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
          3. Sigues honest amb la incertesa: si hi ha probabilitat de pluja del 40%, fes servir termes com "probablement", "risc de" o "atenció a la possibilitat de". Sigues precís, no inventis certeses.
          4. SENSE CLIXÉS: Evita frases buides com "Gaudeix del dia" o "No oblidis el paraigua". Sigues un professional que dóna informació tàctica i útil.
          5. IDIOMA DE SORTIDA: ${targetLanguage}.
          6. ${toneInstruction}

          OBJECTIUS DE LA RESPOSTA (JSON):
          - "text": Un paràgraf fluid (màxim 4 frases). Comença sempre pel factor més rellevant (el canvi de temps o el fenomen més destacat).
          - "tips": 2 recomanacions tàctiques basades en les condicions (ex: "Millor fer activitats a l'exterior abans de les 18h", "Evita zones exposades al vent").

          FORMAT REQUERIT (JSON pur, sense markdown):
          {"text": "...", "tips": ["...", "..."]}
        `;

        // 7. Generació
        const result = await model.generateContent(prompt);
        const textRaw = result.response.text();
        
        // 8. Extracció segura del JSON
        const jsonMatch = textRaw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        
        const parsed = JSON.parse(jsonMatch[0]) as AICacheData;

        // 9. Guardar a Caché
        if (parsed.text && Array.isArray(parsed.tips)) {
            saveCacheToStorage(cacheKey, parsed);
            return parsed;
        }

        return null;

    } catch (e) {
        console.error("Gemini API Error:", e);
        return null;
    }
};