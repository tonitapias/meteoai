// src/hooks/radarSamplingHooks.test.ts
// Lectura puntual del radar (useRadarRealityCheck, useRadarNowcastTiming) quan una tessel·la no es pot llegir:
// el 26-10-2026 dues de LibreWXR van fallar per CORS, i RainViewer al zoom 8 respon una imatge "Zoom Level Not Supported".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { radarTileUrl, sampleZoomForHost } from '../utils/radarSampling';

const LW = { host: 'https://api.librewxr.net', radar: { past: [{ path: '/v2/radar/100', time: 100 }], nowcast: [{ path: '/v2/radar/n1', time: 4102444800 }, { path: '/v2/radar/n2', time: 4102445400 }] } };
const RV = { host: 'https://tilecache.rainviewer.com', radar: { past: [{ path: '/v2/radar/rv1', time: 100 }], nowcast: [] } };

// radarData = la font que dibuixa el mapa (LibreWXR, o RainViewer si LibreWXR no respon); librewxrData = la que es pot mostrejar.
const radar = vi.hoisted(() => ({ data: { radarData: null as unknown, librewxrData: null as unknown } }));
// La tria de font (LibreWXR encallat, etc.) es prova a useRadarData.test.ts: aquí, la que reben els avisos.
vi.mock('./useRadarData', () => ({
    useRadarSources: () => ({ samplingData: radar.data.librewxrData, mapData: radar.data.radarData, fetchRadarData: vi.fn() })
}));

// Píxels: groc NEXRAD (35 dBZ, pluja clara) o transparent (sense eco); null = tessel·la il·legible.
const WET: [number, number, number, number] = [255, 255, 0, 255];
const DRY: [number, number, number, number] = [0, 0, 0, 0];
const pixels = vi.hoisted(() => ({ byUrl: new Map<string, [number, number, number, number] | null>(), calls: [] as string[] }));
vi.mock('../utils/radarSampling', async (orig) => ({
    ...(await orig<typeof import('../utils/radarSampling')>()),
    fetchTilePixel: vi.fn(async (url: string) => {
        pixels.calls.push(url);
        for (const [key, value] of pixels.byUrl) if (url.includes(key)) return value;
        return DRY;
    })
}));

import { useRadarRealityCheck } from './useRadarRealityCheck';
import { useRadarNowcastTiming } from './useRadarNowcastTiming';

beforeEach(() => {
    pixels.byUrl.clear();
    pixels.calls.length = 0;
    radar.data = { radarData: LW, librewxrData: LW };
});

describe('sampleZoomForHost', () => {
    it('RainViewer, zoom 7 (al 8 dona una imatge d\'error); LibreWXR, 8', () => {
        expect(sampleZoomForHost(RV.host)).toBe(7);
        expect(sampleZoomForHost(LW.host)).toBe(8);
        // Sense l'opció de neu (snow=0): els colors de la neu no són els de la taula de la pluja.
        expect(radarTileUrl(RV.host, '/v2/radar/rv1', { z: 7, x: 64, y: 47 })).toBe('https://tilecache.rainviewer.com/v2/radar/rv1/512/7/64/47/6/1_0.png');
    });
});

// RainViewer ja no fa cas de l'esquema de colors (11-2026): la seva plugim beix surt com a 70-73 dBZ amb la taula NEXRAD.
describe('useRadarRealityCheck', () => {
    it('llegeix el píxel de LibreWXR al zoom 8', async () => {
        pixels.byUrl.set('/v2/radar/100/', WET);
        const { result } = renderHook(() => useRadarRealityCheck(41.98, 2.82, 0));
        await waitFor(() => expect(result.current.hasDiscrepancy).toBe(true));
        expect(pixels.calls).toHaveLength(1);
        expect(pixels.calls[0]).toContain('librewxr.net/v2/radar/100/512/8/');
    });

    it('si la tessel·la de LibreWXR no es pot llegir, no avisa i no llegeix la de RainViewer', async () => {
        pixels.byUrl.set('/v2/radar/100/', null);
        pixels.byUrl.set('/v2/radar/rv1/', WET);
        const { result } = renderHook(() => useRadarRealityCheck(41.98, 2.82, 0));
        await waitFor(() => expect(pixels.calls.length).toBeGreaterThan(0));
        await new Promise(r => setTimeout(r, 20));
        expect(result.current.hasDiscrepancy).toBe(false);
        expect(pixels.calls.some(u => u.includes('rainviewer.com'))).toBe(false);
    });

    it('amb LibreWXR caigut (el mapa dibuixa RainViewer), no mostreja res', async () => {
        radar.data = { radarData: RV, librewxrData: null };
        pixels.byUrl.set('/v2/radar/rv1/', WET);
        const { result } = renderHook(() => useRadarRealityCheck(41.98, 2.82, 0));
        await new Promise(r => setTimeout(r, 20));
        expect(pixels.calls).toEqual([]);
        expect(result.current.hasDiscrepancy).toBe(false);
    });
});

describe('useRadarNowcastTiming', () => {
    it('plou ara i la imatge següent no es pot llegir: no anuncia que la pluja s\'acaba', async () => {
        pixels.byUrl.set('/v2/radar/100/', WET);
        pixels.byUrl.set('/v2/radar/n1/', null);
        pixels.byUrl.set('/v2/radar/n2/', DRY);
        const { result } = renderHook(() => useRadarNowcastTiming(41.98, 2.82));
        await waitFor(() => expect(pixels.calls.some(u => u.includes('/n1/'))).toBe(true));
        await new Promise(r => setTimeout(r, 20));
        expect(result.current.transition).toBeNull();
    });

    it('amb totes les imatges llegibles, sí que troba quan s\'acaba', async () => {
        pixels.byUrl.set('/v2/radar/100/', WET);
        pixels.byUrl.set('/v2/radar/n1/', WET);
        pixels.byUrl.set('/v2/radar/n2/', DRY);
        const { result } = renderHook(() => useRadarNowcastTiming(41.98, 2.82));
        await waitFor(() => expect(result.current.transition?.type).toBe('end'));
    });

    it('amb LibreWXR caigut (el mapa dibuixa RainViewer), no mostreja res', async () => {
        radar.data = { radarData: RV, librewxrData: null };
        const { result } = renderHook(() => useRadarNowcastTiming(41.98, 2.82));
        await new Promise(r => setTimeout(r, 20));
        expect(pixels.calls).toEqual([]);
        expect(result.current.transition).toBeNull();
    });
});
