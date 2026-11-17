import { describe, it, expect, vi, afterEach } from 'vitest';

const fetchWithTimeout = vi.fn();
vi.mock('../utils/networkUtils', () => ({ fetchWithTimeout: (...args: unknown[]) => fetchWithTimeout(...args) }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { getMeteocatAlerts } from './alertsApi';

const respond = (body: unknown) => fetchWithTimeout.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));

const BASE = {
    id: 'meteocat-20-Vent',
    event: 'Vent',
    severity: 'Moderate',
    headline: 'Avís groc al Gironès: ratxa màxima de més de 72 km/h',
    description: 'Servei Meteorològic de Catalunya: Ratxa màxima > 72 km/h (20 m/s).',
    instruction: null,
    senderName: 'Servei Meteorològic de Catalunya',
    expires: '2026-11-17T23:59:00+01:00',
    sourceName: 'Meteocat (Servei Meteorològic de Catalunya)',
    sourceUrl: 'https://www.meteo.cat/avisos',
    textLang: 'ca',
};

describe('Avisos de Meteocat: camps del tram de la comarca (auditoria d\'UX, segona volta, N1)', () => {
    afterEach(() => fetchWithTimeout.mockReset());

    it('passa l\'inici, la comarca, el perill i el llindar del proxy', async () => {
        respond([{ ...BASE, onset: '2026-11-17T18:00:00+01:00', areaName: 'Gironès', dangerLevel: 1, threshold: 'Ratxa màxima > 72 km/h (20 m/s)' }]);
        const [alert] = await getMeteocatAlerts(41.98, 2.82);
        expect(alert).toMatchObject({ onset: '2026-11-17T18:00:00+01:00', areaName: 'Gironès', dangerLevel: 1, threshold: 'Ratxa màxima > 72 km/h (20 m/s)' });
    });

    it('descarta els valors que no es poden fer servir (data il·legible, perill que no és un número)', async () => {
        respond([{ ...BASE, onset: 'dimarts', areaName: '', dangerLevel: '1', threshold: 42 }]);
        const [alert] = await getMeteocatAlerts(41.98, 2.82);
        expect(alert).toMatchObject({ onset: null, areaName: null, dangerLevel: null, threshold: null });
    });

    it("una resposta d'abans (sense aquests camps) continua funcionant", async () => {
        respond([BASE]);
        const [alert] = await getMeteocatAlerts(41.98, 2.82);
        expect(alert.headline).toBe(BASE.headline);
        expect(alert.onset).toBeNull();
    });
});
