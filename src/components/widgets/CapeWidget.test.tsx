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
