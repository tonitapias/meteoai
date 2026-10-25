// src/components/ViewModeChip.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ViewModeChip from './ViewModeChip';
import { ca } from '../translations/ca';

const renderChip = (viewMode: 'basic' | 'expert' = 'basic') => {
    const onSelect = vi.fn();
    render(<ViewModeChip viewMode={viewMode} onSelect={onSelect} strings={ca.viewModes} />);
    const chip = screen.getByRole('button', { name: /Vista.*Essencial|Vista.*Completa/ });
    return { onSelect, chip };
};

describe('ViewModeChip', () => {
    afterEach(cleanup);

    it('diu en quina vista ets i obre un menú amb les dues vistes explicades', () => {
        const { chip } = renderChip();
        expect(chip.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(chip);
        expect(chip.getAttribute('aria-expanded')).toBe('true');
        const menu = screen.getByRole('group', { name: 'Què vols veure?' });
        expect(menu.textContent).toContain(ca.viewModes.essentialHint);
        expect(menu.textContent).toContain(ca.viewModes.completeHint);
        expect(screen.getByRole('button', { name: /^Essencial/ }).getAttribute('aria-pressed')).toBe('true');
    });

    it('triar la vista completa la canvia, tanca el menú i torna el focus al xip', () => {
        const { chip, onSelect } = renderChip();
        fireEvent.click(chip);
        fireEvent.click(screen.getByRole('button', { name: /^Completa/ }));
        expect(onSelect).toHaveBeenCalledWith('expert');
        expect(screen.queryByRole('group')).toBeNull();
        expect(document.activeElement).toBe(chip);
    });

    it('tornar a triar la vista actual no fa res més que tancar', () => {
        const { chip, onSelect } = renderChip('expert');
        fireEvent.click(chip);
        fireEvent.click(screen.getByRole('button', { name: /^Completa/ }));
        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.queryByRole('group')).toBeNull();
    });

    it('es tanca amb Esc i tocant fora', () => {
        const { chip } = renderChip();
        fireEvent.click(chip);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('group')).toBeNull();
        expect(document.activeElement).toBe(chip);

        fireEvent.click(chip);
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('group')).toBeNull();
    });
});
