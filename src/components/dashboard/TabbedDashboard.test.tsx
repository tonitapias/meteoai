// La taula de verificació giny → pestanya, com a test: tot el que surt a la vista completa d'avui ha de sortir en
// alguna pestanya (i en la que toca). Els ginys es substitueixen per marques: aquí només es prova la composició.
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { useEffect } from 'react';
import { TRANSLATIONS } from '../../translations';
import { ALL_DETAIL_WIDGETS } from '../detailWidgetIds';

// Cada marca compta quantes vegades s'ha muntat (per veure que canviar de pestanya no torna a muntar res). Les
// importacions només es fan servir quan la marca es pinta, ja després d'importar-les.
const { mounts, stub } = vi.hoisted(() => {
    const mounts: Record<string, number> = {};
    const stub = (name: string) => function Stub() {
        useEffect(() => { mounts[name] = (mounts[name] ?? 0) + 1; }, []);
        return <div data-testid={name} />;
    };
    return { mounts, stub };
});

vi.mock('../CurrentWeather', () => ({ default: stub('CurrentWeather') }));
vi.mock('../WeatherCharts', () => ({ MinutelyPreciseChart: stub('MinutelyPreciseChart') }));
vi.mock('../OfflineSnapshotBanner', () => ({ default: stub('OfflineSnapshotBanner') }));
vi.mock('../LightningBanner', () => ({ default: stub('LightningBanner') }));
vi.mock('../RadarNowcastBanner', () => ({ default: stub('RadarNowcastBanner') }));
vi.mock('../RadarRealityBanner', () => ({ default: stub('RadarRealityBanner') }));
vi.mock('../OfficialAlertBanner', () => ({ default: stub('OfficialAlertBanner') }));
vi.mock('../AIInsights', () => ({ default: stub('AIInsights') }));
vi.mock('../Forecast24h', () => ({ default: stub('Forecast24h') }));
vi.mock('../ForecastSection', () => ({ default: stub('ForecastSection') }));
vi.mock('../SmartForecastCharts', () => ({ default: stub('SmartForecastCharts') }));
vi.mock('../ConsensusSection', () => ({ default: stub('ConsensusSection') }));
vi.mock('../planet/PlanetExtremesCard', () => ({ default: stub('PlanetExtremesCard') }));
// El fenomen del planeta (petició diferida al worker): aquí, cap.
vi.mock('../../hooks/usePlanetHeadline', () => ({ usePlanetHeadline: () => null }));
vi.mock('../DetailWidgetsGrid', () => ({
    default: ({ ids }: { ids: string[] }) => <div data-testid="DetailWidgetsGrid" data-ids={ids.join(',')} />,
}));

import { AppProvider } from '../../context/AppContext';
import { TabbedDashboard } from './TabbedDashboard';

const makeController = (place: { latitude: number; longitude: number }, offline = false) => ({
    state: {
        weatherData: {
            current: { time: '2026-11-13T12:00' },
            daily: { time: [] },
            location: { name: 'Lloc', ...place },
            ...(offline ? { offlineSnapshot: { savedAt: 1, issuedAt: '2026-11-13T09:00', distanceKm: null } } : {}),
        },
        // shiftedNow = l'hora del lloc (amb el constructor local: el test no depèn del fus horari de la màquina).
        calculations: { effectiveWeatherCode: 1, chartSeries: null, chartDataFull: [], chartData24h: [], minutelyPreciseData: [], shiftedNow: new Date(2026, 10, 13, 9, 5) },
        aqiData: null,
        aiAnalysis: null,
        lightning: null,
        sharedPlace: null,
        now: new Date('2026-11-13T12:00:00Z'),
    },
    actions: {
        setShowRadar: vi.fn(),
        setPlanetModal: vi.fn(),
        setSelectedDayIndex: vi.fn(),
        refreshLoadedLocation: vi.fn(),
    },
    flags: { unit: 'C', lang: 'ca', isFavorite: () => false, activeRegionalModel: null},
    modals: { selectedDayIndex: null, showRadar: false, planetModal: null } as Record<string, unknown>,
    t: TRANSLATIONS.ca,
});

