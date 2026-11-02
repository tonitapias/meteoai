import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { buildCapsuleGradient } from '../utils/temperatureColors';
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

const renderModal = (
    dailyData: StrictDailyWeather,
    chartData: Array<Record<string, unknown>> = [],
    extra: Partial<ComponentProps<typeof TrendChartModal>> = {}
) =>
    render(
        <TrendChartModal
            isOpen
            onClose={() => {}}
            dailyData={dailyData}
            chartData={chartData as never}
            lang="ca"
            latitude={41.9}
            {...extra}
        />
    );

const columns = () => screen.getAllByTestId('trend-column') as HTMLElement[];
const columnBox = (c: HTMLElement) => ({ top: c.style.top, bottom: c.style.bottom });

// 24 hores per dia: nit (isDay 0) a `night`, dia (isDay 1) a `day`, amb cel serè i `wind` km/h.
// `regionalDates`: dates les hores de les quals tenen la temperatura d'un model regional.
const hoursFor = (dates: string[], night: number, day: number, wind: number, regionalDates: string[] = []) =>
    dates.flatMap(date =>
        Array.from({ length: 24 }, (_, h) => ({
            time: `${date}T${String(h).padStart(2, '0')}:00`,
            temp: h >= 8 && h < 19 ? day : night,
            precip: 0, cloud: 0, cloudLow: 0, cloudMid: 0, cloudHigh: 0, wind,
            isDay: h >= 8 && h < 19 ? 1 : 0,
            regionalTemp: regionalDates.includes(date),
        }))
    );

// Comparació de models globals: ECMWF s'allunya 8° de la màxima del dia índex 4 (30° -> 38°, fora del marge natural del gràfic); la resta gairebé coincideixen.
const model = (max: number[], min: number[]) => ({ temperature_2m_max: max, temperature_2m_min: min, precipitation_sum: max.map(() => 0) });
const COMPARISON = {
    ecmwf: model(MAX.map((v, i) => (i === 4 ? v + 8 : v + 0.3)), MIN),
    gfs: model(MAX, MIN),
    icon: model(MAX, MIN),
};

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

describe('TrendChartModal — rang probable i fiabilitat per dia', () => {
    const levels = () => screen.getAllByTestId('reliability').map(e => e.getAttribute('data-level'));
    const whiskers = () => screen.getAllByTestId('probable-range');
    // "Rang probable (80 %): 27–33°" -> amplada en graus
    const widthOf = (el: HTMLElement) => {
        const m = (el.getAttribute('title') ?? '').match(/(-?\d+)–(-?\d+)°/);
        return m ? Number(m[2]) - Number(m[1]) : NaN;
    };

    it('cada dia complet té el rang probable de la màxima i de la mínima', () => {
        renderModal(makeDaily(SEPT), [], { dailyComparison: COMPARISON });
        expect(whiskers()).toHaveLength(14);
        whiskers().forEach(w => expect(w.getAttribute('title')).toMatch(/^Rang probable \(80 %\): -?\d+–-?\d+°$/));
    });

    it("el dia on els models discrepen té el rang de la màxima més ample que els dies d'acord", () => {
        renderModal(makeDaily(SEPT), [], { dailyComparison: COMPARISON });
        // Bigotis en ordre [màx, mín] per dia; el de desacord és l'índex 4 de daily, el 4t del gràfic (que comença al dia 1).
        const maxWidths = whiskers().filter((_, i) => i % 2 === 0).map(widthOf);
        const disagreeing = maxWidths[3];
        maxWidths.filter((_, i) => i !== 3).forEach(w => expect(disagreeing).toBeGreaterThan(w));
    });

    it("els bigotis caben dins el gràfic: l'escala els compta i no queden tallats", () => {
        renderModal(makeDaily(SEPT), [], { dailyComparison: COMPARISON });
        whiskers().forEach(w => {
            const top = parseFloat(w.style.top);
            const bottom = top + parseFloat(w.style.height);
            expect(top).toBeGreaterThanOrEqual(0);
            expect(bottom).toBeLessThanOrEqual(100);
        });
    });

    it('cada dia té la seva fiabilitat: alta si els models coincideixen, baixa on n\'hi ha un que s\'allunya molt', () => {
        renderModal(makeDaily(SEPT), [], { dailyComparison: COMPARISON });
        expect(levels()).toEqual(['high', 'high', 'high', 'low', 'high', 'high', 'high']);
        expect(screen.getAllByLabelText('Fiabilitat baixa')).toHaveLength(1);
    });

    it('la llegenda explica el rang i la fiabilitat', () => {
        renderModal(makeDaily(SEPT), [], { dailyComparison: COMPARISON });
        expect(screen.getByText('Rang probable (80 %)')).toBeTruthy();
        expect(screen.getByText('Fiabilitat (acord entre models)')).toBeTruthy();
    });

    it("sense comparació de models no s'inventa cap acord (ni fiabilitat ni la seva llegenda), però el rang probable hi és", () => {
        renderModal(makeDaily(SEPT));
        expect(screen.queryAllByTestId('reliability')).toHaveLength(0);
        expect(screen.queryByText('Fiabilitat (acord entre models)')).toBeNull();
        // Calibrat només pel dia vista (probableRange.ts, fila `all`).
        expect(whiskers()).toHaveLength(14);
        expect(screen.getByText('Rang probable (80 %)')).toBeTruthy();
    });

    it('els textos surten en l\'idioma de l\'usuari', () => {
        renderModal(makeDaily(SEPT), [], { dailyComparison: COMPARISON, lang: 'en' });
        expect(screen.getByText('Likely range (80%)')).toBeTruthy();
        expect(screen.getAllByLabelText('Low reliability')).toHaveLength(1);
    });
});

