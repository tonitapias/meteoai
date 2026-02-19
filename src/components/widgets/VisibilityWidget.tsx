import { Eye, Mountain } from 'lucide-react';
import { VisibilityWidgetProps } from './widgetTypes';

export const VisibilityWidget = ({ visibility, lang }: VisibilityWidgetProps) => {
  const hasData = visibility !== null && visibility !== undefined;
  // 1. Convertim a KM i assegurem que no hi hagi decimals innecessaris
  const visibilityKm = hasData ? (visibility / 1000).toFixed(1).replace('.0', '') : '--';
  
  // 2. Lògica d'estat visual
  let status = "";
  let blurClass = "";
  let colorClass = "";
  let progress = 0;

  const safeVis = visibility ?? 0;

  if (safeVis >= 10000) {
    status = lang === 'ca' ? "Excel·lent" : "Excellent";
    blurClass = "blur-none"; 
    colorClass = "text-emerald-400";
    progress = 100;
  } else if (safeVis >= 5000) {
    status = lang === 'ca' ? "Bona" : "Good";
    blurClass = "blur-[0.5px]"; 
    colorClass = "text-blue-400";
    progress = 75;
  } else if (safeVis >= 2000) {
    status = lang === 'ca' ? "Calitja" : "Haze";
    blurClass = "backdrop-blur-[1px]"; 
    colorClass = "text-yellow-400";
    progress = 40;
  } else {
    status = lang === 'ca' ? "Boira" : "Fog";
    blurClass = "backdrop-blur-[3px]"; 
    colorClass = "text-rose-400";
    progress = 15;
  }

  return (
    <div className="relative flex flex-col items-center justify-between p-4 h-full w-full bg-slate-900/40 rounded-3xl border border-white/10 overflow-hidden shadow-sm group select-none">
      
      {/* CAPÇALERA */}
      <div className="flex items-center gap-2 self-start mb-1 z-20">
        <Eye className="w-4 h-4 text-indigo-300" />
        <span className="text-[10px] sm:text-xs font-bold text-indigo-200 uppercase tracking-widest opacity-80">
          {lang === 'ca' ? "Visibilitat" : "Visibility"}
        </span>
      </div>

      {/* DADA PRINCIPAL */}
      <div className="relative z-20 flex flex-col items-center mt-1">
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl sm:text-3xl font-black ${colorClass} drop-shadow-md tracking-tight`}>
            {visibilityKm}
          </span>
          <span className="text-xs font-bold text-slate-500 uppercase">km</span>
        </div>
        <span className="text-[10px] sm:text-xs font-medium text-slate-300/90 mt-0.5 tracking-wide px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
            {status}
        </span>
      </div>

      {/* EFECTE VISUAL (MUNTANYA + ESTAT) */}
      <div className={`absolute -bottom-2 -right-2 opacity-10 transition-all duration-1000 group-hover:opacity-20 ${blurClass} pointer-events-none`}>
        <Mountain className="w-20 h-20 sm:w-24 sm:h-24 text-white" />
      </div>
      
      {/* BARRA DE PROGRÉS */}
      <div className="w-full h-1.5 bg-slate-800/50 rounded-full mt-3 overflow-hidden z-20 border border-white/5">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass.replace('text-', 'bg-')}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};