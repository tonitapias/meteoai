import { describe, it, expect, beforeEach } from 'vitest';
import * as SunCalc from 'suncalc';
import {
  buildSolarDay, clearSolarDayCache, sunTimesForLocalDay, geometricAltitude, lightPhase, markerTone,
  findCrossings, resolveSunEdges, eventList, nextEvent, upcomingRiseSet, ephemerisCellStates, nadirInDay,
  astroLengthFor, noonAltFor, rangeAltMax, clockAtMinute, usefulLightSec, type SolarDayModel,
} from './solarDay';
import { makeZoneCtx, zonedDayStartMs, addDays, localClock, localDateOf, type ZoneCtx } from './solarTime';
import { formatCountdown, formatRange } from './solarFormat';
import { daylightSeconds } from '../daylight';
import { formatHoursMinutes } from '../formatters';

interface Place { lat: number; lon: number; zone: ZoneCtx }
const place = (lat: number, lon: number, tz: string): Place => ({ lat, lon, zone: makeZoneCtx(tz, 0) });

const GIRONA = place(41.98, 2.82, 'Europe/Madrid');
const TROMSO = place(69.65, 18.96, 'Europe/Oslo');
const REYKJAVIK = place(64.15, -21.94, 'Atlantic/Reykjavik');
const HELSINKI = place(60.17, 24.94, 'Europe/Helsinki');
const ALERT = place(82.50, -62.35, 'America/Toronto');
const MCMURDO = place(-77.85, 166.67, 'Pacific/Auckland');
const QUITO = place(-0.18, -78.47, 'America/Guayaquil');

const model = (p: Place, dateStr: string, omRise?: string, omSet?: string, lite = false): SolarDayModel => {
  const m = buildSolarDay({ dateStr, lat: p.lat, lon: p.lon, zone: p.zone, omRise, omSet }, { lite });
  if (!m) throw new Error(`sense model per a ${dateStr}`);
  return m;
};

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** Hora local de l'instant igual a l'esperada amb ±1 min (els valors de referència són de suncalc 2.0.1). */
const expectClock = (ms: number | null | undefined, z: ZoneCtx, hhmm: string) => {
  expect(ms, `s'esperava ${hhmm}`).not.toBeNull();
  const got = localClock(ms as number, z);
  const d = Math.abs(toMin(got) - toMin(hhmm));
  expect(Math.min(d, 1440 - d), `${got} ≠ ${hhmm}`).toBeLessThanOrEqual(1);
};
/** Instant d'una hora local "HH:MM" del 2026-10-07 a Girona (CEST, UTC+2). */
const gironaAt = (hhmm: string) => Date.UTC(2026, 9, 7, Number(hhmm.slice(0, 2)) - 2, Number(hhmm.slice(3, 5)));

beforeEach(() => clearSolarDayCache());

