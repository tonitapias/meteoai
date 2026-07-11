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
  showAromeBtn = false, // DOCTRINA RISC ZERO: Valor per defecte segur
  isFavorite,
  onToggleFavorite,
}: WeatherActionButtonsProps) => {
  
  // SPATIAL UI: Classes base per crear l'efecte de botó físic de panell de control
  const BUTTON_BASE = "relative overflow-hidden flex-1 py-3 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 shadow-[inset_0_1px_4px_rgba(255,255,255,0.1)] group";
  const MATRIX_BG = "absolute inset-0 z-0 opacity-[0.05] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:8px_8px]";

  return (
    <div className="flex gap-2 pt-2 relative z-10 w-full">
      
      {/* BOTÓ RADAR */}
      <button
        onClick={onShowRadar}
        className={`${BUTTON_BASE} bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 hover:text-indigo-100 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]`}
      >
        <div className={MATRIX_BG}></div>
        <Map className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]" /> 
        <span className="relative z-10">RADAR</span>
      </button>

      {/* BOTÓ AROME HD (Model Localitzat) */}
      {showAromeBtn && (
        <button
          onClick={onShowArome}
          className={`${BUTTON_BASE} bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-100 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]`}
        >
          <div className={MATRIX_BG}></div>
          <Zap className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" /> 
          <span className="relative z-10">AROME HD</span>
        </button>
      )}

      {/* BOTÓ FAVORITS (Corregit per ser Mobile First: ja no s'amaga a mòbils) */}
      <button
        onClick={onToggleFavorite}
        className="relative overflow-hidden flex items-center justify-center p-3 bg-[#0a0b10]/80 hover:bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-slate-400 hover:text-amber-400 transition-all duration-300 active:scale-95 shadow-[inset_0_1px_4px_rgba(255,255,255,0.05)] w-[52px] flex-shrink-0 group"
        aria-label={isFavorite ? 'Eliminar de favorits' : 'Afegir a favorits'}
      >
        <div className={MATRIX_BG}></div>
        <Star className={`relative z-10 w-5 h-5 transition-all duration-500 ${isFavorite ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'group-hover:scale-110'}`} />
      </button>
      
    </div>
  );
};