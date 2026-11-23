// src/utils/sky/nightVerdict.test.ts
// Les regles de la frase «Aquesta nit»: classe del cel, presència de la lluna, canvi de cel i títol.
import { describe, it, expect } from 'vitest';
import { classifyNightSky, moonPresence, nightSkyChange, nightVerdict } from './nightVerdict';
import type { MoonSample, NightSkyCell } from './nightSky';
import type { SkyKind } from '../daySky';

const H = 3600000;
const cellsOf = (kinds: Array<SkyKind | null>): NightSkyCell[] =>
  kinds.map((kind, i) => ({ kind, isDay: false, startMs: i * H, endMs: (i + 1) * H, from: i / kinds.length, to: (i + 1) / kinds.length }));
const win = (n: number) => n * H;
const moonUp = (share: number, n = 100): MoonSample[] => Array.from({ length: n }, (_, i) => ({ f: i / (n - 1), alt: i < share * n ? 30 : -10 }));
const repeat = <T,>(v: T, n: number): T[] => Array.from({ length: n }, () => v);

describe('classifyNightSky', () => {
  it('serè amb 3/4 d\'hores obertes (serè o clarianes), tapat amb 1/4 o menys, si no clarianes', () => {
    expect(classifyNightSky(cellsOf([...repeat<SkyKind>('clear', 9), ...repeat<SkyKind>('cloudy', 3)]), win(12))).toBe('clear');
    expect(classifyNightSky(cellsOf([...repeat<SkyKind>('partly', 3), ...repeat<SkyKind>('cloudy', 9)]), win(12))).toBe('cloudy');
    expect(classifyNightSky(cellsOf([...repeat<SkyKind>('clear', 6), ...repeat<SkyKind>('fog', 6)]), win(12))).toBe('mixed');
  });

  it('nit de pluja, neu o tempestes quan almenys un 30 % de les hores en porten (la més llarga mana)', () => {
    expect(classifyNightSky(cellsOf([...repeat<SkyKind>('rain', 4), ...repeat<SkyKind>('cloudy', 8)]), win(12))).toBe('rain');
    expect(classifyNightSky(cellsOf([...repeat<SkyKind>('snow', 3), 'rain', ...repeat<SkyKind>('cloudy', 8)]), win(12))).toBe('snow');
    expect(classifyNightSky(cellsOf([...repeat<SkyKind>('rain', 3), ...repeat<SkyKind>('cloudy', 9)]), win(12))).toBe('cloudy');
  });

  it('sense dades de mitja nit o més: desconegut', () => {
    expect(classifyNightSky(cellsOf([...repeat<SkyKind>('clear', 5), ...repeat(null, 7)]), win(12))).toBe('unknown');
    expect(classifyNightSky([], win(12))).toBe('unknown');
  });
});

describe('nightSkyChange', () => {
  it('s\'obre: tapat fins a les 02 h i serè fins a l\'alba (≥ 3 h)', () => {
    const c = cellsOf([...repeat<SkyKind>('cloudy', 9), ...repeat<SkyKind>('clear', 5)]);
    expect(nightSkyChange(c)).toEqual({ kind: 'opens', atMs: 9 * H });
  });

  it('es tapa: serè al vespre i tapat (o plou) fins a l\'alba', () => {
    const c = cellsOf([...repeat<SkyKind>('partly', 4), ...repeat<SkyKind>('cloudy', 4), ...repeat<SkyKind>('rain', 4)]);
    expect(nightSkyChange(c)).toEqual({ kind: 'closes', atMs: 4 * H });
  });

  it('cap canvi si el tram final és curt o el cel no canvia', () => {
    expect(nightSkyChange(cellsOf([...repeat<SkyKind>('cloudy', 10), ...repeat<SkyKind>('clear', 2)]))).toBeNull();
    expect(nightSkyChange(cellsOf(repeat<SkyKind>('clear', 12)))).toBeNull();
    expect(nightSkyChange(cellsOf(['cloudy', 'clear', 'cloudy', 'clear', 'cloudy', 'clear']))).toBeNull();
  });
});

describe('moonPresence', () => {
  it('ben visible amb ≥ 60 % i a dalt ≥ 40 % de la nit; gens si no surt o és gairebé nova', () => {
    expect(moonPresence(moonUp(1), 99)).toBe('bright');
    expect(moonPresence(moonUp(0.3), 99)).toBe('some');
    expect(moonPresence(moonUp(1), 40)).toBe('some');
    expect(moonPresence(moonUp(0), 99)).toBe('none');
    expect(moonPresence(moonUp(1), 5)).toBe('none');
    expect(moonPresence([], 99)).toBe('none');
  });
});

describe('nightVerdict', () => {
  it('títol per cel i lluna', () => {
    const clear = cellsOf(repeat<SkyKind>('clear', 12));
    const cloudy = cellsOf(repeat<SkyKind>('cloudy', 12));
    expect(nightVerdict(clear, win(12), moonUp(1), 99).title).toBe('clearMoon');
    expect(nightVerdict(clear, win(12), moonUp(0), 99).title).toBe('clearDark');
    expect(nightVerdict(clear, win(12), moonUp(0.2), 50).title).toBe('clear');
    expect(nightVerdict(cloudy, win(12), moonUp(1), 99).title).toBe('cloudyMoon');
    expect(nightVerdict(cloudy, win(12), moonUp(0), 99).title).toBe('cloudy');
    expect(nightVerdict(cellsOf(repeat<SkyKind>('storm', 12)), win(12), moonUp(1), 99).title).toBe('storm');
    expect(nightVerdict(cellsOf(repeat(null, 12)), win(12), moonUp(1), 99)).toMatchObject({ title: 'unknown', change: null });
  });

  it('la nit tapada que s\'obre a les 02 h diu tots dos', () => {
    const v = nightVerdict(cellsOf([...repeat<SkyKind>('cloudy', 9), ...repeat<SkyKind>('clear', 5)]), win(14), moonUp(1), 99);
    expect(v.sky).toBe('mixed');
    expect(v.title).toBe('mixedMoon');
    expect(v.change).toEqual({ kind: 'opens', atMs: 9 * H });
  });
});
