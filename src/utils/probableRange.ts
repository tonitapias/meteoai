// src/utils/probableRange.ts
// RANG PROBABLE (80 %) de la màxima i la mínima d'un dia: entre quins valors estarà la temperatura real 8 de cada 10
// vegades. Es construeix amb els errors REALS de la xifra que mostra l'app (la sèrie combinada: model regional els primers
// dies i model global després) contra els METAR, segons el dia vista i l'acord entre models del dia.
//
// ABANS els gràfics i el detall de dia dibuixaven el "rang entre models" (el mínim i el màxim d'ECMWF, GFS, ICON i
// best_match). Aquell rang diu si els models coincideixen, però no és un marge d'error: només contenia la
// temperatura real el 48 % de les vegades a la màxima i el 47 % a la mínima (el 37 % al dia 7): feia semblar la previsió
// molt més segura del que és.
//
// CALIBRATGE (set. 2026): 30 aeroports europeus (Catalunya, Espanya, França, Itàlia, Suïssa, Àustria, Alemanya, Països
// Baixos, Regne Unit, Suècia), setembre 2025 – setembre 2026, 76.755 dies-estació per variable. Previsió d'1 a 7 dies
// vista de l'arxiu de passades anteriors d'Open-Meteo (temperature_2m_previous_dayN) de la sèrie que mostra l'app (model
// regional on n'hi ha, best_match on no) i dels 4 models que compara la fiabilitat (best_match, ECMWF, GFS, ICON), contra
// la màxima i la mínima horàries dels METAR. Per a cada dia vista i cada classe d'acord entre models (els llindars de la
// fiabilitat: desacord de fins a 1,5, de 1,5 a 3 i de més de 3 vegades el típic), els percentils 10 i 90 de l'error.
//   - Validació creuada per estació (cada aeroport amb la taula feta amb els altres 29): el rang conté la real el 80,1 %
//     de les vegades a la màxima i el 79,8 % a la mínima (per estació, del 68 % al 91 %, mediana 80 %).
//   - L'acord entre models li dona l'amplada que toca: màxima 4,1 / 6,2 / 10,0 °C de mitjana amb models d'acord /
//     desacord moderat / fort; mínima 5,0 / 6,5 / 8,6 °C. El rang creix amb el dia vista (màxima 3,4 °C al dia 1, 7,1 al 7).
//   - Contra el rang entre models, la puntuació d'interval (amplada + penalització per quedar-ne fora) millora tots els
//     dies menys la màxima del dia 1, on empaten; i contra calibrar només pel dia vista, millora una mica a gairebé tots.
//   - L'error no és simètric (p. ex. la mínima real acostuma a ser una mica més baixa que la mostrada), i el rang tampoc.
//   - Les caselles de desacord fort dels primers dies tenen poques dades (186–482 casos): s'hi imposa que un desacord més
//     gran no doni mai un rang més estret (5 caselles tocades; cobertura 80,2 / 80,4 %, +0,02 °C d'amplada).
//
// LÍMITS: aeroports (terreny obert i pla); en relleu complex l'error real pot ser més gran. Sense la correcció d'inversió
// (l'arxiu no guarda núvols ni vent de passades velles). Per a avui es fa servir el dia 1 (lleugerament conservador).
import { TEMP_LOW_FACTOR, TEMP_MEDIUM_FACTOR, TYPICAL_TEMP_SPREAD } from './rules/reliabilityRules';

export type TempKind = 'max' | 'min';

export interface ProbableRange {
    low: number;
    high: number;
}

/** Percentils 10 i 90 de l'error (observat − mostrat, °C). */
type Quantiles = readonly [p10: number, p90: number];

interface LeadQuantiles {
    /** Sense acord entre models conegut (menys de dos models amb dada). */
    all: Quantiles;
    /** Per acord entre models: models d'acord / desacord moderat / desacord fort (llindars de reliabilityRules). */
    byAgreement: readonly [Quantiles, Quantiles, Quantiles];
}

