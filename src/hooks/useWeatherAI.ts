// src/hooks/useWeatherAI.ts
import { useState, useEffect, useRef } from 'react';
import { generateAIPrediction } from '../utils/weatherLogic';
import { getGeminiAnalysis } from '../services/geminiService';

export function useWeatherAI(weatherData: any, aqiData: any, lang: any, unit: any) {
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const lastProcessedKey = useRef<string>("");

  useEffect(() => {
    // 1. FILTRO DE SEGURIDAD: No actuar si faltan datos críticos
    const current = weatherData?.current;
    if (!current || current.weather_code === undefined) return;

    // 2. LLAVE ESTABLE: Inclou l'AQI a la clau per forçar actualització si arriba tard
    const lat = (weatherData.location?.latitude || current.latitude)?.toFixed(3);
    const lon = (weatherData.location?.longitude || current.longitude)?.toFixed(3);
    const weatherCode = current.weather_code;
    const aqiVal = aqiData?.current?.european_aqi || 0;
    
    // Afegim l'AQI a la clau única per garantir que si canvia, es recalculi
    const currentKey = `${lat}-${lon}-${weatherCode}-${lang}-${unit}-${aqiVal}`;

    // 3. CIRCUIT BREAKER
    if (lastProcessedKey.current === currentKey) return;
    lastProcessedKey.current = currentKey;

    const fetchAI = async () => {
      try {
        // Predicción local inmediata (sin IA externa)
        // Ara aqiVal ja tindrà el valor correcte des del principi gràcies al fix de useWeather
        const local = generateAIPrediction(
          current, weatherData.daily, weatherData.hourly, 
          aqiVal, lang, null, null, unit
        );
        setAiAnalysis(local);

        // Intento de mejora con Gemini (primero revisará su propia cache interna)
        const gemini = await getGeminiAnalysis(weatherData, lang);
        
        // Verifiquem que la clau no hagi canviat mentre esperàvem (evitar race conditions)
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

    // Debouncing: Esperar medio segundo de estabilidad antes de actuar
    const timer = setTimeout(fetchAI, 500);
    return () => clearTimeout(timer);

  }, [weatherData, aqiData, lang, unit]);

  return { aiAnalysis };
}