import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import DetailWidgetsGrid from './DetailWidgetsGrid';
import { ALL_DETAIL_WIDGETS, type DetailWidgetId } from './detailWidgetIds';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Barcelona, migdia d'octubre (les mateixes dades que la prova de la Fase lunar d'ExpertWidgets).
const weather = {
    current: { time: '2026-10-18T12:00', weather_code: 1, temperature_2m: 20, relative_humidity_2m: 60, wind_speed_10m: 5, is_day: 1 },
    hourly: { time: ['2026-10-18T12:00'], temperature_2m: [20] },
    daily: { time: ['2026-10-18'] },
    location: { name: 'Barcelona', latitude: 41.3888, longitude: 2.159 },
    timezone: 'Europe/Madrid',
    utc_offset_seconds: 7200,
} as unknown as ExtendedWeatherData;

const handlers = () => ({
    onShowSolarModal: vi.fn(), onShowMoonModal: vi.fn(), onShowStormModal: vi.fn(), onShowAqiModal: vi.fn(),
    onShowUvModal: vi.fn(), onShowPressureModal: vi.fn(), onShowComfortModal: vi.fn(), onShowVisibilityModal: vi.fn(),
    onShowCloudLayersModal: vi.fn(), onShowSnowLevelModal: vi.fn(), onShowWindModal: vi.fn(),
});

const renderGrid = (opts: { ids?: readonly DetailWidgetId[]; freezingLevel?: number | null; on?: ReturnType<typeof handlers> } = {}) => {
    const on = opts.on ?? handlers();
    const view = render(
        <DetailWidgetsGrid
            weatherData={weather} aqiData={null} lang="ca" unit="C"
            freezingLevel={opts.freezingLevel ?? null} now={Date.UTC(2026, 9, 18, 10, 0)}
            ids={opts.ids} {...on}
        />
    );
    // Les targetes són els fills directes de la graella.
    const cards = Array.from(view.container.firstElementChild?.children ?? []) as HTMLElement[];
    return { cards, on };
};

describe('DetailWidgetsGrid → quins ginys i en quin ordre', () => {
    it('per defecte, els de la vista completa: sense cota de neu, 10 (del vent al cicle solar)', () => {
        const { cards } = renderGrid();
        expect(ALL_DETAIL_WIDGETS).toHaveLength(11);
        expect(cards).toHaveLength(10);
        expect(cards[0].textContent).toMatch(/vent/i);
        expect(cards[9].textContent).toMatch(/cicle solar/i);
    });

    it('amb la cota de neu prou baixa, 11, i la cota l\'última i a tota l\'amplada (sigui quina sigui la graella)', () => {
        const { cards } = renderGrid({ freezingLevel: 1200 });
        expect(cards).toHaveLength(11);
        expect(cards[10].textContent).toMatch(/cota/i);
        expect(cards[10].className).toContain('col-span-full');
        expect(cards[9].className).toContain('md:col-span-2');
    });

    it('`ids` tria els ginys i l\'ordre: sol i lluna, en aquest ordre', () => {
        const { cards } = renderGrid({ ids: ['sun', 'moon'] });
        expect(cards).toHaveLength(2);
        expect(cards[0].textContent).toMatch(/cicle solar/i);
        expect(cards[1].textContent).toMatch(/fase lunar/i);
    });

    it('la cota de neu demanada no surt si és massa alta (la mateixa regla que abans)', () => {
        expect(renderGrid({ ids: ['wind', 'snowLevel'], freezingLevel: 4000 }).cards).toHaveLength(1);
    });

    it('cada targeta continua obrint el seu modal, sigui on sigui', () => {
        const on = handlers();
        const { cards } = renderGrid({ ids: ['moon', 'wind'], on });
        fireEvent.click(cards[0]);
        fireEvent.click(cards[1]);
        expect(on.onShowMoonModal).toHaveBeenCalledTimes(1);
        expect(on.onShowWindModal).toHaveBeenCalledTimes(1);
        expect(on.onShowSolarModal).not.toHaveBeenCalled();
    });
});
