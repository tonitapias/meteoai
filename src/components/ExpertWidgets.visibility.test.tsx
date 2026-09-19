import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Sense xarxa: el hook del model global (consens) no fa cap petició real.
vi.mock('../hooks/useGlobalModel', () => ({
    useGlobalModel: () => ({
        globalData: null,
        loadingGlobalModel: false,
        fetchGlobalModelByCoords: vi.fn(),
        clearGlobalModel: vi.fn(),
    }),
}));

import ExpertWidgets from './ExpertWidgets';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

const noop = () => {};

// Nit amb el senyal de boira d'ICON (visibilitat 840 m) que la saturació (HR 94 %) NO confirma.
const buildWeather = (): ExtendedWeatherData => {
    const n = 24;
    const arr = <T,>(v: T) => Array.from({ length: n }, () => v);
    return {
        elevation: 504,
        latitude: 41.93, longitude: 2.25,
        current: {
            time: '2026-09-19T00:00', weather_code: 45, temperature_2m: 15.2, relative_humidity_2m: 94,
            wind_speed_10m: 3, is_day: 0, precipitation: 0, visibility: 840, pressure_msl: 1015,
            cloud_cover_low: 0, cloud_cover_mid: 0, cloud_cover_high: 0,
        },
        hourly: {
            time: Array.from({ length: n }, (_, i) => `2026-09-19T${String(i).padStart(2, '0')}:00`),
            weather_code: arr(45), visibility: arr(840), temperature_2m: arr(15.2), relative_humidity_2m: arr(94),
            precipitation: arr(0), cape: arr(0), pressure_msl: arr(1015),
        },
        daily: { time: ['2026-09-19'] }, hourlyComparison: {},
        location: { latitude: 41.93, longitude: 2.25 },
    } as unknown as ExtendedWeatherData;
};

const renderExpert = (effectiveCode: number | null) => render(
    <ExpertWidgets
        weatherData={buildWeather()} aqiData={null} lang="ca" unit="C" freezingLevel={null}
        onShowSolarModal={noop} onShowMoonModal={noop} onShowStormModal={noop} onShowAqiModal={noop}
        onShowUvModal={noop} onShowPressureModal={noop} onShowComfortModal={noop} onShowVisibilityModal={noop}
        onShowCloudLayersModal={noop} onShowSnowLevelModal={noop} onShowWindModal={noop}
        effectiveCode={effectiveCode}
    />
);

describe('ExpertWidgets → giny de Visibilitat (cablejat del codi efectiu)', () => {
    it('amb el codi efectiu de la capçalera SENSE boira (3), el giny mostra "≥2" i "Calitja"', () => {
        const { container } = renderExpert(3);
        const text = container.textContent ?? '';
        expect(text).toContain('≥2');
        expect(text).toContain('Calitja');
    });

    it('amb el codi efectiu de boira (45), el giny mostra el valor del model i "Boira"', () => {
        const { container } = renderExpert(45);
        const text = container.textContent ?? '';
        expect(text).toContain('0.8');
        expect(text).toContain('Boira');
    });
});
