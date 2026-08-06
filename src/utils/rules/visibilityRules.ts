import { calculateDewPoint } from '../physics';
import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { HUMIDITY, VISIBILITY, PRECIPITATION } = WEATHER_THRESHOLDS;

/** 
 * Detecta condicions de boira o humitat extrema, 
 * aplicant un bloqueig termodinàmic estricte contra falsos positius del model.
 */
export const checkForFog = (code: number, temp: number, humidity: number, cloudCover: number): number => {
    let safeCode = code;

    // 1. BLOQUEIG TERMOMECÀNIC (Anti-Glaç a temperatures positives)
    if (safeCode === 48 && temp > 0) {
        safeCode = 45; // Boira gebradora impossible a > 0ºC, rebaixem a boira normal
    }

    // 2. BLOQUEIG TERMODINÀMIC (Anti-Boira a ple estiu / Calitja confosa amb boira)
    // La boira és altament improbable a > 20ºC tret que la humitat sigui extrema (> 90%).
    // Si l'API ens marca 45 però fa calor i no hi ha saturació d'humitat, és pols en suspensió (calitja).
    if (safeCode === 45) {
        if (temp > 20 && humidity < 90) {
            // Restaurem l'estat del cel basat en la nuvolositat real, esborrant la falsa boira
            if (cloudCover > 85) return 3;
            if (cloudCover > 45) return 2;
            if (cloudCover > 15) return 1;
            return 0;
        }
    }

    // Si el codi ja és de precipitació o tempesta (superior a 48), no intentem fabricar boira.
    // Mantenim la dada de la precipitació primària intacta.
    if (safeCode > 48) return safeCode;

    // 3. CÀLCUL PSICROMÈTRIC (Creació artificial de boira si les condicions són reals)
    const dewPoint = calculateDewPoint(temp, humidity);
    const spread = temp - dewPoint;

    // Per forçar boira (si el cel inicialment no en marcava), exigim que la 
    // temperatura sigui raonable (<= 22ºC) o bé, humitats pròpies de climes tropicals (> 95%).
    if (safeCode < 45 && spread < HUMIDITY.DEW_SPREAD && humidity > HUMIDITY.FOG_BASE && cloudCover > 50) {
        if (temp <= 22 || humidity >= 95) {
            return 45;
        }
    }
    
    // Ajust d'humitat alta per forçar lleugera nuvolositat si tot estava esclarit
    if (safeCode === 0 && humidity > HUMIDITY.HIGH) {
        return 1;
    }
    
    return safeCode;
};

/** 
 * Força el codi de mala visibilitat si és crític i no plou.
 * Incorpora filtres termodinàmics opcionals (Risc Zero) per evitar "Falses Boires" 
 * en el cas que altres mòduls li passin dades brutes de sensors o visibilitat òptica.
 */
export const checkCriticalVisibility = (
    code: number, 
    visibility: number, 
    precipAmount: number,
    temp?: number,
    humidity?: number
): number => {
    // Si la visibilitat és crítica i no plou...
    if ((code === 45 || code === 48 || visibility < VISIBILITY.POOR) && precipAmount < PRECIPITATION.TRACE) {
        
        // Segur Termodinàmic: Si sabem la temp/humitat i detectem perfil de Calitja (Calor + Sec)
        if (typeof temp === 'number' && typeof humidity === 'number') {
            if (temp > 20 && humidity < 90) {
                // No forcem la boira. Si el codi original ja era boira errònia, la netegem a Cel Serè (0).
                return (code === 45 || code === 48) ? 0 : code;
            }
        }
        
        return 45;
    }
    
    return code;
};