import { WEATHER_THRESHOLDS } from '../../constants/weatherConfig';

const { CAPE, CLOUDS, PRECIPITATION } = WEATHER_THRESHOLDS;

/**
 * Ajusta per tempestes si hi ha molta energia (CAPE): CAPE > MIN_STORM, cel tapat (> STORM_BASE) i QUALSEVOL
 * precipitació (des de 0,1 mm, o un codi de pluja/plugim) pinten tempesta.
 *
 * Sembla massa generós ("quatre gotes i una icona de tempesta"), però està mesurat i NO s'ha d'endurir: 26 aeroports
 * europeus (Catalunya, Espanya, França, Itàlia i centre d'Europa), set. 2024 – set. 2026, 469.000 hores, sèrie principal
 * de l'app (best_match d'Open-Meteo) a 0, 1, 3 i 5 dies vista contra tempesta observada als METAR (TS o VCTS, ±1 h):
 *   - Les hores que aquesta branca converteix en tempesta (el model no hi posava codi 95) tenen trons el 27-29 % de les
 *     vegades a 0-3 dies i el 17 % a 5 dies: comparable al codi de tempesta del mateix model (39/32/22/12 %) i unes 5
 *     vegades més que la resta d'hores de pluja (3-6 %). Amb menys de 0,5 mm, el 25-28 % (0-3 dies); amb codi de plugim
 *     (51-55), el 41-60 %.
 *   - Exigir >= 0,5 o >= 1 mm empitjora el CSI a tots els terminis (>= 1 mm: -0,006 a -0,013, interval de confiança
 *     per blocs de dies sense el 0); treure la branca, -0,009 a -0,018.
 *   - On la sèrie principal és Météo-France/ECMWF (p. ex. Roses, Perpinyà, Marsella), el model gairebé mai no dona codi
 *     95 i aquesta branca és l'única que avisa: a 3 dies, >= 1 mm faria passar el CSI de 0,080 a 0,041.
 * El que sí milloraria el CSI és baixar el CAPE mínim (800: +0,012 a +0,015), a canvi de pintar més tempestes; no s'ha
 * fet. Una tempesta prevista en un punt és sempre incerta: la icona vol dir "risc real de tempesta a la zona".
 */
export const adjustForStorms = (code: number, cape: number, cloudCover: number, precipAmount: number): number => {
    if (cape <= CAPE.MIN_STORM) return code; 

    const isPrecipitating = precipAmount >= PRECIPITATION.TRACE || (code >= 51 && code <= 82);

    if (cloudCover > CLOUDS.STORM_BASE) {
        if (isPrecipitating) {
            if (code < 95) return 95;
        } else if (cape > CAPE.HIGH_STORM) {
            return 2; 
        }
    }
    return code;
};