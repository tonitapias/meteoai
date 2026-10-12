import { describe, it, expect, beforeEach } from 'vitest';
import {
  chartLayout, apparentAltitude, curvePath, starsPath, starSeed, gridPaths, plotBackground, buildChartGeom,
  xAxisLabels, yAxisLabels, minuteFromClientX, stepMinute, STAR_MAX_GEO,
} from './solarChart';
import { buildSolarDay, clearSolarDayCache, geometricAltitude, type SolarDayModel } from './solarDay';
import { makeZoneCtx } from './solarTime';
import { skyStopsCss } from './solarSky';

const model = (lat: number, lon: number, tz: string, dateStr: string, omRise?: string, omSet?: string): SolarDayModel => {
  const m = buildSolarDay({ dateStr, lat, lon, zone: makeZoneCtx(tz, 0), omRise, omSet });
  if (!m) throw new Error('sense model');
  return m;
};
const girona = () => model(41.98, 2.82, 'Europe/Madrid', '2026-10-07', '2026-10-07T07:51', '2026-10-07T19:20');

beforeEach(() => clearSolarDayCache());

describe('chartLayout', () => {
  it('marges i escales a 328×156 amb altMax 60', () => {
    const L = chartLayout(328, 156, 60, 1440);
    expect([L.left, L.right, L.top, L.bottom]).toEqual([34, 314, 14, 136]);
    expect(L.pw).toBe(280);
    expect(L.y(-18)).toBe(136);
    expect(L.y(60)).toBe(14);
    expect(L.y(0)).toBeCloseTo(107.8, 1);
    expect(L.yH).toBeCloseTo(107.8, 1);
    expect(L.x(0)).toBe(34);
    expect(L.x(1440)).toBe(314);
    expect(L.x(720)).toBe(174);
  });

  it('Y contínua i retallada a [−18, altMax]', () => {
    const L = chartLayout(328, 156, 60, 1440);
    expect(L.y(-40)).toBe(136);
    expect(L.y(75)).toBe(14);
    expect(L.y(30) - L.y(31)).toBeCloseTo(L.y(-10) - L.y(-9), 10);
  });

  it('X segueix la durada real del dia (25 h el dia del canvi d\'hora)', () => {
    const L = chartLayout(328, 156, 60, 1500);
    expect(L.x(1500)).toBe(314);
    expect(L.x(750)).toBe(174);
  });

  it('yGeo situa els llindars geomètrics a la seva alçada aparent', () => {
    const L = chartLayout(328, 156, 60, 1440);
    expect(L.yGeo(-6)).toBeCloseTo(L.y(-6 + 0.48396), 4);
    expect(L.yGeo(6)).toBeLessThan(L.y(6));
  });
});

describe('apparentAltitude', () => {
  it('és la inversa de geometricAltitude', () => {
    for (let g = -20; g <= 60; g += 0.25) expect(geometricAltitude(apparentAltitude(g))).toBeCloseTo(g, 3);
    expect(apparentAltitude(-0.833)).toBeCloseTo(-0.349, 2);
    expect(apparentAltitude(-6)).toBeCloseTo(-5.516, 2);
  });
});

describe('minuteFromClientX', () => {
  const L = chartLayout(328, 156, 60, 1440);
  const rect = { left: 16 };
  it('mapa [left, right] del gràfic a [0, spanMin]', () => {
    expect(minuteFromClientX(50, rect, L, 1440)).toBe(0);
    expect(minuteFromClientX(330, rect, L, 1440)).toBe(1440);
    expect(Math.abs(minuteFromClientX(16 + (34 + 314) / 2, rect, L, 1440) - 720)).toBeLessThanOrEqual(1);
  });
  it('fora del gràfic es retalla', () => {
    expect(minuteFromClientX(0, rect, L, 1440)).toBe(0);
    expect(minuteFromClientX(2000, rect, L, 1440)).toBe(1440);
  });
  it('dia de 25 h', () => {
    const L25 = chartLayout(328, 156, 60, 1500);
    expect(minuteFromClientX(330, rect, L25, 1500)).toBe(1500);
  });
});