describe('sunTimesForLocalDay (ancorar, verificar, reancorar)', () => {
  const cases: [string, number, number, string, string][] = [
    ['Girona', 41.98, 2.82, 'Europe/Madrid', '13:36'],
    ['Auckland', -36.85, 174.76, 'Pacific/Auckland', '13:08'],
    ['Apia', -13.83, -171.76, 'Pacific/Apia', '12:15'],
    ['Kiritimati', 1.87, -157.43, 'Pacific/Kiritimati', '12:17'],
    ['Chatham', -43.95, -176.56, 'Pacific/Chatham', '13:19'],
    ['Honolulu', 21.31, -157.86, 'Pacific/Honolulu', '12:19'],
  ];
  for (const [name, lat, lon, tz, noon] of cases) {
    it(`${name}: el migdia solar cau dins del dia local 2026-10-07 (${noon})`, () => {
      const z = makeZoneCtx(tz, 0);
      const s = zonedDayStartMs('2026-10-07', z), e = zonedDayStartMs('2026-10-08', z);
      const t = sunTimesForLocalDay(s, e, lat, lon);
      expect(t).not.toBeNull();
      expect(localDateOf(t!.solarNoon.getTime(), z)).toBe('2026-10-07');
      expectClock(t!.solarNoon.getTime(), z, noon);
    });
  }

  it('regressió: ancorar al migdia local falla a Auckland (cal k = +1)', () => {
    const z = makeZoneCtx('Pacific/Auckland', 0);
    const s = zonedDayStartMs('2026-10-07', z), e = zonedDayStartMs('2026-10-08', z);
    const naive = SunCalc.getTimes(new Date((s + e) / 2), -36.85, 174.76).solarNoon.getTime();
    expect(naive >= s && naive < e).toBe(false);
  });

  it('regressió: ancorar a migdia UTC (codi antic) falla a Apia, Kiritimati i Chatham', () => {
    for (const [lat, lon, tz] of [[-13.83, -171.76, 'Pacific/Apia'], [1.87, -157.43, 'Pacific/Kiritimati'], [-43.95, -176.56, 'Pacific/Chatham']] as const) {
      const z = makeZoneCtx(tz, 0);
      const s = zonedDayStartMs('2026-10-07', z), e = zonedDayStartMs('2026-10-08', z);
      const naive = SunCalc.getTimes(new Date(Date.UTC(2026, 9, 7, 12)), lat, lon).solarNoon.getTime();
      expect(naive >= s && naive < e, tz).toBe(false);
    }
  });
});

describe('Girona 2026-10-07, només astronomia', () => {
  it('els 13 esdeveniments, el −4° i la mitjanit solar', () => {
    const m = model(GIRONA, '2026-10-07');
    const z = GIRONA.zone;
    const expected: [keyof SolarDayModel['t'], string][] = [
      ['astroDawn', '06:19'], ['nauticalDawn', '06:51'], ['civilDawn', '07:24'], ['goldenStartAM', '07:34'],
      ['sunrise', '07:52'], ['goldenEndAM', '08:29'], ['noon', '13:36'], ['goldenStartPM', '18:43'],
      ['sunset', '19:20'], ['blueStartPM', '19:37'], ['civilDusk', '19:48'], ['nauticalDusk', '20:20'],
      ['astroDusk', '20:52'], ['nadir', '01:36'],
    ];
    for (const [k, hhmm] of expected) expectClock(m.t[k], z, hhmm);
    expect(m.text.minus4AM?.text).toBe(m.text.goldenStartAM?.text);
    expect(m.text.minus4PM?.text).toBe(m.text.blueStartPM?.text);
    expect(m.noonAltApp).toBeCloseTo(42.4, 0);
    expect(Math.abs(m.noonAltApp - 42.4)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(m.nadirAltApp - -53.0)).toBeLessThanOrEqual(0.1);
    expect(eventList(m)).toHaveLength(13);
  });

  it('azimuts, durada astronòmica, font i estat polar', () => {
    const m = model(GIRONA, '2026-10-07');
    expect(m.riseSetSource).toBe('astronomy');
    expect(m.riseAz!).toBeCloseTo(96.7, 1);
    expect(m.setAz!).toBeCloseTo(263.1, 1);
    expect(Math.abs(m.astroLengthSec! / 60 - 688.3)).toBeLessThan(0.1);
    expect(formatHoursMinutes(m.astroLengthSec)).toBe('11h 28m');
    expect(m.polar).toBe('none');
    expect(m.spanMin).toBe(1440);
    expect(m.altApp).toHaveLength(97);
    expect(m.riseLabel).toEqual({ text: '07:52', shift: 0 });
  });

  it('ordre: els esdeveniments surten per ordre cronològic', () => {
    const list = eventList(model(GIRONA, '2026-10-07'));
    expect(list.map(e => e.key)).toEqual([
      'astroDawn', 'nauticalDawn', 'civilDawn', 'goldenStartAM', 'sunrise', 'goldenEndAM', 'noon',
      'goldenStartPM', 'sunset', 'blueStartPM', 'civilDusk', 'nauticalDusk', 'astroDusk',
    ]);
  });
});

