// src/utils/addressMove.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
    applyMovePayload, buildMoveLink, cleanFavorites, importMovedData, MOVE_FRAGMENT, NEW_ADDRESS,
    shouldShowMoveNotice, takeMovedHere
} from './addressMove';

const GIRONA = { name: 'Girona', latitude: 41.98315, longitude: 2.82493, country: 'Espanya', admin1: 'Catalunya' };
const VIC = { name: 'Vic', latitude: 41.9301, longitude: 2.2549 };

const favoritesHere = () => JSON.parse(localStorage.getItem('meteoai_favorites') ?? '[]');
const payloadOf = (link: string) => JSON.parse(decodeURIComponent(link.slice(link.indexOf(MOVE_FRAGMENT) + MOVE_FRAGMENT.length)));
const openWithFragment = (fragment: string, path = '/') => window.history.replaceState(null, '', `${path}${fragment}`);

beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    takeMovedHere();
});

describe("buildMoveLink (a l'adreça antiga)", () => {
    it("porta els favorits, les preferències i els secrets d'aquest navegador a l'adreça nova", () => {
        localStorage.setItem('meteoai_favorites', JSON.stringify([GIRONA, VIC]));
        localStorage.setItem('meteoai_lang', 'es');
        localStorage.setItem('meteoai_unit', 'F');
        localStorage.setItem('meteoai_view_mode', 'expert');
        localStorage.setItem('meteoai_secrets_found', JSON.stringify(['earth']));
        localStorage.setItem('meteoai_v7_cache_x', 'no ha de viatjar');

        const link = buildMoveLink();
        expect(link.startsWith(`${NEW_ADDRESS}${MOVE_FRAGMENT}`)).toBe(true);
        expect(payloadOf(link)).toEqual({ v: 1, fav: [GIRONA, VIC], lang: 'es', unit: 'F', view: 'expert', secrets: ['earth'] });
    });

    it('sense res desat, un enllaç que només diu la versió', () => {
        expect(payloadOf(buildMoveLink())).toEqual({ v: 1 });
    });
});

describe("applyMovePayload (a l'adreça nova)", () => {
    it('desa els favorits i les preferències que porta', () => {
        applyMovePayload({ v: 1, fav: [GIRONA], lang: 'fr', unit: 'F', view: 'expert', hint: 'compact', menu: '1', secrets: ['sky'] });
        expect(favoritesHere()).toEqual([GIRONA]);
        expect(localStorage.getItem('meteoai_lang')).toBe('fr');
        expect(localStorage.getItem('meteoai_unit')).toBe('F');
        expect(localStorage.getItem('meteoai_view_mode')).toBe('expert');
        expect(localStorage.getItem('meteoai_detail_hint')).toBe('compact');
        expect(localStorage.getItem('meteoai_view_menu_seen')).toBe('1');
        expect(JSON.parse(localStorage.getItem('meteoai_secrets_found')!)).toEqual(['sky']);
    });

    it("els favorits se sumen als d'aquí sense repetir lloc, i els secrets també", () => {
        localStorage.setItem('meteoai_favorites', JSON.stringify([VIC]));
        localStorage.setItem('meteoai_secrets_found', JSON.stringify(['earth']));
        applyMovePayload({ v: 1, fav: [{ ...VIC, latitude: 41.9302 }, GIRONA], secrets: ['sky'] });
        expect(favoritesHere()).toEqual([VIC, GIRONA]);
        expect(JSON.parse(localStorage.getItem('meteoai_secrets_found')!)).toEqual(['sky', 'earth']);
    });

    it("un enllaç fabricat no hi posa res que l'app no entengui", () => {
        localStorage.setItem('meteoai_lang', 'ca');
        applyMovePayload({
            v: 1,
            fav: [{ name: 'Sense coordenades' }, { name: 'Fora', latitude: 120, longitude: 2 }, { name: 'x'.repeat(500), latitude: 1, longitude: 1 },
                'text', null, { ...GIRONA, extra: '<script>' }],
            lang: 'de', unit: 'K', view: 'admin', hint: true, secrets: ['moon', 42]
        });
        expect(favoritesHere()).toEqual([GIRONA]);
        expect(localStorage.getItem('meteoai_lang')).toBe('ca');
        expect(localStorage.getItem('meteoai_unit')).toBeNull();
        expect(localStorage.getItem('meteoai_view_mode')).toBeNull();
        expect(localStorage.getItem('meteoai_detail_hint')).toBeNull();
        expect(localStorage.getItem('meteoai_secrets_found')).toBeNull();
    });

    it('com a molt 50 favorits per enllaç', () => {
        const many = Array.from({ length: 80 }, (_, i) => ({ name: `Lloc ${i}`, latitude: i, longitude: i }));
        expect(cleanFavorites(many)).toHaveLength(50);
    });
});

describe("importMovedData (arrencada a l'adreça nova)", () => {
    it("desa el que porta l'enllaç, el treu de l'adreça (amb el lloc de la cerca intacte) i ho diu un sol cop", () => {
        localStorage.setItem('meteoai_favorites', JSON.stringify([GIRONA]));
        const link = buildMoveLink();
        localStorage.clear();

        openWithFragment(link.slice(link.indexOf('#')), '/?lat=41.98&lon=2.82');
        expect(importMovedData()).toBe(true);
        expect(favoritesHere()).toEqual([GIRONA]);
        expect(window.location.hash).toBe('');
        expect(window.location.search).toBe('?lat=41.98&lon=2.82');
        expect(takeMovedHere()).toBe(true);
        expect(takeMovedHere()).toBe(false);
    });

    it("un fragment il·legible també es treu de l'adreça, sense tocar res", () => {
        openWithFragment(`${MOVE_FRAGMENT}%E0%A4%A`);
        expect(importMovedData()).toBe(false);
        expect(window.location.hash).toBe('');
        expect(localStorage.length).toBe(0);
        expect(takeMovedHere()).toBe(false);
    });

    it('sense #migra= no fa res (el hash dels modals no es toca)', () => {
        openWithFragment('#modal-trendChart');
        expect(importMovedData()).toBe(false);
        expect(window.location.hash).toBe('#modal-trendChart');
    });
});

describe('shouldShowMoveNotice', () => {
    const OLD = 'tonitapias.github.io';

    it("a l'adreça antiga, mentre es prova, només amb ?pont=1", () => {
        expect(shouldShowMoveNotice({ hostname: OLD, search: '' }, false)).toBe(false);
        expect(shouldShowMoveNotice({ hostname: OLD, search: '?lat=1&lon=2&pont=1' }, false)).toBe(true);
    });

    it("un cop activat, a l'adreça antiga per a tothom", () => {
        expect(shouldShowMoveNotice({ hostname: OLD, search: '' }, true)).toBe(true);
    });

    it("mai a l'adreça nova ni en local", () => {
        expect(shouldShowMoveNotice({ hostname: 'meteotoniai.com', search: '?pont=1' }, true)).toBe(false);
        expect(shouldShowMoveNotice({ hostname: 'localhost', search: '?pont=1' }, true)).toBe(false);
    });
});
