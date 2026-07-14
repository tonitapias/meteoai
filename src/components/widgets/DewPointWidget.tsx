// src/components/DewPointWidget.tsx
import { Droplets, CloudOff, AlertTriangle } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans } from './widgetHelpers';

export const DewPointWidget = ({ value, humidity, lang }: WidgetProps) => {
    // DOCTRINA RISC ZERO: Extracció tipada
    const t = getTrans(lang) as Record<string, unknown>;
    const tDew = typeof t.dewPoint === 'string' ? t.dewPoint : "PUNT DE ROSADA";
    
    // Risc Zero: Validació dual estricta. L'API pot lliurar un valor i fallar en l'altre.
    const hasValue = typeof value === 'number' && !isNaN(value);
    const hasHumidity = typeof humidity === 'number' && !isNaN(humidity);
    const hasData = hasValue && hasHumidity;
    
    // Fallback visual tàctic explícit per absència de telemetria
    const displayVal = hasValue ? Math.round(value) : '--';
    const displayHum = hasHumidity ? Math.round(humidity) : '--';
    
    // Si no hi ha dades, no assumim un fals 0°C per a la barra visual
    const safeValue = hasValue ? value : 0;
    
    // Escala tàctica d'alta muntanya: de -20°C a +30°C (Rang = 50)
    const MIN_DP = -20;
    const MAX_DP = 30;
    const range = MAX_DP - MIN_DP;
    
    // Evitem percentatges negatius o superiors al 100% que trencarien el CSS DOM
    const barWidth = hasData ? Math.max(0, Math.min(((safeValue - MIN_DP) / range) * 100, 100)) : 0;

    // Colors tàctics segons risc (Glaçada, Confort, Xafogor extrema)
    let barColor = 'bg-slate-700/50'; 
    let shadowColor = 'shadow-none';
    let borderColor = 'border-slate-700/50';
    let bgGlow = 'from-slate-900/50 to-black/80';
    
    if (hasData) {
        if (safeValue > 20) {
            barColor = 'bg-rose-500';
            shadowColor = 'shadow-[0_0_8px_rgba(244,63,94,0.8)]';
            borderColor = 'border-rose-500/20';
            bgGlow = 'from-rose-950/20 to-black/80';
        } else if (safeValue > 15) {
            barColor = 'bg-amber-400';
            shadowColor = 'shadow-[0_0_8px_rgba(251,191,36,0.8)]';
            borderColor = 'border-amber-400/20';
            bgGlow = 'from-amber-950/20 to-black/80';
        } else if (safeValue < 0) {
            barColor = 'bg-cyan-400';
            shadowColor = 'shadow-[0_0_8px_rgba(34,211,238,0.8)]';
            borderColor = 'border-cyan-400/20';
            bgGlow = 'from-cyan-950/20 to-black/80';
        } else {
            barColor = 'bg-emerald-400';
            shadowColor = 'shadow-[0_0_8px_rgba(52,211,153,0.8)]';
            borderColor = 'border-emerald-500/20';
            bgGlow = 'from-emerald-950/10 to-black/80';
        }
    }

    // SPATIAL UI BASE AMB MATRIU DE FONS
    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br transition-colors duration-700 ${hasData ? bgGlow : 'from-slate-900/40 to-black/80'} border ${hasData ? borderColor : 'border-slate-700/50'} shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu flex flex-col justify-between p-3 sm:p-4 relative overflow-hidden`;
    const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

    return (
      <div className={SPATIAL_WIDGET_STYLE}>
          {/* Capa de fons espacial */}
          <div className={MATRIX_BG}></div>
          <div className={`absolute top-0 left-0 w-24 h-24 rounded-full blur-3xl pointer-events-none z-0 transition-colors duration-700 ${hasData ? barColor.replace('bg-', 'bg-').replace('/50', '') : 'bg-slate-700'}`} style={{ opacity: 0.05 }}></div>

          {/* Capçalera tàctica */}
          <div className={`${TITLE_STYLE.replace('mb-4', 'mb-2')} flex items-center gap-1.5 relative z-10 shrink-0`}>
              {hasData ? (
                  <Droplets className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] transition-colors duration-500 shrink-0" /> 
              ) : (
                  <CloudOff className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span className="tracking-wider text-slate-200 truncate">{tDew}</span>
          </div>
          
          {/* Graella Simètrica Blindada (1fr - auto - 1fr) per evitar compressió al PC */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2 flex-1 pb-3 pt-1 sm:pt-2 relative z-10 w-full min-w-0">
              
              {/* Targeta Punt de Rosada */}
              <div className={`flex flex-col items-start px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg border backdrop-blur-sm transform transition-colors duration-500 w-full min-w-0 overflow-hidden ${hasValue ? 'bg-black/40 border-white/5' : 'bg-slate-900/40 border-slate-700/50'}`}>
                  {/* Tipografia escalada a xl:text-4xl (màxim 3 caràcters segurs) + whitespace-nowrap per bloquejar salts de línia */}
                  <span className={`text-2xl sm:text-3xl xl:text-4xl font-black tabular-nums tracking-tighter leading-none whitespace-nowrap w-full ${hasValue ? 'text-white drop-shadow-xl' : 'text-slate-600'}`}>
                      {displayVal}{hasValue ? '°' : ''}
                  </span>
                  <div className="flex items-center gap-1 mt-1 sm:mt-1.5 w-full min-w-0">
                      {hasValue && safeValue < 0 && <AlertTriangle className="w-2.5 h-2.5 text-cyan-400 shrink-0" />}
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate w-full">
                          {lang === 'ca' ? 'Rosada' : 'Dew Pt.'}
                      </span>
                  </div>
              </div>
              
              {/* Divisor òptic central */}
              <div className="h-9 sm:h-11 w-px bg-gradient-to-b from-transparent via-slate-500/30 to-transparent shrink-0"></div>
              
              {/* Targeta Humitat */}
              <div className={`flex flex-col items-end px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg border backdrop-blur-sm transform transition-colors duration-500 w-full min-w-0 overflow-hidden ${hasHumidity ? 'bg-black/40 border-white/5' : 'bg-slate-900/40 border-slate-700/50'}`}>
                  {/* Tipografia asimètrica escalada a xl:text-3xl (blindatge per a 4 caràcters "100%") + whitespace-nowrap */}
                  <span className={`text-2xl sm:text-3xl xl:text-3xl font-black tabular-nums tracking-tighter leading-none whitespace-nowrap w-full text-right ${hasHumidity ? 'text-cyan-400 drop-shadow-md' : 'text-slate-600'}`}>
                      {displayHum}{hasHumidity ? '%' : ''}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 sm:mt-1.5 text-right truncate w-full">
                      {lang === 'ca' ? 'Humitat' : 'RH'}
                  </span>
              </div>
          </div>

          {/* Instrument Analògic: Barra Lineal */}
          <div className={`w-full h-2 rounded-full overflow-hidden border shadow-inner mt-1 sm:mt-2 relative z-10 shrink-0 transition-colors duration-500 ${hasData ? 'bg-[#0a0b10] border-white/5' : 'bg-slate-900/50 border-slate-800'}`}>
              
              {/* Línies de calibratge absolutes (Ticks) */}
              <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="absolute h-full w-px bg-cyan-400/50" style={{ left: `${((0 - MIN_DP) / range) * 100}%` }}></div>
                  <div className="absolute h-full w-px bg-rose-500/50" style={{ left: `${((20 - MIN_DP) / range) * 100}%` }}></div>
              </div>

              {/* Barra de valor */}
              <div 
                className={`h-full rounded-full ${barColor} ${shadowColor} transition-all duration-1000 ease-out relative`} 
                style={{width: `${barWidth}%`, opacity: hasData ? 1 : 0 }}
              >
                  {hasData && <div className="absolute top-0 w-full h-[1px] bg-white opacity-50"></div>}
              </div>
          </div>
      </div>
    );
};