describe('sortida i posta resoltes (paritat amb la targeta)', () => {
  it('parell d\'Open-Meteo a ≤ 10 min de suncalc: es fa servir tal com ve', () => {
    const m = model(GIRONA, '2026-10-07', '2026-10-07T07:51', '2026-10-07T19:20');
    expect(m.riseSetSource).toBe('openMeteo');
    expect(m.riseLabel).toEqual({ text: '07:51', shift: 0 });
    expect(m.setLabel).toEqual({ text: '19:20', shift: 0 });
    expect(m.t.sunrise).toBe(Date.UTC(2026, 9, 7, 5, 51));
    expect(m.dayLengthSec).toBe(41340);
    expect(m.dayLengthSec).toBe(daylightSeconds('2026-10-07T07:51', '2026-10-07T19:20'));
    expect(formatHoursMinutes(m.dayLengthSec)).toBe('11h 29m');
    expect(m.text.sunrise?.text).toBe('07:51');
    // La Δ continua sent astronòmica.
    expect(Math.abs(m.astroLengthSec! / 60 - 688.3)).toBeLessThan(0.1);
  });

  it('una hora a més de 10 min de suncalc: astronomia per a totes dues', () => {
    const m = model(GIRONA, '2026-10-07', '2026-10-07T08:15', '2026-10-07T19:20');
    expect(m.riseSetSource).toBe('astronomy');
    expect(m.riseLabel?.text).toBe('07:52');
    expect(m.setLabel?.text).toBe('19:20');
  });

  it('text mal format o absent: astronomia', () => {
    expect(model(GIRONA, '2026-10-07', 'demà', '2026-10-07T19:20').riseSetSource).toBe('astronomy');
    expect(model(GIRONA, '2026-10-07', '2026-10-07T07:51', undefined).riseSetSource).toBe('astronomy');
    const z = GIRONA.zone;
    const s = zonedDayStartMs('2026-10-07', z), e = zonedDayStartMs('2026-10-08', z);
    const sc = sunTimesForLocalDay(s, e, GIRONA.lat, GIRONA.lon)!;
    expect(resolveSunEdges(sc, '2026-10-07T19:20', '2026-10-07T07:51', z).source).toBe('astronomy');
  });

  it('dia polar: mai el parell d\'Open-Meteo', () => {
    const m = model(TROMSO, '2026-06-21', '2026-06-21T00:00', '2026-06-21T23:59');
    expect(m.riseSetSource).toBe('astronomy');
    expect(m.riseLabel).toBeNull();
  });
});

describe('Δ respecte del dia anterior', () => {
  it('Girona 10-08 respecte de 10-07: −166 s', () => {
    const d = astroLengthFor('2026-10-08', GIRONA.lat, GIRONA.lon, GIRONA.zone)!
      - astroLengthFor('2026-10-07', GIRONA.lat, GIRONA.lon, GIRONA.zone)!;
    expect(Math.abs(d - -166)).toBeLessThanOrEqual(1);
    expect(astroLengthFor('2026-10-07', GIRONA.lat, GIRONA.lon, GIRONA.zone)).toBe(model(GIRONA, '2026-10-07').astroLengthSec);
  });
});

