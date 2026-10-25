// src/components/viewModeStyle.ts
// Colors i icones de cada vista, compartits pel xip de la capçalera (ViewModeChip) i per la franja on
// comença la vista completa al tauler (ViewModeSections), perquè tota l'app parli el mateix "idioma":
// Essencial en blau cel amb un quadre; Completa en indi (el color que tenia el botó "Expert") amb una graella.
import { LayoutGrid, Square } from 'lucide-react';
import type { ViewMode } from '../hooks/usePreferences';

export interface ViewModeStyle {
  Icon: typeof Square;
  /** Vora i fons del control (xip, botó o franja) en repòs i en passar-hi per sobre. */
  chip: string;
  chipOpen: string;
  /** Text i icones secundaris. */
  soft: string;
  /** Text principal. */
  strong: string;
  dot: string;
}

export const VIEW_MODE_STYLE: Record<ViewMode, ViewModeStyle> = {
  basic: {
    Icon: Square,
    chip: 'border-sky-400/45 bg-sky-500/10 hover:border-sky-300/60 hover:bg-sky-500/15',
    chipOpen: 'border-sky-300/70 bg-sky-500/20',
    soft: 'text-sky-300/80',
    strong: 'text-sky-50',
    dot: 'bg-sky-400',
  },
  expert: {
    Icon: LayoutGrid,
    chip: 'border-indigo-400/50 bg-indigo-500/[0.14] hover:border-indigo-300/60 hover:bg-indigo-500/20',
    chipOpen: 'border-indigo-300/70 bg-indigo-500/25',
    soft: 'text-indigo-300/80',
    strong: 'text-indigo-50',
    dot: 'bg-indigo-400',
  },
};
