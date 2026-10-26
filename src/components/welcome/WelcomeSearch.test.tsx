// src/components/welcome/WelcomeSearch.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WelcomeSearch from './WelcomeSearch';
import type { GeoSearchResult } from '../../services/geocodingService';

const RESULTS: GeoSearchResult[] = [
  { id: 1, name: 'València', admin1: 'Comunitat Valenciana', country: 'Espanya', latitude: 39.47, longitude: -0.38 },
  { id: 2, name: 'Valencia', admin1: 'Estado Carabobo', country: 'Veneçuela', latitude: 10.16, longitude: -68.0 },
  { id: 3, name: 'Valencia', admin1: 'Califòrnia', country: 'EUA', latitude: 34.44, longitude: -118.61 },
  { id: 4, name: 'Valencia', admin1: 'Provincia de Los Ríos', country: 'Equador', latitude: -0.95, longitude: -79.35 },
  { id: 5, name: 'NIA Valencia', admin1: 'Mindanao Septentrional', country: 'Filipines', latitude: 7.9, longitude: 125.1 },
];

vi.mock('../../services/geocodingService', () => ({ searchCity: vi.fn(async () => RESULTS) }));

const LABELS = { placeholder: 'Cerca una ciutat o un poble', searching: 'Cercant…', noResults: 'Cap resultat', favorites: 'Favorits', moreFavorites: 'Mostra {n} favorits més' };

function renderSearch() {
  const onSelect = vi.fn();
  render(<WelcomeSearch labels={LABELS} favorites={[]} onSelect={onSelect} />);
  const input = screen.getByRole('combobox', { name: LABELS.placeholder });
  return { onSelect, input };
}

/** Simula on és el camp a la pantalla (jsdom no fa layout). */
function placeInput(top: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top, bottom: top + 56, left: 20, right: 355, width: 335, height: 56, x: 20, y: top, toJSON: () => ({}),
  } as DOMRect);
}

describe('WelcomeSearch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mostra tots els resultats i en tria qualsevol amb el teclat', async () => {
    const { onSelect, input } = renderSearch();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Valencia' } });
    expect(await screen.findAllByRole('option')).toHaveLength(5);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.submit(input.closest('form')!);
    expect(onSelect).toHaveBeenCalledWith(10.16, -68.0, 'Valencia', 'Veneçuela');
  });

  it('un toc en un resultat que no és el primer obre aquell lloc', async () => {
    const { onSelect, input } = renderSearch();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Valencia' } });
    const options = await screen.findAllByRole('option');
    fireEvent.mouseDown(options[3]);
    expect(onSelect).toHaveBeenCalledWith(-0.95, -79.35, 'Valencia', 'Equador');
  });

  it('amb el camp a baix de la pantalla, la llista s\'obre cap amunt (no queda tapada ni sota el teclat)', async () => {
    placeInput(window.innerHeight - 120);
    const { input } = renderSearch();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Valencia' } });
    await screen.findAllByRole('option');
    const list = screen.getByRole('listbox');
    expect(list.dataset.placement).toBe('up');
    expect(list.style.maxHeight).toBe('288px');
  });

  it('si a sota hi cap la llista sencera, s\'obre cap avall', async () => {
    placeInput(100);
    const { input } = renderSearch();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Valencia' } });
    await screen.findAllByRole('option');
    expect(screen.getByRole('listbox').dataset.placement).toBe('down');
  });

  it('ensenya tres favorits i la resta darrere del botó "+N"', () => {
    const fav = (name: string, latitude: number) => ({ name, latitude, longitude: 2 });
    const onSelect = vi.fn();
    render(<WelcomeSearch labels={LABELS} favorites={[fav('A', 1), fav('B', 2), fav('C', 3), fav('D', 4), fav('E', 5)]} onSelect={onSelect} />);
    expect(screen.queryByRole('button', { name: 'D' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mostra 2 favorits més' }));
    expect(screen.queryByRole('button', { name: /favorits més/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'E' }));
    expect(onSelect).toHaveBeenCalledWith(5, 2, 'E', undefined);
  });
});

describe('WelcomeSearch — idioma dels resultats', () => {
  afterEach(() => vi.restoreAllMocks());

  it("demana els noms en l'idioma de la interfície", async () => {
    const { searchCity } = await import('../../services/geocodingService');
    render(<WelcomeSearch labels={LABELS} favorites={[]} lang="en" onSelect={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: LABELS.placeholder });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Londres' } });
    await screen.findAllByRole('option');
    expect(searchCity).toHaveBeenLastCalledWith('Londres', 'en');
  });
});
