// src/utils/sky/nightSky.ts
// El plafó «Aquesta nit» de la pestanya Cel: la nit de la posta a la sortida del sol, amb la lluna (alçada cada 10 min),
// el cel del model hora a hora (la mateixa franja que Previsió: els codis del motor de daySky) i la foscor (les fases de
// llum del sol, les mateixes que el modal Cicle solar). Pur, sense React.
import * as SunCalc from 'suncalc';
import { buildSolarDay, geometricAltitude, lightPhase, type LightPhase, type SolarDayModel } from '../solar/solarDay';
import { addDays, localClock, localDateOf, wallTimeToUtcMs, zonedDayStartMs, type ZoneCtx } from '../solar/solarTime';
import { omEdgesFor, type SolarDaily } from '../solar/solarForecast';
import type { SkyHour, SkyKind } from '../daySky';
import { getHourlyEffectiveCloudCover } from '../hourlyWeatherCode';
import type { HourlySeries } from '../hourlyWeatherCode';

const MIN = 60000;
const HOUR = 3600000;
const DAY = 86400000;

/** Un tram de la finestra, en fraccions (0 = posta, 1 = sortida). */
export interface NightSpan { from: number; to: number }
export interface NightSkyCell extends NightSpan { kind: SkyKind | null; isDay: boolean; startMs: number; endMs: number }
export interface DarkSegment extends NightSpan { phase: LightPhase }
export interface MoonSample { f: number; alt: number }
export interface NightTick { f: number; label: string }

export interface NightWindow {
  startMs: number;
  endMs: number;
  /** 'night': nit polar (el sol no surt): 24 h de migdia a migdia. */
  polar: 'none' | 'night';
}

export interface NightSky extends NightWindow {
  /** Fases de llum del sol al llarg de la finestra (la franja «Foscor»). */
  darkness: DarkSegment[];
  /** Nit fosca (sol per sota de −18°) dins de la finestra; null si no s'hi arriba (estiu a latituds altes). */
  dark: { startMs: number; endMs: number } | null;
  /** Alçada aparent de la lluna (graus) cada 10 min. */
  moon: MoonSample[];
  /** El punt més alt de la lluna dins de la finestra, si hi surt. */
  moonPeak: { ms: number; alt: number } | null;
  /** Primera sortida i primera posta de la lluna dins de la finestra (creuant l'horitzó). */
  moonRiseMs: number | null;
  moonSetMs: number | null;
  /** El cel de cada hora (codis del motor, com la franja de Previsió); retallat a la finestra. */
  sky: NightSkyCell[];
  /** Cobertura efectiva de núvols (la que decideix el codi) mínima i màxima de les hores de la finestra. */
  cloudRange: { min: number; max: number } | null;
  /** Marques del regle: cada 3 h de rellotge local (18, 21, 00...). */
  ticks: NightTick[];
}

export interface NightSkyInput {
  nowMs: number;
  lat: number;
  lon: number;
  zone: ZoneCtx;
  daily?: SolarDaily | null;
  daySky?: Record<string, SkyHour[]> | null;
  hourly?: HourlySeries | null;
}

const modelOf = (dateStr: string, lat: number, lon: number, zone: ZoneCtx, daily?: SolarDaily | null): SolarDayModel | null =>
  buildSolarDay({ dateStr, lat, lon, zone, ...omEdgesFor(daily, dateStr) }, { lite: true });

/**
 * La nit que toca ara: si el sol ja s'ha post (o encara no ha sortit), la que està passant; de dia, la que ve. Va de la
 * posta a la primera sortida que la segueix (les hores d'Open-Meteo si quadren amb l'astronomia, com el modal). Nit
 * polar: 24 h de migdia a migdia. Sol de mitjanit (no es pon): null.
 */
