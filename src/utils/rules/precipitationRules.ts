import { safeNum } from '../physics';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { PRECIPITATION } = WEATHER_THRESHOLDS;

// Constants internes per Virga
const VIRGA_HUMIDITY_LIMIT = 45; // % Mínim d'humitat per permetre pluja feble
const VIRGA_PRECIP_LIMIT = 1.5;  // mm Màxims per considerar filtrar la pluja

/** Obté la precipitació màxima actual (entre dada minutal i horària) */
export const getInstantaneousPrecipitation = (minutelyData: number[], currentPrecip: number): number => {
    if (minutelyData && minutelyData.length > 0) {
        return Math.max(...minutelyData.map(v => safeNum(v, 0)));
    }
    return safeNum(currentPrecip, 0);
};

/** FILTRE VIRGA: Evita dir que plou quan l'aire és molt sec */
export const checkForVirga = (code: number, humidity: number, cloudCover: number, precip: number): number => {
    const isRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
    
    if (!isRain) return code;

    if (humidity < VIRGA_HUMIDITY_LIMIT && precip < VIRGA_PRECIP_LIMIT) {
        // Retornem a l'estat de cel base (sense pluja)
        return cloudCover > 50 ? 3 : 2; 
    }

    return code;
};

/** Ajusta la intensitat de la pluja (feble/moderada/forta) segons mm/h */
export const adjustRainIntensity = (code: number, precipAmount: number): number => {
    if (code >= 95) return code;

    if (precipAmount >= PRECIPITATION.TRACE) { 
        if (precipAmount > PRECIPITATION.HEAVY) return 65; 
        if (precipAmount >= 1.0) return 63; 
        return 61; 
    } 
    return code;
};