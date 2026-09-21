// src/utils/rules/reliabilityRules.ts
import { StrictDailyWeather, ReliabilityResult } from '../../types/weatherLogicTypes';
import { extractValidNum } from '../weatherMath';

// Llindars de pluja (mm de diferència entre models).
const PRECIP_HIGH_DIFF = 10;
const PRECIP_MED_DIFF = 3;

// TEMPERATURA. L'acord entre models es jutja sobre la màxima I la mínima, cadascuna respecte del seu rang típic.
//
// Abans només comptava el rang de la màxima (> 2 °C mitjana, > 5 °C baixa), així que un dia amb els models d'acord
// sobre la màxima i molt en desacord sobre la mínima sortia "fiabilitat alta". Mesurat amb 95.610 casos (24 aeroports
// europeus, juliol 2024 – setembre 2026, previsions d'1 a 7 dies de best_match, ECMWF, GFS i ICON contra la
// temperatura observada als METAR):
//   - El rang de la màxima no prediu l'error de la mínima (AUC 0,54 per anticipar un error > 3 °C a la mínima;
//     0,5 és atzar). El pitjor dels dos rangs ho fa a les dues i puja l'AUC global de 0,626 a 0,662 a tots els terminis.
//   - Els dos rangs tenen escales semblants però no iguals (mediana 1,9 °C la màxima i 2,1 °C la mínima), així que es
//     normalitzen pel seu valor típic: mitjana a partir d'1,5 vegades el típic i baixa a partir de 3 vegades. Amb això
//     el repartiment de nivells no canvia (53,5 / 40,0 / 6,6 % de dies, abans 54,0 / 39,5 / 6,5 %) però el nivell ja
//     separa l'error de la mínima (risc d'error > 3 °C a la mínima: 8 / 15 / 25 %, abans 11 / 13 / 19 %) i ho fa millor
//     a les 24 estacions. La màxima perd una mica de separació (risc 7 / 16 / 33 %, abans 7 / 16 / 40 %).
//   - Normalitzar per termini no millora res (AUC 0,640 contra 0,662): es fa servir un valor típic constant.
// El rang mesura ACORD entre models, no exactitud: l'error creix amb el termini (|error| 1,0 °C a 1 dia, 2,3 °C a 7)
// mentre el rang gairebé no es mou.
const TYPICAL_TEMP_SPREAD = { max: 1.9, min: 2.1 } as const;
const TEMP_MEDIUM_FACTOR = 1.5;
const TEMP_LOW_FACTOR = 3;

/** Rang (màx − mín) dels valors que hi són. Amb menys de 2 valors reals no hi ha comparació: null, mai un 0 fals. */
const spreadOf = (values: Array<number | null>): number | null => {
  const present = values.filter((v): v is number => v !== null);
  return present.length >= 2 ? Math.max(...present) - Math.min(...present) : null;
};

/**
 * Calcula la fiabilitat de la predicció comparant els models globals disponibles
 * (best_match, GFS, ICON i, quan hi és, ECMWF — generalment el més fiable
 * d'Europa Occidental).
 */
export const calculateReliability = (
    dailyBest: StrictDailyWeather | undefined | null,
    dailyGFS: Partial<StrictDailyWeather> | Record<string, unknown> | undefined | null,
    dailyICON: Partial<StrictDailyWeather> | Record<string, unknown> | undefined | null,
    dayIndex: number = 0,
    // [FIX PRECISIÓ] ECMWF ja es baixava (normData.ts el desa a dailyComparison.ecmwf)
    // però mai s'incloïa aquí — la comparació de "3 models" en realitat només
    // enfrontava best_match/GFS/ICON i excloïa el model generalment més fiable
    // d'Europa Occidental. Opcional (per defecte null) per no fer-lo obligatori:
    // si falta, el comportament és idèntic al d'abans (3 models).
    dailyECMWF: Partial<StrictDailyWeather> | Record<string, unknown> | undefined | null = null
): ReliabilityResult => {
  // 1. Si falta algun model, la fiabilitat és "mitjana" per defecte.
  if (!dailyGFS || !dailyICON || !dailyBest) {
      return { level: 'medium', type: 'general', value: 0 };
  }

  // 2. Com que ja hem validat que existeixen, podem tractar-los de forma segura com a StrictDailyWeather per accedir a les matrius
  const gfs = dailyGFS as StrictDailyWeather;
  const icon = dailyICON as StrictDailyWeather;
  const ecmwf = dailyECMWF as StrictDailyWeather | null;

  // DOCTRINA RISC ZERO: un camp absent en un dels models NO és un 0ºC/0mm
  // real — abans safeNum el convertia en 0, i comparar-lo amb un model que sí
  // tenia dades reals (p.ex. 25ºC) disparava un "diffTemp" de 25 graus fals,
  // marcant "baixa fiabilitat" per una dada que simplement no hi era.
  // Amb només 1 valor real, max-min sempre dona 0 — semblaria "acord perfecte"
  // sense haver comparat res de debò. Calen almenys 2 models amb dada.
  const tempSpread = (key: 'temperature_2m_max' | 'temperature_2m_min'): number | null =>
    spreadOf([
      extractValidNum(dailyBest[key]?.[dayIndex]),
      extractValidNum(gfs[key]?.[dayIndex]),
      extractValidNum(icon[key]?.[dayIndex]),
      ecmwf ? extractValidNum(ecmwf[key]?.[dayIndex]) : null
    ]);

  const diffMax = tempSpread('temperature_2m_max');
  const diffMin = tempSpread('temperature_2m_min');

  // El pitjor dels dos acords, cadascun respecte del seu rang típic.
  const candidates = [
    { diff: diffMax, z: diffMax === null ? null : diffMax / TYPICAL_TEMP_SPREAD.max },
    { diff: diffMin, z: diffMin === null ? null : diffMin / TYPICAL_TEMP_SPREAD.min }
  ].filter((c): c is { diff: number; z: number } => c.diff !== null && c.z !== null);
  const worstTemp = candidates.length > 0 ? candidates.reduce((a, b) => (b.z > a.z ? b : a)) : null;

  const precips = [
    extractValidNum(dailyBest.precipitation_sum?.[dayIndex]),
    extractValidNum(gfs.precipitation_sum?.[dayIndex]),
    extractValidNum(icon.precipitation_sum?.[dayIndex]),
    ecmwf ? extractValidNum(ecmwf.precipitation_sum?.[dayIndex]) : null
  ];
  const diffPrecip = spreadOf(precips);

  // Ni temperatura ni pluja es poden comparar: no sabem si els models
  // coincideixen o no, així que ho tractem igual que quan falta un model
  // sencer (línia 23) — fiabilitat "mitjana" per defecte, mai "alta" fingida.
  if (worstTemp === null && diffPrecip === null) {
      return { level: 'medium', type: 'general', value: 0 };
  }

  if (worstTemp !== null && worstTemp.z > TEMP_LOW_FACTOR) {
      return { level: 'low', type: 'temp', value: Number(worstTemp.diff.toFixed(1)) };
  }
  if (diffPrecip !== null && diffPrecip > PRECIP_HIGH_DIFF) {
      return { level: 'low', type: 'precip', value: Number(diffPrecip.toFixed(1)) };
  }

  if ((worstTemp !== null && worstTemp.z > TEMP_MEDIUM_FACTOR) || (diffPrecip !== null && diffPrecip > PRECIP_MED_DIFF)) {
      return { level: 'medium', type: 'divergent', value: 0 };
  }

  return { level: 'high', type: 'ok', value: 0 };
};
