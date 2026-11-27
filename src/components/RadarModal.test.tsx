// src/components/RadarModal.test.tsx
// Obrir i tancar el radar en dos temps (INP): el mapa es munta després del primer pintat, i en tancar primer
// s'amaga el modal i després es desmunta. El mapa i el vent són falsos: aquí només compta el modal.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import RadarModal from './RadarModal';

vi.mock('./RadarMap', () => ({ default: () => <div data-testid="radar-map" /> }));
vi.mock('./WindMap', () => ({ default: () => <div data-testid="wind-map" /> }));

const nextPaint = async () => {
  // Un frame (rAF) i la tasca de després del pintat (setTimeout 0).
  await act(async () => { vi.advanceTimersByTime(40); });
};

describe('RadarModal: obrir i tancar sense bloquejar el frame', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    window.history.replaceState(null, '');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pinta primer la carcassa i munta el mapa després del primer pintat', async () => {
    render(<RadarModal lat={41.39} lon={2.17} onClose={() => {}} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('radar-map')).toBeNull();

    await nextPaint();
    expect(screen.getByTestId('radar-map')).toBeInTheDocument();
  });

  it('amb «enrere», el modal s’amaga de seguida i onClose arriba després del pintat', async () => {
    const onClose = vi.fn();
    render(<RadarModal lat={41.39} lon={2.17} onClose={onClose} />);
    await nextPaint();

    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(screen.getByRole('dialog', { hidden: true })).toHaveClass('invisible');
    expect(onClose).not.toHaveBeenCalled();

    await nextPaint();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('la creu sense entrada d’historial pròpia també tanca en dos temps, i només un cop', async () => {
    const onClose = vi.fn();
    render(<RadarModal lat={41.39} lon={2.17} onClose={onClose} />);
    await nextPaint();
    // Sense l'entrada «radarLive» (p. ex. si una altra navegació l'ha substituïda), la creu tanca directament.
    window.history.replaceState(null, '');

    const closeButtons = screen.getAllByRole('button', { name: 'closeWindow' });
    fireEvent.click(closeButtons[0]);
    fireEvent.click(closeButtons[1]);
    expect(screen.getByRole('dialog', { hidden: true })).toHaveClass('invisible');
    expect(onClose).not.toHaveBeenCalled();

    await nextPaint();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('si el modal es desmunta abans, el tancament pendent no crida onClose', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<RadarModal lat={41.39} lon={2.17} onClose={onClose} />);
    await nextPaint();

    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    unmount();
    await nextPaint();
    expect(onClose).not.toHaveBeenCalled();
  });
});