describe('TrendChartModal — on la sèrie passa del model regional al global', () => {
    const chart = (regionalDates: string[]) => hoursFor(SEPT, 14, 27, 10, regionalDates);
    const runs = () => screen.getAllByTestId('source-run');

    it('els dos primers dies del model regional i la resta del global: dos trams, amb l\'etiqueta del model', () => {
        // Dies mostrats: 21 al 27. Regionals: 21 i 22.
        renderModal(makeDaily(SEPT), chart(['2026-09-21', '2026-09-22']), { regionalModelLabel: 'AROME HD' });
        expect(runs().map(r => [r.textContent, r.style.gridColumn])).toEqual([
            ['AROME HD', 'span 2'],
            ['Model global', 'span 5'],
        ]);
        expect(runs().map(r => r.getAttribute('data-regional'))).toEqual(['true', 'false']);
    });

    it('si totes les dades són del model global no hi ha tira d\'origen', () => {
        renderModal(makeDaily(SEPT), chart([]), { regionalModelLabel: null });
        expect(screen.queryAllByTestId('source-run')).toHaveLength(0);
    });

    it('sense sèrie horària tampoc: no s\'assenyala un origen que no es coneix', () => {
        renderModal(makeDaily(SEPT), [], { regionalModelLabel: 'AROME HD' });
        expect(screen.queryAllByTestId('source-run')).toHaveLength(0);
    });

    it('un tram regional al mig també es marca (no es pressuposa que sigui al principi)', () => {
        renderModal(makeDaily(SEPT), chart(['2026-09-23']), { regionalModelLabel: 'AROME HD' });
        expect(runs().map(r => [r.getAttribute('data-regional'), r.style.gridColumn])).toEqual([
            ['false', 'span 2'], ['true', 'span 1'], ['false', 'span 4'],
        ]);
    });

    it('si hi ha dies regionals però no s\'ha passat l\'etiqueta, es mostra "HD" en lloc de deixar-ho en blanc', () => {
        renderModal(makeDaily(SEPT), chart(['2026-09-21']));
        expect(runs()[0].textContent).toBe('HD');
    });

    it('sota la tira, una nota visible explica el salt (un `title` no surt mai en una pantalla tàctil)', () => {
        renderModal(makeDaily(SEPT), chart(['2026-09-21', '2026-09-22']), { regionalModelLabel: 'AROME HD' });
        expect(screen.getByTestId('source-note').textContent).toBe("Un salt d'un tram a l'altre pot ser el canvi de model, no un canvi de temps.");
        expect(runs()[0].closest('[title]')).toBeNull();
    });

    it('sense tira, tampoc no hi ha nota', () => {
        renderModal(makeDaily(SEPT), chart([]), { regionalModelLabel: null });
        expect(screen.queryByTestId('source-note')).toBeNull();
    });
});

