import { Map, Zap, Star } from 'lucide-react';

interface WeatherActionButtonsProps {
  onShowRadar: () => void;
  onShowArome: () => void;
  showAromeBtn?: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const WeatherActionButtons = ({
  onShowRadar,
  onShowArome,
  showAromeBtn,
  isFavorite,
  onToggleFavorite,
}: WeatherActionButtonsProps) => {
  return (
    <div className="flex gap-2 pt-2 relative z-10">
      <button
        onClick={onShowRadar}
        className="flex-1 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-200 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-95"
      >
        <Map className="w-3.5 h-3.5" /> RADAR
      </button>

      {showAromeBtn && (
        <button
          onClick={onShowArome}
          className="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95"
        >
          <Zap className="w-3.5 h-3.5" /> AROME HD
        </button>
      )}

      <button
        onClick={onToggleFavorite}
        className="hidden md:flex p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-slate-400 hover:text-amber-400 transition-colors"
        aria-label={isFavorite ? 'Eliminar de favorits' : 'Afegir a favorits'}
      >
        <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
      </button>
    </div>
  );
};