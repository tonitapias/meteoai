// src/components/tabs/tabHistory.ts
// La pestanya a la URL (?tab=forecast|detail|sky; Ara no en porta) i l'ÚNICA entrada d'historial de les pestanyes.
//
// Per què així (vegeu TabbedDashboard):
// - L'enrere des de Previsió, Detall o Cel ha de tornar a Ara (com les apps), però canviar entre pestanyes no pot
//   omplir l'historial: en sortir d'Ara s'afegeix una sola entrada i, a partir d'aquí, només es reescriu la URL.
// - La pestanya es llegeix SEMPRE de la URL de l'entrada on s'aterra, mai de l'estat (history.state): tots els modals
//   (useModalHistory, el radar, el consens, el gràfic de 7 dies amb #modal-…, el planeta) afegeixen les seves entrades
//   amb la URL del moment, així que porten el mateix ?tab. Tancar un modal amb l'enrere deixa la pestanya com era.
// - Aquí no es crida mai history.back() (asíncron: la cursa que ja vam patir amb closeModalThen) ni es tanca res.
// - No es fa servir el #hash: useTacticalModal hi posa #modal-trendChart i tanca el gràfic si el hash canvia.
import { DASHBOARD_TABS, type DashboardTab } from './dashboardTabs';

export const TAB_PARAM = 'tab';
// Marca de l'entrada de les pestanyes: tornant a Ara amb la barra, l'entrada es queda (ara sense ?tab) i, si es torna
// a sortir d'Ara, es reaprofita en lloc d'afegir-ne una altra.
const TAB_ENTRY_KEY = 'meteoaiTabs';

const isTabEntry = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && (state as Record<string, unknown>)[TAB_ENTRY_KEY] === true;

/** La pestanya que diu la URL; qualsevol altra cosa (o res) és Ara. */
export const readTabFromSearch = (search: string): DashboardTab => {
  const value = new URLSearchParams(search).get(TAB_PARAM);
  return value && value !== 'now' && (DASHBOARD_TABS as readonly string[]).includes(value) ? (value as DashboardTab) : 'now';
};

/** La cerca amb la pestanya (Ara: sense el paràmetre). Els altres paràmetres (el lloc, ?ui) no es toquen. */
export const searchWithTab = (search: string, tab: DashboardTab): string => {
  const params = new URLSearchParams(search);
  if (tab === 'now') params.delete(TAB_PARAM);
  else params.set(TAB_PARAM, tab);
  const text = params.toString();
  return text ? `?${text}` : '';
};

const currentUrl = (): string => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const urlWithTab = (tab: DashboardTab): string =>
  `${window.location.pathname}${searchWithTab(window.location.search, tab)}${window.location.hash}`;

/**
 * En sortir d'Ara cap a una altra pestanya: afegeix l'entrada de les pestanyes, si no s'hi és ja (URL amb ?tab o
 * l'entrada marcada, tornada a Ara amb la barra). Mai més d'una.
 */
export const pushTabEntryIfNeeded = (tab: DashboardTab): void => {
  if (tab === 'now') return;
  if (readTabFromSearch(window.location.search) !== 'now') return;
  if (isTabEntry(window.history.state)) return;
  window.history.pushState({ [TAB_ENTRY_KEY]: true }, '', urlWithTab(tab));
};

/** Posa la pestanya a la URL de l'entrada actual, sense afegir-ne cap i conservant-ne l'estat. */
export const replaceTabInUrl = (tab: DashboardTab): void => {
  const next = urlWithTab(tab);
  if (next === currentUrl()) return;
  window.history.replaceState(window.history.state, '', next);
};
