import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ForecastSection from './ForecastSection';
import type { StrictDailyWeather } from '../types/weatherLogicTypes';
import type { SkyHour } from '../utils/daySky';

// La icona es substitueix per un marcador amb el codi rebut: el que es prova és QUIN codi tria la setmana.
vi.mock('./WeatherIcons', () => ({
    getWeatherIcon: (code: number | null) => <div data-testid="day-icon" data-code={String(code)} />,
}));

const DATES = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];

// Codi diari cru del model: avui cel, i després pluja, pluja, neu, cel, cel, cel, cel
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
// Les files dels dies: tots els botons menys el del gràfic.
const dayRows = () => screen.getAllByRole('button').filter(b => b.getAttribute('data-testid') !== 'open-trend');

type Props = Partial<Parameters<typeof ForecastSection>[0]>;
const renderWeek = (props: Props = {}) =>
    render(
        <ForecastSection
            chartData={chartData}
            dailyData={dailyData}
            lang="ca"
            onDayClick={() => {}}
            latitude={41.9}
            {...props}
        />
    );

const day = (code: number) => Array.from({ length: 24 }, () => code);

// Franja: de nit de 0 a 7 h i de 19 a 23 h; cel serè, amb pluja de 19 a 21 h el 21 de setembre.
const skyDay = (rainHours: number[] = []): SkyHour[] =>
    Array.from({ length: 24 }, (_, hour) => ({ hour, kind: rainHours.includes(hour) ? 'rain' : 'clear', isDay: hour >= 8 && hour < 19 }));
const daySky = Object.fromEntries(DATES.map(d => [d, skyDay(d === '2026-09-21' ? [19, 20, 21] : [])]));

describe('ForecastSection — la icona del dia passa pels mateixos filtres que les hores', () => {
    it('sense hores del motor, el codi diari del model queda tal com sempre (pluja, neu, cel per núvols)', () => {
        renderWeek();
        expect(codes()).toEqual([2, 63, 63, 73, 2, 2, 2, 2]);
    });

    it('el motor filtra la pluja d\'un dia sec, converteix la neu en pluja i manté la pluja real', () => {
        renderWeek({
            dayHourCodes: {
                '2026-09-21': [...day(3).slice(0, 10), 63, 63, ...day(3).slice(12)],   // pluja real
                '2026-09-22': day(3),                                                  // el model deia pluja, a les hores no n'hi ha
                '2026-09-23': day(63),                                                 // neu del model cru: pluja per bloqueig tèrmic
            },
        });
        expect(codes()).toEqual([2, 63, 2, 63, 2, 2, 2, 2]);
    });

    it('els dies que el model no marca de precipitació no en passen a tenir per una hora de pluja feble', () => {
        renderWeek({ dayHourCodes: { '2026-09-24': [...day(3).slice(0, 12), 61, ...day(3).slice(13)] } });
        expect(codes()[4]).toBe(2);   // el 24/09 (raw 3): cel per núvols, no pluja
    });

    it('el tipus del motor arriba a la setmana (aiguaneu i pluja engelant)', () => {
        renderWeek({ dayHourCodes: { '2026-09-21': day(69), '2026-09-22': day(66) } });
        expect(codes().slice(1, 3)).toEqual([69, 66]);
    });
});

describe('ForecastSection — avui és la primera fila', () => {
    it("la llista porta avui i els 7 dies següents, i cada fila obre el seu detall (avui, l'índex 0)", () => {
        const onDayClick = vi.fn();
        renderWeek({ onDayClick });
        expect(dayRows()).toHaveLength(8);
        expect(dayRows()[0].getAttribute('aria-label')).toMatch(/^Avui 20:/);

        fireEvent.click(dayRows()[0]);
        expect(onDayClick).toHaveBeenLastCalledWith(0);
        fireEvent.click(dayRows()[1]);
        expect(onDayClick).toHaveBeenLastCalledWith(1);
    });

    it('la fila d\'avui es diu «avui» a cada idioma', () => {
        const expected = { ca: 'Avui', es: 'Hoy', fr: "Aujourd'hui", en: 'Today' } as const;
        for (const lang of ['ca', 'es', 'fr', 'en'] as const) {
            const { unmount } = renderWeek({ lang });
            expect(dayRows()[0].getAttribute('aria-label')?.startsWith(`${expected[lang]} 20`)).toBe(true);
            unmount();
        }
    });

    it('la màxima, la mínima i la icona d\'avui surten de totes les hores del dia (todayHours), no de les que queden', () => {
        const todayHours = chartData.filter(h => h.time.startsWith('2026-09-20')).map(h => ({ ...h, temp: h.time.endsWith('T14:00') ? 24 : 15 }));
        renderWeek({ todayHours });
        expect(dayRows()[0].getAttribute('aria-label')).toMatch(/a 24°/);
        expect(dayRows()[1].getAttribute('aria-label')).not.toMatch(/a 24°/);
    });

    it('amb una previsió d\'ahir (el lloc ja és a l\'endemà), la primera fila no es diu «Avui» ni porta l\'ara', () => {
        renderWeek({ daySky, localNow: new Date(2026, 8, 21, 9, 30) });
        expect(dayRows()[0].getAttribute('aria-label')).not.toMatch(/^Avui/);
        expect(screen.queryByTestId('sky-now')).toBeNull();
    });
});

