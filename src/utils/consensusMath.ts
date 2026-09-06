// src/utils/consensusMath.ts
import { GlobalModelData } from '../hooks/useGlobalModel';
import { resolveHourlyEpoch } from './weatherMath';

export interface HourlySeriesBundle {
  temp?: (number | null)[];
  rain?: (number | null)[];
  wind?: (number | null)[];
  gusts?: (number | null)[];
}

// Sèrie que comparteix índex 1:1 amb les `baseTimes` (el model regional actiu
// i ECMWF/GFS/ICON, que Open-Meteo ja retorna a la MATEIXA crida i per tant
// al mateix array `hourly.time` — vegeu normData.ts).
export interface AlignedNamedSeries {
  id: string;
  label: string;
  data: HourlySeriesBundle;
}

// Sèrie que ve d'una crida de xarxa independent amb el seu propi array de
// temps (avui només GLO/best_match, via useGlobalModel) i que cal remapejar
// per timestamp absolut en lloc de per índex.
export interface RemappedNamedSeries {
  id: string;
  label: string;
  times: string[];
  data: HourlySeriesBundle;
}

export interface MappedSeries {
  id: string;
  label: string;
  temp: (number | null)[];
  rain: (number | null)[];
  wind: (number | null)[];
  gusts: (number | null)[];
}

export interface MappedConsensusSeries {
  displayTimes: string[];
  series: MappedSeries[];
}

/**
 * Extreu una `HourlySeriesBundle` (arrays per camp) a partir de
 * `hourlyComparison.ecmwf/gfs/icon` (arrays d'objectes per hora, vegeu
 * normData.ts). Comparteixen índex amb `hourly.time` per construcció, així
 * que no calen remapejar per timestamp.
 */
export function extractComparisonSeries(rows: Record<string, unknown>[] | undefined): HourlySeriesBundle {
  if (!Array.isArray(rows)) return {};
  const num = (v: unknown): number | null => (typeof v === 'number' && !isNaN(v)) ? v : null;
  return {
    temp: rows.map(r => num(r?.temperature_2m)),
    rain: rows.map(r => num(r?.precipitation)),
    wind: rows.map(r => num(r?.wind_speed_10m)),
    gusts: rows.map(r => num(r?.wind_gusts_10m))
  };
}

/**
 * Alinea N sèries horàries (el model regional actiu, ECMWF/GFS/ICON i el
 * blend global GLO/best_match) sobre una finestra comuna de 24 hores
 * començant a l'hora actual, per als modals de telemetria del Motor de
 * Consens. Generalitza l'antiga versió fixa a 2 sèries (Loc/Glo): les
 * sèries "alineades" comparteixen índex amb `baseTimes` i només cal
 * retallar-les; les "remapejades" (GLO, d'una crida de xarxa independent)
 * es busquen per timestamp absolut via `resolveHourlyEpoch`.
 */
export function getMappedConsensusSeries(
  baseTimes: string[],
  alignedSeries: AlignedNamedSeries[],
  remappedSeries: RemappedNamedSeries[],
  utcOffset: number,
  nowTimestamp: number
): MappedConsensusSeries {
  let startIndex = baseTimes.findIndex(timeStr => {
    const epoch = resolveHourlyEpoch(timeStr, utcOffset);
    return !isNaN(epoch) && epoch >= nowTimestamp - (60 * 60 * 1000);
  });
  if (startIndex === -1) startIndex = 0;
  const displayTimes = baseTimes.slice(startIndex, startIndex + 24);

  const sliceAligned = (arr: (number | null | undefined)[] | undefined): (number | null)[] => {
    if (!arr) return displayTimes.map(() => null);
    const sliced = arr.slice(startIndex, startIndex + 24);
    return displayTimes.map((_, i) => {
      const val = sliced[i];
      return (typeof val === 'number' && !isNaN(val)) ? val : null;
    });
  };

  const mapRemapped = (times: string[], arr: (number | null)[] = []): (number | null)[] => {
    const dict = new Map<number, number | null>();
    arr.forEach((val, idx) => {
      const ep = resolveHourlyEpoch(times[idx], utcOffset);
      if (!isNaN(ep)) dict.set(ep, val);
    });
    return displayTimes.map(timeStr => dict.get(resolveHourlyEpoch(timeStr, utcOffset)) ?? null);
  };

  const series: MappedSeries[] = [
    ...alignedSeries.map(s => ({
      id: s.id,
      label: s.label,
      temp: sliceAligned(s.data.temp),
      rain: sliceAligned(s.data.rain),
      wind: sliceAligned(s.data.wind),
      gusts: sliceAligned(s.data.gusts)
    })),
    ...remappedSeries.map(s => ({
      id: s.id,
      label: s.label,
      temp: mapRemapped(s.times, s.data.temp),
      rain: mapRemapped(s.times, s.data.rain),
      wind: mapRemapped(s.times, s.data.wind),
      gusts: mapRemapped(s.times, s.data.gusts)
    }))
  ];

  return { displayTimes, series };
}

