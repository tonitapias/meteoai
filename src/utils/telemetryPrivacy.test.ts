// src/utils/telemetryPrivacy.test.ts
import { describe, it, expect } from 'vitest';
import { scrubTelemetry, scrubText, scrubUrl, type TelemetryPrivacyContext } from './telemetryPrivacy';

const ctx: TelemetryPrivacyContext = { appOrigin: 'https://tonitapias.github.io', appBase: '/meteoai/' };

describe('scrubUrl', () => {
    it("l'adreça de l'app hi va sense el lloc (conserva la resta i el hash del modal)", () => {
        expect(scrubUrl('https://tonitapias.github.io/meteoai/?lat=41.98315&lon=2.82493&nom=Girona&pais=Espanya&origen=gps&utm_source=x#modal-trendChart', ctx))
            .toBe('https://tonitapias.github.io/meteoai/?utm_source=x#modal-trendChart');
        expect(scrubUrl('https://tonitapias.github.io/meteoai/?lat=41.98315&lon=2.82493', ctx)).toBe('https://tonitapias.github.io/meteoai/');
    });

    it("les navegacions (adreces relatives de l'app) també", () => {
        expect(scrubUrl('/meteoai/?lat=41.98315&lon=2.82493&nom=Girona#modal-trendChart', ctx)).toBe('/meteoai/#modal-trendChart');
    });

    it('les peticions de previsió i de nom del lloc: coordenades a 2 decimals, la resta igual', () => {
        expect(scrubUrl('https://api.open-meteo.com/v1/forecast?latitude=41.9831458&longitude=2.8249319&hourly=temperature_2m', ctx))
            .toBe('https://api.open-meteo.com/v1/forecast?latitude=41.98&longitude=2.82&hourly=temperature_2m');
        expect(scrubUrl('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=41.9831458&longitude=-2.8249319&localityLanguage=ca', ctx))
            .toBe('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=41.98&longitude=-2.82&localityLanguage=ca');
    });

    it('els avisos oficials (lat/lon d\'un altre domini, point de NWS) i les llistes de coordenades', () => {
        expect(scrubUrl('https://proxy.example.workers.dev/aemet?lat=41.9831&lon=2.8249&lang=ca', ctx))
            .toBe('https://proxy.example.workers.dev/aemet?lat=41.98&lon=2.82&lang=ca');
        expect(scrubUrl('https://api.weather.gov/alerts/active?point=40.7128,-74.0060', ctx))
            .toBe('https://api.weather.gov/alerts/active?point=40.71%2C-74.01');
        expect(scrubUrl('https://api.open-meteo.com/v1/forecast?latitude=41.98314,42.18104&longitude=2.82493,2.49038', ctx))
            .toBe('https://api.open-meteo.com/v1/forecast?latitude=41.98%2C42.18&longitude=2.82%2C2.49');
    });

    it('un bbox en metres (mostra de llamps) al km', () => {
        expect(scrubUrl('https://view.eumetsat.int/geoserver/wms?request=GetMap&bbox=314459.27,5157240.12,315459.27,5158240.12&width=8', ctx))
            .toBe('https://view.eumetsat.int/geoserver/wms?request=GetMap&bbox=314000%2C5157000%2C315000%2C5158000&width=8');
    });

    it('només la cerca (`http.query` d\'una traça): s\'arrodoneix', () => {
        expect(scrubUrl('?latitude=41.9831458&longitude=2.8249319&models=best_match', ctx)).toBe('?latitude=41.98&longitude=2.82&models=best_match');
    });

    it('enllaços de Google Maps: el punt a 2 decimals; una cerca de text, igual', () => {
        expect(scrubUrl('https://www.google.com/maps/search/?api=1&query=41.98315,2.82493', ctx))
            .toBe('https://www.google.com/maps/search/?api=1&query=41.98%2C2.82');
        expect(scrubUrl('https://www.google.com/maps/search/?api=1&query=Girona', ctx)).toBe('https://www.google.com/maps/search/?api=1&query=Girona');
    });

    it('sense coordenades no toca res', () => {
        const file = 'https://tonitapias.github.io/meteoai/assets/index-DPYwD4W6.js?v=3';
        expect(scrubUrl(file, ctx)).toBe(file);
    });
});

describe('scrubText', () => {
    it("arrodoneix una adreça dins d'un missatge, sense desmuntar-lo", () => {
        expect(scrubText('Timeout fetching https://api.open-meteo.com/v1/forecast?latitude=41.9831458&longitude=2.8249319 (3 intents)'))
            .toBe('Timeout fetching https://api.open-meteo.com/v1/forecast?latitude=41.98&longitude=2.82 (3 intents)');
    });

    it('treu el nom del lloc', () => {
        expect(scrubText('obert /meteoai/?lat=41.98315&lon=2.82493&nom=Girona')).toBe('obert /meteoai/?lat=41.98&lon=2.82');
    });
});

