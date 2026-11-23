// src/components/dayDetail/DayFacts.tsx
// Les xifres del dia en una sola fila de línies fines (pluja, vent, UV i sol o cota de neu), en lloc de quatre targetes.
import { memo } from 'react';

export interface DayFact {
  label: string;
  value: string | number;
  unit?: string;
  note?: string;
  noteClass?: string;
  testId?: string;
  noteTestId?: string;
}

export const DayFacts = memo(function DayFacts({ facts }: { facts: ReadonlyArray<DayFact> }) {
  return (
    <section className="grid grid-cols-4 px-5 sm:px-6 border-t border-white/[0.06]">
      {facts.map((f, i) => {
        const missing = f.value === '--' || f.value === '---';
        return (
          <div
            key={f.label}
            data-testid={f.testId}
            className={`flex flex-col gap-0.5 py-3 pb-3.5 min-w-0 ${i === 0 ? 'pr-2' : 'pl-2.5 pr-1 border-l border-white/[0.06]'}`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a879b] truncate">{f.label}</span>
            <span className={`text-base font-semibold tabular-nums leading-tight ${missing ? 'text-slate-600' : 'text-slate-100'}`}>
              {f.value}
              {!missing && f.unit && <span className="ml-0.5 text-[11.5px] font-normal text-slate-400">{f.unit}</span>}
            </span>
            {f.note && (
              <span data-testid={f.noteTestId} className={`text-[11.5px] leading-snug ${f.noteClass ?? 'text-slate-400'}`}>{f.note}</span>
            )}
          </div>
        );
      })}
    </section>
  );
});
