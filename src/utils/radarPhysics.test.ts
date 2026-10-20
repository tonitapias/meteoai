import { describe, it, expect } from 'vitest';
import { computeMeteosatSlot, computeGibsSlot, computeLightningSlots, GibsTimelineSchema, HdTimelineSchema, HD_BOUNDS, LightningLatestSchema } from './radarPhysics';

// Franges de la capa HD: Meteosat amb hores pròpies (MTG cada 10 min, MSG de
// reserva cada 15) i GOES/Himawari amb les franges de GIBS (cada 10 min).
const T = Date.UTC(2026, 9, 19, 16, 0, 0) / 1000; // múltiple de 10 i de 15 min

describe('computeMeteosatSlot', () => {
  const mtg = { layer: 'mtg' as const, latest: T, cadence: 600, source: 'caps' as const };

  it('MTG: la desena de minuts del fotograma', () => {
    expect(computeMeteosatSlot(T - 3600 + 7 * 60, mtg, 0)).toEqual({ variant: 'mtg', slot: T - 3600 });
    expect(computeMeteosatSlot(T - 600, mtg, 0)).toEqual({ variant: 'mtg', slot: T - 600 });
  });

  it('un fotograma posterior a l\'última imatge publicada fa servir aquesta', () => {
    expect(computeMeteosatSlot(T + 25 * 60, mtg, 0).slot).toBe(T);
  });

  it('MSG: quinzenes de minuts', () => {
    const msg = { layer: 'msg' as const, latest: T, cadence: 900, source: 'caps' as const };
    expect(computeMeteosatSlot(T - 3600 + 14 * 60, msg, 0)).toEqual({ variant: 'msg', slot: T - 3600 });
  });

  it('sense /latest: MTG amb l\'hora calculada (ara − 30 min)', () => {
    const now = T + 30 * 60 + 9 * 60; // 16:39 → 16:09 → 16:00
    expect(computeMeteosatSlot(now - 60, null, now)).toEqual({ variant: 'mtg', slot: T });
    expect(computeMeteosatSlot(T - 3600, null, now)).toEqual({ variant: 'mtg', slot: T - 3600 });
  });
});

describe('computeMeteosatSlot en color (GeoColour)', () => {
  const colour = { latest: T - 600, cadence: 600, source: 'caps' as const };
  const mtg = { layer: 'mtg' as const, latest: T, cadence: 600, source: 'caps' as const, colour };

  it('amb franja de GeoColour: variant mtgColour amb la seva pròpia última imatge', () => {
    expect(computeMeteosatSlot(T - 3600 + 7 * 60, mtg, 0, true)).toEqual({ variant: 'mtgColour', slot: T - 3600 });
    expect(computeMeteosatSlot(T + 25 * 60, mtg, 0, true)).toEqual({ variant: 'mtgColour', slot: T - 600 });
  });

  it('GeoColour no disponible, worker antic o MSG: l\'IR', () => {
    expect(computeMeteosatSlot(T, { ...mtg, colour: null }, 0, true)).toEqual({ variant: 'mtg', slot: T });
    expect(computeMeteosatSlot(T, { layer: 'mtg', latest: T, cadence: 600, source: 'caps' }, 0, true)).toEqual({ variant: 'mtg', slot: T });
    expect(computeMeteosatSlot(T, { layer: 'msg', latest: T, cadence: 900, source: 'caps', colour }, 0, true)).toEqual({ variant: 'msg', slot: T });
  });

  it('sense /latest: GeoColour amb l\'hora calculada', () => {
    const now = T + 30 * 60 + 9 * 60;
    expect(computeMeteosatSlot(now - 60, null, now, true)).toEqual({ variant: 'mtgColour', slot: T });
  });
});

describe('computeLightningSlots', () => {
  const latest = { latest: T, cadence: 300, source: 'caps' as const };

  it('les dues franges de 5 min al voltant del fotograma: [T − 5, T + 5)', () => {
    expect(computeLightningSlots(T - 3600, latest, 0)).toEqual([T - 3900, T - 3600]);
    // Fotograma no alineat a 5 min (p. ex. RainViewer): les del seu interval.
    expect(computeLightningSlots(T - 3600 + 120, latest, 0)).toEqual([T - 3900, T - 3600]);
  });

  it('mai més noves que l\'última publicada', () => {
    expect(computeLightningSlots(T + 300, latest, 0)).toEqual([T]);
    expect(computeLightningSlots(T + 1800, latest, 0)).toEqual([T]);
  });

  it('null (Lightning Imager aturat): cap franja; sense /latest: hora calculada', () => {
    expect(computeLightningSlots(T, null, 0)).toEqual([]);
    const now = T + 30 * 60 + 2 * 60;
    expect(computeLightningSlots(T + 600, undefined, now)).toEqual([T]);
  });
});

