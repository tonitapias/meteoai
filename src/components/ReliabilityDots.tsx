import type { ReliabilityLevel } from '../utils/forecastConfidenceText';

const RELIABILITY_DOTS = { high: 3, medium: 2, low: 1 } as const;
const RELIABILITY_COLOR = { high: 'bg-emerald-400', medium: 'bg-amber-400', low: 'bg-red-400' } as const;

/**
 * Tres punts d'acord entre models: 3 alta, 2 mitjana, 1 baixa. Sense `label` és decoratiu (legenda, o
 * quan el nivell ja es diu amb text al costat).
 */
export const ReliabilityDots = ({ level, label }: { level: ReliabilityLevel; label?: string }) => (
  <span
    data-testid={label ? 'reliability' : undefined}
    data-level={label ? level : undefined}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    title={label}
    className="flex items-center gap-0.5 h-1.5"
  >
    {[0, 1, 2].map(n => (
      <span
        key={n}
        className={`w-1.5 h-1.5 rounded-full ${n < RELIABILITY_DOTS[level] ? RELIABILITY_COLOR[level] : 'bg-slate-700'}`}
      ></span>
    ))}
  </span>
);
