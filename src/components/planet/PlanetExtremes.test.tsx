// src/components/planet/PlanetExtremes.test.tsx
// La targeta i el detall d'«Extrems del planeta» (versió 2) amb les dades reals de l'01-11-2026 a les 20:44 UTC.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PlanetExtremesCard from './PlanetExtremesCard';
import PlanetExtremesModal from './PlanetExtremesModal';
import type { GdacsAlert, PlanetExtremes, StationRecord } from '../../services/planetExtremesApi';

const state: { data: PlanetExtremes | null } = { data: null };
vi.mock('../../hooks/usePlanetExtremes', () => ({
    usePlanetExtremes: () => ({ status: 'ready', data: state.data }),
}));

const NOW = Date.parse('2026-11-01T20:44:00Z');
const rec = (over: Partial<StationRecord>): StationRecord => ({
    id: 'XXXX', name: 'X', country: 'CO', lat: 0, lon: 0, elevM: 10, time: '2026-11-01T20:00:00.000Z', value: 0, ...over,
});
const MURASU: GdacsAlert = { type: 'TC', level: 'red', name: 'Murasu', country: 'IN', lat: 13.6, lon: 82.6, from: '2026-11-01T00:00:00.000Z', url: 'https://www.gdacs.org/report.aspx?eventid=1001346&episodeid=4&eventtype=TC' };

const today = (alerts: GdacsAlert[]): PlanetExtremes => ({
    metar: {
        updatedAt: '2026-11-01T20:44:35.000Z', stations: 4859, discarded: 11,
        wetBulb: [
            rec({ id: 'SKMR', name: 'Monteria', lat: 8.826, lon: -75.825, elevM: 12, value: 28.7, tempC: 36, dewC: 26 }),
            rec({ id: 'MMCT', name: 'Chichén Itzá', country: 'MX', lat: 20.6, lon: -88.4, value: 28.1, tempC: 34, dewC: 26, time: '2026-11-01T19:44:00.000Z' }),
            rec({ id: 'MNPC', name: 'Puerto Cabezas', country: 'NI', lat: 14, lon: -83.4, value: 28, tempC: 31, dewC: 27 }),
        ],
        hottest: [rec({ id: 'SKUC', name: 'Arauca', lat: 7.07, lon: -70.74, elevM: 127, value: 41 })],
        coldest: [rec({ id: 'NZSP', name: 'Amundsen-South Pole', country: 'AQ', lat: -89.98, lon: 180, elevM: 2830, value: -32, time: '2026-11-01T19:50:00.000Z' })],
        gustKmh: [rec({ id: 'LIVC', name: 'Monte Cimone', country: 'IT', lat: 44.19, lon: 10.7, elevM: 2139, value: 124.1, time: '2026-11-01T20:37:00.000Z' })],
        lowPressure: [rec({ id: 'SCRM', name: 'Teniente Marsh', country: 'AQ', lat: -62.19, lon: -58.99, elevM: 45, value: 974.9 })],
    },
    events: {
        updatedAt: '2026-11-01T20:44:35.000Z',
        fires: {
            count: 194,
            byCountry: [{ country: 'BW', count: 33 }, { country: 'AU', count: 27 }, { country: 'SS', count: 22 }, { country: 'TZ', count: 16 }, { country: 'NG', count: 15 }],
            largest: { country: 'BW', hectares: 102938, lat: -21.2, lon: 23.5 },
        },
        floods: { count: 8, byCountry: [{ country: 'TR', count: 1 }] },
        volcanoes: [],
        alerts,
    },
    cyclones: {
        updatedAt: '2026-11-01T20:44:36.000Z',
        cyclones: [{
            id: 'E1', name: 'In-fa', source: 'JTWC',
            track: [
                { time: '2026-11-01T06:00:00.000Z', lat: 22.3, lon: 144.1, windKt: 90 },
                { time: '2026-11-01T12:00:00.000Z', lat: 22.1, lon: 143.6, windKt: 85 },
            ],
        }],
    },
});

afterEach(cleanup);

