// src/components/Header.home.test.tsx
// Botó Inici del tauler: torna a la benvinguda (vegeu goHome a useAppController).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Header from './Header';
import { TRANSLATIONS, type Language } from '../translations';

const fetchWeatherByCoords = vi.fn();
const goHome = vi.fn();
let lang: Language = 'ca';

vi.mock('../context/AppContext', () => ({
    useAppContext: () => ({
        actions: { fetchWeatherByCoords, goHome, setViewMode: vi.fn(), toggleDebug: vi.fn() },
        state: { loading: false, favorites: [] },
        flags: { viewMode: 'basic', lang },
        t: TRANSLATIONS[lang]
    })
}));

let resolveCoords: (coords: { lat: number; lon: number }) => void = () => {};
vi.mock('../context/GeoLocationContext', () => ({
    useGeoLocation: () => ({
        getCoordinates: () => new Promise<{ lat: number; lon: number }>((resolve) => { resolveCoords = resolve; })
    })
}));
vi.mock('../services/geocodingService', () => ({
    reverseGeocode: () => Promise.resolve({ city: 'Girona', country: 'Espanya' })
}));
vi.mock('../hooks/useCitySearch', () => ({
    useCitySearch: () => ({ query: '', setQuery: vi.fn(), suggestions: [], isSearching: false, selectedIndex: -1, setSelectedIndex: vi.fn() })
}));
vi.mock('../hooks/usePreferences', () => ({ usePreferences: () => ({ favorites: [] }) }));
vi.mock('./ViewModeChip', () => ({ default: () => null }));

describe('Header: botó Inici', () => {
    beforeEach(() => {
        lang = 'ca';
        fetchWeatherByCoords.mockClear();
        goHome.mockClear();
    });

    it.each([
        ['ca', "Torna a l'inici", 'Inici'],
        ['es', 'Volver al inicio', 'Inicio'],
        ['en', 'Back to home', 'Home'],
        ['fr', "Retour à l'accueil", 'Accueil']
    ] as const)('%s: el nom accessible conté el text visible i el botó torna a l\'inici', (code, aria, visible) => {
        lang = code;
        render(<Header />);
        const button = screen.getByRole('button', { name: aria });

        expect(button).toHaveTextContent(visible);
        expect(aria.toLowerCase()).toContain(visible.toLowerCase());
        expect(button).toHaveAttribute('type', 'button');

        fireEvent.click(button);
        expect(goHome).toHaveBeenCalledTimes(1);
    });

    it("té una àrea tàctil d'almenys 44 px", () => {
        render(<Header />);
        const button = screen.getByRole('button', { name: "Torna a l'inici" });
        expect(button.className).toContain('min-w-[44px]');
        expect(button.className).toContain('min-h-[44px]');
    });

    it("si el GPS respon després d'haver tornat a l'inici, no torna a obrir el tauler", async () => {
        const { unmount } = render(<Header />);
        fireEvent.click(screen.getByRole('button', { name: 'Utilitzar la meva ubicació actual' }));

        // Inici: el tauler (i la capçalera) desapareixen mentre el GPS encara busca.
        unmount();
        await act(async () => { resolveCoords({ lat: 41.98, lon: 2.82 }); });

        expect(fetchWeatherByCoords).not.toHaveBeenCalled();
    });
});
