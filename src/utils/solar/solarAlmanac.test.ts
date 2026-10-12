import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildAlmanacRows, almanacRangeLabel, almanacUvUntilLine, almanacLongDate, ALMANAC_DAYS, type AlmanacInput,
} from './solarAlmanac';
import { buildSolarDay, clearSolarDayCache, astroLengthFor } from './solarDay';
import { makeZoneCtx, addDays } from './solarTime';
import { uvDisplay } from './solarFormat';
import { forecastFor, type SolarDaily } from './solarForecast';
import { SOLAR_T, SOLAR_LOCALE } from '../../components/solar/solarI18n';

const MADRID = makeZoneCtx('Europe/Madrid', 7200);

/** Girona: 8 dies de daily d'Open-Meteo a partir del 2026-10-07. */
const GIRONA_DAILY: SolarDaily = {
  time: ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'],
  sunrise: ['07:51', '07:52', '07:53', '07:54', '07:55', '07:56', '07:57', '07:58'].map((h, i) => `2026-10-${String(7 + i).padStart(2, '0')}T${h}`),
  sunset: ['19:20', '19:18', '19:17', '19:15', '19:13', '19:12', '19:10', '19:08'].map((h, i) => `2026-10-${String(7 + i).padStart(2, '0')}T${h}`),
  uv_index_max: [5.45, 4.9, 5.1, 3.2, 4.4, 4.75, 2.9, 4.0],
};

const input = (over: Partial<AlmanacInput> = {}): AlmanacInput => ({
  liveDate: '2026-10-07', zone: MADRID, lat: 41.98, lon: 2.82, daily: GIRONA_DAILY,
  locale: 'ca-ES', t: SOLAR_T.ca, lang: 'ca', ...over,
});

beforeEach(() => clearSolarDayCache());