describe('computeGibsSlot', () => {
  // GIBS té de T − 60 a T cada 10 min, menys T − 20 (forat).
  const slots = [T - 3600, T - 3000, T - 2400, T - 1800, T - 600, T];
  const product = (latest: number) => ({ latest, cadence: 600, source: 'caps' as const, slots: slots.filter((s) => s <= latest) });
  const timeline = { ir: product(T), colour: product(T - 600) };

  it('la franja més nova fins a l\'hora del fotograma; on falta, l\'anterior', () => {
    expect(computeGibsSlot(T - 1800 + 5 * 60, timeline, 0)).toEqual({ variant: 'gibs', slot: T - 1800 });
    expect(computeGibsSlot(T - 1200, timeline, 0)).toEqual({ variant: 'gibs', slot: T - 1800 });
    expect(computeGibsSlot(T - 600, timeline, 0)).toEqual({ variant: 'gibs', slot: T - 600 });
  });

  it('fotograma posterior a l\'última: l\'última; anterior a totes: la primera', () => {
    expect(computeGibsSlot(T + 25 * 60, timeline, 0).slot).toBe(T);
    expect(computeGibsSlot(T - 5 * 3600, timeline, 0).slot).toBe(T - 3600);
  });

  it('en color, les franges de GeoColor; sense GeoColor (Himawari), l\'IR', () => {
    expect(computeGibsSlot(T, timeline, 0, true)).toEqual({ variant: 'gibsColour', slot: T - 600 });
    expect(computeGibsSlot(T, { ...timeline, colour: null }, 0, true)).toEqual({ variant: 'gibs', slot: T });
  });

  it('sense /latest: la desena del fotograma, com a molt ara − 40 min, en IR', () => {
    const now = T + 3600;
    expect(computeGibsSlot(T - 600 + 7 * 60, null, now, true)).toEqual({ variant: 'gibs', slot: T - 600 });
    expect(computeGibsSlot(now - 60, null, now)).toEqual({ variant: 'gibs', slot: T + 1200 });
  });
});

describe('GibsTimelineSchema', () => {
  it('accepta la resposta del worker (color o null) i rebutja franges no numèriques', () => {
    const p = { latest: T, cadence: 600, source: 'caps', slots: [T - 600, T] };
    expect(GibsTimelineSchema.safeParse({ ir: p, colour: p }).success).toBe(true);
    expect(GibsTimelineSchema.safeParse({ ir: { ...p, source: 'computed' }, colour: null }).success).toBe(true);
    expect(GibsTimelineSchema.safeParse({ ir: { ...p, slots: ['x'] }, colour: null }).success).toBe(false);
    expect(GibsTimelineSchema.safeParse({ ir: p }).success).toBe(false);
  });
});

describe('HD_BOUNDS', () => {
  it('GOES i Himawari fins a 66,4°N (frontera de tessel·la), GOES fins a -180°', () => {
    expect(HD_BOUNDS.goes).toEqual([-180, -60, -20, 66.4]);
    expect(HD_BOUNDS.himawari).toEqual([80, -60, 180, 66.4]);
  });
});

describe('HdTimelineSchema', () => {
  it('accepta la resposta del worker i rebutja una capa desconeguda', () => {
    expect(HdTimelineSchema.safeParse({ layer: 'mtg', latest: T, cadence: 600, source: 'caps' }).success).toBe(true);
    expect(HdTimelineSchema.safeParse({ layer: 'goes', latest: T, cadence: 600, source: 'caps' }).success).toBe(false);
  });

  it('accepta el camp colour (franja o null) i un worker anterior sense', () => {
    const base = { layer: 'mtg', latest: T, cadence: 600, source: 'caps' };
    expect(HdTimelineSchema.safeParse({ ...base, colour: { latest: T, cadence: 600, source: 'caps' } }).success).toBe(true);
    expect(HdTimelineSchema.safeParse({ ...base, colour: null }).success).toBe(true);
    expect(HdTimelineSchema.safeParse({ ...base, colour: { latest: 'x' } }).success).toBe(false);
  });
});

describe('LightningLatestSchema', () => {
  it('franja o null', () => {
    expect(LightningLatestSchema.safeParse({ latest: T, cadence: 300, source: 'caps' }).success).toBe(true);
    expect(LightningLatestSchema.safeParse(null).success).toBe(true);
    expect(LightningLatestSchema.safeParse({ layer: 'mtg' }).success).toBe(false);
  });
});
