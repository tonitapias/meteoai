// src/components/smartForecastI18n.ts
// Textos dels gràfics d'Expert (SmartForecastCharts): xifres clau, xip d'acord, llegenda i notes.
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
    /** Nom de la ratxa de vent al cartell. */
    gust: string;
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
        snowLow: string;
        snowHigh: string;
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
    legend: {
        /** Etiqueta del grup de la llegenda (lector de pantalla). */
        label: string;
        /** Davant del nom del model de la línia principal: "Principal · AROME HD". */
        principal: string;
        band: string;
        /** Al costat d'un model que no es dibuixa perquè és idèntic a la principal: "ICON = principal". */
        identical: string;
        /** `{time}`: hora (HH:MM, del lloc) de les dades. */
        updated: string;
        /** Etiqueta de l'eix X sota la marca de l'hora actual. */
        now: string;
    };
    notes: {
        /** `{names}`: models que no es dibuixen perquè coincideixen amb la línia principal. */
        identical: string;
        /** AIFS no publica probabilitat de pluja: només surt als volums. */
        aifsNoProbability: string;
        /** Explica la línia contínua i la discontínua del gràfic de vent. */
        gusts: string;
    };
    snow: {
        /** `{cap}`: límit (m) a partir del qual l'app deixa de mostrar cota de neu. */
        above: string;
        noData: string;
    };
    strip: {
        /** Text de la franja de lectura (mòbil) quan encara no hi ha cap hora per mostrar. */
        hint: string;
    };
}

