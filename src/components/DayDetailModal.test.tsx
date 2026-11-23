import type { ComponentProps } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import DayDetailModal from './DayDetailModal';
import ForecastSection from './ForecastSection';
import { generateHourlyChartData } from '../utils/weatherMappers';
import { getHourCodesByDate, type HourlySeries } from '../utils/hourlyWeatherCode';
import { TRANSLATIONS } from '../translations';
import type { ExtendedWeatherData } from '../types/weatherLogicTypes';
import type { OfficialAlert } from '../services/alertsApi';

vi.mock('./WeatherIcons', () => ({
    getWeatherIcon: (code: number | null) => <div data-testid="day-icon" data-code={String(code)} />,
}));
// Els gràfics tenen els seus propis tests (SmartForecastCharts.test.tsx): aquí només importa què reben.
vi.mock('./SmartForecastCharts', () => ({ default: () => <div data-testid="smart-charts" /> }));
// Els avisos oficials no surten a la xarxa des dels tests.
const mockAlerts = vi.hoisted(() => ({ current: [] as OfficialAlert[] }));
vi.mock('../hooks/useOfficialAlerts', () => ({ useOfficialAlerts: () => ({ alerts: mockAlerts.current }) }));

// Setembre a Sabadell (mesurat amb dades reals d'Open-Meteo): el valor DIARI és del model global
// (27,6°/17,5°, vent 15 km/h) però les hores del dia porten el model regional (AROME HD: 29,1°/21,4°, vent 13).
// 4 dies (21-24 de setembre, índexs 0-3): prou perquè el dia 1 i el 2 tinguin veí anterior i següent.
const DAYS = 4;
const HOURS = DAYS * 24;
const TIME = Array.from({ length: HOURS }, (_, i) => `2026-09-${21 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`);
const flat = (v: number | null) => Array.from({ length: HOURS }, () => v);
const perDay = <T,>(v: T) => Array.from({ length: DAYS }, () => v);
const dailyOf = (max: number, min: number) => ({
    temperature_2m_max: perDay(max), temperature_2m_min: perDay(min), precipitation_sum: perDay(0),
});
const isRainHour = (i: number) => Math.floor(i / 24) === 1 && i % 24 >= 14 && i % 24 <= 17;

interface BuildOptions {
    source?: string;
    regional?: boolean;
    hourlyProb?: (i: number) => number;
    /** El dia 1 (22 de setembre) porta pluja de 14 a 17 h. */
    rain?: boolean;
    /** Isoterma 0 °C (m) de totes les hores; sense valor, cap hora en porta (i no hi ha cota de neu). */
    freezing?: number;
    snowfallDay1?: number;
    uv?: number;
}

const build = (opts: BuildOptions = {}): ExtendedWeatherData => {
    const { source = 'AROME HD', regional = true, hourlyProb = () => 0, rain = false, freezing, snowfallDay1 = 0, uv = 5.8 } = opts;
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
            wind_gusts_10m: TIME.map((_, i) => (i % 24 === 15 ? 34 : 8)),
            cloud_cover_low: flat(0), cloud_cover_mid: flat(0), cloud_cover_high: flat(0),
            weather_code: TIME.map((_, i) => (rain && isRainHour(i) ? 61 : 0)),
            precipitation: TIME.map((_, i) => (rain && isRainHour(i) ? 1.2 : 0)),
            precipitation_probability: TIME.map((_, i) => (rain && isRainHour(i) ? 80 : hourlyProb(i))),
            ...(freezing !== undefined ? { freezing_level_height: flat(freezing) } : {}),
        },
        dailyComparison: { ecmwf: dailyOf(28.4, 18.5), gfs: dailyOf(26.9, 17), icon: dailyOf(28, 19) },
        daily: {
            time: ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'],
            weather_code: [0, rain ? 61 : 0, 0, 0],
            ...dailyOf(27.6, 17.5),
            precipitation_sum: [0, rain ? 4.8 : 0, 0, 0],
            snowfall_sum: [0, snowfallDay1, 0, 0],
            wind_speed_10m_max: perDay(15),
            wind_gusts_10m_max: perDay(30),
            precipitation_probability_max: perDay(10),
            sunrise: TIME.filter((_, i) => i % 24 === 0).map(t => `${t.slice(0, 10)}T07:39`),
            sunset: TIME.filter((_, i) => i % 24 === 0).map(t => `${t.slice(0, 10)}T19:49`),
            uv_index_max: perDay(uv),
            // 35.280 s = 9 h 48 min de sol el dia 1.
            sunshine_duration: [30000, 35280, 30000, 30000],
        },
    } as unknown as ExtendedWeatherData;
};