describe('scrubTelemetry', () => {
    it("un error: l'adreça de la pàgina, les dades extra (números i adreces) i les molles de pa", () => {
        const event = {
            message: 'Error de previsió',
            request: { url: 'https://tonitapias.github.io/meteoai/?lat=41.98315&lon=2.82493&nom=Girona', headers: { Referer: 'x' } },
            extra: { lat: 41.9831458, lon: 2.8249319, unit: 'C', full_url: 'https://api.open-meteo.com/v1/forecast?latitude=41.9831458&longitude=2.8249319' },
            breadcrumbs: [
                { category: 'navigation', data: { from: '/meteoai/?lat=42.18104&lon=2.49038&nom=Olot', to: '/meteoai/?lat=41.98315&lon=2.82493&nom=Girona' } },
                { category: 'fetch', data: { method: 'GET', url: 'https://api.open-meteo.com/v1/forecast?latitude=41.9831458&longitude=2.8249319', status_code: 200 } }
            ],
            exception: { values: [{ type: 'Error', value: 'boom', stacktrace: { frames: [{ filename: 'https://tonitapias.github.io/meteoai/assets/index.js', lineno: 10 }] } }] }
        };

        const result = scrubTelemetry(event, ctx);

        expect(result).toBe(event); // in situ: és el mateix esdeveniment el que s'envia
        expect(event.request.url).toBe('https://tonitapias.github.io/meteoai/');
        expect(event.extra).toEqual({ lat: 41.98, lon: 2.82, unit: 'C', full_url: 'https://api.open-meteo.com/v1/forecast?latitude=41.98&longitude=2.82' });
        expect(event.breadcrumbs[0].data).toEqual({ from: '/meteoai/', to: '/meteoai/' });
        expect(event.breadcrumbs[1].data.url).toBe('https://api.open-meteo.com/v1/forecast?latitude=41.98&longitude=2.82');
        expect(event.exception.values[0].stacktrace.frames[0].filename).toBe('https://tonitapias.github.io/meteoai/assets/index.js');
        expect(JSON.stringify(event)).not.toMatch(/41\.98\d|2\.82\d|Girona|Olot/);
    });

    it("una repetició: la llista d'adreces i els esdeveniments de gravació (navegacions i peticions)", () => {
        const replayEvent = { type: 'replay_event', urls: ['https://tonitapias.github.io/meteoai/?lat=41.98315&lon=2.82493&nom=Girona&origen=gps'] };
        const recording = {
            type: 5,
            data: { tag: 'performanceSpan', payload: { op: 'resource.fetch', description: 'https://api.open-meteo.com/v1/forecast?latitude=41.9831458&longitude=2.8249319', data: { statusCode: 200 } } }
        };
        scrubTelemetry(replayEvent, ctx);
        scrubTelemetry(recording, ctx);
        expect(replayEvent.urls).toEqual(['https://tonitapias.github.io/meteoai/']);
        expect(recording.data.payload.description).toBe('https://api.open-meteo.com/v1/forecast?latitude=41.98&longitude=2.82');
    });

    it('una traça: les dades dels spans amb la cerca', () => {
        const transaction = { spans: [{ description: 'GET https://api.open-meteo.com/v1/forecast', data: { 'http.query': '?latitude=41.9831458&longitude=2.8249319', 'http.method': 'GET' } }] };
        scrubTelemetry(transaction, ctx);
        expect(transaction.spans[0].data['http.query']).toBe('?latitude=41.98&longitude=2.82');
    });

    it("no falla mai (si fallés, Sentry enviaria l'error intern sense filtrar) i neteja igualment la resta", () => {
        class ScopeLike {
            get $(): number { return 1; }
            url = 'https://tonitapias.github.io/meteoai/?lat=41.98315&lon=2.82493';
        }
        const readOnly = Object.freeze({ url: '/meteoai/?lat=41.98315&lon=2.82493' });
        const withGetter = Object.defineProperty({}, 'url', { get: () => '/meteoai/?lat=41.98315', enumerable: true });
        const event = {
            // Primer les dades internes, com al SDK: abans d'arribar a `request`.
            sdkProcessingMetadata: { capturedSpanScope: new ScopeLike(), normalizedRequest: { url: 'x?lat=41.98315' } },
            contexts: { frozen: readOnly, getter: withGetter, scope: new ScopeLike() },
            request: { url: 'https://tonitapias.github.io/meteoai/?lat=41.98315&lon=2.82493&nom=Girona' }
        };

        expect(() => scrubTelemetry(event, ctx)).not.toThrow();
        expect(event.request.url).toBe('https://tonitapias.github.io/meteoai/');
    });

    it('no es penja amb referències circulars', () => {
        const a: Record<string, unknown> = { lat: 41.9831458 };
        a.self = a;
        expect(() => scrubTelemetry(a, ctx)).not.toThrow();
        expect(a.lat).toBe(41.98);
    });
});
