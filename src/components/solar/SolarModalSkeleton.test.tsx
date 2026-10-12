// src/components/solar/SolarModalSkeleton.test.tsx
// Esquelet de càrrega del modal Cicle solar i precàrrega del seu tros de codi.
import { lazy, Suspense } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';
import type { Language } from '../../translations';
import { SolarModalSkeleton } from './SolarModalSkeleton';
import { isSolarSkeletonOnScreen, loadSolarModal, preloadSolarModal } from './preloadSolarModal';

describe('SolarModalSkeleton', () => {
  it.each<[Language, string, string]>([
    ['ca', 'Cicle solar', 'Tanca'],
    ['es', 'Ciclo solar', 'Cerrar'],
    ['en', 'Sun cycle', 'Close'],
    ['fr', 'Cycle solaire', 'Fermer'],
  ])('%s: diàleg ocupat amb el títol i el botó de tancar del modal', (lang, title, close) => {
    render(<SolarModalSkeleton lang={lang} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: close })).toBeInTheDocument();
  });

  it('un idioma desconegut cau al català', () => {
    render(<SolarModalSkeleton lang={'xx' as Language} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Cicle solar' })).toBeInTheDocument();
  });

  it('Escape i el botó criden onClose', () => {
    const onClose = vi.fn();
    render(<SolarModalSkeleton lang="ca" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Tanca' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('mentre és a la pantalla queda registrat (el modal que el substitueixi no repeteix l\'entrada)', () => {
    expect(isSolarSkeletonOnScreen()).toBe(false);
    const { unmount } = render(<SolarModalSkeleton lang="ca" onClose={() => {}} />);
    expect(isSolarSkeletonOnScreen()).toBe(true);
    unmount();
    expect(isSolarSkeletonOnScreen()).toBe(false);
  });

  it('no pren el focus: el modal ha de poder tornar-lo a la targeta del tauler', () => {
    const card = document.createElement('div');
    card.tabIndex = 0;
    document.body.appendChild(card);
    card.focus();
    render(<SolarModalSkeleton lang="ca" onClose={() => {}} />);
    expect(document.activeElement).toBe(card);
    card.remove();
  });

  it('és lleuger: com a molt 16 elements', () => {
    render(<SolarModalSkeleton lang="ca" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('*').length + 1).toBeLessThanOrEqual(16);
  });
});

describe('preloadSolarModal / loadSolarModal', () => {
  // Sense coordenades el modal mostra el panell "sense dades": prou per saber que s'ha muntat.
  const noCoords = {} as ExtendedWeatherData;

  it('l\'import() és memoritzat', () => {
    expect(preloadSolarModal()).toBe(preloadSolarModal());
  });

  it('amb el mòdul ja precarregat, lazy(loadSolarModal) munta el modal sense passar per l\'esquelet', async () => {
    await preloadSolarModal();
    const SolarModal = lazy(loadSolarModal);
    render(
      <Suspense fallback={<p>esquelet</p>}>
        <SolarModal weatherData={noCoords} onClose={() => {}} lang="ca" />
      </Suspense>,
    );
    expect(screen.queryByText('esquelet')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Cicle solar' })).toBeInTheDocument();
  });

  it('relleu real: el modal que substitueix l\'esquelet (encara que la càrrega trigui) no repeteix l\'entrada', async () => {
    const mod = await preloadSolarModal();
    let release: (m: typeof mod) => void = () => {};
    const SolarModal = lazy(() => new Promise<typeof mod>(res => { release = res; }));
    render(
      <Suspense fallback={<SolarModalSkeleton lang="ca" onClose={() => {}} />}>
        <SolarModal weatherData={noCoords} onClose={() => {}} lang="ca" />
      </Suspense>,
    );
    expect(screen.getByRole('dialog', { name: 'Cicle solar' })).toHaveAttribute('aria-busy', 'true');
    await act(async () => { release(mod); await Promise.resolve(); });
    const dialog = await screen.findByRole('dialog', { name: 'Cicle solar' });
    expect(dialog).not.toHaveAttribute('aria-busy');
    expect(dialog).toHaveAttribute('data-enter', 'none');
    expect(isSolarSkeletonOnScreen()).toBe(false);
  });

  it('control: amb una Promise nativa (ja resolta) React sí que suspèn i mostra l\'esquelet', async () => {
    await preloadSolarModal();
    const SolarModal = lazy(() => preloadSolarModal());
    render(
      <Suspense fallback={<p>esquelet</p>}>
        <SolarModal weatherData={noCoords} onClose={() => {}} lang="ca" />
      </Suspense>,
    );
    expect(screen.getByText('esquelet')).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(await screen.findByRole('dialog', { name: 'Cicle solar' })).toBeInTheDocument();
  });
});
