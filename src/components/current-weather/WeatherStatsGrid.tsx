// src/components/current-weather/WeatherStatsGrid.tsx
import { Droplets, Activity, Navigation, Wind, CloudOff } from 'lucide-react';
import { Language } from '../../translations';

interface WeatherStatsGridProps {
  windSpeed: number | null;
  windGusts?: number | null;
  windDirection?: number | null; 
  humidity: number | null;
  apparentTemp: number | null;
  lang?: Language;
}

// TIPATGE ESTRICTE: Definim l'estructura del diccionari tàctic
interface GridTranslation {
  windDynamics: string;
  gusts: string;
  humidity: string;
  feelsLike: string;
  cardinals: string[];
  noData: string;
}

// DOCTRINA RISC ZERO: Diccionari intern blindat
const gridTranslations: Record<string, GridTranslation> = {
  ca: {
    windDynamics: "Dinàmica de Vent",
    gusts: "RATXES",
    humidity: "Humitat",
    feelsLike: "Sensació",
    cardinals: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
    noData: "SENSE DADES"
  },
  es: {
    windDynamics: "Dinámica de Viento",
    gusts: "RACHAS",
    humidity: "Humedad",
    feelsLike: "Sensación",
    cardinals: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
    noData: "SIN DATOS"
  },
  en: {
    windDynamics: "Wind Dynamics",
    gusts: "GUSTS",
    humidity: "Humidity",
    feelsLike: "Feels Like",
    cardinals: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    noData: "NO DATA"
  },
  fr: {
    windDynamics: "Dynamique du Vent",
    gusts: "RAFALES",
    humidity: "Humidité",
    feelsLike: "Ressenti",
    cardinals: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
    noData: "PAS DE DONNÉES"
  }
};

