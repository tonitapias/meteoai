// src/components/detailWidgetIds.ts
// Els ginys de la graella de detall (vegeu DetailWidgetsGrid). Viuen en un fitxer propi perquè el del component només
// exporti components (Fast Refresh).

/** Cada giny de la graella. */
export type DetailWidgetId =
  | 'wind' | 'uv' | 'visibility' | 'cloudLayers' | 'pressure' | 'dewPoint'
  | 'cape' | 'aqi' | 'moon' | 'sun' | 'snowLevel';

/** Tots els ginys, en l'ordre de sempre (Detall i Cel se'ls reparteixen: vegeu tabs/dashboardTabs.ts). */
export const ALL_DETAIL_WIDGETS: readonly DetailWidgetId[] = [
  'wind', 'uv', 'visibility', 'cloudLayers', 'pressure', 'dewPoint', 'cape', 'aqi', 'moon', 'sun', 'snowLevel'
];
