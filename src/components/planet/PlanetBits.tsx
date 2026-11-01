// src/components/planet/PlanetBits.tsx
// Peces petites compartides per la targeta i el detall d'«Extrems del planeta».
import type { ReactNode, Ref } from 'react';
import { Satellite } from 'lucide-react';
import type { WeatherUnit } from '../../utils/formatters';
import { WET_BULB_DANGER_C, WET_BULB_LIMIT_C, wetBulbScalePct } from '../../utils/planetExtremes';

export { CycloneIcon } from './CycloneIcon';

/** Un bloc del detall. */
export const SheetCard = ({ children, label }: { children: ReactNode; label: string }) => (
    <section aria-label={label} className="rounded-2xl border border-white/5 astro-card-fill p-4 flex flex-col gap-3">
        {children}
    </section>
);

/** `note`: el nom tècnic, petit i en gris al costat del planer ("Calor humida (bulb humit)"). */
export const SheetTitle = ({ children, count, note }: { children: string; count?: string; note?: string }) => (
    <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-white">
            {children}
            {note && <span className="font-mono font-medium normal-case tracking-normal text-slate-400">{` (${note})`}</span>}
        </h3>
        {count && <span className="font-mono text-[11px] text-slate-400">{count}</span>}
    </div>
);

export interface WhyItem { key: string; icon: ReactNode; lead: string; text: string }

/** «Per què aquí?»: fets calculats a partir de les dades, no frases fixes. */
export const WhyList = ({ items }: { items: WhyItem[] }) => (
    <>
        {items.map((item) => (
            <div key={item.key} className="flex gap-2.5 items-start">
                <span aria-hidden="true" className="flex-none w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">{item.icon}</span>
                <p className="text-[13px] leading-snug text-slate-300">
                    <span className="font-semibold text-slate-100">{item.lead}</span> {item.text}
                </p>
            </div>
        ))}
    </>
);

/**
 * «I l'escalfament?»: una etiqueta sempre igual que diu què se'n sap (més freqüent, al revés, no es pot dir...),
 * el text i la font.
 */
export const WarmingBlock = ({ title, badge, text, source }: { title: string; badge: string; text: string; source: string }) => (
    <section aria-label={title} className="rounded-2xl border border-teal-300/30 bg-teal-300/[0.05] p-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-white">{title}</h3>
            <span className="rounded-full border border-teal-300/60 px-2.5 py-0.5 text-xs font-semibold text-teal-200">{badge}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-300">{text}</p>
        <span className="font-mono text-[11px] tracking-[0.06em] text-slate-400">{source}</span>
    </section>
);

/** «Mira-ho des de l'òrbita» (o «Veure X des de l'òrbita» des d'una fitxa). */
export const OrbitButton = ({ label, onClick, buttonRef }: { label: string; onClick: () => void; buttonRef?: Ref<HTMLButtonElement> }) => (
    <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-[14px] border border-amber-200/50 bg-amber-200/[0.08] px-3 text-[15px] font-semibold text-amber-200 cursor-pointer transition-colors hover:bg-amber-200/[0.14] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"
    >
        <Satellite aria-hidden="true" className="w-[18px] h-[18px] flex-none" />{label}
    </button>
);

interface WetBulbBarProps {
    valueC: number;
    unit: WeatherUnit;
    // Etiquetes dels llindars sota la barra ("31 °C perill", "35 °C límit"); sense, només la barra.
    labels?: { danger: string; limit: string };
    tone?: 'strong' | 'soft';
}

/**
 * Barra de 20 a 37 °C amb els dos llindars fisiològics marcats. La zona de perill i la del límit van
 * tenyides, i la barra s'omple fins al valor.
 */
export const WetBulbBar = ({ valueC, unit, labels, tone = 'strong' }: WetBulbBarProps) => {
    const danger = wetBulbScalePct(WET_BULB_DANGER_C);
    const limit = wetBulbScalePct(WET_BULB_LIMIT_C);
    const value = wetBulbScalePct(valueC);
    // Sense la unitat (ja la porta el valor): amb "°C" les dues etiquetes es trepitgen a l'amplada d'un mòbil.
    const num = (c: number) => String(Math.round(unit === 'F' ? (c * 9) / 5 + 32 : c));
    return (
        <div className="flex flex-col gap-1.5" aria-hidden="true">
            <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
                <span className="absolute inset-y-0 bg-orange-400/45" style={{ left: `${danger}%`, width: `${limit - danger}%` }} />
                <span className="absolute inset-y-0 right-0 bg-rose-400/60" style={{ left: `${limit}%` }} />
                <span className={`absolute inset-y-0 left-0 rounded-full ${tone === 'strong' ? 'bg-amber-400' : 'bg-amber-400/80'}`} style={{ width: `${value}%` }} />
                <span className="absolute inset-y-0 w-px bg-slate-300/70" style={{ left: `${danger}%` }} />
                <span className="absolute inset-y-0 w-px bg-slate-300/70" style={{ left: `${limit}%` }} />
            </div>
            {labels && (
                <div className="relative h-3.5 font-mono text-[11px] text-slate-400">
                    <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${danger}%` }}>
                        {num(WET_BULB_DANGER_C)} {labels.danger}
                    </span>
                    <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(limit, 90)}%` }}>
                        {num(WET_BULB_LIMIT_C)} {labels.limit}
                    </span>
                </div>
            )}
        </div>
    );
};
