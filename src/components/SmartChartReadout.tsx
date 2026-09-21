// src/components/SmartChartReadout.tsx
// Franja de lectura dels gràfics a MÒBIL: les dades de l'hora que toques, en una alçada FIXA sobre el gràfic.
// A escriptori les dades surten en un cartell flotant, però en una pantalla de 330 px aquest cartell (160 ×
// 170 px) tapava mig gràfic; una franja fixa no el tapa mai, no fa saltar la pàgina i queda per sobre de
// la zona on el dit ja tapa el gràfic.

export interface ReadoutChip {
    key: string;
    label: string;
    color: string;
    value: string;
    /** La línia principal: es marca amb una vora més visible. */
    primary?: boolean;
}

interface SmartChartReadoutProps {
    /** "02:00 · dt. 22"; null si no hi ha cap hora a mostrar (llavors surt el text d'ajuda). */
    title: string | null;
    /** En repòs (cap hora tocada) mostra l'hora actual i ho diu amb una etiqueta. */
    isNow: boolean;
    nowLabel: string;
    chips: ReadoutChip[];
    /** Text d'ajuda quan encara no hi ha cap hora a mostrar. */
    hint: string;
    /** Alçada mínima (px) perquè el gràfic de sota no es mogui mentre s'arrossega. */
    minHeight: number;
}

export const SmartChartReadout = ({ title, isNow, nowLabel, chips, hint, minHeight }: SmartChartReadoutProps) => (
    <div data-testid="readout-strip" className="mb-3 px-1" style={{ minHeight }}>
        {title === null ? (
            <div className="flex items-center text-[11px] font-medium text-slate-500 leading-snug" style={{ minHeight }}>{hint}</div>
        ) : (
            <>
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 tabular-nums">{title}</span>
                    {isNow && (
                        <span data-testid="readout-now" className="text-[9px] font-black uppercase tracking-widest text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 rounded-full px-2 py-0.5">
                            {nowLabel}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {chips.map(chip => (
                        <span
                            key={chip.key}
                            data-testid={`readout-${chip.key}`}
                            className={`inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] border px-2.5 py-1.5 text-[11px] leading-none ${chip.primary ? 'border-white/20' : 'border-white/5'}`}
                        >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: chip.color }} aria-hidden="true"></span>
                            <span className="font-medium text-slate-500">{chip.label}</span>
                            <span className="font-black tabular-nums" style={{ color: chip.color }}>{chip.value}</span>
                        </span>
                    ))}
                </div>
            </>
        )}
    </div>
);
