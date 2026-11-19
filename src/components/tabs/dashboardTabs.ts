// src/components/tabs/dashboardTabs.ts
// Les pestanyes del tauler i què hi va de la graella de ginys.
import type { DetailWidgetId } from '../detailWidgetIds';

export type DashboardTab = 'now' | 'forecast' | 'detail' | 'sky';

/** En l'ordre de la barra. */
export const DASHBOARD_TABS: readonly DashboardTab[] = ['now', 'forecast', 'detail', 'sky'];

/**
 * Detall: les condicions d'ara, per importància. La temperatura, la primera i a tota l'amplada (panoràmica, com la cota
 * de neu): no ocupa cap cel·la de la graella i les files de sota queden com eren. L'aire (que és doble a partir de
 * 768 px) va quart perquè a tres columnes les files quedin plenes sense reordenar res: vent, UV, visibilitat / aire,
 * núvols / pressió, rosada, CAPE. La cota de neu, quan surt, l'última i a tota l'amplada (com sempre).
 */
export const DETAIL_TAB_WIDGETS: readonly DetailWidgetId[] = [
  'temperature', 'wind', 'uv', 'visibility', 'aqi', 'cloudLayers', 'pressure', 'dewPoint', 'cape', 'snowLevel'
];

/** Cel: el cicle solar i la lluna (i, a sota, «Més enllà del teu cel»). */
export const SKY_TAB_WIDGETS: readonly DetailWidgetId[] = ['sun', 'moon'];

export const tabElementId = (tab: DashboardTab): string => `dashboard-tab-${tab}`;
export const panelElementId = (tab: DashboardTab): string => `dashboard-panel-${tab}`;
