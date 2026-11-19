// src/components/ComfortModal.test.tsx
// Modal de Confort: escala a l'eix vertical del gràfic del punt de rosada, en el rang real (també per sota de −5 °C,
// on abans el gràfic retallava les dades).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import ComfortModal from './ComfortModal';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const makeWeather = (dew: number[]): ExtendedWeatherData => ({
    current: { time: '2026-11-19T12:00', temperature_2m: 5, relative_humidity_2m: 60, is_day: 1 },
    hourly: {
        time: dew.map((_, i) => `2026-11-19T${String(12 + i).padStart(2, '0')}:00`),
        dew_point_2m: dew,
        relative_humidity_2m: dew.map(() => 60),
    },
    daily: {},
} as unknown as ExtendedWeatherData);

const ticks = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-tick]')];

afterEach(cleanup);

describe("ComfortModal — escala a l'eix vertical", () => {
    it('estiu: línies cada 10 °C dins del rang del gràfic (de −5 als llindars)', () => {
        const { container } = render(<ComfortModal weatherData={makeWeather([15, 18, 20])} currentDewPoint={15} onClose={() => {}} lang="ca" />);
        expect(ticks(container).map(t => t.textContent)).toEqual(['0°', '10°', '20°']);
    });

    it('hivern sec: el gràfic baixa fins a les dades (abans es retallava a −5 °C) i l\'escala ho diu', () => {
        const { container } = render(<ComfortModal weatherData={makeWeather([-12, -10, -8])} currentDewPoint={-12} onClose={() => {}} lang="ca" />);
        const labels = ticks(container);
        expect(labels.map(t => t.textContent)).toEqual(['-10°', '0°', '10°', '20°']);
        // El punt d'ara (−12 °C) queda per sota de la línia de −10, no enganxat a −5.
        const nowDot = [...container.querySelectorAll<HTMLElement>('span.absolute.w-3.h-3')].find(s => s.style.left === '0%')!;
        expect(parseFloat(nowDot.style.top)).toBeGreaterThan(parseFloat(labels[0].style.top));
    });
});
