import { Navigation, Zap, Mountain, MapPinOff } from 'lucide-react';

interface CurrentWeatherHeaderProps {
  locationName?: string;
  country?: string;
  time?: string;
  date?: string;
  isUsingArome: boolean;
  elevation?: number | null; 
}

export const CurrentWeatherHeader = ({
  locationName,
  country,
  time,
  date,
  isUsingArome,
  elevation,
}: CurrentWeatherHeaderProps) => {
  
  // DOCTRINA RISC ZERO: Validació estricta i fallbacks absoluts
  const isValidElevation = typeof elevation === 'number' && !isNaN(elevation);
  const safeElevation = isValidElevation ? Math.round(elevation) : '--';
  const safeLocation = locationName && locationName.trim() !== '' ? locationName : 'UBICACIÓ DESCONEGUDA';
  const safeCountry = country && country.trim() !== '' ? country : '--';
  const safeTime = time || '--:--';
  const safeDate = date || '--/--/----';

  return (
    <div className="flex justify-between items-start w-full relative z-10">
      <div className="flex flex-col gap-1 w-full">
        
        {/* Badges Superiors (Spatial UI) */}
        <div className="flex items-center gap-3 mb-1">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border backdrop-blur-md shadow-[inset_0_1px_4px_rgba(255,255,255,0.1)] transition-colors duration-500 ${safeCountry !== '--' ? 'bg-[#0f111a]/80 border-white/10' : 'bg-slate-900/50 border-slate-700/50'}`}>
            {safeCountry !== '--' ? (
                <Navigation className="w-3 h-3 text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
            ) : (
                <MapPinOff className="w-3 h-3 text-slate-500" />
            )}
            <span className={`text-[9px] font-mono font-black tracking-widest uppercase transition-colors duration-500 ${safeCountry !== '--' ? 'text-indigo-200' : 'text-slate-500'}`}>
              {safeCountry}
            </span>
          </div>
          
          {isUsingArome && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 shadow-[inset_0_1px_4px_rgba(16,185,129,0.2)] text-[9px] font-mono font-black text-emerald-400 tracking-widest uppercase transition-all duration-300">
              <Zap className="w-3 h-3 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> AROME HD
            </span>
          )}
        </div>

        {/* Títol / Nom de la ubicació */}
        <h2 className={`text-4xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9] drop-shadow-xl break-words mt-1 transition-colors duration-700 ${safeLocation !== 'UBICACIÓ DESCONEGUDA' ? 'text-white' : 'text-slate-500'}`}>
          {safeLocation}
        </h2>

        {/* Dades Temporals i Telemetria */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3">
          <span className={`text-2xl font-mono font-medium tracking-tight transition-colors duration-500 ${safeTime !== '--:--' ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
            {safeTime}
          </span>
          
          <div className={`h-4 w-px transition-colors duration-500 ${safeTime !== '--:--' || safeDate !== '--/--/----' ? 'bg-white/10' : 'bg-slate-800'}`}></div>
          
          <span className={`text-sm font-bold uppercase tracking-wider transition-colors duration-500 ${safeDate !== '--/--/----' ? 'text-slate-400' : 'text-slate-600'}`}>
            {safeDate}
          </span>
          
          <div className={`h-4 w-px transition-colors duration-500 ${safeDate !== '--/--/----' || isValidElevation ? 'bg-white/10' : 'bg-slate-800'}`}></div>
          
          <div className={`flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider transition-colors duration-500 ${isValidElevation ? 'text-slate-400' : 'text-slate-600'}`} title="Altitud">
            <Mountain className={`w-4 h-4 transition-colors duration-500 ${isValidElevation ? 'text-slate-500' : 'text-slate-700'}`} />
            <span className="tabular-nums">{safeElevation}{isValidElevation ? 'm' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};