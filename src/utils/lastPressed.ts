// src/utils/lastPressed.ts
// L'últim control que s'ha premut (ratolí o dit). Safari (i iOS) no dona el focus a un botó en clicar-lo: quan un modal
// s'obre, document.activeElement és el <body> o, pitjor, l'últim element que tenia el focus d'abans, i en tancar-lo el
// focus no tornaria al botó que l'ha obert (auditoria d'UX, segona volta, M7). useDialogFocus fa servir aquest element
// com a origen quan el darrer gest ha estat un toc o un clic; si ha estat el teclat (Enter sobre una targeta), l'element
// enfocat. S'instal·la a main.tsx, abans del primer clic: els modals es baixen a part i el seu codi arriba després.

const CONTROL = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';

let lastPressed: HTMLElement | null = null;
let pointerAt = 0;
let keyAt = 0;
let installed = false;

export const installLastPressedTracking = (): void => {
    if (installed || typeof document === 'undefined') return;
    installed = true;
    // Fase de captura: el gest es registra abans que cap control l'aturi.
    document.addEventListener('pointerdown', (e) => {
        const target = e.target instanceof Element ? e.target.closest<HTMLElement>(CONTROL) : null;
        lastPressed = target;
        pointerAt = performance.now();
    }, true);
    document.addEventListener('keydown', () => { keyAt = performance.now(); }, true);
};

/** El control premut, si el darrer gest ha estat un toc o un clic (no el teclat) i encara és a la pàgina. */
export const getPointerOpener = (): HTMLElement | null =>
    lastPressed?.isConnected && pointerAt > keyAt ? lastPressed : null;
