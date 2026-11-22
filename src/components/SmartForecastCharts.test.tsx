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
// De les 14:00 del 21-09 a les 13:00 del 22-09: la sèrie travessa la mitjanit a l'índex 10.
const pt = (i: number, over: Partial<HourlyChartPoint> = {}): HourlyChartPoint => ({
    time: `2026-09-${i < 10 ? '21' : '22'}T${String((14 + i) % 24).padStart(2, '0')}:00`,
    temp: 20 + i / 4,
    rain: 10,
    precip: 0,
    wind: 10,
    gusts: 20,
    snowLevel: 3000,
    regional: false,
    isDay: !(i >= 6 && i <= 17), // de nit de les 20:00 a les 07:00
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
    render(<SmartForecastCharts data={primary} comparisonData={comparison()} lang="ca" regionalModelLabel="AROME HD" {...props} />);

const hoverHour = (container: HTMLElement, index: number) => {
    const rects = container.querySelectorAll('rect.cursor-crosshair');
    fireEvent.mouseEnter(rects[index]);
};
const tab = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const openModels = () => fireEvent.click(screen.getByTestId('models-toggle'));
const readout = () => screen.getByTestId('readout');

describe('SmartForecastCharts', () => {
    it('sense dades no dibuixa res', () => {
        const { container } = renderCharts({ data: [] });
        expect(container).toBeEmptyDOMElement();
    });

    it('una mètrica cada vegada, amb quatre pestanyes curtes', () => {
        renderCharts();
        const labels = screen.getAllByRole('button').filter(b => b.hasAttribute('aria-pressed') && !b.dataset.testid).map(b => b.textContent);
        expect(labels).toEqual(['Temp', 'Pluja', 'Vent', 'Neu']);
        expect(screen.getByRole('button', { name: 'Temperatura' })).toHaveAttribute('aria-pressed', 'true');
        tab('Pluja');
        expect(screen.getByRole('button', { name: 'Pluja' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Temperatura' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('la temperatura marca la màxima i la mínima sobre la corba, de la sèrie que dibuixa', () => {
        renderCharts();
        // Màxima 25,75° a l'última hora (13H) i mínima 20° a la primera (14H).
        expect(within(screen.getByTestId('pill-high')).getByText('Màxima')).toBeInTheDocument();
        expect(screen.getByTestId('pill-high')).toHaveTextContent('26°');
        expect(screen.getByTestId('pill-high')).toHaveTextContent('13H');
        expect(screen.getByTestId('pill-low')).toHaveTextContent('20°');
        expect(screen.getByTestId('pill-low')).toHaveTextContent('14H');
    });

    it('el desacord màxim de la temperatura va a la frase de l\'acord i, amb tots els models, al claudàtor', () => {
        const { container } = renderCharts();
        expect(screen.getByText(/fins a 4,0° de diferència a les/)).toBeInTheDocument();
        expect(container.querySelector('[data-testid="spread-bracket"]')).not.toBeNull();
    });

    it('la pluja, el vent i la cota porten les seves xifres en una línia sota el gràfic', () => {
        renderCharts();
        tab('Pluja');
        expect(screen.getByText('Total 24 h')).toBeInTheDocument();
        expect(screen.getAllByText('1,2 mm').length).toBeGreaterThan(0);
        expect(screen.getAllByText('22H').length).toBeGreaterThan(0);
        // La línia principal i els 4 models globals: tots cinc preveuen pluja.
        expect(screen.getByText(/5 de 5 models en donen/)).toBeInTheDocument();
        tab('Vent');
        expect(screen.getByText('Ratxa màx.')).toBeInTheDocument();
        expect(screen.getAllByText('20 km/h').length).toBeGreaterThan(0);
        tab('Cota de neu');
        expect(screen.getByText('Cota mínima')).toBeInTheDocument();
        expect(screen.getByText('Cota màxima')).toBeInTheDocument();
    });

    it('cada pestanya porta l\'acord entre models (temperatura amb 4° de dispersió = baix)', () => {
        renderCharts();
        expect(screen.getByText('Acord baix')).toBeInTheDocument();
    });

    it('sense models de comparació: "Sense comparació", cap banda, cap botó de models', () => {
        const { container } = renderCharts({ comparisonData: null });
        expect(screen.getByText('Sense comparació')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="model-band"]')).toBeNull();
        expect(screen.queryByTestId('models-toggle')).toBeNull();
        expect(screen.queryByTestId('legend-ecmwf')).toBeNull();
    });

    it('dibuixa la banda entre el model més alt i el més baix', () => {
        const { container } = renderCharts();
        expect(container.querySelectorAll('[data-testid="model-band"]').length).toBeGreaterThan(0);
    });

    it('la pluja apila volum i probabilitat en una sola pestanya', () => {
        renderCharts();
        tab('Pluja');
        expect(screen.getByText('VOLUM (MM)')).toBeInTheDocument();
        expect(screen.getByText('Prob. Pluja')).toBeInTheDocument();
    });

    it('la lectura mostra els 4 models, AIFS inclòs', () => {
        const { container } = renderCharts();
        hoverHour(container, 3);
        for (const key of ['ecmwf', 'gfs', 'icon', 'aifs']) {
            expect(within(readout()).getByTestId(`readout-${key}`)).toBeInTheDocument();
        }
    });

    it('la lectura diu el model REAL de la línia principal segons l\'hora (regional o global)', () => {
        const { container } = renderCharts();
        hoverHour(container, 3); // dins les 12 primeres hores: regional
        expect(within(readout()).getByTestId('readout-primary')).toHaveTextContent('AROME HD');
        hoverHour(container, 18); // després: model global
        expect(within(readout()).getByTestId('readout-primary')).toHaveTextContent('MODEL GLOBAL');
    });

    it('un model idèntic a la línia principal no es dibuixa ni surt a la lectura, s\'avisa i segueix a la banda', () => {
        const identical = model(0).map((p, i) => ({ ...p, temp: primary[i].temp }));
        const { container } = renderCharts({ comparisonData: comparison({ icon: identical }) });
        hoverHour(container, 3);
        expect(within(readout()).queryByTestId('readout-icon')).toBeNull();
        expect(within(readout()).getByTestId('readout-ecmwf')).toBeInTheDocument();
        expect(screen.getByText(/ICON = model principal/)).toBeInTheDocument();
        expect(container.querySelectorAll('[data-testid="model-band"]').length).toBeGreaterThan(0);
    });

    it('avisa que AIFS no publica probabilitat de pluja (només quan AIFS hi és i no en té)', () => {
        renderCharts();
        tab('Pluja');
        expect(screen.getByText(/AIFS no publica probabilitat de pluja/)).toBeInTheDocument();
    });

    it('sense AIFS no hi ha cap avís d\'AIFS', () => {
        renderCharts({ comparisonData: comparison({ aifs: [] }) });
        tab('Pluja');
        expect(screen.queryByText(/AIFS no publica/)).toBeNull();
    });

    it('sense model regional, la línia principal és "MODEL GLOBAL" a totes les hores', () => {
        const { container } = renderCharts({ regionalModelLabel: null });
        hoverHour(container, 3);
        expect(within(readout()).getByTestId('readout-primary')).toHaveTextContent('MODEL GLOBAL');
        expect(screen.queryAllByText('AROME HD')).toHaveLength(0);
    });

    it('els textos surten en l\'idioma de l\'usuari', () => {
        renderCharts({ lang: 'en' });
        expect(within(screen.getByTestId('pill-high')).getByText('High')).toBeInTheDocument();
        expect(screen.getByText('Low agreement')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rain' })).toBeInTheDocument();
        tab('Wind');
        expect(screen.getByText('Max gust')).toBeInTheDocument();
    });
});

describe('SmartForecastCharts: capçalera i llegenda', () => {
    it('la capçalera diu les hores i de quin model i quina hora és la previsió', () => {
        renderCharts({ updatedAt: '2026-09-21T14:05' });
        expect(screen.getByText('Pròximes 24 h')).toBeInTheDocument();
        expect(screen.getByTestId('chart-source')).toHaveTextContent('AROME HD · de les 14:05');
    });

    it('sense hora de la previsió (o il·legible) només hi ha el model', () => {
        const { unmount } = renderCharts({ updatedAt: null });
        expect(screen.getByTestId('chart-source').textContent).toBe('AROME HD');
        unmount();
        renderCharts({ updatedAt: 'ahir', regionalModelLabel: null });
        expect(screen.getByTestId('chart-source').textContent).toBe('MODEL GLOBAL');
    });

    it('dins d\'una altra targeta (framed=false) no hi ha marc ni capçalera', () => {
        renderCharts({ framed: false, updatedAt: '2026-09-21T14:05' });
        expect(screen.queryByText('Pròximes 24 h')).toBeNull();
        expect(screen.queryByTestId('chart-source')).toBeNull();
        expect(screen.getByRole('button', { name: 'Temperatura' })).toBeInTheDocument();
    });

    it('la llegenda diu quina línia és quina, i els models estan plegats sota «Models»', () => {
        renderCharts();
        expect(screen.getByText('4 models globals')).toBeInTheDocument();
        expect(screen.getByText('marge entre models')).toBeInTheDocument();
        expect(screen.getByTestId('models-toggle')).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByTestId('legend-ecmwf')).toBeNull();
        openModels();
        expect(screen.getByTestId('models-toggle')).toHaveAttribute('aria-expanded', 'true');
        for (const key of ['ecmwf', 'gfs', 'icon', 'aifs']) {
            expect(screen.getByTestId(`legend-${key}`)).toHaveAttribute('aria-pressed', 'true');
        }
        expect(screen.getByTestId('legend-band')).toHaveAttribute('aria-pressed', 'true');
    });

    it('amagar un model l\'esborra de TOTS els gràfics i de la lectura; tornar-lo a activar el recupera', () => {
        const { container } = renderCharts();
        openModels();
        fireEvent.click(screen.getByTestId('legend-gfs'));
        expect(screen.getByTestId('legend-gfs')).toHaveAttribute('aria-pressed', 'false');
        hoverHour(container, 3);
        expect(within(readout()).queryByTestId('readout-gfs')).toBeNull();
        expect(within(readout()).getByTestId('readout-ecmwf')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('legend-gfs'));
        hoverHour(container, 3);
        expect(within(readout()).getByTestId('readout-gfs')).toBeInTheDocument();
    });

    it('amagar un model NO canvia l\'acord entre models (és un fet de la previsió), però treu el claudàtor del marge', () => {
        const { container } = renderCharts();
        openModels();
        fireEvent.click(screen.getByTestId('legend-gfs'));
        fireEvent.click(screen.getByTestId('legend-icon'));
        expect(screen.getByText('Acord baix')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="spread-bracket"]')).toBeNull();
    });

    it('el botó del marge l\'amaga i el torna a mostrar', () => {
        const { container } = renderCharts();
        openModels();
        fireEvent.click(screen.getByTestId('legend-band'));
        expect(screen.getByTestId('legend-band')).toHaveAttribute('aria-pressed', 'false');
        expect(container.querySelectorAll('[data-testid="model-band"]')).toHaveLength(0);
        fireEvent.click(screen.getByTestId('legend-band'));
        expect(container.querySelectorAll('[data-testid="model-band"]').length).toBeGreaterThan(0);
    });

    it('el marge només inclou els models visibles: amagar-ne un el canvia', () => {
        const { container } = renderCharts();
        const bandOf = () => container.querySelector('[data-testid="model-band"]')?.getAttribute('d');
        const full = bandOf();
        openModels();
        fireEvent.click(screen.getByTestId('legend-gfs')); // el més alt
        expect(bandOf()).not.toBe(full);
    });

    it('un model idèntic a la principal surt com a etiqueta fixa ("ICON = principal"), no com a botó', () => {
        const identical = model(0).map((p, i) => ({ ...p, temp: primary[i].temp }));
        renderCharts({ comparisonData: comparison({ icon: identical }) });
        openModels();
        const chip = screen.getByTestId('legend-icon');
        expect(chip.tagName).toBe('SPAN');
        expect(chip).toHaveTextContent('ICON = principal');
    });
});

describe('SmartForecastCharts: lectura del gràfic', () => {
    it('cada gràfic té escala a l\'eix Y', () => {
        const { container } = renderCharts();
        expect(container.querySelectorAll('[data-testid="y-tick"]').length).toBeGreaterThan(2);
        // La temperatura porta el símbol de grau a les xifres de l'eix.
        const tempTicks = [...container.querySelectorAll('[data-testid="y-tick"] text')].map(t => t.textContent);
        expect(tempTicks.some(t => /^\d+°$/.test(t ?? ''))).toBe(true);
    });

    it('ombreja les hores de nit', () => {
        const { container } = renderCharts();
        expect(container.querySelectorAll('[data-testid="night-shade"]').length).toBeGreaterThan(0);
    });

    it('marca el canvi de dia amb el nom del dia, només si la sèrie travessa la mitjanit', () => {
        const { container } = renderCharts();
        expect(container.querySelectorAll('[data-testid="midnight-marker"]').length).toBeGreaterThan(0);
        expect(screen.getAllByText('dt. 22').length).toBeGreaterThan(0);
        const sameDay = primary.map((p, i) => ({ ...p, time: `2026-09-22T${String(i).padStart(2, '0')}:00` }));
        const other = render(<SmartForecastCharts data={sameDay} comparisonData={null} lang="ca" />);
        expect(other.container.querySelectorAll('[data-testid="midnight-marker"]')).toHaveLength(0);
    });

    it('marca "ara" (línia, punt i ARA a l\'eix) només si se sap on és', () => {
        const { container } = renderCharts({ nowIndex: 0 });
        expect(container.querySelectorAll('[data-testid="now-marker"]').length).toBeGreaterThan(0);
        expect(screen.getAllByText('ARA').length).toBeGreaterThan(0);
        const without = render(<SmartForecastCharts data={primary} comparisonData={null} lang="ca" />);
        expect(without.container.querySelectorAll('[data-testid="now-marker"]')).toHaveLength(0);
        expect(within(without.container).queryAllByText('ARA')).toHaveLength(0);
    });

    it('un "ara" fora de la sèrie no dibuixa res (ni peta)', () => {
        const { container } = renderCharts({ nowIndex: 99 });
        expect(container.querySelectorAll('[data-testid="now-marker"]')).toHaveLength(0);
    });

    it('el volum de pluja es dibuixa amb barres (una per hora amb pluja) i un punt per model', () => {
        const { container } = renderCharts();
        tab('Pluja');
        // La principal plou una sola hora (index 8); els 4 models, una (index 9).
        const bars = container.querySelectorAll('[data-testid="precip-bar"]');
        const dots = container.querySelectorAll('[data-testid="precip-dot"]');
        expect(bars.length).toBe(1);
        expect(dots.length).toBe(bars.length * 4);
    });

    it('un model amagat no deixa punts al volum', () => {
        const { container } = renderCharts();
        tab('Pluja');
        const withAll = container.querySelectorAll('[data-testid="precip-dot"]').length;
        openModels();
        fireEvent.click(screen.getByTestId('legend-ecmwf'));
        expect(container.querySelectorAll('[data-testid="precip-dot"]').length).toBeLessThan(withAll);
    });

    it('el vent porta la línia de ratxes i la lectura en diu el valor', () => {
        const { container } = renderCharts();
        tab('Vent');
        expect(container.querySelectorAll('[data-testid="gust-line"]').length).toBeGreaterThan(0);
        hoverHour(container, 3);
        expect(within(readout()).getByTestId('readout-gust')).toHaveTextContent('Ratxa 20 km/h');
        expect(within(readout()).getByTestId('readout-primary')).toHaveTextContent('10 km/h');
        expect(screen.getByText(/Línia contínua: vent sostingut\. Discontínua: ratxes\./)).toBeInTheDocument();
    });

    it('sense ratxes a les dades, no hi ha línia de ratxes ni ratxa a la lectura (ni un 0 km/h)', () => {
        const noGusts = primary.map(p => ({ ...p, gusts: null }));
        const { container } = renderCharts({ data: noGusts });
        tab('Vent');
        expect(container.querySelectorAll('[data-testid="gust-line"]')).toHaveLength(0);
        hoverHour(container, 3);
        expect(within(readout()).queryByTestId('readout-gust')).toBeNull();
    });
});

describe('SmartForecastCharts: cota de neu', () => {
    it('amb cota per sota del límit de visualització es dibuixa el gràfic i les xifres', () => {
        const { container } = renderCharts();
        tab('Cota de neu');
        expect(screen.getByText('Cota mínima')).toBeInTheDocument();
        expect(container.querySelectorAll('[data-testid="snow-compact"]')).toHaveLength(0);
    });

    it('si la cota és per sobre del límit TOTA la finestra (estiu), una frase en lloc d\'una línia plana, i cap lectura', () => {
        const summer = primary.map(p => ({ ...p, snowLevel: 4500 }));
        const { container } = renderCharts({ data: summer, comparisonData: null });
        tab('Cota de neu');
        expect(container.querySelectorAll('[data-testid="snow-compact"]')).toHaveLength(1);
        expect(screen.getByText(/Sense neu prevista: la cota és per sobre de 3\.500 m durant tota la finestra\./)).toBeInTheDocument();
        expect(screen.getByText('> 3.500 m')).toBeInTheDocument();
        expect(screen.queryByText('Cota mínima')).toBeNull();
        expect(screen.queryByTestId('readout')).toBeNull();
    });

    it('sense cap dada de cota ho diu, sense inventar-se un valor', () => {
        const none = primary.map(p => ({ ...p, snowLevel: null }));
        renderCharts({ data: none, comparisonData: null });
        tab('Cota de neu');
        expect(screen.getByText(/Cap model publica la cota de neu/)).toBeInTheDocument();
        expect(screen.queryAllByText(/^> /)).toHaveLength(0);
    });
});

describe('SmartForecastCharts: mòbil', () => {
    it('els gràfics ocupen l\'amplada de la pantalla: cap contenidor amb desplaçament lateral', () => {
        const { container } = renderCharts();
        expect(container.querySelector('.min-w-\\[700px\\]')).toBeNull();
        expect(container.querySelector('.overflow-x-auto')).toBeNull();
    });

    it('arrossegar el dit per sobre del gràfic recorre les hores i les mostra a la lectura', () => {
        const { container } = renderCharts();
        const svg = container.querySelector('svg[role="img"]') as SVGSVGElement;
        // jsdom no fa layout: amb amplada 1000 i marges 6/36, x = 512 cau cap a la meitat (hora 12).
        fireEvent.touchMove(svg, { touches: [{ clientX: 512, clientY: 100 }] });
        expect(readout()).toHaveTextContent('02:00');
        fireEvent.touchMove(svg, { touches: [{ clientX: 6, clientY: 100 }] });
        expect(readout()).toHaveTextContent('14:00');
    });
});

describe('SmartForecastCharts: lectura de l\'hora', () => {
    it("en repòs mostra les dades d'ARA i ho diu amb l'etiqueta ARA", () => {
        renderCharts({ nowIndex: 0 });
        expect(within(readout()).getByTestId('readout-now')).toHaveTextContent('ARA');
        expect(readout()).toHaveTextContent('14:00 · dl. 21');
        expect(within(readout()).getByTestId('readout-primary')).toHaveTextContent('AROME HD');
        expect(within(readout()).getByTestId('readout-primary')).toHaveTextContent('20°');
    });

    it("sense cap hora d'ARA (p. ex. el detall d'un altre dia) no s'inventa cap hora: mostra el text d'ajuda", () => {
        renderCharts();
        expect(readout()).toHaveTextContent('Toca el gràfic o passa-hi per sobre per veure cada hora.');
        expect(screen.queryByTestId('readout-now')).toBeNull();
        expect(within(readout()).queryByTestId('readout-primary')).toBeNull();
    });

    it("un ARA que no és dins la sèrie tampoc s'inventa res", () => {
        renderCharts({ nowIndex: 99 });
        expect(readout()).toHaveTextContent('Toca el gràfic');
        expect(screen.queryByTestId('readout-now')).toBeNull();
    });

    it("en tocar una hora mostra les dades d'AQUELLA hora de cada model i deixa d'estar en repòs", () => {
        const { container } = renderCharts({ nowIndex: 0 });
        hoverHour(container, 12);
        expect(readout()).toHaveTextContent('02:00 · dt. 22');
        expect(screen.queryByTestId('readout-now')).toBeNull();
        const r = within(readout());
        expect(r.getByTestId('readout-primary')).toHaveTextContent('23°');
        expect(r.getByTestId('readout-ecmwf')).toHaveTextContent('22°');
        expect(r.getByTestId('readout-gfs')).toHaveTextContent('25°');
        expect(r.getByTestId('readout-icon')).toHaveTextContent('21°');
        expect(r.getByTestId('readout-aifs')).toHaveTextContent('24°');
    });

    it("a la pluja, el volum en gran i la probabilitat al costat; cada model, volum i probabilitat (AIFS, només el volum)", () => {
        const { container } = renderCharts();
        tab('Pluja');
        expect(screen.getAllByTestId('readout')).toHaveLength(1);
        hoverHour(container, 8);
        const r = within(readout());
        expect(r.getByTestId('readout-primary')).toHaveTextContent('1,2 mm');
        expect(r.getByTestId('readout-prob')).toHaveTextContent('10%');
        expect(r.getByTestId('readout-ecmwf')).toHaveTextContent('0,0 mm · 10%');
        expect(r.getByTestId('readout-aifs')).toHaveTextContent('0,0 mm');
        expect(r.getByTestId('readout-aifs')).not.toHaveTextContent('%');
    });

    it("a la cota de neu diu la cota de cada model que en publica (AIFS no)", () => {
        const { container } = renderCharts();
        tab('Cota de neu');
        hoverHour(container, 3);
        expect(within(readout()).getByTestId('readout-primary')).toHaveTextContent('3.000 m');
        expect(within(readout()).getByTestId('readout-gfs')).toHaveTextContent('3.000 m');
        expect(within(readout()).queryByTestId('readout-aifs')).toBeNull();
    });

    it("la lectura té alçada fixa per pestanya, perquè el gràfic de sota no es mogui mentre s'arrossega", () => {
        const { container } = renderCharts({ nowIndex: 0 });
        expect(readout().style.minHeight).toBe('92px');
        hoverHour(container, 5);
        expect(readout().style.minHeight).toBe('92px');
        tab('Pluja');
        expect(readout().style.minHeight).toBe('112px');
    });

    it("en canviar de pestanya la lectura torna a l'estat de repòs (ARA) en lloc d'arrossegar l'última hora tocada", () => {
        const { container } = renderCharts({ nowIndex: 0 });
        hoverHour(container, 12);
        expect(screen.queryByTestId('readout-now')).toBeNull();
        tab('Vent');
        expect(screen.getByTestId('readout-now')).toHaveTextContent('ARA');
        expect(readout()).toHaveTextContent('14:00 · dl. 21');
    });

    it("els textos de la lectura surten en l'idioma de l'usuari", () => {
        renderCharts({ lang: 'en' });
        expect(readout()).toHaveTextContent('Tap or hover over the chart to see each hour.');
    });
});