const renderDetail = (
    data: ExtendedWeatherData,
    lang: 'ca' | 'es' | 'fr' | 'en' = 'ca',
    extra: Partial<ComponentProps<typeof DayDetailModal>> = {}
) =>
    render(<DayDetailModal weatherData={data} selectedDayIndex={1} onClose={() => {}} unit="C" lang={lang} {...extra} />);

describe('DayDetailModal — coherència amb la llista de 7 dies', () => {
    it('la fila de la llista i el detall que s\'hi obre diuen la MATEIXA màxima i mínima', () => {
        const data = build();

        const list = render(
            <ForecastSection
                chartData={generateHourlyChartData(data, 0, 'C') as never}
                dailyData={data.daily}
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

        const range = screen.getByTestId('day-probable-range').textContent ?? '';
        expect(range).toContain('Rang probable (80 %)');
        // Rang probable del dia 1 amb els models d'acord (probableRange.ts): 29,1 + [-1,7, +1,5] i 21,4 + [-2,3, +1,8].
        expect(range).toContain('Màx 27–31°');
        expect(range).toContain('Mín 19–23°');
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
        expect(screen.getByTestId('day-probable-range').textContent).toContain('Rango probable (80 %)');
    });
});

describe('DayDetailModal — precipitació', () => {
    it('sempre diu la probabilitat màxima de pluja, també quan el total és 0 mm', () => {
        renderDetail(build());
        expect(screen.getByTestId('note-precip').textContent).toBe('prob. màx. 10%');
    });

    it('si una hora del dia és més alta que el valor diari, la xifra no pot dir menys', () => {
        renderDetail(build({ hourlyProb: i => (i === 24 + 17 ? 70 : 0) }));
        expect(screen.getByTestId('note-precip').textContent).toBe('prob. màx. 70%');
    });
});

describe('DayDetailModal — etiquetes i accessibilitat', () => {
    it('les targetes usen el bloc dayDetail de les traduccions (vent MÀXIM, UV traduït)', () => {
        renderDetail(build({ freezing: 1500 }));
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

describe('DayDetailModal — capçalera amb l\'estat del dia', () => {
    it('mostra la icona i l\'etiqueta del cel del dia', () => {
        renderDetail(build());
        const sky = screen.getByTestId('day-sky');
        expect(within(sky).getByTestId('day-icon').getAttribute('data-code')).toBe('0');
        expect(screen.getByTestId('day-sky-label').textContent).toBe(TRANSLATIONS.ca.wmo[0]);
    });

    it('la icona del detall és la MATEIXA que la de la fila de la llista (un dia de pluja)', () => {
        const data = build({ rain: true });
        const list = render(
            <ForecastSection
                chartData={generateHourlyChartData(data, 0, 'C') as never}
                dailyData={data.daily}
                dayHourCodes={getHourCodesByDate(data.hourly as unknown as HourlySeries, 200, data.hourlyComparison)}
                lang="ca"
                onDayClick={() => {}}
                latitude={41.55}
            />
        );
        // La primera fila de la llista és avui; la segona, l'índex 1 (22 de setembre), el mateix que obre el detall.
        const listCode = screen.getAllByTestId('day-icon')[1].getAttribute('data-code');
        list.unmount();

        renderDetail(data);
        const heroCode = within(screen.getByTestId('day-sky')).getByTestId('day-icon').getAttribute('data-code');
        expect(heroCode).toBe(listCode);
        // I és de pluja: el motor de les hores no s'ha perdut pel camí.
        expect(Number(heroCode)).toBeGreaterThanOrEqual(51);
    });
});

describe('DayDetailModal — xifres del dia', () => {
    // Categories de l'OMS sobre l'índex arrodonit (uvIndexUtils.roundUVIndex): 5,4 → 5 moderat; 5,8 → 6 alt.
    it("l'índex UV porta la categoria de risc (5,4 → moderat, ambre) amb la mateixa taula que el widget d'UV", () => {
        renderDetail(build({ uv: 5.4 }));
        const note = screen.getByTestId('note-uv');
        expect(note.textContent).toBe('moderat');
        expect(note.className).toContain('text-amber-400');
    });

    it('un UV alt canvia de categoria i de color', () => {
        renderDetail(build({ uv: 7.4 }));
        const note = screen.getByTestId('note-uv');
        expect(note.textContent).toBe('alt');
        expect(note.className).toContain('text-orange-500');
    });

    it('el vent porta la ratxa màxima de les hores del dia', () => {
        renderDetail(build());
        expect(screen.getByTestId('note-gusts').textContent).toBe('ratxes 34 km/h');
    });

    it('un dia sense neu possible (isoterma alta o sense dada) mostra les hores de sol en lloc de la cota de neu', () => {
        renderDetail(build());
        expect(screen.queryByTestId('stat-snow')).toBeNull();
        const sunshine = screen.getByTestId('stat-sunshine');
        expect(within(sunshine).getByText('Sol')).toBeTruthy();
        expect(within(sunshine).getByText('9h 48m')).toBeTruthy();
        expect(screen.getByTestId('note-sunshine').textContent).toBe('de 12h 10m');
    });

    it('amb la cota de neu baixa (o neu al dia) es mostra la cota de neu, no les hores de sol', () => {
        renderDetail(build({ freezing: 1500 }));
        expect(screen.queryByTestId('stat-sunshine')).toBeNull();
        // Isoterma 1500 m − 300 m de coixí = 1200 m.
        expect(within(screen.getByTestId('stat-snow')).getByText('1200m')).toBeTruthy();
    });

    it('amb neu al dia la cota surt encara que sigui per sobre del límit de visualització', () => {
        renderDetail(build({ freezing: 5000, snowfallDay1: 2 }));
        expect(screen.queryByTestId('stat-sunshine')).toBeNull();
        expect(within(screen.getByTestId('stat-snow')).getByText('> 3500m')).toBeTruthy();
    });

    it('un dia de neu diu «Neu» i els cm, no «Pluja»', () => {
        renderDetail(build({ freezing: 5000, snowfallDay1: 2 }));
        const cell = screen.getByTestId('stat-precip');
        expect(within(cell).getByText('Neu')).toBeTruthy();
        expect(within(cell).queryByText('Pluja')).toBeNull();
        expect(cell.textContent).toContain('2cm');
    });

    it('un dia de pluja diu «Pluja» i els mm', () => {
        renderDetail(build({ rain: true }));
        const cell = screen.getByTestId('stat-precip');
        expect(within(cell).getByText('Pluja')).toBeTruthy();
        expect(cell.textContent).toContain('5mm');
    });

    it('una isoterma per sobre del límit i sense neu no ocupa cap targeta: hores de sol', () => {
        renderDetail(build({ freezing: 5000 }));
        expect(screen.queryByTestId('stat-snow')).toBeNull();
        expect(screen.getByTestId('stat-sunshine')).toBeTruthy();
    });

    it("s'adapta a l'idioma (anglès)", () => {
        renderDetail(build(), 'en');
        expect(screen.getByTestId('note-gusts').textContent).toBe('gusts 34 km/h');
        expect(within(screen.getByTestId('stat-sunshine')).getByText('Sun')).toBeTruthy();
        expect(screen.getByTestId('note-sunshine').textContent).toBe('of 12h 10m');
        expect(screen.getByTestId('note-uv').textContent).toBe('high'); // UV 5,8 → 6 (OMS)
    });
});

describe('DayDetailModal — la columna del dia', () => {
    it('una fila per hora, amb el cel dels codis del motor (pluja de 14 a 17 h)', () => {
        renderDetail(build({ rain: true }));
        const rows = screen.getAllByTestId('hour-row');
        expect(rows).toHaveLength(24);
        const kinds = screen.getAllByTestId('sky-cell').map(c => c.getAttribute('data-kind'));
        expect(kinds.slice(14, 18)).toEqual(['rain', 'rain', 'rain', 'rain']);
        expect(kinds[10]).toBe('clear');
    });

    it('la sortida i la posta del sol: les hores, la durada i les dues línies que tallen la columna', () => {
        renderDetail(build());
        const sun = screen.getByTestId('sun-times');
        expect(within(sun).getByText('07:39')).toBeTruthy();
        expect(within(sun).getByText('19:49')).toBeTruthy();
        expect(screen.getByTestId('daylight').textContent).toContain('12h 10m de llum');
        expect(screen.getByTestId('sunrise-line')).toBeTruthy();
        expect(screen.getByTestId('sunset-line')).toBeTruthy();
    });

    it('la temperatura de cada hora és la del gràfic (la màxima de 29° a les 15 h)', () => {
        renderDetail(build());
        const labels = screen.getAllByTestId('temp-label').map(l => l.textContent);
        expect(labels[15]).toBe('29°');
        expect(labels[6]).toBe('21°');
    });

    it('la finestra seca només surt un dia amb pluja: aquí, de les 0 a les 14 h', () => {
        const dry = renderDetail(build());
        expect(screen.queryByTestId('dry-window')).toBeNull();
        dry.unmount();

        renderDetail(build({ rain: true }));
        expect(screen.getByTestId('dry-window').textContent).toContain('Finestra seca 00–14 h');
        expect(screen.getByTestId('dry-bracket')).toBeTruthy();
    });

    it('la ratxa només surt a les hores que és notable (34 km/h amb 5 de vent, a les 15 h)', () => {
        renderDetail(build());
        const gusts = screen.getAllByTestId('gust');
        expect(gusts).toHaveLength(1);
        expect(gusts[0].textContent).toBe('34');
        expect(screen.getAllByTestId('hour-row')[15].contains(gusts[0])).toBe(true);
    });

    it('cada hora té un nom accessible amb les seves xifres', () => {
        renderDetail(build({ rain: true }));
        expect(screen.getAllByTestId('hour-row')[15].textContent).toContain('15 h, 29°');
        expect(screen.getAllByTestId('hour-row')[15].textContent).toContain('80% de probabilitat de pluja');
    });

    it('un dia que no és avui no marca cap hora com a "ara"', () => {
        renderDetail(build());
        screen.getAllByTestId('hour-row').forEach(r => expect(r.getAttribute('data-now')).toBe('false'));
        expect(screen.queryByTestId('now-line')).toBeNull();
    });

    it('avui (12:00) marca la fila en curs i atenua el que ja ha passat', () => {
        renderDetail(build(), 'ca', { selectedDayIndex: 0 });
        const rows = screen.getAllByTestId('hour-row');
        expect(rows.filter(r => r.getAttribute('data-now') === 'true')).toHaveLength(1);
        expect(rows[12].getAttribute('data-now')).toBe('true');
        expect(rows[12].getAttribute('aria-current')).toBe('time');
        expect(rows[11].className).toContain('opacity-50');
        expect(rows[13].className).not.toContain('opacity-50');
        expect(screen.getByTestId('now-line')).toBeTruthy();
    });

    it('«Columna | Gràfic»: la columna d\'entrada i els gràfics de sempre en un toc', () => {
        renderDetail(build());
        expect(screen.getByTestId('day-column')).toBeTruthy();
        expect(screen.queryByTestId('smart-charts')).toBeNull();
        expect(screen.getByTestId('view-column').getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(screen.getByTestId('view-chart'));
        expect(screen.getByTestId('smart-charts')).toBeTruthy();
        expect(screen.queryByTestId('day-column')).toBeNull();
        expect(screen.getByTestId('view-chart').getAttribute('aria-pressed')).toBe('true');
    });
});

describe('DayDetailModal — avisos oficials del dia', () => {
    afterEach(() => {
        mockAlerts.current = [];
        vi.useRealTimers();
    });

    const alertOf = (extra: Partial<OfficialAlert>): OfficialAlert => ({
        id: 'vent', event: 'Avís groc per vent', severity: 'Moderate', headline: 'Ratxes de més de 72 km/h', description: '',
        instruction: null, senderName: 'Meteocat', expires: null, sourceName: 'Meteocat', sourceUrl: 'https://meteo.cat',
        textLang: 'ca', ...extra
    });

    it("surt al dia que toca, amb un punt al selector, i no als altres", () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-21T12:00:00+02:00'));
        mockAlerts.current = [alertOf({ onset: '2026-09-22T12:00:00+02:00', expires: '2026-09-22T21:00:00+02:00' })];

        const day1 = renderDetail(build(), 'ca', { onSelectDay: vi.fn() });
        expect(within(screen.getByTestId('day-alert')).getByText('Avís groc per vent')).toBeTruthy();
        const dots = screen.getAllByTestId('day-tab-alert');
        expect(dots).toHaveLength(1);
        expect(dots[0].closest('[data-testid="day-tab"]')?.getAttribute('data-index')).toBe('1');
        day1.unmount();

        renderDetail(build(), 'ca', { selectedDayIndex: 2, onSelectDay: vi.fn() });
        expect(screen.queryByTestId('day-alert')).toBeNull();
    });

    it("sense avisos no hi ha cap secció d'avisos", () => {
        renderDetail(build());
        expect(screen.queryByTestId('day-alerts')).toBeNull();
    });
});

describe('DayDetailModal — canvi de dia', () => {
    const swipe = (target: Element, from: [number, number], to: [number, number]) => {
        fireEvent.touchStart(target, { touches: [{ clientX: from[0], clientY: from[1] }] });
        fireEvent.touchEnd(target, { changedTouches: [{ clientX: to[0], clientY: to[1] }] });
    };

    it('el selector porta els dies que es poden obrir, amb el dia obert marcat', () => {
        const onSelectDay = vi.fn();
        renderDetail(build(), 'ca', { selectedDayIndex: 2, onSelectDay });
        const tabs = screen.getAllByTestId('day-tab');
        expect(tabs.map(t => t.getAttribute('data-index'))).toEqual(['0', '1', '2', '3']);
        expect(tabs[2].getAttribute('aria-current')).toBe('date');
        expect(tabs[1].getAttribute('aria-current')).toBeNull();

        fireEvent.click(tabs[0]);
        expect(onSelectDay).toHaveBeenLastCalledWith(0);
        fireEvent.click(tabs[3]);
        expect(onSelectDay).toHaveBeenLastCalledWith(3);
    });

    it('el primer dia és avui, i cada dia té un nom accessible en el seu idioma', () => {
        renderDetail(build(), 'es', { selectedDayIndex: 2, onSelectDay: vi.fn() });
        expect(screen.getByRole('button', { name: 'Hoy 21' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Martes 22' })).toBeTruthy();
    });

    it('sense onSelectDay no hi ha selector ni el teclat canvia de dia', () => {
        renderDetail(build(), 'ca', { selectedDayIndex: 2 });
        expect(screen.queryByTestId('day-tab')).toBeNull();
    });

    it('el teclat ←/→ canvia de dia; amb modificadors no fa res', () => {
        const onSelectDay = vi.fn();
        renderDetail(build(), 'ca', { selectedDayIndex: 2, onSelectDay });
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        expect(onSelectDay).toHaveBeenLastCalledWith(1);
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(onSelectDay).toHaveBeenLastCalledWith(3);

        onSelectDay.mockClear();
        fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
        fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
        expect(onSelectDay).not.toHaveBeenCalled();
    });

    it("el teclat no canvia de dia mentre s'escriu en un camp", () => {
        const onSelectDay = vi.fn();
        renderDetail(build(), 'ca', { selectedDayIndex: 2, onSelectDay });
        const input = document.createElement('input');
        document.body.appendChild(input);
        fireEvent.keyDown(input, { key: 'ArrowRight' });
        expect(onSelectDay).not.toHaveBeenCalled();
        input.remove();
    });

    it("a l'últim dia la fletxa dreta del teclat no fa res", () => {
        const onSelectDay = vi.fn();
        renderDetail(build(), 'ca', { selectedDayIndex: 3, onSelectDay });
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(onSelectDay).not.toHaveBeenCalled();
    });

    it("lliscar cap a l'esquerra va al dia següent i cap a la dreta a l'anterior", () => {
        const onSelectDay = vi.fn();
        renderDetail(build(), 'ca', { selectedDayIndex: 2, onSelectDay });
        const target = screen.getByTestId('day-max');
        swipe(target, [250, 300], [100, 305]);
        expect(onSelectDay).toHaveBeenLastCalledWith(3);
        swipe(target, [100, 300], [250, 295]);
        expect(onSelectDay).toHaveBeenLastCalledWith(1);
    });

    it('un scroll vertical o un gest curt no canvia de dia', () => {
        const onSelectDay = vi.fn();
        renderDetail(build(), 'ca', { selectedDayIndex: 2, onSelectDay });
        const target = screen.getByTestId('day-max');
        swipe(target, [200, 100], [140, 400]);
        swipe(target, [200, 300], [170, 300]);
        expect(onSelectDay).not.toHaveBeenCalled();
    });

    it('sobre els gràfics el gest horitzontal és del gràfic (llegir hores), no de canvi de dia', () => {
        const onSelectDay = vi.fn();
        renderDetail(build(), 'ca', { selectedDayIndex: 2, onSelectDay });
        fireEvent.click(screen.getByTestId('view-chart'));
        swipe(screen.getByTestId('smart-charts'), [250, 300], [100, 300]);
        expect(onSelectDay).not.toHaveBeenCalled();
    });
});

// Auditoria d'UX del 16/11/2026 (B1, B14): "Dimarts, 17 De Novembre" amb majúscula a cada paraula, i les fletxes que es
// movien segons la llargada del títol.
describe('DayDetailModal — títol del dia', () => {
    it('majúscula només a la primera lletra', () => {
        renderDetail(build());
        const title = document.getElementById('day-detail-modal-title')!;
        expect(title.className).not.toContain('capitalize');
        const text = title.textContent ?? '';
        expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
        expect(text).toMatch(/ de [a-z]/);
    });
});
