import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DayDetailModal from './DayDetailModal';
import ForecastSection from './ForecastSection';
import TrendChartModal from './TrendChartModal';
import { injectHighResModels } from '../utils/regionalModelEngine';
import { generateHourlyChartData } from '../utils/weatherMappers';
import { REGIONAL_MODELS } from '../constants/regionalModels';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

vi.mock('./WeatherIcons', () => ({
    getWeatherIcon: (code: number | null) => <div data-testid="day-icon" data-code={String(code)} />,
}));
vi.mock('./SmartForecastCharts', () => ({ default: () => <div data-testid="smart-charts" /> }));

const AROME_MODEL = REGIONAL_MODELS.find(m => m.id === 'AROME_HD')!;

// 8 dies (21-28 de setembre): el gràfic de tendència en necessita 8. El model global diu 10 % de pluja tot el temps.
const DAYS = 8;
const DATES = Array.from({ length: DAYS }, (_, i) => `2026-09-${21 + i}`);
const HOURS = DATES.flatMap(d => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
const flat = (n: number, v: number) => Array.from({ length: n }, () => v);
const perDay = (v: number) => flat(DAYS, v);

const baseData = () => ({
    latitude: 41.55, longitude: 2.11, utc_offset_seconds: 7200, timezone: 'Europe/Madrid', elevation: 200,
    location: { name: 'Sabadell', latitude: 41.55, longitude: 2.11 },
    current: { time: HOURS[0], temperature_2m: 22, is_day: 1 },
    hourly: {
        time: [...HOURS],
        temperature_2m: HOURS.map(() => 24),
        is_day: HOURS.map((_, i) => (i % 24 >= 7 && i % 24 <= 19 ? 1 : 0)),
        wind_speed_10m: flat(HOURS.length, 8),
        cloud_cover_low: flat(HOURS.length, 0), cloud_cover_mid: flat(HOURS.length, 0), cloud_cover_high: flat(HOURS.length, 0),
        weather_code: flat(HOURS.length, 0),
        precipitation: flat(HOURS.length, 0),
        precipitation_probability: flat(HOURS.length, 10),
    },
    daily: {
        time: [...DATES],
        weather_code: perDay(0),
        temperature_2m_max: perDay(28), temperature_2m_min: perDay(18),
        precipitation_sum: perDay(0),
        precipitation_probability_max: perDay(10),
        wind_speed_10m_max: perDay(10),
        snowfall_sum: perDay(0),
        sunrise: DATES.map(d => `${d}T07:39`), sunset: DATES.map(d => `${d}T19:49`),
        uv_index_max: perDay(5),
    },
}) as unknown as ExtendedWeatherData;

// El model regional (AROME HD) cobreix 48 h i preveu 1,2 mm a les 14, 15 i 16 h del 22 de setembre (índex de dia 1): 3,6 mm.
const regionalData = () => {
    const times = HOURS.slice(0, 48);
    return {
        current: { temperature_2m: 23 },
        hourly: {
            time: times,
            temperature_2m: times.map(() => 25),
            precipitation: times.map((_, i) => (i >= 24 + 14 && i <= 24 + 16 ? 1.2 : 0)),
        },
    } as unknown as ExtendedWeatherData;
};

const withRegional = () => injectHighResModels(baseData(), regionalData(), AROME_MODEL);

const renderList = (data: ExtendedWeatherData) =>
    render(
        <ForecastSection
            chartData={generateHourlyChartData(data, 0, 'C') as never}
            dailyData={data.daily}
            weeklyExtremes={{ min: 10, max: 35 }}
            lang="ca"
            onDayClick={() => {}}
            latitude={41.55}
        />
    );

const renderTrend = (data: ExtendedWeatherData) =>
    render(
        <TrendChartModal
            isOpen
            onClose={() => {}}
            dailyData={data.daily}
            chartData={generateHourlyChartData(data, 0, 'C') as never}
            lang="ca"
            latitude={41.55}
        />
    );

const renderDetail = (data: ExtendedWeatherData) =>
    render(<DayDetailModal weatherData={data} selectedDayIndex={1} onClose={() => {}} unit="C" lang="ca" />);

describe("pluja regional: la probabilitat i el total d'un dia són els MATEIXOS a la llista, al gràfic de tendència i al detall", () => {
    it('sense model regional la llista diu el 10 % i cap pluja del model global (referència)', () => {
        renderList(baseData());
        expect(screen.queryByText('20%')).toBeNull();
        expect(screen.queryByText('4 mm')).toBeNull();
        expect(screen.getAllByText('10%').length).toBeGreaterThan(0);
    });

    it("amb l'evidència regional el 22 de setembre és del 20 % (no del 70 %) i porta 4 mm a la llista", () => {
        renderList(withRegional());
        // La primera fila de la llista és el dia 1 (22 de setembre); els altres dies segueixen al 10 %.
        expect(screen.getAllByText('20%')).toHaveLength(1);
        expect(screen.queryByText('70%')).toBeNull();
        expect(screen.getAllByText('10%').length).toBeGreaterThan(0);
        // 3,6 mm = la suma de les tres hores de pluja de la taula (abans: 0 mm del model global).
        expect(screen.getByText('4 mm')).toBeTruthy();
    });

    it('i el mateix 20 % i 4 mm surten al gràfic de tendència', () => {
        renderTrend(withRegional());
        const firstDay = screen.getAllByTestId('trend-day')[0];
        expect(firstDay.textContent).toContain('20%');
        expect(firstDay.querySelector('[data-testid="precip-amount"]')?.textContent).toBe('4 mm');
        expect(screen.getAllByTestId('trend-day')[1].textContent).not.toContain('20%');
    });

    it('i al detall del dia', () => {
        renderDetail(withRegional());
        expect(screen.getByTestId('note-precip').textContent).toBe('PROB. MÀX 20%');
        expect(screen.getByTestId('note-precip').parentElement?.textContent).toContain('4mm');
    });

    it("els tres coincideixen en un dia que l'evidència no ha tocat", () => {
        const data = withRegional();
        const list = renderList(data);
        expect(screen.getAllByText('10%').length).toBeGreaterThan(0);
        list.unmount();

        renderTrend(data);
        expect(screen.getAllByTestId('trend-day')[1].textContent).toContain('10%');
        expect(screen.getAllByTestId('trend-day')[1].textContent).not.toContain('mm');
    });
});
