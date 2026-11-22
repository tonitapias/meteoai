// src/components/AIInsights.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Auditoria d'UX del 16/11/2026 (A3): sense nivell ni avisos, la insígnia posava AMBER ("Avís precaució") per defecte.
describe('AIInsights — semàfor de risc sense nivell', () => {
    it('sense nivell i sense avisos, "Temps tranquil"', () => {
        render(<AIInsights lang="ca" analysis={analysis({})} />);
        expect(screen.getByText('TEMPS TRANQUIL')).toBeTruthy();
        expect(screen.queryByText('AVÍS PRECAUCIÓ')).toBeNull();
    });

    it('sense nivell, els avisos locals el decideixen: precaució amb un avís, alerta amb un de greu', () => {
        const { unmount } = render(<AIInsights lang="ca" analysis={analysis({ alerts: [{ type: 'Vent', msg: 'Ratxes fortes.', level: 'warning' }] })} />);
        expect(screen.getByText('AVÍS PRECAUCIÓ')).toBeTruthy();
        unmount();
        render(<AIInsights lang="ca" analysis={analysis({ alerts: [{ type: 'Tempesta', msg: 'Tempestes.', level: 'high' }] })} />);
        expect(screen.getByText('ALERTA METEO')).toBeTruthy();
    });

    it('amb el nivell de les regles (GREEN), "Temps tranquil"', () => {
        render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'GREEN', hazard_type: 'NONE' })} />);
        expect(screen.getByText('TEMPS TRANQUIL')).toBeTruthy();
    });
});

describe('AIInsights — detall del motiu', () => {
    const WIND_DETAIL = { level: 'AMBER', hazard: 'WIND', hour: '17:00', value: 62, threshold: 50, event: null } as const;

    it('sota el bàner "Motiu" hi ha la xifra i l\'hora del tallafocs', () => {
        render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'AMBER', hazard_type: 'WIND', risk_detail: WIND_DETAIL })} />);
        expect(screen.getByTestId('hazard-detail').textContent)
            .toBe('Ratxes de fins a 62 km/h cap a les 17:00 (precaució a partir de 50 km/h)');
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
        expect(screen.getByText('VENT FORT I RATXES')).toBeTruthy();
    });
});

describe('AIInsights — consells d\'un avís que arriba sense cap', () => {
    it('AMBER sense consells (el tallafocs ha pujat un GREEN de la IA): en surt un de fix per al perill', () => {
        render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'AMBER', hazard_type: 'WIND', tips: [] })} />);
        expect(screen.getByText('Punts clau per a les properes hores:')).toBeTruthy();
        expect(screen.getByText('Ratxes fortes: Assegureu objectes solts i eviteu zones arbrades')).toBeTruthy();
    });

    it('si la IA ja dona consells, es mostren els seus i no el fix', () => {
        render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'AMBER', hazard_type: 'WIND', tips: [{ category: 'WIND', text: 'Vent: consell de la IA' }] })} />);
        expect(screen.getByText('Vent: consell de la IA')).toBeTruthy();
        expect(screen.queryByText('Ratxes fortes: Assegureu objectes solts i eviteu zones arbrades')).toBeNull();
    });

    it('amb el temps tranquil (GREEN) no hi ha consells', () => {
        render(<AIInsights lang="ca" analysis={analysis({ risk_level: 'GREEN', hazard_type: 'NONE', tips: [] })} />);
        expect(screen.queryByText('Punts clau per a les properes hores:')).toBeNull();
    });
});

// Auditoria d'UX del 16/11/2026 (B16): l'explicació de "Temperatura ±3°" només sortia passant-hi el ratolí per sobre.
describe('AIInsights — la insígnia de confiança es pot tocar per llegir-ne l\'explicació', () => {
    it('és un botó i en tocar-lo mostra la frase', () => {
        const hint = 'Els models discrepen en la temperatura de les pròximes 6 hores.';
        render(<AIInsights lang="ca" analysis={analysis({ confidence: 'Temperatura ±3°', confidenceLevel: 'medium', confidenceColor: 'amber', confidenceHint: hint })} />);
        const badge = screen.getByRole('button', { name: 'Temperatura ±3°' });
        expect(badge.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText(hint)).toBeNull();
        fireEvent.click(badge);
        expect(badge.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('note').textContent).toBe(hint);
    });
});

// Auditoria d'UX, segona volta (B16): a 390 px la bombolla començava a x = -94 px (ancorada a la dreta de la insígnia,
// que salta a l'esquerra de la fila) i el text de la IA s'hi pintava a sobre (capçalera i contingut, tots dos z-10).
describe('AIInsights — on surt l\'explicació de la insígnia i com es tanca', () => {
    const hint = 'Els models discrepen en la temperatura de les pròximes 6 hores.';
    const open = () => {
        render(<AIInsights lang="ca" analysis={analysis({ text: 'Cel serè i fa 20 °C.', confidence: 'Temperatura ±3°', confidenceLevel: 'medium', confidenceColor: 'amber', confidenceHint: hint })} />);
        const badge = screen.getByRole('button', { name: 'Temperatura ±3°' });
        fireEvent.click(badge);
        return badge;
    };

    it('penja de la capçalera (no de la insígnia), amb marge a tots dos costats en mòbil', () => {
        open();
        const note = screen.getByTestId('ai-confidence-hint');
        // La primera capa posicionada per sobre de la bombolla és la capçalera, no un embolcall de la insígnia.
        let anchor = note.parentElement;
        while (anchor && !/(^|\s)relative(\s|$)/.test(anchor.className)) anchor = anchor.parentElement;
        expect(anchor?.className).toMatch(/border-b/);
        expect(note.className).toMatch(/(^|\s)left-4(\s|$)/);
        expect(note.className).toMatch(/(^|\s)right-4(\s|$)/);
        expect(note.className).not.toMatch(/max-w-\[80vw\]/);
    });

    it('la capçalera va per sobre del text de la IA', () => {
        open();
        const header = screen.getByTestId('ai-confidence-hint').closest('.border-b') as HTMLElement;
        // El contenidor del text (el text s'escriu de mica en mica i al principi no hi és).
        const content = header.parentElement?.querySelector('.overflow-y-auto') as HTMLElement;
        const z = (el: HTMLElement) => Number(/(?:^|\s)z-(\d+)(?:\s|$)/.exec(el.className)?.[1]);
        expect(z(header)).toBeGreaterThan(z(content));
    });

    it('Escape la tanca i el focus torna a la insígnia', () => {
        const badge = open();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('note')).toBeNull();
        expect(badge.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(badge);
    });

    it('tocar fora la tanca; tocar la bombolla, no', () => {
        open();
        fireEvent.pointerDown(screen.getByRole('note'));
        expect(screen.getByRole('note')).toBeTruthy();
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('note')).toBeNull();
    });

    it('tornar a tocar la insígnia també la tanca', () => {
        const badge = open();
        fireEvent.pointerDown(badge);
        fireEvent.click(badge);
        expect(screen.queryByRole('note')).toBeNull();
    });
});
