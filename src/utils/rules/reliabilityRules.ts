// src/utils/rules/reliabilityRules.ts
import { StrictDailyWeather, ReliabilityResult } from '../../types/weatherLogicTypes';
import { extractValidNum } from '../weatherMath';

// Constants locals de fiabilitat 
const RELIABILITY_THRESHOLDS = {
    TEMP_HIGH_DIFF: 5,   
    PRECIP_HIGH_DIFF: 10, 
    TEMP_MED_DIFF: 2,    
    PRECIP_MED_DIFF: 3   
};

/**
 * Calcula la fiabilitat de la predicció comparant 3 models.
 */
export const calculateReliability = (
    dailyBest: StrictDailyWeather | undefined | null, 
    dailyGFS: Partial<StrictDailyWeather> | Record<string, unknown> | undefined | null, 
    dailyICON: Partial<StrictDailyWeather> | Record<string, unknown> | undefined | null, 
    dayIndex: number = 0
): ReliabilityResult => {
  // 1. Si falta algun model, la fiabilitat és "mitjana" per defecte.
  if (!dailyGFS || !dailyICON || !dailyBest) {
      return { level: 'medium', type: 'general', value: 0 }; 
  }
  
  // 2. Com que ja hem validat que existeixen, podem tractar-los de forma segura com a StrictDailyWeather per accedir a les matrius
  const gfs = dailyGFS as StrictDailyWeather;
  const icon = dailyICON as StrictDailyWeather;
  
  // DOCTRINA RISC ZERO: un camp absent en un dels 3 models NO és un 0ºC/0mm
  // real — abans safeNum el convertia en 0, i comparar-lo amb un model que sí
  // tenia dades reals (p.ex. 25ºC) disparava un "diffTemp" de 25 graus fals,
  // marcant "baixa fiabilitat" per una dada que simplement no hi era.
  const tempBest = extractValidNum(dailyBest.temperature_2m_max?.[dayIndex]);
  const tempGFS = extractValidNum(gfs.temperature_2m_max?.[dayIndex]);
  const tempICON = extractValidNum(icon.temperature_2m_max?.[dayIndex]);

  const temps = [tempBest, tempGFS, tempICON].filter((t): t is number => t !== null);
  // Amb només 1 valor real, max-min sempre dona 0 — semblaria "acord perfecte"
  // sense haver comparat res de debò. Calen almenys 2 models amb dada.
  const diffTemp = temps.length >= 2 ? Math.max(...temps) - Math.min(...temps) : null;

  const precipBest = extractValidNum(dailyBest.precipitation_sum?.[dayIndex]);
  const precipGFS = extractValidNum(gfs.precipitation_sum?.[dayIndex]);
  const precipICON = extractValidNum(icon.precipitation_sum?.[dayIndex]);

  const precips = [precipBest, precipGFS, precipICON].filter((p): p is number => p !== null);
  const diffPrecip = precips.length >= 2 ? Math.max(...precips) - Math.min(...precips) : null;

  // Ni temperatura ni pluja es poden comparar: no sabem si els models
  // coincideixen o no, així que ho tractem igual que quan falta un model
  // sencer (línia 23) — fiabilitat "mitjana" per defecte, mai "alta" fingida.
  if (diffTemp === null && diffPrecip === null) {
      return { level: 'medium', type: 'general', value: 0 };
  }

  if (diffTemp !== null && diffTemp > RELIABILITY_THRESHOLDS.TEMP_HIGH_DIFF) {
      return { level: 'low', type: 'temp', value: Number(diffTemp.toFixed(1)) };
  }
  if (diffPrecip !== null && diffPrecip > RELIABILITY_THRESHOLDS.PRECIP_HIGH_DIFF) {
      return { level: 'low', type: 'precip', value: Number(diffPrecip.toFixed(1)) };
  }

  if ((diffTemp !== null && diffTemp > RELIABILITY_THRESHOLDS.TEMP_MED_DIFF) || (diffPrecip !== null && diffPrecip > RELIABILITY_THRESHOLDS.PRECIP_MED_DIFF)) {
      return { level: 'medium', type: 'divergent', value: 0 };
  }

  return { level: 'high', type: 'ok', value: 0 };
};