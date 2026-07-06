// src/components/current-weather/WeatherStatsGrid.tsx
import { Droplets, Activity, Navigation, Wind } from 'lucide-react';
import { Language } from '../../translations';

interface WeatherStatsGridProps {
  windSpeed: number | null;
  windGusts?: number | null;
  windDirection?: number | null; // DOCTRINA RISC ZERO: Direcció en graus (0-360)
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
}

// DOCTRINA RISC ZERO: Diccionari intern per garantir la disponibilitat immediata dels textos
const gridTranslations: Record<string, GridTranslation> = {
  ca: {
    windDynamics: "Dinàmica de Vent",
    gusts: "RATXES",
    humidity: "Humitat",
    feelsLike: "Sensació",
    cardinals: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  },
  es: {
    windDynamics: "Dinámica de Viento",
    gusts: "RACHAS",
    humidity: "Humedad",
    feelsLike: "Sensación",
    cardinals: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  },
  en: {
    windDynamics: "Wind Dynamics",
    gusts: "GUSTS",
    humidity: "Humidity",
    feelsLike: "Feels Like",
    cardinals: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] 
  },
  fr: {
    windDynamics: "Dynamique du Vent",
    gusts: "RAFALES",
    humidity: "Humidité",
    feelsLike: "Ressenti",
    cardinals: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  }
};

export const WeatherStatsGrid = ({ windSpeed, windGusts, windDirection, humidity, apparentTemp, lang = 'ca' }: WeatherStatsGridProps) => {
  // Garantim un fallback segur si s'introdueix un idioma no mapejat
  const safeLang = gridTranslations[lang] ? lang : 'ca';
  const t = gridTranslations[safeLang];

  // DOCTRINA RISC ZERO: Escut visual per a valors nuls
  const formatValue = (val: number | null | undefined) => {
    return val !== null && val !== undefined ? val : '--';
  };

  // Funció auxiliar segura per traduir graus a punts cardinals localitzats
  const getCardinal = (angle: number | null | undefined) => {
    if (angle === null || angle === undefined) return '--';
    // Protecció matemàtica per mantenir els graus entre 0 i 360
    const normalizedAngle = ((angle %= 360) < 0 ? angle + 360 : angle);
    const index = Math.round(normalizedAngle / 45) % 8;
    return t.cardinals[index];
  };

  return (
    <div className="flex flex-col gap-3 relative z-10 w-full">
      {/* MÒDUL DE VENT TÀCTIC: Ocupa tota l'amplada per màxima llegibilitat */}
      <div className="flex items-center justify-between p-4 md:p-5 rounded-2xl bg-gradient-to-br from-[#151725] to-[#0d0f18] border border-white/5 hover:border-white/10 transition-colors shadow-lg group">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <Wind className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t.windDynamics}</span>
          </div>
          
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-white tabular-nums tracking-tight drop-shadow-md">
              {formatValue(windSpeed)}
            </span>
            <span className="text-xs text-slate-400 font-bold uppercase ml-1">km/h</span>
          </div>
          
          <div className="text-[11px] font-mono font-medium text-slate-500 mt-1 uppercase">
            {t.gusts}: <span className="text-indigo-300 font-bold tabular-nums">{formatValue(windGusts)}</span> km/h
          </div>
        </div>

        {/* Brúixola Digital i Direcció */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#0B0C15] border border-white/5 shadow-inner">
            {/* Marques de la brúixola decoratives (N/S es mantenen universals en aquest estil visual reduït) */}
            <div className="absolute top-1 text-[7px] font-black text-slate-600">N</div>
            <div className="absolute bottom-1 text-[7px] font-black text-slate-600">S</div>
            
            {windDirection !== null && windDirection !== undefined ? (
              <Navigation 
                className="w-5 h-5 md:w-6 md:h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] transition-transform duration-1000 ease-out" 
                style={{ transform: `rotate(${windDirection}deg)` }}
              />
            ) : (
              <span className="text-slate-500 font-mono text-sm">--</span>
            )}
          </div>
          <span className="text-[10px] font-black text-white tracking-widest bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
            {getCardinal(windDirection)}
          </span>
        </div>
      </div>

      {/* MÈTRIQUES SECUNDÀRIES: Humitat i Sensació en dues columnes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col p-4 rounded-2xl bg-[#151725] border border-white/5 hover:border-white/10 transition-colors group">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t.humidity}</span>
          </div>
          <div className="flex items-baseline gap-1 mt-auto">
            <span className="text-2xl font-mono font-bold text-white tabular-nums tracking-tight">{formatValue(humidity)}</span>
            <span className="text-sm text-slate-400">%</span>
          </div>
        </div>

        <div className="flex flex-col p-4 rounded-2xl bg-[#151725] border border-white/5 hover:border-white/10 transition-colors group">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-slate-400 group-hover:text-rose-400 transition-colors" />
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t.feelsLike}</span>
          </div>
          <div className="flex items-baseline gap-1 mt-auto">
            <span className="text-2xl font-mono font-bold text-white tabular-nums tracking-tight">{formatValue(apparentTemp)}</span>
            <span className="text-sm text-slate-400">°</span>
          </div>
        </div>
      </div>
    </div>
  );
};