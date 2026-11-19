// La fila compacta de la targeta principal (al mòbil): vent, humitat i sensació en tres targetes petites.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeatherStatsGrid } from './WeatherStatsGrid';
import type { Language } from '../../translations';

const renderGrid = (props: Partial<Parameters<typeof WeatherStatsGrid>[0]> = {}) => render(
    <WeatherStatsGrid windSpeed={12} windGusts={27} windDirection={315} humidity={58} apparentTemp={19} lang="ca" {...props} />
);

describe('WeatherStatsGrid → fila compacta', () => {
    it('sense `compact`, la de sempre: el vent a tota l\'amplada amb el nom llarg', () => {
        const { container } = renderGrid();
        expect(screen.getByText('Vent')).toBeTruthy();
        expect(container.querySelector('.grid-cols-3')).toBeNull();
    });

    it('compacta: tres targetes en una fila, amb totes les dades (vent, direcció, ratxes, humitat i sensació)', () => {
        const { container } = renderGrid({ compact: true });
        const row = container.querySelector('.grid-cols-3') as HTMLElement;
        expect(row).not.toBeNull();
        expect(row.children).toHaveLength(3);
        const [wind, humidity, feels] = Array.from(row.children).map((card) => card.textContent?.replace(/\s+/g, ' ').trim());
        // El punt cardinal (315° = NO) a dalt, el nom, la velocitat i les ratxes.
        expect(wind).toBe('NOVent12km/hRATXES 27');
        expect(humidity).toBe('Humitat58%');
        expect(feels).toBe('Sensació19°');
    });

    it('sense dades, «--» i cap fletxa de direcció (mai un 0 inventat)', () => {
        const { container } = renderGrid({ compact: true, windSpeed: null, windGusts: null, windDirection: null, humidity: null, apparentTemp: null });
        const row = container.querySelector('.grid-cols-3') as HTMLElement;
        expect(row.textContent).not.toMatch(/\b0\b/);
        expect((row.textContent?.match(/--/g) ?? []).length).toBeGreaterThanOrEqual(4);
    });

    it('els noms curts als quatre idiomes', () => {
        const labels = (lang: Language) => {
            const { unmount } = renderGrid({ compact: true, lang });
            const text = document.body.textContent ?? '';
            unmount();
            return text;
        };
        expect(labels('es')).toContain('Viento');
        expect(labels('en')).toContain('Wind');
        expect(labels('en')).toContain('NW');
        expect(labels('fr')).toContain('Ressenti');
    });
});

describe('WeatherStatsGrid → fletxa de direcció', () => {
    it('apunta cap on va el vent, com la brúixola del Detall (abans anava 45° desviada)', () => {
        // 315° (NO): el vent va cap al SE (135°). La icona Navigation ja apunta al NE (45°), així que gira 90°.
        for (const compact of [false, true]) {
            const { container, unmount } = renderGrid({ compact });
            const arrow = container.querySelector('svg.lucide-navigation') as SVGElement;
            expect(arrow.style.transform).toBe('rotate(90deg)');
            unmount();
        }
    });
});
