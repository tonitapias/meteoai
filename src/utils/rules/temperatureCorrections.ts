// src/utils/rules/temperatureCorrections.ts
import { StrictCurrentWeather } from '../../types/weatherLogicTypes';
import { safeNum } from '../weatherMath';
import { checkInversionRisk } from './inversionRules';
import { calculateEffectiveCloudCover } from './cloudRules';

/**
 * Calcula la temperatura corregida aplicant lògica d'inversió tèrmica intel·ligent.
 * Aquesta funció és PURA: no modifica l'objecte original, retorna un nou valor.
 *
 * [FIX PRECISIÓ] 'referenceMonth' ara és un paràmetre (0-indexat, com Date.getMonth())
 * en lloc de calcular-se sempre amb `new Date()` internament. Per defecte manté el
 * comportament anterior (mes real d'avui) perquè les crides existents ("ara mateix")
 * no calgui tocar-les. Per a hores futures d'un dia de previsió, el cridant ha de
 * passar el mes de l'hora en qüestió, no el d'avui.
 *
 * [FIX PRECISIÓ] 'latitude' (opcional) determina l'hemisferi per a checkInversionRisk:
 * sense latitud coneguda, es manté el comportament anterior (assumeix Hemisferi Nord).
 */
export const getInversionCorrectedTemp = (
    current: StrictCurrentWeather,
    referenceMonth: number = new Date().getMonth(),
    latitude?: number
): number => {
    const rawTemp = safeNum(current.temperature_2m);
    
    // 1. Recalculem les condicions necessàries
    // (Fem servir safeNum per protegir-nos de valors nuls o undefined)
    const cloudCover = calculateEffectiveCloudCover(
        safeNum(current.cloud_cover_low),
        safeNum(current.cloud_cover_mid),
        safeNum(current.cloud_cover_high)
    );

    const wind = safeNum(current.wind_speed_10m);
    
    // 2. Avaluem el risc base (usant la regla existent)
    const isInversionLikely = checkInversionRisk(
        current.is_day,
        wind,
        cloudCover,
        referenceMonth,
        latitude
    );

    // Si no hi ha risc, retornem la temperatura original de l'API
    if (!isInversionLikely) return rawTemp;

    // 3. FÍSICA MILLORADA (Clamping & Dissipació per Vent)
    // Si fa molt vent (>6 km/h), la inversió es trenca mecànicament.
    if (wind > 6) return rawTemp;

    // Factor d'intensitat (0.0 a 1.0)
    // Amb vent 0, la intensitat és 1. Amb vent 6, és 0.
    const inversionStrength = (6 - wind) / 6;
    
    // Correcció màxima: 3.5 graus (quan tot està calmat)
    // Apliquem el factor d'intensitat.
    const correction = 3.5 * inversionStrength;

    // GUARDRAIL DE SEGURETAT:
    // Mai permetrem que la correcció baixi més de 4 graus (per evitar errors grossos)
    // tot i que la fórmula ja ho limita a 3.5, aquest min és una assegurança extra.
    const safeCorrection = Math.min(correction, 4.0);

    // Retornem la nova temperatura
    return rawTemp - safeCorrection;
};