describe('latituds altes', () => {
  it('Tromsø 2026-06-21: sol de mitjanit', () => {
    const m = model(TROMSO, '2026-06-21');
    const z = TROMSO.zone;
    expect(m.polar).toBe('day');
    expect(m.dayLengthSec).toBe(86400);
    expect(m.astroLengthSec).toBe(86400);
    expect(m.t.sunrise).toBeNull();
    expect(m.t.sunset).toBeNull();
    expectClock(m.t.goldenEndAM, z, '02:56');
    expectClock(m.t.goldenStartPM, z, '22:35');
    expect(m.t.goldenStartAM).toBeNull();
    expect(m.t.blueStartPM).toBeNull();
    expectClock(m.t.nadir, z, '00:45');
    expect(Math.abs(m.nadirAltApp - 3.3)).toBeLessThan(0.1);
    // Files de crepuscles: "El sol no baixa tant".
    for (const thr of [-6, -12, -18]) expect(m.nadirGeo).toBeGreaterThan(thr);
    expect(m.t.civilDawn).toBeNull();
    expect(formatRange(m.text.minus4AM, m.text.goldenEndAM)).toBe('… 02:56');
    expect(formatRange(m.text.goldenStartPM, m.text.minus4PM)).toBe('22:35 …');
    expect(m.usefulLightSec).toBe(86400);
  });

  it('Tromsø 2026-12-21: nit polar amb hora daurada fusionada i mitjanit solar del mateix dia', () => {
    const m = model(TROMSO, '2026-12-21');
    const z = TROMSO.zone;
    expect(m.polar).toBe('night');
    expect(m.dayLengthSec).toBe(0);
    expect(Math.abs(m.noonAltApp - -2.6)).toBeLessThan(0.1);
    expectClock(m.t.astroDawn, z, '06:28');
    expectClock(m.t.astroDusk, z, '16:56');
    expectClock(m.t.nauticalDawn, z, '07:46');
    expectClock(m.t.nauticalDusk, z, '15:37');
    expectClock(m.t.civilDawn, z, '09:31');
    expectClock(m.t.civilDusk, z, '13:53');
    expectClock(m.t.goldenStartAM, z, '10:29');
    expectClock(m.t.blueStartPM, z, '12:54');
    expect(m.t.goldenEndAM).toBeNull();
    expect(m.t.goldenStartPM).toBeNull();
    expect(formatRange(m.text.minus4AM, m.text.minus4PM)).toBe('10:29–12:54');
    expect(formatRange(m.text.civilDawn, m.text.minus4AM)).toBe('09:31–10:29');
    expect(formatRange(m.text.minus4PM, m.text.civilDusk)).toBe('12:54–13:53');
    // Regla de la mitjanit solar: migdia − 12 h cau el dia abans, per tant migdia + 12 h.
    expectClock(m.t.nadir, z, '23:42');
    expect(localDateOf(m.t.nadir!, z)).toBe('2026-12-21');
    expect(m.text.nadir?.shift).toBe(0);
  });

  it('Reykjavík 2026-06-21: posta a les 00:04 de l\'endemà i sense crepuscles', () => {
    const m = model(REYKJAVIK, '2026-06-21');
    const z = REYKJAVIK.zone;
    expectClock(m.t.sunrise, z, '02:55');
    expectClock(m.t.sunset, z, '00:04');
    expect(m.setLabel?.shift).toBe(1);
    expect(m.text.sunset?.shift).toBe(1);
    expect(Math.abs(m.nadirAltApp - -1.9)).toBeLessThan(0.1);
    expect(m.nadirGeo).toBeGreaterThan(-6);
    expect(m.t.civilDawn).toBeNull();
    expect(m.t.civilDusk).toBeNull();
    expect(formatRange(m.text.minus4AM, m.text.goldenEndAM)).toBe('… 04:52');
    expect(formatRange(m.text.goldenStartPM, m.text.minus4PM)).toBe('22:06 …');
  });

  it('Hèlsinki 2026-06-21: crepuscle civil fins a les 00:42 (+1), sense nàutic ni astronòmic', () => {
    const m = model(HELSINKI, '2026-06-21');
    const z = HELSINKI.zone;
    expectClock(m.t.civilDawn, z, '02:01');
    expectClock(m.t.civilDusk, z, '00:42');
    expect(m.text.civilDusk?.shift).toBe(1);
    expect(m.t.nauticalDawn).toBeNull();
    expect(m.t.astroDusk).toBeNull();
    expect(m.nadirGeo).toBeGreaterThan(-12);
    expectClock(m.t.goldenStartAM, z, '03:00');
    expectClock(m.t.blueStartPM, z, '23:43');
  });

  it('Alert: dia de 32 min el 14-10 i nit polar el 15-10 amb hora daurada fusionada', () => {
    const d14 = model(ALERT, '2026-10-14');
    expect(d14.polar).toBe('none');
    expectClock(d14.t.sunrise, ALERT.zone, '11:37');
    expectClock(d14.t.sunset, ALERT.zone, '12:09');
    expect(Math.abs(d14.astroLengthSec! / 60 - 32)).toBeLessThanOrEqual(1);
    const d15 = model(ALERT, '2026-10-15');
    expect(d15.polar).toBe('night');
    expect(formatRange(d15.text.minus4AM, d15.text.minus4PM)).toBe('08:26–15:19');
  });

  it('McMurdo: el 22-10 encara es pon (mitjanit −0.86° aparent) i el 23-10 ja és dia polar', () => {
    const d22 = model(MCMURDO, '2026-10-22');
    expect(d22.polar).toBe('none');
    expect(Math.abs(d22.nadirAltApp - -0.86)).toBeLessThan(0.02);
    expect(model(MCMURDO, '2026-10-23').polar).toBe('day');
  });
});

