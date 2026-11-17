import { describe, it, expect } from 'vitest';
import { MAPBOX_UI_STRINGS, mapboxUiStrings } from './mapboxLocale';

// Auditoria d'UX, segona volta (A4): al radar, els controls de Mapbox deien «Zoom in», «Zoom out» i «Location not
// available» en tots els idiomes.
describe('Textos dels controls de Mapbox', () => {
    it('els quatre idiomes tenen les mateixes claus, totes amb text', () => {
        const keys = Object.keys(MAPBOX_UI_STRINGS.ca).sort();
        for (const lang of ['es', 'en', 'fr'] as const) {
            expect(Object.keys(MAPBOX_UI_STRINGS[lang]).sort(), lang).toEqual(keys);
        }
        for (const strings of Object.values(MAPBOX_UI_STRINGS)) {
            for (const text of Object.values(strings)) expect(text.trim()).not.toBe('');
        }
    });

    it('hi són els controls que fa servir el radar', () => {
        for (const key of ['NavigationControl.ZoomIn', 'NavigationControl.ZoomOut', 'GeolocateControl.FindMyLocation',
            'GeolocateControl.LocationNotAvailable', 'Map.Title', 'LogoControl.Title']) {
            expect(MAPBOX_UI_STRINGS.ca).toHaveProperty(key);
        }
    });

    it("en català, castellà i francès no queda res en anglès", () => {
        expect(mapboxUiStrings('ca')['NavigationControl.ZoomIn']).toBe('Apropa');
        expect(mapboxUiStrings('es')['GeolocateControl.LocationNotAvailable']).toBe('Ubicación no disponible');
        expect(mapboxUiStrings('fr')['NavigationControl.ZoomOut']).toBe('Zoom arrière');
        const english = new Set(Object.values(MAPBOX_UI_STRINGS.en));
        for (const lang of ['ca', 'es', 'fr'] as const) {
            for (const text of Object.values(MAPBOX_UI_STRINGS[lang])) {
                // «Mapa» és igual en català i en castellà; cap text no pot ser l'anglès de Mapbox.
                expect(english.has(text), `${lang}: ${text}`).toBe(false);
            }
        }
    });

    it('un idioma desconegut fa servir el català', () => {
        expect(mapboxUiStrings('de')).toBe(MAPBOX_UI_STRINGS.ca);
    });
});
