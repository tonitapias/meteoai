import { Navigation, Zap, Star, Mountain } from 'lucide-react';

interface CurrentWeatherHeaderProps {
  locationName?: string; // Solució: Acceptem undefined de forma segura
  country: string;
  time: string;
  date: string;
  isUsingArome: boolean;
  isFavorite: boolean;
  elevation?: number | null; // DOCTRINA RISC ZERO: Altitud opcional per evitar trencar el render
  onToggleFavorite: () => void;
}

export const CurrentWeatherHeader = ({
  locationName,
  country,
  time,
  date,
  isUsingArome,
  isFavorite,
  elevation,
  onToggleFavorite,
}: CurrentWeatherHeaderProps) => {
  
  // DOCTRINA RISC ZERO: Blindatge per a la mètrica d'altitud.
  const formatElevation = (val?: number | null) => {
    return val != null ? val : '--';
  };

  return (
    <div className="flex justify-between items-start">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10">
            <Navigation className="w-3 h-3 text-indigo-400" />
            <span className="text-[9px] font-mono font-bold text-indigo-200 tracking-widest uppercase">
              {country}
            </span>
          </div>
          {isUsingArome && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono font-bold text-emerald-400 tracking-widest uppercase">
              <Zap className="w-2.5 h-2.5" /> AROME HD
            </span>
          )}
        </div>

        <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-[0.9] drop-shadow-lg break-words">
          {locationName}
        </h2>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-2">
          <span className="text-2xl font-mono font-medium text-white tracking-tight">
            {time}
          </span>
          <div className="h-4 w-px bg-white/10"></div>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            {date}
          </span>
          <div className="h-4 w-px bg-white/10"></div>
          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-400 uppercase tracking-wider" title="Altitud">
            <Mountain className="w-4 h-4 text-slate-500" />
            <span className="tabular-nums">{formatElevation(elevation)}m</span>
          </div>
        </div>
      </div>

      <button
        onClick={onToggleFavorite}
        className="md:hidden p-3 bg-white/5 rounded-xl text-slate-400 hover:text-amber-400"
        aria-label={isFavorite ? 'Eliminar de favorits' : 'Afegir a favorits'}
      >
        <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
      </button>
    </div>
  );
};