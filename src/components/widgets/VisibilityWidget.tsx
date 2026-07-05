import { Eye, Mountain } from 'lucide-react';
import { VisibilityWidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';

export const VisibilityWidget = ({ visibility, lang }: VisibilityWidgetProps) => {
  // Risc zero numèric
  const hasData = typeof visibility === 'number' && !isNaN(visibility);
  const visibilityKm = hasData ? (visibility / 1000).toFixed(1).replace('.0', '') : '--';
  
  // Lògica d'estat visual
  let status = "";
  let blurClass = "";
  let colorClass = "";
  let progress = 0;

  const safeVis = hasData ? visibility : 0;

  if (safeVis >= 10000) {
    status = lang === 'ca' ? "Excel·lent" : "Excellent";
    blurClass = "blur-none"; 
    colorClass = "text-emerald-400";
    progress = 100;
  } else if (safeVis >= 5000) {
    status = lang === 'ca' ? "Bona" : "Good";
    blurClass = "blur-[0.5px]"; 
    colorClass = "text-sky-400";
    progress = 75;
  } else if (safeVis >= 2000) {
    status = lang === 'ca' ? "Calitja" : "Haze";
    blurClass = "backdrop-blur-[2px]"; 
    colorClass = "text-amber-400";
    progress = 40;
  } else {
    status = lang === 'ca' ? "Boira" : "Fog";
    blurClass = "backdrop-blur-[4px]"; 
    colorClass = "text-rose-400";
    progress = 15;
  }

  // Adoptem la constant WIDGET_BASE_STYLE per unificar l'arquitectura amb la resta
  const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 flex flex-col justify-between group select-none`;

  return (
    <div className={SPATIAL_WIDGET_STYLE}>
      
      {/* CAPÇALERA */}
      <div className={`${TITLE_STYLE.replace('mb-4', 'mb-1')} flex items-center gap-1.5 z-20`}>
        <Eye className="w-4 h-4 text-indigo-300 drop-shadow-[0_0_8px_rgba(165,180,252,0.5)]" />
        <span className="tracking-wider">
          {lang === 'ca' ? "VISIBILITAT" : "VISIBILITY"}
        </span>
      </div>

      {/* DADA PRINCIPAL */}
      <div className="relative z-20 flex flex-col items-center mt-2 bg-black/20 py-3 rounded-xl border border-white/5 backdrop-blur-sm flex-1 justify-center">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-4xl sm:text-5xl font-black ${colorClass} drop-shadow-[0_0_12px_currentColor] tracking-tighter leading-none`}>
            {visibilityKm}
          </span>
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">km</span>
        </div>
        <span className={`text-[10px] sm:text-xs font-black uppercase mt-2 tracking-widest px-3 py-1 rounded-md bg-[#0f111a] border border-white/10 shadow-inner ${colorClass} opacity-90`}>
            {status}
        </span>
      </div>

      {/* EFECTE VISUAL (MUNTANYA AMB BOIRA DINÀMICA) */}
      <div className={`absolute bottom-3 right-3 opacity-[0.15] transition-all duration-1000 group-hover:opacity-25 ${blurClass} pointer-events-none`}>
        <Mountain className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
      </div>
      
      {/* BARRA DE PROGRÉS TÀCTICA */}
      <div className="w-full h-1.5 bg-[#0f111a] rounded-full mt-3 overflow-hidden z-20 border border-white/5 shadow-inner">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass.replace('text-', 'bg-')} shadow-[0_0_8px_currentColor]`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};