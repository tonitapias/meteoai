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
    
    const toneInstruction = isSevere 
        ? "TONE: Critical, authoritative, strictly objective, and safety-focused. Prioritize data thresholds and immediate risks." 
        : "TONE: Professional, technical, concise, and formal. Avoid any personal advice, humor, or lifestyle references.";

    const targetLanguage = LANG_MAP[lang] || 'Catalan';

    const prompt = `
      You are the Technical Meteorological Analysis System (TMAS). Your role is to provide rigorous, high-precision weather assessments based on numerical data.
      
      DATA CONTEXT (JSON):
      ${contextString}

      MISSION INSTRUCTIONS:
      1. ANALYZE DATA: Evaluate 'short_term_trend' (next 4h) for significant shifts in thermal gradients, wind velocity, and convective stability (CAPE).
      2. STRICT PROFESSIONALISM: ${toneInstruction}
      3. NO LIFESTYLE: Do NOT mention coffee, clothes, washing cars, or running. Focus ONLY on meteorological impacts.
      4. OUTPUT LANGUAGE: ${targetLanguage}.
      
      RESPONSE OBJECTIVES (JSON):
      - "text": Technical impact summary (max 2 sentences). Start directly with the analysis. 
        * Focus on atmospheric stability, hygrometry (humidity impacts), and precise timing of hydrometeors.
      
      - "tips": 2 short, technical tactical recommendations based on operational risks.
        * Focus on surface conditions (hydroplaning, ice), wind load constraints, or visibility thresholds.

      REQUIRED OUTPUT FORMAT (Valid JSON, no markdown):
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