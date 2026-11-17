// src/components/TypewriterText.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { TypewriterText } from './TypewriterText';

// Auditoria d'UX del 16/11/2026 (M2): el text de la IA s'escrivia a 30 ms per lletra (~8 s per a 230 caràcters), cada
// vegada i també amb "reduir el moviment".
const TEXT = 'Ara mateix el cel és majoritàriament serè i fa 25 °C. Cap al vespre, la temperatura baixarà fins a 23 °C i el cel es mantindrà clar. No es descarta algun ruixat feble cap a les 23:00 ni una mica de vent.';

const mockReducedMotion = (reduce: boolean) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: reduce && query.includes('prefers-reduced-motion'), media: query,
        addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
    }));
};

describe('TypewriterText', () => {
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

    it('un text llarg surt sencer en ~1 s, no a 30 ms per lletra', async () => {
        mockReducedMotion(false);
        vi.useFakeTimers();
        const { container } = render(<TypewriterText text={TEXT} />);
        await act(async () => { await vi.advanceTimersByTimeAsync(300); });
        const partial = container.textContent ?? '';
        expect(partial.length).toBeGreaterThan(0);
        expect(partial.length).toBeLessThan(TEXT.length);
        await act(async () => { await vi.advanceTimersByTimeAsync(800); });
        expect(container.textContent).toBe(TEXT);
    });

    it('amb "reduir el moviment", el text surt de cop', async () => {
        mockReducedMotion(true);
        vi.useFakeTimers();
        const { container } = render(<TypewriterText text={TEXT} />);
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(container.textContent).toBe(TEXT);
    });
});
