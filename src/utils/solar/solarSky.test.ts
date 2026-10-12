import { describe, it, expect, beforeEach } from 'vitest';
import {
  SKY_ANCHORS, SKY_BASE, SKY_MIX, SKY_MAX_STOPS, skyColorAt, mixLinear, skyPaintAt, contrastRatio, hexToOklab,
  skyStopsCss, buildStarfieldUri, mulberry32, hashSeed, STARS_DAY, STARS_NIGHT,
} from './solarSky';
import { buildSolarDay, clearSolarDayCache, geometricAltitude, type SolarDayModel } from './solarDay';
import { makeZoneCtx } from './solarTime';

const model = (lat: number, lon: number, tz: string, dateStr: string): SolarDayModel => {
  const m = buildSolarDay({ dateStr, lat, lon, zone: makeZoneCtx(tz, 0) });
  if (!m) throw new Error('sense model');
  return m;
};

/** Color de la corba per alçada geomètrica (mateixos llindars que els retalls del gràfic). */
const curveColour = (alt: number) => (alt >= 6 ? '#fcd34d' : alt >= -4 ? '#f59e0b' : alt >= -6 ? '#60a5fa' : '#818cf8');

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
};

const parseStops = (css: string) => css.split(',').map(s => {
  const m = /^(#[0-9a-f]{6}) (-?[\d.]+)%$/.exec(s.trim());
  if (!m) throw new Error(`parada no vàlida: ${s}`);
  return { color: m[1], pos: Number(m[2]) };
});

beforeEach(() => clearSolarDayCache());

describe('skyColorAt (rampa OKLab)', () => {
  it('cada àncora retorna el seu hex exacte', () => {
    for (const [alt, hex] of SKY_ANCHORS) expect(skyColorAt(alt)).toBe(hex);
  });

  it('els extrems es retallen', () => {
    expect(skyColorAt(-40)).toBe('#05070f');
    expect(skyColorAt(-18.01)).toBe('#05070f');
    expect(skyColorAt(30)).toBe('#2b5585');
    expect(skyColorAt(85)).toBe('#2b5585');
    expect(skyColorAt(NaN)).toBe('#05070f');
  });

  it('entre àncores dona un hex vàlid diferent de tots dos extrems', () => {
    const c = skyColorAt(5.5);
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(c).not.toBe('#c17734');
    expect(c).not.toBe('#a98f6a');
  });

  it('sense fang: de −6° a +12° mai croma < 0.03 amb lluminositat < 0.45', () => {
    for (const alt of range(-6, 12, 0.5)) {
      const { L, C } = hexToOklab(skyColorAt(alt));
      expect(C < 0.03 && L < 0.45, `${alt}°: L ${L.toFixed(3)} C ${C.toFixed(3)}`).toBe(false);
    }
  });

  it('les parades d\'àncora ja barrejades amb la targeta (−6..+12) tampoc no fan fang', () => {
    for (const [alt, hex] of SKY_ANCHORS) {
      if (alt < -6 || alt > 12) continue;
      const { L, C } = hexToOklab(mixLinear(hex, SKY_BASE, SKY_MIX));
      expect(C < 0.03 && L < 0.45, `${alt}°`).toBe(false);
    }
  });

  it('la corba sempre té ≥ 3:1 sobre el cel pintat (−18°..60°)', () => {
    let worst = Infinity;
    for (const alt of range(-18, 60, 0.5)) {
      const r = contrastRatio(curveColour(alt), mixLinear(skyColorAt(alt), '#0c0f17', 0.34));
      worst = Math.min(worst, r);
      expect(r, `${alt}°`).toBeGreaterThanOrEqual(3);
    }
    expect(worst).toBeGreaterThan(3.3); // pitjor cas: hora daurada a +5.5° (≈ 3.35:1)
  });
});

describe('mixLinear, contrastRatio', () => {
  it('k és la part del color que entra a la base', () => {
    expect(mixLinear('#c17734', '#0c0f17', 0)).toBe('#0c0f17');
    expect(mixLinear('#c17734', '#0c0f17', 1)).toBe('#c17734');
    expect(skyPaintAt(4)).toBe(mixLinear('#c17734', SKY_BASE, SKY_MIX));
    // En lineal, el 50 % de blanc i negre és més clar que el gris sRGB #808080.
    expect(mixLinear('#ffffff', '#000000', 0.5)).toBe('#bcbcbc');
  });

  it('contrast WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#0c0f17', '#0c0f17')).toBe(1);
    expect(contrastRatio('#94a3b8', '#0c0f17')).toBeGreaterThan(7);   // slate-400 sobre la targeta
  });
});

