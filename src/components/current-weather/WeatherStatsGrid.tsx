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

  // SPATIAL UI BASE
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;
  const BASE_CARD = "relative overflow-hidden backdrop-blur-md bg-gradient-to-br border shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu transition-colors duration-700";

  return (
    <div className="flex flex-col gap-3 relative z-10 w-full">
      
      {/* MÒDUL DE VENT TÀCTIC */}
      <div className={`${BASE_CARD} p-4 md:p-5 rounded-2xl flex items-center justify-between group ${isValidWind ? 'from-[#0f111a]/90 to-black/80 border-white/5 hover:border-white/10' : 'from-slate-900/50 to-black/80 border-slate-700/50'}`}>
        <div className={MATRIX_BG}></div>
        
        <div className="flex flex-col gap-1 z-10 relative">
          <div className="flex items-center gap-2 mb-1">
            {isValidWind ? (
              <Wind className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)] transition-colors" />
            ) : (
              <CloudOff className="w-4 h-4 text-slate-500" />
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${isValidWind ? 'text-slate-300' : 'text-slate-500'}`}>
              {t.windDynamics}
            </span>
          </div>
          
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl sm:text-4xl font-mono font-bold tabular-nums tracking-tight transition-colors duration-500 ${isValidWind ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
              {formatValue(windSpeed, isValidWind)}
            </span>
            <span className={`text-xs font-bold uppercase ml-1 transition-colors duration-500 ${isValidWind ? 'text-slate-400' : 'text-slate-600'}`}>km/h</span>
          </div>
          
          <div className={`text-[11px] font-mono font-medium mt-1 uppercase transition-colors duration-500 ${isValidWind ? 'text-slate-500' : 'text-slate-600'}`}>
            {t.gusts}: <span className={`font-bold tabular-nums ${isValidGusts ? 'text-indigo-300' : 'text-slate-600'}`}>
              {formatValue(windGusts, isValidGusts)}
            </span> km/h
          </div>
        </div>

        {/* Brúixola Digital i Direcció */}
        <div className="flex flex-col items-center gap-2 z-10 relative">
          <div className={`relative flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full border shadow-inner transition-colors duration-500 ${isValidDir ? 'bg-[#0B0C15] border-white/10' : 'bg-slate-900/50 border-slate-700/50'}`}>
            {/* Marques de la brúixola decoratives */}
            <div className={`absolute top-1 text-[7px] font-black transition-colors duration-500 ${isValidDir ? 'text-slate-500' : 'text-slate-700'}`}>N</div>
            <div className={`absolute bottom-1 text-[7px] font-black transition-colors duration-500 ${isValidDir ? 'text-slate-500' : 'text-slate-700'}`}>S</div>
            
            {isValidDir && windDirection !== null && windDirection !== undefined ? (
              <Navigation 
                className="w-5 h-5 md:w-6 md:h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] transition-transform duration-1000 ease-out z-10 relative" 
                style={{ transform: `rotate(${windDirection}deg)` }}
              />
            ) : (
              <span className="text-slate-600 font-mono text-sm z-10 relative">--</span>
            )}
          </div>
          <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded-md border transition-colors duration-500 ${isValidDir ? 'text-white bg-white/5 border-white/5' : 'text-slate-600 bg-transparent border-slate-700/50'}`}>
            {getCardinal(windDirection)}
          </span>
        </div>
      </div>

      {/* MÈTRIQUES SECUNDÀRIES: Humitat i Sensació en dues columnes */}
      <div className="grid grid-cols-2 gap-3">
        
        {/* HUMITAT */}
        <div className={`${BASE_CARD} p-4 rounded-2xl flex flex-col group ${isValidHum ? 'from-[#0f111a]/90 to-black/80 border-white/5 hover:border-white/10' : 'from-slate-900/50 to-black/80 border-slate-700/50'}`}>
          <div className={MATRIX_BG}></div>
          <div className="flex items-center gap-2 mb-2 z-10 relative">
            {isValidHum ? (
              <Droplets className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)] transition-colors" />
            ) : (
              <CloudOff className="w-4 h-4 text-slate-500" />
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${isValidHum ? 'text-slate-300' : 'text-slate-500'}`}>
              {t.humidity}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-auto z-10 relative">
            <span className={`text-2xl font-mono font-bold tabular-nums tracking-tight transition-colors duration-500 ${isValidHum ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
              {formatValue(humidity, isValidHum)}
            </span>
            <span className={`text-sm transition-colors duration-500 ${isValidHum ? 'text-slate-400' : 'text-slate-600'}`}>%</span>
          </div>
        </div>

        {/* SENSACIÓ TÈRMICA */}
        <div className={`${BASE_CARD} p-4 rounded-2xl flex flex-col group ${isValidTemp ? 'from-[#0f111a]/90 to-black/80 border-white/5 hover:border-white/10' : 'from-slate-900/50 to-black/80 border-slate-700/50'}`}>
          <div className={MATRIX_BG}></div>
          <div className="flex items-center gap-2 mb-2 z-10 relative">
            {isValidTemp ? (
              <Activity className="w-4 h-4 text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.5)] transition-colors" />
            ) : (
              <CloudOff className="w-4 h-4 text-slate-500" />
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${isValidTemp ? 'text-slate-300' : 'text-slate-500'}`}>
              {t.feelsLike}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-auto z-10 relative">
            <span className={`text-2xl font-mono font-bold tabular-nums tracking-tight transition-colors duration-500 ${isValidTemp ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
              {formatValue(apparentTemp, isValidTemp)}
            </span>
            <span className={`text-sm transition-colors duration-500 ${isValidTemp ? 'text-slate-400' : 'text-slate-600'}`}>°</span>
          </div>
        </div>

      </div>
    </div>
  );
};