describe('La targeta', () => {
    it("un dia normal, cap protagonista: cinc dades al mateix nivell, i cada una obre la seva fitxa", () => {
        state.data = today([]);
        const onOpen = vi.fn();
        render(<PlanetExtremesCard lang="ca" unit="C" nowMs={NOW} onOpen={onOpen} />);
        expect(screen.queryByText('Fenomen destacat')).toBeNull();
        expect(screen.getByText(/Cap fenomen excepcional ara mateix/)).toBeTruthy();
        // La calor humida, sense decimal.
        fireEvent.click(screen.getByRole('button', { name: /Calor humida.*29.°C.*Monteria/ }));
        expect(onOpen).toHaveBeenLastCalledWith({ kind: 'record', record: 'wetBulb' });
        fireEvent.click(screen.getByRole('button', { name: /Més fred/ }));
        expect(onOpen).toHaveBeenLastCalledWith({ kind: 'record', record: 'coldest' });
        expect(screen.getByText('cim de 2.139 m')).toBeTruthy();
        expect(screen.getByText('a nivell del mar')).toBeTruthy();
        // Un sol cicló: el xip n'obre la fitxa.
        fireEvent.click(screen.getByRole('button', { name: 'Tifó In-fa · cat. 2' }));
        expect(onOpen).toHaveBeenLastCalledWith({ kind: 'cyclone', id: 'E1' });
        expect(screen.getByText('mesures de fa 7 a 54 min')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Tot el detall/ }));
        expect(onOpen).toHaveBeenLastCalledWith({ kind: 'list', tab: 'records' });
    });

    it("l'01-11, el protagonista és Murasu, amb alerta vermella, i EONET encara no el té", () => {
        state.data = today([MURASU]);
        const onOpen = vi.fn();
        render(<PlanetExtremesCard lang="ca" unit="C" nowMs={NOW} onOpen={onOpen} />);
        expect(screen.getByText('Fenomen destacat')).toBeTruthy();
        expect(screen.getByText(/Es destaca perquè té alerta vermella de GDACS/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Cicló tropical Murasu/ }));
        expect(onOpen).toHaveBeenLastCalledWith({ kind: 'list', tab: 'events' });
        // In-fa i Murasu: dos ciclons.
        expect(screen.getByRole('button', { name: '2 ciclons' })).toBeTruthy();
    });
});

describe('El detall', () => {
    const place = { name: 'Barcelona', lat: 41.39, lon: 2.16 };

    it('de la llista a la fitxa de la calor humida i tornar, amb la capçalera comuna', () => {
        state.data = today([]);
        render(<PlanetExtremesModal lang="ca" unit="C" entry={{ kind: 'list', tab: 'records' }} place={place} onClose={vi.fn()} />);
        expect(screen.getByRole('heading', { name: 'Extrems del planeta' })).toBeTruthy();
        expect(screen.getByText('empat tècnic')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Calor humida/ }));
        expect(screen.getByRole('heading', { name: 'Calor humida' })).toBeTruthy();
        expect(screen.getByText(/Ara som aquí/)).toBeTruthy();
        expect(screen.getByText(/El seu nom tècnic és temperatura de bulb humit/)).toBeTruthy();
        expect(screen.getByText(/Empat tècnic\. Les estacions donen graus sencers/)).toBeTruthy();
        expect(screen.getByText('Cada cop més freqüent')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: "Torna a Rècords d'ara" }));
        expect(screen.getByRole('heading', { name: 'Extrems del planeta' })).toBeTruthy();
    });

    it('el més fred al Pol Sud amb sol tot el dia: per què, i «I l\'escalfament?» al revés', () => {
        state.data = today([]);
        render(<PlanetExtremesModal lang="ca" unit="C" entry={{ kind: 'record', record: 'coldest' }} place={place} onClose={vi.fn()} />);
        expect(screen.getByRole('heading', { name: 'El més fred' })).toBeTruthy();
        expect(screen.getByText('Fa sol tot el dia, i tot i així fa fred.')).toBeTruthy();
        expect(screen.getByText('Al revés')).toBeTruthy();
        expect(screen.getByRole('button', { name: "Veure Amundsen-South Pole des de l'òrbita" })).toBeTruthy();
    });

    it("la pressió més baixa a l'Antàrtida s'explica pel cinturó de borrasques", () => {
        state.data = today([]);
        render(<PlanetExtremesModal lang="ca" unit="C" entry={{ kind: 'record', record: 'lowPressure' }} place={place} onClose={vi.fn()} />);
        expect(screen.getByText("El cinturó de borrasques de l'Antàrtida.")).toBeTruthy();
        expect(screen.getByText('No es pot dir')).toBeTruthy();
    });

    it('els fenòmens: Murasu sense trajectòria porta a GDACS, i els incendis de la sabana tenen context', () => {
        state.data = today([MURASU]);
        render(<PlanetExtremesModal lang="ca" unit="C" entry={{ kind: 'list', tab: 'events' }} place={place} onClose={vi.fn()} />);
        const link = screen.getByRole('link', { name: /Cicló tropical Murasu\. Informe de GDACS/ });
        expect(link.getAttribute('href')).toBe(MURASU.url);
        expect(screen.getByText('NASA EONET encara no en té la trajectòria.')).toBeTruthy();
        expect(screen.getByText(/cremes de sabana a l'Àfrica/)).toBeTruthy();
    });

    it("la fitxa del cicló diu quant fa de la dada a dalt de tot", () => {
        state.data = today([]);
        render(<PlanetExtremesModal lang="ca" unit="C" entry={{ kind: 'cyclone', id: 'E1' }} place={place} onClose={vi.fn()} />);
        expect(screen.getByRole('heading', { name: 'Tifó In-fa' })).toBeTruthy();
        expect(screen.getByText(/^Dada de les 12:00 UTC/)).toBeTruthy();
        expect(screen.getByText('Més forts, no més nombrosos')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Torna a Fenòmens actius' })).toBeTruthy();
    });
});