describe('skyStopsCss', () => {
  const places: [string, number, number, string, string][] = [
    ['Girona', 41.98, 2.82, 'Europe/Madrid', '2026-10-07'],
    ['Girona (25 h)', 41.98, 2.82, 'Europe/Madrid', '2026-10-25'],
    ['Tromsø (dia polar)', 69.65, 18.96, 'Europe/Oslo', '2026-06-21'],
    ['Tromsø (nit polar)', 69.65, 18.96, 'Europe/Oslo', '2026-12-21'],
    ['Reykjavík', 64.15, -21.94, 'Atlantic/Reykjavik', '2026-06-21'],
    ['Quito', -0.18, -78.47, 'America/Guayaquil', '2026-10-07'],
    ['Kashgar (fus desplaçat)', 39.47, 75.99, 'Asia/Shanghai', '2026-06-21'],
    ['McMurdo', -77.85, 166.67, 'Pacific/Auckland', '2026-10-22'],
  ];
  for (const [name, lat, lon, tz, date] of places) {
    it(`${name}: ≤ ${SKY_MAX_STOPS} parades, posicions monòtones dins de [0, 100] %`, () => {
      const stops = parseStops(skyStopsCss(model(lat, lon, tz, date)));
      expect(stops.length).toBeGreaterThanOrEqual(3);
      expect(stops.length).toBeLessThanOrEqual(SKY_MAX_STOPS);
      expect(stops[0].pos).toBe(0);
      expect(stops[stops.length - 1].pos).toBe(100);
      for (let i = 1; i < stops.length; i++) expect(stops[i].pos).toBeGreaterThan(stops[i - 1].pos);
    });
  }

  it('Girona: una parada a cada creuament d\'àncora, al migdia i a la mitjanit solar', () => {
    const m = model(41.98, 2.82, 'Europe/Madrid', '2026-10-07');
    const stops = parseStops(skyStopsCss(m));
    const geo = Array.from(m.altApp, geometricAltitude);
    let crossings = 0;
    for (const [a] of SKY_ANCHORS) {
      for (let i = 0; i < geo.length - 1; i++) {
        if ((geo[i] < a && a <= geo[i + 1]) || (geo[i] > a && a >= geo[i + 1])) crossings++;
      }
    }
    // 2 extrems + migdia + mitjanit solar (01:36, dins del dia).
    expect(stops.length).toBe(crossings + 4);
    const noonPos = Math.round((m.noonMin / m.spanMin) * 10000) / 100;
    expect(stops.find(s => s.pos === noonPos)?.color).toBe(skyPaintAt(m.noonGeo));
    // Les parades d'àncora porten el color barrejat de l'àncora.
    const paints = new Set(SKY_ANCHORS.map(([, c]) => mixLinear(c, SKY_BASE, SKY_MIX)));
    expect(stops.filter(s => paints.has(s.color)).length).toBeGreaterThanOrEqual(crossings);
  });

  it('model lite (sense mostres): cadena buida', () => {
    const m = buildSolarDay({ dateStr: '2026-10-07', lat: 41.98, lon: 2.82, zone: makeZoneCtx('Europe/Madrid', 0) }, { lite: true });
    expect(skyStopsCss(m!)).toBe('');
  });
});

describe('estrelles del full (data URI)', () => {
  it('deterministes, sense "#" cru i amb el nombre d\'estrelles demanat', () => {
    const opts = { count: 26, seed: 42, color: 'rgb(226,232,240)', rMin: 0.5, rMax: 1.1, aMin: 0.25, aMax: 0.75 };
    const a = buildStarfieldUri(opts), b = buildStarfieldUri(opts);
    expect(a).toBe(b);
    expect(a.startsWith('data:image/svg+xml,')).toBe(true);
    expect(a).not.toContain('#');
    const svg = decodeURIComponent(a.slice('data:image/svg+xml,'.length));
    expect(svg).toContain('width="360" height="220"');
    expect(svg.match(/<g /g)?.length).toBe(1);
    expect(svg.match(/<circle /g)?.length).toBe(26);
    for (const m of svg.matchAll(/cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill-opacity="([\d.]+)"/g)) {
      const [x, y, r, a2] = m.slice(1).map(Number);
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(360);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(220);
      expect(r).toBeGreaterThanOrEqual(0.5); expect(r).toBeLessThanOrEqual(1.1);
      expect(a2).toBeGreaterThanOrEqual(0.25); expect(a2).toBeLessThanOrEqual(0.75);
    }
    expect(buildStarfieldUri({ ...opts, seed: 43 })).not.toBe(a);
  });

  it('les estrelles s\'acumulen a dalt (y = alt·rand^1.6)', () => {
    const svg = decodeURIComponent(buildStarfieldUri({
      count: 400, seed: 7, color: 'rgb(1,2,3)', rMin: 0.5, rMax: 1.1, aMin: 0.2, aMax: 0.3,
    }).slice(19));
    const ys = [...svg.matchAll(/cy="([\d.]+)"/g)].map(m => Number(m[1]));
    // P(y < 110) = 0.5^(1/1.6) ≈ 0.65 (amb una distribució uniforme seria 0.5).
    const top = ys.filter(y => y < 110).length / ys.length;
    expect(top).toBeGreaterThan(0.58);
    expect(top).toBeLessThan(0.72);
  });

  it('STARS_NIGHT (26) i STARS_DAY (10) són valors CSS url("…")', () => {
    for (const [v, n, color] of [[STARS_NIGHT, 26, 'rgb(226,232,240)'], [STARS_DAY, 10, 'rgb(253,230,138)']] as const) {
      expect(v.startsWith('url("data:image/svg+xml,')).toBe(true);
      expect(v.endsWith('")')).toBe(true);
      expect(v).not.toContain('#');
      const svg = decodeURIComponent(v.slice(5, -2).slice('data:image/svg+xml,'.length));
      expect(svg.match(/<circle /g)?.length).toBe(n);
      expect(svg).toContain(`fill="${color}"`);
    }
  });

  it('mulberry32 i hashSeed són deterministes', () => {
    const a = mulberry32(1), b = mulberry32(1);
    for (let i = 0; i < 5; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(hashSeed('2026-10-07|41.98|2.82')).toBe(hashSeed('2026-10-07|41.98|2.82'));
    expect(hashSeed('2026-10-07')).not.toBe(hashSeed('2026-10-08'));
  });
});
