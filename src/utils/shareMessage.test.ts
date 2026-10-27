// src/utils/shareMessage.test.ts
import { describe, it, expect } from 'vitest';
import { buildShareMessage } from './shareMessage';
import { TRANSLATIONS } from '../translations';

const URL_APP = 'https://tonitapias.github.io/meteoai/?lat=41.98315&lon=2.82493';

describe('buildShareMessage', () => {
    it("l'enllaç de Google Maps només surt amb la meva posició (GPS)", () => {
        const gps = buildShareMessage({ latitude: 41.9831458, longitude: 2.8249319, origin: 'gps' }, URL_APP, TRANSLATIONS.ca.share);
        const consulted = buildShareMessage({ name: 'Girona', latitude: 41.9831458, longitude: 2.8249319, origin: 'consulted' }, URL_APP, TRANSLATIONS.ca.share);

        expect(gps.text).toContain('https://www.google.com/maps/search/?api=1&query=41.98315,2.82493');
        expect(consulted.text).not.toContain('google.com/maps');
        expect(consulted.text).not.toContain('41.98315');
    });

    it('la meva posició sense nom trobat: les coordenades, sense parèntesis buits', () => {
        const { text } = buildShareMessage({ latitude: 41.9831458, longitude: 2.8249319, origin: 'gps' }, URL_APP, TRANSLATIONS.ca.share);
        expect(text.split('\n')[0]).toBe('La meva posició: 41.98315, 2.82493');
    });

    it('al porta-retalls: el missatge sencer amb la posició; només l\'enllaç amb un lloc consultat', () => {
        const gps = buildShareMessage({ name: 'Girona', latitude: 41.9831458, longitude: 2.8249319, origin: 'gps' }, URL_APP, TRANSLATIONS.en.share);
        expect(gps.clipboardText).toBe(`${gps.text}\n${URL_APP}`);
        expect(gps.clipboardText).toContain('My location: 41.98315, 2.82493 (Girona)');

        const consulted = buildShareMessage({ name: 'Girona', latitude: 41.98, longitude: 2.82, origin: 'consulted' }, URL_APP, TRANSLATIONS.en.share);
        expect(consulted.clipboardText).toBeUndefined();
    });

    it('un lloc consultat sense nom es diu per les coordenades', () => {
        const { title } = buildShareMessage({ latitude: 41.98, longitude: 2.82, origin: 'consulted' }, URL_APP, TRANSLATIONS.ca.share);
        expect(title).toBe('El temps a 41.98000, 2.82000');
    });

    it('un nom amb "$&" es copia tal qual (no és un patró de substitució)', () => {
        const { title } = buildShareMessage({ name: 'A$&B', latitude: 1, longitude: 1, origin: 'consulted' }, URL_APP, TRANSLATIONS.ca.share);
        expect(title).toBe('El temps a A$&B');
    });
});

describe('buildShareMessage: reenviar una posició rebuda', () => {
    it('diu "Posició compartida" (no és la de qui la reenvia), amb coordenades i mapa', () => {
        const msg = buildShareMessage({ name: 'Girona', latitude: 41.98315, longitude: 2.82493, origin: 'sharedPosition' }, URL_APP, TRANSLATIONS.ca.share);
        expect(msg.title).toBe('Posició compartida');
        expect(msg.text.split('\n')).toEqual([
            'Posició compartida: 41.98315, 2.82493 (Girona)',
            'https://www.google.com/maps/search/?api=1&query=41.98315,2.82493',
            'El temps aquí, a MeteoToni AI:'
        ]);
        expect(msg.clipboardText).toBe(`${msg.text}\n${URL_APP}`);
    });
});
