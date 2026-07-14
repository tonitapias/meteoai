// src/components/CurrentWeather.tsx
import { getWeatherIcon } from './WeatherIcons';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import { WeatherUnit } from '../utils/formatters';
import { Language } from '../translations';
import { AirQualityData } from '../types/weather';
import { useCurrentWeatherLogic } from '../hooks/useCurrentWeatherLogic';

// Sub-components "Building Blocks"
import { CurrentWeatherHeader } from './current-weather/CurrentWeatherHeader';
import { MainTemperatureDisplay } from './current-weather/MainTemperatureDisplay';
import { WeatherStatsGrid } from './current-weather/WeatherStatsGrid';
import { WeatherActionButtons } from './current-weather/WeatherActionButtons';

interface CurrentWeatherProps {
  data: ExtendedWeatherData;
  effectiveCode: number;
  unit: WeatherUnit;
  lang: Language;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onShowRadar: () => void;
  onShowArome: () => void;
  aqiData: AirQualityData | null;
  showAromeBtn?: boolean;
  shiftedNow?: Date;
}

// DOCTRINA RISC ZERO: Purificador de telemetria estricte.
const parseMetric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  // Si rebem un array (error d'API), extraiem el primer element si existeix
  if (Array.isArray(value)) value = value[0];
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

// DOCTRINA RISC ZERO: Validador segur d'objectes (evita que un array o null passi per objecte)
const isSafeObject = (obj: unknown): obj is Record<string, unknown> => {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
};

export default function CurrentWeather(props: CurrentWeatherProps) {
  const weather = useCurrentWeatherLogic({
    data: props.data,
    unit: props.unit,
    lang: props.lang,
    shiftedNow: props.shiftedNow,
    effectiveCode: props.effectiveCode,
  });

  if (!weather) return null;

  // OBTENCIÓ BLINDADA (Fix TypeScript: Declarem explícitament l'estructura Record per als fallbacks)
  const rawData: Record<string, unknown> = isSafeObject(props.data) ? props.data : {};
  const currentData: Record<string, unknown> = isSafeObject(rawData.current) ? rawData.current : {};
  const currentWeather: Record<string, unknown> = isSafeObject(rawData.current_weather) ? rawData.current_weather : {};
  const weatherMeta: Record<string, unknown> = isSafeObject(weather.meta) ? weather.meta : {};
  const weatherStats: Record<string, unknown> = isSafeObject(weather.stats) ? weather.stats : {};
  
  // Cerquem ratxes (Risc Zero: Fallback segur en cascada sense errors del compilador)
  const rawWindGusts = 
    currentData.wind_gusts_10m ?? 
    currentWeather.windgusts ?? 
    rawData.wind_gusts_10m;

  // Cerquem direcció del vent (Risc Zero: Fallback segur en cascada)
  const rawWindDir = 
    currentData.winddirection_10m ?? 
    currentData.wind_direction_10m ??
    currentWeather.winddirection ?? 
    rawData.wind_direction_10m ??
    rawData.winddirection_10m;

  // SPATIAL UI BASE AMB MATRIU DE FONS (Optimitzat per baix consum)
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px] md:bg-[size:16px_16px]`;

  return (
    <div className="w-full relative group perspective-[1000px]">
      {/* 
        SPATIAL UI / MOBILE-FIRST:
        Reduïm el padding en mòbil (p-4 sm:p-6) per alliberar espai.
        Mantenim `transform-gpu` però desactivem les transicions constants a mòbil per estalviar bateria.
      */}
      <div className="w-full flex flex-col md:flex-row items-stretch justify-between p-4 sm:p-6 md:p-10 bg-gradient-to-br from-[#060913]/95 to-black/95 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] border border-white/5 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)] md:shadow-[0_20px_50px_rgba(0,0,0,0.5)] gap-6 md:gap-8 ring-1 ring-white/5 transform-gpu transition-colors duration-700 preserve-3d">
        
        {/* Matriu Tàctica de Fons */}
        <div className={MATRIX_BG}></div>

        {/* 
          SPATIAL UI / ESTALVI D'ENERGIA: 
          Els blurs extrems i les mescles de color es restringeixen a escriptori ('md:block').
          En mòbil, fem servir un gradient sòlid molt suau per obtenir l'ambientació sense ofegar la GPU. 
        */}
        <div className="hidden md:block absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/15 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none mix-blend-screen z-0 transition-opacity duration-1000"></div>
        <div className="hidden md:block absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[60px] -ml-20 -mb-20 pointer-events-none mix-blend-screen z-0"></div>
        <div className="md:hidden absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-transparent to-indigo-500/5 pointer-events-none z-0"></div>

        {/* LEFT COLUMN: Context & Temp */}
        <div className="flex-1 flex flex-col justify-between z-10 relative md:[transform:translateZ(10px)]">
          <CurrentWeatherHeader
            locationName={weather.meta.locationName as string | undefined}
            country={weather.meta.country as string | undefined}
            time={weather.meta.time as string}
            date={weather.meta.date as string}
            isUsingArome={Boolean(weather.meta.isUsingArome)}
            elevation={parseMetric(rawData.elevation) ?? parseMetric(weatherMeta.elevation)}
          />

          <div className="mt-4 md:mt-0">
            <MainTemperatureDisplay
              temp={parseMetric(weather.temps.main)}
              max={parseMetric(weather.temps.max)}
              min={parseMetric(weather.temps.min)}
              weatherLabel={weather.visuals.weatherLabel as string}
              statusColor={weather.visuals.statusColor as string}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Icon, Grid & Actions */}
        <div className="w-full md:w-[320px] flex flex-col gap-4 z-10 shrink-0 mt-0 relative md:[transform:translateZ(20px)]">
          
          {/* Weather Icon Block */}
          <div className="flex-1 flex items-center justify-center min-h-[160px] sm:min-h-[180px] md:min-h-[220px] relative -mt-4 md:mt-0">
            <div className="drop-shadow-[0_0_30px_rgba(99,102,241,0.4)] md:drop-shadow-[0_0_40px_rgba(99,102,241,0.3)] transition-transform duration-700 hover:scale-105 relative z-20">
              {getWeatherIcon(
                props.effectiveCode,
                'w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56',
                // PONT DE CONVERSIÓ NATIVA: Boolean en comptes d'as boolean
                Boolean(weather.meta.isDay) 
              )}
            </div>
          </div>

          <WeatherStatsGrid
            windSpeed={parseMetric(weather.stats.windSpeed)}
            windGusts={parseMetric(weatherStats.windGusts) ?? parseMetric(rawWindGusts)}
            windDirection={parseMetric(weatherStats.windDirection) ?? parseMetric(rawWindDir)}
            humidity={parseMetric(weather.stats.humidity)}
            apparentTemp={parseMetric(weather.temps.apparent)}
            lang={props.lang}
          />

          <div className="mt-2 md:mt-0">
            <WeatherActionButtons
              onShowRadar={props.onShowRadar}
              onShowArome={props.onShowArome}
              showAromeBtn={props.showAromeBtn}
              isFavorite={props.isFavorite}
              onToggleFavorite={props.onToggleFavorite}
            />
          </div>
        </div>
      </div>
    </div>
  );
}