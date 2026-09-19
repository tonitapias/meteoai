import { describe, it, expect } from 'vitest';
import { resolveDisplayVisibility, resolveCurrentDisplayVisibility, formatVisibilityKm } from './visibilityDisplay';

describe('resolveDisplayVisibility', () => {
    it('sense boira confirmada, una visibilitat de model < 2 km no es mostra com a boira: "≥ 2 km"', () => {
        // Cas real (Vic, 18→19/09/2026): ICON deia 840 m però la saturació no confirmava boira.
        expect(resolveDisplayVisibility(840, 3, 0)).toEqual({ meters: 2000, bound: 'min' });
        expect(resolveDisplayVisibility(1500, 0, 0)).toEqual({ meters: 2000, bound: 'min' });
        expect(resolveDisplayVisibility(1999, 1, 0)).toEqual({ meters: 2000, bound: 'min' });
    });

    it('amb boira confirmada (45/48) el valor del model es respecta si ja és < 2 km', () => {
        expect(resolveDisplayVisibility(840, 45, 0)).toEqual({ meters: 840, bound: null });
        expect(resolveDisplayVisibility(1500, 48, 0)).toEqual({ meters: 1500, bound: null });
    });

    it('amb boira confirmada però model >= 2 km, es limita a "≤ 1 km" (la icona diu boira)', () => {
        expect(resolveDisplayVisibility(3200, 45, 0)).toEqual({ meters: 1000, bound: 'max' });
        expect(resolveDisplayVisibility(2000, 45, 0)).toEqual({ meters: 1000, bound: 'max' });
    });

    it('amb visibilitat >= 2 km i sense boira, no es toca', () => {
        expect(resolveDisplayVisibility(2000, 3, 0)).toEqual({ meters: 2000, bound: null });
        expect(resolveDisplayVisibility(8000, 0, 0)).toEqual({ meters: 8000, bound: null });
        expect(resolveDisplayVisibility(30000, 1, 0)).toEqual({ meters: 30000, bound: null });
    });

    it('amb pluja o neu, la visibilitat baixa és física i no es toca', () => {
        expect(resolveDisplayVisibility(600, 63, 2.4)).toEqual({ meters: 600, bound: null });
        expect(resolveDisplayVisibility(300, 73, 0.1)).toEqual({ meters: 300, bound: null });
    });

    it('sense dada de visibilitat: sense dades (mai s\'inventa un número)', () => {
        expect(resolveDisplayVisibility(null, 45, 0)).toEqual({ meters: null, bound: null });
        expect(resolveDisplayVisibility(undefined, 3, 0)).toEqual({ meters: null, bound: null });
        expect(resolveDisplayVisibility(NaN, 3, 0)).toEqual({ meters: null, bound: null });
    });
});

describe('resolveCurrentDisplayVisibility', () => {
    it('llegeix visibilitat i precipitació del bloc current i el codi efectiu de la capçalera', () => {
        expect(resolveCurrentDisplayVisibility({ visibility: 840, precipitation: 0 }, 3)).toEqual({ meters: 2000, bound: 'min' });
        expect(resolveCurrentDisplayVisibility({ visibility: 840, precipitation: 0 }, 45)).toEqual({ meters: 840, bound: null });
        expect(resolveCurrentDisplayVisibility({ visibility: 840, precipitation: 3 }, 63)).toEqual({ meters: 840, bound: null });
    });

    it('sense codi efectiu, no hi ha confirmació de boira', () => {
        expect(resolveCurrentDisplayVisibility({ visibility: 500 }, null)).toEqual({ meters: 2000, bound: 'min' });
    });

    it('sense visibilitat al current → sense dades', () => {
        expect(resolveCurrentDisplayVisibility({}, 3)).toEqual({ meters: null, bound: null });
        expect(resolveCurrentDisplayVisibility(undefined, 3)).toEqual({ meters: null, bound: null });
    });
});

describe('formatVisibilityKm', () => {
    it('formata km amb límit', () => {
        expect(formatVisibilityKm(2000, 'min')).toBe('≥2');
        expect(formatVisibilityKm(1000, 'max')).toBe('≤1');
        expect(formatVisibilityKm(840)).toBe('0.8');
        expect(formatVisibilityKm(10000)).toBe('10');
        expect(formatVisibilityKm(null, 'min')).toBe('--');
    });
});
