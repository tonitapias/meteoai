// src/utils/placeLink.test.ts
import { describe, it, expect } from 'vitest';
import {
    approximatePlace, buildPlaceLink, formatCoordsText, googleMapsDirectionsLink, googleMapsLink, hasPlaceParams, placeDisplayName, placeForLink, readPlaceFromSearch,
    roundLinkCoord, writePlaceToSearch, type LoadedPlace
} from './placeLink';
import { isSamePlace } from './geoDistance';

describe('readPlaceFromSearch', () => {
    it("llegeix el lloc d'un enllaç amb nom i país", () => {
        expect(readPlaceFromSearch('?lat=41.98&lon=2.82&nom=Girona&pais=Espanya')).toEqual({
            lat: 41.98, lon: 2.82, name: 'Girona', country: 'Espanya'
        });
    });

    it('el nom i el país són opcionals', () => {
        expect(readPlaceFromSearch('?lat=41.98&lon=2.82')).toEqual({ lat: 41.98, lon: 2.82 });
    });

    it('accepta coordenades negatives, sense decimals i amb coma decimal', () => {
        expect(readPlaceFromSearch('?lat=-33.87&lon=151.21')).toMatchObject({ lat: -33.87, lon: 151.21 });
        expect(readPlaceFromSearch('?lat=0&lon=0')).toMatchObject({ lat: 0, lon: 0 });
        expect(readPlaceFromSearch('?lat=41,98&lon=2,82')).toMatchObject({ lat: 41.98, lon: 2.82 });
        expect(readPlaceFromSearch('?lat=90&lon=-180')).toMatchObject({ lat: 90, lon: -180 });
    });

    it("descodifica el nom de la URL (accents, espais, apòstrofs)", () => {
        expect(readPlaceFromSearch('?lat=42.23&lon=2.29&nom=Sant%20Joan%20de%20les%20Abadesses')?.name).toBe('Sant Joan de les Abadesses');
        expect(readPlaceFromSearch("?lat=41.36&lon=2.1&nom=L'Hospitalet+de+Llobregat")?.name).toBe("L'Hospitalet de Llobregat");
        expect(readPlaceFromSearch('?lat=42.43&lon=1.93&nom=Puigcerd%C3%A0')?.name).toBe('Puigcerdà');
    });

    it.each([
        ['sense lon', '?lat=41.98&nom=Girona'],
        ['sense lat', '?lon=2.82'],
        ['buits', '?lat=&lon='],
        ['text', '?lat=abc&lon=2.82'],
        ['notació científica', '?lat=4e1&lon=2.82'],
        ['hexadecimal', '?lat=0x10&lon=2.82'],
        ['infinit', '?lat=Infinity&lon=2.82'],
        ['lat fora de rang', '?lat=91&lon=2.82'],
        ['lon fora de rang', '?lat=41.98&lon=-180.5'],
        ['dos punts decimals', '?lat=41.9.8&lon=2.82'],
        ['res', ''],
    ])('ignora un enllaç invàlid (%s)', (_cas, search) => {
        expect(readPlaceFromSearch(search)).toBeNull();
    });

    it('neteja el nom: espais, caràcters de control i de direcció del text, longitud', () => {
        expect(readPlaceFromSearch('?lat=1&lon=1&nom=%20%20Olot%0A%0Ade%20dalt%20')?.name).toBe('Olot de dalt');
        expect(readPlaceFromSearch('?lat=1&lon=1&nom=Gir%E2%80%AEona%00')?.name).toBe('Girona');
        expect(Array.from(readPlaceFromSearch(`?lat=1&lon=1&nom=${'a'.repeat(300)}`)?.name ?? '')).toHaveLength(80);
        expect(readPlaceFromSearch('?lat=1&lon=1&nom=%20%E2%80%8B%20')?.name).toBeUndefined();
    });

    it('un nom que només és el marcador "sense nom" del GPS no compta com a nom', () => {
        expect(readPlaceFromSearch('?lat=1&lon=1&nom=Ubicaci%C3%B3%20actual&pais=Local')).toEqual({ lat: 1, lon: 1 });
    });
});

describe('hasPlaceParams', () => {
    it('detecta qualsevol paràmetre de lloc, vàlid o no', () => {
        expect(hasPlaceParams('?lat=abc')).toBe(true);
        expect(hasPlaceParams('?nom=Girona')).toBe(true);
        expect(hasPlaceParams('?utm_source=x')).toBe(false);
        expect(hasPlaceParams('')).toBe(false);
    });
});

