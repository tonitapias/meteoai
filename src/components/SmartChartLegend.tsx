// src/components/SmartChartLegend.tsx
// Els models dels gràfics horaris de Previsió, desplegats sota el botó «Models»: un botó per model per amagar-lo o
// tornar-lo a mostrar, i un per al marge entre models. Una sola llista per a TOTS els gràfics (temperatura, pluja, vent,
// neu): amagar-ne un l'amaga a tots. Els models es dibuixen en gris fi; cadascun es distingeix pel seu traç.
import type { ChartModelKey } from '../utils/hourlyChartSeries';
import type { SmartForecastText } from './smartForecastI18n';

export interface LegendModel {
    key: ChartModelKey;
    label: string;
    /** Traç (stroke-dasharray) de la seva línia al gràfic. */
    dash: string;
    /** `identical`: coincideix amb la línia principal, no es dibuixa i no es pot activar. */
    state: 'on' | 'off' | 'identical';
}

interface SmartChartLegendProps {
    id?: string;
    models: LegendModel[];
    /** Només té sentit el marge si hi ha almenys dos models amb dada. */
    bandAvailable: boolean;
    showBand: boolean;
    onToggleModel: (key: ChartModelKey) => void;
    onToggleBand: () => void;
    text: SmartForecastText['legend'];
}

const CHIP = 'inline-flex items-center gap-2 px-3 min-h-[36px] rounded-full border text-xs font-semibold transition-colors';

export const DashSample = ({ dash }: { dash: string }) => (
    <svg width="18" height="4" viewBox="0 0 18 4" aria-hidden="true" className="shrink-0">
        <line x1="0" y1="2" x2="18" y2="2" stroke="#94a3b8" strokeWidth="1.6" strokeDasharray={dash} />
    </svg>
);

export const SmartChartLegend = ({
    id,
    models,
    bandAvailable,
    showBand,
    onToggleModel,
    onToggleBand,
    text
}: SmartChartLegendProps) => (
    <div id={id} role="group" aria-label={text.label} className="flex flex-wrap items-center gap-2 pt-3">
        {models.map(model =>
            model.state === 'identical' ? (
                <span
                    key={model.key}
                    data-testid={`legend-${model.key}`}
                    className={`${CHIP} border-dashed border-white/10 text-slate-400`}
                >
                    <DashSample dash={model.dash} />
                    {model.label} {text.identical}
                </span>
            ) : (
                <button
                    key={model.key}
                    type="button"
                    data-testid={`legend-${model.key}`}
                    aria-pressed={model.state === 'on'}
                    onClick={() => onToggleModel(model.key)}
                    className={`${CHIP} ${model.state === 'on' ? 'border-white/15 text-slate-200 bg-white/[0.04]' : 'border-white/[0.06] text-slate-500 hover:text-slate-300'}`}
                >
                    <DashSample dash={model.dash} />
                    {model.label}
                </button>
            )
        )}

        {bandAvailable && (
            <button
                type="button"
                data-testid="legend-band"
                aria-pressed={showBand}
                onClick={onToggleBand}
                className={`${CHIP} ${showBand ? 'border-white/15 text-slate-200 bg-white/[0.04]' : 'border-white/[0.06] text-slate-500 hover:text-slate-300'}`}
            >
                <span className="w-3.5 h-2 rounded-sm bg-slate-400/30" aria-hidden="true"></span>
                {text.band}
            </button>
        )}
    </div>
);
