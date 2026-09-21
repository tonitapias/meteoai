import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import DayDetailModal from './DayDetailModal';
import ForecastSection from './ForecastSection';
import { generateHourlyChartData } from '../utils/weatherMappers';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';

vi.mock('./WeatherIcons', () => ({
    getWeatherIcon: (code: number | null) => <div data-testid="day-icon" data-code={String(code)} />,
}));
// Els gràfics tenen els seus propis tests (SmartForecastCharts.test.tsx): aquí només importa què reben.
vi.mock('./SmartForecastCharts', () => ({ default: () => <div data-testid="smart-charts" /> }));

// Setembre a Sabadell (mesurat amb dades reals d'Open-Meteo): el valor DIARI és del model global
// (27,6°/17,5°, vent 15 km/h) però les hores del dia porten el model regional (AROME HD: 29,1°/21,4°, vent 13).
const TIME = Array.from({ length: 48 }, (_, i) => `2026-09-${i < 24 ? '21' : '22'}T${String(i % 24).padStart(2, '0')}:00`);
const flat = (v: number | null) => Array.from({ length: 48 }, () => v);
const dailyOf = (max: number, min: number) => ({
    temperature_2m_max: [max, max], temperature_2m_min: [min, min], precipitation_sum: [0, 0],
});

const build = (opts: { source?: string; regional?: boolean; hourlyProb?: (i: number) => number } = {}): ExtendedWeatherData => {
    const { source = 'AROME HD', regional = true, hourlyProb = () => 0 } = opts;
    return {
        latitude: 41.55, longitude: 2.11, utc_offset_seconds: 7200, timezone: 'Europe/Madrid', elevation: 200,
        location: { name: 'Sabadell', latitude: 41.55, longitude: 2.11 },
        current: { time: '2026-09-21T12:00', temperature_2m: 30, is_day: 1, source },
        hourly: {
            time: TIME,
            temperature_2m: TIME.map((_, i) => (i % 24 === 15 ? 29.1 : i % 24 === 6 ? 21.4 : 25)),
            regional_temperature_2m: TIME.map(() => (regional ? 1 : null)),
            is_day: TIME.map((_, i) => (i % 24 >= 7 && i % 24 <= 19 ? 1 : 0)),
            wind_speed_10m: TIME.map((_, i) => (i % 24 === 12 ? 13 : 5)),
            cloud_cover_low: flat(0), cloud_cover_mid: flat(0), cloud_cover_high: flat(0),
            precipitation: flat(0),
            precipitation_probability: TIME.map((_, i) => hourlyProb(i)),
        },
        dailyComparison: { ecmwf: dailyOf(28.4, 18.5), gfs: dailyOf(26.9, 17), icon: dailyOf(28, 19) },
        daily: {
            time: ['2026-09-21', '2026-09-22'],
            weather_code: [0, 0],
            ...dailyOf(27.6, 17.5),
            wind_speed_10m_max: [15, 15],
            precipitation_probability_max: [10, 10],
            sunrise: ['2026-09-21T07:38', '2026-09-22T07:39'],
            sunset: ['2026-09-21T19:51', '2026-09-22T19:49'],
            uv_index_max: [5.8, 5.8],
        },
    } as unknown as ExtendedWeatherData;
};

const renderDetail = (data: ExtendedWeatherData, lang: 'ca' | 'es' | 'fr' | 'en' = 'ca') =>
    render(<DayDetailModal weatherData={data} selectedDayIndex={1} onClose={() => {}} unit="C" lang={lang} />);

describe('DayDetailModal — coherència amb la llista de 7 dies', () => {
    it('la fila de la llista i el detall que s\'hi obre diuen la MATEIXA màxima i mínima', () => {
        const data = build();

        const list = render(
            <ForecastSection
                chartData={generateHourlyChartData(data, 0, 'C') as never}
                dailyData={data.daily}
                weeklyExtremes={{ min: 10, max: 35 }}
                lang="ca"
                onDayClick={() => {}}
                latitude={41.55}
            />
        );
        // Les hores regionals (29,1°/21,4°) manen; el valor diari cru (27,6°/17,5° → 28°/18°) no surt enlloc.
        expect(screen.getAllByText('29°').length).toBeGreaterThan(0);
        expect(screen.getAllByText('21°').length).toBeGreaterThan(0);
        expect(screen.queryByText('28°')).toBeNull();
        list.unmount();

        renderDetail(data);
        expect(screen.getByTestId('day-max').textContent).toBe('29°');
        expect(screen.getByTestId('day-min').textContent).toBe('21°');
    });

    it('el vent màxim de la targeta és el de les hores de la taula (13), no el diari cru (15)', () => {
        renderDetail(build());
        const card = screen.getByText('VENT MÀX').parentElement as HTMLElement;
        expect(within(card).getByText('13')).toBeTruthy();
        expect(within(card).queryByText('15')).toBeNull();
    });
});

