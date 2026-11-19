// src/utils/aqiLevel.ts
// Valor, nivell i color de qualitat de l'aire: una sola font per al giny (AqiWidget, també les barres de cada
// contaminant), el modal (AqiModal), els destacats de la pestanya Ara i el nom accessible de la targeta. Abans les bandes
// eren copiades a tres llocs (aquí, els segments del giny i el modal) i els colors a dos.

export type AqiScale = 'EAQI' | 'USAQI';

export type AqiResult = {
    value: number;
    type: AqiScale;
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

/**
 * Bandes de cada escala: el valor màxim (inclòs) de cada nivell; per sobre de l'últim, TOP_LEVEL.
 * - EAQI: l'índex europeu tal com el calcula i el documenta Open-Meteo (CAMS): 0-20 bona, 20-40 raonable, 40-60
 *   moderada, 60-80 dolenta, 80-100 molt dolenta i més de 100 extrema. Són les mateixes que llegeix la IA
 *   (AQI_BANDS de geminiService.ts). Abans aquí hi havia 20/40/50/100/150, que són les bandes de concentració del PM10
 *   de l'AEMA en µg/m³, aplicades per error a l'índex: un 55 sortia "Dolenta" (és moderada) i un 90 "Dolenta" (és molt
 *   dolenta), mentre la IA deia el contrari.
 * - USAQI (EPA): 0-50, 51-100, 101-150, 151-200, 201-300 i més de 300.
 */
export const AQI_BANDS: Record<AqiScale, ReadonlyArray<{ level: AqiLevel; max: number }>> = {
    EAQI: [
        { level: 'good', max: 20 }, { level: 'fair', max: 40 }, { level: 'moderate', max: 60 },
        { level: 'poor', max: 80 }, { level: 'very_poor', max: 100 },
    ],
    USAQI: [
        { level: 'good', max: 50 }, { level: 'moderate', max: 100 }, { level: 'sensitive', max: 150 },
        { level: 'poor', max: 200 }, { level: 'very_poor', max: 300 },
    ],
};
const TOP_LEVEL: Record<AqiScale, AqiLevel> = { EAQI: 'extreme', USAQI: 'hazardous' };

/** Final de les barres (el carril del giny i les barres dels contaminants): l'EAQI hi té les sis bandes a parts iguals. */
export const AQI_SCALE_MAX: Record<AqiScale, number> = { EAQI: 120, USAQI: 500 };

/** Nivell d'un valor de l'escala (també d'un subíndex d'un contaminant). */
export const getAqiLevelFor = (value: number, type: AqiScale): AqiLevel =>
    AQI_BANDS[type].find(b => value <= b.max)?.level ?? TOP_LEVEL[type];

export const getAqiLevel = ({ value, type }: AqiResult): AqiLevel => getAqiLevelFor(value, type);

/** Nivells que avisen (el llum del giny parpelleja): l'EAQI dolenta o pitjor; l'USAQI, per a sensibles o pitjor. */
export const isAqiAlertLevel = (level: AqiLevel): boolean =>
    level === 'sensitive' || level === 'poor' || level === 'very_poor' || level === 'extreme' || level === 'hazardous';

/**
 * Color de cada nivell, el mateix al giny, a les barres dels contaminants i al modal. `family` permet que cada component
 * en tingui les variants pròpies (ombra, vora, degradat) escrites senceres, perquè Tailwind les pugui generar.
 */
export type AqiColorFamily = 'cyan' | 'emerald' | 'yellow' | 'amber' | 'rose' | 'fuchsia' | 'purple' | 'red' | 'slate';
export interface AqiLevelColor { family: AqiColorFamily; text: string; bg: string; hex: string }

const C = {
    cyan: { family: 'cyan', text: 'text-cyan-400', bg: 'bg-cyan-500', hex: '#22d3ee' },
    emerald: { family: 'emerald', text: 'text-emerald-400', bg: 'bg-emerald-500', hex: '#34d399' },
    yellow: { family: 'yellow', text: 'text-yellow-300', bg: 'bg-yellow-300', hex: '#fde047' },
    amber: { family: 'amber', text: 'text-amber-400', bg: 'bg-amber-400', hex: '#fbbf24' },
    rose: { family: 'rose', text: 'text-rose-500', bg: 'bg-rose-500', hex: '#f43f5e' },
    fuchsia: { family: 'fuchsia', text: 'text-fuchsia-500', bg: 'bg-fuchsia-500', hex: '#d946ef' },
    purple: { family: 'purple', text: 'text-purple-500', bg: 'bg-purple-500', hex: '#a855f7' },
    red: { family: 'red', text: 'text-red-800', bg: 'bg-red-800', hex: '#991b1b' },
} as const satisfies Record<Exclude<AqiColorFamily, 'slate'>, AqiLevelColor>;

/** Sense dada o un nivell que l'escala no té. */
export const AQI_NO_DATA_COLOR: AqiLevelColor = { family: 'slate', text: 'text-slate-400', bg: 'bg-slate-500/20', hex: '#64748b' };

export const AQI_LEVEL_COLOR: Record<AqiScale, Partial<Record<AqiLevel, AqiLevelColor>>> = {
    EAQI: { good: C.cyan, fair: C.emerald, moderate: C.yellow, poor: C.rose, very_poor: C.fuchsia, extreme: C.purple },
    USAQI: { good: C.emerald, moderate: C.yellow, sensitive: C.amber, poor: C.rose, very_poor: C.fuchsia, hazardous: C.red },
};

export const getAqiLevelColor = (level: AqiLevel, type: AqiScale): AqiLevelColor => AQI_LEVEL_COLOR[type][level] ?? AQI_NO_DATA_COLOR;

// --- Desglossament de contaminants (giny de Qualitat de l'aire) ---

export type PollutantKey = 'pm2_5' | 'pm10' | 'nitrogen_dioxide' | 'ozone';

/** Els quatre contaminants del giny, en aquest ordre (els mateixos que el desglossament del modal, sense el SO₂). */
export const POLLUTANTS: ReadonlyArray<{ key: PollutantKey; label: string }> = [
    { key: 'pm2_5', label: 'PM2.5' },
    { key: 'pm10', label: 'PM10' },
    { key: 'nitrogen_dioxide', label: 'NO₂' },
    { key: 'ozone', label: 'O₃' },
];

export interface PollutantReading {
    key: PollutantKey;
    label: string;
    /** Concentració en µg/m³ (la xifra que es mostra, la mateixa que el modal). */
    value: number | null;
    /** Subíndex europeu del contaminant (european_aqi_<clau> d'Open-Meteo), en la mateixa escala que l'índex. */
    index: number | null;
    /** Nivell del subíndex, amb les mateixes bandes que l'índex (getAqiLevelFor). */
    level: AqiLevel | null;
}

const finiteOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * La concentració i el subíndex europeu de cada contaminant. L'índex europeu és el màxim dels subíndexs, així que el
 * contaminant pitjor té el nivell (i el color) de l'índex. DOCTRINA RISC ZERO: el que falta és null (mai un 0).
 * Accepta aqiData.current o aqiData sencer.
 */
export const extractPollutantBreakdown = (data: unknown): PollutantReading[] => {
    const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const current = record.current && typeof record.current === 'object' ? (record.current as Record<string, unknown>) : record;
    return POLLUTANTS.map(({ key, label }) => {
        const index = finiteOrNull(current[`european_aqi_${key}`]);
        return { key, label, value: finiteOrNull(current[key]), index, level: index !== null ? getAqiLevelFor(index, 'EAQI') : null };
    });
};
