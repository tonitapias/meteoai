// src/services/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PERSONAS, generateWeatherPrompt } from "../constants/aiPrompts";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Cache per no haver de buscar el model cada vegada
let cachedModelName = null;

// --- 1. FUNCIÓ ESTABLE DE CERCA DE MODELS ---
const findAvailableModel = async () => {
  if (cachedModelName) return cachedModelName;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await response.json();
    
    if (data.error) {
        console.warn("⚠️ Error llistant models, usant fallback segur.");
        return "gemini-pro"; 
    }

    const modelNames = (data.models || []).map(m => m.name);

    // LLISTA DE PRIORITAT 
    const candidates = [
      'models/gemini-1.5-flash',
      'models/gemini-1.5-flash-latest',
      'models/gemini-1.5-flash-001',
      'models/gemini-flash-latest',    
      'models/gemini-pro',
      'models/gemini-2.0-flash'
    ];

    const bestMatch = candidates.find(c => modelNames.includes(c));

    if (bestMatch) {
      cachedModelName = bestMatch.replace('models/', '');
      console.log(`🚀 MeteoAI: Model connectat amb èxit -> [${cachedModelName}]`);
      return cachedModelName;
    }

    return "gemini-pro";

  } catch (e) {
    console.error("Error seleccionant model:", e);
    return "gemini-pro";
  }
};

export const fetchEnhancedForecast = async (weatherContext, language = 'ca') => {
  try {
    // 1. Trobem el model que funciona
    const modelName = await findAvailableModel();
    if (!modelName) return null;

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    // 2. Seleccionem la personalitat correcta (Fallback a 'ca' si no existeix)
    const persona = PERSONAS[language] || PERSONAS['ca'];

    // 3. Generem el prompt usant la funció externa
    const prompt = generateWeatherPrompt(persona, weatherContext);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    if (error.message && error.message.includes("429")) {
        console.warn("⚠️ Quota excedida momentàniament.");
    } else {
        console.error("⚠️ Error Gemini:", error);
    }
    return null;
  }
};