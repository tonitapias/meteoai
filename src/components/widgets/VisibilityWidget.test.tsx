import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VisibilityWidget } from './VisibilityWidget';

describe('VisibilityWidget — alineat amb la política de boira', () => {
    it('sense boira confirmada (límit "≥ 2 km") es mostra com a calitja, mai com a boira', () => {
        // Cas real (Vic, 18→19/09/2026): ICON deia 0,8 km però la saturació no confirmava boira.
        const { container } = render(<VisibilityWidget visibility={2000} bound="min" lang="ca" />);
        expect(container.textContent).toContain('≥2');
        expect(container.textContent).toContain('Calitja');
        expect(container.textContent).not.toContain('Boira');
    });

    it('amb boira confirmada mostra el valor del model i "Boira"', () => {
        const { container } = render(<VisibilityWidget visibility={840} lang="ca" />);
        expect(container.textContent).toContain('0.8');
        expect(container.textContent).toContain('Boira');
    });

    it('amb boira confirmada però visibilitat de model alta, es limita a "≤ 1 km" i diu "Boira"', () => {
        const { container } = render(<VisibilityWidget visibility={1000} bound="max" lang="ca" />);
        expect(container.textContent).toContain('≤1');
        expect(container.textContent).toContain('Boira');
    });

    it('sense dada, no inventa cap número', () => {
        const { container } = render(<VisibilityWidget visibility={null} lang="ca" />);
        expect(container.textContent).toContain('--');
        expect(container.textContent).toContain('SENSE DADES');
    });

    it('respecta l\'idioma', () => {
        const { container } = render(<VisibilityWidget visibility={2000} bound="min" lang="en" />);
        expect(container.textContent).toContain('Haze');
    });
});
