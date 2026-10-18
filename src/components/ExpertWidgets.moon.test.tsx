import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// El hook del model global (consens) fa la seva pròpia petició: aquí no interessa.
vi.mock('../hooks/useGlobalModel', () => ({
    useGlobalModel: () => ({ globalData: null, loadingGlobalModel: false, fetchGlobalModelByCoords: vi.fn(), clearGlobalModel: vi.fn() }),
}));

import ExpertWidgets from './ExpertWidgets';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const noop = () => {};

// Barcelona (CEST, UTC+2). current.time és hora LOCAL: abans es llegia com a UTC (2 h de desfasament).
const weather = (currentTime: string): ExtendedWeatherData => ({
    current: { time: currentTime, weather_code: 1, temperature_2m: 20, relative_humidity_2m: 60, wind_speed_10m: 5, is_day: 1 },
    hourly: { time: [currentTime], temperature_2m: [20] },
    daily: { time: [currentTime.slice(0, 10)] },
    location: { name: 'Barcelona', latitude: 41.3888, longitude: 2.159 },
    timezone: 'Europe/Madrid',
    utc_offset_seconds: 7200,
} as unknown as ExtendedWeatherData);

const renderAt = (now: number, currentTime: string) => render(
    <ExpertWidgets
        weatherData={weather(currentTime)} aqiData={null} lang="ca" unit="C" freezingLevel={null} now={now}
        onShowSolarModal={noop} onShowMoonModal={noop} onShowStormModal={noop} onShowAqiModal={noop}
        onShowUvModal={noop} onShowPressureModal={noop} onShowComfortModal={noop} onShowVisibilityModal={noop}
        onShowCloudLayersModal={noop} onShowSnowLevelModal={noop} onShowWindModal={noop}
    />
);

describe('ExpertWidgets → giny Fase lunar a l\'hora real', () => {
    it('al quart creixent real (18-10-2026 16:12 UTC, USNO) marca el 50 %', () => {
        // Amb la fórmula antiga i current.time (18:15 local) llegit com a UTC: 52 %.
        renderAt(Date.UTC(2026, 9, 18, 16, 12), '2026-10-18T18:15');
        expect(screen.getByText('50%')).toBeTruthy();
        expect(screen.getByText('Quart Creixent')).toBeTruthy();
    });

    it('l\'edat són els dies des de la lluna nova real (10-10 15:50 UTC), no fase × 29,53', () => {
        // 18-10 15:00 UTC: 7,97 dies. Abans: "Dia 7".
        renderAt(Date.UTC(2026, 9, 18, 15, 0), '2026-10-18T17:00');
        expect(screen.getByText('Dia 8')).toBeTruthy();
    });

    it('la fase surt del rellotge de l\'app, no de l\'hora de la previsió', () => {
        // Lluna plena real: 26-10-2026 04:12 UTC. Una previsió de 3 dies abans no hi ha d'influir.
        renderAt(Date.UTC(2026, 9, 26, 4, 12), '2026-10-23T09:00');
        expect(screen.getByText('100%')).toBeTruthy();
        expect(screen.getByText('Lluna Plena')).toBeTruthy();
    });
});