describe('stepMinute', () => {
  it('passos ajustats a la graella', () => {
    expect(stepMinute(967, 'ArrowRight', 1440)).toBe(975);
    expect(stepMinute(967, 'ArrowUp', 1440)).toBe(975);
    expect(stepMinute(967, 'ArrowLeft', 1440)).toBe(960);
    expect(stepMinute(967, 'ArrowDown', 1440)).toBe(960);
    expect(stepMinute(967, 'PageUp', 1440)).toBe(1020);
    expect(stepMinute(967, 'PageDown', 1440)).toBe(960);
    expect(stepMinute(975, 'ArrowRight', 1440)).toBe(990);
    expect(stepMinute(900, 'ArrowLeft', 1440)).toBe(885);
  });
  it('Inici, Fi i límits', () => {
    expect(stepMinute(967, 'Home', 1440)).toBe(0);
    expect(stepMinute(967, 'End', 1440)).toBe(1440);
    expect(stepMinute(1500, 'ArrowRight', 1500)).toBe(1500);
    expect(stepMinute(1490, 'PageUp', 1500)).toBe(1500);
    expect(stepMinute(0, 'ArrowLeft', 1440)).toBe(0);
    expect(stepMinute(10, 'PageDown', 1440)).toBe(0);
  });
  it('qualsevol altra tecla => null', () => {
    for (const k of ['Enter', ' ', 'a', 'Tab', 'Escape']) expect(stepMinute(967, k, 1440)).toBeNull();
  });
});

describe('curvePath', () => {
  it('una "M" i 96 "L", coordenades amb 1 decimal', () => {
    const m = girona();
    const d = curvePath(m, chartLayout(328, 156, 60, m.spanMin));
    expect(d.match(/M/g)?.length).toBe(1);
    expect(d.match(/L/g)?.length).toBe(96);
    expect(d.startsWith('M34.0,')).toBe(true);
    const nums = d.split(/[ML,]/).filter(Boolean);
    expect(nums.length).toBe(97 * 2);
    for (const n of nums) expect(n).toMatch(/^-?\d+\.\d$/);
    const lastX = Number(nums[nums.length - 2]);
    expect(lastX).toBe(314);
  });
  it('model lite: buit', () => {
    const lite = buildSolarDay({ dateStr: '2026-10-08', lat: 41.98, lon: 2.82, zone: makeZoneCtx('Europe/Madrid', 0) }, { lite: true })!;
    expect(curvePath(lite, chartLayout(328, 156, 60, 1440))).toBe('');
  });
});

/** Centres i radis de les estrelles d'un path "M x−r,y a r,r 0 1,0 2r,0 a…". */
const parseStars = (d: string) => [...d.matchAll(/M(-?[\d.]+),(-?[\d.]+)a([\d.]+),/g)]
  .map(m => ({ x: Number(m[1]) + Number(m[3]), y: Number(m[2]), r: Number(m[3]) }));

