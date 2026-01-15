// src/hooks/useWeatherAI.ts
import { useState, useEffect, useRef } from 'react';
import { generateAIPrediction } from '../utils/weatherLogic';
import { getGeminiAnalysis } from '../services/geminiService';

// MILLORA: Afegit paràmetre 'reliability'
export function useWeatherAI(weatherData: any, aqiData: any, lang: any, unit: any, reliability: any) {
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const lastProcessedKey = useRef<string>("");

  useEffect(() => {
    // 1. Validació inicial
    const current = weatherData?.current;
    if (!current || current.weather_code === undefined) return;

    // 2. Construcció de la clau única (incloent fiabilitat)
    const lat = (weatherData.location?.latitude || current.latitude)?.toFixed(3);
    const lon = (weatherData.location?.longitude || current.longitude)?.toFixed(3);
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
          setAiAnalysis((prev: any) => ({
            ...prev,
            text: gemini.text,
            tips: gemini.tips?.length ? gemini.tips : prev.tips,
            source: 'Gemini AI'
          }));
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