describe('TrendChartModal — quantitat de pluja i probabilitats baixes', () => {
    const amounts = () => screen.getAllByTestId('precip-amount').map(e => e.textContent);

    it('mostra els mm previstos només els dies que en tenen, i els cm si és neu', () => {
        renderModal(makeDaily(SEPT, {
            precipitation_sum: [0, 0, 0, 4.2, 0, 0, 0, 0],
            snowfall_sum: [0, 0, 0, 0, 0, 3, 0, 0],
        }));
        expect(amounts()).toEqual(['', '', '4 mm', '', '', '', '']);
    });

    it('una quantitat que falta no s\'inventa com a 0 mm (es deixa en blanc)', () => {
        renderModal(makeDaily(SEPT, { precipitation_sum: [0, null, 0, 0, 0, 0, 0, 0] }));
        expect(amounts().every(t => t === '')).toBe(true);
    });

    it('una probabilitat baixa (< 20 %) es mostra atenuada i una de real, ressaltada', () => {
        renderModal(makeDaily(SEPT, { precipitation_probability_max: [0, 10, 19, 20, 60, 0, 0, 0] }));
        const badge = (text: string) => screen.getByText(text).closest('div')!;
        expect(badge('10%').className).toContain('opacity-40');
        expect(badge('19%').className).toContain('opacity-40');
        expect(badge('20%').className).toContain('bg-blue-500/10');
        expect(badge('60%').className).toContain('bg-blue-500/10');
        // Atenuada no vol dir amagada: el valor continua sent visible.
        expect(screen.getByText('10%')).toBeTruthy();
    });
});