describe('roundLinkCoord', () => {
    it('deixa 5 decimals (~1 m) i sense "-0"', () => {
        expect(roundLinkCoord(41.983399)).toBe(41.9834);
        expect(roundLinkCoord(2.8249319)).toBe(2.82493);
        expect(roundLinkCoord(-0.000001)).toBe(0);
        expect(Object.is(roundLinkCoord(-0.000001), -0)).toBe(false);
    });

    it("un lloc del GPS (7 decimals) passa a l'enllaç amb 5 i continua sent el mateix lloc per als favorits", () => {
        // Coordenades reals d'un GPS.
        const worst = { latitude: 41.9831458, longitude: 2.8249319 };
        const rounded = { latitude: roundLinkCoord(worst.latitude), longitude: roundLinkCoord(worst.longitude) };
        expect(isSamePlace(worst, rounded)).toBe(true);
    });
});

describe('writePlaceToSearch', () => {
    it('posa el lloc amb les coordenades arrodonides (la posició exacta del GPS no surt de l\'app)', () => {
        const search = writePlaceToSearch('', { name: 'Girona', country: 'Espanya', latitude: 41.983399, longitude: 2.824930 });
        expect(search).toBe('?lat=41.9834&lon=2.82493&nom=Girona&pais=Espanya');
        expect(readPlaceFromSearch(search)).toEqual({ lat: 41.9834, lon: 2.82493, name: 'Girona', country: 'Espanya' });
    });

    it('substitueix el lloc anterior i conserva els altres paràmetres', () => {
        expect(writePlaceToSearch('?utm_source=x&lat=41.98&lon=2.82&nom=Girona', { name: 'Olot', latitude: 42.18, longitude: 2.49 }))
            .toBe('?utm_source=x&lat=42.18&lon=2.49&nom=Olot');
    });

    it('sense lloc, treu només els paràmetres de lloc', () => {
        expect(writePlaceToSearch('?lat=abc&utm_source=x&nom=', null)).toBe('?utm_source=x');
        expect(writePlaceToSearch('?lat=abc', null)).toBe('');
    });

    it('no hi posa els marcadors "sense nom" ni el país de reserva', () => {
        expect(writePlaceToSearch('', { name: 'Ubicació actual', country: 'Local', latitude: 41.39, longitude: 2.17 }))
            .toBe('?lat=41.39&lon=2.17');
        expect(writePlaceToSearch('', { name: 'La Meva Ubicació', latitude: 41.39, longitude: 2.17 }))
            .toBe('?lat=41.39&lon=2.17');
    });

    it('codifica els noms amb espais, accents i "&" sense trencar la URL', () => {
        const search = writePlaceToSearch('', { name: 'Vilanova i la Geltrú & Cubelles', latitude: 41.22, longitude: 1.73 });
        expect(readPlaceFromSearch(search)?.name).toBe('Vilanova i la Geltrú & Cubelles');
    });
});

describe('buildPlaceLink', () => {
    it("fa l'enllaç amb l'adreça de l'app, sense el hash d'un modal ni altres paràmetres", () => {
        const link = buildPlaceLink(
            'https://tonitapias.github.io/meteoai/?utm_source=x&lat=1&lon=1#modal-trendChart',
            { name: 'Puigcerdà', country: 'Espanya', latitude: 42.4317, longitude: 1.9281 }
        );
        expect(link).toBe('https://tonitapias.github.io/meteoai/?lat=42.4317&lon=1.9281&nom=Puigcerd%C3%A0&pais=Espanya');
    });

    it('sense coordenades no hi ha enllaç', () => {
        expect(buildPlaceLink('https://tonitapias.github.io/meteoai/', { name: 'Girona' })).toBeNull();
    });
});

describe('placeDisplayName', () => {
    it('el nom del lloc, o res si és un marcador "sense nom"', () => {
        expect(placeDisplayName({ name: ' Girona ' })).toBe('Girona');
        expect(placeDisplayName({ name: 'Ubicació desconeguda' })).toBeUndefined();
        expect(placeDisplayName({})).toBeUndefined();
    });
});

