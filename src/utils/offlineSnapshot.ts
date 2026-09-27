// src/utils/offlineSnapshot.ts
// PREVISIÓ DESADA QUAN NO N'ARRIBA CAP DE NOVA: sense connexió, amb l'API caiguda o massa lenta, WeatherRepository mostra
// l'última previsió desada del lloc (fins a 24 h) en lloc de la pantalla d'error. Tota l'app troba l'"ara" amb
// `current.time` (índex horari, modals, gràfics) i dona per fet que `daily[0]` és avui, així que la previsió no es pot
// mostrar tal com es va desar: aquí se n'avança una còpia fins a l'hora actual del lloc.
//   - Si ha passat mitjanit, es treuen els dies anteriors a avui de totes les sèries (horària, diària, comparacions i
//     minutal), de manera que tornen a començar avui a les 00:00, com una resposta nova.
//   - `current` es refà amb els valors horaris de l'hora actual: és la previsió desada per a ara, no les condicions de
//     l'hora en què es va desar. Un valor que falta queda null, mai el vell. (Si es va desar dins de l'hora actual, es
//     conserva tal qual.)
// Si la previsió desada no arriba fins a l'hora actual, no es pot fer servir (null).
import { PARAMS_CURRENT } from '../constants/apiConfig';
import { isRegionalModelActive, REGIONAL_TEMP_FLAG_KEY } from '../constants/regionalModels';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Acumulats de `current`: Open-Meteo els dona per al quart d'hora anterior i la sèrie horària per a l'hora sencera. Es
// reparteix l'hora en quatre quarts iguals, la mateixa estimació que fa useCurrentConditions sense dades minutals.
const QUARTER_HOUR_SUMS = new Set<string>(['precipitation', 'rain', 'showers', 'snowfall']);

/** Hora actual al lloc ("2026-09-27T14"), amb la zona horària de la resposta o, si no es reconeix, el seu desplaçament. */
export const locationHourPrefix = (now: Date, timezone: unknown, utcOffsetSeconds: unknown): string | null => {
    if (typeof timezone === 'string' && timezone) {
        try {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
            }).formatToParts(now);
            const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
            const [year, month, day, hour] = [part('year'), part('month'), part('day'), part('hour')];
            if (year && month && day && hour) return `${year}-${month}-${day}T${hour}`;
        } catch {
            // Zona desconeguda: es prova amb el desplaçament.
        }
    }
    if (typeof utcOffsetSeconds === 'number' && Number.isFinite(utcOffsetSeconds)) {
        return new Date(now.getTime() + utcOffsetSeconds * 1000).toISOString().slice(0, 13);
    }
    return null;
};

type Series = Record<string, unknown>;

/** Primer índex d'una sèrie de temps que ja és avui o després ("2026-09-27" o "2026-09-27T00:00"); -1 si no n'hi ha. */
const firstIndexFrom = (times: unknown[], today: string): number =>
    times.findIndex(t => typeof t === 'string' && t.slice(0, 10) >= today);

/** Treu les `start` primeres posicions de cada llista alineada amb la sèrie (mateixa longitud que el seu temps). */
const sliceSeries = (series: Series, length: number, start: number): Series => {
    const out: Series = {};
    Object.entries(series).forEach(([key, value]) => {
        out[key] = Array.isArray(value) && value.length === length ? value.slice(start) : value;
    });
    return out;
};

/**
 * Còpia de la previsió desada avançada fins a l'hora actual del lloc (vegeu la capçalera), o null si no la cobreix.
 * No muta les dades d'entrada.
 */
export const rollSnapshotForward = (weather: ExtendedWeatherData, now: Date): ExtendedWeatherData | null => {
    const hourly = weather?.hourly as unknown as Series | undefined;
    const daily = weather?.daily as unknown as Series | undefined;
    const hourPrefix = locationHourPrefix(now, weather?.timezone, weather?.utc_offset_seconds);
    if (!weather?.current || !hourly || !daily || !hourPrefix || !Array.isArray(hourly.time) || !Array.isArray(daily.time)) {
        return null;
    }

    const today = hourPrefix.slice(0, 10);
    const hourlyLength = hourly.time.length;
    const dailyLength = daily.time.length;
    const hourStart = firstIndexFrom(hourly.time, today);
    const dayStart = firstIndexFrom(daily.time, today);
    if (hourStart === -1 || dayStart === -1 || daily.time[dayStart] !== today) return null;

    const rolledHourly = sliceSeries(hourly, hourlyLength, hourStart);
    const rolledTimes = rolledHourly.time as unknown[];
    const nowIndex = rolledTimes.findIndex(t => typeof t === 'string' && t.startsWith(hourPrefix));
    if (nowIndex === -1) return null;

    // Desada dins de l'hora actual: el seu "ara" (quart d'hora) és més precís que el valor horari i es conserva.
    const current: Series = { ...weather.current };
    if (typeof weather.current.time !== 'string' || !weather.current.time.startsWith(hourPrefix)) {
        current.time = rolledTimes[nowIndex];
        PARAMS_CURRENT.forEach(key => {
            const value = (rolledHourly[key] as unknown[] | undefined)?.[nowIndex];
            const num = typeof value === 'number' && Number.isFinite(value) ? value : null;
            current[key] = num !== null && QUARTER_HOUR_SUMS.has(key) ? num / 4 : num;
        });
        // El model regional només cobreix els primers dies: si l'hora actual ja és del global, la font d'"ara" també.
        const regionalHour = (rolledHourly[REGIONAL_TEMP_FLAG_KEY] as unknown[] | undefined)?.[nowIndex] === 1;
        if (isRegionalModelActive(current.source as string | undefined) && !regionalHour) delete current.source;
    }

    const rolled: ExtendedWeatherData = {
        ...weather,
        current: current as ExtendedWeatherData['current'],
        hourly: rolledHourly as ExtendedWeatherData['hourly'],
        daily: sliceSeries(daily, dailyLength, dayStart) as ExtendedWeatherData['daily']
    };

    if (weather.hourlyComparison) {
        rolled.hourlyComparison = sliceSeries(weather.hourlyComparison, hourlyLength, hourStart) as ExtendedWeatherData['hourlyComparison'];
    }
    if (weather.dailyComparison) {
        const models: Series = {};
        Object.entries(weather.dailyComparison).forEach(([model, series]) => {
            models[model] = series && typeof series === 'object' ? sliceSeries(series as Series, dailyLength, dayStart) : series;
        });
        rolled.dailyComparison = models as ExtendedWeatherData['dailyComparison'];
    }

    // La pluja minutal de l'"ara" es busca per l'hora real: només es conserva si encara arriba a l'hora actual.
    const minutely = weather.minutely_15 as Series | undefined;
    if (minutely && Array.isArray(minutely.time)) {
        const coversNow = minutely.time.some(t => typeof t === 'string' && t.startsWith(hourPrefix));
        const minuteStart = firstIndexFrom(minutely.time, today);
        if (coversNow && minuteStart !== -1) {
            rolled.minutely_15 = sliceSeries(minutely, minutely.time.length, minuteStart);
        } else {
            delete rolled.minutely_15;
        }
    }

    return rolled;
};
