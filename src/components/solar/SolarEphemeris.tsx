// src/components/solar/SolarEphemeris.tsx
// Efemèrides com a taula d'alçades: una fila per llindar (migdia a dalt, sortida/posta, crepuscles civil,
// nàutic i astronòmic, mitjanit solar a baix), amb el matí a l'esquerra (pujant) i el vespre a la dreta
// (baixant); hora daurada i blava com a intervals i la llum útil. Avui marca què ha passat, què és ara i què ve.
import { memo, useId, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Language } from '../../translations';
import { formatHoursMinutes } from '../../utils/formatters';
import { type CellId, type CellState, type EventKey, type SolarDayModel, type TextKey, type TimeText, RISE_SET_GEO } from '../../utils/solar/solarDay';
import { MINUS, degText, formatOffsetFromNoon, shadowRatio } from '../../utils/solar/solarFormat';
import { formatDateStr, localClock, localClockMinute } from '../../utils/solar/solarTime';
import { fill, solarLocale, type SolarStringKey, type SolarStrings } from './solarI18n';
import { ShiftTag } from './ShiftTag';

type CellStates = Partial<Record<CellId, CellState>>;

interface SolarEphemerisProps {
  model: SolarDayModel;
  /** Estats de les cel·les (només avui), o null. */
  cellStates: CellStates | null;
  t: SolarStrings;
  lang: Language;
}

/** Durada d'un interval: "57 min" o "1h 05m". */
const spanText = (ms: number) => (ms < 3600000 ? `${Math.round(ms / 60000)} min` : formatHoursMinutes(ms / 1000));

const TIME_CLS = 'font-mono tabular-nums text-[13px] text-slate-100';
const RANGE_CLS = 'font-mono tabular-nums text-[12px] min-[360px]:text-[13px] text-slate-100';
const SUB_CLS = 'block text-[11px] leading-4 text-slate-400';
const NOTE_CLS = 'block mt-1 text-[12px] leading-4 text-slate-400';
const DASH = <span className="text-slate-400">—</span>;

/** Embolcall d'estat d'una cel·la d'avui: passada, en curs o la pròxima. */
const Stated = ({ state, t, children }: { state: CellState | undefined; t: SolarStrings; children: ReactNode }) => {
  if (state === 'next') return <span className="sm-c-next">{children}<span className="sr-only"> · {t.srNext}</span></span>;
  if (state === 'cur') return <span className="sm-c-cur">{children}<span className="sr-only"> · {t.srNow}</span></span>;
  if (state === 'past') return <span className="sm-c-past">{children}</span>;
  return <>{children}</>;
};

/** Interval "07:34–08:29"; només inici "22:35 …"; només final "… 02:56" (mateix text que formatRange). */
const RangeText = ({ a, b, t }: { a: TimeText | undefined; b: TimeText | undefined; t: SolarStrings }) => {
  if (a && b) return <>{a.text}<ShiftTag tt={a} t={t} />–{b.text}<ShiftTag tt={b} t={t} /></>;
  if (a) return <>{a.text}<ShiftTag tt={a} t={t} /> …</>;
  if (b) return <>… {b.text}<ShiftTag tt={b} t={t} /></>;
  return null;
};

interface LevelDef {
  label: SolarStringKey; sub: string; c: string; thr: number;
  am: EventKey; pm: EventKey; amCell: CellId; pmCell: CellId; amCls: string; pmCls: string;
}

const LEVELS: readonly LevelDef[] = [
  { label: 'rowRiseSet', sub: `${MINUS}0.8°`, c: '#fbbf24', thr: RISE_SET_GEO, am: 'sunrise', pm: 'sunset', amCell: 'sunrise', pmCell: 'sunset',
    amCls: 'font-mono tabular-nums text-[15px] text-amber-200', pmCls: 'font-mono tabular-nums text-[15px] text-indigo-200' },
  { label: 'rowCivil', sub: `${MINUS}6°`, c: 'rgba(129,140,248,.55)', thr: -6, am: 'civilDawn', pm: 'civilDusk', amCell: 'civilAM', pmCell: 'civilPM', amCls: TIME_CLS, pmCls: TIME_CLS },
  { label: 'rowNautical', sub: `${MINUS}12°`, c: 'rgba(129,140,248,.35)', thr: -12, am: 'nauticalDawn', pm: 'nauticalDusk', amCell: 'nauticalAM', pmCell: 'nauticalPM', amCls: TIME_CLS, pmCls: TIME_CLS },
  { label: 'rowAstro', sub: `${MINUS}18°`, c: 'rgba(129,140,248,.20)', thr: -18, am: 'astroDawn', pm: 'astroDusk', amCell: 'astroAM', pmCell: 'astroPM', amCls: TIME_CLS, pmCls: TIME_CLS },
];

