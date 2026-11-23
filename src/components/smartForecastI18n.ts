// src/components/smartForecastI18n.ts
// Textos dels gràfics horaris de Previsió (SmartForecastCharts): pestanyes, lectura, xip d'acord, xifres clau,
// llegenda i notes. Mateix patró que TrendChartModal/ConsensusChartsModal: diccionari propi per idioma, sense
// dependre de les claus globals de translations/ perquè aquest chunk es carrega lazy.
import type { Language } from '../translations';

export interface SmartForecastText {
    /** Rètol del bloc: les hores que dibuixen els gràfics. */
    window: string;
    /** Pestanyes, curtes perquè les quatre càpiguen en una pantalla de 320 px. */
    tabs: { temp: string; rain: string; wind: string; snow: string };
    /** Rètol del gràfic de volum (mm/h). */
    volume: string;
    /** El mateix rètol quan hi ha neu: el volum continua sent d'aigua (la neu, en cm, va a la lectura i al total). */
    volumeWater: string;
    /** Nom de la línia principal quan no ve d'un model regional. */
    globalModel: string;
    /** Nom de la ratxa de vent a la lectura. */
    gust: string;
    figures: {
        high: string;
        low: string;
        maxDisagreement: string;
        total24h: string;
        rainStart: string;
        /** "Inici de neu": quan el que cau a la finestra és sobretot neu (precipKind). */
        snowStart: string;
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
        /** "models 0,0–0,4 mm d'aigua": els models donen aigua, no neu. */
        water: string;
        betweenModels: string;
    };
    agreement: {
        high: string;
        medium: string;
        low: string;
        none: string;
        /** Explicació completa (títol del xip). */
        hint: string;
    };
    /** Una frase sota el xip d'acord: de què surt. `{value}`, `{hour}`, `{n}`, `{m}`. */
    explain: {
        temp: string;
        rain: string;
        spread: string;
    };
    legend: {
        /** Etiqueta del grup de botons dels models (lector de pantalla). */
        label: string;
        /** Capçalera del bloc: "AROME HD · de les 14:05". `{model}`, `{time}` (HH:MM, del lloc). */
        source: string;
        /** "4 models globals". `{n}`. */
        globals: string;
        /** Fons gris entre el model més alt i el més baix. */
        margin: string;
        /** Botó que desplega els models per amagar-ne o mostrar-ne. */
        models: string;
        band: string;
        /** Al costat d'un model que no es dibuixa perquè és idèntic a la principal: "ICON = principal". */
        identical: string;
        /** Etiqueta de l'eix X sota la marca de l'hora actual i de la lectura en repòs. */
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
        /** Text de la lectura quan encara no hi ha cap hora per mostrar. */
        hint: string;
    };
}

