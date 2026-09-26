import { safeNum } from '../weatherMath';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';
import { adjustBaseSkyCode } from './cloudRules';

const { PRECIPITATION, CLOUDS, TROPICAL_RAIN } = WEATHER_THRESHOLDS;

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

const isLiquidRainCode = (code: number): boolean => (code >= 51 && code <= 55) || (code >= 61 && code <= 65);

/** Nivell d'intensitat (0 feble, 1 moderat, 2 fort) amb els talls MODERATE/HEAVY de adjustRainIntensity. */
const intensityLevel = (precip: number): 0 | 1 | 2 => {
    const amount = safeNum(precip, 0);
    if (amount > PRECIPITATION.HEAVY) return 2;
    if (amount >= PRECIPITATION.MODERATE) return 1;
    return 0;
};

/**
 * FILTRE DE PLUJA TROPICAL (vegeu WEATHER_THRESHOLDS.TROPICAL_RAIN): pluja líquida feble (< MIN_MM) sense el cel
 * quasi tapat no es pinta; queda el cel que toca. El plugim que hi queda es pinta com a pluja (vegeu TROPICAL_RAIN:
 * a l'ECMWF "plugim" només vol dir menys d'1,3 mm/h). Només toca plugim, pluja i ruixats: la tempesta (la decideix
 * adjustForStorms, abans), la neu, l'aiguaneu i la pluja engelant no hi passen mai.
 */
export const applyTropicalRainGate = (code: number, precip: number, cloudCover: number): number => {
    const isLiquid = isLiquidRainCode(code) || (code >= 80 && code <= 82);
    if (!isLiquid) return code;
    if (safeNum(precip, 0) < TROPICAL_RAIN.MIN_MM && cloudCover <= CLOUDS.OVERCAST) return adjustBaseSkyCode(0, cloudCover);
    if (code >= 51 && code <= 55) return [61, 63, 65][intensityLevel(precip)];
    return code;
};

/**
 * RUIXAT AMB EL CEL TRENCAT (vegeu CLOUDS.SHOWER_MAX): plugim o pluja amb núvol efectiu <= SHOWER_MAX passa a ruixat,
 * amb la mateixa intensitat que la pluja (talls MODERATE/HEAVY de adjustRainIntensity). Mai al revés: un ruixat del
 * model amb el cel tapat continua sent ruixat.
 */
export const applyShowerSky = (code: number, precip: number, cloudCover: number): number => {
    if (!isLiquidRainCode(code) || cloudCover > CLOUDS.SHOWER_MAX) return code;
    return [80, 81, 82][intensityLevel(precip)];
};

/** Ajusta la intensitat de la pluja (feble/moderada/forta) segons mm/h */
export const adjustRainIntensity = (code: number, precipAmount: number): number => {
    if (code >= 95) return code;

    if (precipAmount >= PRECIPITATION.TRACE) { 
        if (precipAmount > PRECIPITATION.HEAVY) return 65; 
        if (precipAmount >= PRECIPITATION.MODERATE) return 63; 
        return 61; 
    } 
    return code;
};