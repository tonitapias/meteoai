import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightsRow } from './HighlightsRow';
import { PanelPlaceLine } from './PanelPlaceLine';
import { TRANSLATIONS } from '../../translations';
import type { DetailTeaserItem } from '../../utils/detailTeaser';

const items: DetailTeaserItem[] = [
    { key: 'planet', text: 'Cicló de categoria 5', compactText: 'cicló', entry: { kind: 'cyclone', id: 'E1' }, icon: 'cyclone' },
    { key: 'pressure', text: 'Pressió 1007 hPa' },
    { key: 'air', text: "Qualitat de l'aire bona" },
    { key: 'moon', text: 'Creixent' },
    { key: 'visibility', text: 'Visibilitat 40 km' },
];

describe('HighlightsRow → els destacats d\'Ara', () => {
    it('cada xip porta a la pestanya del seu giny; el del planeta n\'obre la fitxa', () => {
        const onGoTo = vi.fn();
        const onOpenPlanet = vi.fn();
        render(<HighlightsRow items={items} strings={TRANSLATIONS.ca.tabs} onGoTo={onGoTo} onOpenPlanet={onOpenPlanet} />);
        expect(screen.getByRole('navigation', { name: 'Destacats' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Pressió 1007 hPa · Detall' }));
        fireEvent.click(screen.getByRole('button', { name: "Qualitat de l'aire bona · Detall" }));
        fireEvent.click(screen.getByRole('button', { name: 'Visibilitat 40 km · Detall' }));
        fireEvent.click(screen.getByRole('button', { name: 'Creixent · Cel' }));
        expect(onGoTo.mock.calls.map(([tab]) => tab)).toEqual(['detail', 'detail', 'detail', 'sky']);

        fireEvent.click(screen.getByRole('button', { name: 'Cicló de categoria 5' }));
        expect(onOpenPlanet).toHaveBeenCalledWith({ kind: 'cyclone', id: 'E1' });
        expect(onGoTo).toHaveBeenCalledTimes(4);
    });

    it('sense valors, no pinta res', () => {
        const { container } = render(<HighlightsRow items={[]} strings={TRANSLATIONS.ca.tabs} onGoTo={() => {}} onOpenPlanet={() => {}} />);
        expect(container.firstChild).toBeNull();
    });
});

describe('PanelPlaceLine → el lloc a dalt de les altres pestanyes', () => {
    it('el nom i l\'hora del lloc', () => {
        render(<PanelPlaceLine name="Barcelona" localTime={new Date(2026, 10, 13, 9, 5)} />);
        expect(screen.getByText('Barcelona')).toBeTruthy();
        expect(screen.getByText('09:05')).toBeTruthy();
    });

    it('sense nom, res; sense hora, només el nom', () => {
        const { container, rerender } = render(<PanelPlaceLine name="  " localTime={new Date()} />);
        expect(container.firstChild).toBeNull();
        rerender(<PanelPlaceLine name="Girona" localTime={null} />);
        expect(screen.getByText('Girona')).toBeTruthy();
        expect(screen.queryByText(/\d\d:\d\d/)).toBeNull();
    });
});
