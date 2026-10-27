// src/utils/shareLink.ts
// Compartir un enllaç: el full de compartir del sistema (navigator.share) on n'hi ha; si no, al porta-retalls.

export interface ShareContent {
    title: string;
    text: string;
    url: string;
    /** Què es copia si no hi ha full de compartir (per defecte, només `url`). */
    clipboardText?: string;
}

/** Què ha passat, perquè qui crida decideixi l'avís: res si s'ha compartit o l'usuari ho ha deixat córrer. */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** El que fem servir de `navigator` (als tests, un de fals). */
export interface ShareNavigator {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
    clipboard?: Pick<Clipboard, 'writeText'>;
}

const isAbort = (err: unknown): boolean =>
    !!err && typeof err === 'object' && (err as { name?: unknown }).name === 'AbortError';

// WebViews antigues i pàgines sense context segur no tenen `navigator.clipboard`: el mètode antic encara hi funciona.
const legacyCopy = (text: string, doc: Document): boolean => {
    const previousFocus = doc.activeElement as HTMLElement | null;
    const area = doc.createElement('textarea');
    try {
        area.value = text;
        area.setAttribute('readonly', ''); // sense teclat en pantalla al mòbil
        area.style.position = 'fixed';
        area.style.top = '0';
        area.style.left = '0';
        area.style.opacity = '0';
        doc.body.appendChild(area);
        // focus + select + setSelectionRange: select() sol no basta a tots els navegadors (Safari d'iOS).
        area.focus();
        area.select();
        area.setSelectionRange(0, text.length);
        return doc.execCommand('copy');
    } catch {
        return false;
    } finally {
        area.remove();
        // El focus és a l'àrea de text: el retornem al botó de compartir.
        previousFocus?.focus?.();
    }
};

export const copyToClipboard = async (text: string, nav: ShareNavigator, doc: Document): Promise<boolean> => {
    if (typeof nav.clipboard?.writeText === 'function') {
        try {
            await nav.clipboard.writeText(text);
            return true;
        } catch {
            // Sense permís (alguna WebView): provem el mètode antic.
        }
    }
    return legacyCopy(text, doc);
};

/**
 * Comparteix amb el full del sistema i, si no n'hi ha (Firefox d'escriptori, WebViews) o el navegador el rebutja,
 * copia l'enllaç. Si l'usuari tanca el full de compartir no es copia res: ja ha triat no compartir.
 */
export const shareLink = async (
    content: ShareContent,
    nav: ShareNavigator = navigator,
    doc: Document = document
): Promise<ShareResult> => {
    // Amb .call(nav): el navigator.share real cridat sense `this` llança "Illegal invocation".
    const { share, canShare } = nav;
    const data: ShareData = { title: content.title, text: content.text, url: content.url };
    const canUseShareSheet = typeof share === 'function'
        && (typeof canShare !== 'function' || canShare.call(nav, data));

    if (canUseShareSheet) {
        try {
            await share.call(nav, data);
            return 'shared';
        } catch (err) {
            if (isAbort(err)) return 'cancelled';
            // NotAllowedError (sense permís a la WebView, un altre full ja obert…): al porta-retalls.
        }
    }

    return (await copyToClipboard(content.clipboardText ?? content.url, nav, doc)) ? 'copied' : 'failed';
};