const lvlStyle = (c: string) => ({ '--c': c }) as CSSProperties;

export const SolarEphemeris = memo(function SolarEphemeris({ model, cellStates, t, lang }: SolarEphemerisProps) {
  const id = useId();
  const cs: CellStates = cellStates ?? {};
  const text = model.text;
  const tm = model.t;
  const longDate = useMemo(() => formatDateStr(model.dateStr, solarLocale(lang), 'long'), [model.dateStr, lang]);

  /** Per què una fila no té cap hora: el sol no hi arriba, no hi baixa o hi és tot el dia. */
  const levelNote = (thr: number) => (model.noonGeo < thr ? t.neverReaches : model.nadirGeo > thr ? t.neverDrops : null);
  const bandNote = (lo: number, hi: number) =>
    model.nadirGeo >= hi ? t.neverDrops : model.noonGeo < lo ? t.neverReaches : model.nadirGeo >= lo && model.noonGeo < hi ? t.allDay : null;

  const timeCell = (k: TextKey, cell: CellId, cls: string, align: 'text-left' | 'text-right') => {
    const tt = text[k];
    return (
      <td className={`${align} ${cls}`}>
        {tt ? <Stated state={cs[cell]} t={t}>{tt.text}<ShiftTag tt={tt} t={t} /></Stated> : DASH}
      </td>
    );
  };

  const rangeCell = (a: TextKey, b: TextKey, ms: number | null, cell: CellId, align: 'text-left' | 'text-right') => {
    const ta = text[a], tb = text[b];
    return (
      <td className={`${align} ${RANGE_CLS}`}>
        {ta || tb ? <Stated state={cs[cell]} t={t}><RangeText a={ta} b={tb} t={t} /></Stated> : DASH}
        {ms !== null && <span className="hidden md:block text-[11px] text-slate-400">{spanText(ms)}</span>}
      </td>
    );
  };
  // Durada a partir dels minuts que es mostren (07:34–08:29 → 55 min, no els 54 dels segons exactes).
  const dur = (a: number | null, b: number | null) =>
    (a !== null && b !== null && b > a ? (Math.floor(b / 60000) - Math.floor(a / 60000)) * 60000 : null);

  // Hora daurada sense +6° però amb els dos −4° (Tromsø al desembre): un sol interval que no és ni de matí ni de vespre.
  const goldenMerged = tm.goldenEndAM === null && tm.goldenStartPM === null && tm.goldenStartAM !== null && tm.blueStartPM !== null;
  const goldenNone = tm.goldenStartAM === null && tm.goldenEndAM === null && tm.goldenStartPM === null && tm.blueStartPM === null;
  const blueNone = tm.civilDawn === null && tm.goldenStartAM === null && tm.blueStartPM === null && tm.civilDusk === null;

  const noonTT = text.noon;
  const noonOffset = tm.noon !== null ? formatOffsetFromNoon(localClockMinute(tm.noon, model.zone) - 720, t) : null;
  const noonShadow = shadowRatio(model.noonAltApp, lang);
  const nadirTT = text.nadir;

  return (
    <section className="sm-card sm-a-eph" aria-labelledby={id}>
      <h3 id={id} className="sm-eyebrow">{t.ephemerisTitle}</h3>
      <p className="mt-1 text-[12px] leading-4 text-slate-400">{t.ephemerisCaption}</p>
      <table className="sm-eph mt-2">
        <caption className="sr-only">{fill(t.tableCaption, { date: longDate })}</caption>
        <thead>
          <tr>
            <th scope="col" className="sm-eyebrow text-left w-[5rem] min-[360px]:w-[5.5rem] min-[400px]:w-24">{t.colMorning}</th>
            <th scope="col"><span className="sr-only">{t.colLevel}</span></th>
            <th scope="col" className="sm-eyebrow text-right w-[5rem] min-[360px]:w-[5.5rem] min-[400px]:w-24">{t.colEvening}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={3} className="text-center">
              <span className="block text-[12px] leading-4 text-slate-400">{t.noon}</span>
              <span className="block font-mono tabular-nums text-[17px] leading-6 font-semibold text-amber-200">
                <Stated state={cs.noon} t={t}>{noonTT?.text ?? (tm.noon !== null ? localClock(tm.noon, model.zone) : '—')}</Stated>
                {` · ${degText(model.noonAltApp)}`}
              </span>
              {noonOffset !== null && (
                <span className={SUB_CLS}>{noonOffset}{noonShadow !== null && ` · ${fill(t.noonShadow, { r: noonShadow })}`}</span>
              )}
            </td>
          </tr>
          {LEVELS.map(lv => {
            const both = !text[lv.am] && !text[lv.pm];
            const note = both ? levelNote(lv.thr) : null;
            return (
              <tr key={lv.label}>
                {both ? <td aria-hidden="true" /> : timeCell(lv.am, lv.amCell, lv.amCls, 'text-left')}
                <th scope="row" className="sm-lvl" style={lvlStyle(lv.c)}>
                  {t[lv.label]}
                  <span className={SUB_CLS}>{lv.sub}</span>
                  {both && <span className={NOTE_CLS}>{note ?? '—'}</span>}
                </th>
                {both ? <td aria-hidden="true" /> : timeCell(lv.pm, lv.pmCell, lv.pmCls, 'text-right')}
              </tr>
            );
          })}
          <tr>
            <td colSpan={3} className="text-center text-[12px] leading-5 text-slate-400">
              {t.nadir}
              {nadirTT && (
                <>
                  {' · '}
                  <span className={TIME_CLS}><Stated state={cs.nadir} t={t}>{nadirTT.text}<ShiftTag tt={nadirTT} t={t} /></Stated></span>
                </>
              )}
              {` · ${degText(model.nadirAltApp)}`}
            </td>
          </tr>
        </tbody>
        <tbody>
          <tr>
            {goldenMerged || goldenNone ? <td aria-hidden="true" /> : rangeCell('minus4AM', 'goldenEndAM', dur(tm.goldenStartAM, tm.goldenEndAM), 'goldenAM', 'text-left')}
            <th scope="row" className="sm-lvl" style={lvlStyle('#f59e0b')}>
              {t.rowGolden}
              <span className={SUB_CLS}>{t.rowGoldenSub}</span>
              {goldenMerged && (
                <span className={`block mt-1 ${RANGE_CLS}`}>
                  <Stated state={cs.goldenAM} t={t}><RangeText a={text.minus4AM} b={text.minus4PM} t={t} /></Stated>
                </span>
              )}
              {goldenNone && <span className={NOTE_CLS}>{bandNote(-4, 6) ?? '—'}</span>}
            </th>
            {goldenMerged || goldenNone ? <td aria-hidden="true" /> : rangeCell('goldenStartPM', 'minus4PM', dur(tm.goldenStartPM, tm.blueStartPM), 'goldenPM', 'text-right')}
          </tr>
          <tr>
            {blueNone ? <td aria-hidden="true" /> : rangeCell('civilDawn', 'minus4AM', dur(tm.civilDawn, tm.goldenStartAM), 'blueAM', 'text-left')}
            <th scope="row" className="sm-lvl" style={lvlStyle('#60a5fa')}>
              {t.rowBlue}
              <span className={SUB_CLS}>{t.rowBlueSub}</span>
              {blueNone && <span className={NOTE_CLS}>{bandNote(-6, -4) ?? '—'}</span>}
            </th>
            {blueNone ? <td aria-hidden="true" /> : rangeCell('minus4PM', 'civilDusk', dur(tm.blueStartPM, tm.civilDusk), 'bluePM', 'text-right')}
          </tr>
        </tbody>
        <tbody>
          <tr>
            <th scope="row" colSpan={2} className="text-left text-[13px] leading-5 text-slate-200">
              {t.usefulLight}
              <span className={SUB_CLS}>{t.usefulLightSub}</span>
            </th>
            <td className={`text-right ${TIME_CLS}`}>{model.usefulLightSec !== null ? formatHoursMinutes(model.usefulLightSec) : DASH}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
});
