// src/components/welcome/SkyColumn.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import SkyColumn, { SkyColumnLabels } from './SkyColumn';
import { computeWelcomeSky, orbitPoint, ORBIT } from '../../utils/welcome/welcomeSky';

const LABELS: SkyColumnLabels = { high: 'Alts', mid: 'Mitjans', low: 'Baixos', east: 'E', west: 'O', north: 'N', south: 'S', alt: 'Esquema' };
const BARCELONA = { lat: 41.39, lon: 2.17, source: 'gps' as const };
// Dissabte 24-10-2026 a les 18:00 hora local: el sol encara és sobre l'horitzó, a l'oest.
const AFTERNOON = computeWelcomeSky(new Date('2026-10-24T16:00:00Z'), BARCELONA);

const translateOf = (angle: number) => {
  const [x, y] = orbitPoint(angle);
  return `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
};
const sunGroup = (container: HTMLElement) => container.querySelector('circle[r="15"]')?.parentElement;
const dayArc = (container: HTMLElement) => container.querySelector('path[stroke-opacity="0.55"]');

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} }),
  });
}

describe('SkyColumn: entrada', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('el cel de prova té el sol sobre l\'horitzó, a l\'oest', () => {
    expect(AFTERNOON.sunAngle).not.toBeNull();
    expect(AFTERNOON.sunAngle!).toBeGreaterThan(0);
  });

  it('amb "reduir el moviment", el sol ja és al seu lloc i l\'arc és un traç continu', () => {
    mockReducedMotion(true);
    const { container } = render(<SkyColumn sky={AFTERNOON} labels={LABELS} />);
    expect(sunGroup(container)?.getAttribute('transform')).toBe(translateOf(AFTERNOON.sunAngle!));
    expect(dayArc(container)?.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('el sol surt de l\'horitzó de l\'est i acaba a l\'hora d\'ara; després l\'arc queda continu', () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    const { container } = render(<SkyColumn sky={AFTERNOON} labels={LABELS} />);
    const horizon = -(Math.acos((ORBIT.cy - ORBIT.horizonY) / ORBIT.ry) * 180) / Math.PI;
    expect(sunGroup(container)?.getAttribute('transform')).toBe(translateOf(horizon));
    expect(dayArc(container)?.getAttribute('stroke-dasharray')).toBe('1 1');

    act(() => { vi.advanceTimersByTime(300); }); // arrenca l'entrada
    act(() => { vi.advanceTimersByTime(3000); });
    expect(sunGroup(container)?.getAttribute('transform')).toBe(translateOf(AFTERNOON.sunAngle!));
    expect(dayArc(container)?.getAttribute('stroke-dasharray')).toBeNull();
  });

  it('a l\'hemisferi sud surt per la dreta (el mateix angle, mirall)', () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    const south = { ...AFTERNOON, south: true };
    const { container } = render(<SkyColumn sky={south} labels={LABELS} />);
    const [x] = orbitPoint(-(Math.acos((ORBIT.cy - ORBIT.horizonY) / ORBIT.ry) * 180) / Math.PI);
    expect(sunGroup(container)?.getAttribute('transform')).toMatch(new RegExp(`^translate\\(${(640 - x).toFixed(1)} `));
    act(() => { vi.advanceTimersByTime(300); }); // arrenca l'entrada
    act(() => { vi.advanceTimersByTime(3000); });
    const [fx, fy] = orbitPoint(AFTERNOON.sunAngle!);
    expect(sunGroup(container)?.getAttribute('transform')).toBe(`translate(${(640 - fx).toFixed(1)} ${fy.toFixed(1)})`);
  });
});
