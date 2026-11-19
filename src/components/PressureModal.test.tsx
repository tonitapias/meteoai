// src/components/PressureModal.test.tsx
// La targeta de Pressió del Detall i el modal diuen el mateix: la mateixa variació de 3 h (pressureDelta3h) i la mateixa
// classificació i nom (classifyPressureTrend). Sense les hores que calen, cap dels dos s'inventa un "Estable".
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import PressureModal from './PressureModal';
import DetailWidgetsGrid from './DetailWidgetsGrid';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// De les 9 a les 14 h; ara, les 12:15 (índex 3): 1008,2 − 1010 = −1,8 hPa en 3 h, "Baixant".
const makeWeather = (currentTime: string): ExtendedWeatherData => ({
    current: { time: currentTime, pressure_msl: 1008.0, temperature_2m: 12, is_day: 1, weather_code: 3 },
    hourly: {
        time: ['2026-11-19T09:00', '2026-11-19T10:00', '2026-11-19T11:00', '2026-11-19T12:00', '2026-11-19T13:00', '2026-11-19T14:00'],
        pressure_msl: [1010, 1009.5, 1009, 1008.2, 1007.4, 1006.9],
    },
    daily: {},
} as unknown as ExtendedWeatherData);

const noop = vi.fn();
const renderCard = (data: ExtendedWeatherData) =>
    render(
        <DetailWidgetsGrid
            weatherData={data} aqiData={null} lang="ca" unit="C" freezingLevel={null} ids={['pressure']}
            onShowSolarModal={noop} onShowMoonModal={noop} onShowStormModal={noop} onShowAqiModal={noop}
            onShowUvModal={noop} onShowPressureModal={noop} onShowComfortModal={noop} onShowVisibilityModal={noop}
            onShowCloudLayersModal={noop} onShowSnowLevelModal={noop} onShowWindModal={noop} onShowTemperatureModal={noop}
        />
    );

afterEach(cleanup);

describe('Pressió — la targeta i el modal, coherents', () => {
    it('la mateixa tendència i la mateixa variació als dos llocs', () => {
        const weather = makeWeather('2026-11-19T12:15');
        const card = within(renderCard(weather).container);
        expect(card.getByText('Baixant')).toBeTruthy();
        expect(card.getByText('-1,8 hPa · 3 h')).toBeTruthy();
        cleanup();

        const modal = within(render(<PressureModal weatherData={weather} onClose={noop} lang="ca" />).container);
        expect(modal.getByText('Baixant')).toBeTruthy();
        expect(modal.getByText('-1,8 hPa')).toBeTruthy();
    });

    it('la targeta fa servir la icona Gauge del modal, no la d\'avís', () => {
        const { container } = renderCard(makeWeather('2026-11-19T12:15'));
        expect(container.querySelector('svg.lucide-gauge')).not.toBeNull();
        expect(container.querySelector('svg[class*="octagon"]')).toBeNull();
    });

    it('sense 3 hores enrere, cap tendència: ni a la targeta ni al modal surt "Estable"', () => {
        const weather = makeWeather('2026-11-19T10:15'); // índex 1
        expect(renderCard(weather).container.textContent).not.toMatch(/Estable|· 3 h/);
        cleanup();
        const { container } = render(<PressureModal weatherData={weather} onClose={noop} lang="ca" />);
        expect(container.textContent).not.toMatch(/Estable|Tendència \(3h\)/);
        expect(container.textContent).toContain('1008'); // la pressió d'ara sí que hi és
    });
});

describe("Pressió — escala a l'eix vertical del gràfic", () => {
    it('línies guia rodones dins del rang real de la finestra (sense zero), amb la seva etiqueta', () => {
        // Finestra des de les 12 h: 1008,2 · 1007,4 · 1006,9 → rang dibuixat 1004,9-1010,2 → cada 2 hPa.
        const { container } = render(<PressureModal weatherData={makeWeather('2026-11-19T12:15')} onClose={noop} lang="ca" />);
        const labels = [...container.querySelectorAll<HTMLElement>('[data-tick]')];
        expect(labels.map(l => l.textContent)).toEqual(['1006', '1008', '1010']);
        // Cada etiqueta a la mateixa alçada (%) que la seva línia dins l'SVG (viewBox de 160 d'alt).
        const lines = [...container.querySelectorAll('svg[role="slider"] line[stroke="#94a3b8"]')];
        expect(lines).toHaveLength(3);
        lines.forEach((line, i) => {
            const pct = (Number(line.getAttribute('y1')) / 160) * 100;
            expect(parseFloat(labels[i].style.top)).toBeCloseTo(pct, 5);
        });
    });
});
