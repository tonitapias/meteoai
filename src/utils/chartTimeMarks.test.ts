// src/utils/chartTimeMarks.test.ts
import { describe, it, expect } from 'vitest';
import { dayChangeIndices, formatDayLabel, nightRuns } from './chartTimeMarks';

describe('nightRuns', () => {
    const day = (...flags: Array<boolean | null>) => flags.map(isDay => ({ isDay: isDay as boolean }));

    it("agrupa les hores de nit seguides en trams (índexs inclosos)", () => {
        expect(nightRuns(day(true, true, false, false, false, true, false, true))).toEqual([
            { start: 2, end: 4 },
            { start: 6, end: 6 }
        ]);
    });

    it("un tram que arriba fins al final de la sèrie es tanca a l'última hora", () => {
        expect(nightRuns(day(true, false, false))).toEqual([{ start: 1, end: 2 }]);
        expect(nightRuns(day(false, false))).toEqual([{ start: 0, end: 1 }]);
    });

    it("sense nit, o sense dades, no hi ha trams; una hora sense isDay no compta com a nit", () => {
        expect(nightRuns(day(true, true))).toEqual([]);
        expect(nightRuns([])).toEqual([]);
        expect(nightRuns(day(true, null, true))).toEqual([]);
    });
});

describe('dayChangeIndices', () => {
    const t = (...times: string[]) => times.map(time => ({ time }));

    it("retorna l'índex de la primera hora de cada dia nou", () => {
        expect(dayChangeIndices(t('2026-09-21T22:00', '2026-09-21T23:00', '2026-09-22T00:00', '2026-09-22T01:00'))).toEqual([2]);
        expect(dayChangeIndices(t('2026-09-21T23:00', '2026-09-22T00:00', '2026-09-22T23:00', '2026-09-23T00:00'))).toEqual([1, 3]);
    });

    it("dins un sol dia (el detall de dia) no hi ha cap canvi; la primera hora mai n'és un", () => {
        expect(dayChangeIndices(t('2026-09-21T00:00', '2026-09-21T01:00', '2026-09-21T02:00'))).toEqual([]);
        expect(dayChangeIndices(t('2026-09-21T00:00'))).toEqual([]);
        expect(dayChangeIndices([])).toEqual([]);
    });
});

describe('formatDayLabel', () => {
    it("dia de la setmana curt i dia del mes, en l'idioma de l'usuari, amb el dia sempre al final", () => {
        expect(formatDayLabel('2026-09-22T00:00', 'ca-ES')).toBe('dt. 22');
        expect(formatDayLabel('2026-09-22T00:00', 'es-ES')).toBe('mar 22');
        expect(formatDayLabel('2026-09-22T00:00', 'en-US')).toBe('Tue 22');
        expect(formatDayLabel('2026-09-22T00:00', 'fr-FR')).toBe('mar. 22');
    });

    it("no depèn del fus horari del navegador: mitjanit i les 23:00 són el mateix dia", () => {
        expect(formatDayLabel('2026-09-22T00:00', 'ca-ES')).toBe(formatDayLabel('2026-09-22T23:00', 'ca-ES'));
    });

    it('una data il·legible dóna text buit, no "NaN"', () => {
        expect(formatDayLabel('', 'ca-ES')).toBe('');
        expect(formatDayLabel('demà', 'ca-ES')).toBe('');
    });
});
