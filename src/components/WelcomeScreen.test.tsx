// src/components/WelcomeScreen.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WelcomeScreen from './WelcomeScreen';
import { TRANSLATIONS, type Language } from '../translations';
import type { LocateResult } from '../hooks/useAppActions';
import type { LocationData } from '../hooks/usePreferences';
import { WELCOME_ACCENT } from '../utils/welcome/welcomeAccent';
import { ELEVATOR_TEXT } from './welcome/elevatorI18n';

// El cel (la columna, l'accent del titular i el moment del dia) es carrega amb un import dinàmic després del
// primer pintat. L'espera per defecte d'1 s no n'hi ha prou quan la màquina va carregada (la prova de l'accent
// fallava una de cada tres vegades fins i tot sola): el que es prova és que arriba, no quan.
const SKY_WAIT = { timeout: 5000 };

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

  it('la segona línia del titular agafa l\'accent del moment del dia quan arriba el cel', async () => {
    renderWelcome();
    const h1 = screen.getByRole('heading', { level: 1 });
    // El text accessible és la frase sencera, amb l'espai entre les dues línies.
    expect(h1.textContent).toBe(TRANSLATIONS.ca.welcome.headline);
    const second = screen.getByText('vist de més a prop.');
    const accents = Object.values(WELCOME_ACCENT).map(hex => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    });
    await waitFor(() => expect(accents).toContain(second.style.color), SKY_WAIT);
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
    expect(await screen.findByRole('img', { name: TRANSLATIONS.ca.welcome.columnAlt }, SKY_WAIT)).toBeInTheDocument();
    expect(screen.getByText(TRANSLATIONS.ca.welcome.cloudsLowShort)).toBeInTheDocument();
    // Quan arriba el cel, la línia de dalt hi afegeix el moment del dia (alba, dia, posta, nit o la lluna).
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).previousElementSibling?.textContent).toMatch(/·/), SKY_WAIT);
  });

  it("estirar la columna cap amunt tres cops obre l'ascensor, i el botó de sortir el tanca", async () => {
    // L'ascensor demana els núvols a Open-Meteo i l'hora de la foto a EUMETSAT: a les proves, sense xarxa.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('sense xarxa'));
    renderWelcome();
    // El contenidor que escolta el gest: el pare de l'arrel de la columna (svg → arrel → contenidor).
    const column = (await screen.findByRole('img', { name: TRANSLATIONS.ca.welcome.columnAlt }, SKY_WAIT)).parentElement!.parentElement!;
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).previousElementSibling?.textContent).toMatch(/·/), SKY_WAIT);
    // jsdom no té PointerEvent: un MouseEvent amb el tipus i els camps del punter.
    const pointer = (type: string, clientY: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientY, button: 0 });
      Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, pointerType: { value: 'touch' } });
      column.dispatchEvent(event);
    };
    const pull = () => { pointer('pointerdown', 300); pointer('pointermove', 150); pointer('pointerup', 150); };

    pull();
    pull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    pull();
    expect(await screen.findByRole('dialog', { name: ELEVATOR_TEXT.ca.dialog }, SKY_WAIT)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: ELEVATOR_TEXT.ca.close }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fetchSpy.mockRestore();
  });
});
