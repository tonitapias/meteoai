// src/hooks/useLightningNearby.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../services/lightningService', () => ({ getLightningNearby: vi.fn() }));

import { useLightningNearby } from './useLightningNearby';
import { getLightningNearby, type LightningNearby } from '../services/lightningService';

const near: LightningNearby = { nearestKm: 12, bearingDeg: 200, observedAt: 1792447800, intense: false, activeSlots: 3 };
const mocked = vi.mocked(getLightningNearby);
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const minutes = (n: number) => act(async () => { await vi.advanceTimersByTimeAsync(n * 60_000); });

afterEach(() => {
    vi.useRealTimers();
    mocked.mockReset();
});

describe('useLightningNearby', () => {
    it('settled: fals fins que acaba la primera consulta (la IA hi espera)', async () => {
        vi.useFakeTimers();
        let resolve: (v: LightningNearby | null) => void = () => {};
        mocked.mockReturnValue(new Promise((r) => { resolve = r; }));
        const { result } = renderHook(() => useLightningNearby(41.4, 2.17));
        await flush();
        expect(result.current).toEqual({ lightning: null, settled: false });
        await act(async () => { resolve(null); await vi.advanceTimersByTimeAsync(0); });
        expect(result.current).toEqual({ lightning: null, settled: true });
    });

    it('una consulta fallida no esborra els llamps que ja se sabien; si les fallades duren 10 min, sí', async () => {
        vi.useFakeTimers();
        mocked.mockResolvedValueOnce(near).mockResolvedValue(undefined);
        const { result } = renderHook(() => useLightningNearby(41.4, 2.17));
        await flush();
        expect(result.current).toEqual({ lightning: near, settled: true });

        await minutes(1);
        expect(result.current.lightning).toBe(near);
        await minutes(8);
        expect(result.current.lightning).toBe(near);
        await minutes(2);
        expect(result.current.lightning).toBeNull();
        expect(result.current.settled).toBe(true);
    });

    it('una consulta nova sense llamps sí que els treu', async () => {
        vi.useFakeTimers();
        mocked.mockResolvedValueOnce(near).mockResolvedValue(null);
        const { result } = renderHook(() => useLightningNearby(41.4, 2.17));
        await flush();
        expect(result.current.lightning).toBe(near);
        await minutes(1);
        expect(result.current.lightning).toBeNull();
    });

    it('en canviar de lloc no es mostren els llamps de l\'anterior', async () => {
        vi.useFakeTimers();
        let resolveSecond: (v: LightningNearby | null) => void = () => {};
        mocked.mockResolvedValueOnce(near).mockReturnValueOnce(new Promise((r) => { resolveSecond = r; }));
        const { result, rerender } = renderHook(({ lat }) => useLightningNearby(lat, 2.17), { initialProps: { lat: 41.4 } });
        await flush();
        expect(result.current.lightning).toBe(near);

        rerender({ lat: 39.95 });
        expect(result.current).toEqual({ lightning: null, settled: false });
        await act(async () => { resolveSecond(null); await vi.advanceTimersByTimeAsync(0); });
        expect(result.current).toEqual({ lightning: null, settled: true });
    });
});
