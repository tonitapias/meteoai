// src/components/AIInsights.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AIInsights, { type TacticalAnalysisResult } from './AIInsights';

const analysis = (badge: Partial<TacticalAnalysisResult>): TacticalAnalysisResult => ({
    text: 'Cel serè.',
    tips: [],
    alerts: [],
    ...badge,
});

describe('AIInsights — insígnia de confiança', () => {
    it('un dubte només de temperatura es pinta en ambre encara que el nivell sigui baix, amb la frase que ho explica', () => {
        render(<AIInsights lang="ca" analysis={analysis({
            confidence: 'Temperatura ±4°', confidenceLevel: 'low', confidenceColor: 'amber',
            confidenceHint: 'Els models discrepen en la temperatura…',
        })} />);
        const badge = screen.getByTestId('ai-confidence');
        expect(badge.textContent).toBe('Temperatura ±4°');
        expect(badge.getAttribute('data-color')).toBe('amber');
        expect(badge.className).toContain('text-amber-300');
        expect(badge.getAttribute('title')).toBe('Els models discrepen en la temperatura…');
    });

    it('la pluja incerta és vermella', () => {
        render(<AIInsights lang="ca" analysis={analysis({ confidence: 'Pluja incerta', confidenceLevel: 'low', confidenceColor: 'red' })} />);
        expect(screen.getByTestId('ai-confidence').className).toContain('text-rose-200');
    });

    it('sense color explícit fa servir el del nivell (dades antigues)', () => {
        render(<AIInsights lang="ca" analysis={analysis({ confidence: 'Consens Models', confidenceLevel: 'high' })} />);
        expect(screen.getByTestId('ai-confidence').getAttribute('data-color')).toBe('green');
    });

    it('sense nivell no hi ha insígnia', () => {
        render(<AIInsights lang="ca" analysis={analysis({ confidence: '', confidenceLevel: null, confidenceColor: null })} />);
        expect(screen.queryByTestId('ai-confidence')).toBeNull();
    });
});
