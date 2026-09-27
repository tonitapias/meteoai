// src/components/OfflineSnapshotBanner.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import OfflineSnapshotBanner from './OfflineSnapshotBanner';
import { TRANSLATIONS, type Language } from '../translations';
import type { OfflineSnapshotInfo } from '../types/weatherLogicTypes';

const NOW = new Date('2026-09-27T12:30:00Z').getTime();
const MIN = 60 * 1000;
const info = (overrides: Partial<OfflineSnapshotInfo> = {}): OfflineSnapshotInfo => ({
    savedAt: NOW - 190 * MIN,
    issuedAt: '2026-09-27T11:20',
    distanceKm: null,
    ...overrides
});

const renderBanner = (i: OfflineSnapshotInfo, props: { place?: string | null; lang?: Language; onRetry?: () => Promise<unknown> } = {}) =>
    render(
        <OfflineSnapshotBanner
            info={i}
            place={props.place ?? 'Girona'}
            text={TRANSLATIONS[props.lang ?? 'ca'].offlineSnapshot}
            now={NOW}
            onRetry={props.onRetry}
        />
    );

describe('OfflineSnapshotBanner', () => {
    it('diu de quina hora és la previsió (hora del lloc) i quant fa que es va desar', () => {
        renderBanner(info());
        expect(screen.getByText("No s'ha pogut actualitzar. És la previsió de les 11:20 (fa 3 h).")).toBeInTheDocument();
        expect(screen.getByText('Previsió desada')).toBeInTheDocument();
        expect(screen.getByText("S'actualitzarà sola quan torni la connexió.")).toBeInTheDocument();
    });

    it('per sota d\'una hora, en minuts', () => {
        renderBanner(info({ savedAt: NOW - 25 * MIN }));
        expect(screen.getByText(/\(fa 25 min\)/)).toBeInTheDocument();
    });

    it('si és d\'un altre punt, diu de quin lloc i a quants km', () => {
        renderBanner(info({ distanceKm: 4.4 }));
        expect(screen.getByText("No s'ha pogut actualitzar. És la previsió desada per a Girona, a 4 km d'aquí, de les 11:20 (fa 3 h).")).toBeInTheDocument();
    });

    it('per sota d\'1 km és el mateix lloc (el GPS no repeteix mai les coordenades)', () => {
        renderBanner(info({ distanceKm: 0.3 }));
        expect(screen.getByText(/És la previsió de les 11:20/)).toBeInTheDocument();
    });

    it.each(['ca', 'es', 'en', 'fr'] as Language[])('[%s] no queda cap marcador sense omplir', (lang) => {
        const { container, unmount } = renderBanner(info({ distanceKm: 4.4 }), { lang });
        expect(container.textContent).not.toMatch(/[{}]/);
        expect(container.textContent).toContain('11:20');
        expect(container.textContent).toContain('4 km');
        unmount();
    });

    it('sense acció de reintentar no hi ha botó', () => {
        renderBanner(info());
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('"Reintenta" crida l\'acció, mostra que prova i no deixa tornar-hi fins que acaba', async () => {
        let finish!: () => void;
        const onRetry = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
        renderBanner(info(), { onRetry });

        fireEvent.click(screen.getByRole('button', { name: 'Reintenta' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
        const button = screen.getByRole('button', { name: 'Provant…' });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(onRetry).toHaveBeenCalledTimes(1);

        await act(async () => { finish(); });
        expect(screen.getByRole('button', { name: 'Reintenta' })).toBeEnabled();
    });
});
