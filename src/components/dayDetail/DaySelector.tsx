// src/components/dayDetail/DaySelector.tsx
// Els dies que es poden obrir al detall (avui i els 7 següents), cadascun amb la seva mini-franja del cel: un toc i canvies
// de dia. Les fletxes del teclat i el gest de lliscar del modal continuen funcionant igual.
import { memo } from 'react';

export interface DaySelectorDay {
  index: number;
  /** "DT", "AVUI"... */
  abbr: string;
  /** Número del dia del mes. */
  date: number;
  /** Nom accessible complet ("Dimarts 24"). */
  aria: string;
  /** Imatge de fons CSS de la franja (skyStripBackground), o 'none'. */
  strip: string;
  /** Hi ha un avís oficial que toca aquest dia. */
  hasAlert: boolean;
}

interface DaySelectorProps {
  days: ReadonlyArray<DaySelectorDay>;
  selected: number;
  onSelect: (index: number) => void;
  label: string;
}

export const DaySelector = memo(function DaySelector({ days, selected, onSelect, label }: DaySelectorProps) {
  if (days.length === 0) return null;
  return (
    <nav aria-label={label} className="grid grid-cols-8 gap-0.5 px-2.5 pb-2.5 sm:px-4">
      {days.map(d => {
        const isSelected = d.index === selected;
        return (
          <button
            key={d.index}
            type="button"
            data-testid="day-tab"
            data-index={d.index}
            onClick={() => onSelect(d.index)}
            aria-label={d.aria}
            aria-current={isSelected ? 'date' : undefined}
            className={`relative h-[58px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${isSelected ? 'bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]' : 'hover:bg-white/[0.04]'}`}
          >
            <span aria-hidden="true" className={`font-mono text-[9.5px] uppercase tracking-[0.08em] ${isSelected ? 'text-slate-300' : 'text-[#7a879b]'}`}>{d.abbr}</span>
            <span aria-hidden="true" className={`text-[15px] font-semibold tabular-nums leading-none ${isSelected ? 'text-slate-50' : 'text-slate-400'}`}>{d.date}</span>
            <span
              aria-hidden="true"
              className={`block w-[30px] max-w-[70%] h-1 rounded-sm bg-white/[0.06] ${isSelected ? '' : 'opacity-75'}`}
              style={d.strip !== 'none' ? { backgroundImage: d.strip } : undefined}
            ></span>
            {d.hasAlert && (
              <span data-testid="day-tab-alert" aria-hidden="true" className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
});
