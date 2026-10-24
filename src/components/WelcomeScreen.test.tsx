// src/components/WelcomeScreen.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WelcomeScreen from './WelcomeScreen';
import { TRANSLATIONS, type Language } from '../translations';
import type { LocateResult } from '../hooks/useAppActions';
import type { LocationData } from '../hooks/usePreferences';

const FAVORITES: LocationData[] = [
  { name: 'Girona', latitude: 41.98, longitude: 2.82, country: 'Espanya' },
  { name: 'Val Thorens', latitude: 45.3, longitude: 6.58, country: 'França' },
];

function renderWelcome(props: { lang?: Language; onLocate?: () => Promise<LocateResult>; onSelectLocation?: () => void; setLang?: (l: Language) => void } = {}) {
  const lang = props.lang ?? 'ca';
  const onLocate = props.onLocate ?? vi.fn(async (): Promise<LocateResult> => ({ ok: true }));
  const onSelectLocation = props.onSelectLocation ?? vi.fn();
  const setLang = props.setLang ?? vi.fn();
  render(
    <WelcomeScreen
      lang={lang}
      setLang={setLang}
      t={TRANSLATIONS[lang]}
      onLocate={onLocate}
      onSelectLocation={onSelectLocation}
      favorites={FAVORITES}
      loading={false}
    />
  );
  return { onLocate, onSelectLocation, setLang };
}

describe('WelcomeScreen', () => {
  beforeEach(() => {
    // jsdom no té geolocalització: sense això el botó d'ubicació no es mostraria.
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: vi.fn() } });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  it('mostra el titular i la frase de cada idioma', () => {
    renderWelcome({ lang: 'en' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The weather where you are, up close.');
    expect(screen.getByText(TRANSLATIONS.en.welcome.subtitle)).toBeInTheDocument();
  });

  it('un sol toc demana la ubicació (no cal mantenir premut)', async () => {
    const { onLocate } = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: /Utilitza la meva ubicació/ }));
    await waitFor(() => expect(onLocate).toHaveBeenCalledTimes(1));
  });

  it('si es denega el permís, ho explica a sota i el botó torna a funcionar', async () => {
    const onLocate = vi.fn(async (): Promise<LocateResult> => ({ ok: false, reason: 'denied' }));
    renderWelcome({ onLocate });
    const button = screen.getByRole('button', { name: /Utilitza la meva ubicació/ });
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(TRANSLATIONS.ca.welcome.errorDenied);
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    await waitFor(() => expect(onLocate).toHaveBeenCalledTimes(2));
  });

  it('diu la causa de cada error d\'ubicació', async () => {
    const onLocate = vi.fn(async (): Promise<LocateResult> => ({ ok: false, reason: 'timeout' }));
    renderWelcome({ onLocate });
    fireEvent.click(screen.getByRole('button', { name: /Utilitza la meva ubicació/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TRANSLATIONS.ca.welcome.errorTimeout);
  });

  it('sense geolocalització al navegador no ofereix el botó', () => {
    Reflect.deleteProperty(navigator, 'geolocation');
    renderWelcome();
    expect(screen.queryByRole('button', { name: /Utilitza la meva ubicació/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: TRANSLATIONS.ca.welcome.searchPlaceholder })).toBeInTheDocument();
  });

  it('els favorits obren la previsió d\'un toc', () => {
    const { onSelectLocation } = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Val Thorens' }));
    expect(onSelectLocation).toHaveBeenCalledWith(45.3, 6.58, 'Val Thorens', 'França');
  });

  it('canvia l\'idioma des del selector del mòbil i des dels botons', () => {
    const { setLang } = renderWelcome();
    fireEvent.change(screen.getByRole('combobox', { name: TRANSLATIONS.ca.welcome.language }), { target: { value: 'fr' } });
    expect(setLang).toHaveBeenCalledWith('fr');
    fireEvent.click(screen.getByRole('button', { name: 'es' }));
    expect(setLang).toHaveBeenCalledWith('es');
  });

  it('la columna del cel (carregada després del primer pintat) té una descripció i les capes de núvols', async () => {
    renderWelcome();
    expect(await screen.findByRole('img', { name: TRANSLATIONS.ca.welcome.columnAlt })).toBeInTheDocument();
    expect(screen.getByText(TRANSLATIONS.ca.welcome.cloudsLowShort)).toBeInTheDocument();
    // Quan arriba el cel, la línia de dalt hi afegeix el moment del dia (alba, dia, posta, nit o la lluna).
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).previousElementSibling?.textContent).toMatch(/·/));
  });
});
