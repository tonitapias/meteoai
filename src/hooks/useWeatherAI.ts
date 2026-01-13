// src/hooks/useWeatherAI.ts
import { useState, useEffect, useRef } from 'react';
import { generateAIPrediction } from '../utils/weatherLogic';
import { getGeminiAnalysis } from '../services/geminiService';

// ATENCIÓ: La clau és aquest "export" davant de function
export function useWeatherAI(weatherData: any, aqiData: any, lang: any, unit: any) {
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  
  // 1. REF DE CONTROL
  const lastProcessedKey = useRef<string>("");

  useEffect(() => {
    if (!weatherData?.current) return;

    // 2. GENEREM LA CLAU ÚNICA
    const lat = weatherData.location?.latitude || weatherData.current?.latitude;
    const lon = weatherData.location?.longitude || weatherData.current?.longitude;
    const weatherCode = weatherData.current?.weather_code;
    const currentKey = `${lat}-${lon}-${weatherCode}-${lang}-${unit}`;

    // 3. BLOQUEIG DE SEGURETAT (CIRCUIT BREAKER)
    if (lastProcessedKey.current === currentKey) {
      return; 
    }

    // Marquem la clau com a processada IMMEDIATAMENT (síncronament).
    lastProcessedKey.current = currentKey;

    const fetchAI = async () => {
      try {
        // 4. LÒGICA LOCAL (Immediata)
        const local = generateAIPrediction(
          weatherData.current, weatherData.daily, weatherData.hourly, 
          aqiData?.current?.us_aqi || 0, lang, null, null, unit
        );
        
        // Actualitzem l'estat local primer
        setAiAnalysis(local);

        // 5. MILLORA AMB GEMINI IA (Asíncrona)
        console.log("🤖 MeteoAI: Demanant nova anàlisi a Gemini...");
        
        const gemini = await getGeminiAnalysis(weatherData, lang);
        
        if (gemini && gemini.text) {
          // Verifiquem que el component encara vol aquesta resposta
          if (lastProcessedKey.current === currentKey) {
            setAiAnalysis((prev: any) => ({
              ...prev,
              text: gemini.text,
              tips: gemini.tips?.length ? gemini.tips : prev.tips,
              source: 'Gemini AI'
            }));
          }
        }
      } catch (e) {
        console.error("🚨 Error en el flux de useWeatherAI:", e);
      }
    };

    fetchAI();

  }, [weatherData, aqiData, lang, unit]);

  return { aiAnalysis };
}