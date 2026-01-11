// src/hooks/useWeatherAI.js
import { useState, useEffect, useRef } from 'react';
import { 
    generateAIPrediction, 
    calculateReliability, 
    getRealTimeWeatherCode, 
    prepareContextForAI 
} from '../utils/weatherLogic';
import { fetchEnhancedForecast } from '../services/gemini';
import { cacheService } from '../services/cacheService';

export function useWeatherAI(weatherData, aqiData, lang, unit) {
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const lastGeminiCallSignature = useRef(null);

    useEffect(() => {
        if (!weatherData) return;

        // 1. Generació Algorítmica Immediata (Mentrestant carrega Gemini)
        const currentHour = new Date().getHours();
        const freezingLevel = weatherData.hourly?.freezing_level_height?.[currentHour] || 2500;
        const elevation = weatherData.elevation || 0;
        
        const effectiveWeatherCode = getRealTimeWeatherCode(
            weatherData.current, 
            weatherData.minutely_15?.precipitation, 
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

        const baseAnalysis = generateAIPrediction(
            { ...weatherData.current, minutely15: weatherData.minutely_15?.precipitation }, 
            weatherData.daily, 
            weatherData.hourly, 
            aqiData?.current?.european_aqi || 0, 
            lang, 
            effectiveWeatherCode, 
            reliability, 
            unit
        );

        // Establim la predicció algorítmica inicialment
        setAiAnalysis({ ...baseAnalysis, source: 'algorithm' });

        // 2. Preparació per a Gemini (IA Generativa)
        let context = prepareContextForAI(weatherData.current, weatherData.daily, weatherData.hourly);
        if (typeof context === 'object') { 
            context = { ...context, userRequestedLanguage: lang }; 
        }
        
        const weatherTimestamp = weatherData.current?.time; 
        const lat = weatherData.location?.latitude || 0;
        const lon = weatherData.location?.longitude || 0;
        const aiCacheKey = cacheService.generateAiKey(weatherTimestamp, lat, lon, lang);

        const checkCacheAndFetch = async () => {
            // A. Mirem si ja tenim aquesta predicció a la caché
            const cachedAI = await cacheService.get(aiCacheKey, 24 * 60 * 60 * 1000); 
            if (cachedAI) {
                console.log(`💾 IA recuperada de IndexedDB (${lang})`);
                setAiAnalysis(prev => ({ ...prev, text: cachedAI, source: 'gemini' }));
                return; 
            }

            // B. Si no, cridem a Gemini
            const currentSignature = JSON.stringify({ c: context, l: lang });
            lastGeminiCallSignature.current = currentSignature;

            fetchEnhancedForecast(context, lang).then(async (enhancedText) => {
               // Evitem "Race Conditions" si l'usuari ha canviat d'idioma ràpid
               if (lastGeminiCallSignature.current !== currentSignature) return;
               
               if (enhancedText) {
                   console.log(`✨ Nova IA generada (${lang})`);
                   await cacheService.set(aiCacheKey, enhancedText); 
                   setAiAnalysis(prev => ({ ...prev, text: enhancedText, source: 'gemini' }));
               }
            }).catch(err => console.error("Error silenciós Gemini:", err));
        };

        checkCacheAndFetch();

    }, [weatherData, aqiData, lang, unit]);

    return { aiAnalysis };
}