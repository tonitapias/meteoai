// src/components/solar/SolarHero.tsx
// "La resposta": sortida i posta (les mateixes hores HH:MM que la targeta del tauler), azimuts, barra
// sortida→posta amb el moment actual, durada, Δ respecte del dia anterior i, avui, el compte enrere idèntic
// al de la targeta més el pròxim esdeveniment; altres dies, el migdia solar. Dies polars: un sol bloc explícit.
import { Fragment, memo } from 'react';
import type { Language } from '../../translations';
import { formatHoursMinutes } from '../../utils/formatters';
import type { SolarDayModel } from '../../utils/solar/solarDay';
import { azText, degText } from '../../utils/solar/solarFormat';
import { localClock } from '../../utils/solar/solarTime';
import { fill, type SolarStrings } from './solarI18n';
import { ShiftTag } from './ShiftTag';

export interface HeroCountdown { kind: 'sunrise' | 'sunset'; text: string }
export interface HeroDelta { cls: 'sm-tr-up' | 'sm-tr-down' | 'sm-tr-flat'; mag: string; rest: string }

interface SolarHeroProps {
  model: SolarDayModel;
  isLive: boolean;
  theme: 'day' | 'night';
  countdown: HeroCountdown | null;
  nextLine: string | null;
  dbarFrac: number | null;
  deltaText: HeroDelta;
  dateId: string;
  t: SolarStrings;
  lang: Language;
}

// Xifres una mica més petites fins a 400 px: als Android de 360 px la monoespaiada del sistema (0,6 em) deixa
// la columna central sense lloc per a la durada.
const NUM_CLS = 'font-mono tabular-nums font-semibold leading-none text-[26px] min-[360px]:text-[28px] min-[400px]:text-[30px] md:text-[36px] lg:text-[40px] mt-1.5';

/** Plantilla amb {len} on cada tros (la durada i el text del voltant) no es parteix per dins. */
const NoBreakTemplate = ({ tpl, len }: { tpl: string; len: string }) => {
  const parts = [...tpl.split('{len}').flatMap((p, i) => (i === 0 ? [p] : [len, p]))]
    .map(p => p.trim()).filter(p => p !== '');
  // L'espai entre trossos va fora dels <span> sense salt: és l'únic lloc on la línia es pot partir.
  return <>{parts.map((p, i) => <Fragment key={i}>{i > 0 && ' '}<span className="whitespace-nowrap">{p}</span></Fragment>)}</>;
};

export const SolarHero = memo(function SolarHero({
  model, isLive, theme, countdown, nextLine, dbarFrac, deltaText, dateId, t, lang,
}: SolarHeroProps) {
  const polar = model.polar;
  const noonText = model.text.noon?.text ?? (model.t.noon !== null ? localClock(model.t.noon, model.zone) : '—');

  return (
    <section className="sm-card sm-hero sm-a-hero" data-theme={theme} aria-labelledby={dateId}>
      {polar === 'none' ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 items-end">
          <div>
            <span className="sm-eyebrow sm-rise">{t.sunrise}</span>
            <p className={`${NUM_CLS} text-amber-200`}>{model.riseLabel?.text ?? '—'}<ShiftTag tt={model.riseLabel} t={t} className="ml-0.5" /></p>
            <p className="text-[12px] leading-4 text-slate-400 tabular-nums mt-1"><span className="sr-only">{t.azimuth} </span>{azText(model.riseAz, lang)}</p>
          </div>
          <div className="pb-[22px]">
            <div className="sm-dbar" aria-hidden="true">
              {dbarFrac !== null && <span className="sm-dbar-tick" style={{ left: `${dbarFrac * 100}%` }} />}
            </div>
            {/* Pot passar a dues línies (mai es talla), però només entre la durada i la resta: "11h 15m / de llum". */}
            <p className="mt-2 text-center text-[13px] leading-4 text-slate-200"><NoBreakTemplate tpl={t.daylightOf} len={formatHoursMinutes(model.dayLengthSec)} /></p>
          </div>
          <div className="text-right">
            <span className="sm-eyebrow sm-set">{t.sunset}</span>
            <p className={`${NUM_CLS} text-indigo-200`}>{model.setLabel?.text ?? '—'}<ShiftTag tt={model.setLabel} t={t} className="ml-0.5" /></p>
            <p className="text-[12px] leading-4 text-slate-400 tabular-nums mt-1"><span className="sr-only">{t.azimuth} </span>{azText(model.setAz, lang)}</p>
          </div>
        </div>
      ) : polar === 'day' ? (
        <div>
          <p className="text-[17px] leading-6 font-semibold text-amber-200">{t.polarDayTitle}</p>
          <p className="text-[13px] leading-5 text-slate-300">{t.polarDayText}</p>
          <p className="mt-1 text-[13px] leading-5 text-slate-200">{fill(t.daylightOf, { len: '24h 00m' })}</p>
        </div>
      ) : (
        <div>
          <p className="text-[17px] leading-6 font-semibold text-indigo-200">{t.polarNightTitle}</p>
          <p className="text-[13px] leading-5 text-slate-300">{t.polarNightText}</p>
          <p className="mt-1 text-[13px] leading-5 text-slate-200">{fill(t.daylightOf, { len: '0h 00m' })}</p>
        </div>
      )}
      <p className="mt-1.5 text-center text-[12px] leading-4">
        {deltaText.mag !== '' && <><span className={deltaText.cls}>{deltaText.mag}</span>{' '}</>}
        <span className={deltaText.mag === '' ? deltaText.cls : 'text-slate-400'}>{deltaText.rest}</span>
      </p>
      <div className="mt-3 pt-3 border-t border-white/[0.06]">
        {isLive ? (
          <>
            {countdown && polar === 'none' && (
              <p className={`sm-cd text-[13px] leading-5 font-semibold tabular-nums ${countdown.kind === 'sunset' ? 'text-amber-200' : 'text-indigo-200'}`}>
                {fill(countdown.kind === 'sunset' ? t.sunsetIn : t.sunriseIn, { t: countdown.text })}
              </p>
            )}
            {nextLine && <p className="mt-0.5 text-[12px] leading-4 text-slate-300">{nextLine}</p>}
          </>
        ) : (
          <p className="text-[12px] leading-5 text-slate-300">{fill(t.noonLine, { time: noonText, alt: degText(model.noonAltApp) })}</p>
        )}
      </div>
    </section>
  );
});
