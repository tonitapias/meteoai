import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// El hook del model global (consens) fa la seva pròpia petició: aquí només es mira quan es demana.
const { fetchGlobalModelByCoords } = vi.hoisted(() => ({ fetchGlobalModelByCoords: vi.fn() }));
vi.mock('../hooks/useGlobalModel', () => ({
    useGlobalModel: () => ({
        globalData: null,
        loadingGlobalModel: false,
        fetchGlobalModelByCoords,
        clearGlobalModel: vi.fn(),
    }),
}));

import ExpertWidgets from './ExpertWidgets';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const noop = () => {};

// Girona (zona d'AROME HD: hi ha comparació amb el global).
const buildWeather = (offline: boolean): ExtendedWeatherData => ({
    current: { time: '2026-09-27T12:00', weather_code: 1, temperature_2m: 20, relative_humidity_2m: 60, wind_speed_10m: 5, is_day: 1 },
    hourly: { time: ['2026-09-27T12:00'], temperature_2m: [20] },
    daily: { time: ['2026-09-27'] },
    hourlyComparison: {},
    location: { name: 'Girona', latitude: 41.98, longitude: 2.82 },
    ...(offline ? { offlineSnapshot: { savedAt: 1, issuedAt: '2026-09-27T09:00', distanceKm: null } } : {}),
} as unknown as ExtendedWeatherData);

const expert = (offline: boolean) => (
    <ExpertWidgets
        weatherData={buildWeather(offline)} aqiData={null} lang="ca" unit="C" freezingLevel={null}
        onShowSolarModal={noop} onShowMoonModal={noop} onShowStormModal={noop} onShowAqiModal={noop}
        onShowUvModal={noop} onShowPressureModal={noop} onShowComfortModal={noop} onShowVisibilityModal={noop}
        onShowCloudLayersModal={noop} onShowSnowLevelModal={noop} onShowWindModal={noop}
    />
);

describe('ExpertWidgets → comparació amb el model global i previsió desada', () => {
    beforeEach(() => { fetchGlobalModelByCoords.mockClear(); });

    it('amb la previsió desada (sense connexió) no es demana el model global', () => {
        render(expert(true));
        expect(fetchGlobalModelByCoords).not.toHaveBeenCalled();
    });

    it('quan torna la previsió nova del mateix lloc, es demana', () => {
        const { rerender } = render(expert(true));
        rerender(expert(false));
        expect(fetchGlobalModelByCoords).toHaveBeenCalledTimes(1);
        expect(fetchGlobalModelByCoords).toHaveBeenCalledWith(41.98, 2.82);
    });
});