describe('TrendChartModal — mateixes xifres que la llista de 7 dies', () => {
    // Nit d'hivern serena i en calma (vent 0 km/h): la mínima crua del model és 10° i la llista la corregeix per
    // inversió tèrmica (10 - 1,75 = 8,25 -> 8°, vegeu MAX_INVERSION_CORRECTION_C). El gràfic ha de dir el mateix.
    const daily = makeDaily(JAN, {
        temperature_2m_max: JAN.map(() => 20),
        temperature_2m_min: JAN.map(() => 10),
    });
    const chartData = hoursFor(JAN, 10, 18, 0);

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

describe('TrendChartModal — cada dia obre el seu detall', () => {
    const days = () => screen.getAllByTestId('trend-day');

    it('amb onDayClick, cada dia és un botó que crida amb el seu índex (1..7) i el gràfic no es tanca pel seu compte', () => {
        const onDayClick = vi.fn();
        const onClose = vi.fn();
        renderModal(makeDaily(SEPT), [], { onDayClick, onClose });

        expect(days()).toHaveLength(7);
        expect(days().every(d => d.tagName === 'BUTTON')).toBe(true);

        fireEvent.click(days()[2]);
        expect(onDayClick).toHaveBeenCalledTimes(1);
        expect(onDayClick).toHaveBeenCalledWith(3);
        // El tancament el gestiona qui passa onDayClick (closeModalThen): un doble tancament faria history.back() dues vegades.
        expect(onClose).not.toHaveBeenCalled();
    });

    it('sense onDayClick els dies no són botons (no es promet cap acció que no existeix)', () => {
        renderModal(makeDaily(SEPT));
        expect(days().every(d => d.tagName !== 'BUTTON')).toBe(true);
        expect(screen.queryAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Tancar modal']);
    });
});

describe('TrendChartModal — accessibilitat', () => {
    it('el títol del diàleg diu de què és el gràfic, sense calcs ("Gràfic de temperatures", no "Gràfic Temperatures")', () => {
        renderModal(makeDaily(SEPT));
        expect(screen.getByRole('dialog', { name: 'Gràfic de temperatures' })).toBeTruthy();
        expect(screen.getByText('Tendència dels pròxims 7 dies')).toBeTruthy();
    });

    it('cada dia diu en una frase el que el gràfic diu visualment', () => {
        renderModal(makeDaily(SEPT, { precipitation_probability_max: [0, 10, 0, 0, 0, 0, 0, 0] }));
        expect(screen.getAllByTestId('trend-day')[0].getAttribute('aria-label'))
            .toBe('dilluns, màxima 24°, mínima 12°, pluja 10%');
    });

    it('amb fiabilitat, mm i origen, tot entra a l\'etiqueta; amb onDayClick s\'hi afegeix què fa el botó', () => {
        renderModal(
            makeDaily(SEPT, { precipitation_sum: [0, 0, 0, 0, 4.2, 0, 0, 0] }),
            hoursFor(SEPT, 14, 27, 10, ['2026-09-21']),
            { dailyComparison: COMPARISON, regionalModelLabel: 'AROME HD', onDayClick: () => {} }
        );
        const labels = screen.getAllByTestId('trend-day').map(d => d.getAttribute('aria-label') ?? '');
        expect(labels[0]).toContain('AROME HD');
        expect(labels[3]).toContain('Fiabilitat baixa');
        expect(labels[3]).toContain('4 mm');
        expect(labels[6]).toContain('Model global');
        expect(labels[0]).toMatch(/\. veure el detall del dia$/);
    });

    it('l\'etiqueta surt en l\'idioma de l\'usuari', () => {
        renderModal(makeDaily(SEPT), [], { lang: 'en' });
        expect(screen.getAllByTestId('trend-day')[0].getAttribute('aria-label')).toBe('Monday, high 24°, low 12°, rain 10%');
    });

    it('el gràfic visual és decoratiu per als lectors de pantalla (la informació és a les etiquetes dels dies)', () => {
        renderModal(makeDaily(SEPT));
        expect(screen.getAllByTestId('trend-column')[0].closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('el diàleg queda descrit pel resum de la tendència', () => {
        renderModal(makeDaily(SEPT));
        const dialog = screen.getByRole('dialog');
        const id = dialog.getAttribute('aria-describedby');
        expect(id).toBeTruthy();
        expect(document.getElementById(id!)).toBe(screen.getByTestId('trend-summary'));
    });

    it('respecta "reduir moviment": sense animació les columnes i les línies són visibles des del primer moment', () => {
        renderModal(makeDaily(SEPT));
        const css = document.querySelector('[role="dialog"] style')!.textContent ?? '';
        expect(css).toContain('prefers-reduced-motion: reduce');
        expect(css).toMatch(/reduce\)\s*\{[^}]*\.anim-draw-line\s*\{[^}]*animation:\s*none/);
        expect(css).toMatch(/\.anim-column\s*\{[^}]*animation:\s*none;\s*opacity:\s*1/);
    });

    describe('focus del diàleg', () => {
        const withOpener = (isOpen: boolean, onDayClick?: () => void) => (
            <>
                <button data-testid="opener">Obrir</button>
                <TrendChartModal isOpen={isOpen} onClose={() => {}} dailyData={makeDaily(SEPT)} chartData={[]} lang="ca" onDayClick={onDayClick} />
            </>
        );

        it('en obrir-se, el focus entra al diàleg (al botó de tancar) i en tancar-se torna a qui l\'havia obert', () => {
            const { rerender } = render(withOpener(false));
            const opener = screen.getByTestId('opener');
            opener.focus();
            expect(document.activeElement).toBe(opener);

            rerender(withOpener(true));
            expect(document.activeElement).toBe(screen.getByLabelText('Tancar modal'));

            rerender(withOpener(false));
            expect(document.activeElement).toBe(opener);
        });

        it('el Tab dóna la volta dins el diàleg: de l\'últim control al primer, i Maj+Tab al revés', () => {
            const { rerender } = render(withOpener(false, () => {}));
            rerender(withOpener(true, () => {}));
            const close = screen.getByLabelText('Tancar modal');
            const allDays = screen.getAllByTestId('trend-day');
            const lastDay = allDays[allDays.length - 1];

            lastDay.focus();
            fireEvent.keyDown(document, { key: 'Tab' });
            expect(document.activeElement).toBe(close);

            fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
            expect(document.activeElement).toBe(lastDay);
        });

        it('el Tab entre controls interns no es toca (només s\'intercepta a les vores)', () => {
            const { rerender } = render(withOpener(false, () => {}));
            rerender(withOpener(true, () => {}));
            const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
            (screen.getAllByTestId('trend-day')[1] as HTMLElement).focus();
            document.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(false);
        });

        it('un Tab amb el focus fora del diàleg el fa entrar al diàleg', () => {
            const { rerender } = render(withOpener(false, () => {}));
            rerender(withOpener(true, () => {}));
            screen.getByTestId('opener').focus();
            fireEvent.keyDown(document, { key: 'Tab' });
            expect(document.activeElement).toBe(screen.getByLabelText('Tancar modal'));
        });
    });
});

describe('TrendChartModal — línies de tendència, resum i colors', () => {
    const dOf = (id: string) => screen.getByTestId(id).getAttribute('d') ?? '';

    it('dibuixa dues línies, màximes i mínimes, d\'un sol traç quan hi ha totes les dades', () => {
        renderModal(makeDaily(SEPT));
        expect(dOf('trend-line-max').match(/M/g)).toHaveLength(1);
        expect(dOf('trend-line-max').match(/L/g)).toHaveLength(6);
        expect(dOf('trend-line-min').match(/L/g)).toHaveLength(6);
        expect(dOf('trend-line-min')).not.toBe(dOf('trend-line-max'));   // no són la mateixa línia
    });

    it('un dia sense dada trenca les dues línies en dos trams (no dibuixa per sobre del forat)', () => {
        renderModal(makeDaily(SEPT, {
            temperature_2m_max: [25, 24, 26, null, 30, 27, 25, 23],
            temperature_2m_min: [12, 12, 13, null, 15, 13, 12, 11],
        }));
        for (const id of ['trend-line-max', 'trend-line-min']) {
            expect(dOf(id).match(/M/g)).toHaveLength(2);   // dos trams: dies 1-2 i dies 4-7
            expect(dOf(id).match(/L/g)).toHaveLength(4);   // 1 segment + 3 segments
        }
    });

    it('cada càpsula es pinta amb el degradat de la paleta real entre la seva màxima i la seva mínima', () => {
        renderModal(makeDaily(SEPT, {
            temperature_2m_max: [25, 35, 32, 28, 28, 29, 28, 25],
            temperature_2m_min: [12, 19, 18, 14, 15, 16, 15, 14],
        }));
        const capsule = screen.getAllByTestId('trend-column')[0].children[1] as HTMLElement;
        // jsdom normalitza els colors hexadecimals a rgb() i treu el "to bottom" (és el valor per defecte).
        const asJsdom = buildCapsuleGradient(35, 19)
            .replace('to bottom, ', '')
            .replace(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/g, (_, r, g, b) =>
                `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`);
        expect(capsule.getAttribute('style')).toContain(asJsdom);
        // I no és el degradat lineal de dos colors d'abans: passa per les bandes intermèdies de la paleta.
        expect(asJsdom.match(/rgb\(/g)).toHaveLength(4);
    });

    describe('frase resum', () => {
        const summary = () => screen.getByTestId('trend-summary').textContent;

        it('un refredament es diu amb la seva forma i els noms dels dies (no "al llarg de la setmana")', () => {
            renderModal(makeDaily(SEPT, { temperature_2m_max: [25, 35, 32, 28, 28, 29, 28, 25] }));
            expect(summary()).toBe('Màximes entre 32° i 35° fins a dimarts; a partir de dimecres baixen fins a 25°. No es preveu pluja.');
            // El rang probable de diumenge (23-29°) no arriba als 32° d'abans: el refredament és clar.
            expect(screen.queryByTestId('trend-uncertain')).toBeNull();
        });

        it('una setmana que puja fins a un pic i torna a baixar es diu així, amb el dia del pic', () => {
            renderModal(makeDaily(SEPT));   // 24 ... 23 amb un pic de 30 dijous
            expect(summary()).toBe('Les màximes pugen fins a 30° dijous i després baixen fins a 23°. No es preveu pluja.');
        });

        it('si el bigoti del dia d\'arribada encara arriba al nivell de sortida, ho avisa amb les seves xifres', () => {
            // Baixa de 30° a 26°, però amb ECMWF 9° per sobre l'últim dia el rang probable de diumenge arriba a 32°.
            const max = [25, 30, 29, 28, 27, 27, 26, 26];
            const cmp = { ecmwf: model(max.map((v, i) => (i === 7 ? v + 9 : v)), MIN), gfs: model(max, MIN), icon: model(max, MIN) };
            renderModal(makeDaily(SEPT, { temperature_2m_max: max }), [], { dailyComparison: cmp });
            expect(summary()).toContain('Les màximes baixen de mica en mica: de 30° dilluns a 26° diumenge.');
            expect(screen.getByTestId('trend-uncertain').textContent).toBe(' Encara no és segur: diumenge la màxima pot anar de 23° a 32°.');
            // I és el mateix rang que dibuixa el bigoti de diumenge.
            expect(screen.getAllByTestId('probable-range').map(w => w.getAttribute('title'))).toContain('Rang probable (80 %): 23–32°');
        });

        it('diu quins dies pot ploure i quant', () => {
            renderModal(makeDaily(SEPT, {
                precipitation_probability_max: [10, 80, 75, 10, 10, 10, 10, 10],
                precipitation_sum: [0, 0.3, 1.2, 0, 0, 0, 0, 0],
            }));
            expect(screen.getByTestId('trend-precip').textContent).toBe(' Pot ploure dilluns i dimarts (fins a 1 mm en un dia).');
        });

        it('el resum surt en l\'idioma de l\'usuari', () => {
            renderModal(makeDaily(SEPT, { temperature_2m_max: [25, 35, 32, 28, 28, 29, 28, 25] }), [], { lang: 'en' });
            expect(summary()).toBe('Highs between 32° and 35° until Tuesday; from Wednesday they fall to 25°. No rain expected.');
        });

        it('amb menys de 3 dies amb màxima no es diu res (i el diàleg no queda descrit per un resum que no hi és)', () => {
            renderModal(makeDaily(SEPT, { temperature_2m_max: [25, 24, null, null, null, null, null, 23] }));
            expect(screen.queryByTestId('trend-summary')).toBeNull();
            expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBeNull();
        });
    });

    it('la llegenda diu quina línia és cada una', () => {
        renderModal(makeDaily(SEPT));
        expect(screen.getByText('Màximes')).toBeTruthy();
        expect(screen.getByText('Mínimes')).toBeTruthy();
    });
});

describe('ForecastSection ↔ gràfic: obrir el detall d\'un dia des del gràfic', () => {
    const dailyData = makeDaily(SEPT);

    const renderSection = (onDayClick: (i: number) => void) =>
        render(
            <ForecastSection
                chartData={[]}
                dailyData={dailyData}
                weeklyExtremes={{ min: 0, max: 30 }}
                lang="ca"
                onDayClick={onDayClick}
                latitude={41.9}
            />
        );

    it('un dia del gràfic tanca el gràfic i obre el detall d\'aquell dia un cop assentat l\'historial', async () => {
        const onDayClick = vi.fn();
        renderSection(onDayClick);

        fireEvent.click(screen.getByLabelText('Obrir gràfic de temperatures'));
        expect(screen.getByRole('dialog')).toBeTruthy();

        fireEvent.click(screen.getAllByTestId('trend-day')[4]);
        // No a l'instant: history.back() encara no ha acabat i el seu popstate tancaria el detall que s'obrís ara.
        expect(onDayClick).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).toBeNull();

        await waitFor(() => expect(onDayClick).toHaveBeenCalledTimes(1));
        expect(onDayClick).toHaveBeenCalledWith(5);
    });
});
