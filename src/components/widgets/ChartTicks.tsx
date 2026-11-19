// src/components/widgets/ChartTicks.tsx
// Les línies guia de l'eix vertical dels gràfics (valors de utils/chartTicks.ts), pintades com al modal de Temperatura:
// la línia, tènue, dins l'SVG (que s'estira amb preserveAspectRatio="none": el traç no s'escala) i l'etiqueta en HTML
// per sobre, perquè el text no es deformi. Les fan servir els modals de detall i el giny i el modal de Temperatura.
import { tickLabelCollides, type ChartLabelledPoint } from '../../utils/chartTicks';

interface ChartGridLinesProps {
    ticks: readonly number[];
    /** y de cada valor, en coordenades del viewBox. */
    y: (value: number) => number;
    /** Amplada del viewBox (la línia va de 0 a x2). */
    x2: number;
}

/** Dins l'<svg>, abans de les sèries (queden per sota). */
export const ChartGridLines = ({ ticks, y, x2 }: ChartGridLinesProps) => (
    <>
        {ticks.map(tk => (
            <line key={tk} x1="0" x2={x2} y1={y(tk)} y2={y(tk)} stroke="#94a3b8" strokeOpacity="0.1" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
    </>
);

interface ChartTickLabelsProps {
    ticks: readonly number[];
    /** Posició vertical de cada valor, en % de l'alçada del gràfic. */
    topPct: (value: number) => number;
    format: (value: number) => string;
    /** Punts amb etiqueta pròpia: la línia que hi queda a la mateixa alçada, a la dreta, es dibuixa sense etiqueta. */
    avoid?: ReadonlyArray<ChartLabelledPoint>;
}

/**
 * Dins la capa HTML que va per sobre de l'SVG (absolute inset-0). A la dreta: tots els gràfics comencen a l'hora
 * actual i el punt d'"ara" és a la vora esquerra; quan el valor d'ara coincidia amb una línia, en tapava l'etiqueta.
 */
export const ChartTickLabels = ({ ticks, topPct, format, avoid = [] }: ChartTickLabelsProps) => (
    <>
        {ticks.filter(tk => !tickLabelCollides(topPct(tk), avoid)).map(tk => (
            <span key={tk} data-tick={tk} className="absolute right-1 -translate-y-1/2 px-0.5 rounded-sm bg-black/45 text-[10px] leading-none font-mono text-slate-500 tabular-nums" style={{ top: `${topPct(tk)}%` }}>
                {format(tk)}
            </span>
        ))}
    </>
);
