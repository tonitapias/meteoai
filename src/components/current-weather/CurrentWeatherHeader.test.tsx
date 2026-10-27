// src/components/current-weather/CurrentWeatherHeader.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurrentWeatherHeader, type SharedPositionInfo } from './CurrentWeatherHeader';
import { TRANSLATIONS, type Language } from '../../translations';
import { formatCoordsText, googleMapsDirectionsLink, googleMapsLink } from '../../utils/placeLink';

const sharedPosition = (lang: Language): SharedPositionInfo => ({
    label: TRANSLATIONS[lang].share.sharedPosition,
    coords: formatCoordsText(41.9831458, 2.8249319),
    mapsUrl: googleMapsLink(41.9831458, 2.8249319),
    directionsUrl: googleMapsDirectionsLink(41.9831458, 2.8249319),
    openLabel: TRANSLATIONS[lang].share.openInMaps,
    directionsLabel: TRANSLATIONS[lang].share.directions
});

describe('CurrentWeatherHeader: posició compartida', () => {
    it('diu "Posició compartida" en lloc del país, amb les coordenades i els dos enllaços de Google Maps', () => {
        render(<CurrentWeatherHeader locationName="Girona" country="Espanya" modelLabel={null} sharedPosition={sharedPosition('ca')} />);

        expect(screen.getByText('Posició compartida')).toBeInTheDocument();
        expect(screen.queryByText('Espanya')).toBeNull();
        expect(screen.getByText('41.98315, 2.82493')).toBeInTheDocument();

        const open = screen.getByRole('link', { name: 'Obre a Google Maps' });
        expect(open).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=41.98315,2.82493');
        const directions = screen.getByRole('link', { name: 'Com arribar-hi' });
        expect(directions).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=41.98315,2.82493');
        // Pestanya nova, sense donar accés a l'app ni dir-li d'on ve.
        for (const link of [open, directions]) {
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
    });

    it('els botons van traduïts als 4 idiomes', () => {
        const expected: Record<Language, [string, string, string]> = {
            ca: ['Posició compartida', 'Obre a Google Maps', 'Com arribar-hi'],
            es: ['Posición compartida', 'Abrir en Google Maps', 'Cómo llegar'],
            fr: ['Position partagée', 'Ouvrir dans Google Maps', 'Itinéraire'],
            en: ['Shared location', 'Open in Google Maps', 'Directions'],
        };
        for (const [lang, [label, open, directions]] of Object.entries(expected) as [Language, [string, string, string]][]) {
            const { unmount } = render(<CurrentWeatherHeader locationName="Girona" modelLabel={null} sharedPosition={sharedPosition(lang)} />);
            expect(screen.getByText(label)).toBeInTheDocument();
            expect(screen.getByRole('link', { name: open })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: directions })).toBeInTheDocument();
            unmount();
        }
    });

    it('un lloc qualsevol: el país i cap enllaç de mapa', () => {
        render(<CurrentWeatherHeader locationName="Girona" country="Espanya" modelLabel={null} />);
        expect(screen.getByText('Espanya')).toBeInTheDocument();
        expect(screen.queryByRole('link')).toBeNull();
    });
});

describe('CurrentWeatherHeader: botó Compartir', () => {
    it("a dalt a la dreta, al costat de les insígnies (no a la fila d'accions), amb l'etiqueta de l'idioma", () => {
        const onShare = vi.fn();
        render(<CurrentWeatherHeader locationName="Girona" country="Espanya" modelLabel="AROME HD" onShare={onShare} shareLabel={TRANSLATIONS.fr.share.button} />);

        const button = screen.getByRole('button', { name: 'Partager ce lieu' });
        // Mateixa fila que les insígnies (el país i el model): és el seu germà, no és dins del títol.
        expect(button.parentElement).toContainElement(screen.getByText('Espanya'));
        fireEvent.click(button);
        expect(onShare).toHaveBeenCalledTimes(1);
    });

    it("també amb una posició rebuda (la insígnia llarga i un model de nom llarg poden fer dues línies; el botó no es mou)", () => {
        render(<CurrentWeatherHeader locationName="Viena" modelLabel="GeoSphere AT" sharedPosition={sharedPosition('ca')} onShare={vi.fn()} />);
        const button = screen.getByRole('button', { name: 'Compartir aquest lloc' });
        const badges = screen.getByText('Posició compartida').closest('div')!.parentElement!;
        expect(badges.className).toContain('flex-wrap');
        expect(button.parentElement).toContainElement(badges);
    });

    it('sense onShare no hi ha botó', () => {
        render(<CurrentWeatherHeader locationName="Girona" modelLabel={null} />);
        expect(screen.queryByRole('button')).toBeNull();
    });
});
