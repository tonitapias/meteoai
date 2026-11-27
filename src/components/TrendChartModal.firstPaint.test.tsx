// El gràfic de temperatures s'obre en dos temps (INP): al primer frame només el marc (fons, targeta, títol i creu) i,
// després del primer pintat, els 7 dies. Els dies mateixos els prova TrendChartModal.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import TrendChartModal from './TrendChartModal';
import type { StrictDailyWeather } from '../types/weatherLogicTypes';

vi.mock('./WeatherIcons', () => ({ getWeatherIcon: () => <div data-testid="day-icon" /> }));

const DATES = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
const daily = {
    time: DATES,
    weather_code: DATES.map(() => 0),
    temperature_2m_max: [25, 24, 26, 28, 30, 27, 25, 23],
    temperature_2m_min: [12, 12, 13, 14, 15, 13, 12, 11],
    precipitation_probability_max: DATES.map(() => 10),
    precipitation_sum: DATES.map(() => 0),
    wind_speed_10m_max: DATES.map(() => 10),
} as unknown as StrictDailyWeather;

const renderModal = (onClose = () => {}) =>
    render(<TrendChartModal isOpen onClose={onClose} dailyData={daily} chartData={[]} lang="ca" latitude={41.9} />);

describe('TrendChartModal → primer el marc, després els dies', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('al primer frame hi ha el diàleg amb el títol i la creu, i encara cap dia; després del pintat, els 7', async () => {
        renderModal();

        const dialog = screen.getByRole('dialog');
        expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
        expect(screen.queryAllByTestId('trend-column')).toHaveLength(0);

        await act(async () => { vi.advanceTimersByTime(40); });

        expect(screen.getAllByTestId('trend-column')).toHaveLength(7);
        // El mateix element: React reaprofita el marc.
        expect(screen.getByRole('dialog')).toBe(dialog);
    });

    it('la creu ja tanca durant el primer frame', () => {
        const onClose = vi.fn();
        renderModal(onClose);
        fireEvent.click(screen.getByRole('button', { name: /tancar/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('tancat no hi ha res', () => {
        render(<TrendChartModal isOpen={false} onClose={() => {}} dailyData={daily} chartData={[]} lang="ca" />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
