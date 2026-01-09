import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Cache per no haver de buscar el model cada vegada
let cachedModelName = null;

// Funció per trobar el nom real del model disponible per a la teva clau
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

    // LLISTA DE PRIORITAT (Optimitzada)
    const candidates = [
      'models/gemini-flash-latest',    
      'models/gemini-1.5-flash-latest',
      'models/gemini-pro-latest',      
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
    const modelName = await findAvailableModel();
    if (!modelName) return null;

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    // --- PROMPT AVANÇAT: AUTO-AVALUACIÓ DE RISC + EMOJI ---
    const prompt = `
      Actua com el "MeteoToni", un meteoròleg expert.
      
      Dades Tècniques:
      ${JSON.stringify(weatherContext)}
      
      PAS 1: ANALITZA LA SEVERITAT
      - Mira si hi ha vent > 50km/h, pluges fortes, o temperatures extremes (>35ºC o <0ºC).
      - SI ÉS EXTREM: Activa el "MODE ALERTA" (Seriós, concís, prioritat seguretat).
      - SI ÉS NORMAL: Activa el "MODE ENGINY" (Proper, simpàtic, expressions locals).

      PAS 2: REDACTA EL MISSATGE
      1. IDIOMA: ${language} (Català natural).
      2. ESTRUCTURA (Màx 3 frases curtes):
         - Situació actual + Acció clara + Tendència.
      3. ESTIL:
         - En MODE ALERTA: "Compte amb el vent fort! Evita zones arbrades..."
         - En MODE ENGINY: "Déu n'hi do quin ventet! Agafa un tallavents..."
      4. FINAL OBLIGATORI: Afegeix UN únic emoji al final que resumeixi la previsió.
      
      Exemple sortida (Normal):
      "Fa un dia de postal per sortir a passejar! No cal que agafis jaqueta, s'està de luxe al sol. Aprofita que a la tarda es taparà. 😎"
      
      Exemple sortida (Alerta):
      "Precaució màxima amb la tempesta elèctrica. Queda't a casa si pots i desconnecta aparells sensibles. La intensitat baixarà cap al vespre. ⛈️"
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