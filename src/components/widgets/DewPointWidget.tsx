import { Droplets } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, safeVal } from './widgetHelpers';

export const DewPointWidget = ({ value, humidity, lang }: WidgetProps) => {
    const t = getTrans(lang);
    
    // Risc Zero: Validació dual estricta. L'API pot lliurar un valor i fallar en l'altre.
    const hasValue = typeof value === 'number' && !isNaN(value);
    const hasHumidity = typeof humidity === 'number' && !isNaN(humidity);
    const hasData = hasValue && hasHumidity;
    
    // Fallback visual tàctic explícit per absència de telemetria
    const displayVal = hasValue ? safeVal(value) : '--';
    const displayHum = hasHumidity ? safeVal(humidity) : '--';
    
    // Si no hi ha dades, no assumim un fals 0°C per a la barra visual
    const safeValue = hasValue ? value : 0;
    
    // Evitem percentatges negatius o superiors al 100% que trencarien el DOM
    const barWidth = hasData ? Math.max(0, Math.min(((safeValue + 10) / 40) * 100, 100)) : 0;

    // Colors tàctics segons risc (Glaçada, Confort, Xafogor extrema)
    let barColor = 'bg-slate-700/50'; // Estat desconnectat / No Data
    let shadowColor = 'shadow-none';
    
    if (hasData) {
        if (safeValue > 20) {
            barColor = 'bg-rose-500';
            shadowColor = 'shadow-[0_0_8px_rgba(244,63,94,0.8)]';
        } else if (safeValue > 15) {
            barColor = 'bg-amber-400';
            shadowColor = 'shadow-[0_0_8px_rgba(251,191,36,0.8)]';
        } else if (safeValue < 0) {
            barColor = 'bg-cyan-400';
            shadowColor = 'shadow-[0_0_8px_rgba(34,211,238,0.8)]';
        } else {
            barColor = 'bg-emerald-400';
            shadowColor = 'shadow-[0_0_8px_rgba(52,211,153,0.8)]';
        }
    }

    const SPATIAL_WIDGET_STYLE = `${WIDGET_BASE_STYLE} backdrop-blur-md bg-gradient-to-br from-black/60 to-[#0f111a]/80 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transform-gpu flex flex-col justify-between p-3 sm:p-4 relative overflow-hidden`;

    return (
      <div className={SPATIAL_WIDGET_STYLE}>
          {/* Línies de matriu de fons per profunditat UI */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:12px_12px] opacity-20 pointer-events-none"></div>

          <div className={`${TITLE_STYLE.replace('mb-4', 'mb-2')} flex items-center gap-1.5 relative z-10`}>
              <Droplets className={`w-4 h-4 ${hasData ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-500'}`} /> 
              <span className="tracking-wider text-slate-200">{t.dewPoint || "PUNT DE ROSADA"}</span>
          </div>
          
          <div className="flex items-center justify-between flex-1 pb-4 pt-2 relative z-10">
              <div className="flex flex-col items-start bg-black/40 p-2 rounded-lg border border-white/5 backdrop-blur-sm transform transition-all">
                  <span className={`text-4xl sm:text-5xl font-black tabular-nums tracking-tighter leading-none ${hasValue ? 'text-white drop-shadow-xl' : 'text-slate-600'}`}>
                      {displayVal}{hasValue ? '°' : ''}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2">Rosada</span>
              </div>
              
              <div className="h-12 w-px bg-gradient-to-b from-transparent via-slate-500/30 to-transparent mx-2"></div>
              
              <div className="flex flex-col items-end bg-black/40 p-2 rounded-lg border border-white/5 backdrop-blur-sm transform transition-all">
                  <span className={`text-2xl sm:text-3xl font-black tabular-nums leading-none ${hasHumidity ? 'text-cyan-400 drop-shadow-md' : 'text-slate-600'}`}>
                      {displayHum}{hasHumidity ? '%' : ''}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 text-right">Humitat Rel.</span>
              </div>
          </div>

          <div className="w-full h-1.5 bg-[#0a0b10] rounded-full overflow-hidden border border-white/5 shadow-inner mt-2 relative z-10">
              {!hasData && <div className="absolute inset-0 bg-slate-800/30"></div>}
              
              <div 
                className={`h-full rounded-full ${barColor} ${shadowColor} transition-all duration-1000 ease-out`} 
                style={{width: `${barWidth}%`, opacity: hasData ? 1 : 0 }}
              ></div>
          </div>
      </div>
    );
};