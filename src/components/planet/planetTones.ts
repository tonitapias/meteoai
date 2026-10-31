// src/components/planet/planetTones.ts
// Colors d'intensitat d'«Extrems del planeta», compartits pel detall i el visor orbital. El color diu la
// intensitat física, no l'alerta humanitària de GDACS (un tifó de categoria 4 en mar obert hi pot ser "Green").
import type { CycloneSummary } from '../../utils/planetExtremes';

export interface Tone { text: string; border: string; bg: string; icon: string; /** Per als traços SVG del visor. */ hex: string }

export const TONES: Record<'extreme' | 'severe' | 'notable' | 'quiet', Tone> = {
    extreme: { text: 'text-rose-300', border: 'border-rose-400/45', bg: 'bg-rose-400/[0.08]', icon: 'text-rose-400', hex: '#fb7185' },
    severe: { text: 'text-orange-300', border: 'border-orange-400/45', bg: 'bg-orange-400/[0.08]', icon: 'text-orange-400', hex: '#fb923c' },
    notable: { text: 'text-amber-200', border: 'border-amber-300/40', bg: 'bg-amber-300/[0.06]', icon: 'text-amber-300', hex: '#fcd34d' },
    quiet: { text: 'text-slate-300', border: 'border-white/10', bg: 'bg-white/[0.03]', icon: 'text-slate-400', hex: '#94a3b8' },
};

// Categoria 3 o més, 1-2, tempesta tropical, depressió.
export const cycloneTone = (summary: CycloneSummary): Tone =>
    summary.category >= 3 ? TONES.extreme
        : summary.category >= 1 ? TONES.severe
            : summary.kind === 'storm' || summary.kind === 'medicane' ? TONES.notable
                : TONES.quiet;
