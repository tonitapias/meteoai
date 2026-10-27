// src/components/Header.origin.test.tsx
// L'origen del lloc el decideix com s'ha triat: el botó de localitzar és "la meva posició"; un favorit, un lloc consultat
// (encara que sigui a tocar d'on és l'usuari).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Header from './Header';
import { TRANSLATIONS } from '../translations';

const fetchWeatherByCoords = vi.fn();
const NEARBY_FAVORITE = { name: 'Girona', country: 'Espanya', latitude: 41.98583, longitude: 2.82396 };

vi.mock('../context/AppContext', () => ({
    useAppContext: () => ({
        actions: { fetchWeatherByCoords, setViewMode: vi.fn(), toggleDebug: vi.fn() },
        state: { loading: false, favorites: [NEARBY_FAVORITE] },
        flags: { viewMode: 'basic', lang: 'ca' },
        t: TRANSLATIONS.ca
    })
}));
vi.mock('../context/GeoLocationContext', () => ({
    useGeoLocation: () => ({ getCoordinates: () => Promise.resolve({ lat: 41.9831458, lon: 2.8249319, name: 'La Meva Ubicació' }) })
}));
vi.mock('../services/geocodingService', () => ({
    reverseGeocode: () => Promise.resolve({ city: 'Girona', country: 'Espanya' })
}));
vi.mock('../hooks/useCitySearch', () => ({
    useCitySearch: () => ({ query: '', setQuery: vi.fn(), suggestions: [], isSearching: false, selectedIndex: -1, setSelectedIndex: vi.fn() })
}));
vi.mock('../hooks/usePreferences', () => ({ usePreferences: () => ({ favorites: [] }) }));
vi.mock('./ViewModeChip', () => ({ default: () => null }));

describe('Header: origen del lloc', () => {
    beforeEach(() => fetchWeatherByCoords.mockClear());

    it("el botó de localitzar carrega la posició del GPS tal qual com a 'gps'", async () => {
        render(<Header />);
        fireEvent.click(screen.getByRole('button', { name: 'Utilitzar la meva ubicació actual' }));

        await waitFor(() => expect(fetchWeatherByCoords).toHaveBeenCalledWith(41.9831458, 2.8249319, 'Girona', 'Espanya', 'gps'));
    });

    it('un favorit a tocar de la meva posició és un lloc consultat (sense origen gps)', () => {
        render(<Header />);
        fireEvent.focus(screen.getByPlaceholderText('CERCAR CIUTAT...'));
        fireEvent.click(screen.getByText('Girona'));

        expect(fetchWeatherByCoords).toHaveBeenCalledWith(41.98583, 2.82396, 'Girona', 'Espanya');
    });
});
