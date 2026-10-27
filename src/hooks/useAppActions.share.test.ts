// src/hooks/useAppActions.share.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppActions } from './useAppActions';
import { TRANSLATIONS, type Language } from '../translations';
import type { SharedPlace } from '../utils/placeLink';

// La posició del GPS tal com arriba (7 decimals), amb el nom de la geocodificació inversa.
const MY_POSITION: SharedPlace = { name: 'Girona', country: 'Espanya', latitude: 41.9831458, longitude: 2.8249319, origin: 'gps' };
// Un favorit a 300 m d'aquesta posició: és un lloc consultat, no "la meva posició".
const NEARBY_FAVORITE: SharedPlace = { name: 'Girona', country: 'Espanya', latitude: 41.98583, longitude: 2.82396, origin: 'consulted' };
const RECEIVED_POSITION: SharedPlace = { name: 'Girona', country: 'Espanya', latitude: 41.98315, longitude: 2.82493, origin: 'sharedPosition' };

const APP_LINK = (search: string) => `${window.location.origin}/meteoai/${search}`;
const MY_POSITION_LINK = APP_LINK('?lat=41.98315&lon=2.82493&nom=Girona&pais=Espanya&origen=gps');

const setup = (sharedPlace: SharedPlace | null, lang: Language = 'ca') => {
    const setNotification = vi.fn();
    const openShareSheet = vi.fn();
    const { result } = renderHook(() => useAppActions({
        t: TRANSLATIONS[lang],
        getCoordinates: vi.fn(),
        fetchWeatherByCoords: vi.fn(),
        setNotification,
        weatherData: null,
        sharedPlace,
        openShareSheet,
        isFavorite: () => false,
        addFavorite: vi.fn(),
        removeFavorite: vi.fn()
    }));
    return { actions: result.current, setNotification, openShareSheet };
};

const defineNavigator = (key: 'share' | 'clipboard', value: unknown) =>
    Object.defineProperty(window.navigator, key, { value, configurable: true, writable: true });

describe('useAppActions: botó Compartir', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/meteoai/?lat=41.98&lon=2.82&nom=Girona#modal-trendChart');
    });

    afterEach(() => {
        Reflect.deleteProperty(window.navigator, 'share');
        Reflect.deleteProperty(window.navigator, 'clipboard');
        window.history.replaceState(null, '', '/meteoai/');
    });

    it('amb la meva posició (GPS) no comparteix encara: obre la finestra "Què vols compartir?"', async () => {
        const share = vi.fn();
        defineNavigator('share', share);
        const { actions, openShareSheet } = setup(MY_POSITION);

        await act(() => actions.handleSharePlace());

        expect(openShareSheet).toHaveBeenCalledTimes(1);
        expect(share).not.toHaveBeenCalled();
    });

    it('un lloc consultat (un favorit a tocar de la meva posició): directament, sense finestra ni coordenades', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        defineNavigator('share', share);
        const { actions, openShareSheet } = setup(NEARBY_FAVORITE);

        await act(() => actions.handleSharePlace());

        expect(openShareSheet).not.toHaveBeenCalled();
        expect(share).toHaveBeenCalledWith({
            title: 'El temps a Girona',
            text: 'Mira el temps a Girona amb MeteoToni AI',
            url: APP_LINK('?lat=41.98583&lon=2.82396&nom=Girona&pais=Espanya')
        });
    });

    it('una posició rebuda es reenvia directament, com a "Posició compartida"', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        defineNavigator('share', share);
        const { actions, openShareSheet } = setup(RECEIVED_POSITION);

        await act(() => actions.handleSharePlace());

        expect(openShareSheet).not.toHaveBeenCalled();
        expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Posició compartida' }));
    });

    it("sense navigator.share, un lloc consultat copia l'enllaç i avisa amb el Toast", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        defineNavigator('clipboard', { writeText });
        const { actions, setNotification } = setup(NEARBY_FAVORITE, 'en');

        await act(() => actions.handleSharePlace());

        expect(writeText).toHaveBeenCalledWith(APP_LINK('?lat=41.98583&lon=2.82396&nom=Girona&pais=Espanya'));
        expect(setNotification).toHaveBeenCalledWith({ type: 'success', msg: 'Link copied to clipboard' });
    });

    it('sense cap lloc a pantalla no fa res', async () => {
        const share = vi.fn();
        defineNavigator('share', share);
        const { actions, openShareSheet } = setup(null);
        await act(() => actions.handleSharePlace());
        expect(share).not.toHaveBeenCalled();
        expect(openShareSheet).not.toHaveBeenCalled();
    });
});

