import { describe, it, expect } from 'vitest';
import { bestEyeFor, discPoint, initialEye, nearestEye, placeLabels, eyeInfo } from './orbitalView';
import { meteosatDiscPoint } from './welcome/skyElevator';
import type { PlanetExtremes, StationRecord } from '../services/planetExtremesApi';
import { summarizeCyclone } from './planetExtremes';

const station = (id: string, lat: number, lon: number): StationRecord => ({ id, name: id, country: null, lat, lon, elevM: 0, time: '2026-10-30T21:50:00Z', value: 1 });

// Els rècords reals del 30-10-2026 a les 22 UTC: San Miguel, Eureka, Cartagena, un cim de Colorado, Alaska.
const DATA: PlanetExtremes = {
    metar: {
        updatedAt: '2026-10-30T22:00:00Z', stations: 5144, discarded: 25,
        hottest: [station('MSSM', 13.4, -88.1)], coldest: [station('CYEU', 80, -85.9)], wetBulb: [station('SKCG', 10.4, -75.5)],
        gustKmh: [station('KXXX', 39.6, -105.9)], lowPressure: [station('PAOM', 64.5, -165.4)],
    },
    events: {
        updatedAt: '2026-10-30T22:00:00Z',
        fires: { count: 2, byCountry: [{ country: 'BW', count: 2, lat: -21, lon: 24 }], largest: { country: 'BW', hectares: 48700, lat: -21, lon: 24 } },
        floods: { count: 0, byCountry: [] },
        volcanoes: [],
    },
    cyclones: { updatedAt: '2026-10-30T22:00:00Z', cyclones: [] },
};

const IN_FA = summarizeCyclone({ id: 'E1', name: 'In-fa', source: 'JTWC', track: [{ time: '2026-10-30T18:00:00Z', lat: 20.5, lon: 143.4, windKt: 115 }] });

describe('On cau un punt al disc', () => {
    it('al Meteosat, el mateix que l\'agulla de l\'ascensor (mateixa imatge, mateixa projecció)', () => {
        const barcelona = discPoint(41.39, 2.17, 0);
        const elevator = meteosatDiscPoint(41.39, 2.17);
        expect(barcelona?.x).toBeCloseTo(elevator?.x ?? NaN, 10);
        expect(barcelona?.y).toBeCloseTo(elevator?.y ?? NaN, 10);
    });

    it('el punt de sota el satèl·lit és al centre, i l\'altra banda del planeta no hi surt', () => {
        expect(discPoint(0, -75.2, eyeInfo('goes').subLon)).toEqual({ x: 0, y: 0 });
        expect(discPoint(0, 140.7, 0)).toBeNull();
        // Arran del limbe (80° des del centre) tampoc: es veuria de cantó.
        expect(discPoint(0, 80, 0)).toBeNull();
    });

    it('nord a dalt i est a la dreta', () => {
        const tokyo = discPoint(35.7, 139.7, eyeInfo('himawari').subLon);
        expect(tokyo?.y).toBeGreaterThan(0.5);
        expect(tokyo?.x).toBeLessThan(0);
    });
});

describe("Quin ull s'obre", () => {
    it("cada lloc, a l'ull que el té més a prop del centre", () => {
        expect(nearestEye(41.4, 2.2)).toBe('meteosat');
        expect(nearestEye(13.4, -88.1)).toBe('goes');
        expect(nearestEye(20.5, 143.4)).toBe('himawari');
    });

    it("des dels rècords, l'ull on en cauen més (el 30-10, tots cinc al GOES)", () => {
        expect(initialEye('records', DATA, [])).toBe('goes');
    });

    it("des dels fenòmens, l'ull del cicló més intens; sense ciclons, el de l'incendi més extens", () => {
        expect(initialEye('events', DATA, [IN_FA])).toBe('himawari');
        expect(initialEye('events', DATA, [])).toBe('meteosat');
    });

    it('sense res a mirar, el Meteosat', () => {
        expect(bestEyeFor([])).toBe('meteosat');
        expect(initialEye('records', { metar: null, events: null, cyclones: null }, [])).toBe('meteosat');
    });
});

describe('Etiquetes', () => {
    it('la primera va a la dreta del seu marcador', () => {
        expect(placeLabels([{ x: 100, y: 100, w: 60, h: 20, r: 8 }], 400, 400)).toEqual([{ left: 112, top: 90 }]);
    });

    it('una segona que xocaria busca un altre lloc, i a la vora del quadre gira cap a dins', () => {
        const [first, second] = placeLabels([{ x: 100, y: 100, w: 60, h: 20, r: 8 }, { x: 100, y: 118, w: 60, h: 20, r: 8 }], 400, 400);
        expect(first).toEqual({ left: 112, top: 90 });
        expect(second).not.toBeNull();
        expect(second?.top === 108 && second.left === 112).toBe(false);
        const [edge] = placeLabels([{ x: 390, y: 200, w: 60, h: 20, r: 8 }], 400, 400);
        expect(edge?.left).toBeLessThan(390);
    });

    it("si no hi cap enlloc, el marcador queda sense etiqueta", () => {
        const crowd = Array.from({ length: 12 }, () => ({ x: 30, y: 30, w: 50, h: 20, r: 8 }));
        const placed = placeLabels(crowd, 60, 60);
        expect(placed.filter(Boolean).length).toBeLessThan(crowd.length);
    });
});
