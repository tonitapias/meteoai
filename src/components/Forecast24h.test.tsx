// src/components/Forecast24h.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Forecast24h from './Forecast24h';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

// 19:26 a Girona (UTC+1 a l'octubre, però amb utc_offset 0 la cerca de l'hora actual va directament per UTC).
const hours = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 26, 19 + i));
    return d.toISOString().slice(0, 16);
});

const makeData = (withCurrent: boolean): ExtendedWeatherData => ({
    utc_offset_seconds: 0,
    elevation: 78,
    location: { name: 'Girona', country: 'ES', latitude: 41.98, longitude: 2.82 },
    // De dia i amb vent: sense correcció d'inversió, les xifres es veuen tal com venen.
    current: withCurrent
        ? { time: '2026-10-26T19:15', temperature_2m: 18.2, is_day: 1, wind_speed_10m: 10, cloud_cover_low: 0, cloud_cover_mid: 0, cloud_cover_high: 0, weather_code: 0 }
        : undefined,
    hourly: {
        time: hours,
        // L'hora de les 19 h diu 19,1° (la capçalera, 18,2°); la de les 20 h, 17,4°.
        temperature_2m: hours.map((_, i) => (i === 0 ? 19.1 : i === 1 ? 17.4 : 15)),
        weather_code: hours.map(() => 0),
        is_day: hours.map(() => 1),
        wind_speed_10m: hours.map(() => 10),
        cloud_cover: hours.map(() => 0),
        cloud_cover_low: hours.map(() => 0),
        cloud_cover_mid: hours.map(() => 0),
        cloud_cover_high: hours.map(() => 0),
        precipitation: hours.map(() => 0),
        precipitation_probability: hours.map(() => 0)
    }
} as unknown as ExtendedWeatherData);

const nowCardTemp = () => screen.getByText('ARA').parentElement?.textContent ?? '';

describe('Forecast24h — targeta "ARA"', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(Date.UTC(2026, 9, 26, 19, 26)));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('mostra la temperatura de la capçalera (`current`), no la de l\'hora en punt', () => {
        render(<Forecast24h data={makeData(true)} lang="ca" />);
        expect(nowCardTemp()).toContain('18°');
        expect(nowCardTemp()).not.toContain('19°');
    });

    it('la resta d\'hores segueixen la sèrie horària', () => {
        render(<Forecast24h data={makeData(true)} lang="ca" />);
        expect(screen.getByText('17°')).toBeInTheDocument();
    });

    it('sense `current`, la targeta "ARA" es queda amb l\'hora en punt', () => {
        render(<Forecast24h data={makeData(false)} lang="ca" />);
        expect(nowCardTemp()).toContain('19°');
    });
});
