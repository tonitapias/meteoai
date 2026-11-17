// src/components/Footer.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Footer from './Footer';
import { cacheService } from '../services/cacheService';

const setOnline = (value: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
};

describe('Footer', () => {
    afterEach(() => {
        setOnline(true);
        vi.restoreAllMocks();
    });

    it("parla l'idioma triat, no anglès fix", () => {
        render(<Footer lang="es" regionalModelLabel="AROME HD" />);
        expect(screen.getByText('En línea')).toBeInTheDocument();
        expect(screen.getByText('Datos: Open-Meteo')).toBeInTheDocument();
        expect(screen.getByText('Modelo: AROME HD')).toBeInTheDocument();
        expect(screen.queryByText(/SYSTEM ONLINE/i)).not.toBeInTheDocument();
    });

    it('sense model regional diu "Global", no "HD regional"', () => {
        render(<Footer lang="ca" regionalModelLabel={null} />);
        expect(screen.getByText('Model: Global')).toBeInTheDocument();
        expect(screen.queryByText(/HD REGIONAL/i)).not.toBeInTheDocument();
    });

    it('mostra l\'estat real de la connexió i el segueix', () => {
        setOnline(false);
        render(<Footer lang="ca" />);
        expect(screen.getByText('Sense connexió')).toBeInTheDocument();

        setOnline(true);
        act(() => { window.dispatchEvent(new Event('online')); });
        expect(screen.getByText('En línia')).toBeInTheDocument();
    });

    // Buidar la memòria cau s'hi amagava: ara és al full «Configuració» (auditoria d'UX del 16/11/2026, B11).
    it("l'estat de la connexió només informa: no és cap botó i un clic no esborra res", () => {
        const confirm = vi.spyOn(window, 'confirm');
        const clear = vi.spyOn(cacheService, 'clearCachedData');
        render(<Footer lang="ca" />);

        const status = screen.getByRole('status', { name: 'Estat de la connexió: En línia' });
        expect(screen.queryByRole('button')).not.toBeInTheDocument();

        fireEvent.click(status);
        expect(confirm).not.toHaveBeenCalled();
        expect(clear).not.toHaveBeenCalled();
    });
});
