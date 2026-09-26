// src/utils/probableRange.test.ts
import { describe, it, expect } from 'vitest';
import { resolveProbableRange, type TempKind } from './probableRange';

const KINDS: TempKind[] = ['max', 'min'];
const width = (r: { low: number; high: number } | null) => (r ? r.high - r.low : NaN);

describe('resolveProbableRange', () => {
    it('sense xifra mostrada no hi ha rang', () => {
        expect(resolveProbableRange('max', null, 3, 2)).toBeNull();
        expect(resolveProbableRange('min', NaN, 3, 2)).toBeNull();
    });

    it('el rang envolta sempre la xifra mostrada (el P10 és per sota i el P90 per sobre)', () => {
        KINDS.forEach(kind => {
            for (let day = 1; day <= 7; day++) {
                [null, 0.5, 4, 12].forEach(spread => {
                    const r = resolveProbableRange(kind, 20, day, spread);
                    expect(r!.low).toBeLessThan(20);
                    expect(r!.high).toBeGreaterThan(20);
                });
            }
        });
    });

    it('com més lluny és el dia, més ample és el rang', () => {
        KINDS.forEach(kind => {
            expect(width(resolveProbableRange(kind, 20, 7, null))).toBeGreaterThan(width(resolveProbableRange(kind, 20, 1, null)));
        });
    });

    it('per a la màxima, quan els models discrepen molt el rang és més ample que quan coincideixen', () => {
        for (let day = 1; day <= 7; day++) {
            expect(width(resolveProbableRange('max', 20, day, 12))).toBeGreaterThan(width(resolveProbableRange('max', 20, day, 0.5)));
        }
    });

    it('avui fa servir el dia 1 i més enllà del dia 7 es queda en el 7', () => {
        KINDS.forEach(kind => {
            expect(resolveProbableRange(kind, 15, 0, 1)).toEqual(resolveProbableRange(kind, 15, 1, 1));
            expect(resolveProbableRange(kind, 15, 9, 1)).toEqual(resolveProbableRange(kind, 15, 7, 1));
        });
    });

    it('el rang es desplaça amb la xifra mostrada: no depèn del valor absolut', () => {
        const a = resolveProbableRange('min', 5, 3, 2)!;
        const b = resolveProbableRange('min', 25, 3, 2)!;
        expect(b.low - a.low).toBeCloseTo(20, 5);
        expect(b.high - a.high).toBeCloseTo(20, 5);
    });
});
