// src/hooks/useWeatherAI.ts
import { useState, useEffect, useRef } from 'react';
import { 
    ExtendedWeatherData, 
    ShortRangeAgreement,
    AIPredictionResult 
} from '../types/weatherLogicTypes';

import { generateAIPrediction } from '../utils/aiContext';
import { resolveDustAdvisory } from '../utils/rules/aerosolRules';
import { isMostlyCloudy } from '../utils/rules/cloudRules';
import { 
    getGeminiAnalysis, 
    TacticalTip, 
    TacticalRiskLevel, 
    TacticalHazardType,
    type AiAirQualityInput
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
    // Procedència real de l'anàlisi (gemini/groq/emergency), independent
    // del text decoratiu de 'source'. Absent mentre només hi ha el fallback local.
    engine?: 'gemini' | 'groq' | 'emergency' | 'unknown';
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
    // Acord entre models de les pròximes 6 hores (shortRangeAgreementRules): la insígnia de l'anàlisi.
    reliability: ShortRangeAgreement | null,
    // Codi de temps ja passat per l'orquestrador (getRealTimeWeatherCode) — el mateix que
    // veu l'usuari a la capçalera. Sense ell, la IA llegiria el codi BRUT del model
    // (p.ex. el 45 d'ICON) i se saltaria la política de boira (visibilityRules.resolveFog).
    effectiveCode: number | null = null,
    // % efectiu de núvols d'"ara" (useCurrentConditions): la IA descriu el cel igual que la capçalera.
    effectiveCloudCover: number | null = null
) {
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisState | null>(null);
  // startedKey: l'última anàlisi que ha arrencat de debò (és la que hi ha a la pantalla i no cal repetir-la).
  // wantedKey: l'última consulta demanada, la que ha de guanyar.
  const startedKey = useRef<string>("");
  const wantedKey = useRef<string>("");

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
    // Nivell, causa i marge: un canvi de "Temperatura ±3°" a "±4°" també ha de refer la insígnia.
    const relLevel = reliability ? `${reliability.level}:${reliability.cause ?? '-'}:${reliability.tempMarginC ?? '-'}` : 'none';
    const currentRecord = current as unknown as Record<string, unknown>;
    const dustKind = resolveDustAdvisory(aqiData?.current, currentRecord.relative_humidity_2m as number | undefined, currentRecord.precipitation as number | undefined).kind;
    // Només la variant (no el % cru), perquè el cel no recalculi la IA a cada canvi de núvols.
    const mostlyCloudy = isMostlyCloudy(effectiveCode ?? Number(weatherCode), effectiveCloudCover);
    const currentKey = `${lat}-${lon}-${weatherCode}-${effectiveCode ?? 'x'}-${lang}-${unit}-${aqiVal}-${relLevel}-${dustKind ?? 'n'}-${mostlyCloudy ? 'mc' : 'c'}`;

    // 3. Circuit Breaker (Prevenció d'infinites crides a la xarxa o renders)
    wantedKey.current = currentKey;
    if (startedKey.current === currentKey) return;

    const fetchAI = async () => {
      try {
        // Càlcul de previsió local determinística d'emergència (Fallback immediat)
        const local = generateAIPrediction(
          current, weatherData.daily, weatherData.hourly, 
          aqiVal, lang, effectiveCode, reliability, unit, dustKind
        );
        setAiAnalysis(local);

        // Crida externa a la telemetria avançada (Gemini / Groq Worker)
        const gemini = await getGeminiAnalysis(weatherData, lang, effectiveCode, aqiData as AiAirQualityInput | null, effectiveCloudCover);
        
        // Només si aquesta consulta encara és la vigent i la que hi ha a la pantalla: la resposta d'una consulta
        // anterior no s'enganxa al text local d'una altra.
        if (gemini && gemini.text && startedKey.current === currentKey && wantedKey.current === currentKey) {
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
                source: 'MeteoToni AI Network',
                engine: gemini.engine
              };
          });
        }
      } catch (e) {
        console.error("🚨 Error useWeatherAI:", e);
      }
    };

    // La clau es dona per feta quan l'anàlisi ARRENCA, no en programar l'espera. Abans es marcava aquí mateix: si durant
    // els 500 ms arribaven dades noves amb la mateixa clau (un refresc), la neteja cancel·lava l'espera i el nou efecte
    // veia la clau com a feta i no en programava cap altra. L'anàlisi no es feia mai i la pantalla es quedava amb
    // l'anterior, d'una altra consulta (text i insígnia inclosos).
    const timer = setTimeout(() => {
      startedKey.current = currentKey;
      fetchAI();
    }, 500);
    return () => clearTimeout(timer);

  }, [weatherData, aqiData, lang, unit, reliability, effectiveCode, effectiveCloudCover]);

  return { aiAnalysis };
}