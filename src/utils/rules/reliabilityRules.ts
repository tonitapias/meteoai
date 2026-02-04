// src/utils/rules/reliabilityRules.ts
import { StrictDailyWeather, ReliabilityResult } from '../../types/weatherLogicTypes';
import { safeNum } from '../physics';

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
    dailyBest: StrictDailyWeather, 
    dailyGFS: StrictDailyWeather, 
    dailyICON: StrictDailyWeather, 
    dayIndex: number = 0
): ReliabilityResult => {
  if (!dailyGFS || !dailyICON || !dailyBest) {
      return { level: 'medium', type: 'general', value: 0 }; 
  }
  
  const tempBest = safeNum(dailyBest.temperature_2m_max?.[dayIndex]);
  const tempGFS = safeNum(dailyGFS.temperature_2m_max?.[dayIndex]);
  const tempICON = safeNum(dailyICON.temperature_2m_max?.[dayIndex]);
  
  const temps = [tempBest, tempGFS, tempICON];
  const diffTemp = Math.max(...temps) - Math.min(...temps);
  
  const precipBest = safeNum(dailyBest.precipitation_sum?.[dayIndex]);
  const precipGFS = safeNum(dailyGFS.precipitation_sum?.[dayIndex]);
  const precipICON = safeNum(dailyICON.precipitation_sum?.[dayIndex]);
  
  const precips = [precipBest, precipGFS, precipICON];
  const diffPrecip = Math.max(...precips) - Math.min(...precips);

  if (diffTemp > RELIABILITY_THRESHOLDS.TEMP_HIGH_DIFF) {
      return { level: 'low', type: 'temp', value: Number(diffTemp.toFixed(1)) };
  }
  if (diffPrecip > RELIABILITY_THRESHOLDS.PRECIP_HIGH_DIFF) {
      return { level: 'low', type: 'precip', value: Number(diffPrecip.toFixed(1)) };
  }
  
  if (diffTemp > RELIABILITY_THRESHOLDS.TEMP_MED_DIFF || diffPrecip > RELIABILITY_THRESHOLDS.PRECIP_MED_DIFF) {
      return { level: 'medium', type: 'divergent', value: 0 };
  }
  
  return { level: 'high', type: 'ok', value: 0 };
};