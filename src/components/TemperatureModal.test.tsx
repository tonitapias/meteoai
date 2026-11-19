// src/components/TemperatureModal.test.tsx
// El modal de Temperatura no es contradiu amb les seves pròpies xifres: una tendència "Estable" no porta un "−1°" que
// sembli una baixada, i l'amplitud d'avui és la diferència de la mínima i la màxima que es mostren al costat.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TemperatureModal from './TemperatureModal';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Juny: fora de l'hivern, la correcció d'inversió no hi toca i les xifres són les del model.
const hours = (day: string, from: number, n: number) =>
    Array.from({ length: n }, (_, i) => `${day}T${String(from + i).padStart(2, '0')}:00`);

// Mínima d'avui 20,6 (es mostra 21°) i màxima 25,4 (es mostra 25°): 4,8° de diferència real, 4° a la vista.
const TEMPS = [20.6, 22, 24, 25, 25.4, 25, 24, 22];

const makeWeather = (nowTemp: number): ExtendedWeatherData => ({
    current: {
        time: '2026-06-10T12:15', temperature_2m: nowTemp, apparent_temperature: nowTemp, relative_humidity_2m: 55,
        wind_speed_10m: 8, is_day: 1, weather_code: 1, cloud_cover_low: 10, cloud_cover_mid: 0, cloud_cover_high: 0,
    },
    hourly: {
        time: hours('2026-06-10', 10, 8),
        temperature_2m: TEMPS,
        apparent_temperature: TEMPS,
        relative_humidity_2m: [60, 58, 55, 50, 48, 45, 50, 60],
        wind_speed_10m: [5, 6, 8, 10, 12, 12, 10, 8],
        is_day: [1, 1, 1, 1, 1, 1, 1, 1],
    },
    daily: { time: ['2026-06-10'], temperature_2m_max: [25.4], temperature_2m_min: [20.6] },
    location: { name: 'Girona', latitude: 41.98, longitude: 2.82 },
} as unknown as ExtendedWeatherData);

/** El text que va just després d'una etiqueta (el valor de la tendència o d'una targeta d'estadística). */
const valueAfter = (container: HTMLElement, label: string) =>
    [...container.querySelectorAll('span')].find(s => s.textContent === label)?.nextElementSibling?.textContent;

describe('TemperatureModal — coherència de les xifres', () => {
    it('una tendència estable (+0,6° en 3 h) diu "Estable" sense xifra, com el giny', () => {
        // Ara 24,4 i d'aquí a 3 h (15:00) 25: +0,6 s'arrodoniria a "+1°".
        const { container } = render(<TemperatureModal weatherData={makeWeather(24.4)} unit="C" onClose={() => {}} lang="ca" />);
        expect(valueAfter(container, 'Tendència (3h)')).toBe('Estable');
    });

    it('una tendència clara porta la variació', () => {
        const { container } = render(<TemperatureModal weatherData={makeWeather(22)} unit="C" onClose={() => {}} lang="ca" />);
        expect(valueAfter(container, 'Tendència (3h)')).toBe('Pujant · +3°');
    });

    it("l'amplitud d'avui és la diferència de les dues xifres que es mostren (21° → 25° fa 4°, no 5°)", () => {
        const { container } = render(<TemperatureModal weatherData={makeWeather(24.4)} unit="C" onClose={() => {}} lang="ca" />);
        expect(valueAfter(container, 'Amplitud avui')).toBe('4°');
        expect(container.textContent).toContain('21° → 25°');
    });
});