export const SMART_FORECAST_I18N: Record<Language, SmartForecastText> = {
    ca: {
        window: 'Pròximes 24 h',
        tabs: { temp: 'Temp', rain: 'Pluja', wind: 'Vent', snow: 'Neu' },
        volume: 'VOLUM (MM)',
        volumeWater: "VOLUM (MM D'AIGUA)",
        globalModel: 'MODEL GLOBAL',
        gust: 'Ratxa',
        figures: {
            high: 'Màxima',
            low: 'Mínima',
            maxDisagreement: 'Desacord màx.',
            total24h: 'Total 24 h',
            rainStart: 'Inici de pluja',
            snowStart: 'Inici de neu',
            modelsWithRain: 'Models amb pluja',
            maxGust: 'Ratxa màx.',
            maxWind: 'Vent màx.',
            avgDisagreement: 'Desacord mitjà',
            snowLow: 'Cota mínima',
            snowHigh: 'Cota màxima'
        },
        sub: { models: 'models', at: 'a les', of: 'de', rainThreshold: 'volum ≥ 0,2 mm', water: "d'aigua", betweenModels: 'entre models' },
        agreement: {
            high: 'Acord alt',
            medium: 'Acord mitjà',
            low: 'Acord baix',
            none: 'Sense comparació',
            hint: 'Acord entre els models globals (ECMWF, GFS, ICON, AIFS)'
        },
        explain: {
            temp: 'fins a {value} de diferència a les {hour}',
            rain: '{n} de {m} models en donen',
            spread: '{value} de diferència mitjana'
        },
        legend: {
            label: 'Models dels gràfics',
            source: '{model} · de les {time}',
            globals: '{n} models globals',
            margin: 'marge entre models',
            models: 'Models',
            band: 'Marge entre models',
            identical: '= principal',
            now: 'ARA'
        },
        notes: {
            identical: '{names} = model principal (mateixes dades, no es dibuixa).',
            aifsNoProbability: 'AIFS no publica probabilitat de pluja: només surt als volums.',
            gusts: 'Línia contínua: vent sostingut. Discontínua: ratxes.'
        },
        snow: {
            above: 'Sense neu prevista: la cota és per sobre de {cap} m durant tota la finestra.',
            noData: 'Cap model publica la cota de neu per a aquestes hores.'
        },
        strip: {
            hint: 'Toca el gràfic o passa-hi per sobre per veure cada hora.'
        }
    },
    es: {
        window: 'Próximas 24 h',
        tabs: { temp: 'Temp', rain: 'Lluvia', wind: 'Viento', snow: 'Nieve' },
        volume: 'VOLUMEN (MM)',
        volumeWater: 'VOLUMEN (MM DE AGUA)',
        globalModel: 'MODELO GLOBAL',
        gust: 'Racha',
        figures: {
            high: 'Máxima',
            low: 'Mínima',
            maxDisagreement: 'Desacuerdo máx.',
            total24h: 'Total 24 h',
            rainStart: 'Inicio de lluvia',
            snowStart: 'Inicio de nieve',
            modelsWithRain: 'Modelos con lluvia',
            maxGust: 'Racha máx.',
            maxWind: 'Viento máx.',
            avgDisagreement: 'Desacuerdo medio',
            snowLow: 'Cota mínima',
            snowHigh: 'Cota máxima'
        },
        sub: { models: 'modelos', at: 'a las', of: 'de', rainThreshold: 'volumen ≥ 0,2 mm', water: 'de agua', betweenModels: 'entre modelos' },
        agreement: {
            high: 'Acuerdo alto',
            medium: 'Acuerdo medio',
            low: 'Acuerdo bajo',
            none: 'Sin comparación',
            hint: 'Acuerdo entre los modelos globales (ECMWF, GFS, ICON, AIFS)'
        },
        explain: {
            temp: 'hasta {value} de diferencia a las {hour}',
            rain: '{n} de {m} modelos dan lluvia',
            spread: '{value} de diferencia media'
        },
        legend: {
            label: 'Modelos de los gráficos',
            source: '{model} · de las {time}',
            globals: '{n} modelos globales',
            margin: 'margen entre modelos',
            models: 'Modelos',
            band: 'Margen entre modelos',
            identical: '= principal',
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
            hint: 'Toca el gráfico o pasa por encima para ver cada hora.'
        }
    },
    en: {
        window: 'Next 24 h',
        tabs: { temp: 'Temp', rain: 'Rain', wind: 'Wind', snow: 'Snow' },
        volume: 'VOLUME (MM)',
        volumeWater: 'VOLUME (MM OF WATER)',
        globalModel: 'GLOBAL MODEL',
        gust: 'Gust',
        figures: {
            high: 'High',
            low: 'Low',
            maxDisagreement: 'Max disagreement',
            total24h: '24 h total',
            rainStart: 'Rain starts',
            snowStart: 'Snow starts',
            modelsWithRain: 'Models with rain',
            maxGust: 'Max gust',
            maxWind: 'Max wind',
            avgDisagreement: 'Avg disagreement',
            snowLow: 'Min snow level',
            snowHigh: 'Max snow level'
        },
        sub: { models: 'models', at: 'at', of: 'of', rainThreshold: 'volume ≥ 0.2 mm', water: 'of water', betweenModels: 'between models' },
        agreement: {
            high: 'High agreement',
            medium: 'Medium agreement',
            low: 'Low agreement',
            none: 'No comparison',
            hint: 'Agreement between the global models (ECMWF, GFS, ICON, AIFS)'
        },
        explain: {
            temp: 'up to {value} apart at {hour}',
            rain: '{n} of {m} models show rain',
            spread: '{value} average difference'
        },
        legend: {
            label: 'Chart models',
            source: '{model} · as of {time}',
            globals: '{n} global models',
            margin: 'spread between models',
            models: 'Models',
            band: 'Spread between models',
            identical: '= main',
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
            hint: 'Tap or hover over the chart to see each hour.'
        }
    },
    fr: {
        window: '24 prochaines heures',
        tabs: { temp: 'Temp', rain: 'Pluie', wind: 'Vent', snow: 'Neige' },
        volume: 'VOLUME (MM)',
        volumeWater: "VOLUME (MM D'EAU)",
        globalModel: 'MODÈLE GLOBAL',
        gust: 'Rafale',
        figures: {
            high: 'Maximale',
            low: 'Minimale',
            maxDisagreement: 'Désaccord max.',
            total24h: 'Total 24 h',
            rainStart: 'Début de pluie',
            snowStart: 'Début de neige',
            modelsWithRain: 'Modèles avec pluie',
            maxGust: 'Rafale max.',
            maxWind: 'Vent max.',
            avgDisagreement: 'Désaccord moyen',
            snowLow: 'Cote min.',
            snowHigh: 'Cote max.'
        },
        sub: { models: 'modèles', at: 'à', of: 'sur', rainThreshold: 'volume ≥ 0,2 mm', water: "d'eau", betweenModels: 'entre modèles' },
        agreement: {
            high: 'Accord élevé',
            medium: 'Accord moyen',
            low: 'Accord faible',
            none: 'Pas de comparaison',
            hint: 'Accord entre les modèles globaux (ECMWF, GFS, ICON, AIFS)'
        },
        explain: {
            temp: "jusqu'à {value} d'écart à {hour}",
            rain: '{n} modèles sur {m} en prévoient',
            spread: "{value} d'écart moyen"
        },
        legend: {
            label: 'Modèles des graphiques',
            source: '{model} · de {time}',
            globals: '{n} modèles globaux',
            margin: 'écart entre modèles',
            models: 'Modèles',
            band: 'Écart entre modèles',
            identical: '= principal',
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
            hint: 'Touchez le graphique ou survolez-le pour voir chaque heure.'
        }
    }
};

export const getSmartForecastText = (lang: Language | undefined): SmartForecastText =>
    SMART_FORECAST_I18N[lang ?? 'ca'] ?? SMART_FORECAST_I18N.ca;