describe('marques horàries i rellotge del gràfic', () => {
  it('Madrid 2026-10-25 (dia de 25 h): "12" al minut 780 i "24" al 1500', () => {
    const m = model(GIRONA, '2026-10-25');
    const tick = (label: string) => m.hourTicks.find(t => t.label === label)?.min;
    expect(m.spanMin).toBe(1500);
    expect(tick('00')).toBe(0);
    expect(tick('03')).toBe(240);
    expect(tick('12')).toBe(780);
    expect(tick('24')).toBe(1500);
    expect(m.dst).toEqual({ atMin: 180, deltaMin: -60 });
  });

  it('Hèlsinki 2026-03-29 (salt de 03:00 a 04:00): "03" cau al moment del salt, no a les 02:00', () => {
    const m = model(HELSINKI, '2026-03-29');
    expect(m.spanMin).toBe(1380);
    expect(m.hourTicks.find(t => t.label === '03')?.min).toBe(180);
    expect(clockAtMinute(m, 180)).toBe('04:00');
    expect(m.hourTicks.find(t => t.label === '06')?.min).toBe(300);
  });

  it('el minut del migdia és el mateix que el text del migdia (cap desfasament d\'1 min)', () => {
    // Girona 2026-10-13: migdia a les 13:34:58; arrodonir donava 13:35 a la lectura i 13:34 a l'heroi.
    for (let i = 0; i < 30; i++) {
      const m = model(GIRONA, addDays('2026-10-05', i));
      expect(clockAtMinute(m, m.noonMin), m.dateStr).toBe(m.text.noon?.text);
    }
  });

  it('clockAtMinute: taula + canvi d\'hora, sense Intl', () => {
    const d07 = model(GIRONA, '2026-10-07');
    expect(clockAtMinute(d07, 0)).toBe('00:00');
    expect(clockAtMinute(d07, 967)).toBe('16:07');
    expect(clockAtMinute(d07, 1440)).toBe('24:00');
    const d25 = model(GIRONA, '2026-10-25');
    expect(clockAtMinute(d25, 179)).toBe('02:59');
    expect(clockAtMinute(d25, 180)).toBe('02:00');
    expect(clockAtMinute(d25, 780)).toBe('12:00');
    expect(clockAtMinute(d25, 1500)).toBe('24:00');
    // Coincideix amb el rellotge real a cada minut del dia de 25 h.
    for (let m = 0; m < d25.spanMin; m += 7) {
      expect(clockAtMinute(d25, m)).toBe(localClock(d25.startMs + m * 60000, GIRONA.zone));
    }
  });

  it('Santiago 2026-09-06 (canvi d\'hora a les 00:00): el dia comença a la 01:00', () => {
    const santiago = place(-33.45, -70.67, 'America/Santiago');
    const m = model(santiago, '2026-09-06');
    expect(m.spanMin).toBe(1380);
    expect(m.startLocalMin).toBe(60);
    expect(clockAtMinute(m, 0)).toBe('01:00');
    expect(m.hourTicks.find(t => t.label === '12')?.min).toBe(660);
    for (let i = 0; i < m.spanMin; i += 11) {
      expect(clockAtMinute(m, i)).toBe(localClock(m.startMs + i * 60000, santiago.zone));
    }
  });
});

