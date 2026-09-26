// src/utils/rules/temperatureCorrections.ts
import { StrictCurrentWeather } from '../../types/weatherLogicTypes';
import { extractValidNum, safeNum } from '../weatherMath';
import { checkInversionRisk } from './inversionRules';
import { calculateEffectiveCloudCover } from './cloudRules';

/**
 * Correcció màxima (°C) d'una nit d'inversió en calma total; amb vent es redueix linealment fins a 0 a 6 km/h.
 *
 * Abans era 3,5 °C. Verificat contra l'hivern 2025-26 (nov.–mar.) a 30 aeroports europeus: la previsió de curt termini
 * d'Open-Meteo (arxiu de passades anteriors, "dia 0") de la sèrie que mostra l'app —model regional on n'hi ha, AROME HD a
 * 20 dels 30— amb el vent i els núvols de la mateixa sèrie, contra la temperatura dels METAR. La regla salta el 8 % de
 * les hores de nit (4.954 hores, 29 estacions) i la correcció mitjana és d'1,3 °C:
 *   - el model en brut hi té un biaix càlid de només +0,58 °C (MAE 1,38 °C); la correcció sencera el passava a -0,73 °C
 *     i empitjorava el MAE a 1,55 °C (IC 95 % per blocs estació-dia del canvi [+0,11, +0,23]); millorava 9 estacions de 29,
 *     les que tenen un biaix càlid fort de clot d'aire fred (Sabadell, Milà, Basilea, Clermont, Marignane...);
 *   - la meitat (1,75 °C) deixa el biaix a -0,07 °C i el MAE a 1,33 °C: -0,22 °C contra la sencera (IC [-0,25, -0,19]) i
 *     -0,05 °C contra no corregir (IC [-0,08, -0,02]). Sobre la sèrie global sola (best_match, la de més enllà de l'abast
 *     regional) passa el mateix: MAE 1,30 / 1,48 / 1,27 °C (cap / sencera / meitat);
 *   - la MÍNIMA DIÀRIA (llista de 7 dies, tendència, detall) dels dies on la regla toca alguna hora: MAE 1,305 sense
 *     corregir, 1,276 amb la sencera i 1,233 amb la meitat (-0,07 °C contra no corregir, IC [-0,11, -0,04]; contra la
 *     sencera -0,04 °C, IC [-0,10, +0,02]); la meitat és millor que la sencera a 19 de 29 estacions.
 * Límit: només es pot verificar el curt termini (l'arxiu no guarda els núvols ni el vent regional de passades més velles).
 * A més termini l'error aleatori creix i la regla s'activa amb una calma i un cel serè menys segurs, cosa que demana una
 * correcció més petita, no més gran. La magnitud real depèn del relleu de cada punt (valls i conques sí, costes i
 * vessants no), que l'app no coneix: per això una correcció fixa no pot ser gran.
 */
export const MAX_INVERSION_CORRECTION_C = 1.75;

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
    
    // Correcció màxima quan tot està calmat (vegeu MAX_INVERSION_CORRECTION_C), escalada per la intensitat.
    const correction = MAX_INVERSION_CORRECTION_C * inversionStrength;

    // GUARDRAIL DE SEGURETAT: la fórmula ja la limita a MAX_INVERSION_CORRECTION_C; aquest min és una assegurança extra.
    const safeCorrection = Math.min(correction, 4.0);

    // Retornem la nova temperatura
    return rawTemp - safeCorrection;
};

/**
 * Sensació tèrmica MOSTRADA: la del model desplaçada tant com la temperatura per la correcció d'inversió.
 *
 * Open-Meteo calcula la sensació a partir de la temperatura crua (més el vent, la humitat i el sol). Sense això, en una
 * nit d'inversió la pantalla deia p. ex. "1°, sensació 3°": la correcció baixava l'aire però no el que se sent. Restant-hi
 * el mateix que a la temperatura, la diferència entre totes dues (l'efecte del vent i de la humitat) queda la del model.
 *
 * `rawTemp` és la temperatura crua del model i `displayTemp` la corregida (getInversionCorrectedTemp o
 * getHourlyDisplayTemp). Sense sensació, null (mai un 0 fals); sense alguna de les dues temperatures no se sap quina
 * correcció s'ha aplicat i la sensació es deixa tal com ve.
 */
export const getInversionCorrectedApparent = (
    apparent: unknown,
    rawTemp: unknown,
    displayTemp: number | null | undefined
): number | null => {
    const feels = extractValidNum(apparent);
    if (feels === null) return null;
    const raw = extractValidNum(rawTemp);
    const shown = extractValidNum(displayTemp);
    if (raw === null || shown === null) return feels;
    return feels - (raw - shown);
};
