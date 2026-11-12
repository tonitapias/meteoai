// src/hooks/useRadarData.test.ts
// Quina font de radar fa servir el mapa i quina poden llegir els avisos
// (2026-11-12): RainViewer ja no anava per sobre de LibreWXR (dues paletes
// barrejades) i LibreWXR publicava hores noves amb la imatge d'Europa quieta.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { compareFrames, isLibreWxrStuck, type FrameChange } from '../utils/radarSampling';

const change = vi.hoisted(() => ({ byHost: {} as Record<string, FrameChange | null>, calls: 0 }));
vi.mock('../utils/radarSampling', async (orig) => ({
    ...(await orig<typeof import('../utils/radarSampling')>()),
    measureFrameChange: vi.fn(async (source: { host: string }) => {
        change.calls++;
        return change.byHost[source.host] ?? null;
    })
}));

import { useRadarSources } from './useRadarData';

const LW_HOST = 'https://api.librewxr.net';
const RV_HOST = 'https://tilecache.rainviewer.com';
const frames = (prefix: string) => Array.from({ length: 12 }, (_, i) => ({ time: 1794435600 + i * 600, path: `/v2/radar/${prefix}${i}` }));
const LW = { host: LW_HOST, radar: { past: frames('lw'), nowcast: [] }, satellite: { infrared: [] } };
const RV = { host: RV_HOST, radar: { past: frames('rv'), nowcast: [] }, satellite: { infrared: [] } };

// Canvi mesurat el 12-11 entre la primera i l'última imatge (~2 h), tessel·la z5 del lloc.
const MEASURED = {
    barcelona: { lw: { changed: 24624, wet: 96036 }, rv: { changed: 132545, wet: 136315 } },
    berlin: { lw: { changed: 0, wet: 49154 }, rv: { changed: 39201, wet: 39425 } },
    lagos: { lw: { changed: 1851, wet: 1853 }, rv: { changed: 0, wet: 0 } },
    oklahoma: { lw: { changed: 0, wet: 0 }, rv: { changed: 20302, wet: 20403 } },
    seattle: { lw: { changed: 2321, wet: 2352 }, rv: { changed: 2498, wet: 2563 } }
};

let lwResponse: unknown;
beforeEach(() => {
    change.byHost = {};
    change.calls = 0;
    lwResponse = LW;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (String(url).includes('librewxr')) {
            return lwResponse === 'fail' ? new Response('', { status: 503 }) : new Response(JSON.stringify(lwResponse), { status: 200 });
        }
        return new Response(JSON.stringify(RV), { status: 200 });
    }));
});

// La comprovació es desa per lloc i línies temporals: cada prova, un lloc propi (tessel·la z5 diferent).
async function sources(lat: number, lon: number) {
    const hook = renderHook(() => useRadarSources(lat, lon));
    await act(async () => { await hook.result.current.fetchRadarData(true); });
    return hook;
}

describe('isLibreWxrStuck', () => {
    it('amb els canvis mesurats el 12-11: encallat a Barcelona i Berlín, no a Lagos, Oklahoma ni Seattle', () => {
        expect(isLibreWxrStuck(MEASURED.barcelona.lw, MEASURED.barcelona.rv)).toBe(true);
        expect(isLibreWxrStuck(MEASURED.berlin.lw, MEASURED.berlin.rv)).toBe(true);
        expect(isLibreWxrStuck(MEASURED.lagos.lw, MEASURED.lagos.rv)).toBe(false);
        expect(isLibreWxrStuck(MEASURED.oklahoma.lw, MEASURED.oklahoma.rv)).toBe(false);
        expect(isLibreWxrStuck(MEASURED.seattle.lw, MEASURED.seattle.rv)).toBe(false);
    });

    it('sense prou pluja o sense mesura, no; quieta sense RainViewer per comparar, sí', () => {
        expect(isLibreWxrStuck({ changed: 0, wet: 299 }, null)).toBe(false);
        expect(isLibreWxrStuck(null, MEASURED.berlin.rv)).toBe(false);
        expect(isLibreWxrStuck({ changed: 10, wet: 5000 }, null)).toBe(true);
        // Pluja que canvia a poc a poc (60 %): no és encallada encara que RainViewer canviï més.
        expect(isLibreWxrStuck({ changed: 3000, wet: 5000 }, { changed: 4900, wet: 5000 })).toBe(false);
    });
});

describe('compareFrames', () => {
    it('compta els píxels amb eco en alguna imatge i els que han canviat', () => {
        const a = new Uint8ClampedArray([0, 0, 0, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 0, 0, 0]);
        const b = new Uint8ClampedArray([0, 0, 0, 0, 0, 255, 0, 255, 255, 255, 0, 255, 0, 0, 247, 255]);
        expect(compareFrames(a, b)).toEqual({ wet: 3, changed: 2 });
    });
});

describe('useRadarSources', () => {
    it('LibreWXR al dia: el mapa i els avisos fan servir LibreWXR', async () => {
        change.byHost = { [LW_HOST]: MEASURED.seattle.lw, [RV_HOST]: MEASURED.seattle.rv };
        const { result } = await sources(47.6, -122.3);
        await waitFor(() => expect(result.current.mapData?.host).toBe(LW_HOST));
        expect(result.current.samplingData?.host).toBe(LW_HOST);
        expect(result.current.loading).toBe(false);
    });

    it('LibreWXR encallat al lloc: el mapa passa a RainViewer i els avisos no llegeixen res', async () => {
        change.byHost = { [LW_HOST]: MEASURED.barcelona.lw, [RV_HOST]: MEASURED.barcelona.rv };
        const { result } = await sources(41.39, 2.17);
        await waitFor(() => expect(result.current.mapData?.host).toBe(RV_HOST));
        expect(result.current.samplingData).toBeNull();
    });

    it('mentre es fa la primera comprovació, el mapa espera (no pinta LibreWXR per canviar-lo de seguida)', async () => {
        let release: (v: FrameChange) => void = () => {};
        change.byHost = {};
        const pending = new Promise<FrameChange>((r) => { release = r; });
        const { measureFrameChange } = await import('../utils/radarSampling');
        vi.mocked(measureFrameChange).mockImplementationOnce(() => pending);
        const { result } = await sources(52.5, 13.4);
        expect(result.current.mapData).toBeNull();
        expect(result.current.samplingData).toBeNull();
        expect(result.current.loading).toBe(true);
        await act(async () => { release(MEASURED.berlin.lw); await pending; });
        await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it('LibreWXR caigut: el mapa és RainViewer, els avisos no llegeixen res i no cal comprovar res', async () => {
        lwResponse = 'fail';
        const { result } = await sources(6.5, 3.4);
        await waitFor(() => expect(result.current.mapData?.host).toBe(RV_HOST));
        expect(result.current.samplingData).toBeNull();
        expect(change.calls).toBe(0);
    });

    it('la comprovació es fa un sol cop per lloc i línies temporals (el mapa la troba feta pel tauler)', async () => {
        change.byHost = { [LW_HOST]: MEASURED.lagos.lw, [RV_HOST]: MEASURED.lagos.rv };
        const first = await sources(-33.9, 151.2);
        await waitFor(() => expect(first.result.current.mapData?.host).toBe(LW_HOST));
        const calls = change.calls;
        const second = await sources(-33.9, 151.2);
        await waitFor(() => expect(second.result.current.mapData?.host).toBe(LW_HOST));
        expect(change.calls).toBe(calls);
    });
});