export function findNightWindow(nowMs: number, lat: number, lon: number, zone: ZoneCtx, daily?: SolarDaily | null): NightWindow | null {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const today = localDateOf(nowMs, zone);
  const models = [-1, 0, 1, 2].map(k => modelOf(addDays(today, k), lat, lon, zone, daily));
  const sets: number[] = [];
  const rises: number[] = [];
  for (const m of models) {
    if (!m || m.polar !== 'none') continue;
    if (m.t.sunset !== null) sets.push(m.t.sunset);
    if (m.t.sunrise !== null) rises.push(m.t.sunrise);
  }
  sets.sort((a, b) => a - b);
  rises.sort((a, b) => a - b);
  for (const s of sets) {
    const r = rises.find(x => x > s);
    if (r !== undefined && r > nowMs) return { startMs: s, endMs: r, polar: 'none' };
  }
  if (models[1]?.polar === 'night') {
    const noon = zonedDayStartMs(today, zone) + 12 * HOUR;
    const startMs = nowMs < noon ? noon - DAY : noon;
    return { startMs, endMs: startMs + DAY, polar: 'night' };
  }
  return null;
}

const fracOf = (ms: number, w: Pick<NightWindow, 'startMs' | 'endMs'>) => (ms - w.startMs) / (w.endMs - w.startMs);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Fases de llum del sol cada 5 min, agrupades en trams seguits. */
function darknessOf(w: NightWindow, lat: number, lon: number): DarkSegment[] {
  const n = Math.max(1, Math.round((w.endMs - w.startMs) / (5 * MIN)));
  const half = 0.5 / n;
  const out: DarkSegment[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const alt = SunCalc.getPosition(new Date(w.startMs + (w.endMs - w.startMs) * f), lat, lon).altitude;
    const phase = lightPhase(geometricAltitude(alt));
    const from = clamp01(f - half), to = clamp01(f + half);
    const last = out[out.length - 1];
    if (last && last.phase === phase) last.to = to;
    else out.push({ from, to, phase });
  }
  return out;
}

/** Inici i fi de la nit fosca (crepuscle astronòmic) dins de la finestra, dels models del modal. */
function darkOf(w: NightWindow, lat: number, lon: number, zone: ZoneCtx, daily?: SolarDaily | null): NightSky['dark'] {
  const first = localDateOf(w.startMs, zone);
  const models = [0, 1].map(k => modelOf(addDays(first, k), lat, lon, zone, daily));
  const inside = (ms: number | null): ms is number => ms !== null && ms >= w.startMs && ms <= w.endMs;
  const dusks = models.map(m => m?.t.astroDusk ?? null).filter(inside).sort((a, b) => a - b);
  const startMs = dusks[0];
  if (startMs === undefined) return null;
  const dawns = models.map(m => m?.t.astroDawn ?? null).filter(inside).filter(ms => ms > startMs).sort((a, b) => a - b);
  return { startMs, endMs: dawns[0] ?? w.endMs };
}

function moonOf(w: NightWindow, lat: number, lon: number) {
  const n = Math.max(1, Math.round((w.endMs - w.startMs) / (10 * MIN)));
  const moon: MoonSample[] = [];
  let peak: { ms: number; alt: number } | null = null;
  let riseMs: number | null = null, setMs: number | null = null;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const ms = w.startMs + (w.endMs - w.startMs) * f;
    const alt = SunCalc.getMoonPosition(new Date(ms), lat, lon).altitude;
    const prev = moon[moon.length - 1];
    if (prev) {
      const crossMs = () => {
        const k = prev.alt / (prev.alt - alt);
        return Math.round(w.startMs + (w.endMs - w.startMs) * (prev.f + (f - prev.f) * k));
      };
      if (riseMs === null && prev.alt <= 0 && alt > 0) riseMs = crossMs();
      if (setMs === null && prev.alt > 0 && alt <= 0) setMs = crossMs();
    }
    moon.push({ f, alt });
    if (alt > 0 && (peak === null || alt > peak.alt)) peak = { ms, alt };
  }
  return { moon, peak, riseMs, setMs };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * El cel de cada hora d'un tram (la nit, o el dia del plafó del sol), de la franja de Previsió (daySky), retallat al tram;
 * i la cobertura efectiva de núvols mínima i màxima d'aquestes hores.
 */
