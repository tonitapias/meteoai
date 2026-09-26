// src/utils/forecastConfidenceText.ts
// Text de l'acord entre models d'un dia de la previsió (nivell de fiabilitat, rang entre models i origen
// global). El comparteixen el gràfic de tendència (TrendChartModal) i el detall de dia (DayDetailModal):
// una mateixa idea no pot dir-se de dues maneres segons la pantalla.
import type { Language } from '../translations';
import type { DailyModelSpread } from './dailyModelSpread';

export type ReliabilityLevel = NonNullable<DailyModelSpread['reliability']>;

export interface ConfidenceText {
    reliability: Record<ReliabilityLevel, string>;
    rangeLegend: string;
    /** Rang probable (80 %) calibrat contra observacions (vegeu probableRange.ts): el que dibuixen gràfic i detall. */
    probableRange: string;
    globalModel: string;
}

export const CONFIDENCE_TEXT: Record<Language, ConfidenceText> = {
    ca: {
        reliability: { high: 'Fiabilitat alta', medium: 'Fiabilitat mitjana', low: 'Fiabilitat baixa' },
        rangeLegend: 'Rang entre models',
        probableRange: 'Rang probable (80 %)',
        globalModel: 'Model global'
    },
    es: {
        reliability: { high: 'Fiabilidad alta', medium: 'Fiabilidad media', low: 'Fiabilidad baja' },
        rangeLegend: 'Rango entre modelos',
        probableRange: 'Rango probable (80 %)',
        globalModel: 'Modelo global'
    },
    fr: {
        reliability: { high: 'Fiabilité élevée', medium: 'Fiabilité moyenne', low: 'Fiabilité faible' },
        rangeLegend: 'Écart entre modèles',
        probableRange: 'Plage probable (80 %)',
        globalModel: 'Modèle global'
    },
    en: {
        reliability: { high: 'High reliability', medium: 'Medium reliability', low: 'Low reliability' },
        rangeLegend: 'Model range',
        probableRange: 'Likely range (80%)',
        globalModel: 'Global model'
    }
};
