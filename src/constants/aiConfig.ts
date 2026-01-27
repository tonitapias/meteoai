// src/constants/aiConfig.ts

// URL del Proxy (Cloudflare Worker) que protegeix la clau de l'API de Gemini
// Si no troba la variable d'entorn, usa la de fallback (per seguretat en dev)
export const GEMINI_PROXY_URL = import.meta.env.VITE_PROXY_URL || "https://meteoai-proxy.tonitapias.workers.dev";

// Temps de vida de la memòria cau de les anàlisis IA (1 hora)
// Evita gastar tokens innecessàriament si l'usuari refresca sovint.
export const AI_CACHE_TTL = 60 * 60 * 1000; 

// Temps màxim d'espera (Timeout) per a la resposta de la IA (12 segons)
// Si Gemini triga més d'això, tallem la connexió per no bloquejar l'experiència d'usuari.
export const AI_REQUEST_TIMEOUT = 12000; 

// Mapa de traducció per indicar explícitament a la IA en quin idioma ha de respondre
// Això millora la qualitat de la resposta respecte a deixar-ho en "auto".
export const TARGET_LANGUAGES: Record<string, string> = {
    'ca': 'Catalan',
    'es': 'Spanish',
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian'
};