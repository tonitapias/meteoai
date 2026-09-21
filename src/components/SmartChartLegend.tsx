// src/components/SmartChartLegend.tsx
// Llegenda dels gràfics d'Expert: diu de quin model és cada línia i deixa amagar-ne (o el fons de banda).
// Una sola llegenda per a TOTS els gràfics (temperatura, pluja, vent, neu): el mateix color vol dir el mateix
// model a tot arreu, i amagar-ne un l'amaga a tots.
import type { ChartModelKey } from '../utils/hourlyChartSeries';
import type { SmartForecastText } from './smartForecastI18n';

export interface LegendModel {
    key: ChartModelKey;
    label: string;
    color: string;
    /** `identical`: coincideix amb la línia principal, no es dibuixa i no es pot activar. */
    state: 'on' | 'off' | 'identical';
}

interface SmartChartLegendProps {
    /** Nom del model de la línia principal (p. ex. "AROME HD" o "MODEL GLOBAL"). */
    principalLabel: string;
    models: LegendModel[];
    /** Només té sentit la banda si hi ha almenys dos models amb dada. */
    bandAvailable: boolean;
    showBand: boolean;
    onToggleModel: (key: ChartModelKey) => void;
    onToggleBand: () => void;
    /** "Previsió de les 14:05", o null si no se sap. */
    updatedText: string | null;
    text: SmartForecastText['legend'];
}

const CHIP = 'inline-flex items-center gap-1.5 px-3 min-h-[32px] rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors';

export const SmartChartLegend = ({
    principalLabel,
    models,
    bandAvailable,
    showBand,
    onToggleModel,
    onToggleBand,
    updatedText,
    text
}: SmartChartLegendProps) => (
    <div role="group" aria-label={text.label} className="flex flex-wrap items-center gap-2 px-1">
        <span className={`${CHIP} border-white/20 text-slate-200 bg-white/[0.04]`}>
            <span className="w-4 h-[3px] rounded-full bg-slate-100" aria-hidden="true"></span>
            {text.principal} · {principalLabel}
        </span>

        {models.map(model =>
            model.state === 'identical' ? (
                <span
                    key={model.key}
                    data-testid={`legend-${model.key}`}
                    className={`${CHIP} border-dashed border-white/10 text-slate-500`}
                >
                    <span className="w-2 h-2 rounded-full border" style={{ borderColor: model.color }} aria-hidden="true"></span>
                    {model.label} {text.identical}
                </span>
            ) : (
                <button
                    key={model.key}
                    type="button"
                    data-testid={`legend-${model.key}`}
                    aria-pressed={model.state === 'on'}
                    onClick={() => onToggleModel(model.key)}
                    className={`${CHIP} ${model.state === 'on' ? 'border-white/20 text-slate-200 bg-white/[0.04]' : 'border-white/5 text-slate-600 hover:text-slate-400'}`}
                >
                    <span
                        className="w-2 h-2 rounded-full border"
                        style={{ borderColor: model.color, backgroundColor: model.state === 'on' ? model.color : 'transparent' }}
                        aria-hidden="true"
                    ></span>
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
                className={`${CHIP} ${showBand ? 'border-white/20 text-slate-200 bg-white/[0.04]' : 'border-white/5 text-slate-600 hover:text-slate-400'}`}
            >
                <span className="w-3.5 h-2 rounded-sm bg-slate-400/40" aria-hidden="true"></span>
                {text.band}
            </button>
        )}

        {updatedText && <span className="ml-auto text-[10px] font-bold tracking-wide text-slate-500">{updatedText}</span>}
    </div>
);
