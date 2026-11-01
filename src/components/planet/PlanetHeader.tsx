// src/components/planet/PlanetHeader.tsx
// La capçalera de totes les pantalles del detall d'«Extrems del planeta», també la del visor orbital: a la llista,
// la icona de la secció; a les altres, la fletxa que porta a la pantalla de sota (fa el mateix que el botó «enrere»
// del mòbil). A sobre del títol, en petit, d'on vens (o l'hora de les dades, a la llista); a la dreta, la creu.
import type { Ref } from 'react';
import { ChevronLeft, Globe, X } from 'lucide-react';

interface PlanetHeaderProps {
    eyebrow: string;
    title: string;
    titleId?: string;
    /** Sense, és la llista: hi va la icona de la secció. */
    onBack?: () => void;
    backLabel?: string;
    backRef?: Ref<HTMLButtonElement>;
    onClose: () => void;
    closeLabel: string;
}

export function PlanetHeader({ eyebrow, title, titleId, onBack, backLabel, backRef, onClose, closeLabel }: PlanetHeaderProps) {
    return (
        <div className="flex min-h-[56px] items-center gap-2.5">
            {onBack ? (
                <button
                    ref={backRef}
                    type="button"
                    onClick={onBack}
                    aria-label={backLabel}
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-slate-200/25 bg-[#0c0f17]/60 text-slate-200 cursor-pointer transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                >
                    <ChevronLeft aria-hidden="true" className="w-5 h-5" />
                </button>
            ) : (
                <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-cyan-500/30 bg-black/40 text-cyan-300">
                    <Globe className="w-5 h-5" />
                </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-slate-400">{eyebrow}</span>
                <h2 id={titleId} className="truncate text-lg md:text-xl font-bold leading-tight tracking-tight text-white">{title}</h2>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/10 text-slate-400 cursor-pointer transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
            >
                <X aria-hidden="true" className="w-5 h-5" />
            </button>
        </div>
    );
}
