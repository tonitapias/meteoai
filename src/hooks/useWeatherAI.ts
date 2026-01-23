// src/hooks/useWeatherAI.ts
import { useState, useEffect, useRef } from 'react';
import { 
    generateAIPrediction, 
    ExtendedWeatherData, 
    ReliabilityResult, 
    AIPredictionResult 
} from '../utils/weatherLogic';
import { getGeminiAnalysis } from '../services/geminiService';
import { Language } from '../translations';
import { WeatherUnit } from '../utils/formatters';

// Ampliem el tipus base per incloure el camp 'source' opcional que afegeix el hook
interface AIAnalysisState extends AIPredictionResult {
    source?: string;
}

// Tipus simple per a AQI
interface AQIData {
    current?: {
        european_aqi?: number;
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
    // 1. Validació inicial
    if (!weatherData?.current) return;
    const current = weatherData.current;
    
    if (current.weather_code === undefined) return;

    // 2. Construcció de la clau única (incloent fiabilitat)
    // Accés segur a coordenades (fallback si no existeixen a location)
    const currentProps = current as Record<string, unknown>;
    const latVal = weatherData.location?.latitude ?? (typeof currentProps.latitude === 'number' ? currentProps.latitude : 0);
    const lonVal = weatherData.location?.longitude ?? (typeof currentProps.longitude === 'number' ? currentProps.longitude : 0);

    const lat = Number(latVal).toFixed(3);
    const lon = Number(lonVal).toFixed(3);
    const weatherCode = current.weather_code;
    const aqiVal = aqiData?.current?.european_aqi || 0;
    
    // Si reliability canvia, la clau també canviarà i forçarà el recàlcul
    const relLevel = reliability?.level || 'high';
    const currentKey = `${lat}-${lon}-${weatherCode}-${lang}-${unit}-${aqiVal}-${relLevel}`;

    // 3. Circuit Breaker (Evitar bucles)
    if (lastProcessedKey.current === currentKey) return;
    lastProcessedKey.current = currentKey;

    const fetchAI = async () => {
      try {
        // MILLORA: Passem reliability a la funció generadora
        const local = generateAIPrediction(
          current, weatherData.daily, weatherData.hourly, 
          aqiVal, lang, null, reliability, unit
        );
        setAiAnalysis(local);

        // Crida externa a Gemini
        const gemini = await getGeminiAnalysis(weatherData, lang);
        
        // Només actualitzem si la clau no ha canviat mentre esperàvem
        if (gemini && gemini.text && lastProcessedKey.current === currentKey) {
          setAiAnalysis((prev) => {
              if (!prev) return prev; // Protecció si el component s'ha desmuntat o estat és null
              return {
                ...prev,
                text: gemini.text,
                tips: gemini.tips?.length ? gemini.tips : prev.tips,
                source: 'Gemini AI'
              };
          });
        }
      } catch (e) {
        console.error("🚨 Error useWeatherAI:", e);
      }
    };

    const timer = setTimeout(fetchAI, 500);
    return () => clearTimeout(timer);

  }, [weatherData, aqiData, lang, unit, reliability]); // Important: reliability a les dependències

  return { aiAnalysis };
}