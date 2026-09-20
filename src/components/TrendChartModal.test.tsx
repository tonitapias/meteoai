import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrendChartModal from './TrendChartModal';
import ForecastSection from './ForecastSection';
import type { StrictDailyWeather } from '../types/weatherLogicTypes';

vi.mock('./WeatherIcons', () => ({
    getWeatherIcon: (code: number | null) => <div data-testid="day-icon" data-code={String(code)} />,
}));

const SEPT = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
const JAN = ['2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16', '2026-01-17'];

// Dies 1..7 (el 0 no es mostra). El dia 3 (índex 3) no és cap extrem de la setmana:
// treure'l no ha de moure l'escala dels altres.
const MAX = [25, 24, 26, 28, 30, 27, 25, 23];
const MIN = [12, 12, 13, 14, 15, 13, 12, 11];

const makeDaily = (dates: string[], overrides: Partial<Record<string, Array<number | null>>> = {}) =>
    ({
        time: dates,
        weather_code: dates.map(() => 0),
        temperature_2m_max: MAX,
        temperature_2m_min: MIN,
        precipitation_probability_max: dates.map(() => 10),
        precipitation_sum: dates.map(() => 0),
        wind_speed_10m_max: dates.map(() => 10),
        ...overrides,
    }) as unknown as StrictDailyWeather;

const renderModal = (dailyData: StrictDailyWeather, chartData: Array<Record<string, unknown>> = []) =>
    render(
        <TrendChartModal
            isOpen
            onClose={() => {}}
            dailyData={dailyData}
            chartData={chartData as never}
            lang="ca"
            latitude={41.9}
        />
    );

const columns = () => screen.getAllByTestId('trend-column') as HTMLElement[];
const columnBox = (c: HTMLElement) => ({ top: c.style.top, bottom: c.style.bottom });

// 24 hores per dia: nit (isDay 0) a `night`, dia (isDay 1) a `day`, amb cel serè i `wind` km/h.
const hoursFor = (dates: string[], night: number, day: number, wind: number) =>
    dates.flatMap(date =>
        Array.from({ length: 24 }, (_, h) => ({
            time: `${date}T${String(h).padStart(2, '0')}:00`,
            temp: h >= 8 && h < 19 ? day : night,
            precip: 0, cloud: 0, cloudLow: 0, cloudMid: 0, cloudHigh: 0, wind,
            isDay: h >= 8 && h < 19 ? 1 : 0,
        }))
    );

describe('TrendChartModal — dades absents', () => {
    it('amb totes les dades, pinta 7 columnes amb les xifres del model', () => {
        renderModal(makeDaily(SEPT));
        expect(columns()).toHaveLength(7);
        expect(screen.queryByText('--°')).toBeNull();
        expect(screen.getByText('30°')).toBeTruthy();
        expect(screen.getByText('11°')).toBeTruthy();
    });

    it('un dia sense màxima ni mínima mostra "--°" i no un 0° inventat', () => {
        renderModal(makeDaily(SEPT, {
            temperature_2m_max: [25, 24, 26, null, 30, 27, 25, 23],
            temperature_2m_min: [12, 12, 13, null, 15, 13, 12, 11],
        }));
        expect(screen.getAllByText('--°')).toHaveLength(2);
        expect(screen.queryByText('0°')).toBeNull();
    });

    it('un dia sense dada no deforma l\'escala: els altres dies queden exactament al mateix lloc', () => {
        const { unmount } = renderModal(makeDaily(SEPT));
        const complete = columns().map(columnBox);
        unmount();

        renderModal(makeDaily(SEPT, {
            temperature_2m_max: [25, 24, 26, null, 30, 27, 25, 23],
            temperature_2m_min: [12, 12, 13, null, 15, 13, 12, 11],
        }));
        const withGap = columns().map(columnBox);

        expect(withGap.filter((_, i) => i !== 2)).toEqual(complete.filter((_, i) => i !== 2));
        expect(withGap[2]).not.toEqual(complete[2]);
    });

    it('si només falta la màxima, la mínima que hi ha es mostra i la màxima és "--°"', () => {
        renderModal(makeDaily(SEPT, {
            temperature_2m_max: [25, 24, 26, null, 30, 27, 25, 23],
        }));
        expect(screen.getAllByText('--°')).toHaveLength(1);
        expect(screen.getByText('14°')).toBeTruthy();
    });

    it('sense cap dia complet el modal no peta i tot són "--°"', () => {
        renderModal(makeDaily(SEPT, {
            temperature_2m_max: SEPT.map(() => null),
            temperature_2m_min: SEPT.map(() => null),
        }));
        expect(columns()).toHaveLength(7);
        expect(screen.getAllByText('--°')).toHaveLength(14);
    });

    it('una probabilitat de pluja que falta és "--", no un "0%" que afirmaria un dia sec', () => {
        renderModal(makeDaily(SEPT, { precipitation_probability_max: [0, 0, 40, null, 0, 0, 0, 10] }));
        expect(screen.getByText('40%')).toBeTruthy();
        expect(screen.getAllByText('--')).toHaveLength(1);
        // Un 0% real continua sent un 0%.
        expect(screen.getAllByText('0%')).toHaveLength(4);
    });
});

describe('TrendChartModal — mateixes xifres que la llista de 7 dies', () => {
    // Nit d'hivern serena i gairebé en calma (vent 3 km/h): la mínima crua del model és 10° i la llista
    // la corregeix per inversió tèrmica (10 - 1,75 = 8,25 -> 8°). El gràfic ha de dir el mateix.
    const daily = makeDaily(JAN, {
        temperature_2m_max: JAN.map(() => 20),
        temperature_2m_min: JAN.map(() => 10),
    });
    const chartData = hoursFor(JAN, 10, 18, 3);

    it('el gràfic aplica la correcció d\'inversió i les xifres surten de les hores', () => {
        renderModal(daily, chartData);
        expect(screen.getAllByText('8°')).toHaveLength(7);
        expect(screen.getAllByText('18°')).toHaveLength(7);
        expect(screen.queryByText('10°')).toBeNull();
        expect(screen.queryByText('20°')).toBeNull();
    });

    it('la llista mostra les mateixes xifres (8° i 18°) per a les mateixes dades', () => {
        render(
            <ForecastSection
                chartData={chartData}
                dailyData={daily}
                weeklyExtremes={{ min: 0, max: 30 }}
                lang="ca"
                onDayClick={() => {}}
                latitude={41.9}
            />
        );
        // Cada fila mostra cada xifra dues vegades (variant d'escriptori i de mòbil).
        expect(screen.getAllByText('8°')).toHaveLength(14);
        expect(screen.getAllByText('18°')).toHaveLength(14);
        expect(screen.queryByText('10°')).toBeNull();
    });
});
