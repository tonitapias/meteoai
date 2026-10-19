import { describe, it, expect } from 'vitest';
import { computeMeteosatSlot, computeGibsSlot, HdTimelineSchema } from './radarPhysics';

// Franges de la capa HD: Meteosat amb hores pròpies (MTG cada 10 min, MSG de
// reserva cada 15) i GOES/Himawari amb el satèl·lit de LibreWXR.
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

describe('computeGibsSlot', () => {
  it('el frame de satèl·lit de LibreWXR més proper', () => {
    const sat = [{ time: T - 3600, path: '/a' }, { time: T - 1200, path: '/b' }, { time: null, path: '/c' }];
    expect(computeGibsSlot(T - 1000, sat)).toBe(T - 1200);
    expect(computeGibsSlot(T - 3000, sat)).toBe(T - 3600);
  });

  it('sense frames de LibreWXR: l\'hora anterior', () => {
    expect(computeGibsSlot(T + 25 * 60, [])).toBe(T - 3600);
  });
});

describe('HdTimelineSchema', () => {
  it('accepta la resposta del worker i rebutja una capa desconeguda', () => {
    expect(HdTimelineSchema.safeParse({ layer: 'mtg', latest: T, cadence: 600, source: 'caps' }).success).toBe(true);
    expect(HdTimelineSchema.safeParse({ layer: 'goes', latest: T, cadence: 600, source: 'caps' }).success).toBe(false);
  });
});