describe('alçada geomètrica i fases', () => {
  it('inverteix la refracció de suncalc', () => {
    expect(Math.abs(geometricAltitude(-0.349) - -0.833)).toBeLessThan(0.01);
    const R = (h: number) => {
      const r = Math.max(0, h) * Math.PI / 180;
      return (0.0002967 / Math.tan(r + 0.00312536 / (r + 0.08901179))) * 180 / Math.PI;
    };
    let prev = -Infinity;
    for (let h = -20; h <= 60; h += 0.05) {
      const g = geometricAltitude(h + R(h));
      expect(Math.abs(g - h), `h=${h}`).toBeLessThan(0.01);
      expect(g).toBeGreaterThan(prev);
      prev = g;
    }
  });

  it('coincideix amb els llindars geomètrics de getTimes', () => {
    const m = model(GIRONA, '2026-10-07');
    const geo = (ms: number | null) => geometricAltitude(SunCalc.getPosition(new Date(ms!), GIRONA.lat, GIRONA.lon).altitude);
    expect(geo(m.t.civilDawn)).toBeCloseTo(-6, 1);
    expect(geo(m.t.goldenEndAM)).toBeCloseTo(6, 1);
    expect(geo(m.t.goldenStartAM)).toBeCloseTo(-4, 2);
  });

  it('límits de lightPhase', () => {
    expect(lightPhase(6)).toBe('day');
    expect(lightPhase(5.99)).toBe('golden');
    expect(lightPhase(-4)).toBe('golden');
    expect(lightPhase(-4.01)).toBe('blue');
    expect(lightPhase(-6)).toBe('blue');
    expect(lightPhase(-6.01)).toBe('nautical');
    expect(lightPhase(-12.01)).toBe('astro');
    expect(lightPhase(-18.01)).toBe('night');
  });

  it('to del marcador', () => {
    expect(markerTone(6)).toBe('day');
    expect(markerTone(5.9)).toBe('golden');
    expect(markerTone(-0.8)).toBe('golden');
    expect(markerTone(-0.833)).toBe('below');
    expect(markerTone(-10)).toBe('below');
  });
});

