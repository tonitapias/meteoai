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

describe('AIInsights — detall del motiu', () => {
    const WIND_DETAIL = { level: 'AMBER', hazard: 'WIND', hour: '17:00', value: 62, threshold: 50, event: null } as const;

    it('sota el bàner "Motiu" hi ha la xifra i l\'hora del tallafocs', () => {
        render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'AMBER', hazard_type: 'WIND', risk_detail: WIND_DETAIL })} />);
        expect(screen.getByTestId('hazard-detail').textContent)
            .toBe('Ràfegues de fins a 62 km/h cap a les 17:00 (precaució a partir de 50 km/h)');
    });

    it('en un altre idioma, el detall també', () => {
        render(<AIInsights lang="en" analysis={analysis({ risk_level: 'AMBER', hazard_type: 'WIND', risk_detail: WIND_DETAIL })} />);
        expect(screen.getByTestId('hazard-detail').textContent).toBe('Gusts up to 62 km/h around 17:00 (caution from 50 km/h)');
    });

    it('si el detall és d\'un altre perill o d\'un altre nivell, no es mostra (el bàner sí)', () => {
        const { unmount } = render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'AMBER', hazard_type: 'RAIN', risk_detail: WIND_DETAIL })} />);
        expect(screen.queryByTestId('hazard-detail')).toBeNull();
        expect(screen.getByText('PLUJA INTENSA SOSTINGUDA')).toBeTruthy();
        unmount();
        render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'RED', hazard_type: 'WIND', risk_detail: WIND_DETAIL })} />);
        expect(screen.queryByTestId('hazard-detail')).toBeNull();
    });

    it('sense detall (anàlisi antiga en cache, o la IA veu un perill que les regles no cobreixen), només el bàner', () => {
        render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'AMBER', hazard_type: 'WIND' })} />);
        expect(screen.queryByTestId('hazard-detail')).toBeNull();
        expect(screen.getByText('VENT FORT I RÀFEGUES')).toBeTruthy();
    });
});
