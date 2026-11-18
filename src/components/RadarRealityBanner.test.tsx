// src/components/RadarRealityBanner.test.tsx
// L'avís de pluja que la previsió no té: "s'ha avançat" (amb l'hora que l'esperava) o "no prevista" (amb l'extensió).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RadarRealityStatus } from '../hooks/useRadarRealityCheck';

const status = vi.hoisted(() => ({ value: null as unknown as RadarRealityStatus }));
vi.mock('../hooks/useRadarRealityCheck', () => ({ useRadarRealityCheck: () => status.value }));

import RadarRealityBanner from './RadarRealityBanner';

const radar = (radarMmPerHour: number, rainFraction: number | null, hasDiscrepancy = true): RadarRealityStatus =>
    ({ radarDbz: 30, radarMmPerHour, rainFraction, hasDiscrepancy });

// Sant Feliu Sasserra, 18-11-2026 a les 23:13 (AROME HD).
const RAIN_AT_1 = [
    { time: '2026-11-18T23:00', precip: 0 },
    { time: '2026-11-19T00:00', precip: 0.1 },
    { time: '2026-11-19T01:00', precip: 4 },
    { time: '2026-11-19T02:00', precip: 6 }
];
const DRY = RAIN_AT_1.map((h) => ({ ...h, precip: 0 }));

beforeEach(() => {
    status.value = radar(2.7, 1);
});

describe('RadarRealityBanner', () => {
    it("la previsió l'esperava més tard: s'ha avançat, amb l'hora (la 01:00) i sense parlar de ruixats", () => {
        render(<RadarRealityBanner lat={41.95} lon={2.02} modelMmPerHourNow={0} forecastHours={RAIN_AT_1} lang="ca" />);
        expect(screen.getByText("La pluja s'ha avançat")).toBeTruthy();
        expect(screen.getByText("Segons el radar, aquí ja plou de manera moderada. La previsió no l'esperava fins cap a la 01:00.")).toBeTruthy();
    });

    it("amb una hora que no és la 1: 'les'", () => {
        const at3 = RAIN_AT_1.map((h) => ({ ...h, precip: h.time.endsWith('T02:00') ? 6 : 0 }));
        status.value = radar(11.5, 1);
        render(<RadarRealityBanner modelMmPerHourNow={0} forecastHours={at3} lang="ca" />);
        expect(screen.getByText("Segons el radar, aquí ja plou amb força. La previsió no l'esperava fins cap a les 02:00.")).toBeTruthy();
    });

    it('sense pluja prevista: no prevista, i si és aïllada, un ruixat local', () => {
        status.value = radar(0.8, 0.05);
        render(<RadarRealityBanner modelMmPerHourNow={0} forecastHours={DRY} lang="ca" />);
        expect(screen.getByText('Pluja no prevista')).toBeTruthy();
        expect(screen.getByText("Segons el radar, aquí plou de manera feble, però la previsió no n'esperava en les properes hores. Sembla un ruixat local i podria durar poc.")).toBeTruthy();
    });

    it('sense pluja prevista i amb pluja a tot el voltant: zona àmplia; entremig, res', () => {
        const { rerender } = render(<RadarRealityBanner modelMmPerHourNow={0} forecastHours={DRY} lang="ca" />);
        expect(screen.getByText(/en les properes hores\. La pluja cobreix una zona àmplia al voltant\.$/)).toBeTruthy();
        status.value = radar(2.7, 0.45);
        rerender(<RadarRealityBanner modelMmPerHourNow={0} forecastHours={DRY} lang="ca" />);
        expect(screen.getByText(/en les properes hores\.$/)).toBeTruthy();
    });

    it('sense discrepància, res', () => {
        status.value = radar(2.7, 1, false);
        const { container } = render(<RadarRealityBanner modelMmPerHourNow={1} forecastHours={RAIN_AT_1} lang="ca" />);
        expect(container.innerHTML).toBe('');
    });

    it('els altres idiomes', () => {
        const { rerender } = render(<RadarRealityBanner modelMmPerHourNow={0} forecastHours={RAIN_AT_1} lang="es" />);
        expect(screen.getByText('Según el radar, aquí ya llueve de forma moderada. La previsión no la esperaba hasta cerca de la 01:00.')).toBeTruthy();
        rerender(<RadarRealityBanner modelMmPerHourNow={0} forecastHours={RAIN_AT_1} lang="en" />);
        expect(screen.getByText("According to radar, moderate rain is already falling here. The forecast didn't expect it until around 01:00.")).toBeTruthy();
        rerender(<RadarRealityBanner modelMmPerHourNow={0} forecastHours={DRY} lang="fr" />);
        expect(screen.getByText('Pluie non prévue')).toBeTruthy();
        expect(screen.getByText("Selon le radar, il pleut modérément ici, mais la prévision n'en attendait pas dans les prochaines heures. La pluie couvre une large zone alentour.")).toBeTruthy();
    });
});
