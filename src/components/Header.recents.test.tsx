// src/components/Header.recents.test.tsx
// Cerques recents (auditoria d'UX, segona volta, B8): els 3 darrers llocs triats al cercador, a part dels favorits, surten
// en enfocar-lo amb la cerca buida.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Header from './Header';
import { TRANSLATIONS } from '../translations';
import type { LocationData } from '../hooks/usePreferences';
import type { GeoSearchResult } from '../services/geocodingService';

const fetchWeatherByCoords = vi.fn();
const addRecent = vi.fn();
let favorites: LocationData[] = [];
let recents: LocationData[] = [];
let suggestions: GeoSearchResult[] = [];

vi.mock('../context/AppContext', () => ({
    useAppContext: () => ({
        actions: { fetchWeatherByCoords, addRecent, goHome: vi.fn(), setShowSettings: vi.fn(), toggleDebug: vi.fn() },
        state: { loading: false, favorites, recents },
        flags: { lang: 'ca' },
        t: TRANSLATIONS.ca
    })
}));
vi.mock('../context/GeoLocationContext', () => ({ useGeoLocation: () => ({ getCoordinates: () => new Promise(() => {}) }) }));
vi.mock('../services/geocodingService', () => ({ reverseGeocode: () => Promise.resolve({ city: 'Girona', country: 'Espanya' }) }));
// La cerca de debò espera i va a la xarxa: aquí, el text i uns resultats fixos.
vi.mock('../hooks/useCitySearch', () => ({
    useCitySearch: () => {
        const [query, setQuery] = useState('');
        const [selectedIndex, setSelectedIndex] = useState(-1);
        return { query, setQuery, suggestions: query.length >= 3 ? suggestions : [], isSearching: false, selectedIndex, setSelectedIndex };
    }
}));
vi.mock('../hooks/usePreferences', () => ({ usePreferences: () => ({ favorites: [] }) }));

const girona: LocationData = { name: 'Girona', country: 'Espanya', latitude: 41.98, longitude: 2.82 };
const vielha: LocationData = { name: 'Vielha', country: 'Espanya', admin1: 'Catalunya', latitude: 42.7, longitude: 0.8 };
const olot: LocationData = { name: 'Olot', country: 'Espanya', latitude: 42.18, longitude: 2.49 };

const searchBox = () => screen.getByRole('textbox', { name: 'CERCAR CIUTAT' });
const recentsBlock = () => screen.queryByTestId('search-recents');

describe('Header: cerques recents', () => {
    beforeEach(() => {
        fetchWeatherByCoords.mockClear();
        addRecent.mockClear();
        favorites = [];
        recents = [];
        suggestions = [];
    });

    it('en enfocar la cerca buida surten els recents, sota els favorits, sense repetir un favorit', () => {
        favorites = [girona];
        recents = [girona, vielha, olot];
        render(<Header />);
        expect(recentsBlock()).toBeNull();
        fireEvent.focus(searchBox());
        const block = recentsBlock();
        expect(block).not.toBeNull();
        expect(within(block!).getByText('RECENTS')).toBeTruthy();
        expect(within(block!).queryByText('Girona')).toBeNull();
        expect(within(block!).getByText('Vielha')).toBeTruthy();
        expect(within(block!).getByText('Catalunya, Espanya')).toBeTruthy();
        expect(within(block!).getByText('Olot')).toBeTruthy();
    });

    it('sense favorits també surten', () => {
        recents = [vielha];
        render(<Header />);
        fireEvent.focus(searchBox());
        expect(within(recentsBlock()!).getByText('Vielha')).toBeTruthy();
    });

    it('tocar un recent l\'obre i el torna a posar el primer', () => {
        recents = [olot, vielha];
        render(<Header />);
        fireEvent.focus(searchBox());
        fireEvent.click(within(recentsBlock()!).getByText('Vielha'));
        expect(fetchWeatherByCoords).toHaveBeenCalledWith(42.7, 0.8, 'Vielha', 'Espanya');
        expect(addRecent).toHaveBeenCalledWith({ name: 'Vielha', latitude: 42.7, longitude: 0.8, country: 'Espanya', admin1: 'Catalunya' });
    });

    it('un favorit s\'obre però no entra als recents', () => {
        favorites = [girona];
        render(<Header />);
        fireEvent.focus(searchBox());
        fireEvent.click(screen.getByText('Girona'));
        expect(fetchWeatherByCoords).toHaveBeenCalledWith(41.98, 2.82, 'Girona', 'Espanya');
        expect(addRecent).not.toHaveBeenCalled();
    });

    it('un resultat de la cerca entra als recents', () => {
        suggestions = [{ id: 1, name: 'Ripoll', admin1: 'Catalunya', country: 'Espanya', latitude: 42.2, longitude: 2.19 }];
        render(<Header />);
        fireEvent.focus(searchBox());
        fireEvent.change(searchBox(), { target: { value: 'Rip' } });
        fireEvent.click(screen.getByText('Ripoll'));
        expect(addRecent).toHaveBeenCalledWith({ name: 'Ripoll', latitude: 42.2, longitude: 2.19, country: 'Espanya', admin1: 'Catalunya' });
    });

    it('amb les fletxes es passa dels favorits als recents, i Enter obre el recent', () => {
        favorites = [girona];
        recents = [vielha];
        render(<Header />);
        const box = searchBox();
        fireEvent.focus(box);
        fireEvent.keyDown(box, { key: 'ArrowDown' }); // Girona (favorit)
        fireEvent.keyDown(box, { key: 'ArrowDown' }); // Vielha (recent)
        fireEvent.submit(box.closest('form')!);
        expect(fetchWeatherByCoords).toHaveBeenCalledWith(42.7, 0.8, 'Vielha', 'Espanya');
        expect(addRecent).toHaveBeenCalledTimes(1);
    });

    it('en escriure, els recents s\'amaguen', () => {
        recents = [vielha];
        render(<Header />);
        fireEvent.focus(searchBox());
        fireEvent.change(searchBox(), { target: { value: 'Ol' } });
        expect(recentsBlock()).toBeNull();
    });
});