describe('Girona 2026-10-07 amb el parell d\'Open-Meteo: compte enrere, pròxim i estats', () => {
  const today = () => model(GIRONA, '2026-10-07', '2026-10-07T07:51', '2026-10-07T19:20');
  const tomorrow = () => model(GIRONA, '2026-10-08', '2026-10-08T07:52', '2026-10-08T19:18', true);

  it('upcomingRiseSet', () => {
    const now = gironaAt('16:07');
    const at1607 = upcomingRiseSet(now, today(), tomorrow());
    expect(at1607?.kind).toBe('sunset');
    expect(formatCountdown(at1607!.ms - now)).toBe('3h 13m');
    const at0600 = upcomingRiseSet(gironaAt('06:00'), today(), tomorrow());
    expect(at0600).toEqual({ kind: 'sunrise', ms: Date.UTC(2026, 9, 7, 5, 51) });
    const at2130 = upcomingRiseSet(gironaAt('21:30'), today(), tomorrow());
    expect(at2130).toEqual({ kind: 'sunrise', ms: Date.UTC(2026, 9, 8, 5, 52) });
    expect(upcomingRiseSet(gironaAt('21:30'), today(), null)).toBeNull();
    expect(upcomingRiseSet(Date.UTC(2026, 5, 21, 10), model(TROMSO, '2026-06-21'), null)).toBeNull();
  });

  it('nextEvent', () => {
    const at1607 = nextEvent(gironaAt('16:07'), today(), tomorrow());
    expect(at1607?.key).toBe('goldenStartPM');
    expectClock(at1607!.ms, GIRONA.zone, '18:43');
    // A les 19:00 el pròxim és la posta: el mateix objectiu que el compte enrere (la línia "Pròxim" s'amaga).
    const at1900 = nextEvent(gironaAt('19:00'), today(), tomorrow());
    expect(at1900?.key).toBe('sunset');
    expect(at1900?.ms).toBe(upcomingRiseSet(gironaAt('19:00'), today(), tomorrow())?.ms);
    const at2130 = nextEvent(gironaAt('21:30'), today(), tomorrow());
    expect(at2130?.key).toBe('astroDawn');
    expect(at2130?.isTomorrow).toBe(true);
    expectClock(at2130!.ms, GIRONA.zone, '06:20');
    expect(localDateOf(at2130!.ms, GIRONA.zone)).toBe('2026-10-08');
    expect(nextEvent(gironaAt('21:30'), today(), null)).toBeNull();
  });
  it('ephemerisCellStates a les 18:50: daurada del vespre en curs, posta la pròxima, el matí passat', () => {
    const s = ephemerisCellStates(today(), gironaAt('18:50'));
    expect(s.goldenPM).toBe('cur');
    expect(s.sunset).toBe('next');
    for (const id of ['astroAM', 'nauticalAM', 'civilAM', 'blueAM', 'goldenAM', 'sunrise', 'noon'] as const) {
      expect(s[id], id).toBe('past');
    }
    expect(s.civilPM).toBeUndefined();
    expect(Object.values(s).filter(v => v === 'next')).toHaveLength(1);
  });

  it('ephemerisCellStates: hora daurada fusionada (Alert 15-10) va a goldenAM', () => {
    const d15 = model(ALERT, '2026-10-15');
    const noon = d15.t.noon!;
    expect(ephemerisCellStates(d15, noon).goldenAM).toBe('cur');
    expect(ephemerisCellStates(d15, noon).goldenPM).toBeUndefined();
  });

  it('el model lite de demà porta els creuaments de −4° (sense mostres ni textos)', () => {
    const t = tomorrow();
    expect(t.lite).toBe(true);
    expect(t.altApp).toHaveLength(0);
    expect(t.hourTicks).toHaveLength(0);
    expectClock(t.t.goldenStartAM, GIRONA.zone, '07:36');
    expectClock(t.t.blueStartPM, GIRONA.zone, '19:35');
    expect(t.riseLabel).toEqual({ text: '07:52', shift: 0 });
  });
});

describe('esdeveniments d\'ahir passada la mitjanit (latituds altes a l\'estiu)', () => {
  const FAIRBANKS = place(64.84, -147.72, 'America/Anchorage');
  const at = (p: Place, dateStr: string, hhmm: string) =>
    zonedDayStartMs(dateStr, p.zone) + toMin(hhmm) * 60000;

  it('Fairbanks 2026-06-22 00:05: el sol encara és fora; el compte enrere va a la posta d\'ahir (00:47)', () => {
    const today = model(FAIRBANKS, '2026-06-22');
    const tomorrow = model(FAIRBANKS, '2026-06-23', undefined, undefined, true);
    const yesterday = model(FAIRBANKS, '2026-06-21', undefined, undefined, true);
    const now = at(FAIRBANKS, '2026-06-22', '00:05');
    expect(upcomingRiseSet(now, today, tomorrow)?.kind).toBe('sunrise');   // sense ahir: s'equivocava
    const up = upcomingRiseSet(now, today, tomorrow, yesterday);
    expect(up?.kind).toBe('sunset');
    expectClock(up!.ms, FAIRBANKS.zone, '00:47');
    expect(nextEvent(now, today, tomorrow, yesterday)?.key).toBe('sunset');
  });

  it('Hèlsinki 2026-05-11 00:05: el pròxim és el crepuscle nàutic d\'ahir (01:07), no l\'alba civil', () => {
    const today = model(HELSINKI, '2026-05-11');
    const tomorrow = model(HELSINKI, '2026-05-12', undefined, undefined, true);
    const yesterday = model(HELSINKI, '2026-05-10', undefined, undefined, true);
    const now = at(HELSINKI, '2026-05-11', '00:05');
    const next = nextEvent(now, today, tomorrow, yesterday);
    expect(next?.key).toBe('nauticalDusk');
    expectClock(next!.ms, HELSINKI.zone, '01:07');
    // Girona: ahir no aporta res (cap esdeveniment passada la mitjanit).
    const g = model(GIRONA, '2026-10-07');
    const gy = model(GIRONA, '2026-10-06', undefined, undefined, true);
    expect(nextEvent(gironaAt('00:05'), g, null, gy)?.key).toBe(nextEvent(gironaAt('00:05'), g, null)?.key);
  });
});

