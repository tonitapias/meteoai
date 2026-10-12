import { describe, it, expect } from 'vitest';
import {
  formatCountdown, formatDeltaLong, formatDeltaCompact, signedDeg, readoutCoords, shadowRatio,
  formatRange, formatLatLon, formatOffsetFromNoon, uvDisplay, untilDateText, degText, azText, capitalize,
} from './solarFormat';
import { solarStrings } from '../../components/solar/solarI18n';

const CA = solarStrings('ca');
const EN = solarStrings('en');

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('formatCountdown (paritat amb SunArcWidget)', () => {
  it('arrodonit avall i sense zeros', () => {
    expect(formatCountdown((3 * 3600 + 12 * 60 + 59) * 1000)).toBe('3h 12m');
    expect(formatCountdown(59 * 1000)).toBe('0h 0m');
    expect(formatCountdown(0)).toBe('0h 0m');
    expect(formatCountdown(-1)).toBeNull();
    expect(formatCountdown(NaN)).toBeNull();
  });

  it('igual que la fórmula de la targeta per a 500 valors', () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const d = Math.floor(rand() * 2 * 86400);
      expect(formatCountdown(d * 1000)).toBe(`${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m`);
    }
  });
});

describe('Δ de durada', () => {
  it('format llarg', () => {
    expect(formatDeltaLong(-166)).toEqual({ sign: -1, text: '2 min 46 s' });
    expect(formatDeltaLong(-166.3)).toEqual({ sign: -1, text: '2 min 46 s' });
    expect(formatDeltaLong(42)).toEqual({ sign: 1, text: '42 s' });
    expect(formatDeltaLong(0.4)).toEqual({ sign: 0, text: '' });
    expect(formatDeltaLong(-0.9)).toEqual({ sign: 0, text: '' });
    expect(formatDeltaLong(120)).toEqual({ sign: 1, text: '2 min' });
    expect(formatDeltaLong(3900)).toEqual({ sign: 1, text: '1h 05m' });
  });

  it('format compacte', () => {
    expect(formatDeltaCompact(-166)).toBe('−2:46');
    expect(formatDeltaCompact(5)).toBe('+0:05');
    expect(formatDeltaCompact(0)).toBe('0:00');
    expect(formatDeltaCompact(0.4)).toBe('0:00');
    expect(formatDeltaCompact(3900)).toBe('+1:05:00');
  });
});

describe('graus i ombra', () => {
  it('signedDeg', () => {
    expect(signedDeg(27.4)).toBe('+27°');
    expect(signedDeg(-0.4)).toBe('0°');
    expect(signedDeg(-5.6)).toBe('−6°');
    expect(signedDeg(0)).toBe('0°');
  });

  it('shadowRatio', () => {
    expect(shadowRatio(42.43)).toBe('1.1');
    expect(shadowRatio(31.37)).toBe('1.6');
    expect(shadowRatio(4.9)).toBeNull();
    expect(shadowRatio(5.5)).toBe('10');
    expect(shadowRatio(5.75)).toBe('9.9');
    // r ≈ 9.97: toFixed(1) donaria "10.0"; a partir de 10 va sense decimals.
    expect(shadowRatio(5.727)).toBe('10');
    expect(shadowRatio(90)).toBe('0.0');
  });

  it('readoutCoords', () => {
    expect(readoutCoords(225.3, 31.37, 'ca', CA)).toBe('225° SO · +31° · ombra 1.6× cap a NE');
    expect(readoutCoords(225.3, 31.37, 'en', EN)).toBe('225° SW · +31° · shadow 1.6× toward NE');
    expect(readoutCoords(100, 3, 'ca', CA)).toBe('100° E · +3°');
    expect(readoutCoords(359.7, -12.2, 'ca', CA)).toBe('0° N · −12°');
  });
});

describe('intervals, coordenades i migdia', () => {
  it('formatRange', () => {
    expect(formatRange('07:34', '08:29')).toBe('07:34–08:29');
    expect(formatRange({ text: '22:35', shift: 0 }, null)).toBe('22:35 …');
    expect(formatRange(undefined, { text: '02:56', shift: 0 })).toBe('… 02:56');
    expect(formatRange(null, null)).toBeNull();
  });

  it('formatLatLon (espai no separable dins de cada coordenada: mai es parteix)', () => {
    const nb = (s: string) => s.replace(/° /g, '°\u00A0');
    expect(formatLatLon(41.98, 2.82, 'ca')).toBe(nb('41.98° N') + ' ' + nb('2.82° E'));
    expect(formatLatLon(-33.87, 151.21, 'en')).toBe(nb('33.87° S') + ' ' + nb('151.21° E'));
    expect(formatLatLon(64.15, -21.94, 'en')).toBe(nb('64.15° N') + ' ' + nb('21.94° W'));
    expect(formatLatLon(64.15, -21.94, 'fr')).toBe(nb('64.15° N') + ' ' + nb('21.94° O'));
  });

  it('untilDateText: article català apostrofat l\'1 i l\'11; "1er" en francès', () => {
    expect(untilDateText('2026-10-14', 'ca', 'ca-ES')).toBe('al 14 d’octubre');
    expect(untilDateText('2026-11-01', 'ca', 'ca-ES')).toBe('a l’1 de novembre');
    expect(untilDateText('2026-10-11', 'ca', 'ca-ES')).toBe('a l’11 d’octubre');
    expect(untilDateText('2026-11-01', 'fr', 'fr-FR')).toBe('1er novembre');
    expect(untilDateText('2026-11-11', 'fr', 'fr-FR')).toBe('11 novembre');
    expect(untilDateText('2026-11-01', 'es', 'es-ES')).toBe('1 de noviembre');
    expect(untilDateText('2026-11-01', 'en', 'en-US')).toBe('November 1');
  });

  it('degText, azText i capitalize compartits', () => {
    expect(degText(41.6)).toBe('42°');
    expect(degText(-2.6)).toBe('−3°');
    expect(degText(-0.4)).toBe('0°');
    expect(azText(96.7, 'ca')).toBe('97° E');
    expect(azText(359.7, 'en')).toBe('0° N');
    expect(azText(null, 'ca')).toBe('—');
    expect(capitalize('dimecres, 7 d’octubre', 'ca-ES')).toBe('Dimecres, 7 d’octubre');
    expect(capitalize('', 'ca-ES')).toBe('');
  });

  it('formatOffsetFromNoon', () => {
    expect(formatOffsetFromNoon(96, CA)).toBe('1h 36m després de les 12:00');
    expect(formatOffsetFromNoon(-36, CA)).toBe('36 min abans de les 12:00');
    expect(formatOffsetFromNoon(0, CA)).toBe('a les 12:00 en punt');
    expect(formatOffsetFromNoon(60, EN)).toBe('1h 00m after 12:00');
  });
});

describe('uvDisplay', () => {
  it('un decimal i el color de la categoria (vermell i porpra al to 400)', () => {
    expect(uvDisplay(5.45)).toEqual({ text: '5.5', cls: 'text-orange-500' });
    expect(uvDisplay(9.2)).toEqual({ text: '9.2', cls: 'text-red-400' });
    expect(uvDisplay(11.4)).toEqual({ text: '11.4', cls: 'text-purple-400' });
    expect(uvDisplay(2.4)).toEqual({ text: '2.4', cls: 'text-emerald-400' });
    expect(uvDisplay(null)).toBeNull();
    expect(uvDisplay(NaN)).toBeNull();
  });
});
