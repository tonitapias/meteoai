// src/App.placeLink.test.tsx
// Un enllaç d'un lloc (?lat&lon&nom) obre directament el tauler carregant, sense passar per la benvinguda.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { DashboardContent } from './components/dashboard/DashboardContent';
import { TRANSLATIONS } from './translations';

type ControllerState = { weatherData: unknown; error: string | null; openingLink: boolean; loading: boolean };
let controllerState: ControllerState;

vi.mock('./hooks/useAppController', () => ({
    useAppController: () => ({ state: controllerState })
}));
vi.mock('./views/WelcomeView', () => ({ default: () => <div>BENVINGUDA</div> }));
vi.mock('./views/DashboardView', () => ({ default: () => <div>TAULER</div> }));
vi.mock('./components/UpdatePrompt', () => ({ default: () => null }));

const appContext = {
    state: { weatherData: null, error: null, loading: false, openingLink: true, now: new Date(), aqiData: null, calculations: {} },
    actions: { setViewMode: vi.fn() },
    flags: { viewMode: 'basic', lang: 'ca' },
    t: TRANSLATIONS.ca
};
vi.mock('./context/AppContext', () => ({
    AppProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAppContext: () => appContext
}));
vi.mock('./components/LoadingSkeleton', () => ({ default: () => <div>ESQUELET</div> }));

describe('Obrir un enllaç d\'un lloc', () => {
    beforeEach(() => {
        controllerState = { weatherData: null, error: null, openingLink: false, loading: false };
    });

    it('sense enllaç, la benvinguda de sempre', () => {
        render(<App />);
        expect(screen.getByText('BENVINGUDA')).toBeInTheDocument();
    });

    it("amb un enllaç carregant, el tauler (encara sense dades), no la benvinguda", () => {
        controllerState.openingLink = true;
        render(<App />);
        expect(screen.getByText('TAULER')).toBeInTheDocument();
        expect(screen.queryByText('BENVINGUDA')).toBeNull();
    });

    it("el tauler mostra l'esquelet de càrrega des del primer render (abans que `loading` es posi)", () => {
        render(<DashboardContent />);
        expect(screen.getByText('ESQUELET')).toBeInTheDocument();
    });
});
