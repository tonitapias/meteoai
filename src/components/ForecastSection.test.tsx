import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ForecastSection from './ForecastSection';
import type { StrictDailyWeather } from '../types/weatherLogicTypes';

// La icona es substitueix per un marcador amb el codi rebut: el que es prova és QUIN codi tria la setmana.
vi.mock('./WeatherIcons', () => ({
    getWeatherIcon: (code: number | null) => <div data-testid="day-icon" data-code={String(code)} />,
}));

const DATES = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];

// Codi diari cru del model per als dies 1..7 (el 0 no es mostra): pluja, pluja, neu, cel, cel, cel, cel
const RAW = [0, 63, 63, 73, 3, 0, 0, 0];

const dailyData = {
    time: DATES,
    weather_code: RAW,
    temperature_2m_max: DATES.map(() => 20),
    temperature_2m_min: DATES.map(() => 10),
    precipitation_probability_max: DATES.map(() => 40),
    precipitation_sum: DATES.map(() => 1),
    snowfall_sum: DATES.map(() => 0),
    wind_speed_10m_max: DATES.map(() => 10),
} as unknown as StrictDailyWeather;

// 24 hores per dia, amb núvols al 60 % de dia (avgClouds -> codi de cel 2)
const chartData = DATES.flatMap(date =>
    Array.from({ length: 24 }, (_, h) => ({
        time: `${date}T${String(h).padStart(2, '0')}:00`,
        temp: 15,
        precip: 0,
        cloud: 60,
        cloudLow: 60, cloudMid: 0, cloudHigh: 0,
        wind: 5,
        isDay: h >= 8 && h < 19 ? 1 : 0,
    }))
);

const codes = () => screen.getAllByTestId('day-icon').map(e => Number(e.getAttribute('data-code')));

const renderWeek = (dayHourCodes?: Record<string, Array<number | null>>) =>
    render(
        <ForecastSection
            chartData={chartData}
            dailyData={dailyData}
            dayHourCodes={dayHourCodes}
            weeklyExtremes={{ min: 0, max: 30 }}
            lang="ca"
            onDayClick={() => {}}
            latitude={41.9}
        />
    );

const day = (code: number) => Array.from({ length: 24 }, () => code);

describe('ForecastSection — la icona del dia passa pels mateixos filtres que les hores', () => {
    it('sense hores del motor, el codi diari del model queda tal com sempre (pluja, neu, cel per núvols)', () => {
        renderWeek(undefined);
        expect(codes()).toEqual([63, 63, 73, 2, 2, 2, 2]);
    });

    it('el motor filtra la pluja d\'un dia sec, converteix la neu en pluja i manté la pluja real', () => {
        renderWeek({
            '2026-09-21': [...day(3).slice(0, 10), 63, 63, ...day(3).slice(12)],   // pluja real
            '2026-09-22': day(3),                                                  // el model deia pluja, a les hores no n'hi ha
            '2026-09-23': day(63),                                                 // neu del model cru: pluja per bloqueig tèrmic
        });
        expect(codes()).toEqual([63, 2, 63, 2, 2, 2, 2]);
    });

    it('els dies que el model no marca de precipitació no en passen a tenir per una hora de pluja feble', () => {
        renderWeek({ '2026-09-24': [...day(3).slice(0, 12), 61, ...day(3).slice(13)] });
        expect(codes()[3]).toBe(2);   // el 24/09 (raw 3): cel per núvols, no pluja
    });

    it('el tipus del motor arriba a la setmana (aiguaneu i pluja engelant)', () => {
        renderWeek({ '2026-09-21': day(69), '2026-09-22': day(66) });
        expect(codes().slice(0, 2)).toEqual([69, 66]);
    });
});
