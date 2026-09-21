import { CalendarClock, Droplets } from 'lucide-react';
import { getWeatherIcon } from '../WeatherIcons';
import { MATRIX_BG } from '../widgets/widgetStyles';
import { formatPrecipitation } from '../../utils/formatters';
import type { DayPartKey, DayPartSummary } from '../../utils/dayParts';

interface DayPartsStripProps {
  parts: ReadonlyArray<DayPartSummary>;
  title: string;
  labels: Record<DayPartKey, string>;
  /** Etiqueta de la franja en curs ("ARA"). */
  nowLabel: string;
  /** Hora local actual (0-23) si el dia mostrat és avui; null si no. Marca la franja en curs i atenua les passades. */
  nowHour: number | null;
}

const formatTempRange = (min: number | null, max: number | null): string => {
  if (min === null || max === null) return '--°';
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo === hi ? `${lo}°` : `${lo}° – ${hi}°`;
};

/** Resum del dia per franges (matinada, matí, tarda, nit): una lectura ràpida abans de les 24 hores. */
export const DayPartsStrip = ({ parts, title, labels, nowLabel, nowHour }: DayPartsStripProps) => {
  if (parts.length === 0) return null;

  return (
    <section
      aria-label={title}
      data-testid="day-parts"
      className="relative overflow-hidden bg-[#0a0b10] border border-white/5 rounded-3xl p-5 md:p-8 shadow-inner"
    >
      <div className={MATRIX_BG}></div>
      <div className="relative z-10">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-5 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-400" />
          {title}
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {parts.map(part => {
            const isCurrent = nowHour !== null && nowHour >= part.from && nowHour < part.to;
            const isPast = nowHour !== null && nowHour >= part.to;
            const rains = (part.precipProbMax !== null && part.precipProbMax > 0) || (part.precipSum !== null && part.precipSum > 0);

            return (
              <div
                key={part.key}
                data-testid="day-part"
                data-part={part.key}
                data-current={isCurrent}
                data-past={isPast}
                aria-current={isCurrent ? 'time' : undefined}
                className={`relative flex flex-col items-center gap-2 p-3 md:p-4 rounded-2xl border text-center transition-opacity ${isCurrent ? 'bg-cyan-500/[0.07] border-cyan-500/30' : 'bg-black/40 border-white/5'} ${isPast ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{labels[part.key]}</span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-black uppercase tracking-widest text-cyan-300">{nowLabel}</span>
                  )}
                </div>
                <span className="text-[9px] font-mono font-bold text-slate-600 tabular-nums">
                  {String(part.from).padStart(2, '0')}–{String(part.to).padStart(2, '0')}h
                </span>

                <div className="my-0.5 scale-[0.8] origin-center">
                  {getWeatherIcon(part.code, 'w-10 h-10', part.isDay, part.precipProbMax ?? 0, part.windMax ?? 0, null, part.precipSum ?? 0, part.avgClouds)}
                </div>

                <span className={`text-sm md:text-base font-mono font-bold tabular-nums ${part.tempMin === null || part.tempMax === null ? 'text-slate-600' : 'text-white'}`}>
                  {formatTempRange(part.tempMin, part.tempMax)}
                </span>

                <div className="flex items-center justify-center gap-1.5 min-h-[18px] text-[10px] font-black tabular-nums">
                  {rains ? (
                    <>
                      <Droplets className="w-3 h-3 text-blue-400" />
                      {part.precipProbMax !== null && <span className="text-blue-300">{Math.round(part.precipProbMax)}%</span>}
                      {part.precipSum !== null && part.precipSum > 0 && (
                        <span className="text-slate-400 font-mono">{formatPrecipitation(part.precipSum, part.snowfall)}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-700">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
