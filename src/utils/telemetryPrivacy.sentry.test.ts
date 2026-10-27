// src/utils/telemetryPrivacy.sentry.test.ts
// Amb el client real de Sentry i les mateixes peces que main.tsx: el que surt cap a Sentry porta les coordenades a
// 2 decimals i l'adreça de l'app sense el lloc, mentre que la URL real i l'enllaç per compartir conserven els 5 decimals.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as Sentry from '@sentry/react';
import { createSentryPrivacy } from './telemetryPrivacy';
import { buildPlaceLink, type SharedPlace } from './placeLink';
import { buildShareMessage } from './shareMessage';
import { TRANSLATIONS } from '../translations';

const sent: unknown[] = [];
const MY_POSITION: SharedPlace = { name: 'Girona', country: 'Espanya', latitude: 41.9831458, longitude: 2.8249319, origin: 'gps' };

/**
 * Un número que comença just aquí (no és la cua d'un altre): les hores de l'esdeveniment i de les molles de pa són
 * segons amb decimals ("1793132642.822") i, sense això, de tant en tant hi apareixia "2.822" i la prova fallava.
 */
const standalone = (pattern: string) => new RegExp(`(?<![\\d.])${pattern}`);

describe('Sentry amb el filtre de privadesa', () => {
    beforeAll(() => {
        window.history.replaceState(null, '', '/meteoai/');
        const privacy = createSentryPrivacy({ appOrigin: window.location.origin, appBase: '/meteoai/' });
        Sentry.init({
            dsn: 'https://public@o0.ingest.sentry.io/0',
            integrations: [privacy.integration],
            beforeBreadcrumb: privacy.beforeBreadcrumb,
            // Res no surt de la màquina: el transport només desa el que s'enviaria.
            transport: () => ({
                send: async (envelope) => { sent.push(envelope); return {}; },
                flush: async () => true
            })
        });
    });

    afterAll(async () => {
        await Sentry.close();
        window.history.replaceState(null, '', '/meteoai/');
    });

    it("un error amb la meva posició a pantalla: a Sentry, ~1 km; l'enllaç i la URL, 5 decimals", async () => {
        // La URL segueix el lloc (usePlaceLink): una navegació que el SDK apunta com a molla de pa.
        window.history.replaceState(null, '', '/meteoai/?lat=41.98315&lon=2.82493&nom=Girona&pais=Espanya');

        Sentry.captureException(new Error('Error de previsió'), {
            extra: { lat: 41.9831458, lon: 2.8249319, full_url: 'https://api.open-meteo.com/v1/forecast?latitude=41.9831458&longitude=2.8249319' }
        });
        await Sentry.flush(2000);

        const payload = JSON.stringify(sent);
        expect(payload).toContain('Error de previsió');
        expect(payload).toMatch(standalone('41\\.98(?!\\d)'));
        expect(payload).not.toMatch(standalone('41\\.98\\d')); // cap coordenada amb més de 2 decimals
        expect(payload).not.toMatch(standalone('2\\.82\\d'));
        expect(payload).not.toContain('Girona');

        // La còpia neta no toca res de l'app.
        expect(window.location.search).toBe('?lat=41.98315&lon=2.82493&nom=Girona&pais=Espanya');
        const link = buildPlaceLink(window.location.href, MY_POSITION);
        expect(link).toContain('lat=41.98315&lon=2.82493');
        expect(buildShareMessage(MY_POSITION, link!, TRANSLATIONS.ca.share).text).toContain('La meva posició: 41.98315, 2.82493');
    });
});
