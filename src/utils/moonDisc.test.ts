// src/utils/moonDisc.test.ts
import { describe, it, expect } from 'vitest';
import { lunationArc, moonLitPath, ringPoint } from './moonDisc';

const arcs = (d: string) => [...d.matchAll(/A([\d.]+),([\d.]+) 0 (\d) (\d) /g)].map(m => ({ rx: Number(m[1]), large: m[3], sweep: m[4] }));

describe('moonLitPath (hemisferi nord)', () => {
  it('lluna nova: res il·luminat; plena: el disc sencer (la mateixa finestra que els noms de fase)', () => {
    for (const p of [0, 0.01, 0.99, 1]) expect(moonLitPath(p, 40)).toBe('');
    expect(arcs(moonLitPath(0.5, 40))).toEqual([{ rx: 40, large: '1', sweep: '1' }, { rx: 40, large: '1', sweep: '1' }]);
  });

  it('creixent: el limbe il·luminat és el de la dreta i el terminador s\'eixampla cap a la plena', () => {
    const crescent = arcs(moonLitPath(0.1, 40));
    expect(crescent[0]).toMatchObject({ rx: 40, sweep: '1' });   // dalt → baix per la dreta
    expect(crescent[1].sweep).toBe('0');                         // terminador corbat cap a la dreta: falç
    const gibbous = arcs(moonLitPath(0.4, 40));
    expect(gibbous[1].sweep).toBe('1');                          // terminador cap a l'esquerra: gibosa
    expect(arcs(moonLitPath(0.25, 40))[1].rx).toBeCloseTo(0, 0); // quart: terminador recte
  });

  it('minvant: el limbe il·luminat és el de l\'esquerra', () => {
    expect(arcs(moonLitPath(0.75, 40))[0]).toMatchObject({ rx: 40, sweep: '0' });
    expect(arcs(moonLitPath(0.9, 40))[1].sweep).toBe('1');
  });

  it('una fase no vàlida no peta: com la lluna nova', () => {
    expect(moonLitPath(NaN, 40)).toBe('');
  });
});

describe('anell del cicle', () => {
  it('ringPoint: 0° a dalt, 90° a la dreta, 180° a baix', () => {
    const near = ([x, y]: [number, number], ex: number, ey: number) => { expect(x).toBeCloseTo(ex, 6); expect(y).toBeCloseTo(ey, 6); };
    near(ringPoint(60, 60, 50, 0), 60, 10);
    near(ringPoint(60, 60, 50, 90), 110, 60);
    near(ringPoint(60, 60, 50, 180), 60, 110);
  });

  it('lunationArc: buit a la lluna nova, quart creixent fins a la dreta, i arc gran passada la plena', () => {
    expect(lunationArc(60, 60, 50, 0)).toBe('');
    expect(lunationArc(60, 60, 50, 0.25)).toBe('M60.0,10.0A50,50 0 0 1 110.0,60.0');
    expect(lunationArc(60, 60, 50, 0.75)).toMatch(/ 0 1 1 /);
  });
});
