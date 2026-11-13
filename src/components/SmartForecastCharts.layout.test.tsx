// Format dels gràfics horaris: 'responsive' (el de sempre) o 'tabs' (pestanyes també a PC, per a la pestanya Previsió).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SmartForecastCharts from './SmartForecastCharts';
import type { HourlyChartPoint } from '../utils/hourlyChartSeries';

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => {
    vi.unstubAllGlobals();
});

const data: HourlyChartPoint[] = Array.from({ length: 24 }, (_, i) => ({
    time: `2026-11-13T${String(i).padStart(2, '0')}:00`,
    temp: 15 + i / 4, rain: 10, precip: 0, wind: 10, gusts: 20, snowLevel: 2000, regional: true, isDay: i >= 7 && i <= 17,
}));

const renderCharts = (layout?: 'responsive' | 'tabs') =>
    render(<SmartForecastCharts data={data} comparisonData={null} unit="°C" lang="ca" regionalModelLabel="AROME HD" layout={layout} />);

// La fila de pestanyes (Temperatura, Pluja, Vent, Cota de neu) és la que té el botó PLUJA.
const tabRow = () => screen.getByRole('button', { name: 'PLUJA' }).parentElement as HTMLElement;

describe('SmartForecastCharts → format', () => {
    it('per defecte, el de sempre: pestanyes només al mòbil i les quatre mètriques a la vista a partir de 768 px', () => {
        const { container } = renderCharts();
        expect(tabRow().className).toContain('md:hidden');
        expect(container.querySelector('.hidden.md\\:flex')).not.toBeNull();
    });

    it('amb `tabs`, pestanyes a totes les amplades i cap bloc de les quatre mètriques', () => {
        const { container } = renderCharts('tabs');
        expect(tabRow().className).not.toContain('md:hidden');
        expect(container.querySelector('.hidden.md\\:flex')).toBeNull();
        // Les pestanyes funcionen igual: la de pluja mostra els seus dos gràfics (volum i probabilitat).
        fireEvent.click(screen.getByRole('button', { name: 'PLUJA' }));
        expect(screen.getByRole('button', { name: 'PLUJA' }).getAttribute('aria-pressed')).toBe('true');
    });
});