describe('starsPath', () => {
  it('mateixa llavor => mateix path; llavor diferent => un altre', () => {
    const m = girona();
    const L = chartLayout(328, 156, 60, m.spanMin);
    expect(starsPath(m, L, 123)).toBe(starsPath(m, L, 123));
    expect(starsPath(m, L, 123)).not.toBe(starsPath(m, L, 124));
    expect(starSeed(m)).toBe(starSeed(girona()));
  });

  it('només on les mostres tenen alçada geomètrica < −12, dins de [top + 4, yH − 10], ≤ 30', () => {
    for (const [W, H] of [[328, 156], [560, 220], [1200, 220]]) {
      const m = girona();
      const L = chartLayout(W, H, 60, m.spanMin);
      const stars = parseStars(starsPath(m, L, starSeed(m)));
      expect(stars.length).toBeGreaterThan(0);
      expect(stars.length).toBeLessThanOrEqual(30);
      for (const s of stars) {
        const i = Math.min(95, Math.floor(((s.x - L.left) / L.pw) * 96));
        expect(geometricAltitude(m.altApp[i]), `x ${s.x}`).toBeLessThan(STAR_MAX_GEO);
        expect(geometricAltitude(m.altApp[i + 1]), `x ${s.x}`).toBeLessThan(STAR_MAX_GEO);
        expect(s.y).toBeGreaterThanOrEqual(L.top + 4 - 0.05);
        expect(s.y).toBeLessThanOrEqual(L.yH - 10 + 0.05);
        expect(s.r).toBeGreaterThanOrEqual(0.6);
        expect(s.r).toBeLessThanOrEqual(1.1);
      }
    }
  });

  it('una estrella per cada 1500 px² de nit', () => {
    const m = girona();
    const L = chartLayout(328, 156, 60, m.spanMin);
    const geo = Array.from(m.altApp, geometricAltitude);
    let dark = 0;
    for (let i = 0; i < 96; i++) if (geo[i] < -12 && geo[i + 1] < -12) dark++;
    const expected = Math.min(30, Math.round(((dark / 96) * L.pw * (L.yH - 10 - (L.top + 4))) / 1500));
    expect(parseStars(starsPath(m, L, 1)).length).toBe(expected);
  });

  it('sense nit astronòmica (Hèlsinki al juny): cap estrella', () => {
    const m = model(60.17, 24.94, 'Europe/Helsinki', '2026-06-21');
    expect(starsPath(m, chartLayout(328, 156, 60, m.spanMin), 1)).toBe('');
  });
});

describe('eixos i reixa', () => {
  it('eix X a < 420 px: 00 06 12 18 24 (primera a l\'inici, última al final)', () => {
    const m = girona();
    const labels = xAxisLabels(m, chartLayout(328, 156, 60, m.spanMin));
    expect(labels.map(l => l.text)).toEqual(['00', '06', '12', '18', '24']);
    expect(labels.map(l => l.anchor)).toEqual(['start', 'middle', 'middle', 'middle', 'end']);
    expect(labels[0].x).toBe(34);
    expect(labels[4].x).toBe(314);
    expect(labels[0].y).toBe(150);
  });

  it('eix X ample: cada 3 h', () => {
    const m = girona();
    const labels = xAxisLabels(m, chartLayout(600, 220, 60, m.spanMin));
    expect(labels.map(l => l.text)).toEqual(['00', '03', '06', '09', '12', '15', '18', '21', '24']);
  });

  it('dia de 25 h (Madrid 2026-10-25): les 12 queden a la dreta del centre (minut 780)', () => {
    const m = model(41.98, 2.82, 'Europe/Madrid', '2026-10-25');
    const L = chartLayout(328, 156, 60, m.spanMin);
    const twelve = xAxisLabels(m, L).find(l => l.text === '12')!;
    expect(twelve.x).toBeCloseTo(L.x(780), 1);
    expect(twelve.x).toBeGreaterThan(L.x(m.spanMin / 2));
  });

  it('eix Y: 60° 30° 0° −18° (només fins a altMax)', () => {
    expect(yAxisLabels(chartLayout(328, 156, 60, 1440)).map(l => l.text)).toEqual(['60°', '30°', '0°', '−18°']);
    expect(yAxisLabels(chartLayout(328, 156, 30, 1440)).map(l => l.text)).toEqual(['30°', '0°', '−18°']);
    expect(yAxisLabels(chartLayout(328, 156, 90, 1440)).map(l => l.text)).toEqual(['60°', '30°', '0°', '−18°']);
    const l0 = yAxisLabels(chartLayout(328, 156, 60, 1440))[2];
    expect(l0).toMatchObject({ x: 28, anchor: 'end' });
    expect(l0.y).toBeCloseTo(111.8, 1);
  });

  it('reixa: verticals a les marques interiors; 30° i 60° només si ≤ altMax − 4', () => {
    const m = girona();
    const g60 = gridPaths(m, chartLayout(328, 156, 60, m.spanMin));
    expect(g60.hours.match(/M/g)?.length).toBe(3);
    expect(g60.hours).toContain('V136.0');
    expect(g60.alts.match(/M/g)?.length).toBe(1);          // només 30°
    expect(gridPaths(m, chartLayout(328, 156, 70, m.spanMin)).alts.match(/M/g)?.length).toBe(2);
    expect(gridPaths(m, chartLayout(328, 156, 30, m.spanMin)).alts).toBe('');
    expect(gridPaths(m, chartLayout(600, 220, 60, m.spanMin)).hours.match(/M/g)?.length).toBe(7);
  });
});

