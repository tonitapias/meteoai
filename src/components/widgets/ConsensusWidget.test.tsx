// src/components/widgets/ConsensusWidget.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConsensusWidget } from './ConsensusWidget';
import type { ConsensusMetrics } from '../../utils/consensusMath';

const METRICS: ConsensusMetrics = {
    isConsensusActive: true,
    tempDiff: 0.4, precipDiff: 0, windDiff: 2,
    modelsAgree: true, score: 92, futureDivergence: false,
    globalTemp: 22.6, globalPrecip: 0, globalWind: 10,
    tempTrend: 'flat', precipTrend: 'flat', windTrend: 'flat',
};

// Dins del tauler, algun contenidor amb transform crea un context d'apilament propi: un modal fix que hi queda a dins no
// pot pujar per sobre de la capçalera de la pàgina (z-50), que es pintava damunt de la Telemetria gràfica.
const renderInTransformedDashboard = () => render(
    <div data-testid="tauler" style={{ transform: 'translateZ(0)' }}>
        <ConsensusWidget metrics={METRICS} localTemp={23} localPrecip={0} localWind={12} lang="ca" regionalModelLabel="AROME HD" />
    </div>
);

describe('ConsensusWidget — modals fora del tauler', () => {
    afterEach(() => { cleanup(); document.body.style.overflow = ''; });

    it('la Telemetria gràfica es pinta a document.body (no dins del tauler) i bloqueja el scroll de la pàgina', () => {
        renderInTransformedDashboard();
        fireEvent.click(screen.getByText('Telemetria Gràfica Completa'));

        const title = screen.getByText('Telemetria Gràfica Avançada');
        expect(screen.getByTestId('tauler').contains(title)).toBe(false);
        expect(document.body.contains(title)).toBe(true);
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('en tancar-la (Esc), el modal desapareix i el scroll de la pàgina torna', () => {
        renderInTransformedDashboard();
        fireEvent.click(screen.getByText('Telemetria Gràfica Completa'));
        fireEvent.keyDown(window, { key: 'Escape' });

        expect(screen.queryByText('Telemetria Gràfica Avançada')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });

    it('el detall de la temperatura també surt del tauler', () => {
        renderInTransformedDashboard();
        const before = document.body.children.length;
        fireEvent.click(screen.getByText('TEMP'));

        expect(document.body.children.length).toBe(before + 1);
        expect(screen.getByTestId('tauler').querySelector('.fixed.inset-0')).toBeNull();
        expect(document.body.style.overflow).toBe('hidden');
    });
});
