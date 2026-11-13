// La targeta principal compacta (interfície per pestanyes): al mòbil, la icona al costat de la temperatura.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CurrentWeather from './CurrentWeather';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

vi.mock('./WeatherIcons', () => ({
    getWeatherIcon: (_code: unknown, className: string) => <div data-testid="weather-icon" data-size={className} />,
}));

const data = {
    current: {
        temperature_2m: 20, apparent_temperature: 21, weather_code: 1, relative_humidity_2m: 50, wind_speed_10m: 10,
        time: '2026-11-13T12:00', is_day: 1, precipitation: 0, wind_gusts_10m: 15,
    },
    daily: { time: ['2026-11-13'], temperature_2m_max: [22], temperature_2m_min: [14] },
    hourly: { time: [], temperature_2m: [] },
    location: { name: 'Barcelona', latitude: 41.38, longitude: 2.17, country: 'ES' },
    utc_offset_seconds: 3600,
} as unknown as ExtendedWeatherData;

const renderCard = (compact?: boolean) => render(
    <CurrentWeather
        data={data} effectiveCode={1} unit="C" lang="ca" isFavorite={false} onToggleFavorite={() => {}}
        onShowRadar={() => {}} onShowRegionalModel={() => {}} aqiData={null} compact={compact}
    />
);

// La icona i la temperatura comparteixen fila si la fila de la temperatura conté la icona.
const iconBesideTemperature = () => {
    const temperatureRow = screen.getByRole('heading', { level: 1 }).closest('.flex-wrap');
    return !!temperatureRow && temperatureRow.contains(screen.getByTestId('weather-icon'));
};

describe('CurrentWeather → targeta compacta', () => {
    const originalMatchMedia = window.matchMedia;
    afterEach(() => { window.matchMedia = originalMatchMedia; });

    it('sense `compact`, la de sempre: la icona gran a sota, no al costat de la temperatura', () => {
        renderCard();
        expect(screen.getAllByTestId('weather-icon')).toHaveLength(1);
        expect(iconBesideTemperature()).toBe(false);
        expect(screen.getByTestId('weather-icon').getAttribute('data-size')).toContain('w-40');
    });

    it('compacta al mòbil: una sola icona, més petita, a la fila de la temperatura', () => {
        renderCard(true);
        expect(screen.getAllByTestId('weather-icon')).toHaveLength(1);
        expect(iconBesideTemperature()).toBe(true);
        expect(screen.getByTestId('weather-icon').getAttribute('data-size')).toContain('w-24');
        // La resta de la targeta hi és igual: el vent, la humitat, la sensació i els botons.
        expect(screen.getByText('Dinàmica de Vent')).toBeTruthy();
        expect(screen.getByRole('button', { name: /radar/i })).toBeTruthy();
    });

    it('amb `hideRadarButton` (el Radar és a la barra de pestanyes), sense RADAR; el model HD i l\'estrella hi són', () => {
        const props = {
            data, effectiveCode: 1, unit: 'C' as const, lang: 'ca' as const, isFavorite: false, onToggleFavorite: () => {},
            onShowRadar: () => {}, onShowRegionalModel: () => {}, aqiData: null,
            activeRegionalModel: { label: 'AROME HD' } as never,
        };
        const { rerender } = render(<CurrentWeather {...props} />);
        expect(screen.getByRole('button', { name: /radar/i })).toBeTruthy();
        rerender(<CurrentWeather {...props} hideRadarButton />);
        expect(screen.queryByRole('button', { name: /radar/i })).toBeNull();
        expect(screen.getByRole('button', { name: /AROME HD/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Afegir als favorits' })).toBeTruthy();
    });

    it('sense Radar ni model HD, l\'estrella sola, a la dreta', () => {
        render(
            <CurrentWeather
                data={data} effectiveCode={1} unit="C" lang="ca" isFavorite={false} onToggleFavorite={() => {}}
                onShowRadar={() => {}} onShowRegionalModel={() => {}} aqiData={null} hideRadarButton
            />
        );
        const star = screen.getByRole('button', { name: 'Afegir als favorits' });
        expect(star.parentElement!.className).toContain('justify-end');
        expect(star.parentElement!.querySelectorAll('button')).toHaveLength(1);
    });

    it('compacta però a partir de 768 px: la targeta de sempre', () => {
        window.matchMedia = vi.fn().mockReturnValue({
            matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        }) as unknown as typeof window.matchMedia;
        renderCard(true);
        expect(iconBesideTemperature()).toBe(false);
        expect(screen.getByTestId('weather-icon').getAttribute('data-size')).toContain('w-40');
    });
});
