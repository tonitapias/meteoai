// src/hooks/useWeatherAI.ts
import { useState, useEffect, useRef } from 'react';
import { 
    generateAIPrediction, 
    calculateReliability, 
    getRealTimeWeatherCode, 
    prepareContextForAI,
    ExtendedWeatherData
} from '../utils/weatherLogic';
import { fetchEnhancedForecast } from '../services/gemini';
import { cacheService } from '../services/cacheService';
import { AirQualityData } from '../services/weatherApi';
import { Language } from '../constants/translations';
import { WeatherUnit } from '../utils/formatters';

interface AIAnalysisResult {
    text: string;
    tips: string[];
    alerts: any[];
    confidence: string;
    confidenceLevel: string;
    source?: 'algorithm' | 'gemini';
}

export function useWeatherAI(
    weatherData: ExtendedWeatherData | null, 
    aqiData: AirQualityData | null, 
    lang: Language, 
    unit: WeatherUnit
) {
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
    const lastGeminiCallSignature = useRef<string | null>(null);

    useEffect(() => {
        if (!weatherData) return;

        // 1. Generació Algorítmica Immediata
        const currentHour = new Date().getHours();
        const freezingLevel = weatherData.hourly?.freezing_level_height?.[currentHour] || 2500;
        const elevation = weatherData.elevation || 0;
        
        const effectiveWeatherCode = getRealTimeWeatherCode(
            weatherData.current, 
            weatherData.minutely_15?.precipitation as any, // Cast necessari si minutely_15 no està tipat estrictament
            0, 
            freezingLevel, 
            elevation
        );

        const reliability = calculateReliability(
            weatherData.daily, 
            weatherData.dailyComparison?.gfs, 
            weatherData.dailyComparison?.icon, 
            0
        );

        // Preparem dades per la funció síncrona
        const currentForAlgo = { 
            ...weatherData.current, 
            minutely15: weatherData.minutely_15?.precipitation 
        };

        const baseAnalysis = generateAIPrediction(
            currentForAlgo, 
            weatherData.daily, 
            weatherData.hourly, 
            aqiData?.current?.european_aqi || 0, 
            lang, 
            effectiveWeatherCode, 
            reliability, 
            unit
        );

        setAiAnalysis({ ...baseAnalysis, source: 'algorithm' } as AIAnalysisResult);

        // 2. Preparació per a Gemini
        let context: any = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
        if (context) { 
            context = { ...context, userRequestedLanguage: lang }; 
        }
        
        // Comprovem existència abans d'accedir a propietats opcionals
        const weatherTimestamp = weatherData.current?.time; 
        const lat = weatherData.latitude || 0; // weatherData root té lat/lon
        const lon = weatherData.longitude || 0;
        
        // Si no tenim timestamp, no podem generar clau
        if (!weatherTimestamp) return;

        const aiCacheKey = cacheService.generateAiKey(weatherTimestamp as string, lat, lon, lang);

        const checkCacheAndFetch = async () => {
            const cachedAI = await cacheService.get<string>(aiCacheKey, 24 * 60 * 60 * 1000); 
            if (cachedAI) {
                console.log(`💾 IA recuperada de IndexedDB (${lang})`);
                setAiAnalysis(prev => prev ? ({ ...prev, text: cachedAI, source: 'gemini' }) : null);
                return; 
            }

            const currentSignature = JSON.stringify({ c: context, l: lang });
            lastGeminiCallSignature.current = currentSignature;

            fetchEnhancedForecast(context, lang).then(async (enhancedText) => {
               if (lastGeminiCallSignature.current !== currentSignature) return;
               
               if (enhancedText) {
                   console.log(`✨ Nova IA generada (${lang})`);
                   await cacheService.set(aiCacheKey, enhancedText); 
                   setAiAnalysis(prev => prev ? ({ ...prev, text: enhancedText, source: 'gemini' }) : null);
               }
            }).catch(err => console.error("Error silenciós Gemini:", err));
        };

        checkCacheAndFetch();

    }, [weatherData, aqiData, lang, unit]);

    return { aiAnalysis };
}