type Controller = ReturnType<typeof makeController>;
const ui = (controller: Controller) => (
    <AppProvider controller={controller as never}>
        <TabbedDashboard />
    </AppProvider>
);

const panel = (tab: string) => document.getElementById(`dashboard-panel-${tab}`);
const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

// La taula: cada element de la vista completa d'avui i la pestanya on va.
const COVERAGE: Array<[string, string]> = [
    ['OfflineSnapshotBanner', 'now'],
    ['CurrentWeather', 'now'],
    ['MinutelyPreciseChart', 'now'],
    ['LightningBanner', 'now'],
    ['RadarNowcastBanner', 'now'],
    ['RadarRealityBanner', 'now'],
    ['OfficialAlertBanner', 'now'],
    ['AIInsights', 'now'],
    ['Forecast24h', 'now'],
    ['ForecastSection', 'forecast'],
    ['SmartForecastCharts', 'forecast'],
    ['ConsensusSection', 'forecast'],
    ['PlanetExtremesCard', 'sky'],
];

describe('TabbedDashboard → cap giny perdut (taula giny → pestanya)', () => {
    beforeEach(() => {
        Object.keys(mounts).forEach((key) => delete mounts[key]);
        window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    });

    it('cada element de la vista completa és a la seva pestanya', async () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 }, true)));
        openTab('Previsió');
        openTab('Detall');
        openTab('Cel');
        for (const [testId, tab] of COVERAGE) {
            expect(await within(panel(tab)!).findByTestId(testId)).toBeTruthy();
        }
        // Els 11 ginys de la graella, repartits entre Detall i Cel sense repetir-ne cap.
        const detailIds = (await within(panel('detail')!).findByTestId('DetailWidgetsGrid')).getAttribute('data-ids')!.split(',');
        const skyIds = (await within(panel('sky')!).findByTestId('DetailWidgetsGrid')).getAttribute('data-ids')!.split(',');
        expect(skyIds).toEqual(['sun', 'moon']);
        expect([...detailIds, ...skyIds].sort()).toEqual([...ALL_DETAIL_WIDGETS].sort());
    });

    it('d\'entrada només hi ha Ara; les altres es munten en obrir-les', async () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        expect(await screen.findByTestId('Forecast24h')).toBeTruthy();
        expect(panel('forecast')).toBeNull();
        expect(screen.queryByTestId('ForecastSection')).toBeNull();
        expect(screen.getByRole('tab', { name: 'Ara' }).getAttribute('aria-selected')).toBe('true');
        openTab('Previsió');
        expect(await screen.findByTestId('ConsensusSection')).toBeTruthy();
    });

    it('canviar de pestanya amaga l\'altra però no la desmunta (el consens no torna a demanar res)', async () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        openTab('Previsió');
        await screen.findByTestId('ConsensusSection');
        openTab('Ara');
        expect(panel('forecast')!.hidden).toBe(true);
        expect(panel('now')!.hidden).toBe(false);
        openTab('Previsió');
        openTab('Detall');
        openTab('Previsió');
        expect(mounts.ConsensusSection).toBe(1);
        expect(mounts.CurrentWeather).toBe(1);
        expect(mounts.OfficialAlertBanner).toBe(1);
    });

    it('cada canvi de pestanya torna a dalt de la pàgina', () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        openTab('Detall');
        expect(window.scrollTo as Mock).toHaveBeenCalledWith(0, 0);
    });

    it('el botó Radar obre el radar sense canviar de pestanya', () => {
        const controller = makeController({ latitude: 41.39, longitude: 2.16 });
        render(ui(controller));
        openTab('Cel');
        fireEvent.click(screen.getByRole('button', { name: 'Obre el radar' }));
        expect(controller.actions.setShowRadar).toHaveBeenCalledWith(true);
        expect(screen.getByRole('tab', { name: 'Cel' }).getAttribute('aria-selected')).toBe('true');
    });

    it('els destacats d\'Ara porten a la pestanya del seu giny (la lluna, a Cel)', async () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        const nav = await screen.findByRole('navigation', { name: 'Destacats' });
        expect(panel('now')!.contains(nav)).toBe(true);
        fireEvent.click(within(nav).getByRole('button', { name: / · Cel$/ }));
        expect(screen.getByRole('tab', { name: 'Cel' }).getAttribute('aria-selected')).toBe('true');
        expect(panel('sky')!.hidden).toBe(false);
    });

    it('les altres pestanyes diuen de quin lloc són les dades; Ara no (ja hi ha la targeta)', () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        expect(within(panel('now')!).queryByText('Lloc')).toBeNull();
        openTab('Detall');
        expect(within(panel('detail')!).getByText('Lloc')).toBeTruthy();
        expect(within(panel('detail')!).getByText('09:05')).toBeTruthy();
    });

    it('a escriptori (≥1024 px) la barra va a dalt, abans dels panells; més estret, a baix (a <body>)', () => {
        const originalMatchMedia = window.matchMedia;
        try {
            window.matchMedia = vi.fn().mockImplementation((query: string) => ({
                matches: query.includes('1024'), addEventListener: vi.fn(), removeEventListener: vi.fn(),
            })) as unknown as typeof window.matchMedia;
            const { container } = render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
            const list = screen.getByRole('tablist');
            expect(container.contains(list)).toBe(true);
            expect(list.compareDocumentPosition(panel('now')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        } finally {
            window.matchMedia = originalMatchMedia;
        }
    });

    it('al mòbil la barra no és dins del tauler sinó a <body> (fixa a baix)', () => {
        const { container } = render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        expect(container.contains(screen.getByRole('tablist'))).toBe(false);
    });

    it('un lloc nou s\'obre a Ara; un refresc del mateix lloc no canvia de pestanya', () => {
        const { rerender } = render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        openTab('Detall');
        rerender(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        expect(screen.getByRole('tab', { name: 'Detall' }).getAttribute('aria-selected')).toBe('true');
        rerender(ui(makeController({ latitude: 41.98, longitude: 2.82 })));
        expect(screen.getByRole('tab', { name: 'Ara' }).getAttribute('aria-selected')).toBe('true');
        expect(panel('now')!.hidden).toBe(false);
    });
});

// --- Historial: la pestanya a la URL (?tab=…) i una sola entrada en sortir d'Ara (vegeu tabs/tabHistory.ts) -----------
const travel = (direction: 'back' | 'forward') => act(async () => {
    await new Promise<void>((resolve) => {
        window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true });
        window.history[direction]();
    });
});
const selected = () => screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent;
const tabParam = () => new URLSearchParams(window.location.search).get('tab');

