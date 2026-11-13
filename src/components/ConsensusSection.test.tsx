import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// El hook del model global fa la seva pròpia petició: aquí només es mira quan es demana i què es pinta.
const hook = vi.hoisted(() => ({
    loading: false,
    fetchGlobalModelByCoords: vi.fn(),
    clearGlobalModel: vi.fn(),
}));
vi.mock('../hooks/useGlobalModel', () => ({
    useGlobalModel: () => ({
        globalData: null,
        loadingGlobalModel: hook.loading,
        fetchGlobalModelByCoords: hook.fetchGlobalModelByCoords,
        clearGlobalModel: hook.clearGlobalModel,
    }),
}));

import ConsensusSection from './ConsensusSection';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const at = (latitude: number, longitude: number) => ({
    current: { time: '2026-11-13T12:00', weather_code: 1, temperature_2m: 20, relative_humidity_2m: 60, wind_speed_10m: 5, is_day: 1 },
    hourly: { time: ['2026-11-13T12:00'], temperature_2m: [20] },
    daily: { time: ['2026-11-13'] },
    hourlyComparison: {},
    location: { name: 'Lloc', latitude, longitude },
} as unknown as ExtendedWeatherData);

describe('ConsensusSection → amb i sense model d\'alta resolució', () => {
    beforeEach(() => {
        hook.loading = false;
        hook.fetchGlobalModelByCoords.mockClear();
        hook.clearGlobalModel.mockClear();
    });

    it('fora de cap malla HD (Buenos Aires): cap petició i la targeta de consens suspès per cobertura', () => {
        render(<ConsensusSection weatherData={at(-34.6, -58.4)} lang="ca" />);
        expect(hook.fetchGlobalModelByCoords).not.toHaveBeenCalled();
        expect(hook.clearGlobalModel).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Motor de Consens Suspès')).toBeTruthy();
        expect(screen.getByText('Cobertura Global')).toBeTruthy();
    });

    it('amb AROME (Girona) i la petició en curs: es demana el global i es veu la càrrega', () => {
        hook.loading = true;
        render(<ConsensusSection weatherData={at(41.98, 2.82)} lang="ca" />);
        expect(hook.fetchGlobalModelByCoords).toHaveBeenCalledWith(41.98, 2.82);
        expect(screen.getByText('Sincronitzant Motor de Consens...')).toBeTruthy();
    });

    it('amb AROME però sense resposta del global: comparació no disponible', () => {
        render(<ConsensusSection weatherData={at(41.98, 2.82)} lang="ca" />);
        expect(screen.getByText('Comparació No Disponible')).toBeTruthy();
    });
});
