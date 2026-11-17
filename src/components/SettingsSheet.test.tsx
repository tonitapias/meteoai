// src/components/SettingsSheet.test.tsx
// Full «Configuració» de l'engranatge de la capçalera (auditoria d'UX del 16/11/2026, B11).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import SettingsSheet from './SettingsSheet';
import { TRANSLATIONS } from '../translations';
import { cacheService } from '../services/cacheService';

const t = TRANSLATIONS.ca;

const renderSheet = (props: Partial<Parameters<typeof SettingsSheet>[0]> = {}) => {
    const onLangChange = vi.fn();
    const onClose = vi.fn();
    render(<SettingsSheet t={t} lang="ca" onLangChange={onLangChange} onClose={onClose} {...props} />);
    return { onLangChange, onClose };
};

const openHelp = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Com funciona/ }));
    return screen.findByRole('dialog', { name: 'Com funciona' });
};

describe('SettingsSheet', () => {
    beforeEach(() => {
        // L'«enrere» de la creu de «Com funciona»: el popstate arriba a l'instant, com al navegador.
        vi.spyOn(window.history, 'back').mockImplementation(() => {
            window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("marca l'idioma actiu i el canvia a l'instant", () => {
        const { onLangChange } = renderSheet();
        const group = screen.getByRole('group', { name: 'Idioma' });

        expect(within(group).getByRole('button', { name: 'ca' })).toHaveAttribute('aria-pressed', 'true');
        expect(within(group).getByRole('button', { name: 'fr' })).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(within(group).getByRole('button', { name: 'fr' }));
        expect(onLangChange).toHaveBeenCalledWith('fr');
    });

    it("mentre es carrega una previsió, l'idioma no es canvia (com a la benvinguda)", () => {
        renderSheet({ langDisabled: true });
        for (const button of within(screen.getByRole('group', { name: 'Idioma' })).getAllByRole('button')) {
            expect(button).toBeDisabled();
        }
    });

    it('la creu i Escape tanquen el full', () => {
        const { onClose } = renderSheet();
        fireEvent.click(screen.getByRole('button', { name: t.closeWindow }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('buidar la memòria cau avisa que els favorits es mantenen i, si es cancel·la, no esborra res', () => {
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const clear = vi.spyOn(cacheService, 'clearCachedData');
        renderSheet();

        fireEvent.click(screen.getByRole('button', { name: /Buida la memòria cau/ }));

        expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Els favorits i les preferències es mantenen'));
        expect(clear).not.toHaveBeenCalled();
    });

    it('si es confirma, esborra les previsions desades', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const clear = vi.spyOn(cacheService, 'clearCachedData').mockResolvedValue(undefined);
        // jsdom no recarrega la pàgina: només ho diu per la consola.
        vi.spyOn(console, 'error').mockImplementation(() => {});
        renderSheet();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Buida la memòria cau/ }));
        });

        expect(clear).toHaveBeenCalledTimes(1);
    });

    it("«Com funciona» s'obre a sobre amb un pas d'historial, i la creu, Escape i l'enrere tornen al menú", async () => {
        const pushState = vi.spyOn(window.history, 'pushState');
        const { onClose } = renderSheet();

        // La creu
        let help = await openHelp();
        expect(screen.getByRole('dialog', { name: 'Configuració' })).toBeInTheDocument();
        fireEvent.click(within(help).getByRole('button', { name: t.closeWindow }));
        expect(screen.queryByRole('dialog', { name: 'Com funciona' })).not.toBeInTheDocument();

        // Escape
        help = await openHelp();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'Com funciona' })).not.toBeInTheDocument();

        // L'enrere del mòbil
        await openHelp();
        act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
        expect(screen.queryByRole('dialog', { name: 'Com funciona' })).not.toBeInTheDocument();

        expect(screen.getByRole('dialog', { name: 'Configuració' })).toBeInTheDocument();
        expect(pushState).toHaveBeenCalledTimes(3);
        expect(onClose).not.toHaveBeenCalled();
    });
});
