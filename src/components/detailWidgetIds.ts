// src/components/detailWidgetIds.ts
// Els ginys de la graella de detall (vegeu DetailWidgetsGrid). Viuen en un fitxer propi perquè el del component només
// exporti components (Fast Refresh).

/** Cada giny de la graella. */
export type DetailWidgetId =
  | 'temperature' | 'wind' | 'uv' | 'visibility' | 'cloudLayers' | 'pressure' | 'dewPoint'
  | 'cape' | 'aqi' | 'snowLevel';

/** Tots els ginys, en l'ordre de sempre (són els de la pestanya Detall: vegeu tabs/dashboardTabs.ts). El sol i la lluna
 * són a la pestanya Cel, amb plafons propis (components/sky). */
export const ALL_DETAIL_WIDGETS: readonly DetailWidgetId[] = [
  'temperature', 'wind', 'uv', 'visibility', 'cloudLayers', 'pressure', 'dewPoint', 'cape', 'aqi', 'snowLevel'
];
