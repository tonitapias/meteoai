// src/components/SharePositionSheet.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SharePositionSheet from './SharePositionSheet';
import { TRANSLATIONS, type Language } from '../translations';
import type { ShareResult } from '../utils/shareLink';

const setup = (overrides: Partial<{
    lang: Language;
    placeName: string | undefined;
    onSharePosition: () => Promise<ShareResult | null>;
    onShareWeatherOnly: () => Promise<ShareResult | null>;
    onCopyCoords: () => Promise<boolean>;
}> = {}) => {
    const lang = overrides.lang ?? 'ca';
    const props = {
        coords: '41.98315, 2.82493',
        placeName: 'placeName' in overrides ? overrides.placeName : 'Girona',
        texts: TRANSLATIONS[lang].share,
        closeLabel: TRANSLATIONS[lang].closeWindow,
        onSharePosition: overrides.onSharePosition ?? vi.fn().mockResolvedValue('shared'),
        onShareWeatherOnly: overrides.onShareWeatherOnly ?? vi.fn().mockResolvedValue('shared'),
        onCopyCoords: overrides.onCopyCoords ?? vi.fn().mockResolvedValue(true),
        onClose: vi.fn()
    };
    render(<SharePositionSheet {...props} />);
    return props;
};

describe('SharePositionSheet', () => {
    it('pregunta què es vol compartir, amb la posició a la vista i les tres opcions', () => {
        setup();
        expect(screen.getByRole('dialog', { name: 'Què vols compartir?' })).toBeInTheDocument();
        expect(screen.getByText('41.98315, 2.82493')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Comparteix la meva posició/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Comparteix només el temps de Girona/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Copia les coordenades/ })).toBeInTheDocument();
    });

    it("sense nom del lloc, \"només el temps d'aquí\"", () => {
        setup({ placeName: undefined });
        expect(screen.getByRole('button', { name: /Comparteix només el temps d'aquí/ })).toBeInTheDocument();
    });

    it('cada opció fa la seva acció i, un cop compartit o copiat, es tanca', async () => {
        const props = setup();
        fireEvent.click(screen.getByRole('button', { name: /Comparteix només el temps/ }));
        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
        expect(props.onShareWeatherOnly).toHaveBeenCalledTimes(1);
        expect(props.onSharePosition).not.toHaveBeenCalled();
    });

    it("si l'usuari tanca el full del sistema (o no es pot), es queda oberta per triar una altra opció", async () => {
        const onSharePosition = vi.fn().mockResolvedValue('cancelled');
        const props = setup({ onSharePosition });
        fireEvent.click(screen.getByRole('button', { name: /Comparteix la meva posició/ }));
        await waitFor(() => expect(onSharePosition).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByRole('button', { name: /Comparteix la meva posició/ })).not.toBeDisabled());
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it('mentre el full del sistema és obert, un segon toc no en demana un altre', async () => {
        let finish: (r: ShareResult) => void = () => {};
        const onSharePosition = vi.fn(() => new Promise<ShareResult>((resolve) => { finish = resolve; }));
        setup({ onSharePosition });
        const button = screen.getByRole('button', { name: /Comparteix la meva posició/ });
        fireEvent.click(button);
        fireEvent.click(button);
        expect(onSharePosition).toHaveBeenCalledTimes(1);
        finish('shared');
    });

    it('es tanca amb la creu, amb Escape i tocant fora', () => {
        const props = setup();
        fireEvent.click(screen.getByRole('button', { name: 'Tancar finestra' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        fireEvent.click(screen.getByRole('dialog').parentElement!);
        expect(props.onClose).toHaveBeenCalledTimes(3);
    });

    it('als 4 idiomes', () => {
        const expected: Record<Language, string> = {
            ca: 'Què vols compartir?', es: '¿Qué quieres compartir?', fr: 'Que voulez-vous partager ?', en: 'What do you want to share?'
        };
        for (const [lang, title] of Object.entries(expected) as [Language, string][]) {
            const { unmount } = render(
                <SharePositionSheet coords="1.00000, 2.00000" placeName="Girona" texts={TRANSLATIONS[lang].share}
                    closeLabel={TRANSLATIONS[lang].closeWindow} onSharePosition={vi.fn()} onShareWeatherOnly={vi.fn()}
                    onCopyCoords={vi.fn()} onClose={vi.fn()} />
            );
            expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
            unmount();
        }
    });
});
