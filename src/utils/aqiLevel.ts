// src/utils/aqiLevel.ts
// Valor i nivell de qualitat de l'aire tal com els mostra el giny (AqiWidget). Viu aquí perquè la
// targeta "Vols més detall?" de la vista essencial digui exactament el mateix nivell que el giny.

export type AqiResult = {
    value: number;
    type: 'EAQI' | 'USAQI';
    pm25: number | null;
    pm10: number | null;
};

export type AqiLevel = 'good' | 'fair' | 'moderate' | 'sensitive' | 'poor' | 'very_poor' | 'extreme' | 'hazardous';

type SupportedLang = 'ca' | 'es' | 'en' | 'fr';

// Diccionari Tàctic Local per a Risc Zero (Garanteix els 4 idiomes encara que falli l'i18n global)
export const AQI_TRANSLATIONS: Record<SupportedLang, Record<'title' | 'nd' | AqiLevel, string>> = {
    ca: {
        title: "QUALITAT AIRE",
        nd: "N/D",
        good: "BONA",
        fair: "RAONABLE",
        moderate: "MODERADA",
        sensitive: "SENSIBLE",
        poor: "DOLENTA",
        very_poor: "MOLT DOLENTA",
        extreme: "EXTREMA",
        hazardous: "PERILLOSA"
    },
    es: {
        title: "CALIDAD AIRE",
        nd: "N/D",
        good: "BUENA",
        fair: "RAZONABLE",
        moderate: "MODERADA",
        sensitive: "SENSIBLE",
        poor: "MALA",
        very_poor: "MUY MALA",
        extreme: "EXTREMA",
        hazardous: "PELIGROSA"
    },
    en: {
        title: "AIR QUALITY",
        nd: "N/A",
        good: "GOOD",
        fair: "FAIR",
        moderate: "MODERATE",
        sensitive: "SENSITIVE",
        poor: "POOR",
        very_poor: "VERY POOR",
        extreme: "EXTREME",
        hazardous: "HAZARDOUS"
    },
    fr: {
        title: "QUALITÉ AIR",
        nd: "N/D",
        good: "BONNE",
        fair: "PASSABLE",
        moderate: "MODÉRÉE",
        sensitive: "SENSIBLE",
        poor: "MAUVAISE",
        very_poor: "TRÈS MAUVAISE",
        extreme: "EXTRÊME",
        hazardous: "DANGEREUSE"
    }
};

// Resolució segura d'idioma (Fallback sempre a Català)
export const getAqiSafeLang = (langParam?: string): SupportedLang => {
    if (!langParam) return 'ca';
    const l = langParam.toLowerCase().substring(0, 2);
    if (l === 'es') return 'es';
    if (l === 'en') return 'en';
    if (l === 'fr') return 'fr';
    return 'ca';
};

// DOCTRINA RISC ZERO: Extracció profunda blindada amb limitador de recursivitat (Stack Overflow Protection)
export const extractAqiData = (dataObj: unknown, depth = 0): AqiResult | null => {
    // Tallem en sec si passem de 4 nivells de profunditat per evitar bucles infinits
    if (!dataObj || typeof dataObj !== 'object' || depth > 4) return null;
    const record = dataObj as Record<string, unknown>;

    // Extracció segura de PM2.5 i PM10
    const pm25 = typeof record.pm2_5 === 'number' && !isNaN(record.pm2_5) ? record.pm2_5 : null;
    const pm10 = typeof record.pm10 === 'number' && !isNaN(record.pm10) ? record.pm10 : null;

    // 1. PRIORITAT ABSOLUTA: Escala Europea Oficial (AEMA)
    if (typeof record.european_aqi === 'number' && !isNaN(record.european_aqi)) {
        return { value: record.european_aqi, type: 'EAQI', pm25, pm10 };
    }

    // 2. FALLBACK: Escala Americana (EPA)
    if (typeof record.us_aqi === 'number' && !isNaN(record.us_aqi)) {
        return { value: record.us_aqi, type: 'USAQI', pm25, pm10 };
    }
    if (typeof record.aqi === 'number' && !isNaN(record.aqi)) {
        return { value: record.aqi, type: 'USAQI', pm25, pm10 };
    }

    // 3. Cerca recursiva controlada
    const wrapperKeys = ['current', 'current_weather', 'hourly', 'daily', 'air_quality'];
    for (const wrapper of wrapperKeys) {
        if (record[wrapper] && typeof record[wrapper] === 'object') {
            const nestedAqi = extractAqiData(record[wrapper], depth + 1);
            if (nestedAqi !== null) {
                return {
                    ...nestedAqi,
                    // Prioritzem els PM niuats, però usem els globals si falten
                    pm25: nestedAqi.pm25 ?? pm25,
                    pm10: nestedAqi.pm10 ?? pm10
                };
            }
        }
    }

    return null;
};

export const getAqiLevel = ({ value, type }: AqiResult): AqiLevel => {
    // ESTÀNDARD EAQI (Agència Europea de Medi Ambient): 6 Nivells Oficials
    if (type === 'EAQI') {
        if (value > 150) return 'extreme';
        if (value > 100) return 'very_poor';
        if (value > 50) return 'poor';
        if (value > 40) return 'moderate';
        if (value > 20) return 'fair';
        return 'good';
    }

    // ESTÀNDARD USAQI (EPA): 6 Nivells Oficials (Arriba fins a 500)
    if (value > 300) return 'hazardous';
    if (value > 200) return 'very_poor';
    if (value > 150) return 'poor';
    if (value > 100) return 'sensitive';
    if (value > 50) return 'moderate';
    return 'good';
};
