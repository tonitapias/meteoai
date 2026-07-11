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

// DOCTRINA RISC ZERO: Purificador de telemetria estricte (Zero 'any').
const parseMetric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
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

  // Extracció profunda de dades brutes (Risc Zero: sense 'any')
  const rawData = props.data as Record<string, unknown>;
  const currentData = rawData.current as Record<string, unknown> | undefined;
  const currentWeather = rawData.current_weather as Record<string, unknown> | undefined;
  
  // Cerquem ratxes (Risc Zero: Fallback en cascada)
  const rawWindGusts = 
    currentData?.wind_gusts_10m ?? 
    currentWeather?.windgusts ?? 
    rawData.wind_gusts_10m;

  // Cerquem direcció del vent (Risc Zero: Fallback en cascada)
  const rawWindDir = 
    currentData?.winddirection_10m ?? 
    currentData?.wind_direction_10m ??
    currentWeather?.winddirection ?? 
    rawData.wind_direction_10m ??
    rawData.winddirection_10m;

  // SPATIAL UI BASE AMB MATRIU DE FONS
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div className="w-full relative group">
      <div className="w-full flex flex-col md:flex-row items-stretch justify-between p-6 md:p-10 bg-gradient-to-br from-[#0f111a]/95 to-black/90 backdrop-blur-xl rounded-[3rem] border border-white/5 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] gap-8 ring-1 ring-white/5 transform-gpu transition-colors duration-700">
        
        {/* Matriu Tàctica de Fons */}
        <div className={MATRIX_BG}></div>

        {/* Background Decorators (Llum Atmosfèrica Spatial UI) */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/15 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none mix-blend-screen z-0 transition-opacity duration-1000"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none mix-blend-screen z-0"></div>

        {/* LEFT COLUMN: Context & Temp */}
        <div className="flex-1 flex flex-col justify-between z-10 relative">
          <CurrentWeatherHeader
            locationName={weather.meta.locationName}
            country={weather.meta.country}
            time={weather.meta.time}
            date={weather.meta.date}
            isUsingArome={weather.meta.isUsingArome}
            // DOCTRINA RISC ZERO: Props isFavorite i onToggleFavorite eliminades per unificació tàctica a WeatherActionButtons
            elevation={parseMetric(rawData.elevation) ?? parseMetric((weather.meta as Record<string, unknown>).elevation)}
          />

          <MainTemperatureDisplay
            temp={parseMetric(weather.temps.main)}
            max={parseMetric(weather.temps.max)}
            min={parseMetric(weather.temps.min)}
            weatherLabel={weather.visuals.weatherLabel}
            statusColor={weather.visuals.statusColor}
          />
        </div>

        {/* RIGHT COLUMN: Icon, Grid & Actions */}
        <div className="w-full md:w-[320px] flex flex-col gap-4 z-10 shrink-0 mt-0 relative">
          
          {/* Weather Icon Block */}
          <div className="flex-1 flex items-center justify-center min-h-[180px] md:min-h-[220px] relative -mt-8 md:mt-0">
            <div className="drop-shadow-[0_0_60px_rgba(99,102,241,0.6)] md:drop-shadow-[0_0_40px_rgba(99,102,241,0.3)] transition-transform duration-700 hover:scale-105 relative z-20">
              {getWeatherIcon(
                props.effectiveCode,
                'w-48 h-48 md:w-56 md:h-56',
                weather.meta.isDay
              )}
            </div>
          </div>

          <WeatherStatsGrid
            windSpeed={parseMetric(weather.stats.windSpeed)}
            windGusts={parseMetric((weather.stats as Record<string, unknown>).windGusts) ?? parseMetric(rawWindGusts)}
            windDirection={parseMetric((weather.stats as Record<string, unknown>).windDirection) ?? parseMetric(rawWindDir)}
            humidity={parseMetric(weather.stats.humidity)}
            apparentTemp={parseMetric(weather.temps.apparent)}
            lang={props.lang}
          />

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
  );
}