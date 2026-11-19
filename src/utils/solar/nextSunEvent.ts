// src/utils/solar/nextSunEvent.ts
// La pròxima sortida o posta del sol amb la seva hora local ("17:25"): la mateixa que compta enrere la targeta Cicle
// solar (SunArcWidget), amb el mateix model del dia (buildSolarDay: hores d'Open-Meteo si quadren amb l'astronomia, si
// no suncalc) i el mateix criteri (upcomingRiseSet). En fa ús el nom accessible de la targeta (detailCardLabel.ts):
// una hora no canvia cada minut, i així no es desfasa del compte enrere que es veu. Pur, sense React.
import { buildSolarDay, upcomingRiseSet, type SolarDayModel } from './solarDay';
import { omEdgesFor, type SolarDaily } from './solarForecast';
import { addDays, localClock, localDateOf, makeZoneCtx } from './solarTime';

export interface NextSunEvent {
  kind: 'sunrise' | 'sunset';
  /** "HH:MM" local, el mateix text que les efemèrides (el d'Open-Meteo quan es fa servir). */
  time: string;
}

/**
 * La pròxima sortida o posta a partir de `nowMs`: abans de sortir el sol, la sortida d'avui; de dia, la posta; després,
 * la sortida de demà. Null sense coordenades vàlides o en un dia polar (no n'hi ha cap).
 */
export function nextSunEvent(
  nowMs: number,
  lat: number | null | undefined,
  lon: number | null | undefined,
  timezone: string | null | undefined,
  utcOffsetSec: number | null | undefined,
  daily: SolarDaily | null | undefined
): NextSunEvent | null {
  if (!Number.isFinite(nowMs)) return null;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  // Les mateixes crides que la targeta (avui sencer, ahir i demà lleugers): la memòria cau les comparteix.
  const zone = makeZoneCtx(timezone ?? null, utcOffsetSec ?? 0);
  const today = localDateOf(nowMs, zone);
  const model = buildSolarDay({ dateStr: today, lat, lon, zone, ...omEdgesFor(daily, today) });
  if (!model) return null;
  const y = addDays(today, -1);
  const t = addDays(today, 1);
  const yesterday = buildSolarDay({ dateStr: y, lat, lon, zone, ...omEdgesFor(daily, y) }, { lite: true });
  const tomorrow = buildSolarDay({ dateStr: t, lat, lon, zone, ...omEdgesFor(daily, t) }, { lite: true });

  const upcoming = upcomingRiseSet(nowMs, model, tomorrow, yesterday);
  if (!upcoming) return null;

  // El text de l'hora surt del dia que té l'esdeveniment (la posta tardana pot ser la d'ahir; la sortida, la de demà).
  const owner = [model, tomorrow, yesterday].find(
    (m): m is SolarDayModel => m !== null && (upcoming.kind === 'sunrise' ? m.t.sunrise : m.t.sunset) === upcoming.ms
  );
  const label = owner ? (upcoming.kind === 'sunrise' ? owner.riseLabel : owner.setLabel) : null;
  return { kind: upcoming.kind, time: label?.text ?? localClock(upcoming.ms, zone) };
}