describe('DayDetailModal — fiabilitat, rang i font', () => {
    it("mostra el nivell d'acord entre models i el rang de la màxima i la mínima", () => {
        renderDetail(build());
        const chip = screen.getByTestId('day-reliability');
        expect(chip.getAttribute('data-level')).toBe('high');
        expect(chip.textContent).toContain('Fiabilitat alta');

        const range = screen.getByTestId('day-model-range').textContent ?? '';
        expect(range).toContain('Rang entre models');
        expect(range).toContain('Màx 27–29°');
        expect(range).toContain('Mín 17–21°');
    });

    it('diu quin model és el dia: el regional si en surt la temperatura, "Model global" si no', () => {
        renderDetail(build({ regional: true }));
        expect(screen.getByTestId('day-source').textContent).toBe('AROME HD');
        expect(screen.getByTestId('day-source').getAttribute('data-regional')).toBe('true');
    });

    it('un dia sense hores regionals en una ubicació amb model regional és "Model global" (el salt s\'ha de poder explicar)', () => {
        renderDetail(build({ regional: false }));
        expect(screen.getByTestId('day-source').textContent).toBe('Model global');
        expect(screen.getByTestId('day-source').getAttribute('data-regional')).toBe('false');
    });

    it('sense model regional a la ubicació no hi ha cap xip de font', () => {
        renderDetail(build({ source: 'best_match', regional: false }));
        expect(screen.queryByTestId('day-source')).toBeNull();
    });

    it("s'adapta a l'idioma (castellà)", () => {
        renderDetail(build(), 'es');
        expect(screen.getByTestId('day-reliability').textContent).toContain('Fiabilidad alta');
        expect(screen.getByTestId('day-model-range').textContent).toContain('Rango entre modelos');
    });
});

describe('DayDetailModal — precipitació', () => {
    it('sempre diu la probabilitat màxima de pluja, també quan el total és 0 mm', () => {
        renderDetail(build());
        expect(screen.getByTestId('stat-note').textContent).toBe('PROB. MÀX 10%');
    });

    it('si la taula té una hora més alta que el valor diari, la targeta no pot dir menys', () => {
        renderDetail(build({ hourlyProb: i => (i === 24 + 17 ? 70 : 0) }));
        expect(screen.getByTestId('stat-note').textContent).toBe('PROB. MÀX 70%');
    });
});

describe('DayDetailModal — etiquetes i accessibilitat', () => {
    it('les targetes usen el bloc dayDetail de les traduccions (vent MÀXIM, UV traduït)', () => {
        renderDetail(build());
        expect(screen.getByText('VENT MÀX')).toBeTruthy();
        expect(screen.getByText('Índex UV')).toBeTruthy();
        expect(screen.getByText('COTA NEU')).toBeTruthy();
        expect(screen.queryByText('INDEX UV')).toBeNull();
    });

    it("l'etiqueta UV no es queda en català en altres idiomes", () => {
        renderDetail(build(), 'en');
        expect(screen.getByText('UV Index')).toBeTruthy();
        expect(screen.getByText('MAX WIND')).toBeTruthy();
    });

    it("el botó de tancar té l'aria-label de l'idioma", () => {
        renderDetail(build(), 'en');
        expect(screen.getByRole('button', { name: 'Close window' })).toBeTruthy();
    });

    it('el focus entra al diàleg en obrir-lo', () => {
        renderDetail(build());
        const dialog = screen.getByRole('dialog');
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it("bloqueja el scroll de la pàgina mentre és obert i el restaura en tancar-lo", () => {
        document.body.style.overflow = '';
        const { unmount } = renderDetail(build());
        expect(document.body.style.overflow).toBe('hidden');
        unmount();
        expect(document.body.style.overflow).toBe('');
    });
});
