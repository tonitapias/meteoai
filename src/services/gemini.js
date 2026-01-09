// src/services/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Cache per no haver de buscar el model cada vegada
let cachedModelName = null;

// --- 1. FUNCIÓ ESTABLE DE CERCA DE MODELS (LA TEVA VERSIÓ QUE FUNCIONA) ---
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

// --- 2. CONFIGURACIÓ DE PERSONALITATS (PER ARREGLAR TRADUCCIONS) ---
const PERSONAS = {
    ca: {
        langName: "Català",
        role: "Ets el MeteoToni, un meteoròleg català expert.",
        style: "Proper, simpàtic, amb expressions locals ('Déu n'hi do', 'quin fred').",
        alertMode: "Seriós, concís i prioritzant la seguretat."
    },
    es: {
        langName: "Español",
        role: "Eres MeteoToni, un meteorólogo local experto.",
        style: "Cercano, simpático, con expresiones naturales.",
        alertMode: "Serio, conciso, priorizando la seguridad."
    },
    en: {
        langName: "English",
        role: "You are MeteoToni, an expert local weatherman.",
        style: "Friendly, witty, using natural phrasing.",
        alertMode: "Serious, concise, safety first."
    },
    fr: {
        langName: "Français",
        role: "Vous êtes MeteoToni, un expert météo local.",
        style: "Amical, spirituel, langage naturel.",
        alertMode: "Sérieux, concis, priorité à la sécurité."
    }
};

export const fetchEnhancedForecast = async (weatherContext, language = 'ca') => {
  try {
    // 1. Trobem el model que funciona (Codi estable)
    const modelName = await findAvailableModel();
    if (!modelName) return null;

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    // 2. Seleccionem la personalitat correcta
    const persona = PERSONAS[language] || PERSONAS['ca'];

    // 3. PROMPT DINÀMIC ARREGLAT
    // Ara injectem les instruccions en l'idioma correcte i eliminem contradiccions.
    const prompt = `
      ROL: ${persona.role}
      
      Dades Tècniques:
      ${JSON.stringify(weatherContext)}
      
      PAS 1: ANALITZA LA SEVERITAT
      - Mira si hi ha vent > 50km/h, pluges fortes, o temperatures extremes.
      - SI ÉS EXTREM: Activa el "MODE ALERTA" (${persona.alertMode}).
      - SI ÉS NORMAL: Activa l'estil habitual (${persona.style}).

      PAS 2: REDACTA EL MISSATGE
      1. IDIOMA OBLIGATORI: ${persona.langName}.
      2. ESTRUCTURA (Màx 3 frases curtes):
         - Situació actual + Acció clara + Tendència.
      3. FINAL OBLIGATORI: Afegeix UN únic emoji al final.
    `;

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