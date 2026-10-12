import { describe, it, expect } from 'vitest';
import {
  makeZoneCtx, offsetMsAt, zonedDayStartMs, addDays, diffDays, localDateOf, wallTimeToUtcMs, localClock,
  localClockMinute, clockForLocalMinute, dayDstShift, getDateFormatter, formatDateStr, formatUtcOffset,
} from './solarTime';
import { formatClockTime } from '../astronomyMath';

const zone = (tz: string, fixed = 0) => makeZoneCtx(tz, fixed);
const MADRID = zone('Europe/Madrid', 7200);
const spanMin = (date: string, z: ReturnType<typeof zone>) =>
  (zonedDayStartMs(addDays(date, 1), z) - zonedDayStartMs(date, z)) / 60000;

// Generador determinista (mulberry32): les proves no depenen de Math.random.
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('makeZoneCtx', () => {
  it('valida el fus una sola vegada; si no és vàlid, cau al desplaçament fix', () => {
    expect(makeZoneCtx('Europe/Madrid', 7200)).toEqual({ tz: 'Europe/Madrid', fixedOffsetSec: 7200 });
    expect(makeZoneCtx('Mars/Base', 3600)).toEqual({ tz: null, fixedOffsetSec: 3600 });
    expect(makeZoneCtx(undefined, undefined)).toEqual({ tz: null, fixedOffsetSec: 0 });
    expect(makeZoneCtx('  ', NaN)).toEqual({ tz: null, fixedOffsetSec: 0 });
  });

  it('offsetMsAt: hora d\'estiu, hora d\'hivern i desplaçament fix', () => {
    expect(offsetMsAt(Date.UTC(2026, 6, 1, 12), MADRID)).toBe(7200000);
    expect(offsetMsAt(Date.UTC(2026, 11, 1, 12), MADRID)).toBe(3600000);
    expect(offsetMsAt(Date.UTC(2026, 9, 7), zone('Pacific/Chatham'))).toBe((13 * 60 + 45) * 60000);
    expect(offsetMsAt(Date.UTC(2026, 9, 7), makeZoneCtx(null, -10800))).toBe(-10800000);
  });
});

describe('zonedDayStartMs (mitjanit local, DST i línia de canvi de data)', () => {
  it('Madrid 2026-10-07 comença a les 22:00 UTC del dia anterior', () => {
    expect(zonedDayStartMs('2026-10-07', MADRID)).toBe(Date.UTC(2026, 9, 6, 22));
    expect(spanMin('2026-10-07', MADRID)).toBe(1440);
  });

  it('Madrid: dia de 25 h a la tardor i de 23 h a la primavera', () => {
    expect(zonedDayStartMs('2026-10-25', MADRID)).toBe(Date.UTC(2026, 9, 24, 22));
    expect(spanMin('2026-10-25', MADRID)).toBe(1500);
    expect(spanMin('2026-03-29', MADRID)).toBe(1380);
  });

  it('canvis d\'hora a les 00:00: el candidat més primerenc que ja és d\'aquesta data', () => {
    const santiago = zone('America/Santiago');
    expect(zonedDayStartMs('2026-09-06', santiago)).toBe(Date.UTC(2026, 8, 6, 4));
    expect(spanMin('2026-09-06', santiago)).toBe(1380);
    expect(zonedDayStartMs('2026-03-08', zone('America/Havana'))).toBe(Date.UTC(2026, 2, 8, 5));
    expect(zonedDayStartMs('2026-03-29', zone('Asia/Beirut'))).toBe(Date.UTC(2026, 2, 28, 22));
  });

  it('Lord Howe (canvi de mitja hora): dia de 1410 min', () => {
    const lh = zone('Australia/Lord_Howe');
    expect(zonedDayStartMs('2026-10-04', lh)).toBe(Date.UTC(2026, 9, 3, 13, 30));
    expect(spanMin('2026-10-04', lh)).toBe(1410);
  });

  it('Apia (UTC+13) i el primer instant del dia és realment d\'aquesta data', () => {
    const apia = zone('Pacific/Apia');
    const s = zonedDayStartMs('2026-10-07', apia);
    expect(s).toBe(Date.UTC(2026, 9, 6, 11));
    expect(localDateOf(s, apia)).toBe('2026-10-07');
    expect(localDateOf(s - 1, apia)).toBe('2026-10-06');
  });

  it('fus no vàlid: tot amb el desplaçament fix', () => {
    const z = makeZoneCtx('Mars/Base', 3600);
    expect(zonedDayStartMs('2026-10-07', z)).toBe(Date.UTC(2026, 9, 7) - 3600e3);
    expect(spanMin('2026-10-07', z)).toBe(1440);
  });

  it('data no vàlida: NaN, mai una excepció', () => {
    expect(zonedDayStartMs('2026-02-30', MADRID)).toBeNaN();
    expect(zonedDayStartMs('ahir', MADRID)).toBeNaN();
  });
});

