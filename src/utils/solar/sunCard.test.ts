// src/utils/solar/sunCard.test.ts
import { describe, it, expect } from 'vitest';
import * as Fmt from './solarFormat';
import { buildSolarDay, clearSolarDayCache } from './solarDay';
import { makeZoneCtx } from './solarTime';
import { contrastRatio } from './solarSky';
import {
  CARD_H, CARD_W, azText, buildSunCardGeom, degText, formatCountdown, formatDeltaLong, signedDeg, sunCardSky, sunCardStars,
} from './sunCard';
import type { Language } from '../../translations';

const zone = makeZoneCtx('Europe/Madrid', 7200);
const girona = () => {
  clearSolarDayCache();
  return buildSolarDay({ dateStr: '2026-10-07', lat: 41.98, lon: 2.82, zone, omRise: '2026-10-07T07:51', omSet: '2026-10-07T19:20' })!;
};

describe('formats de la targeta = formats del modal (solarFormat)', () => {
  it('compte enrere, Δ, graus i azimut donen exactament el mateix text', () => {
    for (const ms of [-1, 0, 59_999, 60_000, 3_599_999, 11_580_000, 36_120_000, 86_399_999, NaN]) {
      expect(formatCountdown(ms)).toBe(Fmt.formatCountdown(ms));
    }
    for (const s of [0, 0.4, -0.9, 1, -42, 59.6, 166, -166, 3599, 3600, -3901, NaN]) {
      expect(formatDeltaLong(s)).toEqual(Fmt.formatDeltaLong(s));
    }
    for (const v of [-18.4, -0.4, 0, 0.6, 38.9, 89.5, NaN]) {
      expect(degText(v)).toBe(Fmt.degText(v));
      expect(signedDeg(v)).toBe(Fmt.signedDeg(v));
    }
    for (const lang of ['ca', 'es', 'en', 'fr'] as Language[]) {
      for (const az of [null, 0, 101.6, 241, 359.6, -10]) expect(azText(az, lang)).toBe(Fmt.azText(az, lang));
    }
  });
});

describe('buildSunCardGeom', () => {
  it('Girona, 7-10: corba de 97 punts, horitzó a dins, migdia al punt més alt i sortida/posta a l\'hora', () => {
    const m = girona();
    const g = buildSunCardGeom(m);
    expect(g.curve.match(/[ML]/g)).toHaveLength(97);
    expect(g.yH).toBeGreaterThan(20);
    expect(g.yH).toBeLessThan(CARD_H);
    // Sostre com el modal: múltiple de 10 per sobre del migdia + 8°.
    expect(g.altMax).toBe(60);   // migdia 42,7° + 8 → 60
    const ys = [...g.curve.matchAll(/[ML][\d.]+,(-?[\d.]+)/g)].map(x => Number(x[1]));
    expect(Math.min(...ys)).toBeCloseTo(g.noon!.y, 0);
    // 07:51 i 19:20 locals (un dia sense canvi d'hora: minut / 1440 · 400).
    expect(g.riseX).toBeCloseTo(((7 * 60 + 51) / 1440) * CARD_W, 0);
    expect(g.setX).toBeCloseTo(((19 * 60 + 20) / 1440) * CARD_W, 0);
    expect(g.ticks).toEqual([{ x: 100, label: '06' }, { x: 200, label: '12' }, { x: 300, label: '18' }]);
  });

  it('les franges de color van de dalt a baix (dia, daurada, blava) i es toquen sense forats', () => {
    const g = buildSunCardGeom(girona());
    const { day, gold, blue } = g.clip;
    expect(day.y + day.h).toBeCloseTo(gold.y, 1);
    expect(gold.y + gold.h).toBeCloseTo(blue.y, 1);
    expect(gold.y).toBeLessThan(g.yH);       // +6° és per sobre de l'horitzó
    expect(blue.y).toBeGreaterThan(g.yH);    // −4° és per sota
  });

  it('nit polar: sense punts de sortida/posta ni marca de migdia', () => {
    clearSolarDayCache();
    const m = buildSolarDay({ dateStr: '2026-12-15', lat: 78.22, lon: 15.65, zone: makeZoneCtx('Europe/Oslo', 3600) })!;
    expect(m.polar).toBe('night');
    const g = buildSunCardGeom(m);
    expect(g.riseX).toBeNull();
    expect(g.setX).toBeNull();
    expect(g.noon).toBeNull();
  });
});

describe('sunCardSky (el cel d\'ara)', () => {
  const stops = (css: string) => css.match(/#[0-9a-f]{6}/g)!;
  it('de dia el cel és blau i clar; de nit, gairebé negre', () => {
    const [dayTop] = stops(sunCardSky(30, 110));
    const [nightTop] = stops(sunCardSky(-30, 110));
    expect(contrastRatio(dayTop, '#05070f')).toBeGreaterThan(2);
    expect(contrastRatio(nightTop, '#05070f')).toBeLessThan(1.1);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(dayTop.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('la corba de dia es llegeix sobre el cel (≥ 3:1) a qualsevol alçada del sol', () => {
    for (let geo = 6; geo <= 90; geo += 4) {
      for (const c of stops(sunCardSky(geo, 110)).slice(0, 2)) expect(contrastRatio('#fcd34d', c)).toBeGreaterThanOrEqual(3);
    }
  });

  it('el terra comença a l\'horitzó', () => {
    expect(sunCardSky(10, 75)).toContain(' 50%,');
  });
});

describe('sunCardStars', () => {
  it('mateix dia i lloc => mateixes estrelles, sempre per sobre de l\'horitzó', () => {
    const m = girona();
    const a = sunCardStars(m, 110), b = sunCardStars(m, 110);
    expect(a).toBe(b);
    expect(a.match(/M/g)).toHaveLength(28);
    for (const y of [...a.matchAll(/M[\d.]+,([\d.]+)/g)].map(x => Number(x[1]))) expect(y).toBeLessThan(110);
  });
});
