// src/components/smartForecastI18n.ts
// Textos dels gràfics d'Expert (SmartForecastCharts): xifres clau, xip d'acord entre models i notes.
// Mateix patró que TrendChartModal/ConsensusChartsModal: diccionari propi per idioma, sense dependre de
// les claus globals de translations/ perquè aquest chunk es carrega lazy.
import type { Language } from '../translations';

export interface SmartForecastText {
    /** Títol de la pestanya i del panell que fusiona volum i probabilitat de pluja. */
    rain: string;
    /** Rètol del gràfic de volum (mm/h). */
    volume: string;
    /** Nom de la línia principal quan no ve d'un model regional. */
    globalModel: string;
    figures: {
        high: string;
        low: string;
        maxDisagreement: string;
        total24h: string;
        rainStart: string;
        modelsWithRain: string;
        maxGust: string;
        maxWind: string;
        avgDisagreement: string;
    };
    /** Sub-línies de les xifres clau. */
    sub: {
        /** "models 2,1–8,5 mm": davant del rang entre models. */
        models: string;
        /** Davant de l'hora: "a les 4H". */
        at: string;
        /** "4 de 4". */
        of: string;
        rainThreshold: string;
        betweenModels: string;
    };
    agreement: {
        high: string;
        medium: string;
        low: string;
        none: string;
        /** Explicació completa (títol/`aria-label` del xip). */
        hint: string;
    };
    notes: {
        /** `{names}`: models que no es dibuixen perquè coincideixen amb la línia principal. */
        identical: string;
        /** AIFS no publica probabilitat de pluja: només surt als volums. */
        aifsNoProbability: string;
    };
}

export const SMART_FORECAST_I18N: Record<Language, SmartForecastText> = {
    ca: {
        rain: 'PLUJA',
        volume: 'VOLUM (MM)',
        globalModel: 'MODEL GLOBAL',
        figures: {
            high: 'Màxima',
            low: 'Mínima',
            maxDisagreement: 'Desacord màx.',
            total24h: 'Total 24 h',
            rainStart: 'Inici de pluja',
            modelsWithRain: 'Models amb pluja',
            maxGust: 'Ràfega màx.',
            maxWind: 'Vent màx.',
            avgDisagreement: 'Desacord mitjà'
        },
        sub: { models: 'models', at: 'a les', of: 'de', rainThreshold: 'volum ≥ 0,2 mm', betweenModels: 'entre models' },
        agreement: {
            high: 'Acord alt',
            medium: 'Acord mitjà',
            low: 'Acord baix',
            none: 'Sense comparació',
            hint: 'Acord entre els models globals (ECMWF, GFS, ICON, AIFS)'
        },
        notes: {
            identical: '{names} = model principal (mateixes dades, no es dibuixa).',
            aifsNoProbability: 'AIFS no publica probabilitat de pluja: només surt als volums.'
        }
    },
    es: {
        rain: 'LLUVIA',
        volume: 'VOLUMEN (MM)',
        globalModel: 'MODELO GLOBAL',
        figures: {
            high: 'Máxima',
            low: 'Mínima',
            maxDisagreement: 'Desacuerdo máx.',
            total24h: 'Total 24 h',
            rainStart: 'Inicio de lluvia',
            modelsWithRain: 'Modelos con lluvia',
            maxGust: 'Racha máx.',
            maxWind: 'Viento máx.',
            avgDisagreement: 'Desacuerdo medio'
        },
        sub: { models: 'modelos', at: 'a las', of: 'de', rainThreshold: 'volumen ≥ 0,2 mm', betweenModels: 'entre modelos' },
        agreement: {
            high: 'Acuerdo alto',
            medium: 'Acuerdo medio',
            low: 'Acuerdo bajo',
            none: 'Sin comparación',
            hint: 'Acuerdo entre los modelos globales (ECMWF, GFS, ICON, AIFS)'
        },
        notes: {
            identical: '{names} = modelo principal (mismos datos, no se dibuja).',
            aifsNoProbability: 'AIFS no publica probabilidad de lluvia: solo aparece en los volúmenes.'
        }
    },
    en: {
        rain: 'RAIN',
        volume: 'VOLUME (MM)',
        globalModel: 'GLOBAL MODEL',
        figures: {
            high: 'High',
            low: 'Low',
            maxDisagreement: 'Max disagreement',
            total24h: '24 h total',
            rainStart: 'Rain starts',
            modelsWithRain: 'Models with rain',
            maxGust: 'Max gust',
            maxWind: 'Max wind',
            avgDisagreement: 'Avg disagreement'
        },
        sub: { models: 'models', at: 'at', of: 'of', rainThreshold: 'volume ≥ 0.2 mm', betweenModels: 'between models' },
        agreement: {
            high: 'High agreement',
            medium: 'Medium agreement',
            low: 'Low agreement',
            none: 'No comparison',
            hint: 'Agreement between the global models (ECMWF, GFS, ICON, AIFS)'
        },
        notes: {
            identical: '{names} = main model (same data, not drawn).',
            aifsNoProbability: 'AIFS does not publish rain probability: it only appears in the volumes.'
        }
    },
    fr: {
        rain: 'PLUIE',
        volume: 'VOLUME (MM)',
        globalModel: 'MODÈLE GLOBAL',
        figures: {
            high: 'Maximale',
            low: 'Minimale',
            maxDisagreement: 'Désaccord max.',
            total24h: 'Total 24 h',
            rainStart: 'Début de pluie',
            modelsWithRain: 'Modèles avec pluie',
            maxGust: 'Rafale max.',
            maxWind: 'Vent max.',
            avgDisagreement: 'Désaccord moyen'
        },
        sub: { models: 'modèles', at: 'à', of: 'sur', rainThreshold: 'volume ≥ 0,2 mm', betweenModels: 'entre modèles' },
        agreement: {
            high: 'Accord élevé',
            medium: 'Accord moyen',
            low: 'Accord faible',
            none: 'Pas de comparaison',
            hint: 'Accord entre les modèles globaux (ECMWF, GFS, ICON, AIFS)'
        },
        notes: {
            identical: '{names} = modèle principal (mêmes données, non tracé).',
            aifsNoProbability: 'AIFS ne publie pas de probabilité de pluie : il n\'apparaît que dans les volumes.'
        }
    }
};

export const getSmartForecastText = (lang: Language | undefined): SmartForecastText =>
    SMART_FORECAST_I18N[lang ?? 'ca'] ?? SMART_FORECAST_I18N.ca;
