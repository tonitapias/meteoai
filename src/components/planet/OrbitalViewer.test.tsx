import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import OrbitalViewer from './OrbitalViewer';
import { buildOrbitMarkers, capPerKind, MAX_VISIBLE } from './orbitalMarkers';
import { PLANET_STRINGS } from './planetI18n';
import { summarizeCyclone } from '../../utils/planetExtremes';
import type { PlanetExtremes, StationRecord } from '../../services/planetExtremesApi';

vi.mock('../../hooks/useOrbitalImage', () => ({
    useOrbitalImage: () => ({ status: 'ready', src: 'blob:disc', timeMs: Date.UTC(2026, 9, 31, 2, 30), product: 'ir' }),
}));

const s = PLANET_STRINGS.ca;
const station = (id: string, name: string, lat: number, lon: number, value: number): StationRecord => ({ id, name, country: 'AU', lat, lon, elevM: 0, time: '2026-10-31T02:00:00Z', value });

const DATA: PlanetExtremes = {
    metar: {
        updatedAt: '2026-10-31T03:00:00Z', stations: 4980, discarded: 23,
        hottest: [station('YBMA', 'Mount Isa', -20.7, 139.5, 37)], coldest: [], wetBulb: [], gustKmh: [], lowPressure: [],
    },
    events: {
        updatedAt: '2026-10-31T03:00:00Z',
        fires: {
            count: 80,
            byCountry: [
                { country: 'AU', count: 31, lat: -16.4, lon: 132.6 }, { country: 'BW', count: 23, lat: -21.8, lon: 23.4 },
                { country: 'SS', count: 16, lat: 9.5, lon: 27.6 }, { country: 'TZ', count: 15, lat: -9.2, lon: 36.1 },
                { country: 'MZ', count: 14, lat: -15.6, lon: 35.5 }, { country: 'ZM', count: 9, lat: -13, lon: 27 },
            ],
            largest: { country: 'AU', hectares: 59795, lat: -18.8, lon: 125.2 },
        },
        floods: { count: 1, byCountry: [{ country: 'IN', count: 1, lat: 17.2, lon: 81.7 }] },
        volcanoes: [{ name: 'Merapi', country: 'ID', lat: -7.5, lon: 110.4 }],
    },
    cyclones: { updatedAt: '2026-10-31T03:00:00Z', cyclones: [] },
};

const IN_FA = summarizeCyclone({ id: 'E1', name: 'In-fa', source: 'JTWC', track: [{ time: '2026-10-30T18:00:00Z', lat: 20.5, lon: 143.4, windKt: 115 }] });
const PLACE = { name: 'Barcelona', lat: 41.39, lon: 2.16 };

describe('Marcadors del visor', () => {
    it('ciclons primer, després rècords, el lloc, incendis, inundacions i volcans', () => {
        const markers = buildOrbitMarkers({ data: DATA, summaries: [IN_FA], s, lang: 'ca', unit: 'C', place: PLACE });
        expect(markers.map((m) => m.kind)).toEqual(['cyclone', 'record', 'here', 'fires', 'fires', 'fires', 'fires', 'fires', 'fires', 'floods', 'volcano']);
        expect(markers[0]).toMatchObject({ label: 'Tifó In-fa · cat. 4', cycloneId: 'E1', category: 4 });
        expect(markers[1].label).toBe('37\u00a0°C · Mount Isa');
        expect(markers[2].label).toBe('Barcelona');
        expect(markers[3].label).toBe('Incendis · Austràlia');
    });

    it("un worker anterior (sense posicions per país) deixa, com a mínim, l'incendi més extens", () => {
        const old: PlanetExtremes = { ...DATA, events: { ...DATA.events!, fires: { ...DATA.events!.fires, byCountry: [{ country: 'AU', count: 31 }] }, floods: { count: 1, byCountry: [{ country: 'IN', count: 1 }] }, volcanoes: [{ name: 'Merapi', country: 'ID' }] } };
        const markers = buildOrbitMarkers({ data: old, summaries: [], s, lang: 'ca', unit: 'C', place: null });
        expect(markers.filter((m) => m.kind === 'fires')).toEqual([expect.objectContaining({ id: 'fires-largest', lat: -18.8, lon: 125.2 })]);
        expect(markers.some((m) => m.kind === 'floods' || m.kind === 'volcano')).toBe(false);
    });

    it('a cada disc, només els països amb més incendis que veu aquell ull', () => {
        const markers = buildOrbitMarkers({ data: DATA, summaries: [], s, lang: 'ca', unit: 'C', place: null });
        const capped = capPerKind(markers.map((marker) => ({ marker })));
        expect(capped.filter(({ marker }) => marker.kind === 'fires')).toHaveLength(MAX_VISIBLE.fires as number);
        expect(capped.filter(({ marker }) => marker.kind === 'record')).toHaveLength(1);
    });
});

describe('OrbitalViewer', () => {
    // jsdom no fa maquetació: el quadre del disc fa 360 px perquè s'hi puguin col·locar els marcadors.
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 360 });
    });
    afterAll(() => {
        if (original) Object.defineProperty(HTMLElement.prototype, 'clientWidth', original);
    });
    afterEach(cleanup);

    const renderViewer = (eye: 'meteosat' | 'goes' | 'himawari', handlers: Partial<Record<'onEyeChange' | 'onBack' | 'onClose' | 'onOpenCyclone', () => void>> = {}) =>
        render(
            <OrbitalViewer
                data={DATA} summaries={[IN_FA]} eye={eye} s={s} lang="ca" unit="C" place={PLACE}
                onEyeChange={handlers.onEyeChange ?? vi.fn()} onBack={handlers.onBack ?? vi.fn()}
                onClose={handlers.onClose ?? vi.fn()} onOpenCyclone={handlers.onOpenCyclone ?? vi.fn()}
            />,
        );

    it("a l'Himawari, el tifó es pot tocar i n'obre la fitxa (des del disc i des de la llista)", () => {
        const onOpenCyclone = vi.fn();
        renderViewer('himawari', { onOpenCyclone });
        expect(screen.getByText('Himawari-9 · 140,7° E · 02:30 UTC')).toBeTruthy();
        expect(screen.getByAltText('Imatge de satèl·lit de la Terra sencera (Himawari-9)')).toBeTruthy();
        expect(screen.getByText(s.infrared)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Tifó In-fa · cat. 4. Obre la fitxa.' }));
        fireEvent.click(screen.getByRole('button', { name: /^Tifó In-fa.*Categoria 4/ }));
        expect(onOpenCyclone).toHaveBeenNthCalledWith(1, 'E1');
        expect(onOpenCyclone).toHaveBeenNthCalledWith(2, 'E1');
    });

    it("al Meteosat, el tifó no hi és: un botó porta a l'ull que el veu", () => {
        const onEyeChange = vi.fn();
        renderViewer('meteosat', { onEyeChange });
        expect(screen.queryByRole('button', { name: /Obre la fitxa/ })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /A l'altra banda del planeta/ }));
        expect(onEyeChange).toHaveBeenCalledWith('himawari');
    });

    it('el selector dels tres ulls i la fletxa per tornar', () => {
        const onEyeChange = vi.fn();
        const onBack = vi.fn();
        renderViewer('goes', { onEyeChange, onBack });
        expect(screen.getByRole('button', { name: 'GOES' }).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: 'Meteosat' }));
        expect(onEyeChange).toHaveBeenCalledWith('meteosat');
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Extrems del planeta' }));
        fireEvent.click(screen.getByRole('button', { name: 'Extrems del planeta' }));
        expect(onBack).toHaveBeenCalled();
    });
});
