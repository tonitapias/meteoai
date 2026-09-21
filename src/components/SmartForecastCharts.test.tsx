import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SmartForecastCharts from './SmartForecastCharts';
import type { ChartModelKey, HourlyChartPoint } from '../utils/hourlyChartSeries';

// jsdom no porta ResizeObserver; el gràfic només l'usa per mesurar l'amplada (per defecte 1000 px).
beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => {
    vi.unstubAllGlobals();
});

const HOURS = 24;
const pt = (i: number, over: Partial<HourlyChartPoint> = {}): HourlyChartPoint => ({
    time: `2026-09-21T${String((14 + i) % 24).padStart(2, '0')}:00`,
    temp: 20 + i / 4,
    rain: 10,
    precip: 0,
    wind: 10,
    gusts: 20,
    snowLevel: 3000,
    regional: false,
    ...over
});
// Les 12 primeres hores de la línia principal vénen del model regional; la resta, del global.
const primary: HourlyChartPoint[] = Array.from({ length: HOURS }, (_, i) => pt(i, { regional: i < 12, precip: i === 8 ? 1.2 : 0 }));
const model = (delta: number, over: Partial<HourlyChartPoint> = {}): HourlyChartPoint[] =>
    Array.from({ length: HOURS }, (_, i) => pt(i, { temp: 20 + i / 4 + delta, precip: i === 9 ? 2.4 : 0, ...over }));
const comparison = (over: Partial<Record<ChartModelKey, HourlyChartPoint[]>> = {}) => ({
    ecmwf: model(-1),
    gfs: model(2),
    icon: model(-2),
    aifs: model(0.5, { rain: null, snowLevel: null, gusts: null }),
    ...over
});

const renderCharts = (props: Partial<React.ComponentProps<typeof SmartForecastCharts>> = {}) =>
    render(<SmartForecastCharts data={primary} comparisonData={comparison()} unit="°C" lang="ca" regionalModelLabel="AROME HD" {...props} />);

const hoverHour = (container: HTMLElement, index: number) => {
    const rects = container.querySelectorAll('rect.cursor-crosshair');
    fireEvent.mouseEnter(rects[index]);
};

describe('SmartForecastCharts', () => {
    it('sense dades no dibuixa res', () => {
        const { container } = renderCharts({ data: [] });
        expect(container).toBeEmptyDOMElement();
    });

    it('mostra les xifres clau de cada mètrica calculades de la sèrie que dibuixa', () => {
        renderCharts();
        // Temperatura: màxima 25,75° a l'última hora (13H) i mínima 20° a la primera (14H).
        expect(screen.getAllByText('Màxima').length).toBeGreaterThan(0);
        expect(screen.getAllByText('26°').length).toBeGreaterThan(0);
        expect(screen.getAllByText('20°').length).toBeGreaterThan(0);
        // Pluja: 1,2 mm de la principal (a les 22H) i rang dels models.
        expect(screen.getAllByText('1,2 mm').length).toBeGreaterThan(0);
        expect(screen.getAllByText('22H').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Models amb pluja').length).toBeGreaterThan(0);
        // Vent: ràfega màxima de 20 km/h.
        expect(screen.getAllByText('Ràfega màx.').length).toBeGreaterThan(0);
    });

    it('cada gràfic porta el seu xip d\'acord entre models (temperatura amb 4° de dispersió = baix)', () => {
        renderCharts();
        expect(screen.getAllByText('Acord baix').length).toBeGreaterThan(0);
    });

    it('sense models de comparació: xip "Sense comparació", cap banda i cap línia de model', () => {
        const { container } = renderCharts({ comparisonData: null });
        expect(screen.getAllByText('Sense comparació').length).toBeGreaterThan(0);
        expect(container.querySelector('[data-testid="model-band"]')).toBeNull();
    });

    it('dibuixa la banda entre el model més alt i el més baix', () => {
        const { container } = renderCharts();
        expect(container.querySelectorAll('[data-testid="model-band"]').length).toBeGreaterThan(0);
    });

    it('volum i probabilitat de pluja van en un sol panell: una pestanya "PLUJA" i cap "VOLUM"/"PROB." solta', () => {
        const { container } = renderCharts();
        const tabs = within(container.querySelector('.md\\:hidden') as HTMLElement).getAllByRole('button').map(b => b.textContent);
        expect(tabs).toEqual(['Temperatura', 'PLUJA', 'Vent', 'Cota de neu']);
        fireEvent.click(screen.getByRole('button', { name: 'PLUJA' }));
        // Dins del panell de pluja hi ha els dos gràfics apilats (a mòbil i a escriptori).
        expect(screen.getAllByText('VOLUM (MM)').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('Prob. Pluja').length).toBeGreaterThanOrEqual(2);
    });

    it('el cartell mostra els 4 models, AIFS inclòs', () => {
        const { container } = renderCharts();
        hoverHour(container, 3);
        for (const label of ['ECMWF:', 'GFS:', 'ICON:', 'AIFS:']) {
            expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        }
    });

    it('el cartell diu el model REAL de la línia principal segons l\'hora (regional o global)', () => {
        const { container } = renderCharts();
        hoverHour(container, 3); // dins les 12 primeres hores: regional
        expect(screen.getAllByText('AROME HD').length).toBeGreaterThan(0);
        expect(screen.queryAllByText('MODEL GLOBAL')).toHaveLength(0);
        hoverHour(container, 18); // després: model global
        expect(screen.getAllByText('MODEL GLOBAL').length).toBeGreaterThan(0);
    });

    it('un model idèntic a la línia principal no es dibuixa ni surt al cartell, s\'avisa i segueix a la banda', () => {
        const identical = model(0).map((p, i) => ({ ...p, temp: primary[i].temp }));
        const { container } = renderCharts({ comparisonData: comparison({ icon: identical }) });
        hoverHour(container, 3);
        expect(screen.queryAllByText('ICON:')).toHaveLength(0);
        expect(screen.getAllByText('ECMWF:').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/ICON = model principal/).length).toBeGreaterThan(0);
        expect(container.querySelectorAll('[data-testid="model-band"]').length).toBeGreaterThan(0);
    });

    it('avisa que AIFS no publica probabilitat de pluja (només quan AIFS hi és i no en té)', () => {
        renderCharts();
        expect(screen.getAllByText(/AIFS no publica probabilitat de pluja/).length).toBeGreaterThan(0);
    });

    it('sense AIFS no hi ha cap avís d\'AIFS', () => {
        renderCharts({ comparisonData: comparison({ aifs: [] }) });
        expect(screen.queryAllByText(/AIFS no publica/)).toHaveLength(0);
    });

    it('sense model regional, la línia principal és "MODEL GLOBAL" a totes les hores', () => {
        const { container } = renderCharts({ regionalModelLabel: null });
        hoverHour(container, 3);
        expect(screen.getAllByText('MODEL GLOBAL').length).toBeGreaterThan(0);
        expect(screen.queryAllByText('AROME HD')).toHaveLength(0);
    });

    it('els textos surten en l\'idioma de l\'usuari', () => {
        renderCharts({ lang: 'en' });
        expect(screen.getAllByText('High').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Max gust').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Low agreement').length).toBeGreaterThan(0);
        expect(screen.getAllByText('RAIN').length).toBeGreaterThan(0);
    });
});
