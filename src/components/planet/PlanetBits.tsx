// src/components/planet/PlanetBits.tsx
// Peces petites compartides per la targeta i el detall d'«Extrems del planeta».
import type { Language } from '../../translations';
import type { WeatherUnit } from '../../utils/formatters';
import { WET_BULB_DANGER_C, WET_BULB_LIMIT_C, wetBulbScalePct } from '../../utils/planetExtremes';
import { tempText } from './planetFormat';

export { CycloneIcon } from './CycloneIcon';

interface WetBulbBarProps {
    valueC: number;
    unit: WeatherUnit;
    lang: Language;
    // Etiquetes dels llindars sota la barra ("31 °C perill", "35 °C límit"); sense, només la barra.
    labels?: { danger: string; limit: string };
    tone?: 'strong' | 'soft';
}

/**
 * Barra de 20 a 37 °C amb els dos llindars fisiològics marcats. La zona de perill i la del límit van
 * tenyides, i la barra s'omple fins al valor.
 */
export const WetBulbBar = ({ valueC, unit, lang, labels, tone = 'strong' }: WetBulbBarProps) => {
    const danger = wetBulbScalePct(WET_BULB_DANGER_C);
    const limit = wetBulbScalePct(WET_BULB_LIMIT_C);
    const value = wetBulbScalePct(valueC);
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
                <div className="relative h-3 font-mono text-[9.5px] text-slate-400">
                    <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${danger}%` }}>
                        {tempText(WET_BULB_DANGER_C, unit, lang)} {labels.danger}
                    </span>
                    <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(limit, 92)}%` }}>
                        {tempText(WET_BULB_LIMIT_C, unit, lang)} {labels.limit}
                    </span>
                </div>
            )}
        </div>
    );
};
