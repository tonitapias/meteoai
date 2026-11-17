import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfficialAlertBanner from './OfficialAlertBanner';
import type { OfficialAlert } from '../services/alertsApi';

const mockAlerts: { current: OfficialAlert[] } = { current: [] };
vi.mock('../hooks/useOfficialAlerts', () => ({
    useOfficialAlerts: () => ({ alerts: mockAlerts.current }),
}));

// L'avís de vent del Gironès del 17/11/2026 tal com el torna ara el proxy (auditoria d'UX, segona volta, N1).
const GIRONES: OfficialAlert = {
    id: 'meteocat-20-Vent-2026-11-17T18:00-2026-11-17T23:59-p1-x',
    event: 'Vent',
    severity: 'Moderate',
    headline: 'Avís groc al Gironès: ratxa màxima de més de 72 km/h',
    description: 'Servei Meteorològic de Catalunya: Ratxa màxima > 72 km/h (20 m/s).',
    instruction: null,
    senderName: 'Servei Meteorològic de Catalunya',
    onset: '2026-11-17T18:00:00+01:00',
    expires: '2026-11-17T23:59:00+01:00',
    areaName: 'Gironès',
    dangerLevel: 1,
    threshold: 'Ratxa màxima > 72 km/h (20 m/s)',
    sourceName: 'Meteocat (Servei Meteorològic de Catalunya)',
    sourceUrl: 'https://www.meteo.cat/avisos',
    textLang: 'ca',
};

const NOW = Date.parse('2026-11-17T21:30:00+01:00');
const MADRID = 'Europe/Madrid';

describe('OfficialAlertBanner: quan val l\'avís', () => {
    beforeEach(() => { mockAlerts.current = []; });

    it('amb inici, diu de quin dia i hora a quin dia i hora (hora del lloc), amb la comarca i el llindar al titular', () => {
        mockAlerts.current = [GIRONES];
        render(<OfficialAlertBanner lat={41.98} lon={2.82} lang="ca" timeZone={MADRID} nowMs={NOW} />);
        expect(screen.getByText('Avís groc al Gironès: ratxa màxima de més de 72 km/h')).toBeInTheDocument();
        expect(screen.getByTestId('official-alert-when')).toHaveTextContent('De dt. 18:00 a dt. 23:59');
    });

    it('en els altres idiomes, amb el dia de la setmana de cada idioma', () => {
        mockAlerts.current = [GIRONES];
        const { rerender } = render(<OfficialAlertBanner lang="es" timeZone={MADRID} nowMs={NOW} />);
        expect(screen.getByTestId('official-alert-when')).toHaveTextContent('De mar 18:00 a mar 23:59');
        rerender(<OfficialAlertBanner lang="en" timeZone={MADRID} nowMs={NOW} />);
        expect(screen.getByTestId('official-alert-when')).toHaveTextContent('From Tue 18:00 to Tue 23:59');
        rerender(<OfficialAlertBanner lang="fr" timeZone={MADRID} nowMs={NOW} />);
        expect(screen.getByTestId('official-alert-when')).toHaveTextContent('Du mar. 18:00 au mar. 23:59');
    });

    it('sense inici (les altres fonts), continua dient fins quan és vàlida', () => {
        mockAlerts.current = [{ ...GIRONES, onset: null }];
        render(<OfficialAlertBanner lang="ca" timeZone={MADRID} nowMs={NOW} />);
        expect(screen.getByTestId('official-alert-when')).toHaveTextContent(/^Vàlida fins: 17\/11\/26,? 23:59$/);
    });

    it("un avís acabat deixa de sortir encara que l'app no l'hagi tornat a demanar", () => {
        mockAlerts.current = [GIRONES];
        const { container, rerender } = render(<OfficialAlertBanner lang="ca" timeZone={MADRID} nowMs={Date.parse('2026-11-17T23:59:30+01:00')} />);
        expect(container).not.toBeEmptyDOMElement();
        rerender(<OfficialAlertBanner lang="ca" timeZone={MADRID} nowMs={Date.parse('2026-11-18T00:00:30+01:00')} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("una zona horària que el navegador no coneix no trenca la franja", () => {
        mockAlerts.current = [GIRONES];
        render(<OfficialAlertBanner lang="ca" timeZone="Mart/Olympus" nowMs={NOW} />);
        expect(screen.getByTestId('official-alert-when')).toHaveTextContent(/^De dt\. \d\d:\d\d a dt\. \d\d:\d\d$/);
    });
});