describe('buildAlmanacRows (Girona, avui 2026-10-07)', () => {
  it('15 files consecutives des de la data viva; la primera és "Avui"', () => {
    const rows = buildAlmanacRows(input());
    expect(rows.length).toBe(ALMANAC_DAYS);
    expect(rows.map(r => r.offset)).toEqual([...Array(15).keys()]);
    expect(rows[0]).toMatchObject({ dateStr: '2026-10-07', label: 'Avui' });
    expect(rows[1].label).toBe('dj. 8');
    expect(rows[14].dateStr).toBe('2026-10-21');
  });

  it('sortida/posta: les hores d\'Open-Meteo dins de daily, les de suncalc després', () => {
    const rows = buildAlmanacRows(input());
    expect([rows[0].rise, rows[0].set]).toEqual(['07:51', '19:20']);
    expect(rows[0].len).toBe('11h 29m');
    expect([rows[7].rise, rows[7].set]).toEqual(['07:58', '19:08']);
    const m8 = buildSolarDay({ dateStr: '2026-10-15', lat: 41.98, lon: 2.82, zone: MADRID }, { lite: true })!;
    expect(m8.riseSetSource).toBe('astronomy');
    expect([rows[8].rise, rows[8].set]).toEqual([m8.riseLabel!.text, m8.setLabel!.text]);
  });

  it('UV "5.5" amb la classe d\'ALT, idèntic a la targeta de previsió; fora de daily => null', () => {
    const rows = buildAlmanacRows(input());
    const card = uvDisplay(forecastFor(GIRONA_DAILY, null, '2026-10-07', 41340)!.uvMax);
    expect(rows[0].uv).toBe('5.5');
    expect(rows[0].uvClass).toBe('text-orange-500');
    expect({ text: rows[0].uv, cls: rows[0].uvClass }).toEqual(card);
    expect(rows[1].uv).toBe('4.9');
    expect(rows[7].uv).toBe('4.0');
    for (const r of rows.slice(8)) {
      expect(r.uv).toBeNull();
      expect(r.uvClass).toBe('');
    }
  });

  it('Δ astronòmica respecte del dia anterior: tendència = signe, "−2:46"', () => {
    const rows = buildAlmanacRows(input());
    const d0 = astroLengthFor('2026-10-07', 41.98, 2.82, MADRID)! - astroLengthFor('2026-10-06', 41.98, 2.82, MADRID)!;
    expect(rows[0].deltaSec).toBeCloseTo(d0, 6);
    expect(Math.abs(rows[1].deltaSec! + 166)).toBeLessThanOrEqual(1);
    for (const r of rows) {
      expect(r.trend).toBe('down');
      expect(r.trendCls).toBe('sm-tr-down');
      expect(r.deltaCompact).toMatch(/^−\d:\d{2}$/);
    }
    expect(['−2:46', '−2:47']).toContain(rows[1].deltaCompact);
  });

  it('|Δ| < 1 s => pla (solstici)', () => {
    const rows = buildAlmanacRows(input({ liveDate: '2026-06-14', daily: null }));
    const flat = rows.filter(r => Math.abs(r.deltaSec!) < 1);
    for (const r of flat) {
      expect(r.trend).toBe('flat');
      expect(r.trendCls).toBe('sm-tr-flat');
      expect(r.deltaCompact).toBe('0:00');
    }
    for (const r of rows) {
      const want = Math.abs(r.deltaSec!) < 1 ? 'flat' : r.deltaSec! > 0 ? 'up' : 'down';
      expect(r.trend).toBe(want);
    }
    expect(rows.some(r => r.trend === 'up')).toBe(true);
    expect(rows.some(r => r.trend === 'down')).toBe(true);
  });

  it('aria: comença amb l\'etiqueta visible i la data llarga', () => {
    const rows = buildAlmanacRows(input());
    expect(rows[0].aria.startsWith('Avui, Dimecres 7 d’octubre: sortida 07:51')).toBe(true);
    expect(rows[0].aria).toContain('posta 19:20, 11h 29m de llum');
    expect(rows[0].aria).toMatch(/\d+ min \d+ s menys que ahir, UV 5\.5 ALT$/);
    expect(rows[1].aria.startsWith('dj. 8, Dijous 8 d’octubre: sortida 07:52')).toBe(true);
    expect(rows[1].aria).toContain('menys que el dia anterior');
    expect(rows[10].aria).not.toContain('UV');
    for (const r of rows) expect(r.aria.startsWith(`${r.label}, `)).toBe(true);
  });

  it('--r / --s dins de [0, 1] i sortida abans de posta', () => {
    for (const r of buildAlmanacRows(input())) {
      expect(r.riseFrac).toBeGreaterThan(0);
      expect(r.setFrac).toBeLessThan(1);
      expect(r.riseFrac).toBeLessThan(r.setFrac);
    }
    const r0 = buildAlmanacRows(input())[0];
    expect(r0.riseFrac).toBeCloseTo((7 * 60 + 51) / 1440, 4);
    expect(r0.setFrac).toBeCloseTo((19 * 60 + 20) / 1440, 4);
  });

  it('el dia 1 de mes porta el mes: "dg. 1 de nov."', () => {
    const rows = buildAlmanacRows(input({ liveDate: '2026-10-20' }));
    const nov1 = rows.find(r => r.dateStr === '2026-11-01')!;
    expect(nov1.label).toBe('dg. 1 de nov.');
    expect(rows.find(r => r.dateStr === '2026-10-25')!.label).toBe('dg. 25');
    // A la columna estreta el mes va en una segona línia (si no, es tallaria): "dg. 1" + "nov.".
    expect(nov1.labelMain).toBe('dg. 1');
    expect(nov1.labelSub).toBe('nov.');
    expect(rows.find(r => r.dateStr === '2026-10-25')!.labelSub).toBeNull();
    expect(rows[0].labelMain).toBe('Avui');
  });

  it('el dia de 25 h (2026-10-25) dona fraccions sobre 1500 min', () => {
    const rows = buildAlmanacRows(input({ liveDate: '2026-10-20', daily: null }));
    const r = rows.find(x => x.dateStr === '2026-10-25')!;
    const m = buildSolarDay({ dateStr: '2026-10-25', lat: 41.98, lon: 2.82, zone: MADRID }, { lite: true })!;
    expect(m.spanMin).toBe(1500);
    expect(r.riseFrac).toBeCloseTo((m.t.sunrise! - m.startMs) / (m.endMs - m.startMs), 4);
  });
});

