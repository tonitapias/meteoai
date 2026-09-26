import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StormModal from './StormModal';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

/**
 * 24 hores d'estiu: CAPE baix fins a les 14 h i 1.800 J/kg de 15 a 18 h (pic a les 17 h). El cisallament surt dels vents
 * d'ECMWF a 10 m i a 500 hPa: a les 17 h, 20 km/h del sud a baix i 60 km/h de l'oest a dalt (≈ 63 km/h, moderat).
 */
const buildWeather = (opts: { withUpperWind?: boolean } = {}): ExtendedWeatherData => {
    const n = 24;
    const time = Array.from({ length: n }, (_, i) => `2026-07-10T${String(i).padStart(2, '0')}:00`);
    const cape = time.map((_, i) => (i >= 15 && i <= 18 ? (i === 17 ? 1800 : 1400) : 200));
    const ecmwfRow = (i: number) => ({
        wind_speed_10m: i === 17 ? 20 : 10,
        wind_direction_10m: i === 17 ? 180 : 90,
        wind_speed_500hPa: opts.withUpperWind === false ? null : (i === 17 ? 60 : 10),
        wind_direction_500hPa: opts.withUpperWind === false ? null : (i === 17 ? 270 : 90),
    });
    return {
        current: { time: '2026-07-10T00:00', cape: 200 },
        hourly: {
            time, cape,
            precipitation_probability: time.map(() => 10),
            freezing_level_height: time.map(() => 3800),
        },
        daily: {},
        hourlyComparison: { ecmwf: time.map((_, i) => ecmwfRow(i)), gfs: [], icon: [], aifs: [] },
    } as unknown as ExtendedWeatherData;
};

describe('StormModal — cisallament', () => {
    it('la pròxima finestra de tempesta diu el cisallament al pic de CAPE i com s\'organitzarien les tempestes', () => {
        render(<StormModal weatherData={buildWeather()} onClose={() => {}} lang="ca" />);
        const line = screen.getByTestId('storm-peak-shear');
        expect(line.textContent).toContain(`Cisallament 0–6 km ${Math.round(Math.hypot(60, 20))} km/h`);
        expect(line.textContent).toContain('Tempestes organitzades possibles (multicèl·lules)');
    });

    it('la targeta "Cisallament ara" mostra el de l\'hora actual (vent igual a baix i a dalt: 0)', () => {
        const { container } = render(<StormModal weatherData={buildWeather()} onClose={() => {}} lang="ca" />);
        expect(container.textContent).toContain('Cisallament ara');
        expect(container.textContent).toContain('km/h · 0–6 km');
    });

    it('sense vent a 500 hPa no s\'inventa cap cisallament: sense línia i "--" a la targeta', () => {
        const { container } = render(<StormModal weatherData={buildWeather({ withUpperWind: false })} onClose={() => {}} lang="ca" />);
        expect(screen.queryByTestId('storm-peak-shear')).toBeNull();
        expect(container.textContent).toContain('Cisallament ara--');
    });

    it('en anglès', () => {
        render(<StormModal weatherData={buildWeather()} onClose={() => {}} lang="en" />);
        expect(screen.getByTestId('storm-peak-shear').textContent).toContain('Organised storms possible (multicells)');
    });
});
