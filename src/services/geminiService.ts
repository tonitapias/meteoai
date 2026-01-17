// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prepareContextForAI } from '../utils/weatherLogic'; 

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const CACHE_TTL = 30 * 60 * 1000; // 30 minuts de caché per estalviar costos
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

// --- GESTIÓ DE CACHÉ LOCAL (PERSISTÈNCIA) ---
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

// --- FUNCIÓ PRINCIPAL ---
export const getGeminiAnalysis = async (weatherData: any, lang: string = 'ca') => {
  // 1. Validació de seguretat
  if (!API_KEY || API_KEY.length < 10) return null;

  // 2. Generació de clau de caché única (Geo + Temps + Idioma)
  const lat = (weatherData.latitude || weatherData.location?.latitude || weatherData.current?.latitude)?.toFixed(4);
  const lon = (weatherData.longitude || weatherData.location?.longitude || weatherData.current?.longitude)?.toFixed(4);
  const cacheKey = `IA-${lat}-${lon}-${weatherData.current?.weather_code}-${lang}`;
  const now = Date.now();

  // 3. Comprovació de Caché
  if (aiResponseCache.has(cacheKey)) {
    const cached = aiResponseCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL) {
      console.log(`📦 MeteoAI: Anàlisi recuperada del localStorage per a ${cacheKey}`);
      return cached.data;
    }
    // Si ha caducat, l'esborrem
    aiResponseCache.delete(cacheKey);
    saveCacheToStorage();
  }

  try {
    // 4. Selecció dinàmica del millor model disponible
    const modelName = await (async () => {
      if (cachedModelName) return cachedModelName;
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        const modelNames = (data.models || []).map((m: any) => m.name);
        // Prioritzem Gemini 2.0 -> 1.5 -> Pro
        const best = ['models/gemini-2.0-flash', 'models/gemini-1.5-flash', 'models/gemini-pro'].find(c => modelNames.includes(c));
        cachedModelName = best ? best.replace('models/', '') : "gemini-1.5-flash";
        return cachedModelName;
      } catch { return "gemini-1.5-flash"; }
    })();

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    // 5. Preparació del Context Físic (Dades netes)
    const richContext = prepareContextForAI(
        weatherData.current, 
        weatherData.daily, 
        weatherData.hourly
    );
    const contextString = JSON.stringify(richContext);

    // 6. Detecció de severitat per ajustar el to professional
    // Considerem sever si el codi és tempesta/pluja forta (>=60) o vent fort (>40km/h)
    const isSevere = (weatherData.current?.weather_code >= 60) || (weatherData.current?.wind_speed_10m > 40);
    
    const toneInstruction = isSevere 
        ? "TONE: Autoritat professional i serietat màxima. Prioritza la seguretat. Explica els riscos de forma clara, directa i sense alarmismes innecessaris, però amb fermesa." 
        : "TONE: Professional, amable i divulgatiu. Utilitza un relat fluid i natural, com un meteoròleg explicant el temps a la ràdio.";

    const targetLanguage = LANG_MAP[lang] || 'Catalan';

    // 7. PROMPT D'ENGINYERIA METEOROLÒGICA (AUDITAT)
    const prompt = `
      Actua com un meteoròleg de radar i curt termini (nowcasting). La teva missió és explicar l'evolució del temps per a les pròximes hores basant-te en dades físiques reals.

      CONTEXT DE DADES (JSON):
      ${contextString}

      INSTRUCCIONS DE RELAT CRÍTIQUES:
      1. PRIORITAT TEMPORAL: Si la "short_term_trend" mostra un canvi significatiu (arribada de pluja, pujada de vent o caiguda de temperatura) en les pròximes 2-4 hores, CENTRA EL RELAT EN AQUEST CANVI, no en l'estat actual estàtic.
      2. RAONAMENT FÍSIC: Relaciona les variables de forma natural (Ex: "La humitat alta farà que el fred se senti més intens" o "El cel s'anirà tapant ràpidament degut a la inestabilitat").
      3. GESTIÓ DE LA INCERTESA: Si les dades suggereixen canvis bruscos però no segurs, utilitza paraules com "probablement", "risc de" o "atenció a la possibilitat de". Sigues precís, no inventis certeses.
      4. SENSE CLIXÉS: Evita frases buides com "Gaudeix del dia" o "No oblidis el paraigua". Sigues un professional que dóna informació tàctica i útil.
      5. IDIOMA DE SORTIDA: ${targetLanguage}.
      6. ${toneInstruction}

      OBJECTIUS DE LA RESPOSTA (JSON):
      - "text": Un paràgraf fluid (màxim 4 frases). Comença sempre pel factor més rellevant (el canvi de temps o el fenomen més destacat).
      - "tips": 2 recomanacions tàctiques basades en les condicions (ex: "Millor fer activitats a l'exterior abans de les 18h", "Evita zones exposades al vent").

      FORMAT REQUERIT (JSON pur, sense markdown):
      {"text": "...", "tips": ["...", "..."]}
    `;

    // 8. Generació i Neteja de la resposta
    const result = await model.generateContent(prompt);
    const textRaw = (await result.response).text();
    
    // Extracció segura del JSON (per si la IA afegeix text fora de les claus)
    const jsonMatch = textRaw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);

    // 9. Guardar a caché i retornar
    aiResponseCache.set(cacheKey, { data: parsed, timestamp: now });
    saveCacheToStorage();

    return parsed;

  } catch (error: any) {
    console.error("🚨 Error Gemini Service:", error.message);
    return null; // El frontend gestionarà el null mostrant l'anàlisi local
  }
};