describe('plotBackground', () => {
  it('tres capes: cúpula, cel per hora i bandes de crepuscle sota l\'horitzó', () => {
    const m = girona();
    const L = chartLayout(328, 156, 60, m.spanMin);
    const bg = plotBackground(m, L);
    expect(bg.backgroundImage.match(/linear-gradient\(/g)?.length).toBe(3);
    expect(bg.backgroundImage).toContain(`linear-gradient(90deg,${skyStopsCss(m)})`);
    expect(bg.backgroundImage).toContain('rgba(129,140,248,.16) 0,');
    expect(bg.backgroundSize).toBe('280px 93.8px,280px 93.8px,280px 28.2px');
    expect(bg.backgroundPosition).toBe('34px 14px,34px 14px,34px 107.8px');
    // Vores de les bandes als llindars geomètrics: −6 / −12 / −18.
    const edges = [...bg.backgroundImage.matchAll(/rgba\(129,140,248,\.\d+\) ([\d.]+)px/g)].map(x => Number(x[1]));
    expect(edges[0]).toBeCloseTo(L.yGeo(-6) - L.yH, 1);
    expect(edges[edges.length - 1]).toBeCloseTo(L.yGeo(-18) - L.yH, 1);
    expect(bg.backgroundImage).not.toContain('NaN');
  });

  it('model sense mostres: el degradat continua sent vàlid', () => {
    const lite = buildSolarDay({ dateStr: '2026-10-09', lat: 41.98, lon: 2.82, zone: makeZoneCtx('Europe/Madrid', 0) }, { lite: true })!;
    expect(plotBackground(lite, chartLayout(328, 156, 60, 1440)).backgroundImage).toContain('linear-gradient(90deg,#0c0f17 0%,#0c0f17 100%)');
  });
});

describe('buildChartGeom', () => {
  it('Girona 2026-10-07 (parell d\'Open-Meteo)', () => {
    const m = girona();
    const L = chartLayout(328, 156, 60, m.spanMin);
    const g = buildChartGeom(m, L);
    expect(g.W).toBe(328);
    expect(g.H).toBe(156);
    // Retalls de dalt a baix, sense forats.
    expect(g.clip.day.y).toBe(10);
    expect(g.clip.day.y + g.clip.day.h).toBeCloseTo(g.clip.gold.y, 1);
    expect(g.clip.gold.y + g.clip.gold.h).toBeCloseTo(g.clip.blue.y, 1);
    expect(g.clip.blue.y).toBeGreaterThan(L.yH);
    expect(g.clip.day.w).toBe(328);
    expect(g.horizon).toEqual({ x1: 34, x2: 314, y: 107.8 });
    expect(g.curve).toBe(curvePath(m, L));
    // Sortida 07:51 i posta 19:20 a l'horitzó, amb l'hora d'Open-Meteo.
    const riseMin = (m.t.sunrise! - m.startMs) / 60000;
    expect(riseMin).toBe(7 * 60 + 51);
    expect(g.riseDot).toEqual({ x: Math.round(L.x(riseMin) * 10) / 10, y: 107.8 });
    expect(g.setDot?.x).toBeCloseTo(L.x(19 * 60 + 20), 1);
    expect(g.riseLabel).toMatchObject({ text: '07:51', anchor: 'middle', y: 120.8 });
    expect(g.setLabel).toMatchObject({ text: '19:20' });
    // Migdia 13:36 a 42°.
    expect(g.noonLine).not.toBeNull();
    expect(g.noonLine!.x).toBeCloseTo(L.x(13 * 60 + 36), 0);
    expect(g.noonLine!.y2).toBe(107.8);
    expect(g.noonLabel).toMatchObject({ text: '42°', anchor: 'middle' });
    expect(g.noonLabel.y).toBeCloseTo(L.y(m.noonAltApp) - 7, 1);
    expect(g.xLabels.length).toBe(5);
    expect(g.yLabels.length).toBe(4);
    expect(g.stars.length).toBeGreaterThan(0);
    expect(g.grid.alts).not.toBe('');
  });

  it('Tromsø 2026-06-21 (dia polar): sense punts ni hores de sortida/posta', () => {
    const m = model(69.65, 18.96, 'Europe/Oslo', '2026-06-21');
    const g = buildChartGeom(m, chartLayout(328, 156, 60, m.spanMin));
    expect([g.riseDot, g.setDot, g.riseLabel, g.setLabel]).toEqual([null, null, null, null]);
    expect(g.noonLine).not.toBeNull();
  });

  it('Tromsø 2026-12-21 (nit polar): sense línia de migdia; etiqueta −3°', () => {
    const m = model(69.65, 18.96, 'Europe/Oslo', '2026-12-21');
    const g = buildChartGeom(m, chartLayout(328, 156, 30, m.spanMin));
    expect(g.noonLine).toBeNull();
    expect(g.noonLabel.text).toBe('−3°');
    expect(g.riseDot).toBeNull();
    expect(g.stars).not.toBe('');
  });

  it('Reykjavík 2026-06-21: la posta (00:04 de l\'endemà) cau fora del dia => només la sortida', () => {
    const m = model(64.15, -21.94, 'Atlantic/Reykjavik', '2026-06-21');
    const g = buildChartGeom(m, chartLayout(328, 156, 60, m.spanMin));
    expect(g.riseDot).not.toBeNull();
    expect(g.setDot).toBeNull();
    expect(g.riseLabel?.text).toBe(m.riseLabel?.text);
    expect(g.setLabel).toBeNull();
  });

  it('Alert 2026-10-14 (dia de 32 min): punts sí, hores amagades (< 44 px)', () => {
    const m = model(82.5, -62.35, 'America/Toronto', '2026-10-14');
    const g = buildChartGeom(m, chartLayout(328, 156, 30, m.spanMin));
    expect(g.riseDot).not.toBeNull();
    expect(g.setDot).not.toBeNull();
    expect(g.riseLabel).toBeNull();
    expect(g.setLabel).toBeNull();
  });

  it('les hores de sortida/posta no surten del gràfic', () => {
    const m = model(64.15, -21.94, 'Atlantic/Reykjavik', '2026-06-21');
    const L = chartLayout(328, 156, 60, m.spanMin);
    const g = buildChartGeom(m, L);
    expect(g.riseLabel!.x).toBeGreaterThanOrEqual(L.left + 16);
    expect(g.riseLabel!.x).toBeLessThanOrEqual(L.right - 16);
  });

  it('migdia tocant el sostre: l\'etiqueta passa a la dreta del pic', () => {
    const m = model(-0.18, -78.47, 'America/Guayaquil', '2026-10-07');   // ≈ 84°
    const g90 = buildChartGeom(m, chartLayout(328, 156, 90, m.spanMin));
    expect(g90.noonLabel.anchor).toBe('middle');
    expect(g90.noonLabel.text).toBe('84°');
    const L80 = chartLayout(328, 156, 80, m.spanMin);
    const g80 = buildChartGeom(m, L80);
    expect(g80.noonLabel.anchor).toBe('start');
    expect(g80.noonLabel.x).toBeCloseTo(L80.x(m.noonMin) + 6, 1);
    expect(g80.noonLabel.y).toBe(18);
  });
});