describe('TabbedDashboard → historial (enrere i endavant)', () => {
    beforeEach(() => {
        window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
        window.history.replaceState(null, '', '/');
    });

    it('sortir d\'Ara afegeix una sola entrada; canviar entre pestanyes no n\'afegeix cap', () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        const start = window.history.length;
        openTab('Previsió');
        expect(window.history.length).toBe(start + 1);
        expect(tabParam()).toBe('forecast');
        openTab('Detall');
        openTab('Cel');
        expect(window.history.length).toBe(start + 1);
        expect(tabParam()).toBe('sky');
    });

    it('l\'enrere des d\'una pestanya torna a Ara, i l\'endavant hi torna', async () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        openTab('Detall');
        await travel('back');
        expect(selected()).toBe('Ara');
        expect(tabParam()).toBeNull();
        expect(panel('now')!.hidden).toBe(false);
        await travel('forward');
        expect(selected()).toBe('Detall');
        expect(panel('detail')!.hidden).toBe(false);
    });

    it('tornar a Ara amb la barra reaprofita l\'entrada: per molt que es vagi i torni, no se n\'acumulen', () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        const start = window.history.length;
        openTab('Previsió');
        openTab('Ara');
        expect(tabParam()).toBeNull();
        openTab('Detall');
        openTab('Ara');
        openTab('Cel');
        expect(window.history.length).toBe(start + 1);
        expect(tabParam()).toBe('sky');
    });

    it('tancar un modal amb l\'enrere no canvia de pestanya (els modals hi posen la URL del moment)', async () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        openTab('Detall');
        // Com useModalHistory (Vent, UV...): una entrada amb la URL actual.
        window.history.pushState({ modalOpen: true }, '', window.location.href);
        await travel('back');
        expect(selected()).toBe('Detall');
        expect(tabParam()).toBe('detail');
        // Com useTacticalModal (el gràfic de 7 dies): una entrada amb #modal-… i sense estat.
        openTab('Previsió');
        window.history.pushState(null, '', '#modal-trendChart');
        expect(tabParam()).toBe('forecast');
        await travel('back');
        expect(selected()).toBe('Previsió');
        // Com el radar, amb el menú de capes a sobre: dos nivells.
        window.history.pushState({ modalId: 'radarLive' }, '');
        window.history.pushState({ modalId: 'radarLive', layerMenu: true }, '');
        await travel('back');
        await travel('back');
        expect(selected()).toBe('Previsió');
    });

    it('un refresc conserva la pestanya: és a la URL (i Ara també es munta)', async () => {
        window.history.replaceState(null, '', '/?tab=sky');
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        expect(selected()).toBe('Cel');
        expect(panel('sky')!.hidden).toBe(false);
        expect(panel('now')).not.toBeNull();
        expect(panel('now')!.hidden).toBe(true);
    });

    it('els altres paràmetres de la URL (el lloc, ?ui) es conserven', () => {
        window.history.replaceState(null, '', '/?lat=41.39&lon=2.16&nom=Barcelona&ui=tabs');
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        openTab('Detall');
        const params = new URLSearchParams(window.location.search);
        expect([params.get('lat'), params.get('lon'), params.get('nom'), params.get('ui'), params.get('tab')])
            .toEqual(['41.39', '2.16', 'Barcelona', 'tabs', 'detail']);
    });

    it('un lloc nou, o sortir del tauler (botó Inici), treuen la pestanya de la URL', () => {
        const { rerender, unmount } = render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        openTab('Detall');
        rerender(ui(makeController({ latitude: 41.98, longitude: 2.82 })));
        expect(tabParam()).toBeNull();
        openTab('Cel');
        expect(tabParam()).toBe('sky');
        unmount();
        expect(tabParam()).toBeNull();
    });

    it('al mòbil, mentre s\'escriu al cercador, la barra s\'amaga; en sortir del camp, torna', () => {
        render(ui(makeController({ latitude: 41.39, longitude: 2.16 })));
        const search = document.createElement('input');
        document.body.appendChild(search);
        const bar = () => screen.getByRole('tablist', { hidden: true }).parentElement!.parentElement!;
        expect(bar().className).not.toMatch(/(^|\s)hidden(\s|$)/);
        act(() => search.focus());
        expect(bar().className).toMatch(/(^|\s)hidden(\s|$)/);
        act(() => search.blur());
        expect(bar().className).not.toMatch(/(^|\s)hidden(\s|$)/);
        search.remove();
    });

    it('amb un modal obert, la barra queda inert i no toca l\'historial', () => {
        const controller = makeController({ latitude: 41.39, longitude: 2.16 });
        controller.modals = { ...controller.modals, showRadar: true };
        render(ui(controller));
        const start = window.history.length;
        const bar = screen.getByRole('tablist').closest('[inert]');
        expect(bar).not.toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: 'Detall' }));
        expect(selected()).toBe('Ara');
        expect(window.history.length).toBe(start);
        expect(tabParam()).toBeNull();
    });
});