export const WeatherStatsGrid = ({ windSpeed, windGusts, windDirection, humidity, apparentTemp, lang = 'ca' }: WeatherStatsGridProps) => {
  // Garantim un fallback segur si s'introdueix un idioma no mapejat
  const safeLang = gridTranslations[lang] ? lang : 'ca';
  const t = gridTranslations[safeLang];

  // DOCTRINA RISC ZERO: Validació independent de l'estat de cada sensor
  const isValidWind = typeof windSpeed === 'number' && !isNaN(windSpeed);
  const isValidGusts = typeof windGusts === 'number' && !isNaN(windGusts);
  const isValidDir = typeof windDirection === 'number' && !isNaN(windDirection);
  const isValidHum = typeof humidity === 'number' && !isNaN(humidity);
  const isValidTemp = typeof apparentTemp === 'number' && !isNaN(apparentTemp);

  // Escut visual per a valors nuls
  const formatValue = (val: number | null | undefined, isValid: boolean) => {
    return isValid && val !== null && val !== undefined ? Math.round(val) : '--';
  };

  // Funció auxiliar matemàticament segura per traduir graus a punts cardinals
  const getCardinal = (angle: number | null | undefined) => {
    if (!isValidDir || angle === null || angle === undefined) return '--';
    // Protecció matemàtica immutabilitzada per mantenir els graus entre 0 i 360
    const normalizedAngle = ((angle % 360) + 360) % 360;
    const index = Math.round(normalizedAngle / 45) % 8;
    return t.cardinals[index];
  };

  // SPATIAL UI BASE (Bateria optimitzada per a mòbil)
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px] md:bg-[size:16px_16px]`;
  const BASE_CARD = "relative overflow-hidden backdrop-blur-md bg-gradient-to-br border shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu transition-colors duration-500";

  return (
    <div className="flex flex-col gap-3 md:gap-4 relative z-10 w-full">
      
      {/* MÒDUL DE VENT TÀCTIC */}
      <div className={`${BASE_CARD} p-4 sm:p-5 rounded-2xl md:rounded-[20px] flex items-center justify-between group ${isValidWind ? 'from-[#0B0D14]/95 to-black/90 border-white/10 hover:border-white/20' : 'from-[#1a1d27]/90 to-black/80 border-slate-700/60'}`}>
        <div className={MATRIX_BG}></div>
        
        <div className="flex flex-col gap-1 z-10 relative">
          <div className="flex items-center gap-2 mb-1">
            {isValidWind ? (
              <Wind className="w-4 h-4 md:w-5 md:h-5 text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)] transition-colors" />
            ) : (
              <CloudOff className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            )}
            <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-500 drop-shadow-sm ${isValidWind ? 'text-slate-200' : 'text-slate-400'}`}>
              {t.windDynamics}
            </span>
          </div>
          
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl sm:text-4xl md:text-5xl font-mono font-bold tabular-nums tracking-tight transition-colors duration-500 drop-shadow-lg ${isValidWind ? 'text-white' : 'text-slate-500'}`}>
              {formatValue(windSpeed, isValidWind)}
            </span>
            <span className={`text-[11px] sm:text-xs font-bold uppercase transition-colors duration-500 ${isValidWind ? 'text-slate-400' : 'text-slate-500'}`}>km/h</span>
          </div>
          
          <div className={`text-[11px] sm:text-xs font-mono font-medium mt-1 sm:mt-1.5 uppercase transition-colors duration-500 ${isValidWind ? 'text-slate-400' : 'text-slate-500'}`}>
            {t.gusts}: <span className={`font-black tabular-nums drop-shadow-md ${isValidGusts ? 'text-indigo-300' : 'text-slate-500'}`}>
              {formatValue(windGusts, isValidGusts)}
            </span> <span className={isValidGusts ? 'text-slate-500' : 'text-slate-600'}>km/h</span>
          </div>
        </div>

        {/* Brúixola Digital i Direcció */}
        <div className="flex flex-col items-center gap-2 sm:gap-2.5 z-10 relative">
          <div className={`relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border shadow-inner transition-colors duration-500 ${isValidDir ? 'bg-[#06080D]/80 border-white/10' : 'bg-[#1a1d27]/50 border-slate-700/60'}`}>
            {/* Marques de la brúixola decoratives amb alt contrast */}
            <div className={`absolute top-1 md:top-1.5 text-[8px] md:text-[9px] font-black transition-colors duration-500 ${isValidDir ? 'text-slate-400' : 'text-slate-600'}`}>N</div>
            <div className={`absolute bottom-1 md:bottom-1.5 text-[8px] md:text-[9px] font-black transition-colors duration-500 ${isValidDir ? 'text-slate-400' : 'text-slate-600'}`}>S</div>
            
            {isValidDir && windDirection !== null && windDirection !== undefined ? (
              <Navigation 
                className="w-5 h-5 md:w-6 md:h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] transition-transform duration-1000 ease-out z-10 relative" 
                style={{ transform: `rotate(${windDirection}deg)` }}
              />
            ) : (
              <span className="text-slate-500 font-mono text-sm sm:text-base font-bold z-10 relative">--</span>
            )}
          </div>
          <span className={`text-[11px] sm:text-xs font-black tracking-widest px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border transition-colors duration-500 drop-shadow-sm ${isValidDir ? 'text-white bg-white/10 border-white/10' : 'text-slate-400 bg-[#1a1d27]/50 border-slate-700/60'}`}>
            {getCardinal(windDirection)}
          </span>
        </div>
      </div>

      {/* MÈTRIQUES SECUNDÀRIES: Humitat i Sensació en dues columnes */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        
        {/* HUMITAT */}
        <div className={`${BASE_CARD} p-4 sm:p-5 rounded-2xl md:rounded-[20px] flex flex-col group ${isValidHum ? 'from-[#0B0D14]/95 to-black/90 border-white/10 hover:border-white/20' : 'from-[#1a1d27]/90 to-black/80 border-slate-700/60'}`}>
          <div className={MATRIX_BG}></div>
          <div className="flex items-center gap-2 mb-2 sm:mb-3 z-10 relative">
            {isValidHum ? (
              <Droplets className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)] transition-colors" />
            ) : (
              <CloudOff className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            )}
            <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-500 drop-shadow-sm ${isValidHum ? 'text-slate-200' : 'text-slate-400'}`}>
              {t.humidity}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-auto z-10 relative">
            <span className={`text-2xl sm:text-3xl md:text-4xl font-mono font-bold tabular-nums tracking-tight transition-colors duration-500 drop-shadow-lg ${isValidHum ? 'text-white' : 'text-slate-500'}`}>
              {formatValue(humidity, isValidHum)}
            </span>
            <span className={`text-xs sm:text-sm font-bold transition-colors duration-500 ${isValidHum ? 'text-slate-400' : 'text-slate-500'}`}>%</span>
          </div>
        </div>

        {/* SENSACIÓ TÈRMICA */}
        <div className={`${BASE_CARD} p-4 sm:p-5 rounded-2xl md:rounded-[20px] flex flex-col group ${isValidTemp ? 'from-[#0B0D14]/95 to-black/90 border-white/10 hover:border-white/20' : 'from-[#1a1d27]/90 to-black/80 border-slate-700/60'}`}>
          <div className={MATRIX_BG}></div>
          <div className="flex items-center gap-2 mb-2 sm:mb-3 z-10 relative">
            {isValidTemp ? (
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.5)] transition-colors" />
            ) : (
              <CloudOff className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            )}
            <span className={`text-[11px] sm:text-xs font-black uppercase tracking-widest transition-colors duration-500 drop-shadow-sm ${isValidTemp ? 'text-slate-200' : 'text-slate-400'}`}>
              {t.feelsLike}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-auto z-10 relative">
            <span className={`text-2xl sm:text-3xl md:text-4xl font-mono font-bold tabular-nums tracking-tight transition-colors duration-500 drop-shadow-lg ${isValidTemp ? 'text-white' : 'text-slate-500'}`}>
              {formatValue(apparentTemp, isValidTemp)}
            </span>
            <span className={`text-xs sm:text-sm font-bold transition-colors duration-500 ${isValidTemp ? 'text-slate-400' : 'text-slate-500'}`}>°</span>
          </div>
        </div>

      </div>
    </div>
  );
};