describe('dates locals', () => {
  it('localDateOf a Madrid al voltant de mitjanit', () => {
    expect(localDateOf(Date.UTC(2026, 9, 7, 21, 59), MADRID)).toBe('2026-10-07');
    expect(localDateOf(Date.UTC(2026, 9, 7, 22, 1), MADRID)).toBe('2026-10-08');
  });

  it('addDays i diffDays (canvi de mes, d\'any i de traspàs)', () => {
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-10-07', -7)).toBe('2026-09-30');
    expect(diffDays('2026-10-07', '2026-10-21')).toBe(14);
    expect(diffDays('2026-10-21', '2026-10-07')).toBe(-14);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('x', '2026-03-30')).toBeNaN();
  });
});

describe('wallTimeToUtcMs', () => {
  it('hora d\'Open-Meteo a Madrid', () => {
    expect(wallTimeToUtcMs('2026-10-07T07:51', MADRID)).toBe(Date.UTC(2026, 9, 7, 5, 51));
  });

  it('hores inexistents (primavera) o ambigües (tardor): un instant finit', () => {
    const spring = wallTimeToUtcMs('2026-03-29T02:30', MADRID);
    const autumn = wallTimeToUtcMs('2026-10-25T02:30', MADRID);
    expect(Number.isFinite(spring)).toBe(true);
    expect(Number.isFinite(autumn)).toBe(true);
    expect([Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 9, 25, 1, 30)]).toContain(autumn);
  });

  it('hora repetida de la tardor: la primera; hora inexistent de la primavera: endavant la durada del salt', () => {
    expect(wallTimeToUtcMs('2026-10-25T02:30', MADRID)).toBe(Date.UTC(2026, 9, 25, 0, 30));   // 02:30 d'estiu
    expect(wallTimeToUtcMs('2026-03-29T02:30', MADRID)).toBe(Date.UTC(2026, 2, 29, 1, 30));   // => 03:30
    const helsinki = makeZoneCtx('Europe/Helsinki', 7200);
    expect(wallTimeToUtcMs('2026-03-29T03:00', helsinki)).toBe(Date.UTC(2026, 2, 29, 1, 0));  // => 04:00, el salt
  });

  it('text no vàlid: null, mai una excepció', () => {
    expect(wallTimeToUtcMs('07:51', MADRID)).toBeNull();
    expect(wallTimeToUtcMs('2026-10-07T25:00', MADRID)).toBeNull();
    expect(wallTimeToUtcMs(undefined, MADRID)).toBeNull();
  });
});

