// El detall del dia s'obre en dos temps (INP): al primer frame només el marc (fons, barra i creu) i, després del primer
// pintat, el contingut. El contingut mateix el proven DayDetailModal.test.tsx i regionalRainParity.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import DayDetailModal from './DayDetailModal';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

vi.mock('./WeatherIcons', () => ({ getWeatherIcon: () => <div data-testid="day-icon" /> }));
vi.mock('./SmartForecastCharts', () => ({ default: () => <div data-testid="smart-charts" /> }));
vi.mock('../hooks/useOfficialAlerts', () => ({ useOfficialAlerts: () => ({ alerts: [] }) }));

const TIME = Array.from({ length: 48 }, (_, i) => `2026-09-${21 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`);
const data = {
    latitude: 41.55, longitude: 2.11, utc_offset_seconds: 7200, timezone: 'Europe/Madrid', elevation: 200,
    location: { name: 'Sabadell', latitude: 41.55, longitude: 2.11 },
    current: { time: '2026-09-21T12:00', temperature_2m: 22, is_day: 1 },
    hourly: {
        time: TIME,
        temperature_2m: TIME.map(() => 20),
        is_day: TIME.map((_, i) => (i % 24 >= 7 && i % 24 <= 19 ? 1 : 0)),
        weather_code: TIME.map(() => 0),
        precipitation: TIME.map(() => 0),
        precipitation_probability: TIME.map(() => 0),
        wind_speed_10m: TIME.map(() => 5),
        wind_gusts_10m: TIME.map(() => 10),
    },
    daily: {
        time: ['2026-09-21', '2026-09-22'],
        weather_code: [0, 0],
        temperature_2m_max: [24, 25], temperature_2m_min: [15, 16],
        precipitation_sum: [0, 0],
        sunrise: ['2026-09-21T07:39', '2026-09-22T07:40'],
        sunset: ['2026-09-21T19:49', '2026-09-22T19:47'],
    },
} as unknown as ExtendedWeatherData;

describe('DayDetailModal → primer el marc, després el contingut', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('al primer frame hi ha el diàleg amb la creu i encara cap xifra; després del pintat, el dia', async () => {
        render(<DayDetailModal weatherData={data} selectedDayIndex={1} onClose={() => {}} unit="C" lang="ca" />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tancar finestra' })).toBeInTheDocument();
        expect(screen.queryByTestId('day-max')).toBeNull();

        const dialog = screen.getByRole('dialog');
        await act(async () => { vi.advanceTimersByTime(40); });

        expect(screen.getByTestId('day-max')).toBeInTheDocument();
        // El mateix element: el fade-in no torna a començar.
        expect(screen.getByRole('dialog')).toBe(dialog);
    });

    it('la creu ja tanca durant el primer frame', () => {
        const onClose = vi.fn();
        render(<DayDetailModal weatherData={data} selectedDayIndex={1} onClose={onClose} unit="C" lang="ca" />);
        fireEvent.click(screen.getByRole('button', { name: 'Tancar finestra' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