describe('dies polars', () => {
  it('Alert (nit polar des del 2026-10-15): files buides, aria amb "Nit polar"', () => {
    const rows = buildAlmanacRows(input({
      liveDate: '2026-10-07', lat: 82.5, lon: -62.35, zone: makeZoneCtx('America/Toronto', -14400), daily: null,
    }));
    const r14 = rows.find(r => r.dateStr === '2026-10-14')!;
    expect(r14.polar).toBe('none');
    expect(r14.riseFrac).toBeLessThan(r14.setFrac);
    for (const r of rows.filter(x => x.dateStr >= '2026-10-15')) {
      expect(r.polar).toBe('night');
      expect([r.riseFrac, r.setFrac]).toEqual([0, 0]);
      expect([r.rise, r.set]).toEqual(['—', '—']);
      expect(r.len).toBe('0h 00m');
      expect(r.aria.startsWith(`${r.label}, `)).toBe(true);
      expect(r.aria).toContain('Nit polar, 0h 00m de llum');
    }
    const first = rows.find(x => x.dateStr === '2026-10-15')!;
    expect(first.trend).toBe('down');                     // 32 min → 0
  });

  it('McMurdo (dia polar des del 2026-10-23): fila plena', () => {
    const rows = buildAlmanacRows(input({
      liveDate: '2026-10-15', lat: -77.85, lon: 166.67, zone: makeZoneCtx('Pacific/Auckland', 46800), daily: null, lang: 'en',
      t: SOLAR_T.en, locale: SOLAR_LOCALE.en,
    }));
    expect(rows[0].label).toBe('Today');
    expect(rows[0].labelMain).toBe('Today');
    const polar = rows.filter(r => r.polar === 'day');
    expect(polar[0].dateStr).toBe('2026-10-23');
    for (const r of polar) {
      expect([r.riseFrac, r.setFrac]).toEqual([0, 1]);
      expect(r.len).toBe('24h 00m');
      expect(r.aria).toContain('Midnight sun, 24h 00m of daylight');
    }
    for (const r of rows) {
      expect(r.riseFrac).toBeGreaterThanOrEqual(0);
      expect(r.setFrac).toBeLessThanOrEqual(1);
    }
  });

  it('Reykjavík 2026-06-21: posta l\'endemà => fracció 1 i "l\'endemà" a l\'aria', () => {
    const rows = buildAlmanacRows(input({
      liveDate: '2026-06-21', lat: 64.15, lon: -21.94, zone: makeZoneCtx('Atlantic/Reykjavik', 0), daily: null,
    }));
    expect(rows[0].setFrac).toBe(1);
    expect(rows[0].aria).toContain("posta 00:04 l'endemà");
    expect(rows[0].set).toBe('00:04');
  });
});

describe('altres', () => {
  it('coordenades no vàlides => []', () => {
    expect(buildAlmanacRows(input({ lat: NaN }))).toEqual([]);
  });

  it('almanacLongDate: majúscula i sense coma', () => {
    expect(almanacLongDate('2026-10-07', 'ca-ES')).toBe('Dimecres 7 d’octubre');
    expect(almanacLongDate('2026-10-07', 'en-US')).toBe('Wednesday October 7');
    expect(almanacLongDate('2026-10-07', 'fr-FR')).toBe('Mercredi 7 octobre');
  });

  it('rang i línia "UV previst fins al…"', () => {
    expect(almanacRangeLabel('2026-10-07', 'ca-ES')).toBe('7 d’oct. – 21 d’oct.');
    expect(almanacUvUntilLine(GIRONA_DAILY, SOLAR_T.ca, 'ca-ES', 'ca')).toBe('UV previst fins al 14 d’octubre');
    expect(almanacUvUntilLine(null, SOLAR_T.ca, 'ca-ES', 'ca')).toBeNull();
    expect(addDays('2026-10-07', ALMANAC_DAYS - 1)).toBe('2026-10-21');
  });

  it('no muta els models compartits de la memòria cau', () => {
    const today = buildSolarDay({ dateStr: '2026-10-07', lat: 41.98, lon: 2.82, zone: MADRID, omRise: '2026-10-07T07:51', omSet: '2026-10-07T19:20' })!;
    const snapshot = JSON.stringify({ ...today, altApp: Array.from(today.altApp) });
    buildAlmanacRows(input());
    expect(JSON.stringify({ ...today, altApp: Array.from(today.altApp) })).toBe(snapshot);
  });
});
