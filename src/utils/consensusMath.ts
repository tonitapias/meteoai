// src/utils/consensusMath.ts
import { WRFData } from '../hooks/useWRF';

export interface ConsensusMetrics {
  isConsensusActive: boolean;
  tempDiff: number | null;
  precipDiff: number | null;
  windDiff: number | null;
  modelsAgree: boolean;
  score: number;
  futureDivergence: boolean;
  wrfTemp: number | null;
  wrfPrecip: number | null;
  wrfWind: number | null;
  tempTrend: 'up' | 'down' | 'flat';
  precipTrend: 'up' | 'down' | 'flat';
  windTrend: 'up' | 'down' | 'flat';
}

export function calculateModelConsensus(
  aromeTemp: number | undefined, 
  aromePrecip: number | undefined, 
  aromeWind: number | undefined,
  wrfData: WRFData | null
): ConsensusMetrics {

  if (!wrfData || typeof aromeTemp !== 'number') {
    return {
      isConsensusActive: false,
      tempDiff: null, precipDiff: null, windDiff: null, 
      modelsAgree: true, score: 0, futureDivergence: false,
      wrfTemp: null, wrfPrecip: null, wrfWind: null,
      tempTrend: 'flat', precipTrend: 'flat', windTrend: 'flat'
    };
  }

  try {
    const safeHourly = wrfData.hourly as Record<string, (string | number | null)[]>;
    
    // 1. SINCRONITZACIÓ HORÀRIA PRECISA
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    
    // Creem l'etiqueta d'hora exacta local (ex: "2026-07-03T12:00")
    const currentIsoString = `${year}-${month}-${day}T${hours}:00`;
    
    // Busquem l'índex exacte on l'array 'time' coincideix amb la nostra etiqueta
    let currentHourIndex = -1;
    if (safeHourly.time && Array.isArray(safeHourly.time)) {
       currentHourIndex = safeHourly.time.findIndex(timeStr => String(timeStr).startsWith(currentIsoString));
    }

    // Fallback de seguretat si la cerca falla (tornem al sistema clàssic per evitar que l'app caigui)
    if (currentHourIndex === -1) {
       console.warn(`No s'ha trobat l'hora exacta ${currentIsoString} a les dades WRF. Usant fallback.`);
       currentHourIndex = now.getHours();
    }

    // 2. EXTRACCIÓ ACTUAL SINCRONITZADA
    const wrfTemp = safeHourly.temperature_2m?.[currentHourIndex];
    const wrfPrecip = safeHourly.precipitation?.[currentHourIndex];
    const wrfWind = Number(safeHourly.wind_speed_10m?.[currentHourIndex] ?? 0);
    const safeAromeWind = aromeWind ?? 0;

    if (typeof wrfTemp !== 'number' || typeof wrfPrecip !== 'number') {
        throw new Error("Dades principals incompletes al model global");
    }

    // 3. CÀLCUL DE DESVIACIONS
    const tempDiff = Number(Math.abs(aromeTemp - wrfTemp).toFixed(1));
    const precipDiff = Number(Math.abs((aromePrecip || 0) - wrfPrecip).toFixed(1));
    const windDiff = Number(Math.abs(safeAromeWind - wrfWind).toFixed(1));

    const rawScore = 100 - (tempDiff * 8) - (precipDiff * 15) - (windDiff * 1.5);
    const score = Math.round(Math.max(0, Math.min(100, rawScore)));
    const modelsAgree = score >= 75;

    // 4. CÀLCUL DE TENDÈNCIA (MOMENTUM)
    let tempTrend: 'up' | 'down' | 'flat' = 'flat';
    let precipTrend: 'up' | 'down' | 'flat' = 'flat';
    let windTrend: 'up' | 'down' | 'flat' = 'flat';

    const nextHourIndex = currentHourIndex + 1;
    if (safeHourly.temperature_2m && safeHourly.temperature_2m.length > nextHourIndex) {
        const nextTemp = safeHourly.temperature_2m[nextHourIndex];
        const nextPrecip = safeHourly.precipitation?.[nextHourIndex];
        const nextWind = safeHourly.wind_speed_10m?.[nextHourIndex];

        if (typeof nextTemp === 'number') {
            if (nextTemp > wrfTemp + 0.5) tempTrend = 'up';
            else if (nextTemp < wrfTemp - 0.5) tempTrend = 'down';
        }
        if (typeof nextPrecip === 'number') {
            if (nextPrecip > wrfPrecip + 0.2) precipTrend = 'up';
            else if (nextPrecip < wrfPrecip - 0.2) precipTrend = 'down';
        }
        if (typeof nextWind === 'number') {
            if (nextWind > wrfWind + 3) windTrend = 'up';
            else if (nextWind < wrfWind - 3) windTrend = 'down';
        }
    }

    // 5. RADAR A 3 HORES
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

    return {
      isConsensusActive: true,
      tempDiff, precipDiff, windDiff,
      modelsAgree, score, futureDivergence,
      wrfTemp, wrfPrecip, wrfWind,
      tempTrend, precipTrend, windTrend
    };

  } catch (err) {
    console.warn("Consens inactiu:", err);
    return {
      isConsensusActive: false,
      tempDiff: null, precipDiff: null, windDiff: null, 
      modelsAgree: true, score: 0, futureDivergence: false,
      wrfTemp: null, wrfPrecip: null, wrfWind: null,
      tempTrend: 'flat', precipTrend: 'flat', windTrend: 'flat'
    };
  }
}