// src/components/widgets/CircularGauge.test.tsx
// Targeta de Pressió del Detall: el xip de tendència diu de què és la variació i en quant de temps ("+2,6 hPa · 3 h"),
// amb el decimal de l'idioma i el nom dels butlletins (el mateix que el modal).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Gauge } from 'lucide-react';
import { CircularGauge } from './CircularGauge';

const renderGauge = (trendValue: number | null | undefined, lang = 'ca') =>
    render(<CircularGauge icon={<Gauge />} label="Pressió" value={1007.6} subText="hPa" trendValue={trendValue} lang={lang} />);

afterEach(cleanup);

describe('CircularGauge — xip de tendència', () => {
    it('la variació porta la unitat i la finestra de 3 h, amb el decimal de l\'idioma', () => {
        renderGauge(2.6);
        expect(screen.getByText('+2,6 hPa · 3 h')).toBeTruthy();
        expect(screen.getByText('Pujant')).toBeTruthy();
        cleanup();
        renderGauge(-4.2, 'en');
        expect(screen.getByText('-4.2 hPa · 3 h')).toBeTruthy();
        expect(screen.getByText('Falling quickly')).toBeTruthy();
    });

    it('una variació de 0 és una dada (estable), no un forat', () => {
        renderGauge(0);
        expect(screen.getByText('0,0 hPa · 3 h')).toBeTruthy();
        expect(screen.getByText('Estable')).toBeTruthy();
    });

    it('sense variació (falten hores), cap xip: ni "Estable" ni cap xifra inventada', () => {
        const { container } = renderGauge(null);
        expect(container.textContent).not.toContain('Estable');
        expect(container.textContent).not.toContain('· 3 h');
    });
});
