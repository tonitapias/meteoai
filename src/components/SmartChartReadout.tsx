// src/components/SmartChartReadout.tsx
// La lectura dels gràfics horaris de Previsió: el valor de l'hora en gran (en repòs, el d'ARA; si toques o passes per
// sobre del gràfic, el d'aquella hora), el nom del model que la dona i, a sota, el valor de cada model en una línia.
// Substitueix les tres targetes de xifres i els cinc xips d'abans: una sola lectura, a l'alçada fixa de cada
// pestanya perquè el gràfic de sota no es mogui mentre s'arrossega. Al costat, el que hi posi qui la fa servir
// (l'acord entre models).
import type { ReactNode } from 'react';

export interface ReadoutItem {
    key: string;
    label: string;
    value: string;
}

interface SmartChartReadoutProps {
    /** "02:00 · dt. 22"; null si no hi ha cap hora a mostrar (llavors surt el text d'ajuda). */
    title: string | null;
    /** En repòs (cap hora tocada) mostra l'hora actual i ho diu amb una etiqueta. */
    isNow: boolean;
    nowLabel: string;
    /** Valor de la línia principal ("15°", "0,4 mm"...). */
    value: string | null;
    /** Un segon valor al costat del principal (la probabilitat de la pluja, la ratxa del vent). */
    note?: { key: string; text: string } | null;
    /** Model de la línia principal a aquella hora ("AROME HD" o "MODEL GLOBAL"). */
    source: string | null;
    models: ReadoutItem[];
    /** Text d'ajuda quan encara no hi ha cap hora a mostrar. */
    hint: string;
    aside?: ReactNode;
    /** Alçada mínima (px): fixa per pestanya. */
    minHeight: number;
}

export const SmartChartReadout = ({ title, isNow, nowLabel, value, note, source, models, hint, aside, minHeight }: SmartChartReadoutProps) => (
    <div data-testid="readout" className="flex flex-col gap-2" style={{ minHeight }}>
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                {title === null ? (
                    <p className="max-w-[16rem] pt-1 text-[13px] leading-snug text-slate-400">{hint}</p>
                ) : (
                    <>
                        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400 tabular-nums">
                            {isNow && <span data-testid="readout-now" className="text-cyan-300">{nowLabel} · </span>}
                            {title}
                        </div>
                        <div data-testid="readout-primary" className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                            {/* La xifra en gran i la unitat ("km/h", "mm", "m") més petita: hi cap la ratxa o la probabilitat al costat. */}
                            <span className="text-[40px] leading-none font-semibold tracking-tight text-slate-50 tabular-nums">
                                {value === null ? '—' : value.split(' ')[0]}
                                {value !== null && value.includes(' ') && (
                                    <>{' '}<span className="text-lg font-medium tracking-normal text-slate-300">{value.slice(value.indexOf(' ') + 1)}</span></>
                                )}
                            </span>
                            {note && <span data-testid={`readout-${note.key}`} className="text-sm text-slate-300 tabular-nums">{note.text}</span>}
                            {source && <span className="text-xs text-slate-400">{source}</span>}
                        </div>
                    </>
                )}
            </div>
            {aside}
        </div>
        {title !== null && models.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
                {models.map(m => (
                    <span key={m.key} data-testid={`readout-${m.key}`} className="whitespace-nowrap">
                        <span className="text-slate-400">{m.label}</span> <span className="text-slate-200">{m.value}</span>
                    </span>
                ))}
            </div>
        )}
    </div>
);
