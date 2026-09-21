import React from 'react';

interface DayStatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  glowClasses: string;
  /** Línia petita sota la xifra (probabilitat de pluja, ràfegues, categoria UV...). */
  note?: string;
  /** Classe de color de la nota (per defecte, gris). */
  noteClass?: string;
  /** Reserva l'alçada de la nota encara que aquesta targeta no en tingui, perquè les icones de la fila quedin alineades. */
  reserveNote?: boolean;
  testId?: string;
  noteTestId?: string;
}

export const DayStatCard = ({
  icon: Icon, label, value, sub, color, glowClasses, note, noteClass = 'text-slate-500', reserveNote, testId, noteTestId
}: DayStatCardProps) => (
  <div
    data-testid={testId}
    className="relative overflow-hidden bg-gradient-to-br from-[#0f111a]/90 to-black/80 border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md group hover:border-white/10 transition-colors duration-500 transform-gpu z-10"
  >
    <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]"></div>

    <div className={`relative z-10 p-2.5 rounded-xl bg-black/50 border border-white/5 mb-1 transition-shadow duration-500 ${value !== '--' ? glowClasses : 'shadow-none opacity-50'}`}>
        <Icon className={`w-5 h-5 ${value !== '--' ? color : 'text-slate-500'}`} strokeWidth={2.5}/>
    </div>

    <span className="relative z-10 text-[10px] text-slate-400 uppercase font-black tracking-widest">{label}</span>

    <span className={`relative z-10 text-xl font-mono font-black tabular-nums tracking-tight transition-colors duration-500 ${value === '--' ? 'text-slate-600' : 'text-slate-100'}`}>
      {value}<span className="text-xs ml-0.5 font-bold text-slate-500">{value !== '--' ? sub : ''}</span>
    </span>

    {(note || reserveNote) && (
      <span
        data-testid={note ? noteTestId : undefined}
        className={`relative z-10 -mt-1 min-h-[14px] text-[10px] font-black uppercase tracking-wider tabular-nums ${noteClass}`}
      >
        {note}
      </span>
    )}
  </div>
);
