import { Droplets } from 'lucide-react';
import { WidgetProps } from './widgetTypes';
import { WIDGET_BASE_STYLE, TITLE_STYLE } from './widgetStyles';
import { getTrans, safeVal } from './widgetHelpers';

export const DewPointWidget = ({ value, humidity, lang }: WidgetProps) => {
    const t = getTrans(lang);
    const displayVal = safeVal(value);
    const displayHum = safeVal(humidity);
    const safeValue = value ?? 0;

    return (
      <div className={WIDGET_BASE_STYLE}>
          <div className={TITLE_STYLE}><Droplets className="w-3.5 h-3.5 text-cyan-400" /> {t.dewPoint || "ROSADA"}</div>
          <div className="flex items-center justify-between px-2 flex-1 pb-4">
              <div className="flex flex-col items-start">
                  <span className="text-4xl font-black text-white tabular-nums tracking-tighter drop-shadow-lg">{displayVal}°</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide mt-1">Punt Rosada</span>
              </div>
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent mx-2"></div>
              <div className="flex flex-col items-end">
                  <span className="text-2xl font-bold text-cyan-400 tabular-nums">{displayHum}%</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wide mt-1 text-right">Humitat Rel.</span>
              </div>
          </div>
          <div className="w-full h-1.5 bg-[#0f111a] rounded-full overflow-hidden border border-white/5">
              <div className={`h-full rounded-full ${safeValue > 20 ? 'bg-rose-500' : safeValue > 15 ? 'bg-amber-400' : 'bg-emerald-400'} shadow-[0_0_8px_currentColor]`} style={{width: `${Math.min(((safeValue + 10) / 40) * 100, 100)}%`}}></div>
          </div>
      </div>
    );
};