export const SMART_FORECAST_I18N: Record<Language, SmartForecastText> = {
    ca: {
        rain: 'PLUJA',
        volume: 'VOLUM (MM)',
        globalModel: 'MODEL GLOBAL',
        gust: 'Ràfega',
        figures: {
            high: 'Màxima',
            low: 'Mínima',
            maxDisagreement: 'Desacord màx.',
            total24h: 'Total 24 h',
            rainStart: 'Inici de pluja',
            modelsWithRain: 'Models amb pluja',
            maxGust: 'Ràfega màx.',
            maxWind: 'Vent màx.',
            avgDisagreement: 'Desacord mitjà',
            snowLow: 'Cota mínima',
            snowHigh: 'Cota màxima'
        },
        sub: { models: 'models', at: 'a les', of: 'de', rainThreshold: 'volum ≥ 0,2 mm', betweenModels: 'entre models' },
        agreement: {
            high: 'Acord alt',
            medium: 'Acord mitjà',
            low: 'Acord baix',
            none: 'Sense comparació',
            hint: 'Acord entre els models globals (ECMWF, GFS, ICON, AIFS)'
        },
        legend: {
            label: 'Models dels gràfics',
            principal: 'Principal',
            band: 'Banda de models',
            identical: '= principal',
            updated: 'Previsió de les {time}',
            now: 'ARA'
        },
        notes: {
            identical: '{names} = model principal (mateixes dades, no es dibuixa).',
            aifsNoProbability: 'AIFS no publica probabilitat de pluja: només surt als volums.',
            gusts: 'Línia contínua: vent sostingut. Discontínua: ràfegues.'
        },
        snow: {
            above: 'Sense neu prevista: la cota és per sobre de {cap} m durant tota la finestra.',
            noData: 'Cap model publica la cota de neu per a aquestes hores.'
        },
        strip: {
            hint: 'Arrossega el dit per sobre del gràfic per veure les dades de cada hora.'
        }
    },
    es: {
        rain: 'LLUVIA',
        volume: 'VOLUMEN (MM)',
        globalModel: 'MODELO GLOBAL',
        gust: 'Racha',
        figures: {
            high: 'Máxima',
            low: 'Mínima',
            maxDisagreement: 'Desacuerdo máx.',
            total24h: 'Total 24 h',
            rainStart: 'Inicio de lluvia',
            modelsWithRain: 'Modelos con lluvia',
            maxGust: 'Racha máx.',
            maxWind: 'Viento máx.',
            avgDisagreement: 'Desacuerdo medio',
            snowLow: 'Cota mínima',
            snowHigh: 'Cota máxima'
        },
        sub: { models: 'modelos', at: 'a las', of: 'de', rainThreshold: 'volumen ≥ 0,2 mm', betweenModels: 'entre modelos' },
        agreement: {
            high: 'Acuerdo alto',
            medium: 'Acuerdo medio',
            low: 'Acuerdo bajo',
            none: 'Sin comparación',
            hint: 'Acuerdo entre los modelos globales (ECMWF, GFS, ICON, AIFS)'
        },
        legend: {
            label: 'Modelos de los gráficos',
            principal: 'Principal',
            band: 'Banda de modelos',
            identical: '= principal',
            updated: 'Previsión de las {time}',
            now: 'AHORA'
        },
        notes: {
            identical: '{names} = modelo principal (mismos datos, no se dibuja).',
            aifsNoProbability: 'AIFS no publica probabilidad de lluvia: solo aparece en los volúmenes.',
            gusts: 'Línea continua: viento sostenido. Discontinua: rachas.'
        },
        snow: {
            above: 'Sin nieve prevista: la cota está por encima de {cap} m durante toda la ventana.',
            noData: 'Ningún modelo publica la cota de nieve para estas horas.'
        },
        strip: {
            hint: 'Arrastra el dedo sobre el gráfico para ver los datos de cada hora.'
        }
    },
    en: {
        rain: 'RAIN',
        volume: 'VOLUME (MM)',
        globalModel: 'GLOBAL MODEL',
        gust: 'Gust',
        figures: {
            high: 'High',
            low: 'Low',
            maxDisagreement: 'Max disagreement',
            total24h: '24 h total',
            rainStart: 'Rain starts',
            modelsWithRain: 'Models with rain',
            maxGust: 'Max gust',
            maxWind: 'Max wind',
            avgDisagreement: 'Avg disagreement',
            snowLow: 'Min snow level',
            snowHigh: 'Max snow level'
        },
        sub: { models: 'models', at: 'at', of: 'of', rainThreshold: 'volume ≥ 0.2 mm', betweenModels: 'between models' },
        agreement: {
            high: 'High agreement',
            medium: 'Medium agreement',
            low: 'Low agreement',
            none: 'No comparison',
            hint: 'Agreement between the global models (ECMWF, GFS, ICON, AIFS)'
        },
        legend: {
            label: 'Chart models',
            principal: 'Main',
            band: 'Model band',
            identical: '= main',
            updated: 'Forecast as of {time}',
            now: 'NOW'
        },
        notes: {
            identical: '{names} = main model (same data, not drawn).',
            aifsNoProbability: 'AIFS does not publish rain probability: it only appears in the volumes.',
            gusts: 'Solid line: sustained wind. Dashed: gusts.'
        },
        snow: {
            above: 'No snow expected: the snow level is above {cap} m for the whole window.',
            noData: 'No model publishes the snow level for these hours.'
        },
        strip: {
            hint: 'Drag your finger across the chart to see the data for each hour.'
        }
    },
    fr: {
        rain: 'PLUIE',
        volume: 'VOLUME (MM)',
        globalModel: 'MODÈLE GLOBAL',
        gust: 'Rafale',
        figures: {
            high: 'Maximale',
            low: 'Minimale',
            maxDisagreement: 'Désaccord max.',
            total24h: 'Total 24 h',
            rainStart: 'Début de pluie',
            modelsWithRain: 'Modèles avec pluie',
            maxGust: 'Rafale max.',
            maxWind: 'Vent max.',
            avgDisagreement: 'Désaccord moyen',
            snowLow: 'Cote min.',
            snowHigh: 'Cote max.'
        },
        sub: { models: 'modèles', at: 'à', of: 'sur', rainThreshold: 'volume ≥ 0,2 mm', betweenModels: 'entre modèles' },
        agreement: {
            high: 'Accord élevé',
            medium: 'Accord moyen',
            low: 'Accord faible',
            none: 'Pas de comparaison',
            hint: 'Accord entre les modèles globaux (ECMWF, GFS, ICON, AIFS)'
        },
        legend: {
            label: 'Modèles des graphiques',
            principal: 'Principal',
            band: 'Bande de modèles',
            identical: '= principal',
            updated: 'Prévision de {time}',
            now: 'ACTU'
        },
        notes: {
            identical: '{names} = modèle principal (mêmes données, non tracé).',
            aifsNoProbability: 'AIFS ne publie pas de probabilité de pluie : il n\'apparaît que dans les volumes.',
            gusts: 'Trait plein : vent soutenu. Pointillés : rafales.'
        },
        snow: {
            above: 'Pas de neige prévue : la cote est au-dessus de {cap} m sur toute la fenêtre.',
            noData: 'Aucun modèle ne publie la cote de neige pour ces heures.'
        },
        strip: {
            hint: 'Faites glisser le doigt sur le graphique pour voir les données de chaque heure.'
        }
    }
};

export const getSmartForecastText = (lang: Language | undefined): SmartForecastText =>
    SMART_FORECAST_I18N[lang ?? 'ca'] ?? SMART_FORECAST_I18N.ca;
