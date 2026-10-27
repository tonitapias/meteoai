import { describe, expect, it } from 'vitest';
import { createStretchCounter, rubberBand } from './columnStretch';

describe('createStretchCounter', () => {
  it('obre a la tercera estirada dins la finestra i torna a començar', () => {
    const c = createStretchCounter(3, 5000);
    expect(c.pull(0)).toBe(false);
    expect(c.pull(1000)).toBe(false);
    expect(c.pull(2000)).toBe(true);
    expect(c.count).toBe(0);
  });

  it('les estirades massa espaiades no compten', () => {
    const c = createStretchCounter(3, 5000);
    c.pull(0);
    c.pull(4000);
    expect(c.pull(6000)).toBe(false);
    expect(c.count).toBe(2);
  });
});

describe('rubberBand', () => {
  it('cedeix cada cop menys i mai passa del límit', () => {
    expect(rubberBand(-20, 100)).toBe(0);
    expect(rubberBand(50, 100)).toBeLessThan(50);
    expect(rubberBand(10_000, 100)).toBeLessThanOrEqual(100);
    expect(rubberBand(100, 100)).toBeGreaterThan(rubberBand(50, 100));
  });
});