// Índex 0 = dia 1 ... índex 6 = dia 7.
const ERROR_QUANTILES: Record<TempKind, readonly LeadQuantiles[]> = {
    max: [
        { all: [-1.9, 1.5], byAgreement: [[-1.7, 1.5], [-2.9, 1.5], [-2.9, 2.3]] }, // dia 1
        { all: [-1.4, 2.0], byAgreement: [[-1.3, 1.9], [-2.2, 2.6], [-2.2, 3.2]] }, // dia 2
        { all: [-1.7, 2.2], byAgreement: [[-1.4, 2.0], [-2.4, 2.8], [-3.9, 3.5]] }, // dia 3
        { all: [-1.8, 2.7], byAgreement: [[-1.6, 2.3], [-2.2, 3.3], [-2.7, 5.7]] }, // dia 4
        { all: [-2.2, 3.3], byAgreement: [[-1.7, 2.7], [-2.7, 3.8], [-4.6, 6.4]] }, // dia 5
        { all: [-2.7, 3.7], byAgreement: [[-2.0, 3.1], [-3.0, 4.1], [-5.0, 6.1]] }, // dia 6
        { all: [-3.0, 4.1], byAgreement: [[-2.6, 3.7], [-3.2, 4.6], [-4.1, 6.8]] }, // dia 7
    ],
    min: [
        { all: [-2.8, 1.7], byAgreement: [[-2.3, 1.8], [-3.7, 1.8], [-4.4, 1.8]] }, // dia 1
        { all: [-2.8, 1.6], byAgreement: [[-2.5, 1.5], [-3.6, 1.8], [-3.9, 1.8]] }, // dia 2
        { all: [-3.0, 1.7], byAgreement: [[-2.7, 1.6], [-3.5, 1.9], [-4.3, 2.3]] }, // dia 3
        { all: [-3.0, 2.1], byAgreement: [[-2.9, 1.9], [-3.3, 2.5], [-3.3, 2.6]] }, // dia 4
        { all: [-3.5, 2.6], byAgreement: [[-3.1, 2.3], [-4.1, 3.0], [-4.8, 4.6]] }, // dia 5
        { all: [-3.9, 2.9], byAgreement: [[-3.4, 2.4], [-4.3, 3.4], [-5.4, 5.3]] }, // dia 6
        { all: [-4.1, 3.3], byAgreement: [[-3.8, 2.9], [-4.4, 3.8], [-6.2, 5.9]] }, // dia 7
    ]
};

const agreementClass = (kind: TempKind, modelSpread: number): 0 | 1 | 2 => {
    const z = modelSpread / TYPICAL_TEMP_SPREAD[kind];
    return z > TEMP_LOW_FACTOR ? 2 : z > TEMP_MEDIUM_FACTOR ? 1 : 0;
};

/**
 * Rang probable (80 %) d'una màxima o mínima MOSTRADA.
 * `dayIndex`: 0 = avui ... 7 (avui fa servir el dia 1; més enllà del 7, el 7).
 * `modelSpread`: màxim − mínim dels models globals aquell dia (°C), o null si no n'hi ha almenys dos.
 * Sense xifra mostrada, null: no hi ha res a envoltar.
 */
export const resolveProbableRange = (
    kind: TempKind,
    displayed: number | null,
    dayIndex: number,
    modelSpread: number | null
): ProbableRange | null => {
    if (displayed === null || isNaN(displayed)) return null;
    const table = ERROR_QUANTILES[kind];
    const lead = Math.min(table.length, Math.max(1, Math.round(dayIndex)));
    const row = table[lead - 1];
    const [p10, p90] = modelSpread === null || isNaN(modelSpread) ? row.all : row.byAgreement[agreementClass(kind, modelSpread)];
    return { low: displayed + p10, high: displayed + p90 };
};
