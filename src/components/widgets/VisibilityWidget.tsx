import { Eye, Mountain, CloudOff } from 'lucide-react';
import { VisibilityWidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';

// Diccionari Tàctic Local per a Risc Zero
const VIS_TRANS = {
  ca: { title: "VISIBILITAT", excellent: "Excel·lent", good: "Bona", haze: "Calitja", fog: "Boira", nodata: "SENSE DADES" },
  en: { title: "VISIBILITY", excellent: "Excellent", good: "Good", haze: "Haze", fog: "Fog", nodata: "NO DATA" },
  es: { title: "VISIBILIDAD", excellent: "Excelente", good: "Buena", haze: "Calima", fog: "Niebla", nodata: "SIN DATOS" },
  fr: { title: "VISIBILITÉ", excellent: "Excellente", good: "Bonne", haze: "Brumes", fog: "Brouillard", nodata: "PAS DE DONNÉES" }
};

export const VisibilityWidget = ({ visibility, lang = 'ca' }: VisibilityWidgetProps) => {
  // DOCTRINA RISC ZERO: Resolució d'idioma estricta i sense 'any'
  const safeLang = (lang && VIS_TRANS[lang as keyof typeof VIS_TRANS]) ? (lang as keyof typeof VIS_TRANS) : 'ca';
  const t = VIS_TRANS[safeLang];

  // Risc Zero: Diferenciar estricament 0 metres de "pèrdua de senyal"
  const hasValidData = typeof visibility === 'number' && !isNaN(visibility);
  const safeVis = hasValidData ? Math.max(0, visibility) : 0;
  const visibilityKm = hasValidData ? (safeVis / 1000).toFixed(1).replace('.0', '') : '--';
  
  // Lògica d'estat visual
  let status = t.nodata;
  let blurClass = "opacity-20"; 
  let colorClass = "text-slate-500";
  let progress = 0;
  let bgGlow = "from-slate-900/50 to-black/80";
  let borderColor = "border-slate-700/50";

  if (hasValidData) {
    if (safeVis >= 10000) {
      status = t.excellent;
      blurClass = "blur-none opacity-20"; 
      colorClass = "text-emerald-400";
      progress = 100;
      bgGlow = "from-emerald-950/10 to-black/80";
      borderColor = "border-emerald-500/20";
    } else if (safeVis >= 5000) {
      status = t.good;
      blurClass = "blur-[1px] opacity-30"; 
      colorClass = "text-sky-400";
      progress = 75;
      bgGlow = "from-sky-950/20 to-black/80";
      borderColor = "border-sky-500/20";
    } else if (safeVis >= 2000) {
      status = t.haze;
      blurClass = "blur-[2px] opacity-40"; 
      colorClass = "text-amber-400";
      progress = 40;
      bgGlow = "from-amber-950/20 to-black/80";
      borderColor = "border-amber-500/20";
    } else {
      status = t.fog;
      blurClass = "blur-[4px] opacity-60"; 
      colorClass = "text-rose-500";
      progress = 15; // Un mínim visual de barra per ubicar l'indicador
      bgGlow = "from-rose-950/20 to-black/80";
      borderColor = "border-rose-500/30";
    }
  }

  // SPATIAL UI BASE AMB MATRIU DE FONS
  const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} relative overflow-hidden backdrop-blur-md bg-gradient-to-br transition-colors duration-700 ${bgGlow} border ${hasValidData ? borderColor : 'border-slate-700/50'} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu p-3 sm:p-4 flex flex-col justify-between select-none`;
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  return (
    <div className={SPATIAL_WIDGET_STYLE}>
      {/* Matriu Tàctica */}
      <div className={MATRIX_BG}></div>
      
      {/* CAPÇALERA */}
      <div className={`${TITLE_STYLE.replace('mb-4', 'mb-1')} flex items-center gap-1.5 z-20 relative`}>
        {hasValidData ? (
            <Eye className="w-4 h-4 text-indigo-300 drop-shadow-[0_0_8px_rgba(165,180,252,0.5)] transition-colors duration-500" />
        ) : (
            <CloudOff className="w-4 h-4 text-slate-500" />
        )}
        <span className="tracking-wider text-slate-200">
          {t.title}
        </span>
      </div>

      {/* DADA PRINCIPAL */}
      <div className={`relative z-20 flex flex-col items-center mt-2 py-3 rounded-xl border backdrop-blur-sm flex-1 justify-center transition-colors duration-500 ${hasValidData ? 'bg-black/40 border-white/5' : 'bg-slate-900/40 border-slate-700/50'}`}>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-4xl sm:text-5xl font-black tabular-nums tracking-tighter leading-none transition-colors duration-500 ${hasValidData ? colorClass + ' drop-shadow-[0_0_12px_currentColor]' : 'text-slate-600'}`}>
            {visibilityKm}
          </span>
          <span className={`text-xs font-black uppercase tracking-widest transition-colors duration-500 ${hasValidData ? 'text-slate-400' : 'text-slate-600'}`}>km</span>
        </div>
        
        <div className={`mt-2 flex items-center justify-center px-3 py-1 rounded-md border shadow-inner transition-colors duration-500 ${hasValidData ? 'bg-[#0f111a] border-white/10 ' + colorClass : 'bg-slate-800/50 border-slate-700/50 text-slate-500'}`}>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-90">
                {status}
            </span>
        </div>
      </div>

      {/* EFECTE VISUAL (MUNTANYA AMB BOIRA DINÀMICA) */}
      <div className="absolute bottom-3 right-3 pointer-events-none z-10">
        <Mountain className={`w-16 h-16 sm:w-20 sm:h-20 transition-all duration-1000 ${hasValidData ? 'text-slate-300' : 'text-slate-600'} ${blurClass}`} />
      </div>
      
      {/* BARRA DE PROGRÉS TÀCTICA */}
      <div className={`w-full h-1.5 rounded-full mt-3 overflow-hidden z-20 border shadow-inner relative transition-colors duration-500 ${hasValidData ? 'bg-[#0f111a] border-white/5' : 'bg-slate-900/50 border-slate-800'}`}>
        
        {/* Marques de calibratge absolutes (Ticks) */}
        <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute h-full w-px bg-white/20" style={{ left: '15%' }}></div>
            <div className="absolute h-full w-px bg-white/20" style={{ left: '40%' }}></div>
            <div className="absolute h-full w-px bg-white/20" style={{ left: '75%' }}></div>
        </div>

        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${hasValidData ? colorClass.replace('text-', 'bg-') + ' shadow-[0_0_8px_currentColor]' : 'bg-transparent'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};