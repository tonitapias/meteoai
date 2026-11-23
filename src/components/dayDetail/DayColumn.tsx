// src/components/dayDetail/DayColumn.tsx
// "La columna del dia": les hores del dia de dalt a baix, una per fila. És la franja del cel de la Previsió girada: a
// l'esquerra, el cel de cada hora (els mateixos colors, SKY_COLORS); al mig, la temperatura com una corba que baixa per
// la columna, amb el marge entre els models globals en gris al darrere; a la dreta, la pluja (un histograma de costat) i
// el vent. Les hores de nit s'enfosqueixen i la sortida i la posta del sol tallen la columna.
//
// Les dades i les regles (sensació, ratxes, finestra seca, escala) són a utils/dayColumn.ts: aquí només es dibuixa.
import { memo, useMemo } from 'react';
import { ArrowUp, Sunrise, Sunset } from 'lucide-react';
import { SKY_COLORS, type SkyKind } from '../../utils/daySky';
import type { DayColumnRow, DryWindow, TempScale } from '../../utils/dayColumn';
import { formatPrecipitation } from '../../utils/formatters';
import type { Language } from '../../translations';

export interface DayColumnLabels {
  /** Noms dels moments (rail de l'esquerra): 0-6, 6-12, 12-18 i 18-24 h. */
  parts: [string, string, string, string];
  rain: string;
  wind: string;
  daylight: string;
  dryWindow: string;
  legendForecast: string;
  legendBand: string;
  legendRain: string;
  legendFeels: string;
  legendGust: string;
  legendSun: string;
  legendWind: string;
  now: string;
  feelsWord: string;
  gustsWord: string;
  rainChanceWord: string;
  sky: Record<SkyKind, string>;
}

interface DayColumnProps {
  rows: ReadonlyArray<DayColumnRow>;
  scale: TempScale | null;
  dryWindow: DryWindow | null;
  /** Posició (en files des de dalt) de la sortida i de la posta del sol, i d'"ara" si el dia és avui. */
  sunriseOffset: number | null;
  sunsetOffset: number | null;
  nowOffset: number | null;
  sunrise: string | null;
  sunset: string | null;
  daylight: string | null;
  labels: DayColumnLabels;
  lang: Language;
}

/** Alçada d'una hora. Fixa a totes les amplades: la corba i les marques es posen en píxels. */
export const ROW_H = 30;

// Carrils: rail dels moments · hora · cel · temperatura · pluja · vent. La capa de sobre (corba, línies del sol, finestra
// seca) fa servir la MATEIXA graella, i per això queda alineada a qualsevol amplada. Literals perquè Tailwind les vegi.
const COLS = 'grid grid-cols-[12px_24px_12px_minmax(0,1fr)_88px_50px] gap-x-2 sm:grid-cols-[18px_30px_14px_minmax(0,1fr)_128px_68px] sm:gap-x-3';
const PAD = 'pl-2 pr-4 sm:pl-4 sm:pr-6';

// La corba ocupa del 5 % al 60 % del carril: a la dreta hi ha d'haver lloc per a la xifra.
const X_FROM = 5;
const X_TO = 60;

const pad2 = (n: number) => String(n).padStart(2, '0');
const f1 = (n: number) => n.toFixed(1);

const skyColor = (row: DayColumnRow): string | undefined =>
  row.kind ? SKY_COLORS[row.kind][row.isDay ? 'day' : 'night'] : undefined;

/** Tram(s) de files seguides que tenen valor (un forat a la sèrie talla la corba, no s'hi inventa res). */
const runsOf = (rows: ReadonlyArray<DayColumnRow>, has: (r: DayColumnRow) => boolean): Array<[number, number]> => {
  const runs: Array<[number, number]> = [];
  let start = -1;
  rows.forEach((r, i) => {
    if (has(r) && start === -1) start = i;
    if (!has(r) && start !== -1) { runs.push([start, i - 1]); start = -1; }
  });
  if (start !== -1) runs.push([start, rows.length - 1]);
  return runs;
};

const smoothPath = (pts: ReadonlyArray<[number, number]>): string => {
  if (pts.length === 0) return '';
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
};

