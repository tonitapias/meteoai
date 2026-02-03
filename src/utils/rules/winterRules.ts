import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { SNOW, PRECIPITATION } = WEATHER_THRESHOLDS;

/** Determina si la pluja s'ha de convertir en neu per temperatura */
export const determineSnowCode = (
    code: number, 
    temp: number, 
    freezingLevel: number, 
    elevation: number, 
    precipAmount: number
): number => {
    const freezingDist = freezingLevel - elevation;
    const isColdEnough = temp <= SNOW.TEMP_SNOW || (temp <= SNOW.TEMP_MIX && freezingDist < SNOW.FREEZING_BUFFER);

    if (!isColdEnough) return code;

    const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95);

    if (isRainCode || precipAmount > 0) {
        if (code === 65 || code === 82 || code === 67 || code >= 95 || precipAmount > PRECIPITATION.MODERATE) return 75; 
        if (code === 63 || code === 81 || code === 55 || code === 57 || precipAmount >= PRECIPITATION.LIGHT) return 73; 
        return 71; 
    }
    
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return code;
    
    return code;
};