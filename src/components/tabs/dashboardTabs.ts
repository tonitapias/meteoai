// src/components/tabs/dashboardTabs.ts
// Les pestanyes del tauler (interfície per pestanyes, de moment amb ?ui=tabs) i què hi va de la graella de ginys.
import type { DetailWidgetId } from '../detailWidgetIds';

export type DashboardTab = 'now' | 'forecast' | 'detail' | 'sky';

/** En l'ordre de la barra. */
export const DASHBOARD_TABS: readonly DashboardTab[] = ['now', 'forecast', 'detail', 'sky'];

/**
 * Detall: les condicions d'ara, per importància. L'aire (que és doble a partir de 768 px) va quart perquè a tres
 * columnes les files quedin plenes sense reordenar res: vent, UV, visibilitat / aire, núvols / pressió, rosada, CAPE.
 * La cota de neu, quan surt, l'última i a tota l'amplada (com a la vista completa).
 */
export const DETAIL_TAB_WIDGETS: readonly DetailWidgetId[] = [
  'wind', 'uv', 'visibility', 'aqi', 'cloudLayers', 'pressure', 'dewPoint', 'cape', 'snowLevel'
];

/** Cel: el cicle solar i la lluna (i, a sota, «Més enllà del teu cel»). */
export const SKY_TAB_WIDGETS: readonly DetailWidgetId[] = ['sun', 'moon'];

export const tabElementId = (tab: DashboardTab): string => `dashboard-tab-${tab}`;
export const panelElementId = (tab: DashboardTab): string => `dashboard-panel-${tab}`;
