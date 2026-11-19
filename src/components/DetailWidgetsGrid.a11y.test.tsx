// src/components/DetailWidgetsGrid.a11y.test.tsx
// Cada targeta de la graella és un botó amb nom propi ("Vent 27 km/h O · Detall", com els destacats d'Ara): abans el
// lector de pantalla llegia tot el contingut barrejat. El valor del nom és el mateix que pinta el giny; sense dada, només
// el nom del giny (mai un 0 inventat).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import DetailWidgetsGrid from './DetailWidgetsGrid';
import type { DetailWidgetId } from './detailWidgetIds';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import type { Language } from '../translations';

// Barcelona, migdia d'octubre (12:00 local, CEST).
const NOW = Date.UTC(2026, 9, 18, 10, 0);
const weather = {
    current: {
        time: '2026-10-18T12:00', weather_code: 1, temperature_2m: 19.2, apparent_temperature: 18.5, relative_humidity_2m: 60,
        wind_speed_10m: 26.6, wind_direction_10m: 289, wind_gusts_10m: 41, pressure_msl: 1007.6, visibility: 24000, is_day: 1,
        cloud_cover_low: 10, cloud_cover_mid: 0, cloud_cover_high: 30,
    },
    hourly: { time: ['2026-10-18T12:00'], temperature_2m: [19.2], apparent_temperature: [18.5], cape: [140.3] },
    daily: { time: ['2026-10-18'] },
    location: { name: 'Barcelona', latitude: 41.3888, longitude: 2.159 },
    timezone: 'Europe/Madrid',
    utc_offset_seconds: 7200,
} as unknown as ExtendedWeatherData;

// Sense cap dada: ni lectura d'ara, ni hores, ni coordenades, ni aire.
const empty = { current: { time: '2026-10-18T12:00' }, hourly: {}, daily: {} } as unknown as ExtendedWeatherData;

const noop = vi.fn();
const renderGrid = (data: ExtendedWeatherData, opts: { lang?: Language; ids?: readonly DetailWidgetId[]; aqi?: Record<string, unknown> | null; freezingLevel?: number | null } = {}) =>
    render(
        <DetailWidgetsGrid
            weatherData={data} aqiData={opts.aqi ?? null} lang={opts.lang ?? 'ca'} unit="C"
            freezingLevel={opts.freezingLevel ?? null} now={NOW} ids={opts.ids}
            onShowSolarModal={noop} onShowMoonModal={noop} onShowStormModal={noop} onShowAqiModal={noop}
            onShowUvModal={noop} onShowPressureModal={noop} onShowComfortModal={noop} onShowVisibilityModal={noop}
            onShowCloudLayersModal={noop} onShowSnowLevelModal={noop} onShowWindModal={noop} onShowTemperatureModal={noop}
        />
    );

afterEach(cleanup);

describe('DetailWidgetsGrid → nom accessible de cada targeta', () => {
    it('totes les targetes són botons amb nom, i el nom acaba en "· Detall"', () => {
        renderGrid(weather, { aqi: { current: { european_aqi: 23 } }, freezingLevel: 1500 });
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(12);
        for (const b of buttons) expect(b.getAttribute('aria-label')).toMatch(/^\S.* · Detall$/);
    });

    it('vent: la velocitat i la direcció que pinta la brúixola', () => {
        renderGrid(weather, { ids: ['wind'] });
        const card = screen.getByRole('button', { name: 'Vent 27 km/h O · Detall' });
        expect(within(card).getByText('27')).toBeTruthy();
        expect(within(card).getByText('289° O')).toBeTruthy();
    });

    it('temperatura: la xifra gran de la targeta (la de la capçalera)', () => {
        renderGrid(weather, { ids: ['temperature'] });
        const card = screen.getByRole('button', { name: 'Temperatura 19° · Detall' });
        expect(within(card).getAllByText('19°').length).toBeGreaterThan(0);
    });

    it('pressió, aire, CAPE i cota de neu, amb el valor del seu giny', () => {
        renderGrid(weather, { ids: ['pressure', 'aqi', 'cape', 'snowLevel'], aqi: { current: { european_aqi: 23 } }, freezingLevel: 1500 });
        expect(screen.getByRole('button', { name: 'Pressió 1008 hPa · Detall' })).toBeTruthy();
        expect(screen.getByRole('button', { name: "Qualitat de l'aire raonable · Detall" })).toBeTruthy();
        expect(within(screen.getByRole('button', { name: 'CAPE 140 J/kg · Detall' })).getByText('140')).toBeTruthy();
        expect(within(screen.getByRole('button', { name: 'Cota de neu 1200 m · Detall' })).getByText('1200')).toBeTruthy();
    });

    it("cicle solar: l'hora de la pròxima posta (al migdia)", () => {
        renderGrid(weather, { ids: ['sun'] });
        expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/^Cicle solar, posta de sol a les 1[89]:\d\d · Detall$/);
    });

    it("en l'idioma de l'app", () => {
        renderGrid(weather, { ids: ['wind', 'pressure'], lang: 'en' });
        expect(screen.getByRole('button', { name: 'Wind 27 km/h W · Details' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Pressure 1008 hPa · Details' })).toBeTruthy();
    });

    it('sense dades, només el nom del giny: cap xifra inventada', () => {
        renderGrid(empty, { ids: ['temperature', 'wind', 'uv', 'visibility', 'cloudLayers', 'pressure', 'dewPoint', 'cape', 'aqi', 'sun'] });
        expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual([
            'Temperatura · Detall', 'Vent · Detall', 'Índex UV · Detall', 'Visibilitat · Detall', 'Capes de núvols · Detall',
            'Pressió · Detall', 'Punt de rosada · Detall', 'CAPE · Detall', "Qualitat de l'aire · Detall", 'Cicle solar · Detall',
        ]);
    });
});
