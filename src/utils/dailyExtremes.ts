// src/utils/dailyExtremes.ts
// Màxima, mínima i núvols diürns d'UN dia de la previsió setmanal, a partir de les hores d'aquest dia.
// Els comparteixen la llista de 7 dies (ForecastSection) i el gràfic de tendència (TrendChartModal).
// Abans cadascú ho calculava pel seu compte: la llista aplicava la correcció d'inversió tèrmica i el
// gràfic llegia el valor cru del model, així que a l'hivern (nits serenes i en calma) una mateixa mínima
// sortia fins a 3,5° més alta al gràfic que a la llista i al detall del dia.
import type { StrictCurrentWeather } from '../types/weatherLogicTypes';
import { getInversionCorrectedTemp } from './rules/temperatureCorrections';
import { getSafeMonthFromIso } from './weatherMath';

/** Mínim que cal d'una hora del chart horari complet (chartDataFull) per a aquests càlculs. */
export interface HourlyPoint {
    time: string;
    temp: number | null;
    [key: string]: unknown;
}

/** Hores d'una data "YYYY-MM-DD" dins el chart horari complet; buit si no hi ha dades horàries. */
export const hoursOfDate = (
    hours: ReadonlyArray<HourlyPoint> | null | undefined,
    dateOnly: string
): HourlyPoint[] =>
    Array.isArray(hours)
        ? hours.filter(h => typeof h.time === 'string' && h.time.startsWith(dateOnly))
        : [];

/**
 * Màxima i mínima que es mostren d'un dia. `rawMax`/`rawMin` són els valors diaris crus del model.
 *
 * [FIX PRECISIÓ] dailyData.temperature_2m_max/min és un valor de model en brut. Es busca dins les hores
 * reals del dia quina és la més freda i la més càlida i s'aplica getInversionCorrectedTemp NOMÉS a
 * aquestes hores concretes, amb el seu propi mes — mateix patró que Forecast24h.tsx i DayDetailModal.tsx.
 * Sense dades horàries per al dia, es manté el valor cru com a fallback (que pot ser null: mai un 0 fals).
 */
export interface DailyExtremes {
    max: number | null;
    min: number | null;
    /** La màxima surt d'una hora amb temperatura de model regional (i no del model global). */
    maxRegional: boolean;
    /** Idem per a la mínima. */
    minRegional: boolean;
}

export const resolveDailyExtremes = (
    rawMax: number | null,
    rawMin: number | null,
    dayHours: ReadonlyArray<HourlyPoint>,
    latitude?: number
): DailyExtremes => {
    const numericHours = dayHours.filter(
        (h): h is HourlyPoint & { temp: number } => typeof h.temp === 'number' && !isNaN(h.temp)
    );
    if (numericHours.length === 0) return { max: rawMax, min: rawMin, maxRegional: false, minRegional: false };

    const hottest = numericHours.reduce((a, b) => (b.temp > a.temp ? b : a));
    const coldest = numericHours.reduce((a, b) => (b.temp < a.temp ? b : a));

    const corrected = (h: HourlyPoint & { temp: number }): number =>
        getInversionCorrectedTemp(
            {
                temperature_2m: h.temp,
                cloud_cover_low: typeof h.cloudLow === 'number' ? h.cloudLow : 0,
                cloud_cover_mid: typeof h.cloudMid === 'number' ? h.cloudMid : 0,
                cloud_cover_high: typeof h.cloudHigh === 'number' ? h.cloudHigh : 0,
                wind_speed_10m: typeof h.wind === 'number' ? h.wind : 0,
                is_day: h.isDay
            } as unknown as StrictCurrentWeather,
            getSafeMonthFromIso(h.time),
            latitude
        );

    return {
        max: corrected(hottest),
        min: corrected(coldest),
        maxRegional: hottest.regionalTemp === true,
        minRegional: coldest.regionalTemp === true
    };
};

/** Mitjana de núvols (%) de les hores de sol del dia, o null si no hi ha hores de sol amb dades horàries. */
export const averageDaylightClouds = (dayHours: ReadonlyArray<HourlyPoint>): number | null => {
    const daylightHours = dayHours.filter(h => h.isDay === 1);
    if (daylightHours.length === 0) return null;
    const total = daylightHours.reduce((acc, h) => {
        const c = Number(h.cloud);
        return acc + (isNaN(c) ? 0 : c);
    }, 0);
    return total / daylightHours.length;
};
