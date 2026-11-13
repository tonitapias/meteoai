import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Hi ha una versió nova esperant (el Service Worker real no existeix a les proves).
vi.mock('virtual:pwa-register/react', () => ({
    useRegisterSW: () => ({ needRefresh: [true, vi.fn()], updateServiceWorker: vi.fn() }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import UpdatePrompt from './UpdatePrompt';

const box = () => screen.getByRole('button', { name: 'updateAction' }).closest('.fixed') as HTMLElement;

describe('UpdatePrompt → no tapa la barra de pestanyes', () => {
    it('sense barra, al seu lloc de sempre', () => {
        render(<UpdatePrompt />);
        expect(box().className).toContain('bottom-6');
        expect(box().className).not.toContain('5.5rem');
    });

    it('amb la barra fixa a baix, per sobre seu; a escriptori (barra a dalt), al seu lloc', () => {
        render(<UpdatePrompt aboveTabBar />);
        expect(box().className).toContain('bottom-[calc(5.5rem+env(safe-area-inset-bottom))]');
        expect(box().className).toContain('lg:bottom-6');
    });
});