export function skyCellsFor(w: Pick<NightWindow, 'startMs' | 'endMs'>, zone: ZoneCtx, daySky?: Record<string, SkyHour[]> | null, hourly?: HourlySeries | null) {
  const cells: NightSkyCell[] = [];
  const covers: number[] = [];
  if (!daySky) return { cells, cloudRange: null };
  const times: unknown = hourly?.time;
  const indexOfTime = new Map<string, number>();
  if (Array.isArray(times)) times.forEach((t, i) => { if (typeof t === 'string') indexOfTime.set(t.slice(0, 13), i); });
  const lastDate = localDateOf(w.endMs - 1, zone);
  for (let date = localDateOf(w.startMs, zone), guard = 0; guard < 4; date = addDays(date, 1), guard++) {
    for (const h of daySky[date] ?? []) {
      const key = `${date}T${pad2(h.hour)}`;
      const start = wallTimeToUtcMs(`${key}:00`, zone);
      if (start === null) continue;
      const from = Math.max(start, w.startMs), to = Math.min(start + HOUR, w.endMs);
      if (to <= from) continue;
      cells.push({ from: fracOf(from, w), to: fracOf(to, w), kind: h.kind, isDay: h.isDay, startMs: from, endMs: to });
      const idx = indexOfTime.get(key);
      const cover = hourly && idx !== undefined ? getHourlyEffectiveCloudCover(hourly, idx) : null;
      if (cover !== null) covers.push(cover);
    }
    if (date === lastDate) break;
  }
  cells.sort((a, b) => a.startMs - b.startMs);
  const cloudRange = covers.length > 0 ? { min: Math.round(Math.min(...covers)), max: Math.round(Math.max(...covers)) } : null;
  return { cells, cloudRange };
}

/** Marques del regle: cada 3 h de rellotge local, sense les dels extrems (no hi cabrien). */
function ticksOf(w: NightWindow, zone: ZoneCtx): NightTick[] {
  const out: NightTick[] = [];
  const step = 15 * MIN;
  for (let ms = Math.ceil(w.startMs / step) * step; ms < w.endMs; ms += step) {
    const clock = localClock(ms, zone);
    if (!clock.endsWith(':00')) continue;
    const hour = Number(clock.slice(0, 2));
    const f = fracOf(ms, w);
    if (hour % 3 === 0 && f > 0.03 && f < 0.97) out.push({ f, label: clock.slice(0, 2) });
  }
  return out;
}

/** Model complet de la nit que toca ara (vegeu findNightWindow). null: sol de mitjanit o dades no vàlides. */
export function buildNightSky(input: NightSkyInput): NightSky | null {
  const w = findNightWindow(input.nowMs, input.lat, input.lon, input.zone, input.daily);
  return w ? nightSkyFor(w, input) : null;
}

/** El mateix model per a una finestra donada (la nit següent, per exemple). */
export function nightSkyFor(w: NightWindow, input: Omit<NightSkyInput, 'nowMs'>): NightSky {
  const { lat, lon, zone, daily, daySky, hourly } = input;
  const { moon, peak, riseMs, setMs } = moonOf(w, lat, lon);
  const { cells, cloudRange } = skyCellsFor(w, zone, daySky, hourly);
  return {
    ...w,
    darkness: darknessOf(w, lat, lon),
    dark: darkOf(w, lat, lon, zone, daily),
    moon,
    moonPeak: peak,
    moonRiseMs: riseMs,
    moonSetMs: setMs,
    sky: cells,
    cloudRange,
    ticks: ticksOf(w, zone),
  };
}

/** La nit que segueix la d'ara (per a la línia «Demà a la nit»). */
export function nextNightWindow(current: NightWindow, lat: number, lon: number, zone: ZoneCtx, daily?: SolarDaily | null): NightWindow | null {
  return findNightWindow(current.endMs + MIN, lat, lon, zone, daily);
}

/** Cels que tapen la lluna o el sol: núvol, boira i precipitació. */
const HIDING: ReadonlySet<SkyKind> = new Set(['cloudy', 'fog', 'rain', 'snow', 'storm']);

/** Trams on el cel previst tapa la lluna o el sol (la corba s'hi dibuixa puntejada). */
export function cloudHiddenSpans(sky: ReadonlyArray<NightSkyCell>): NightSpan[] {
  const out: NightSpan[] = [];
  for (const c of sky) {
    if (!c.kind || !HIDING.has(c.kind)) continue;
    const last = out[out.length - 1];
    if (last && Math.abs(last.to - c.from) < 1e-9) last.to = c.to;
    else out.push({ from: c.from, to: c.to });
  }
  return out;
}

/** Fracció de la finestra d'un instant (null si hi cau fora). */
export function nightFraction(ms: number, w: NightWindow): number | null {
  const f = fracOf(ms, w);
  return f >= 0 && f <= 1 ? f : null;
}
