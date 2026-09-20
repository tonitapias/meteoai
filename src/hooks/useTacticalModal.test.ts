import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTacticalModal } from './useTacticalModal';

describe('useTacticalModal', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('obre el modal amb un hash i el tanca netejant-lo', async () => {
        const { result } = renderHook(() => useTacticalModal('trendChart'));
        act(() => result.current.openModal());
        expect(result.current.isOpen).toBe(true);
        expect(window.location.hash).toBe('#modal-trendChart');

        act(() => result.current.closeModal());
        await waitFor(() => expect(window.location.hash).toBe(''));
        expect(result.current.isOpen).toBe(false);
    });

    // closeModalThen existeix perquè history.back() és asíncron: si un altre modal (useModalHistory) s'obre
    // just en tancar aquest, el popstate del tancament li arriba a ell i el tanca a l'instant. jsdom no
    // reprodueix aquesta carrera (descarta el back() quan hi ha un pushState pel mig), així que aquí es
    // prova el contracte que la evita —"l'acció espera l'historial"— i la carrera es verifica al navegador.
    describe('closeModalThen', () => {
        it('tanca el modal i espera que l\'historial s\'assenti abans d\'executar l\'acció (no és síncron)', async () => {
            const { result } = renderHook(() => useTacticalModal('trendChart'));
            act(() => result.current.openModal());

            const after = vi.fn();
            act(() => result.current.closeModalThen(after));
            expect(result.current.isOpen).toBe(false);
            expect(after).not.toHaveBeenCalled();   // history.back() encara no ha acabat

            await waitFor(() => expect(after).toHaveBeenCalledTimes(1));
            expect(window.location.hash).toBe('');
        });

        it('executa l\'acció quan arriba el popstate, sense esperar el temporitzador de reserva', async () => {
            const { result } = renderHook(() => useTacticalModal('trendChart'));
            act(() => result.current.openModal());
            const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

            const after = vi.fn();
            const start = Date.now();
            act(() => result.current.closeModalThen(after));
            expect(after).not.toHaveBeenCalled();

            setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')), 20);
            await waitFor(() => expect(after).toHaveBeenCalledTimes(1));
            expect(Date.now() - start).toBeLessThan(300);   // el temporitzador de reserva és de 400 ms
            back.mockRestore();
        });

        it('si el hash ja no hi és (no hi ha res a desfer), executa l\'acció a l\'instant', () => {
            const { result } = renderHook(() => useTacticalModal('trendChart'));
            const after = vi.fn();
            act(() => result.current.closeModalThen(after));
            expect(after).toHaveBeenCalledTimes(1);
        });

        it('si el popstate no arriba mai, l\'acció s\'executa igualment (no queda penjada)', async () => {
            const { result } = renderHook(() => useTacticalModal('trendChart'));
            act(() => result.current.openModal());
            const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});

            const after = vi.fn();
            act(() => result.current.closeModalThen(after));
            await waitFor(() => expect(after).toHaveBeenCalledTimes(1), { timeout: 1500 });
            back.mockRestore();
        });

        it('l\'acció només s\'executa una vegada encara que arribi el popstate i després vingui el temporitzador', async () => {
            const { result } = renderHook(() => useTacticalModal('trendChart'));
            act(() => result.current.openModal());
            const after = vi.fn();
            act(() => result.current.closeModalThen(after));
            await new Promise(resolve => setTimeout(resolve, 600));
            expect(after).toHaveBeenCalledTimes(1);
        });
    });
});