describe('rellotge local', () => {
  it('localClock coincideix amb formatClockTime (200 instants × 5 fusos)', () => {
    const rand = mulberry32(20261007);
    const from = Date.UTC(2026, 0, 1), to = Date.UTC(2027, 0, 1);
    const zones = ['Europe/Madrid', 'America/New_York', 'Pacific/Apia', 'Pacific/Chatham', 'Asia/Kolkata'];
    const instants = Array.from({ length: 200 }, () => Math.floor(from + rand() * (to - from)));
    for (const tz of zones) {
      const z = zone(tz);
      for (const ms of instants) {
        expect(localClock(ms, z), `${tz} ${new Date(ms).toISOString()}`).toBe(formatClockTime(new Date(ms), tz));
      }
    }
  });

  it('localClock amb desplaçament fix (sense fus IANA)', () => {
    const z = makeZoneCtx(null, 5 * 3600 + 1800);
    expect(localClock(Date.UTC(2026, 9, 7, 10, 0, 59), z)).toBe('15:30');
    expect(localClockMinute(Date.UTC(2026, 9, 7, 20, 0), z)).toBe(90);
    expect(localClock(NaN, z)).toBe('--:--');
  });

  it('clockForLocalMinute: taula de 1440 entrades i 24:00 al final', () => {
    expect(clockForLocalMinute(0)).toBe('00:00');
    expect(clockForLocalMinute(875)).toBe('14:35');
    expect(clockForLocalMinute(1439)).toBe('23:59');
    expect(clockForLocalMinute(1440)).toBe('24:00');
    expect(clockForLocalMinute(1500)).toBe('01:00');
  });

  it('dayDstShift: minut i sentit del canvi d\'hora dins del dia', () => {
    const s25 = zonedDayStartMs('2026-10-25', MADRID), e25 = zonedDayStartMs('2026-10-26', MADRID);
    expect(dayDstShift(s25, e25, MADRID)).toEqual({ atMin: 180, deltaMin: -60 });
    const s29 = zonedDayStartMs('2026-03-29', MADRID), e29 = zonedDayStartMs('2026-03-30', MADRID);
    expect(dayDstShift(s29, e29, MADRID)).toEqual({ atMin: 120, deltaMin: 60 });
    const s07 = zonedDayStartMs('2026-10-07', MADRID), e07 = zonedDayStartMs('2026-10-08', MADRID);
    expect(dayDstShift(s07, e07, MADRID)).toBeNull();
    const lh = zone('Australia/Lord_Howe');
    const sl = zonedDayStartMs('2026-10-04', lh), el = zonedDayStartMs('2026-10-05', lh);
    expect(dayDstShift(sl, el, lh)).toEqual({ atMin: 120, deltaMin: 30 });
  });
});

describe('dates llegibles', () => {
  it('el formatador queda en memòria cau', () => {
    expect(getDateFormatter('ca-ES', 'long')).toBe(getDateFormatter('ca-ES', 'long'));
    expect(getDateFormatter('ca-ES', 'long')).not.toBe(getDateFormatter('ca-ES', 'short'));
  });

  it('formatDateStr en català', () => {
    const long = formatDateStr('2026-10-07', 'ca-ES', 'long');
    expect(long).toMatch(/dimecres/);
    expect(long).toMatch(/octubre/);
    expect(formatDateStr('2026-10-08', 'ca-ES', 'weekdayDay')).toBe('dj. 8');
    expect(formatDateStr('2026-11-01', 'ca-ES', 'weekdayDayMonth')).toBe('dg. 1 de nov.');
    expect(formatDateStr('2026-10-07', 'ca-ES', 'dayMonth')).toMatch(/^7 d.oct\.$/);
  });

  it('formatDateStr no depèn del fus del navegador i "Wed 7" també en anglès', () => {
    expect(formatDateStr('2026-10-07', 'en-US', 'weekdayDay')).toBe('Wed 7');
    expect(formatDateStr('2026-10-07', 'fr-FR', 'long')).toBe('mercredi 7 octobre');
    expect(formatDateStr('2026-02-30', 'ca-ES', 'long')).toBe('');
  });

  it('formatUtcOffset', () => {
    expect(formatUtcOffset(7200)).toBe('UTC+2');
    expect(formatUtcOffset(19800)).toBe('UTC+5:30');
    expect(formatUtcOffset(-10800)).toBe('UTC−3');
    expect(formatUtcOffset(0)).toBe('UTC');
  });
});
