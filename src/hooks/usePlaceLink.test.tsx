// src/hooks/usePlaceLink.test.tsx
import { StrictMode, type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { usePlaceLink } from './usePlaceLink';
import type { PlaceOnScreen, PlaceOrigin } from '../utils/placeLink';

const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

const GIRONA: PlaceOnScreen = { name: 'Girona', country: 'Espanya', latitude: 41.983399, longitude: 2.824930 };
const OLOT: PlaceOnScreen = { name: 'Olot', country: 'Espanya', latitude: 42.18096, longitude: 2.49012 };

const goTo = (url: string, state: unknown = null) => window.history.replaceState(state, '', url);
const currentUrl = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

describe('usePlaceLink', () => {
    let fetchWeather: Mock<(lat: number, lon: number, name: string, country?: string) => Promise<unknown>>;

    beforeEach(() => {
        fetchWeather = vi.fn<(lat: number, lon: number, name: string, country?: string) => Promise<unknown>>()
            .mockResolvedValue({ success: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        goTo('/meteoai/');
    });

    it("en obrir un enllaç vàlid, carrega aquell lloc una sola vegada (també amb StrictMode)", () => {
        goTo('/meteoai/?lat=41.9834&lon=2.82493&nom=Girona&pais=Espanya');
        const { result } = renderHook(() => usePlaceLink({ place: null, fetchWeatherByCoords: fetchWeather }), { wrapper: strict });

        expect(fetchWeather).toHaveBeenCalledTimes(1);
        expect(fetchWeather).toHaveBeenCalledWith(41.9834, 2.82493, 'Girona', 'Espanya', 'consulted');
        expect(result.current.openedFromLink).toBe(true);
    });

    it("sense nom, demana la geocodificació inversa (nom buit)", () => {
        goTo('/meteoai/?lat=41.98&lon=2.82');
        renderHook(() => usePlaceLink({ place: null, fetchWeatherByCoords: fetchWeather }));
        expect(fetchWeather).toHaveBeenCalledWith(41.98, 2.82, '', undefined, 'consulted');
    });

    it("amb paràmetres invàlids no carrega res, els treu de la URL i surt la benvinguda", () => {
        goTo('/meteoai/?lat=500&lon=abc&nom=Enlloc&utm_source=x');
        const pushState = vi.spyOn(window.history, 'pushState');
        const { result } = renderHook(() => usePlaceLink({ place: null, fetchWeatherByCoords: fetchWeather }));

        expect(fetchWeather).not.toHaveBeenCalled();
        expect(result.current.openedFromLink).toBe(false);
        expect(currentUrl()).toBe('/meteoai/?utm_source=x');
        expect(pushState).not.toHaveBeenCalled();
    });

    it('sense cap paràmetre, no toca la URL ni carrega res', () => {
        const replaceState = vi.spyOn(window.history, 'replaceState');
        renderHook(() => usePlaceLink({ place: null, fetchWeatherByCoords: fetchWeather }));
        expect(fetchWeather).not.toHaveBeenCalled();
        expect(replaceState).not.toHaveBeenCalled();
    });

    it("mentre l'enllaç carrega (sense lloc a pantalla) la URL es manté: si falla, recarregar torna a provar", () => {
        goTo('/meteoai/?lat=41.98&lon=2.82&nom=Girona');
        renderHook(() => usePlaceLink({ place: null, fetchWeatherByCoords: fetchWeather }));
        expect(currentUrl()).toBe('/meteoai/?lat=41.98&lon=2.82&nom=Girona');
    });

    it('la URL segueix el lloc a pantalla amb replaceState, sense entrades noves a l\'historial', () => {
        const pushState = vi.spyOn(window.history, 'pushState');
        const lengthBefore = window.history.length;
        const { rerender } = renderHook(
            ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
            { initialProps: { place: null as PlaceOnScreen | null } }
        );

        rerender({ place: GIRONA });
        expect(currentUrl()).toBe('/meteoai/?lat=41.9834&lon=2.82493&nom=Girona&pais=Espanya');

        rerender({ place: OLOT });
        expect(currentUrl()).toBe('/meteoai/?lat=42.18096&lon=2.49012&nom=Olot&pais=Espanya');

        expect(pushState).not.toHaveBeenCalled();
        expect(window.history.length).toBe(lengthBefore);
        expect(fetchWeather).not.toHaveBeenCalled();
    });

    it("conserva l'estat i el hash de l'entrada (modals oberts: radar, #modal-…)", () => {
        goTo('/meteoai/#modal-trendChart', { modalId: 'radarLive' });
        const { rerender } = renderHook(
            ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
            { initialProps: { place: null as PlaceOnScreen | null } }
        );

        rerender({ place: GIRONA });
        expect(currentUrl()).toBe('/meteoai/?lat=41.9834&lon=2.82493&nom=Girona&pais=Espanya#modal-trendChart');
        expect(window.history.state).toEqual({ modalId: 'radarLive' });
    });

    it("en tornar enrere a una entrada d'abans d'un canvi de lloc (modal obert), la URL torna a ser la del lloc a pantalla", () => {
        const { rerender } = renderHook(
            ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
            { initialProps: { place: GIRONA } }
        );
        rerender({ place: OLOT });

        // L'entrada de sota (la d'abans d'obrir el modal) encara porta Girona.
        goTo('/meteoai/?lat=41.9834&lon=2.82493&nom=Girona&pais=Espanya', { below: true });
        window.dispatchEvent(new PopStateEvent('popstate'));

        expect(currentUrl()).toBe('/meteoai/?lat=42.18096&lon=2.49012&nom=Olot&pais=Espanya');
        expect(window.history.state).toEqual({ below: true });
    });

    it("un enllaç amb origen=gps s'obre com a posició rebuda, i la barra d'adreces ho conserva", () => {
        goTo('/meteoai/?lat=41.98315&lon=2.82493&nom=Girona&origen=gps');
        const { rerender } = renderHook(
            ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
            { initialProps: { place: null as (PlaceOnScreen & { origin?: PlaceOrigin }) | null } }
        );
        expect(fetchWeather).toHaveBeenCalledWith(41.98315, 2.82493, 'Girona', undefined, 'sharedPosition');

        rerender({ place: { ...GIRONA, latitude: 41.98315, longitude: 2.82493, origin: 'sharedPosition' } });
        expect(currentUrl()).toBe('/meteoai/?lat=41.98315&lon=2.82493&nom=Girona&pais=Espanya&origen=gps');
    });

    it("la meva posició no porta origen=gps a la barra d'adreces (en recarregar no ha de sortir com a compartida)", () => {
        const { rerender } = renderHook(
            ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
            { initialProps: { place: null as (PlaceOnScreen & { origin?: PlaceOrigin }) | null } }
        );
        rerender({ place: { ...GIRONA, origin: 'gps' } });
        expect(currentUrl()).toBe('/meteoai/?lat=41.9834&lon=2.82493&nom=Girona&pais=Espanya');
    });

    it('un origen=gps sense coordenades no val: es treu i surt la benvinguda', () => {
        goTo('/meteoai/?origen=gps');
        const { result } = renderHook(() => usePlaceLink({ place: null, fetchWeatherByCoords: fetchWeather }));
        expect(result.current.openedFromLink).toBe(false);
        expect(currentUrl()).toBe('/meteoai/');
    });

    it('si el lloc no canvia, no torna a escriure la URL', () => {
        const { rerender } = renderHook(
            ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
            { initialProps: { place: GIRONA } }
        );
        const replaceState = vi.spyOn(window.history, 'replaceState');
        rerender({ place: { ...GIRONA } });
        expect(replaceState).not.toHaveBeenCalled();
    });

    describe("tornar a l'inici (clearPlaceLink)", () => {
        it('treu el lloc de la URL (també origen=gps) i conserva la resta, sense entrades noves a l\'historial', () => {
            goTo('/meteoai/?utm_source=x');
            const pushState = vi.spyOn(window.history, 'pushState');
            const lengthBefore = window.history.length;
            const { result, rerender } = renderHook(
                ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
                { initialProps: { place: { ...GIRONA, origin: 'sharedPosition' as PlaceOrigin } as PlaceOnScreen & { origin?: PlaceOrigin } | null } }
            );
            expect(currentUrl()).toBe('/meteoai/?utm_source=x&lat=41.9834&lon=2.82493&nom=Girona&pais=Espanya&origen=gps');

            act(() => { result.current.clearPlaceLink(); });
            rerender({ place: null });

            expect(currentUrl()).toBe('/meteoai/?utm_source=x');
            expect(pushState).not.toHaveBeenCalled();
            expect(window.history.length).toBe(lengthBefore);
        });

        it("obert des d'un enllaç: deixa de comptar com a enllaç carregant (si no, el tauler es quedaria amb l'esquelet)", () => {
            goTo('/meteoai/?lat=41.98315&lon=2.82493&nom=Girona');
            const { result, rerender } = renderHook(
                ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
                { initialProps: { place: null as PlaceOnScreen | null } }
            );
            rerender({ place: GIRONA });
            expect(result.current.openedFromLink).toBe(true);

            act(() => { result.current.clearPlaceLink(); });
            rerender({ place: null });

            expect(result.current.openedFromLink).toBe(false);
            expect(currentUrl()).toBe('/meteoai/');
            expect(fetchWeather).toHaveBeenCalledTimes(1);
        });

        it("amb un enllaç que encara carrega (sense lloc a pantalla) també deixa la URL neta", () => {
            goTo('/meteoai/?lat=41.98&lon=2.82&nom=Girona#modal-x');
            const { result } = renderHook(() => usePlaceLink({ place: null, fetchWeatherByCoords: fetchWeather }));

            act(() => { result.current.clearPlaceLink(); });

            expect(result.current.openedFromLink).toBe(false);
            expect(currentUrl()).toBe('/meteoai/#modal-x');
        });

        it("després, l'enrere (popstate) ja no torna a posar el lloc a la URL", () => {
            const { result, rerender } = renderHook(
                ({ place }) => usePlaceLink({ place, fetchWeatherByCoords: fetchWeather }),
                { initialProps: { place: GIRONA as PlaceOnScreen | null } }
            );
            act(() => { result.current.clearPlaceLink(); });
            rerender({ place: null });

            window.dispatchEvent(new PopStateEvent('popstate'));

            expect(currentUrl()).toBe('/meteoai/');
        });
    });
});