describe('placeForLink', () => {
    const GPS: LoadedPlace = { lat: 41.9831458, lon: 2.8249319, name: 'La Meva Ubicació', origin: 'gps' };

    it('fa servir les coordenades demanades (el GPS tal qual), no les de les dades a pantalla', () => {
        // Un paquet de la cau desat per a un punt a uns metres (la clau és de 4 decimals).
        const shown = { name: 'Girona', country: 'Espanya', latitude: 41.98309, longitude: 2.82488 };
        expect(placeForLink(GPS, shown, false)).toEqual({
            latitude: 41.9831458, longitude: 2.8249319, name: 'Girona', country: 'Espanya', origin: 'gps'
        });
    });

    it("amb una previsió desada d'un altre punt, ni les coordenades ni el nom són els d'aquell punt", () => {
        const elsewhere = { name: 'Salt', country: 'Espanya', latitude: 41.97, longitude: 2.79 };
        // GPS: el nom demanat és el marcador, així que l'enllaç no en porta (qui l'obre en fa la geocodificació).
        expect(placeForLink(GPS, elsewhere, true)).toEqual({
            latitude: 41.9831458, longitude: 2.8249319, name: undefined, country: undefined, origin: 'gps'
        });
        // Un lloc cercat conserva el nom que s'ha demanat.
        const searched: LoadedPlace = { lat: 41.98311, lon: 2.82485, name: 'Girona', country: 'Espanya', origin: 'consulted' };
        expect(placeForLink(searched, elsewhere, true)).toMatchObject({ latitude: 41.98311, name: 'Girona', origin: 'consulted' });
    });

    it('sense lloc demanat, el de les dades com a lloc consultat; sense res, null', () => {
        expect(placeForLink(null, { name: 'Olot', latitude: 42.18, longitude: 2.49 }, false))
            .toEqual({ name: 'Olot', latitude: 42.18, longitude: 2.49, origin: 'consulted' });
        expect(placeForLink(null, null, false)).toBeNull();
    });
});

describe('formatCoordsText i googleMapsLink', () => {
    it('5 decimals i punt decimal, sense espais als negatius', () => {
        expect(formatCoordsText(41.9831458, 2.8249319)).toBe('41.98315, 2.82493');
        expect(formatCoordsText(-33.8688197, -70.6)).toBe('-33.86882, -70.60000');
        expect(googleMapsLink(41.9831458, 2.8249319)).toBe('https://www.google.com/maps/search/?api=1&query=41.98315,2.82493');
        expect(googleMapsLink(-33.8688197, 151.2092955)).toBe('https://www.google.com/maps/search/?api=1&query=-33.86882,151.20930');
    });

    it('sense "-0" a prop de l\'equador o de Greenwich', () => {
        expect(formatCoordsText(-0.000001, -0.000004)).toBe('0.00000, 0.00000');
    });
});

describe('origen=gps (posició compartida)', () => {
    it("es llegeix de l'enllaç; qualsevol altre valor no compta", () => {
        expect(readPlaceFromSearch('?lat=41.98315&lon=2.82493&origen=gps')).toEqual({ lat: 41.98315, lon: 2.82493, sharedPosition: true });
        expect(readPlaceFromSearch('?lat=41.98315&lon=2.82493&origen=altre')).toEqual({ lat: 41.98315, lon: 2.82493 });
    });

    it("l'enllaç per compartir el porta amb una posició (la meva o una de rebuda), no amb un lloc consultat", () => {
        const base = { name: 'Girona', latitude: 41.9831458, longitude: 2.8249319 };
        const href = 'https://tonitapias.github.io/meteoai/';
        expect(buildPlaceLink(href, { ...base, origin: 'gps' })).toBe(`${href}?lat=41.98315&lon=2.82493&nom=Girona&origen=gps`);
        expect(buildPlaceLink(href, { ...base, origin: 'sharedPosition' })).toBe(`${href}?lat=41.98315&lon=2.82493&nom=Girona&origen=gps`);
        expect(buildPlaceLink(href, { ...base, origin: 'consulted' })).toBe(`${href}?lat=41.98315&lon=2.82493&nom=Girona`);
    });

    it('sense lloc, writePlaceToSearch també treu origen', () => {
        expect(writePlaceToSearch('?lat=1&lon=1&origen=gps&utm_source=x', null)).toBe('?utm_source=x');
    });

    it('com arribar-hi amb Google Maps: 5 decimals i punt', () => {
        expect(googleMapsDirectionsLink(41.9831458, -2.8249319)).toBe('https://www.google.com/maps/dir/?api=1&destination=41.98315,-2.82493');
    });

    it("placeForLink conserva l'origen de posició rebuda", () => {
        const received: LoadedPlace = { lat: 41.98315, lon: 2.82493, name: 'Girona', origin: 'sharedPosition' };
        expect(placeForLink(received, { name: 'Girona', latitude: 41.98315, longitude: 2.82493 }, false)?.origin).toBe('sharedPosition');
    });
});

describe('approximatePlace ("només el temps d\'aquí")', () => {
    it('la posició del GPS a ~1 km i com a lloc consultat', () => {
        expect(approximatePlace({ name: 'Girona', country: 'Espanya', latitude: 41.9831458, longitude: -2.8249319, origin: 'gps' }))
            .toEqual({ name: 'Girona', country: 'Espanya', latitude: 41.98, longitude: -2.82, origin: 'consulted' });
    });
});
