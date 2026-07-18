// src/hooks/useWeatherAI.ts
import { useState, useEffect, useRef } from 'react';
import { 
    ExtendedWeatherData, 
    ReliabilityResult, 
    AIPredictionResult 
} from '../types/weatherLogicTypes';

import { generateAIPrediction } from '../utils/aiContext';
import { 
    getGeminiAnalysis, 
    TacticalTip, 
    TacticalRiskLevel, 
    TacticalHazardType 
} from '../services/geminiService';
import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';

// DOCTRINA RISC ZERO: Eixamplem la interfície legacy sobreescrivint 'tips'
// i afegint suport natiu per al semàfor de risc i perills severs de muntanya.
export interface AIAnalysisState extends Omit<AIPredictionResult, 'tips'> {
    tips?: (TacticalTip | string)[];
    risk_level?: TacticalRiskLevel;
    hazard_type?: TacticalHazardType;
    tactical_reasoning?: string;
    source?: string;
}

interface AQIData {
    current?: {
        european_aqi?: number | null;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export function useWeatherAI(
    weatherData: ExtendedWeatherData | null, 
    aqiData: AQIData | null, 
    lang: Language, 
    unit: WeatherUnit, 
    reliability: ReliabilityResult | null
) {
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisState | null>(null);
  const lastProcessedKey = useRef<string>("");

  useEffect(() => {
    // 1. Validació inicial (Risc Zero)
    if (!weatherData?.current) return;
    const current = weatherData.current;
    
    if (current.weather_code === undefined || current.weather_code === null) return;

    // 2. Construcció de la clau única per evitar re-càlculs innecessaris
    const wd = weatherData as Record<string, unknown>;
    const loc = wd?.['location'] as Record<string, unknown> | undefined;

    const latVal = loc?.['latitude'] ?? wd?.['latitude'] ?? 0;
    const lonVal = loc?.['longitude'] ?? wd?.['longitude'] ?? 0;

    const lat = Number(latVal).toFixed(3);
    const lon = Number(lonVal).toFixed(3);
    const weatherCode = current.weather_code;
    
    const aqiVal = aqiData?.current?.european_aqi ?? 0;
    const relLevel = reliability?.level || 'high';
    const currentKey = `${lat}-${lon}-${weatherCode}-${lang}-${unit}-${aqiVal}-${relLevel}`;

    // 3. Circuit Breaker (Prevenció d'infinites crides a la xarxa o renders)
    if (lastProcessedKey.current === currentKey) return;
    lastProcessedKey.current = currentKey;

    const fetchAI = async () => {
      try {
        // Càlcul de previsió local determinística d'emergència (Fallback immediat)
        const local = generateAIPrediction(
          current, weatherData.daily, weatherData.hourly, 
          aqiVal, lang, null, reliability, unit
        );
        setAiAnalysis(local);

        // Crida externa a la telemetria avançada (Gemini / Groq Worker)
        const gemini = await getGeminiAnalysis(weatherData, lang);
        
        if (gemini && gemini.text && lastProcessedKey.current === currentKey) {
          setAiAnalysis((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                text: gemini.text,
                // Risc Zero: Assegurem que 'tips' sigui realment un Array abans de sobreescriure
                tips: Array.isArray(gemini.tips) ? gemini.tips : prev.tips,
                // Propagació de la telemetria tàctica (Semàfor de risc i alertes severes)
                risk_level: gemini.risk_level || prev.risk_level,
                hazard_type: gemini.hazard_type || prev.hazard_type,
                tactical_reasoning: gemini.tactical_reasoning || prev.tactical_reasoning,
                source: 'MeteoToni AI Network'
              };
          });
        }
      } catch (e) {
        console.error("🚨 Error useWeatherAI:", e);
      }
    };

    const timer = setTimeout(fetchAI, 500);
    return () => clearTimeout(timer);

  }, [weatherData, aqiData, lang, unit, reliability]);

  return { aiAnalysis };
}