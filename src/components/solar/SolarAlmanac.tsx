// src/components/solar/SolarAlmanac.tsx
// "Calendari solar": avui + 14 dies des de la data local viva, totes les files a qualsevol amplada. Es munta
// diferit (260 ms) i calcula les seves files en muntar-se, perquè l'obertura del modal no ho pagui. Les barres
// de llum i les marques de tendència són pseudoelements (cap node ni icona per fila). Tocar una fila tria el dia.
import { memo, useId, useMemo, type CSSProperties } from 'react';
import type { Language } from '../../translations';
import type { ZoneCtx } from '../../utils/solar/solarTime';
import type { SolarDaily } from '../../utils/solar/solarForecast';
import { almanacRangeLabel, almanacUvUntilLine, buildAlmanacRows } from '../../utils/solar/solarAlmanac';
import { solarLocale, type SolarStrings } from './solarI18n';
import { DEFERRED_MOUNT_MS, useDeferredMount } from './useDeferredMount';

interface SolarAlmanacProps {
  liveDate: string;
  zone: ZoneCtx;
  lat: number;
  lon: number;
  daily: SolarDaily | null | undefined;
  viewDate: string;
  isLg: boolean;
  /** `viaPointer`: tocat amb el dit o el ratolí (el modal torna a dalt); amb teclat, el focus es queda a la fila. */
  onSelect: (date: string, viaPointer: boolean) => void;
  t: SolarStrings;
  lang: Language;
}

export const SolarAlmanac = memo(function SolarAlmanac(props: SolarAlmanacProps) {
  const ready = useDeferredMount(DEFERRED_MOUNT_MS);
  if (!ready) return <div className="sm-alm-ph sm-a-alm" />;
  return <AlmanacBody {...props} />;
});

function AlmanacBody({ liveDate, zone, lat, lon, daily, viewDate, isLg, onSelect, t, lang }: SolarAlmanacProps) {
  const id = useId();
  const locale = solarLocale(lang);
  const rows = useMemo(
    () => buildAlmanacRows({ liveDate, zone, lat, lon, daily, locale, t, lang }),
    [liveDate, zone, lat, lon, daily, locale, t, lang],
  );
  const rangeLabel = useMemo(() => almanacRangeLabel(liveDate, locale), [liveDate, locale]);
  const uvUntilLine = useMemo(() => almanacUvUntilLine(daily, t, locale, lang), [daily, t, locale, lang]);
  if (rows.length === 0) return null;

  return (
    <section className="sm-card sm-a-alm" aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className="sm-eyebrow">{t.almanacTitle}</h3>
        <span className="text-[11px] text-slate-400 tabular-nums">{rangeLabel}</span>
      </div>
      <div className={isLg ? 'grid grid-cols-2 gap-x-8' : ''} aria-hidden="true">
        {(isLg ? [0, 1] : [0]).map(k => (
          <div key={k} className="sm-ahead sm-eyebrow h-8">
            {/* Sortida i posta amb el glif (mig sol + fletxa): les paraules no hi cabrien en cap idioma. */}
            <span>{t.colDay}</span><span className="sm-hrise" title={t.sunrise} /><span className="sm-hset" title={t.sunset} />
            <span>{t.colLength}</span><span className="sm-chg">{t.colChange}</span><span>{t.colUv}</span>
          </div>
        ))}
      </div>
      <ol className="sm-alm-list" aria-label={t.almanacListLabel}>
        {rows.map(r => (
          <li key={r.dateStr}>
            <button type="button" className="sm-arow sm-focus" aria-pressed={r.dateStr === viewDate}
              aria-current={r.offset === 0 ? 'date' : undefined} aria-label={r.aria}
              style={{ '--r': r.riseFrac, '--s': r.setFrac } as CSSProperties}
              onClick={e => onSelect(r.dateStr, e.detail > 0)}>
              <span className={`min-w-0 truncate text-[13px] leading-4 ${r.offset === 0 ? 'font-semibold text-amber-200' : 'text-slate-200'}`}>
                {r.labelMain}
                {r.labelSub && <span className="block text-[11px] leading-3 font-normal text-slate-400">{r.labelSub}</span>}
              </span>
              <span className="font-mono tabular-nums text-[12px] min-[360px]:text-[13px] text-amber-200">{r.rise}</span>
              <span className="font-mono tabular-nums text-[12px] min-[360px]:text-[13px] text-indigo-200">{r.set}</span>
              <span className="sm-len text-[13px] tabular-nums text-slate-100" data-trend={r.trend}>{r.len}</span>
              <span className={`sm-chg font-mono text-[12px] tabular-nums ${r.trendCls}`}>{r.deltaCompact}</span>
              <span className={`text-[12px] font-semibold tabular-nums ${r.uvClass}`}>{r.uv ?? ''}</span>
            </button>
          </li>
        ))}
      </ol>
      {uvUntilLine && <p className="mt-2 text-[11px] text-slate-400">{uvUntilLine}</p>}
    </section>
  );
}