describe('memòria cau de models', () => {
  it('el mateix dia torna el mateix objecte; un lite no substitueix un complet', () => {
    const full = model(GIRONA, '2026-10-07');
    expect(model(GIRONA, '2026-10-07')).toBe(full);
    expect(model(GIRONA, '2026-10-07', undefined, undefined, true)).toBe(full);
    clearSolarDayCache();
    const lite = model(GIRONA, '2026-10-07', undefined, undefined, true);
    const upgraded = model(GIRONA, '2026-10-07');
    expect(upgraded).not.toBe(lite);
    expect(upgraded.lite).toBe(false);
  });

  it('LRU de 20 entrades', () => {
    const first = model(GIRONA, '2026-10-01');
    for (let i = 1; i <= 20; i++) model(GIRONA, addDays('2026-10-01', i), undefined, undefined, true);
    expect(model(GIRONA, '2026-10-01')).not.toBe(first);
  });

  it('entrada no vàlida: null', () => {
    expect(buildSolarDay({ dateStr: '2026-10-07', lat: NaN, lon: 2, zone: GIRONA.zone })).toBeNull();
    expect(buildSolarDay({ dateStr: 'ahir', lat: 41, lon: 2, zone: GIRONA.zone })).toBeNull();
  });
});

describe('altres ajudants', () => {
  it('rangeAltMax: sostre de l\'eix per a la finestra de 15 dies', () => {
    expect(rangeAltMax([42.05, 39.42, 36.89])).toBe(60);
    expect(rangeAltMax([84.1])).toBe(90);
    expect(rangeAltMax([-2.6, -2.5, -2.4])).toBe(30);
    expect(rangeAltMax([null, undefined])).toBe(30);
  });

  it('noonAltFor coincideix amb les referències (Girona, Quito)', () => {
    expect(noonAltFor('2026-10-08', GIRONA.lat, GIRONA.lon, GIRONA.zone)!).toBeCloseTo(42.05, 1);
    expect(noonAltFor('2026-10-15', GIRONA.lat, GIRONA.lon, GIRONA.zone)!).toBeCloseTo(39.42, 1);
    expect(noonAltFor('2026-10-22', GIRONA.lat, GIRONA.lon, GIRONA.zone)!).toBeCloseTo(36.89, 1);
    expect(noonAltFor('2026-10-08', QUITO.lat, QUITO.lon, QUITO.zone)!).toBeCloseTo(84.1, 0);
  });

  it('nadirInDay', () => {
    const noon = Date.UTC(2026, 9, 7, 11, 36), start = Date.UTC(2026, 9, 6, 22);
    expect(nadirInDay(noon, start)).toBe(noon - 43200000);
    expect(nadirInDay(Date.UTC(2026, 9, 7, 8), start)).toBe(Date.UTC(2026, 9, 7, 20));
  });

  it('usefulLightSec', () => {
    expect(usefulLightSec(1000, 4601000, 40, -50)).toBe(4600);
    expect(usefulLightSec(null, null, 40, -2)).toBe(86400);
    expect(usefulLightSec(null, null, -8, -40)).toBe(0);
  });

  it('findCrossings d\'un llindar que no es creua: null', () => {
    const m = model(TROMSO, '2026-06-21');
    expect(findCrossings(m, -4)).toEqual({ up: null, down: null });
    const g = model(GIRONA, '2026-10-07');
    const c = findCrossings(g, 30);
    expect(c.up).not.toBeNull();
    expect(c.down).not.toBeNull();
    expect(findCrossings(g, 50)).toEqual({ up: null, down: null });
  });
});
