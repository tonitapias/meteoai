import { describe, it, expect } from 'vitest';
import {
  computeWelcomeSky, orbitAngle, orbitPoint, placeFromTimeZone, welcomePhase, ORBIT,
} from './welcomeSky';
import { moonPhaseKey } from './moonPhaseKey';
import { contourPaths } from './contourTexture';

const BARCELONA = { lat: 41.39, lon: 2.17, source: 'gps' as const };

describe('placeFromTimeZone', () => {
  it('fa servir la ciutat de referència de la zona', () => {
    expect(placeFromTimeZone('Europe/Madrid', 60)).toEqual({ lat: 40.4, lon: -3.7, source: 'timezone' });
    expect(placeFromTimeZone('Australia/Sydney', 600)).toEqual({ lat: -33.9, lon: 151.2, source: 'timezone' });
  });

  it('entén els noms antics que encara retornen alguns navegadors', () => {
    expect(placeFromTimeZone('Asia/Calcutta', 330)).toEqual(placeFromTimeZone('Asia/Kolkata', 330));
    expect(placeFromTimeZone('Europe/Kiev', 120).source).toBe('timezone');
  });

  it('sense zona coneguda, estima la longitud pel desfasament i la latitud pel continent', () => {
    expect(placeFromTimeZone('Etc/GMT-3', 180)).toEqual({ lat: 30, lon: 45, source: 'offset' });
    expect(placeFromTimeZone('UTC', 0)).toEqual({ lat: 30, lon: 0, source: 'offset' });
    expect(placeFromTimeZone(undefined, -300).lon).toBe(-75);
  });
});

describe('welcomePhase', () => {
  it('fa servir les franges de llum del modal Solar', () => {
    expect(welcomePhase(10, true)).toBe('dia');
    expect(welcomePhase(6, false)).toBe('dia');
    expect(welcomePhase(2, true)).toBe('alba');
    expect(welcomePhase(2, false)).toBe('posta');
    expect(welcomePhase(-5, false)).toBe('posta');
    expect(welcomePhase(-6.5, true)).toBe('nit');
  });
});

describe('orbitAngle', () => {
  it('toca l\'horitzó en sortir i pondre\'s i és dalt de tot a la culminació', () => {
    const rise = orbitAngle(-0.8, 50, true)!;
    const [, yRise] = orbitPoint(rise);
    expect(rise).toBeLessThan(0);
    expect(yRise).toBeCloseTo(ORBIT.horizonY, 0);
    expect(orbitAngle(50, 50, false)).toBeCloseTo(0, 5);
    expect(orbitAngle(-3, 50, false)).toBeNull();
  });
});

describe('computeWelcomeSky (Barcelona, 23-10-2026)', () => {
  it('alba a les 07:52: el sol encara és sota l\'horitzó', () => {
    const sky = computeWelcomeSky(new Date('2026-10-23T05:52:00Z'), BARCELONA);
    expect(sky.phase).toBe('alba');
    expect(sky.sunAngle).toBeNull();
  });

  it('dia: a les 14:00 el sol és gairebé dalt de tot (migdia solar 13:35) i a les 16:00 ja baixa per l\'oest', () => {
    const noon = computeWelcomeSky(new Date('2026-10-23T12:00:00Z'), BARCELONA);
    expect(noon.phase).toBe('dia');
    expect(Math.abs(noon.sunAngle!)).toBeLessThan(15);
    expect(noon.moon.angle).toBeNull();
    const afternoon = computeWelcomeSky(new Date('2026-10-23T14:00:00Z'), BARCELONA);
    expect(afternoon.phase).toBe('dia');
    expect(afternoon.sunAngle!).toBeGreaterThan(20);
  });

  it('posta a les 18:50: el sol arran d\'horitzó a l\'oest', () => {
    const sky = computeWelcomeSky(new Date('2026-10-23T16:50:00Z'), BARCELONA);
    expect(sky.phase).toBe('posta');
    expect(sky.sunAngle!).toBeGreaterThan(70);
  });

  it('nit a les 22:30: la lluna gibosa creixent és alta al cel', () => {
    const sky = computeWelcomeSky(new Date('2026-10-23T20:30:00Z'), BARCELONA);
    expect(sky.phase).toBe('nit');
    expect(sky.sunAngle).toBeNull();
    expect(sky.moon.angle).not.toBeNull();
    expect(moonPhaseKey(sky.moon.phase)).toBe('waxingGibbous');
    expect(sky.moon.illumination).toBeGreaterThan(85);
    expect(sky.colors.bottom).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('a l\'hemisferi sud marca l\'òrbita girada', () => {
    expect(computeWelcomeSky(new Date('2026-10-23T02:00:00Z'), { lat: -33.9, lon: 151.2, source: 'timezone' }).south).toBe(true);
    expect(computeWelcomeSky(new Date('2026-10-23T02:00:00Z'), BARCELONA).south).toBe(false);
  });

  it('a la nit polar el sol no surt a l\'òrbita', () => {
    const sky = computeWelcomeSky(new Date('2026-12-21T10:00:00Z'), { lat: 78.2, lon: 15.6, source: 'timezone' });
    expect(sky.sunAngle).toBeNull();
  });
});

describe('moonPhaseKey', () => {
  it('fa servir els llindars de la targeta Fase lunar', () => {
    expect(moonPhaseKey(0)).toBe('new');
    expect(moonPhaseKey(0.25)).toBe('firstQuarter');
    expect(moonPhaseKey(0.5)).toBe('full');
    expect(moonPhaseKey(0.75)).toBe('lastQuarter');
    expect(moonPhaseKey(0.9)).toBe('waningCrescent');
    expect(moonPhaseKey(NaN)).toBe('new');
  });
});

describe('contourPaths', () => {
  it('genera les corbes un sol cop i sense valors invàlids', () => {
    const a = contourPaths();
    expect(a.normal.length).toBeGreaterThan(1000);
    expect(a.index.length).toBeGreaterThan(100);
    expect(a.normal + a.index).not.toMatch(/NaN|Infinity/);
    expect(contourPaths()).toBe(a);
  });
});
