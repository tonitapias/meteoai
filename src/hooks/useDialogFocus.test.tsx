import { describe, it, expect, afterEach } from 'vitest';
import { useRef, type ReactNode } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { useDialogFocus } from './useDialogFocus';
import { installLastPressedTracking } from '../utils/lastPressed';
import { useAstroModalShell } from './useAstroModalShell';

const Dialog = ({ open, label, children }: { open: boolean; label: string; children: ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    useDialogFocus(open, ref);
    return open ? <div ref={ref} role="dialog" aria-label={label}>{children}</div> : null;
};

const tab = (shiftKey = false) => fireEvent.keyDown(document, { key: 'Tab', shiftKey });

// Auditoria d'UX, segona volta (M7): al radar el primer botó era la creu del mòbil (amagada a partir de 640 px) i el
// focus es quedava al <body>; a mòbil, l'última era la creu d'escriptori i el Tab se n'escapava. I el fons no era inert.
describe('useDialogFocus — només els controls visibles', () => {
    afterEach(cleanup);

    it('en obrir-se, el focus va al primer control visible (no a un d\'amagat)', () => {
        render(<Dialog open label="Radar">
            <button style={{ display: 'none' }}>Tanca (mòbil)</button>
            <button>Radar</button>
            <button>Vent</button>
        </Dialog>);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Radar' }));
    });

    it('el Tab dona la volta entre els visibles, sense passar per un d\'amagat (ni dins d\'un pare amagat)', () => {
        render(<Dialog open label="Radar">
            <button>Primer</button>
            <button>Últim visible</button>
            <div style={{ display: 'none' }}><button>Tanca (escriptori)</button></div>
        </Dialog>);
        const first = screen.getByRole('button', { name: 'Primer' });
        const last = screen.getByRole('button', { name: 'Últim visible' });
        last.focus();
        tab();
        expect(document.activeElement).toBe(first);
        tab(true);
        expect(document.activeElement).toBe(last);
    });

    it('si el focus és fora (al <body>), el Tab el porta a dins', () => {
        render(<Dialog open label="Radar"><button style={{ visibility: 'hidden' }}>Invisible</button><button>Dins</button></Dialog>);
        (document.activeElement as HTMLElement | null)?.blur();
        tab();
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dins' }));
    });
});

describe('useDialogFocus — el fons queda inert', () => {
    afterEach(cleanup);

    const Page = ({ open }: { open: boolean }) => (
        <>
            <header data-testid="capçalera"><button>Ràdar</button></header>
            <main data-testid="contingut"><button>Pressió</button></main>
            <nav data-testid="ja-inert" inert>…</nav>
            <Dialog open={open} label="Pressió"><button>Tanca</button></Dialog>
        </>
    );

    it('mentre és obert, tot el que no és el diàleg és inert; en tancar-se, torna a ser com abans', () => {
        const { rerender } = render(<Page open={false} />);
        rerender(<Page open />);
        expect(screen.getByTestId('capçalera').hasAttribute('inert')).toBe(true);
        expect(screen.getByTestId('contingut').hasAttribute('inert')).toBe(true);
        expect(screen.getByRole('dialog').hasAttribute('inert')).toBe(false);
        rerender(<Page open={false} />);
        expect(screen.getByTestId('capçalera').hasAttribute('inert')).toBe(false);
        expect(screen.getByTestId('contingut').hasAttribute('inert')).toBe(false);
        // El que ja era inert abans, no es toca.
        expect(screen.getByTestId('ja-inert').hasAttribute('inert')).toBe(true);
    });

    it('dos diàlegs niats (Configuració → Com funciona): el de sota és inert mentre l\'altre és obert', () => {
        const Nested = ({ outer, inner }: { outer: boolean; inner: boolean }) => (
            <>
                <main data-testid="fons"><button>Engranatge</button></main>
                <Dialog open={outer} label="Configuració"><button>Com funciona</button></Dialog>
                <Dialog open={inner} label="Com funciona"><button>Entesos</button></Dialog>
            </>
        );
        const { rerender } = render(<Nested outer={false} inner={false} />);
        rerender(<Nested outer inner={false} />);
        rerender(<Nested outer inner />);
        expect(screen.getByRole('dialog', { name: 'Configuració' }).hasAttribute('inert')).toBe(true);
        expect(screen.getByTestId('fons').hasAttribute('inert')).toBe(true);
        rerender(<Nested outer inner={false} />);
        expect(screen.getByRole('dialog', { name: 'Configuració' }).hasAttribute('inert')).toBe(false);
        expect(screen.getByTestId('fons').hasAttribute('inert')).toBe(true);
        rerender(<Nested outer={false} inner={false} />);
        expect(screen.getByTestId('fons').hasAttribute('inert')).toBe(false);
    });
});

describe('useDialogFocus — en tancar-se, el focus torna a qui l\'ha obert', () => {
    afterEach(cleanup);

    const Opener = ({ open }: { open: boolean }) => (
        <>
            <button>Pressió</button>
            <Dialog open={open} label="Pressió"><button>Tanca</button></Dialog>
        </>
    );

    const WithOther = ({ open }: { open: boolean }) => (
        <>
            <button>Altre</button>
            <button>Pressió</button>
            <Dialog open={open} label="Pressió"><button>Tanca</button></Dialog>
        </>
    );

    it('obert amb el teclat: a l\'element enfocat', () => {
        installLastPressedTracking();
        const { rerender } = render(<Opener open={false} />);
        const opener = screen.getByRole('button', { name: 'Pressió' });
        opener.focus();
        fireEvent.keyDown(opener, { key: 'Enter' });
        rerender(<Opener open />);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tanca' }));
        rerender(<Opener open={false} />);
        expect(document.activeElement).toBe(opener);
    });

    it('obert amb un toc que no enfoca el botó (Safari): al botó tocat, encara que un altre tingués el focus', () => {
        installLastPressedTracking();
        const { rerender } = render(<WithOther open={false} />);
        const other = screen.getByRole('button', { name: 'Altre' });
        const opener = screen.getByRole('button', { name: 'Pressió' });
        other.focus();
        act(() => { fireEvent.pointerDown(opener); });
        expect(document.activeElement).toBe(other);
        rerender(<WithOther open />);
        rerender(<WithOther open={false} />);
        expect(document.activeElement).toBe(opener);
    });

    it('si després del toc s\'ha fet servir el teclat, mana l\'element enfocat', () => {
        installLastPressedTracking();
        const { rerender } = render(<WithOther open={false} />);
        const other = screen.getByRole('button', { name: 'Altre' });
        const opener = screen.getByRole('button', { name: 'Pressió' });
        act(() => { fireEvent.pointerDown(other); });
        opener.focus();
        fireEvent.keyDown(opener, { key: 'Enter' });
        rerender(<WithOther open />);
        rerender(<WithOther open={false} />);
        expect(document.activeElement).toBe(opener);
    });
});

// Els modals de ginys (pressió, UV, aire, CAPE, rosada, visibilitat, núvols, cota de neu, vent, extrems) passen per
// useAstroModalShell: abans no movien el focus.
describe('useAstroModalShell amb la ref del diàleg', () => {
    afterEach(() => { cleanup(); document.body.style.overflow = ''; });

    const WidgetModal = ({ withRef }: { withRef: boolean }) => {
        const ref = useRef<HTMLDivElement>(null);
        useAstroModalShell(() => {}, withRef ? ref : undefined);
        return <div ref={ref} role="dialog" aria-label="Pressió"><button>Tanca</button></div>;
    };

    it('amb la ref, el focus entra al modal i el fons queda inert', () => {
        render(<><main data-testid="fons"><button>Pressió</button></main><WidgetModal withRef /></>);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tanca' }));
        expect(screen.getByTestId('fons').hasAttribute('inert')).toBe(true);
    });

    it('sense la ref (Solar i Lluna ja ho fan pel seu compte), no toca el focus', () => {
        render(<><main data-testid="fons"><button>Sol</button></main><WidgetModal withRef={false} /></>);
        expect(document.activeElement).toBe(document.body);
        expect(screen.getByTestId('fons').hasAttribute('inert')).toBe(false);
    });
});

// Configuració desactiva el seu useDialogFocus mentre «Com funciona» és obert; en tornar, ha de recordar l'engranatge.
describe('useDialogFocus — el diàleg que s\'aparta i torna recorda qui l\'havia obert', () => {
    afterEach(cleanup);

    const Settings = ({ open, help }: { open: boolean; help: boolean }) => {
        const ref = useRef<HTMLDivElement>(null);
        useDialogFocus(open && !help, ref);
        return (
            <>
                <button>Engranatge</button>
                {open && <div ref={ref} role="dialog" aria-label="Configuració"><button>Com funciona</button></div>}
                <Dialog open={open && help} label="Com funciona"><button>Entesos</button></Dialog>
            </>
        );
    };

    it('en tancar Configuració després de «Com funciona», el focus torna a l\'engranatge', () => {
        installLastPressedTracking();
        const { rerender } = render(<Settings open={false} help={false} />);
        const gear = screen.getByRole('button', { name: 'Engranatge' });
        act(() => { fireEvent.pointerDown(gear); });
        rerender(<Settings open help={false} />);
        act(() => { fireEvent.pointerDown(screen.getByRole('button', { name: 'Com funciona' })); });
        rerender(<Settings open help />);
        fireEvent.keyDown(document, { key: 'Escape' });
        rerender(<Settings open help={false} />);
        expect(screen.getByRole('dialog', { name: 'Configuració' }).contains(document.activeElement)).toBe(true);
        rerender(<Settings open={false} help={false} />);
        expect(document.activeElement).toBe(gear);
    });
});