describe('ForecastSection — franja del cel', () => {
    it('cada dia porta la seva franja, pintada amb el cel de cada hora', () => {
        renderWeek({ daySky });
        const strips = screen.getAllByTestId('sky-strip');
        expect(strips).toHaveLength(8);
        // 21/09: pluja de nit de 19 a 22 h (79,167 % – 91,667 %).
        expect(strips[1].style.backgroundImage).toContain('79.167% 91.667%');
        expect(strips[0].style.backgroundImage).not.toContain('79.167% 91.667%');
    });

    it("la marca d'ara és a l'hora del lloc, només a la franja d'avui", () => {
        renderWeek({ daySky, localNow: new Date(2026, 8, 20, 21, 0) });
        const now = screen.getAllByTestId('sky-now');
        expect(now).toHaveLength(1);
        expect(now[0].style.left).toBe('87.5%');
    });

    it('sense hora del lloc no hi ha marca d\'ara', () => {
        renderWeek({ daySky });
        expect(screen.queryByTestId('sky-now')).toBeNull();
    });

    it('la quantitat de pluja va on cau la pluja', () => {
        renderWeek({ daySky });
        const strip = screen.getAllByTestId('sky-strip')[1].parentElement as HTMLElement;
        const amount = Array.from(strip.querySelectorAll('span')).find(s => s.textContent === '1 mm') as HTMLElement;
        expect(amount.style.left).toBe('85.4%');
    });

    it('la llegenda només explica el que surt a la setmana', () => {
        renderWeek({ daySky, localNow: new Date(2026, 8, 20, 21, 0) });
        const legend = screen.getByTestId('sky-legend').textContent ?? '';
        for (const word of ['sol', 'pluja', 'nit', 'ara']) expect(legend).toContain(word);
        for (const word of ['neu', 'tempesta', 'boira', 'clarianes']) expect(legend).not.toContain(word);
    });

    it('sense franges no hi ha ni regle ni llegenda', () => {
        renderWeek();
        expect(screen.queryByTestId('sky-legend')).toBeNull();
    });
});

describe('ForecastSection — gràfic de la setmana', () => {
    it('el botó del gràfic té text i nom accessible a cada idioma', () => {
        const expected = {
            ca: ['Gràfic', 'Obrir el gràfic de temperatures'],
            es: ['Gráfico', 'Abrir el gráfico de temperaturas'],
            fr: ['Graphique', 'Ouvrir le graphique des températures'],
            en: ['Chart', 'Open temperature chart'],
        } as const;
        for (const lang of ['ca', 'es', 'fr', 'en'] as const) {
            const { unmount } = renderWeek({ lang });
            const button = screen.getByTestId('open-trend');
            expect(button.getAttribute('aria-label')).toBe(expected[lang][1]);
            expect(button.textContent).toContain(expected[lang][0]);
            unmount();
        }
    });
});

// Auditoria d'UX del 16/11/2026 (B10): el nom accessible de cada dia era el text enganxat ("17dimarts3%16°22°CAP").
describe('ForecastSection — nom accessible dels dies', () => {
    it('cada dia es llegeix com una frase amb el rang i la probabilitat de pluja', () => {
        renderWeek();
        const labels = dayRows().map(b => b.getAttribute('aria-label') ?? '');
        expect(labels).toHaveLength(8);
        expect(labels[1]).toMatch(/^\S+ \d+: de -?\d+° a -?\d+°, 40 % de probabilitat de pluja$/);
    });

    // Pica d'Estats, 23/11/2026: a -8 °C, cada dia deia «de probabilitat de pluja».
    it('un dia de neu, o tot ell sota zero, diu «de probabilitat de neu»', () => {
        const snowy = {
            ...dailyData,
            temperature_2m_max: DATES.map((_, i) => (i === 3 ? -2 : 20)),
            temperature_2m_min: DATES.map((_, i) => (i === 3 ? -8 : 10)),
            snowfall_sum: DATES.map((_, i) => (i === 2 ? 2.1 : 0)),
            precipitation_sum: DATES.map((_, i) => (i === 2 ? 3 : 1)),
        } as unknown as StrictDailyWeather;
        renderWeek({ dailyData: snowy, chartData: chartData.map(h => ({ ...h, temp: h.time.startsWith(DATES[3]) ? -5 : h.temp })) as never });
        const labels = dayRows().map(b => b.getAttribute('aria-label') ?? '');
        expect(labels[2]).toMatch(/de probabilitat de neu$/); // 2,1 cm de neu
        expect(labels[3]).toMatch(/de probabilitat de neu$/); // màxima sota zero
        expect(labels[4]).toMatch(/de probabilitat de pluja$/);
    });
});
