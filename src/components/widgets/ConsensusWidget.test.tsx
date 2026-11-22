// src/components/widgets/ConsensusWidget.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConsensusWidget } from './ConsensusWidget';
import type { ConsensusMetrics } from '../../utils/consensusMath';

const METRICS: ConsensusMetrics = {
    isConsensusActive: true,
    tempDiff: 0.4, precipDiff: 0, windDiff: 2,
    futureDivergence: false,
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
        fireEvent.click(screen.getByText('Temperatura'));

        expect(document.body.children.length).toBe(before + 1);
        expect(screen.getByTestId('tauler').querySelector('.fixed.inset-0')).toBeNull();
        expect(document.body.style.overflow).toBe('hidden');
    });
});

// Auditoria d'UX del 16/11/2026 (A2): a Puigcerdà, "Acord baix" (gràfics) just a sobre de "Alineat · Precisió 94 %"
// (aquesta targeta). L'acord entre models el diuen els gràfics; aquí només hi ha les diferències d'ara.
describe('ConsensusWidget — sense veredicte d\'acord propi', () => {
    afterEach(() => { cleanup(); document.body.style.overflow = ''; });

    it('no mostra cap puntuació ni cap estat d\'acord, i el títol diu quins models compara', () => {
        const { container } = renderInTransformedDashboard();
        // El text visible, sense el <style> de l'animació (els seus fotogrames porten "0%, 100%").
        container.querySelectorAll('style').forEach(s => s.remove());
        const text = container.textContent ?? '';
        expect(text).not.toMatch(/Precisi[óo]|Accuracy|Alineat|Discrepància|Divergència|Motor de Consens/i);
        expect(text).not.toMatch(/\d\s*%/);
        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('AROME HD contra el global');
        expect(text).toContain('Diferència ara mateix');
    });

    it('el títol porta el model regional en cada idioma', () => {
        for (const [lang, expected] of [['es', 'HRRR frente al global'], ['en', 'HRRR vs global'], ['fr', 'HRRR face au global']] as const) {
            const { unmount } = render(<ConsensusWidget metrics={METRICS} localTemp={23} localPrecip={0} localWind={12} lang={lang} regionalModelLabel="HRRR" />);
            expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(expected);
            unmount();
        }
    });
});

// Auditoria d'UX del 16/11/2026 (M7): «Compara els models» no tenia role="dialog" i el focus es quedava al botó de darrere.
describe('ConsensusWidget — els modals són diàlegs amb el focus a dins', () => {
    afterEach(() => { cleanup(); document.body.style.overflow = ''; });

    it('«Compara els models» és un diàleg amb nom i rep el focus', () => {
        renderInTransformedDashboard();
        fireEvent.click(screen.getByText('Compara els models'));
        const dialog = screen.getByRole('dialog', { name: 'Comparació de models' });
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('el detall de la temperatura també', () => {
        renderInTransformedDashboard();
        fireEvent.click(screen.getByText('Temperatura'));
        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.contains(document.activeElement)).toBe(true);
    });
});

describe('ConsensusWidget — targetes accessibles amb el teclat', () => {
    afterEach(() => { cleanup(); document.body.style.overflow = ''; });

    it('les tres targetes són botons enfocables i s\'obren amb Enter i amb Espai', () => {
        renderInTransformedDashboard();
        const cards = screen.getAllByRole('button').filter(b => /Temperatura|Pluja|Vent/.test(b.textContent ?? ''));
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
        // El regional i el global, tots dos en km/h.
        expect(screen.getByText('km/h')).toBeInTheDocument();
        expect(screen.getByText(/^10(,0)? km\/h$/)).toBeInTheDocument();
        expect(screen.queryByText('kmh')).not.toBeInTheDocument();
    });
});

// Auditoria d'UX, segona volta (N4): "GLO", "Δ" i "LOC" no s'entenien.
describe('ConsensusWidget — paraules senceres, sense abreviatures', () => {
    afterEach(() => { cleanup(); document.body.style.overflow = ''; });

    it.each([
        ['ca', 'Diferència'], ['es', 'Diferencia'], ['en', 'Difference'], ['fr', 'Écart'],
    ] as const)('en %s: «Global» i «%s», mai «GLO» ni «Δ»', (lang, diff) => {
        const { container } = render(<ConsensusWidget metrics={METRICS} localTemp={23} localPrecip={0} localWind={12} lang={lang} regionalModelLabel="AROME HD" />);
        expect(screen.getAllByText('Global')).toHaveLength(3);
        expect(screen.getAllByText(diff)).toHaveLength(3);
        expect(container.textContent).not.toMatch(/\bGLO\b|Δ/);
    });

    it('el detall hora a hora diu el nom del model i «Global», no «LOC» i «GLO»', () => {
        render(<ConsensusWidget metrics={METRICS} localTemp={23} localPrecip={0} localWind={12} lang="ca"
            regionalModelLabel="AROME HD" hourlyTimes={['2026-11-17T21:00']} hourlyGlobalTimes={['2026-11-17T21:00']}
            hourlyLocal={{ temp: [19] }} hourlyGlobal={{ temp: [18.6] }} utcOffset={3600} />);
        fireEvent.click(screen.getByText('Temperatura'));
        const dialog = screen.getByRole('dialog');
        expect(dialog.textContent).toContain('AROME HD');
        expect(dialog.textContent).toContain('Global');
        expect(dialog.textContent).not.toMatch(/\bLOC\b|\bGLO\b/);
    });
});
