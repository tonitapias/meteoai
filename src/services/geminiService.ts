// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prepareContextForAI } from '../utils/weatherLogic'; 

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const CACHE_TTL = 30 * 60 * 1000; 
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

const loadCacheFromStorage = (): Map<string, { data: any, timestamp: number }> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.warn("⚠️ No s'ha pogut carregar la cache del localStorage.");
  }
  return new Map();
};

const aiResponseCache = loadCacheFromStorage();

const saveCacheToStorage = () => {
  try {
    const obj = Object.fromEntries(aiResponseCache);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error("❌ Error guardant a localStorage (possiblement quota plena).");
  }
};

export const getGeminiAnalysis = async (weatherData: any, lang: string = 'ca') => {
  if (!API_KEY || API_KEY.length < 10) return null;

  const lat = (weatherData.latitude || weatherData.location?.latitude || weatherData.current?.latitude)?.toFixed(4);
  const lon = (weatherData.longitude || weatherData.location?.longitude || weatherData.current?.longitude)?.toFixed(4);
  const cacheKey = `IA-${lat}-${lon}-${weatherData.current?.weather_code}-${lang}`;
  const now = Date.now();

  if (aiResponseCache.has(cacheKey)) {
    const cached = aiResponseCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL) {
      console.log(`📦 MeteoAI: Anàlisi recuperada del localStorage per a ${cacheKey}`);
      return cached.data;
    }
    aiResponseCache.delete(cacheKey);
    saveCacheToStorage();
  }

  try {
    const modelName = await (async () => {
      if (cachedModelName) return cachedModelName;
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        const modelNames = (data.models || []).map((m: any) => m.name);
        const best = ['models/gemini-2.0-flash', 'models/gemini-1.5-flash', 'models/gemini-pro'].find(c => modelNames.includes(c));
        cachedModelName = best ? best.replace('models/', '') : "gemini-1.5-flash";
        return cachedModelName;
      } catch { return "gemini-1.5-flash"; }
    })();

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const richContext = prepareContextForAI(
        weatherData.current, 
        weatherData.daily, 
        weatherData.hourly
    );
    const contextString = JSON.stringify(richContext);

    // Detecció de severitat per ajustar el to professional
    const isSevere = (weatherData.current?.weather_code >= 60) || (weatherData.current?.wind_speed_10m > 40);
    
    // MODIFICAT: To més humà i proper, mantenint rigor en cas d'emergència
    const toneInstruction = isSevere 
        ? "TONE: Autoritat professional i serietat màxima. Prioritza la seguretat i explica els riscos de forma clara i directa, sense alarmismes però amb fermesa." 
        : "TONE: Professional, amable i divulgatiu. Utilitza un relat fluid i natural, com si fessis la crònica del temps a la ràdio o TV per a un públic general.";

    const targetLanguage = LANG_MAP[lang] || 'Catalan';

    // MODIFICAT: Prompt optimitzat per evitar tecnicismes i millorar la narrativa
    const prompt = `
      Actua com un meteoròleg expert amb gran capacitat de comunicació. La teva missió és traduir dades numèriques complexes en un relat entenedor, precís i seriós per a l'usuari.
      
      CONTEXT DE DADES (JSON):
      ${contextString}

      INSTRUCCIONS DE RELAT:
      1. SENSE TECNICISMES: No utilitzis paraules com 'gradients', 'higrometria', 'convectiu' o 'isoterma'. En lloc d'això, explica l'efecte real (ex: 'canvi sobtat de temperatura', 'humitat que augmenta la sensació de xafogor').
      2. RELAT PROPER: Explica el "perquè" i el "què esperar" de les pròximes hores de forma natural. 
      3. SERIETAT PROFESSIONAL: Evita bromes o frases massa col·loquials. Manté el rigor científic però amb paraules del dia a dia.
      4. IDIOMA DE SORTIDA: ${targetLanguage}.
      5. ${toneInstruction}
      
      OBJECTIUS DE LA RESPOSTA (JSON):
      - "text": Resum de l'estat actual i tendència immediata (màxim 3 frases). Ha de ser un paràgraf fluid, no una llista.
      - "tips": 2 recomanacions pràctiques i tàctiques basades en les condicions (ex: visibilitat en carretera, precaució amb el vent, hidratació).

      FORMAT REQUERIT (JSON pur, sense markdown):
      {"text": "...", "tips": ["...", "..."]}
    `;

    const result = await model.generateContent(prompt);
    const textRaw = (await result.response).text();
    
    const jsonMatch = textRaw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);

    aiResponseCache.set(cacheKey, { data: parsed, timestamp: now });
    saveCacheToStorage();

    return parsed;

  } catch (error: any) {
    console.error("🚨 Error Gemini:", error.message);
    return null;
  }
};