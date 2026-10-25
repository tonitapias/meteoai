// src/components/dashboard/ViewModeSections.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CompleteViewHeading, MoreDetailPrompt } from './ViewModeSections';
import { COMPLETE_VIEW_ANCHOR_ID } from './completeViewAnchor';
import { ca } from '../../translations/ca';
import type { DetailTeaserItem } from '../../utils/detailTeaser';

const TEASER: DetailTeaserItem[] = [
    { key: 'pressure', text: 'Pressió 1019 hPa' },
    { key: 'air', text: "Qualitat de l'aire raonable" },
    { key: 'moon', text: 'Lluna Plena' },
    { key: 'visibility', text: 'Visibilitat 42.3 km' },
];

const noFocus = () => false;

describe('MoreDetailPrompt', () => {
    afterEach(cleanup);

    it('sencera: explica la vista completa amb els valors d\'ara i deixa dir "Ara no"', () => {
        const onShow = vi.fn();
        const onDismiss = vi.fn();
        render(<MoreDetailPrompt compact={false} teaser={TEASER} strings={ca.viewModes} onShow={onShow} onDismiss={onDismiss} takeFocus={noFocus} />);

        expect(screen.getByRole('heading', { name: 'Vols més detall?' })).toBeTruthy();
        TEASER.forEach((item) => expect(screen.getByText(item.text)).toBeTruthy());

        fireEvent.click(screen.getByRole('button', { name: 'Mostra la vista completa' }));
        expect(onShow).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Ara no' }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('sense valors no deixa una llista buida', () => {
        render(<MoreDetailPrompt compact={false} teaser={[]} strings={ca.viewModes} onShow={vi.fn()} onDismiss={vi.fn()} takeFocus={noFocus} />);
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('reduïda: una sola línia que porta a la vista completa', () => {
        const onShow = vi.fn();
        render(<MoreDetailPrompt compact teaser={TEASER} strings={ca.viewModes} onShow={onShow} onDismiss={vi.fn()} takeFocus={noFocus} />);
        expect(screen.queryByRole('heading')).toBeNull();
        expect(screen.queryByText('Pressió 1019 hPa')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Vista completa/ }));
        expect(onShow).toHaveBeenCalledTimes(1);
    });

    it('en passar a una línia amb "Ara no", el focus va a la línia (el botó tocat ja no hi és)', () => {
        let pending: string | null = null;
        const takeFocus = (target: 'prompt' | 'heading') => {
            if (pending !== target) return false;
            pending = null;
            return true;
        };
        const props = { teaser: TEASER, strings: ca.viewModes, onShow: vi.fn(), onDismiss: vi.fn(), takeFocus };
        const { rerender } = render(<MoreDetailPrompt compact={false} {...props} />);
        pending = 'prompt';
        rerender(<MoreDetailPrompt compact {...props} />);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /Vista completa/ }));
    });
});

describe('CompleteViewHeading', () => {
    afterEach(cleanup);

    it("marca on comença la vista completa i deixa tornar a l'essencial", () => {
        const onBack = vi.fn();
        const { container } = render(<CompleteViewHeading strings={ca.viewModes} onBack={onBack} takeFocus={() => true} />);
        expect(container.querySelector(`#${COMPLETE_VIEW_ANCHOR_ID}`)).toBeTruthy();
        expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Vista completa' }));
        fireEvent.click(screen.getByRole('button', { name: "Torna a l'essencial" }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
