// src/components/UvModal.test.tsx
// Modal d'UV: escala a l'eix vertical del gràfic d'avui, amb l'índex en enters (com es llegeix l'UV).
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import UvModal from './UvModal';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Un dia de novembre a Barcelona: màxim 3 (cel serè 3,4) al migdia.
const uv = [0, 0, 0, 0, 0, 0, 0, 0, 0.3, 1.1, 2.1, 2.8, 3, 2.7, 2, 1.1, 0.3, 0, 0, 0, 0, 0, 0, 0];
const weather = {
    current: { time: '2026-11-19T12:00', is_day: 1 },
    hourly: {
        time: uv.map((_, i) => `2026-11-19T${String(i).padStart(2, '0')}:00`),
        uv_index: uv,
        uv_index_clear_sky: uv.map(v => v * 1.13),
    },
    daily: {},
} as unknown as ExtendedWeatherData;

describe("UvModal — escala a l'eix vertical", () => {
    it('5 i 10 (de 0 al sostre de 12), en enters: no "2,5" ni "7,5"', () => {
        const { container } = render(<UvModal weatherData={weather} currentUV={3} onClose={() => {}} lang="ca" />);
        expect([...container.querySelectorAll('[data-tick]')].map(s => s.textContent)).toEqual(['5', '10']);
    });
});
