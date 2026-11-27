import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { afterNextPaint } from './afterNextPaint';

describe('afterNextPaint', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('no corre de seguida ni dins del frame: va en la tasca de després', () => {
    const order: string[] = [];
    afterNextPaint(() => order.push('després del pintat'));
    requestAnimationFrame(() => order.push('frame'));
    expect(order).toEqual([]);

    vi.advanceTimersToNextFrame();
    expect(order).toEqual(['frame']);

    // Els temporitzadors falsos programen a +1 ms un setTimeout(…, 0) creat dins d'un avanç.
    vi.advanceTimersByTime(1);
    expect(order).toEqual(['frame', 'després del pintat']);
  });

  it('es pot anul·lar abans del frame i també entre el frame i la tasca', () => {
    const early = vi.fn();
    const late = vi.fn();
    const cancelEarly = afterNextPaint(early);
    const cancelLate = afterNextPaint(late);

    cancelEarly();
    vi.advanceTimersToNextFrame();
    cancelLate();
    vi.advanceTimersByTime(100);

    expect(early).not.toHaveBeenCalled();
    expect(late).not.toHaveBeenCalled();
  });

  it('amb la pestanya amagada no espera cap frame (no n\'hi hauria)', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const cb = vi.fn();
    afterNextPaint(cb);

    vi.advanceTimersByTime(0);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