export const DayColumn = memo(function DayColumn({
  rows, scale, dryWindow, sunriseOffset, sunsetOffset, nowOffset, sunrise, sunset, daylight, labels, lang
}: DayColumnProps) {
  const height = rows.length * ROW_H;
  const nowRow = nowOffset !== null ? Math.floor(nowOffset) : null;

  const x = useMemo(() => {
    if (!scale) return () => X_FROM;
    const span = scale.max - scale.min || 1;
    return (v: number) => X_FROM + ((v - scale.min) / span) * (X_TO - X_FROM);
  }, [scale]);

  const geometry = useMemo(() => {
    const yc = (i: number) => i * ROW_H + ROW_H / 2;
    const bandPolys = runsOf(rows, r => r.bandLow !== null && r.bandHigh !== null).map(([a, b]) => {
      const right: string[] = [];
      const left: string[] = [];
      for (let i = a; i <= b; i++) {
        const y = i === a ? i * ROW_H : i === b ? i * ROW_H + ROW_H : yc(i);
        right.push(`${f1(x(rows[i].bandHigh as number))},${f1(y)}`);
        left.push(`${f1(x(rows[i].bandLow as number))},${f1(y)}`);
        if (a === b) {
          right.push(`${f1(x(rows[i].bandHigh as number))},${f1(i * ROW_H + ROW_H)}`);
          left.push(`${f1(x(rows[i].bandLow as number))},${f1(i * ROW_H + ROW_H)}`);
        }
      }
      return [...right, ...left.reverse()].join(' ');
    });
    const lines = runsOf(rows, r => r.temp !== null).map(([a, b]) =>
      smoothPath(rows.slice(a, b + 1).map((r, k) => [x(r.temp as number), yc(a + k)] as [number, number]))
    );
    const temps = rows.map(r => r.temp).filter((v): v is number => v !== null);
    const maxT = temps.length ? Math.max(...temps) : null;
    const minT = temps.length ? Math.min(...temps) : null;
    return {
      bandPolys,
      lines,
      maxRow: maxT === null ? -1 : rows.findIndex(r => r.temp === maxT),
      minRow: minT === null ? -1 : rows.findIndex(r => r.temp === minT)
    };
  }, [rows, x]);

  const hasBand = geometry.bandPolys.length > 0;
  const hasFeels = rows.some(r => r.feels !== null);
  const hasGust = rows.some(r => r.gust !== null);

  // Moments del dia al rail: on comença i acaba cadascun dins les files (un dia de canvi d'hora no té 24 files).
  const blocks = [0, 6, 12, 18].map((from, k) => {
    const idx = rows.map((r, i) => (r.hour >= from && r.hour < from + 6 ? i : -1)).filter(i => i !== -1);
    return idx.length >= 4 ? { label: labels.parts[k], top: idx[0] * ROW_H, height: idx.length * ROW_H } : null;
  });

  const rowAria = (r: DayColumnRow): string => {
    const parts = [`${pad2(r.hour)} h`];
    if (r.temp !== null) parts.push(`${Math.round(r.temp)}°`);
    if (r.feels !== null) parts.push(`${labels.feelsWord} ${Math.round(r.feels)}°`);
    if (r.kind) parts.push(labels.sky[r.kind]);
    if (r.precipProb !== null && r.precipProb > 0) parts.push(`${Math.round(r.precipProb)}% ${labels.rainChanceWord}`);
    if ((r.precip ?? 0) > 0 || (r.snowfall ?? 0) > 0) parts.push(formatPrecipitation(r.precip, r.snowfall, lang));
    if (r.wind !== null) parts.push(`${labels.wind.toLocaleLowerCase()} ${Math.round(r.wind)} km/h`);
    if (r.gust !== null) parts.push(`${labels.gustsWord} ${Math.round(r.gust)} km/h`);
    return parts.join(', ');
  };

  return (
    <div data-testid="day-column">
      {/* Sol i finestra seca: el que tallen les línies i el claudàtor de la columna */}
      {(sunrise || dryWindow) && (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${PAD} pb-3 font-mono text-[11px] text-slate-400 tabular-nums`}>
          {sunrise && sunset && (
            <span data-testid="sun-times" className="flex items-center gap-1.5">
              <Sunrise className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              <span className="text-amber-200">{sunrise}</span>
              <Sunset className="w-3.5 h-3.5 ml-1.5 text-indigo-300" aria-hidden="true" />
              <span className="text-indigo-200">{sunset}</span>
              {daylight && <span data-testid="daylight" className="ml-1 text-slate-400">· {daylight} {labels.daylight}</span>}
            </span>
          )}
          {dryWindow && (
            <span data-testid="dry-window" className="flex items-center gap-1.5 text-slate-300">
              <span aria-hidden="true" className="w-1 h-3 rounded-l-sm border-l-2 border-y border-slate-300/60"></span>
              {labels.dryWindow} {pad2(dryWindow.from)}–{pad2(dryWindow.to)} h
            </span>
          )}
        </div>
      )}

      {/* Capçalera dels carrils: l'escala de temperatura, i pluja i vent */}
      <div aria-hidden="true" className={`${COLS} ${PAD} h-6 items-end pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a879b]`}>
        <span></span>
        <span className="tracking-normal normal-case">h</span>
        <span></span>
        <span className="relative h-3.5 normal-case tracking-normal">
          {scale?.ticks.map(t => (
            <span key={t} className="absolute -translate-x-1/2 leading-none" style={{ left: `${f1(x(t))}%` }}>{t}°</span>
          ))}
        </span>
        <span>{labels.rain}</span>
        <span className="text-right">{labels.wind}</span>
      </div>

      <div className="relative" style={{ height }}>
        {/* Les hores */}
        <div className="absolute inset-0 flex flex-col">
          {rows.map((r, i) => {
            const isNow = nowRow !== null && i === nowRow;
            const isPast = nowRow !== null && i < nowRow;
            const boundary = i > 0 && r.hour % 6 === 0;
            const prob = r.precipProb !== null ? Math.round(r.precipProb) : null;
            const amount = (r.precip ?? 0) > 0 || (r.snowfall ?? 0) > 0 ? formatPrecipitation(r.precip, r.snowfall, lang) : null;
            const first = i === 0;
            const last = i === rows.length - 1;
            return (
              <div
                key={r.time}
                data-testid="hour-row"
                data-now={isNow}
                aria-current={isNow ? 'time' : undefined}
                className={`relative ${COLS} ${PAD} h-[30px] shrink-0 items-center border-t ${boundary ? 'border-white/[0.09]' : 'border-white/[0.035]'} ${r.isDay ? '' : 'bg-black/20'} ${isPast ? 'opacity-50' : ''}`}
              >
                <span className="sr-only">{rowAria(r)}</span>
                <span aria-hidden="true"></span>
                <span aria-hidden="true" className={`font-mono text-[11px] tabular-nums ${r.hour % 6 === 0 ? 'font-semibold text-slate-200' : r.isDay ? 'text-slate-400' : 'text-[#7a879b]'}`}>
                  {pad2(r.hour)}
                </span>
                <span
                  aria-hidden="true"
                  data-testid="sky-cell"
                  data-kind={r.kind ?? ''}
                  className={`self-stretch -my-px ${first ? 'rounded-t-md' : ''} ${last ? 'rounded-b-md' : ''} ${r.kind ? '' : 'bg-white/[0.05]'}`}
                  style={r.kind ? { backgroundColor: skyColor(r) } : undefined}
                ></span>
                <span aria-hidden="true"></span>
                <span aria-hidden="true" className="relative h-[22px] flex items-center justify-between px-1.5">
                  {prob !== null && prob > 0 && (
                    <span className="absolute inset-y-0 left-0 rounded bg-cyan-400/[0.16]" style={{ width: `${prob}%` }}></span>
                  )}
                  <span className={`relative font-mono text-[11px] tabular-nums ${prob !== null && prob >= 20 ? 'text-cyan-300' : 'text-slate-400'}`}>
                    {prob !== null && prob > 0 ? `${prob}%` : ''}
                  </span>
                  {amount && <span className="relative font-mono text-[11px] text-blue-300 whitespace-nowrap">{amount}</span>}
                </span>
                <span aria-hidden="true" className="flex items-center justify-end gap-1 font-mono text-[11.5px] tabular-nums text-slate-300">
                  {r.wind !== null ? (
                    <>
                      {r.windDir !== null && (
                        <ArrowUp className="w-3 h-3 text-teal-300 shrink-0" strokeWidth={2.6} style={{ transform: `rotate(${(r.windDir + 180) % 360}deg)` }} />
                      )}
                      {Math.round(r.wind)}
                      {r.gust !== null && <span data-testid="gust" className="text-[10.5px] text-amber-300">{Math.round(r.gust)}</span>}
                    </>
                  ) : (
                    <span className="text-slate-600">--</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Capa de sobre, amb la mateixa graella que les files */}
        <div aria-hidden="true" className={`absolute inset-0 pointer-events-none ${COLS} ${PAD}`}>
          {/* Moments del dia */}
          <div className="relative col-start-1 row-start-1">
            {blocks.map((b, k) => b && (
              <span
                key={k}
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center font-mono text-[9.5px] uppercase tracking-[0.22em] text-[#7a879b] whitespace-nowrap"
                style={{ top: b.top, height: b.height, writingMode: 'vertical-rl', transform: 'translateX(-50%) rotate(180deg)' }}
              >
                {b.label}
              </span>
            ))}
          </div>

          {/* Sortida i posta del sol, i ara */}
          <div className="relative col-start-2 col-end-7 row-start-1">
            {sunriseOffset !== null && (
              <span data-testid="sunrise-line" className="absolute inset-x-0 border-t border-dashed border-amber-300/50" style={{ top: sunriseOffset * ROW_H }}></span>
            )}
            {sunsetOffset !== null && (
              <span data-testid="sunset-line" className="absolute inset-x-0 border-t border-dashed border-indigo-300/50" style={{ top: sunsetOffset * ROW_H }}></span>
            )}
            {nowOffset !== null && (
              <span data-testid="now-line" className="absolute inset-x-0 -mt-px h-0.5 rounded-full bg-slate-50" style={{ top: nowOffset * ROW_H }}></span>
            )}
          </div>

          {/* Temperatura: marge entre models, corba, punts i xifres */}
          <div className="relative col-start-4 row-start-1">
            <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
              {scale?.ticks.map(t => (
                <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={height} stroke="rgba(255,255,255,0.045)" vectorEffect="non-scaling-stroke" />
              ))}
              {geometry.bandPolys.map((pts, k) => <polygon key={k} points={pts} fill="rgba(148,163,184,0.14)" />)}
              {geometry.lines.map((d, k) => (
                <path key={k} d={d} fill="none" stroke="#818cf8" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
            {rows.map((r, i) => {
              if (r.temp === null) return null;
              const y = i * ROW_H + ROW_H / 2;
              const xt = x(r.temp);
              const xf = r.feels !== null ? x(r.feels) : null;
              const isMax = i === geometry.maxRow;
              const isMin = i === geometry.minRow;
              return (
                <span key={r.time}>
                  {xf !== null && (
                    <>
                      <span className="absolute h-px bg-slate-400/40" style={{ top: y, left: `${f1(Math.min(xt, xf))}%`, width: `${f1(Math.abs(xt - xf))}%` }}></span>
                      <span data-testid="feels-mark" className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full border border-slate-300/80 bg-[#0b0d14]" style={{ top: y, left: `${f1(xf)}%` }}></span>
                    </>
                  )}
                  <span className="absolute w-[7px] h-[7px] -ml-[3.5px] -mt-[3.5px] rounded-full bg-indigo-400 ring-2 ring-[#0b0d14]" style={{ top: y, left: `${f1(xt)}%` }}></span>
                  <span
                    data-testid="temp-label"
                    className={`absolute -translate-y-1/2 ml-[7px] text-[11.5px] leading-none tabular-nums whitespace-nowrap ${isMax ? 'font-semibold text-slate-50' : isMin ? 'font-semibold text-indigo-200' : 'text-slate-300'}`}
                    style={{ top: y, left: `${f1(Math.max(xt, xf ?? xt))}%` }}
                  >
                    {Math.round(r.temp)}°
                    {r.feels !== null && <span className="ml-1 text-[10px] font-normal text-slate-400">({Math.round(r.feels)}°)</span>}
                  </span>
                </span>
              );
            })}
          </div>

          {/* Finestra seca: un claudàtor a tocar de la pluja */}
          <div className="relative col-start-5 row-start-1">
            {dryWindow && (
              <span
                data-testid="dry-bracket"
                className="absolute -left-[7px] w-1 rounded-l-sm border-l-2 border-y border-slate-300/45"
                style={{ top: dryWindow.firstRow * ROW_H + 5, height: (dryWindow.lastRow - dryWindow.firstRow + 1) * ROW_H - 10 }}
              ></span>
            )}
          </div>
        </div>
      </div>

      <div className={`flex flex-wrap gap-x-4 gap-y-2 ${PAD} pt-3 pb-4 mt-px border-t border-white/[0.06] font-mono text-[10.5px] text-slate-400`}>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 rounded-full bg-indigo-400" aria-hidden="true"></span>{labels.legendForecast}</span>
        {hasBand && <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-slate-400/30" aria-hidden="true"></span>{labels.legendBand}</span>}
        {hasFeels && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-slate-300/80" aria-hidden="true"></span>{labels.legendFeels}</span>}
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-cyan-400/30" aria-hidden="true"></span>{labels.legendRain}</span>
        {hasGust && <span className="text-amber-300">{labels.legendGust}</span>}
        {(sunriseOffset !== null || sunsetOffset !== null) && (
          <span className="flex items-center gap-1.5"><span className="w-3.5 border-t border-dashed border-amber-300/70" aria-hidden="true"></span>{labels.legendSun}</span>
        )}
        {nowOffset !== null && (
          <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 rounded-full bg-slate-50" aria-hidden="true"></span>{labels.now.toLocaleLowerCase()}</span>
        )}
        <span>{labels.legendWind}</span>
      </div>
    </div>
  );
});
