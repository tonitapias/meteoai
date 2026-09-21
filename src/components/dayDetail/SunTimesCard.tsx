import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { MATRIX_BG } from '../widgets/widgetStyles';

interface SunTimesCardProps {
  sunriseLabel: string;
  sunsetLabel: string;
  /** Hores locals "HH:MM" (o "--:--" si falten). */
  sunrise: string;
  sunset: string;
  /** Durada del dia ("12h 10m"), o null si no es pot calcular. */
  duration: string | null;
  /** Text que va darrere de la durada ("de llum"). */
  durationLabel: string;
}

const SunTime = ({ icon: Icon, label, time, tone, align }: {
  icon: React.ElementType; label: string; time: string; tone: 'amber' | 'indigo'; align: 'left' | 'right';
}) => (
  <div className={`flex items-center gap-2.5 md:gap-4 shrink-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
    <div className={`p-2.5 md:p-3 bg-black/50 rounded-xl border transition-all ${tone === 'amber' ? 'text-amber-400 border-amber-500/20 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'text-indigo-400 border-indigo-500/20 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]'}`}>
      <Icon className="w-5 h-5"/>
    </div>
    <div>
      <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">{label}</span>
      <div className="text-xl md:text-2xl font-mono font-bold text-slate-200 tabular-nums">{time}</div>
    </div>
  </div>
);

/** Sortida i posta de sol en una sola fila, amb la durada del dia entremig. */
export const SunTimesCard = ({ sunriseLabel, sunsetLabel, sunrise, sunset, duration, durationLabel }: SunTimesCardProps) => (
  <div
    data-testid="sun-times"
    className="relative overflow-hidden bg-gradient-to-br from-[#0f111a]/90 to-black/80 border border-white/5 p-4 md:p-5 rounded-2xl group hover:border-white/10 transition-colors backdrop-blur-sm shadow-lg"
  >
    <div className={MATRIX_BG}></div>
    <div className="relative z-10 flex items-center justify-between gap-3 md:gap-6">
      <SunTime icon={Sun} label={sunriseLabel} time={sunrise} tone="amber" align="left" />

      <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
        <div aria-hidden="true" className="w-full h-1 rounded-full bg-gradient-to-r from-amber-400/70 via-amber-200/30 to-indigo-400/70"></div>
        {duration && (
          <span data-testid="daylight" className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center tabular-nums">
            {duration} {durationLabel}
          </span>
        )}
      </div>

      <SunTime icon={Moon} label={sunsetLabel} time={sunset} tone="indigo" align="right" />
    </div>
  </div>
);
