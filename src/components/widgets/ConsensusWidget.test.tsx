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
// pot pujar per sobre de la capçalera de la pàgina (z-50), que es pintava damunt de la Comparació de models.
const renderInTransformedDashboard = () => render(
    <div data-testid="tauler" style={{ transform: 'translateZ(0)' }}>
        <ConsensusWidget metrics={METRICS} localTemp={23} localPrecip={0} localWind={12} lang="ca" regionalModelLabel="AROME HD" />
    </div>
);

describe('ConsensusWidget — modals fora del tauler', () => {
    afterEach(() => { cleanup(); document.body.style.overflow = ''; });

    it('la Comparació de models es pinta a document.body (no dins del tauler) i bloqueja el scroll de la pàgina', () => {
        renderInTransformedDashboard();
        fireEvent.click(screen.getByText('Compara els models'));

        const title = screen.getByText('Comparació de models');
        expect(screen.getByTestId('tauler').contains(title)).toBe(false);
        expect(document.body.contains(title)).toBe(true);
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('en tancar-la (Esc), el modal desapareix i el scroll de la pàgina torna', () => {
        renderInTransformedDashboard();
        fireEvent.click(screen.getByText('Compara els models'));
        fireEvent.keyDown(window, { key: 'Escape' });

        expect(screen.queryByText('Comparació de models')).toBeNull();
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

describe('ConsensusWidget — targetes accessibles amb el teclat', () => {
    afterEach(() => { cleanup(); document.body.style.overflow = ''; });

    it('les tres targetes són botons enfocables i s\'obren amb Enter i amb Espai', () => {
        renderInTransformedDashboard();
        const cards = screen.getAllByRole('button').filter(b => /TEMP|PLUJA|VENT/.test(b.textContent ?? ''));
        expect(cards).toHaveLength(3);
        cards.forEach(card => expect(card).toHaveAttribute('tabindex', '0'));

        fireEvent.keyDown(cards[0], { key: 'Enter' });
        expect(document.body.style.overflow).toBe('hidden');
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(document.body.style.overflow).toBe('');

        fireEvent.keyDown(cards[2], { key: ' ' });
        expect(document.body.style.overflow).toBe('hidden');
    });

    it('les xifres van amb coma decimal i el vent en km/h', () => {
        renderInTransformedDashboard();
        expect(screen.getByText('22,6°')).toBeInTheDocument();
        expect(screen.getAllByText('km/h').length).toBeGreaterThanOrEqual(2);
        expect(screen.queryByText('kmh')).not.toBeInTheDocument();
    });
});