describe('useAppActions: opcions de la finestra "Què vols compartir?"', () => {
    afterEach(() => {
        Reflect.deleteProperty(window.navigator, 'share');
        Reflect.deleteProperty(window.navigator, 'clipboard');
        Reflect.deleteProperty(document, 'execCommand');
        window.history.replaceState(null, '', '/meteoai/');
    });

    it('"Comparteix la meva posició": coordenades del GPS a 5 decimals i enllaç de Google Maps', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        defineNavigator('share', share);
        const { actions, setNotification } = setup(MY_POSITION);

        let result: unknown;
        await act(async () => { result = await actions.shareMyPosition(); });

        expect(result).toBe('shared');
        expect(share).toHaveBeenCalledWith({
            title: 'La meva posició',
            text: [
                'La meva posició: 41.98315, 2.82493 (Girona)',
                'https://www.google.com/maps/search/?api=1&query=41.98315,2.82493',
                'El temps aquí, a MeteoToni AI:'
            ].join('\n'),
            url: MY_POSITION_LINK
        });
        // El full del sistema ja fa de resposta: cap avís.
        expect(setNotification).not.toHaveBeenCalled();
    });

    it('"Comparteix només el temps de Girona": el lloc a ~1 km, com a lloc consultat (sense origen=gps ni mapa)', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        defineNavigator('share', share);
        const { actions } = setup(MY_POSITION);

        await act(async () => { await actions.shareWeatherOnly(); });

        expect(share).toHaveBeenCalledWith({
            title: 'El temps a Girona',
            text: 'Mira el temps a Girona amb MeteoToni AI',
            url: APP_LINK('?lat=41.98&lon=2.82&nom=Girona&pais=Espanya')
        });
    });

    it('"Copia les coordenades": les copia tal qual (5 decimals, punt) i avisa', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        defineNavigator('clipboard', { writeText });
        const { actions, setNotification } = setup(MY_POSITION, 'fr');

        let ok: unknown;
        await act(async () => { ok = await actions.copyCoordinates(); });

        expect(ok).toBe(true);
        expect(writeText).toHaveBeenCalledWith('41.98315, 2.82493');
        expect(setNotification).toHaveBeenCalledWith({ type: 'success', msg: 'Coordonnées copiées dans le presse-papiers' });
    });

    it('sense navigator.share, la meva posició copia el missatge sencer (coordenades, mapa i enllaç)', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        defineNavigator('clipboard', { writeText });
        const { actions, setNotification } = setup(MY_POSITION);

        await act(async () => { await actions.shareMyPosition(); });

        expect(writeText).toHaveBeenCalledWith([
            'La meva posició: 41.98315, 2.82493 (Girona)',
            'https://www.google.com/maps/search/?api=1&query=41.98315,2.82493',
            'El temps aquí, a MeteoToni AI:',
            MY_POSITION_LINK
        ].join('\n'));
        expect(setNotification).toHaveBeenCalledWith({ type: 'success', msg: 'Posició copiada al porta-retalls' });
    });

    it("si l'usuari tanca el full de compartir: cap avís, i ho diu perquè la finestra es quedi oberta", async () => {
        defineNavigator('share', vi.fn().mockRejectedValue(Object.assign(new Error('abort'), { name: 'AbortError' })));
        const { actions, setNotification } = setup(MY_POSITION);

        let result: unknown;
        await act(async () => { result = await actions.shareMyPosition(); });

        expect(result).toBe('cancelled');
        expect(setNotification).not.toHaveBeenCalled();
    });

    it('si no es pot copiar, ho diu', async () => {
        defineNavigator('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
        Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
        const { actions, setNotification } = setup(MY_POSITION);

        let ok: unknown;
        await act(async () => { ok = await actions.copyCoordinates(); });

        expect(ok).toBe(false);
        expect(setNotification).toHaveBeenCalledWith({ type: 'error', msg: "No s'ha pogut copiar l'enllaç" });
    });

    it("els textos de la finestra hi són als 4 idiomes", () => {
        for (const lang of ['ca', 'es', 'fr', 'en'] as const) {
            const s = TRANSLATIONS[lang].share;
            for (const key of ['sheetTitle', 'sharePosition', 'shareWeatherOnly', 'shareWeatherOnlyHere', 'copyCoords', 'coordsCopied'] as const) {
                expect(s[key], `${lang}.${key}`).toBeTruthy();
            }
            expect(s.shareWeatherOnly).toContain('{place}');
        }
    });
});

describe('useAppActions.handleGetCurrentLocation', () => {
    it("carrega la posició del GPS tal qual i la marca com a 'gps' (la meva posició)", async () => {
        const fetchWeatherByCoords = vi.fn().mockResolvedValue({ success: true });
        const { result } = renderHook(() => useAppActions({
            t: TRANSLATIONS.ca,
            getCoordinates: vi.fn().mockResolvedValue({ lat: 41.9831458, lon: 2.8249319, name: 'La Meva Ubicació' }),
            fetchWeatherByCoords,
            setNotification: vi.fn(),
            weatherData: null,
            sharedPlace: null,
            openShareSheet: vi.fn(),
            isFavorite: () => false,
            addFavorite: vi.fn(),
            removeFavorite: vi.fn()
        }));

        await act(async () => { await result.current.handleGetCurrentLocation(); });

        expect(fetchWeatherByCoords).toHaveBeenCalledWith(41.9831458, 2.8249319, 'La Meva Ubicació', undefined, 'gps');
    });
});
