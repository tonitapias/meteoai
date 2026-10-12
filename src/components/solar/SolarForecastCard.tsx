// src/components/solar/SolarForecastCard.tsx
// Previsió d'Open-Meteo per al dia consultat, marcada com a previsió: UV (amb categoria i el valor amb cel
// serè), hores de sol sobre la durada del dia, radiació i qualitat de la posta (estimació /100). Més enllà
// de l'horitzó de la previsió, una sola frase honesta.
import { memo, useId, type ReactNode } from 'react';
import type { Language } from '../../translations';
import { getUVCategory } from '../../utils/uvIndexUtils';
import { formatHoursMinutes } from '../../utils/formatters';
import { uvDisplay } from '../../utils/solar/solarFormat';
import type { ForecastRow } from '../../utils/solar/solarForecast';
import { fill, type SolarStrings } from './solarI18n';

interface SolarForecastCardProps {
  forecast: ForecastRow | null;
  /** Darrer dia amb previsió, ja formatat ("14 d’octubre"), o null. */
  lastDateLabel: string | null;
  hasDaily: boolean;
  /** Durada del dia consultat (parell resolt), per a "de 11h 29m de llum". */
  dayLengthSec: number | null;
  t: SolarStrings;
  lang: Language;
}

const DASH = <span className="text-slate-400">—</span>;

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 py-2.5 border-t border-white/[0.06] first:border-t-0">
    <dt className="shrink-0 text-[13px] text-slate-300">{label}</dt>
    <dd className="min-w-0 flex-1 text-right">{children}</dd>
  </div>
);

export const SolarForecastCard = memo(function SolarForecastCard({
  forecast, lastDateLabel, hasDaily, dayLengthSec, t, lang,
}: SolarForecastCardProps) {
  const id = useId();

  let body: ReactNode;
  if (!hasDaily || (!forecast?.available && lastDateLabel === null)) {
    body = <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{t.noDailyData}</p>;
  } else if (!forecast || !forecast.available) {
    body = <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{fill(t.noForecast, { date: lastDateLabel ?? '' })}</p>;
  } else {
    const uv = uvDisplay(forecast.uvMax);
    const sun = forecast.sunshineSec;
    const pct = forecast.pct;
    const rad = forecast.radiation;
    const q = forecast.sunsetQuality;
    body = (
      <dl className="mt-1">
        <Row label={t.uvMax}>
          {uv && forecast.uvMax !== null ? (
            <>
              <span className={`text-[17px] font-semibold tabular-nums ${uv.cls}`}>{uv.text}</span>
              <span className={`ml-2 px-1.5 py-0.5 rounded bg-white/[0.04] text-[11px] font-semibold uppercase ${uv.cls}`}>
                {getUVCategory(forecast.uvMax).label[lang]}
              </span>
            </>
          ) : DASH}
          {forecast.uvClear !== null && (
            <span className="block mt-0.5 text-[12px] leading-4 text-slate-400">{fill(t.uvClear, { v: forecast.uvClear.toFixed(1) })}</span>
          )}
        </Row>
        <Row label={t.sunshine}>
          {sun !== null ? (
            <>
              <span className="text-[15px] font-semibold tabular-nums text-slate-50">{formatHoursMinutes(sun)}</span>
              {dayLengthSec !== null && (
                <span className="block mt-0.5 text-[12px] leading-4 text-slate-400 tabular-nums">
                  {fill(t.sunshineOf, { total: formatHoursMinutes(dayLengthSec) })}{pct !== null && ` · ${pct}\u00A0%`}
                </span>
              )}
              {pct !== null && (
                <span className="block mt-1.5 h-1 rounded-full bg-white/[0.08]" aria-hidden="true">
                  <span className="block h-full rounded-full bg-amber-300/80" style={{ width: `${pct}%` }} />
                </span>
              )}
            </>
          ) : DASH}
        </Row>
        <Row label={t.radiation}>
          {rad !== null ? (
            <>
              <span className="text-[15px] font-semibold tabular-nums text-slate-50">{`${rad.toFixed(1)} MJ/m²`}</span>
              <span className="block mt-0.5 text-[12px] leading-4 text-slate-400">{t.radiationSub}</span>
            </>
          ) : DASH}
        </Row>
        {q !== null && (
          <Row label={t.sunsetQuality}>
            <span className="text-[15px] font-semibold tabular-nums text-slate-50">{q}</span>
            <span className="text-[12px] text-slate-400">/100</span>
            <span className="ml-2 rounded-full px-1.5 py-0.5 border border-white/10 text-[11px] text-slate-300">{t.estimate}</span>
            <span className="block mt-0.5 text-[12px] leading-4 text-slate-400">{t.sunsetQualitySub}</span>
          </Row>
        )}
      </dl>
    );
  }

  return (
    <section className="sm-card sm-a-fc" aria-labelledby={id}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="sm-eyebrow">{t.forecastTitle}</h3>
        <span className="h-6 px-2 inline-flex items-center rounded-md border border-white/10 text-[11px] font-semibold text-slate-300">{t.forecastTag}</span>
      </div>
      {body}
    </section>
  );
});
