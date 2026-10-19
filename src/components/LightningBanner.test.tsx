// src/components/LightningBanner.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LightningBanner from './LightningBanner';
import type { LightningNearby } from '../services/lightningService';

const NOW = Date.UTC(2026, 9, 20, 0, 30);
// Observat fa 8 min respecte del rellotge de l'app (NOW).
const at = (nearestKm: number, extra: Partial<LightningNearby> = {}): LightningNearby =>
    ({ nearestKm, bearingDeg: 320, observedAt: NOW / 1000 - 8 * 60, intense: false, activeSlots: 3, ...extra });

describe('LightningBanner', () => {
    it('a 30 km o menys: avís ambre amb distància, rumb i minuts; el botó obre el radar', () => {
        const onShowRadar = vi.fn();
        render(<LightningBanner lightning={at(23, { intense: true })} lang="ca" now={NOW} onShowRadar={onShowRadar} />);
        expect(screen.getByText('Llamps a prop')).toBeTruthy();
        expect(screen.getByText('El satèl·lit Meteosat-12 ha detectat llamps a uns 23 km al nord-oest, fa 8 min. Activitat elèctrica intensa.')).toBeTruthy();
        fireEvent.click(screen.getByText('Veure al radar'));
        expect(onShowRadar).toHaveBeenCalledTimes(1);
    });

    it('a 10 km o menys: "molt a prop" i consell de refugi', () => {
        render(<LightningBanner lightning={at(7, { bearingDeg: 90 })} lang="ca" now={NOW} onShowRadar={() => {}} />);
        expect(screen.getByText('Llamps molt a prop')).toBeTruthy();
        expect(screen.getByText(/a uns 7 km a l'est, fa 8 min\. Si ets a l'aire lliure, busca refugi/)).toBeTruthy();
    });

    it('més lluny de 30 km o sense llamps: res (només ho rep la IA)', () => {
        const { container, rerender } = render(<LightningBanner lightning={at(31)} lang="ca" now={NOW} onShowRadar={() => {}} />);
        expect(container.innerHTML).toBe('');
        rerender(<LightningBanner lightning={null} lang="ca" now={NOW} onShowRadar={() => {}} />);
        expect(container.innerHTML).toBe('');
    });

    it('en anglès i francès', () => {
        const { rerender } = render(<LightningBanner lightning={at(23)} lang="en" now={NOW} onShowRadar={() => {}} />);
        expect(screen.getByText('The Meteosat-12 satellite detected lightning about 23 km to the north-west, 8 min ago.')).toBeTruthy();
        rerender(<LightningBanner lightning={at(23)} lang="fr" now={NOW} onShowRadar={() => {}} />);
        expect(screen.getByText('Voir sur le radar')).toBeTruthy();
    });
});
