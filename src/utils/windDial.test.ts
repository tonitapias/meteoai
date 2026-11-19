// src/utils/windDial.test.ts
// Brúixola del vent: l'arc de velocitat no passa mai per dalt (no es pot llegir com una direcció) i totes les fletxes
// apunten cap on va el vent.
import { describe, it, expect } from 'vitest';
import {
    NAVIGATION_ICON_BASE_DEG, SPEED_ARC_START_DEG, SPEED_ARC_SWEEP_DEG, WIND_DIAL_MAX_KMH, dialPoint, speedArcPath,
    speedFraction, windArrowRotation,
} from './windDial';

const parseArc = (d: string) => {
    const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    return { start: { x: n[0], y: n[1] }, r: n[2], largeArc: n[5], sweepFlag: n[6], end: { x: n[7], y: n[8] } };
};

describe('dialPoint', () => {
    it('0° dalt, 90° a la dreta, 180° a baix, 270° a l\'esquerra', () => {
        expect(dialPoint(100, 100, 50, 0)).toEqual({ x: 100, y: 50 });
        expect(dialPoint(100, 100, 50, 90)).toEqual({ x: 150, y: 100 });
        expect(dialPoint(100, 100, 50, 180)).toEqual({ x: 100, y: 150 });
        expect(dialPoint(100, 100, 50, 270)).toEqual({ x: 50, y: 100 });
    });
});

describe('speedFraction', () => {
    it('la velocitat sobre 120 km/h, retallada a 0-1', () => {
        expect(speedFraction(60)).toBe(0.5);
        expect(speedFraction(0)).toBe(0);
        expect(speedFraction(200)).toBe(1);
        expect(speedFraction(-3)).toBe(0);
        expect(WIND_DIAL_MAX_KMH).toBe(120);
    });

    it('DOCTRINA RISC ZERO: sense dada, null (mai un arc de 0 inventat)', () => {
        expect(speedFraction(null)).toBeNull();
        expect(speedFraction(undefined)).toBeNull();
        expect(speedFraction(Number.NaN)).toBeNull();
    });
});

describe("speedArcPath — l'arc del velocímetre, a baix", () => {
    it("comença sempre a baix a l'esquerra, sigui quina sigui la velocitat (no al Nord)", () => {
        for (const f of [0.05, 0.5, 1]) {
            const { start } = parseArc(speedArcPath(f, 100, 100, 60));
            expect(start).toEqual(dialPoint(100, 100, 60, SPEED_ARC_START_DEG));
            expect(start.x).toBeLessThan(100); // a l'esquerra
            expect(start.y).toBeGreaterThan(100); // a la meitat de baix
        }
    });

    it("s'omple d'esquerra a dreta passant pel Sud i ple acaba a baix a la dreta", () => {
        const half = parseArc(speedArcPath(0.5, 100, 100, 60));
        expect(half.end).toEqual(dialPoint(100, 100, 60, SPEED_ARC_START_DEG - SPEED_ARC_SWEEP_DEG / 2)); // 180°: el Sud
        expect(half.end).toEqual({ x: 100, y: 160 });
        const full = parseArc(speedArcPath(1, 100, 100, 60));
        expect(full.end.x).toBeGreaterThan(100);
        expect(full.end.y).toBeGreaterThan(100);
        expect(full.sweepFlag).toBe(0);
        expect(full.largeArc).toBe(0);
    });

    it('cap punt de l\'arc no és a la meitat de dalt', () => {
        for (let f = 0.1; f <= 1; f += 0.1) {
            expect(parseArc(speedArcPath(f, 100, 100, 60)).end.y).toBeGreaterThan(100);
        }
    });

    it('sense velocitat o amb 0, cap arc', () => {
        expect(speedArcPath(null, 100, 100, 60)).toBe('');
        expect(speedArcPath(0, 100, 100, 60)).toBe('');
    });
});

describe('windArrowRotation — "cap on va"', () => {
    it('una fletxa que apunta amunt gira de manera que apunti on va el vent', () => {
        expect(windArrowRotation(0)).toBe(180);     // del Nord, cap al Sud
        expect(windArrowRotation(225)).toBe(45);    // de SO, cap al NE
        expect(windArrowRotation(293)).toBe(113);   // d'ONO, cap a l'ESE
        expect(windArrowRotation(180)).toBe(0);
    });

    it('la icona Navigation (que ja apunta al NE) es compensa: abans anava 45° desviada', () => {
        expect(NAVIGATION_ICON_BASE_DEG).toBe(45);
        expect(windArrowRotation(293, NAVIGATION_ICON_BASE_DEG)).toBe(68);   // 68 + 45 = 113: ESE
        expect(windArrowRotation(0, NAVIGATION_ICON_BASE_DEG)).toBe(135);    // 135 + 45 = 180: Sud
        expect(windArrowRotation(200, NAVIGATION_ICON_BASE_DEG)).toBe(335);  // 335 + 45 = 20 (mòdul 360)
    });
});
