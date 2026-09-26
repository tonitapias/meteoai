// src/components/widgets/CapeWidget.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CapeWidget } from './CapeWidget';
import type { Language } from '../../translations';

const renderCape = (cape: number | null, lang: Language) =>
    render(<CapeWidget capeData={[cape]} currentHourIndex={0} lang={lang} />);

describe('CapeWidget — etiqueta d\'inestabilitat', () => {
    it('entre 100 i 1.200 J/kg l\'aire és feblement inestable, no "Estable"', () => {
        renderCape(850, 'ca');
        expect(screen.getByText('Feble')).toBeTruthy();
        expect(screen.queryByText('Estable')).toBeNull();
    });

    it('per sota de 100 J/kg és estable', () => {
        renderCape(40, 'ca');
        expect(screen.getByText('Estable')).toBeTruthy();
    });

    // Abans llegia claus inexistents (t.stable, t.moderate...) i sempre sortia el text català de reserva.
    it('l\'etiqueta surt en l\'idioma de l\'usuari', () => {
        const { unmount } = renderCape(850, 'en');
        expect(screen.getByText('Weak')).toBeTruthy();
        unmount();
        const es = renderCape(1300, 'es');
        expect(screen.getByText('Moderada')).toBeTruthy();
        es.unmount();
        renderCape(2500, 'fr');
        expect(screen.getByText('Sévère')).toBeTruthy();
    });

    it('els llindars de tempesta no canvien: 1.200 moderada, 1.500 alta, 2.000 severa', () => {
        const cases: Array<[number, string]> = [[1200, 'Moderada'], [1500, 'Alta'], [2000, 'Severa']];
        cases.forEach(([cape, label]) => {
            const { unmount } = renderCape(cape, 'ca');
            expect(screen.getByText(label)).toBeTruthy();
            unmount();
        });
    });
});

// Títol, "sense dades" i "desconegut" llegien claus inexistents (instability_actual, no_data, unknown): sempre en català.
describe("CapeWidget — títol i estat sense dades en l'idioma de l'usuari", () => {
    it('el títol surt traduït', () => {
        const cases: Array<[Language, string]> = [['ca', 'CAPE ACTUAL'], ['es', 'CAPE ACTUAL'], ['en', 'CURRENT CAPE'], ['fr', 'CAPE ACTUEL']];
        cases.forEach(([lang, title]) => {
            const { unmount } = renderCape(500, lang);
            expect(screen.getByText(title)).toBeTruthy();
            unmount();
        });
    });

    it('sense dada de CAPE: "NO DATA" i "Unknown" en anglès, no el text català', () => {
        renderCape(null, 'en');
        expect(screen.getByText('NO DATA')).toBeTruthy();
        expect(screen.getByText('Unknown')).toBeTruthy();
        expect(screen.queryByText('SENSE DADES')).toBeNull();
        expect(screen.queryByText('DESCONEGUT')).toBeNull();
    });
});
