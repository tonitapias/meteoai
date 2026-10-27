// src/utils/shareLink.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { shareLink, type ShareNavigator } from './shareLink';

const CONTENT = {
    title: 'El temps a Girona',
    text: 'Mira el temps a Girona amb MeteoToni AI',
    url: 'https://tonitapias.github.io/meteoai/?lat=41.98&lon=2.82&nom=Girona'
};

const domError = (name: string) => Object.assign(new Error(name), { name });

describe('shareLink', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("amb navigator.share, obre el full de compartir amb títol, text i URL (i no copia res)", async () => {
        const nav: ShareNavigator = {
            share: vi.fn().mockResolvedValue(undefined),
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
        };
        await expect(shareLink(CONTENT, nav)).resolves.toBe('shared');
        expect(nav.share).toHaveBeenCalledWith(CONTENT);
        expect(nav.clipboard!.writeText).not.toHaveBeenCalled();
    });

    it('crida share amb el navigator com a `this` (el real llança "Illegal invocation" si no)', async () => {
        const nav = {
            share: vi.fn(function (this: unknown) {
                if (this !== nav) return Promise.reject(new TypeError('Illegal invocation'));
                return Promise.resolve();
            })
        };
        await expect(shareLink(CONTENT, nav)).resolves.toBe('shared');
    });

    it("si l'usuari tanca el full de compartir, no copia res ni és cap error", async () => {
        const nav: ShareNavigator = {
            share: vi.fn().mockRejectedValue(domError('AbortError')),
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
        };
        await expect(shareLink(CONTENT, nav)).resolves.toBe('cancelled');
        expect(nav.clipboard!.writeText).not.toHaveBeenCalled();
    });

    it('sense navigator.share, copia la URL al porta-retalls', async () => {
        const nav: ShareNavigator = { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } };
        await expect(shareLink(CONTENT, nav)).resolves.toBe('copied');
        expect(nav.clipboard!.writeText).toHaveBeenCalledWith(CONTENT.url);
    });

    it('copia clipboardText si n\'hi ha, i al full de compartir només hi van títol, text i URL', async () => {
        const copyNav: ShareNavigator = { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } };
        await expect(shareLink({ ...CONTENT, clipboardText: 'missatge sencer' }, copyNav)).resolves.toBe('copied');
        expect(copyNav.clipboard!.writeText).toHaveBeenCalledWith('missatge sencer');

        const shareNav: ShareNavigator = { share: vi.fn().mockResolvedValue(undefined) };
        await shareLink({ ...CONTENT, clipboardText: 'missatge sencer' }, shareNav);
        expect(shareNav.share).toHaveBeenCalledWith(CONTENT);
    });

    it('si el navegador rebutja compartir (NotAllowedError) o no admet les dades, també copia', async () => {
        const refused: ShareNavigator = {
            share: vi.fn().mockRejectedValue(domError('NotAllowedError')),
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
        };
        await expect(shareLink(CONTENT, refused)).resolves.toBe('copied');

        const unsupported: ShareNavigator = {
            share: vi.fn(),
            canShare: vi.fn().mockReturnValue(false),
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
        };
        await expect(shareLink(CONTENT, unsupported)).resolves.toBe('copied');
        expect(unsupported.share).not.toHaveBeenCalled();
    });

    it('sense navigator.clipboard (WebView antiga), fa servir el mètode antic i torna el focus al botó', async () => {
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.focus();
        let copied = '';
        const execCommand = vi.fn((command: string) => {
            copied = (document.activeElement as HTMLTextAreaElement).value;
            return command === 'copy';
        });
        Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });

        await expect(shareLink(CONTENT, {}, document)).resolves.toBe('copied');
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(copied).toBe(CONTENT.url);
        expect(document.querySelector('textarea')).toBeNull();
        expect(document.activeElement).toBe(button);

        button.remove();
        Reflect.deleteProperty(document, 'execCommand');
    });

    it("si no es pot copiar de cap manera, ho diu ('failed')", async () => {
        Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
        const nav: ShareNavigator = { clipboard: { writeText: vi.fn().mockRejectedValue(domError('NotAllowedError')) } };
        await expect(shareLink(CONTENT, nav, document)).resolves.toBe('failed');
        Reflect.deleteProperty(document, 'execCommand');
    });
});
