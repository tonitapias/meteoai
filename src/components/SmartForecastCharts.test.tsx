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

    it('sense models de comparació: xip "Sense comparació", cap banda, cap xip de model a la llegenda', () => {
        const { container } = renderCharts({ comparisonData: null });
        expect(screen.getAllByText('Sense comparació').length).toBeGreaterThan(0);
        expect(container.querySelector('[data-testid="model-band"]')).toBeNull();
        expect(screen.queryByTestId('legend-ecmwf')).toBeNull();
        expect(screen.queryByTestId('legend-band')).toBeNull();
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

describe('SmartForecastCharts: llegenda', () => {
    it('diu el model de la línia principal i té un xip per model i un per a la banda', () => {
        renderCharts();
        expect(screen.getByText('Principal · AROME HD')).toBeInTheDocument();
        for (const key of ['ecmwf', 'gfs', 'icon', 'aifs']) {
            expect(screen.getByTestId(`legend-${key}`)).toHaveAttribute('aria-pressed', 'true');
        }
        expect(screen.getByTestId('legend-band')).toHaveAttribute('aria-pressed', 'true');
    });

    it('sense model regional, la principal és el model global', () => {
        renderCharts({ regionalModelLabel: null });
        expect(screen.getByText('Principal · MODEL GLOBAL')).toBeInTheDocument();
    });

    it('amagar un model l\'esborra de TOTS els gràfics i del cartell; tornar-lo a activar el recupera', () => {
        const { container } = renderCharts();
        fireEvent.click(screen.getByTestId('legend-gfs'));
        expect(screen.getByTestId('legend-gfs')).toHaveAttribute('aria-pressed', 'false');
        hoverHour(container, 3);
        expect(screen.queryAllByText('GFS:')).toHaveLength(0);
        expect(screen.getAllByText('ECMWF:').length).toBeGreaterThan(0);
        fireEvent.click(screen.getByTestId('legend-gfs'));
        hoverHour(container, 3);
        expect(screen.getAllByText('GFS:').length).toBeGreaterThan(0);
    });

    it('amagar un model NO canvia l\'acord entre models: és un fet de la previsió, no de la vista', () => {
        renderCharts();
        const before = screen.getAllByText('Acord baix').length;
        fireEvent.click(screen.getByTestId('legend-gfs'));
        fireEvent.click(screen.getByTestId('legend-icon'));
        expect(screen.getAllByText('Acord baix')).toHaveLength(before);
    });

    it('el xip de la banda l\'amaga i la torna a mostrar', () => {
        const { container } = renderCharts();
        fireEvent.click(screen.getByTestId('legend-band'));
        expect(screen.getByTestId('legend-band')).toHaveAttribute('aria-pressed', 'false');
        expect(container.querySelectorAll('[data-testid="model-band"]')).toHaveLength(0);
        fireEvent.click(screen.getByTestId('legend-band'));
        expect(container.querySelectorAll('[data-testid="model-band"]').length).toBeGreaterThan(0);
    });

    it('la banda només inclou els models visibles: amagar-ne dos deixa la banda entre els altres dos', () => {
        const { container } = renderCharts();
        const bandOf = () => container.querySelector('[data-testid="model-band"]')?.getAttribute('d');
        const full = bandOf();
        fireEvent.click(screen.getByTestId('legend-gfs')); // el més alt
        expect(bandOf()).not.toBe(full);
    });

    it('un model idèntic a la principal surt a la llegenda com a xip fix ("ICON = principal"), no com a botó', () => {
        const identical = model(0).map((p, i) => ({ ...p, temp: primary[i].temp }));
        renderCharts({ comparisonData: comparison({ icon: identical }) });
        const chip = screen.getByTestId('legend-icon');
        expect(chip.tagName).toBe('SPAN');
        expect(chip).toHaveTextContent('ICON = principal');
    });

    it('diu de quina hora és la previsió', () => {
        renderCharts({ updatedAt: '2026-09-21T14:05' });
        expect(screen.getByText('Previsió de les 14:05')).toBeInTheDocument();
    });

    it('sense hora de la previsió (o il·legible) no hi ha cap rètol', () => {
        renderCharts({ updatedAt: null });
        expect(screen.queryByText(/Previsió de les/)).toBeNull();
        renderCharts({ updatedAt: 'ahir' });
        expect(screen.queryByText(/Previsió de les/)).toBeNull();
    });
});

describe('SmartForecastCharts: lectura del gràfic', () => {
    it('cada gràfic té escala a l\'eix Y', () => {
        const { container } = renderCharts();
        expect(container.querySelectorAll('[data-testid="y-tick"]').length).toBeGreaterThan(10);
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
        const other = render(<SmartForecastCharts data={sameDay} comparisonData={null} unit="°C" lang="ca" />);
        expect(other.container.querySelectorAll('[data-testid="midnight-marker"]')).toHaveLength(0);
    });

    it('marca "ara" (línia, punt i ARA a l\'eix) només si se sap on és', () => {
        const { container } = renderCharts({ nowIndex: 0 });
        expect(container.querySelectorAll('[data-testid="now-marker"]').length).toBeGreaterThan(0);
        expect(screen.getAllByText('ARA').length).toBeGreaterThan(0);
        const without = render(<SmartForecastCharts data={primary} comparisonData={null} unit="°C" lang="ca" />);
        expect(without.container.querySelectorAll('[data-testid="now-marker"]')).toHaveLength(0);
        expect(within(without.container).queryAllByText('ARA')).toHaveLength(0);
    });

    it('un "ara" fora de la sèrie no dibuixa res (ni peta)', () => {
        const { container } = renderCharts({ nowIndex: 99 });
        expect(container.querySelectorAll('[data-testid="now-marker"]')).toHaveLength(0);
    });

    it('el volum de pluja es dibuixa amb barres (una per hora amb pluja) i un punt per model', () => {
        const { container } = renderCharts();
        // La principal plou una sola hora (index 8); els 4 models, una (index 9).
        const bars = container.querySelectorAll('[data-testid="precip-bar"]');
        const dots = container.querySelectorAll('[data-testid="precip-dot"]');
        expect(bars.length).toBeGreaterThan(0);
        expect(dots.length).toBe(bars.length * 4);
    });

    it('un model amagat no deixa punts al volum', () => {
        const { container } = renderCharts();
        const withAll = container.querySelectorAll('[data-testid="precip-dot"]').length;
        fireEvent.click(screen.getByTestId('legend-ecmwf'));
        expect(container.querySelectorAll('[data-testid="precip-dot"]').length).toBeLessThan(withAll);
    });

    it('el vent porta la línia de ràfegues i el cartell en diu el valor', () => {
        const { container } = renderCharts();
        expect(container.querySelectorAll('[data-testid="gust-line"]').length).toBeGreaterThan(0);
        hoverHour(container, 3);
        expect(screen.getAllByText('Ràfega:').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Línia contínua: vent sostingut\. Discontínua: ràfegues\./).length).toBeGreaterThan(0);
    });

    it('sense ràfegues a les dades, no hi ha línia de ràfegues (ni una de plana a 0)', () => {
        const noGusts = primary.map(p => ({ ...p, gusts: null }));
        const { container } = renderCharts({ data: noGusts });
        expect(container.querySelectorAll('[data-testid="gust-line"]')).toHaveLength(0);
    });
});

describe('SmartForecastCharts: cota de neu', () => {
    it('amb cota per sota del límit de visualització es dibuixa el gràfic i les xifres', () => {
        const { container } = renderCharts();
        expect(screen.getAllByText('Cota mínima').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Cota màxima').length).toBeGreaterThan(0);
        expect(container.querySelectorAll('[data-testid="snow-compact"]')).toHaveLength(0);
    });

    it('si la cota és per sobre del límit TOTA la finestra (estiu), una frase en lloc d\'una línia plana', () => {
        const summer = primary.map(p => ({ ...p, snowLevel: 4500 }));
        const { container } = renderCharts({ data: summer, comparisonData: null });
        expect(container.querySelectorAll('[data-testid="snow-compact"]').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Sense neu prevista: la cota és per sobre de 3\.500 m durant tota la finestra\./).length).toBeGreaterThan(0);
        expect(screen.getAllByText('> 3.500 m').length).toBeGreaterThan(0);
        expect(screen.queryAllByText('Cota mínima')).toHaveLength(0);
    });

    it('sense cap dada de cota ho diu, sense inventar-se un valor', () => {
        const none = primary.map(p => ({ ...p, snowLevel: null }));
        renderCharts({ data: none, comparisonData: null });
        expect(screen.getAllByText(/Cap model publica la cota de neu/).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/^> /)).toHaveLength(0);
    });
});

