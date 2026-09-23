// src/utils/rainEvidence.ts
// Com es combina la probabilitat de pluja de l'ensemble global amb l'evidència d'un model determinista: el model
// regional (injectHighResModels) o la sèrie principal quan no és ICON (injectBaseRainEvidence).
//
// LA PROBABILITAT GLOBAL (Open-Meteo `precipitation_probability`) surt d'un ensemble: és la fracció de membres que
// donen >= 0,1 mm en aquella hora. El model regional (AROME HD, ICON-D2...) és UNA sola previsió: dona quantitats,
// no probabilitats, i en un punt concret té errors de posició i de fase (una pluja prevista a les 15 h que arriba
// a les 16 h, o 3 km més enllà). No es pot llegir "el model regional preveu pluja" com "plourà al 70 %".
//
// ABANS: una hora amb >= 0,1 mm regionals i probabilitat global < 50 % passava directament a 70 %.
//
// CALIBRATGE (sept. 2026): 306.879 hores de 16 aeroports dins la zona AROME HD (França i nord d'Espanya), juliol 2024 –
// setembre 2026, previsió d'AROME emesa el dia abans (API "previous runs" d'Open-Meteo) contra la pluja realment
// observada als METAR (fenomen de precipitació a la finestra de l'hora acumulada). Resultats:
//   - Les hores on la regla antiga reforçava (4,3 % del total): PoP global mitjana 16,4 %, pluja observada 25,0 %,
//     regla antiga 70 %. Va empitjorar el Brier de la PoP global un 16,3 % i no va millorar cap de les 16 estacions.
//   - Quan AROME preveu >= 0,1 mm dins de ±1 h, la pluja observada és del 10 % si la PoP global és quasi 0, del 21 % si
//     és del 11 % i del 34 % si és del 34 %; a partir d'aquí la freqüència observada ja és igual o inferior a la PoP
//     (50-80 %: PoP 64 %, observada 50 % amb AROME humit) i no s'hi afegeix res.
//   - La quantitat prevista quasi no hi compta: 0,1 mm i 3 mm donen freqüències observades semblants (20 % → 33 %).
//   - Validació creuada per estació (cada aeroport es prediu amb el que s'ha après als altres 15): el Brier millora un
//     1,0 % respecte de la PoP global sola a 14 de les 16 estacions, i el poder discriminant (AUC) puja de 0,913 a 0,923.
//     A les hores que es modifiquen la PoP mitjana passa del 9,6 % al 17,9 % i la pluja observada és del 18,2 %.
//
// LÍMITS: la "pluja observada" és la d'un METAR a :00/:30, que perd els ruixats curts, així que les freqüències
// absolutes són un límit inferior; per això NOMÉS es puja (mai s'abaixa cap probabilitat) i no es recalibra la PoP global.
// El calibratge és a 24 h de termini; a termini més curt l'evidència és més forta (i aquí queda conservadora).
//
// SÈRIE PRINCIPAL (set. 2026, arran de Roses: "0 %" amb 0,3 mm i icones de tempesta). La probabilitat d'Open-Meteo és
// sempre la de l'ensemble d'ICON (igual a la d'icon_seamless el 100 % de les hores), però la pluja de les hores sense
// model regional és la del best_match, que segons el punt és ICON (Girona, Barcelona, Madrid, París...) o un altre
// model (Météo-France els primers dies i ECMWF 9 km després: Roses, Perpinyà, Marsella, Bordeus, Bilbao). Mesurat amb
// 26 aeroports, set. 2024 – set. 2026, 469.000 hores, pluja del best_match a 1-5 dies vista (API "previous runs") i la
// PoP arxivada de termini curt (l'única que es guarda, com al calibratge anterior), contra pluja observada als METAR:
//   - On la sèrie és ICON, aquesta corba EMPITJORA el Brier als dies 2-5 (+0,1 a +1,2 %, a 3-6 de 22 estacions
//     millora): la seva pluja ja és dins de la probabilitat del seu propi ensemble i es comptaria dues vegades.
//   - On NO és ICON, el millora als dies 1-3 (-1,8 %, -0,7 %, -0,6 %; amb PoP ~0 i pluja al model, observada 12 % al
//     dia 1 contra el 10 % de la corba). Als dies 4-5 la mesura, esbiaixada en contra (la PoP de termini curt ja "sap"
//     si plourà), dona +0,3/+0,5 %; amb ICON determinista sec al mateix termini com a indicador de PoP baixa, la pluja
//     observada és del 14,5-18 %. La corba (10 % amb PoP 0) queda entre les dues cotes i s'aplica a tots els terminis.

/** Llindar de pluja mesurable (mm/h): el mateix que defineix la probabilitat global d'Open-Meteo. */
export const MEASURABLE_RAIN_MM = 0.1;

/**
 * [PoP global (0-1), freqüència observada de pluja] quan el model regional preveu >= 0,1 mm dins de ±1 h.
 * Punts d'interpolació lineal; per sota del primer i per sobre de l'últim es manté el valor de l'extrem.
 */
const OBSERVED_RAIN_FREQUENCY: ReadonlyArray<readonly [pop: number, observed: number]> = [
    [0.008, 0.104],
    [0.106, 0.206],
    [0.335, 0.335]
];

const observedRainFrequency = (pop: number): number => {
    const first = OBSERVED_RAIN_FREQUENCY[0];
    const last = OBSERVED_RAIN_FREQUENCY[OBSERVED_RAIN_FREQUENCY.length - 1];
    if (pop <= first[0]) return first[1];
    if (pop >= last[0]) return last[1];
    for (let i = 1; i < OBSERVED_RAIN_FREQUENCY.length; i++) {
        const [x1, y1] = OBSERVED_RAIN_FREQUENCY[i];
        if (pop <= x1) {
            const [x0, y0] = OBSERVED_RAIN_FREQUENCY[i - 1];
            return y0 + ((pop - x0) / (x1 - x0)) * (y1 - y0);
        }
    }
    return last[1];
};

/**
 * Probabilitat de pluja (%) d'una hora un cop tinguda en compte l'evidència d'un model determinista (regional, o la
 * sèrie principal quan no és ICON).
 *
 * `globalPercent`: probabilitat global de l'hora (0-100). `modelMm`: la pluja màxima que el model preveu dins de ±1 h
 * d'aquesta hora (mm), o null si no n'hi ha dada. Sense evidència (< 0,1 mm o cap dada) torna la global tal qual.
 * Mai no la baixa: si la global ja és igual o més alta que la freqüència observada, no es toca.
 */
export const rainProbabilityWithModelEvidence = (globalPercent: number, modelMm: number | null): number => {
    if (typeof globalPercent !== 'number' || isNaN(globalPercent)) return globalPercent;
    if (typeof modelMm !== 'number' || isNaN(modelMm) || modelMm < MEASURABLE_RAIN_MM) return globalPercent;

    const pop = Math.min(1, Math.max(0, globalPercent / 100));
    return Math.max(globalPercent, Math.round(100 * observedRainFrequency(pop)));
};