export interface ConsensusMetrics {
  isConsensusActive: boolean;
  tempDiff: number | null;
  precipDiff: number | null;
  windDiff: number | null;
  modelsAgree: boolean;
  score: number;
  futureDivergence: boolean;
  globalTemp: number | null;
  globalPrecip: number | null;
  globalWind: number | null;
  tempTrend: 'up' | 'down' | 'flat';
  precipTrend: 'up' | 'down' | 'flat';
  windTrend: 'up' | 'down' | 'flat';
}

// DOCTRINA RISC ZERO: marge màxim acceptable entre "ara" i l'hora del model global disponible
// més propera. Les sèries són horàries, així que 90 min ja dona marge per sobre de l'espaiat
// normal (30 min a cada banda); per sobre d'això és un forat de dades o una sèrie caducada.
const MAX_GLOBAL_TIME_DRIFT_MS = 90 * 60 * 1000;

export function calculateModelConsensus(
  localTemp: number | undefined,
  localPrecip: number | undefined,
  localWind: number | undefined,
  globalData: GlobalModelData | null,
  // [FIX PRECISIÓ] Sèrie horària del model local (AROME/ICON-D2/HRRR/...) per al
  // "Radar a 3 Hores" (futureDivergence, pas 6 més avall). Abans aquell avís
  // només mirava la sèrie global contra ella mateixa — exactament el model de
  // baixa resolució, ignorant el model local pensat per detectar convecció
  // local ràpida que el global sol allisar.
  localHourlyTimes: string[] = [],
  localHourlyPrecip: (number | null)[] = [],
  localHourlyWind: (number | null)[] = [],
  utcOffset: number = 0
): ConsensusMetrics {

  if (!globalData || typeof localTemp !== 'number') {
    return {
      isConsensusActive: false,
      tempDiff: null, precipDiff: null, windDiff: null, 
      modelsAgree: true, score: 0, futureDivergence: false,
      globalTemp: null, globalPrecip: null, globalWind: null,
      tempTrend: 'flat', precipTrend: 'flat', windTrend: 'flat'
    };
  }

  try {
    const safeHourly = globalData.hourly as Record<string, (string | number | null)[]>;
    
    // 1. SINCRONITZACIÓ HORÀRIA ABSOLUTA DE PROXIMITAT (BLINDADA)
    const nowTimestamp = Date.now();
    let currentHourIndex = -1;
    let minTimeDiff = Infinity;

    // Busquem l'índex exacte on el timestamp de l'API és més proper al mil·lisegon actual
    if (safeHourly.time && Array.isArray(safeHourly.time)) {
        for (let i = 0; i < safeHourly.time.length; i++) {
            const apiTime = new Date(String(safeHourly.time[i])).getTime();
            if (!isNaN(apiTime)) {
                const diff = Math.abs(apiTime - nowTimestamp);
                if (diff < minTimeDiff) {
                    minTimeDiff = diff;
                    currentHourIndex = i;
                }
            }
        }
    }

    // DOCTRINA RISC ZERO: si no hi ha cap hora vàlida, o la més propera disponible
    // s'allunya massa de l'instant actual (forat a la sèrie, dada no refrescada, etc.),
    // no és una comparació fiable — desactivem el consens en lloc de comparar contra
    // una hora equivocada en silenci.
    if (currentHourIndex === -1 || minTimeDiff > MAX_GLOBAL_TIME_DRIFT_MS) {
        const driftLabel = Number.isFinite(minTimeDiff) ? `${Math.round(minTimeDiff / 60000)} min` : 'cap hora vàlida';
        throw new Error(`Sincronització horària del model global no fiable (desviació: ${driftLabel})`);
    }

    // 2. EXTRACCIÓ ACTUAL SINCRONITZADA
    const globalTemp = safeHourly.temperature_2m?.[currentHourIndex];
    const globalPrecip = safeHourly.precipitation?.[currentHourIndex];

    if (typeof globalTemp !== 'number' || typeof globalPrecip !== 'number') {
        throw new Error("Dades principals incompletes al model global");
    }

    // DOCTRINA RISC ZERO: mai forcem un '0' quan falta la dada de vent o de pluja.
    // Si falta a qualsevol dels dos costats, ho tractem com a comparació NO vàlida (null)
    // en lloc de simular "0 km/h"/coincidència, que falsejaria l'acord entre models i inflaria el score.
    const rawGlobalWind = safeHourly.wind_speed_10m?.[currentHourIndex];
    const globalWindValid = typeof rawGlobalWind === 'number' && !Number.isNaN(rawGlobalWind);
    const localWindValid = typeof localWind === 'number' && !Number.isNaN(localWind);
    const hasValidWind = globalWindValid && localWindValid;

    const globalWind: number | null = globalWindValid ? (rawGlobalWind as number) : null;
    const safeLocalWind: number | null = localWindValid ? (localWind as number) : null;

    const localPrecipValid = typeof localPrecip === 'number' && !Number.isNaN(localPrecip);

    // 3. CÀLCUL DE DESVIACIONS
    const tempDiff = Number(Math.abs(localTemp - globalTemp).toFixed(1));
    const precipDiff = localPrecipValid
        ? Number(Math.abs((localPrecip as number) - globalPrecip).toFixed(1))
        : null;
    const windDiff = hasValidWind
        ? Number(Math.abs((safeLocalWind as number) - (globalWind as number)).toFixed(1))
        : null;

    // 4. MOTOR DE PUNTUACIÓ (CONTÍNUU I SENSE ZONES MORTES)
    let scorePenalty = 0;

    // Penalització Base (Cada dècima compta perquè el 100% sigui gairebé impossible)
    scorePenalty += tempDiff * 3.5;  // Ex: 3.0°C de diff = 10.5 punts menys
    if (precipDiff !== null) scorePenalty += precipDiff * 10; // Ex: 0.5mm de diff = 5 punts menys
    if (windDiff !== null) scorePenalty += windDiff * 0.8;  // Ex: 5km/h de diff = 4 punts menys

    // Penalització Exponencial per divergència greu (Orografia o Microclimes)
    if (tempDiff > 2.5) {
        scorePenalty += (tempDiff - 2.5) * 5; 
    }
    if (precipDiff !== null && precipDiff > 1.0) {
        scorePenalty += (precipDiff - 1.0) * 10;
    }
    if (windDiff !== null) {
        const maxWind = Math.max(safeLocalWind as number, globalWind as number);
        if (maxWind > 15 && windDiff > 5) {
            scorePenalty += (windDiff - 5) * 1.5;
        }
    }

    const rawScore = 100 - scorePenalty;
    const score = Math.round(Math.max(0, Math.min(100, rawScore)));
    const modelsAgree = score >= 75;

    // 5. CÀLCUL DE TENDÈNCIA (MOMENTUM)
    let tempTrend: 'up' | 'down' | 'flat' = 'flat';
    let precipTrend: 'up' | 'down' | 'flat' = 'flat';
    let windTrend: 'up' | 'down' | 'flat' = 'flat';

    const nextHourIndex = currentHourIndex + 1;
    if (safeHourly.temperature_2m && safeHourly.temperature_2m.length > nextHourIndex) {
        const nextTemp = safeHourly.temperature_2m[nextHourIndex];
        const nextPrecip = safeHourly.precipitation?.[nextHourIndex];
        const nextWind = safeHourly.wind_speed_10m?.[nextHourIndex];

        if (typeof nextTemp === 'number') {
            if (nextTemp > globalTemp + 0.5) tempTrend = 'up';
            else if (nextTemp < globalTemp - 0.5) tempTrend = 'down';
        }
        if (typeof nextPrecip === 'number') {
            if (nextPrecip > globalPrecip + 0.2) precipTrend = 'up';
            else if (nextPrecip < globalPrecip - 0.2) precipTrend = 'down';
        }
        if (typeof nextWind === 'number' && globalWind !== null) {
            if (nextWind > globalWind + 3) windTrend = 'up';
            else if (nextWind < globalWind - 3) windTrend = 'down';
        }
    }

    // 6. RADAR A 3 HORES — Model Global
    let futureDivergence = false;
    for (let i = 1; i <= 3; i++) {
      const futureIndex = currentHourIndex + i;
      if (safeHourly.temperature_2m && safeHourly.temperature_2m.length > futureIndex) {
         const futurePrecip = safeHourly.precipitation?.[futureIndex];
         const futureWind = safeHourly.wind_speed_10m?.[futureIndex];

         const isHeavyRain = typeof futurePrecip === 'number' && futurePrecip > 2;
         const isStrongWind = typeof futureWind === 'number' && futureWind > 40;

         if (isHeavyRain || isStrongWind) { futureDivergence = true; break; }
      }
    }

    // 6b. RADAR A 3 HORES — Model Local (alta resolució, p.ex. 1.3km AROME)
    // Mateixos llindars que el radar global (pas 6), però sobre la sèrie local:
    // és el model amb prou detall per detectar un xàfec o ràfega convectiva
    // local que el model global sol suavitzar fins a fer-lo invisible.
    if (!futureDivergence && localHourlyTimes.length > 0) {
      let localNowIndex = -1;
      let localMinDiff = Infinity;
      for (let i = 0; i < localHourlyTimes.length; i++) {
        const ep = resolveHourlyEpoch(localHourlyTimes[i], utcOffset);
        if (!isNaN(ep)) {
          const diff = Math.abs(ep - nowTimestamp);
          if (diff < localMinDiff) { localMinDiff = diff; localNowIndex = i; }
        }
      }

      if (localNowIndex !== -1 && localMinDiff <= MAX_GLOBAL_TIME_DRIFT_MS) {
        for (let i = 1; i <= 3; i++) {
          const futureIndex = localNowIndex + i;
          const futurePrecip = localHourlyPrecip[futureIndex];
          const futureWind = localHourlyWind[futureIndex];

          const isHeavyRain = typeof futurePrecip === 'number' && futurePrecip > 2;
          const isStrongWind = typeof futureWind === 'number' && futureWind > 40;

          if (isHeavyRain || isStrongWind) { futureDivergence = true; break; }
        }
      }
    }

    return {
      isConsensusActive: true,
      tempDiff, precipDiff, windDiff,
      modelsAgree, score, futureDivergence,
      globalTemp, globalPrecip, globalWind,
      tempTrend, precipTrend, windTrend
    };

  } catch (err) {
    console.warn("Consens inactiu:", err);
    return {
      isConsensusActive: false,
      tempDiff: null, precipDiff: null, windDiff: null, 
      modelsAgree: true, score: 0, futureDivergence: false,
      globalTemp: null, globalPrecip: null, globalWind: null,
      tempTrend: 'flat', precipTrend: 'flat', windTrend: 'flat'
    };
  }
}