describe('SmartForecastCharts: mòbil', () => {
    it('els gràfics ocupen l\'amplada de la pantalla: cap contenidor de 700 px amb desplaçament lateral', () => {
        const { container } = renderCharts();
        expect(container.querySelector('.min-w-\\[700px\\]')).toBeNull();
        expect(container.querySelector('.overflow-x-auto:not(.no-scrollbar)')).toBeNull();
    });

    it('arrossegar el dit per sobre del gràfic recorre les hores i en mostra el cartell', () => {
        const { container } = renderCharts();
        const svg = container.querySelector('svg[role="img"]') as SVGSVGElement;
        // jsdom no fa layout: amb amplada 1000 i marges 44/20, x = 512 cau cap a la meitat (~ hora 12).
        fireEvent.touchMove(svg, { touches: [{ clientX: 512, clientY: 100 }] });
        expect(screen.getAllByText('02:00').length).toBeGreaterThan(0);
        fireEvent.touchMove(svg, { touches: [{ clientX: 44, clientY: 100 }] });
        expect(screen.getAllByText('14:00').length).toBeGreaterThan(0);
    });
});

describe('SmartForecastCharts: franja de lectura (mòbil)', () => {
    const strip = () => screen.getByTestId('readout-strip');
    const mobileTree = (container: HTMLElement) => container.querySelectorAll('.md\\:hidden')[1] as HTMLElement;

    it("en repòs mostra les dades d'ARA i ho diu amb l'etiqueta ARA", () => {
        renderCharts({ nowIndex: 0 });
        expect(within(strip()).getByTestId('readout-now')).toHaveTextContent('ARA');
        expect(strip()).toHaveTextContent('14:00 · dl. 21');
        expect(within(strip()).getByTestId('readout-primary')).toHaveTextContent('AROME HD');
        expect(within(strip()).getByTestId('readout-primary')).toHaveTextContent('20°C');
    });

    it("sense cap hora d'ARA (p. ex. el detall d'un altre dia) no s'inventa cap hora: mostra el text d'ajuda", () => {
        renderCharts();
        expect(strip()).toHaveTextContent('Arrossega el dit per sobre del gràfic per veure les dades de cada hora.');
        expect(screen.queryByTestId('readout-now')).toBeNull();
        expect(within(strip()).queryByTestId('readout-primary')).toBeNull();
    });

    it("un ARA que no és dins la sèrie tampoc s'inventa res", () => {
        renderCharts({ nowIndex: 99 });
        expect(strip()).toHaveTextContent('Arrossega el dit');
        expect(screen.queryByTestId('readout-now')).toBeNull();
    });

    it("en tocar una hora mostra les dades d'AQUELLA hora de cada model i deixa d'estar en repòs", () => {
        const { container } = renderCharts({ nowIndex: 0 });
        hoverHour(container, 12);
        expect(strip()).toHaveTextContent('02:00 · dt. 22');
        expect(screen.queryByTestId('readout-now')).toBeNull();
        const s = within(strip());
        expect(s.getByTestId('readout-primary')).toHaveTextContent('23°C');
        expect(s.getByTestId('readout-ecmwf')).toHaveTextContent('22°C');
        expect(s.getByTestId('readout-gfs')).toHaveTextContent('25°C');
        expect(s.getByTestId('readout-icon')).toHaveTextContent('21°C');
        expect(s.getByTestId('readout-aifs')).toHaveTextContent('24°C');
    });

    it("el nom de la línia principal és el del model REAL d'aquella hora (regional o global)", () => {
        const { container } = renderCharts();
        hoverHour(container, 3);
        expect(within(strip()).getByTestId('readout-primary')).toHaveTextContent('AROME HD');
        hoverHour(container, 18);
        expect(within(strip()).getByTestId('readout-primary')).toHaveTextContent('MODEL GLOBAL');
    });

    it("a mòbil el cartell flotant ja no tapa el gràfic (les dades surten a la franja), però a escriptori es manté", () => {
        const { container } = renderCharts();
        hoverHour(container, 3);
        // El cartell flotant etiqueta els models amb dos punts ("ECMWF:"); la franja, sense.
        expect(within(mobileTree(container)).queryByText('ECMWF:')).toBeNull();
        expect(screen.getAllByText('ECMWF:').length).toBeGreaterThan(0);
        // El cursor (línia i punts sobre la corba) es dibuixa igualment a mòbil.
        expect(mobileTree(container).querySelectorAll('svg circle').length).toBeGreaterThan(0);
    });

    it("respecta els models amagats a la llegenda", () => {
        const { container } = renderCharts();
        fireEvent.click(screen.getByTestId('legend-gfs'));
        hoverHour(container, 3);
        expect(within(strip()).queryByTestId('readout-gfs')).toBeNull();
        expect(within(strip()).getByTestId('readout-ecmwf')).toBeInTheDocument();
    });

    it("a la pluja hi ha UNA sola franja amb volum i probabilitat de cada model (AIFS, només el volum)", () => {
        const { container } = renderCharts();
        fireEvent.click(screen.getByRole('button', { name: 'PLUJA' }));
        expect(screen.getAllByTestId('readout-strip')).toHaveLength(1);
        hoverHour(container, 8);
        const s = within(strip());
        expect(s.getByTestId('readout-primary')).toHaveTextContent('1,2 mm · 10 %');
        expect(s.getByTestId('readout-ecmwf')).toHaveTextContent('0,0 mm · 10 %');
        expect(s.getByTestId('readout-aifs')).toHaveTextContent('0,0 mm');
        expect(s.getByTestId('readout-aifs')).not.toHaveTextContent('%');
    });

    it("al vent afegeix la ràfega", () => {
        const { container } = renderCharts();
        fireEvent.click(screen.getByRole('button', { name: 'Vent' }));
        hoverHour(container, 3);
        expect(within(strip()).getByTestId('readout-gust')).toHaveTextContent('20 km/h');
        expect(within(strip()).getByTestId('readout-primary')).toHaveTextContent('10 km/h');
    });

    it("sense ràfegues a les dades, no hi ha xip de ràfega (ni un 0 km/h)", () => {
        const noGusts = primary.map(p => ({ ...p, gusts: null }));
        const { container } = renderCharts({ data: noGusts });
        fireEvent.click(screen.getByRole('button', { name: 'Vent' }));
        hoverHour(container, 3);
        expect(within(strip()).queryByTestId('readout-gust')).toBeNull();
    });

    it("a la cota de neu diu la cota de cada model que en publica (AIFS no)", () => {
        const { container } = renderCharts();
        fireEvent.click(screen.getByRole('button', { name: 'Cota de neu' }));
        hoverHour(container, 3);
        expect(within(strip()).getByTestId('readout-primary')).toHaveTextContent('3.000 m');
        expect(within(strip()).getByTestId('readout-gfs')).toHaveTextContent('3.000 m');
        expect(within(strip()).queryByTestId('readout-aifs')).toBeNull();
    });

    it("la cota de neu compacta (estiu) no porta franja: no hi ha cap gràfic per llegir", () => {
        const summer = primary.map(p => ({ ...p, snowLevel: 4500 }));
        renderCharts({ data: summer, comparisonData: null });
        fireEvent.click(screen.getByRole('button', { name: 'Cota de neu' }));
        expect(screen.queryByTestId('readout-strip')).toBeNull();
    });

    it("la franja té alçada fixa per pestanya, perquè el gràfic de sota no es mogui mentre s'arrossega", () => {
        const { container } = renderCharts({ nowIndex: 0 });
        expect(strip().style.minHeight).toBe('96px');
        hoverHour(container, 5);
        expect(strip().style.minHeight).toBe('96px');
        fireEvent.click(screen.getByRole('button', { name: 'PLUJA' }));
        expect(strip().style.minHeight).toBe('132px');
    });

    it("en canviar de pestanya la franja torna a l'estat de repòs (ARA) en lloc d'arrossegar l'última hora tocada", () => {
        const { container } = renderCharts({ nowIndex: 0 });
        hoverHour(container, 12);
        expect(screen.queryByTestId('readout-now')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Vent' }));
        expect(screen.getByTestId('readout-now')).toHaveTextContent('ARA');
        expect(strip()).toHaveTextContent('14:00 · dl. 21');
    });

    it("els textos de la franja surten en l'idioma de l'usuari", () => {
        renderCharts({ lang: 'en' });
        expect(strip()).toHaveTextContent('Drag your finger across the chart to see the data for each hour.');
    });
});

