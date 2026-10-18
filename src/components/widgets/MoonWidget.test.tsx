// src/components/widgets/MoonWidget.test.tsx
// Textos de la targeta Fase lunar en els 4 idiomes (abans, en francès sortia castellà) i edat real.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoonWidget } from './MoonWidget';
import type { Language } from '../../translations';

// Barcelona, 18-10-2026 16:12 UTC: quart creixent real (fase 0,25), Lluna de 8 dies.
const NOW = Date.UTC(2026, 9, 18, 16, 12);
const renderCard = (lang: Language, ageDays?: number) =>
  render(<MoonWidget phase={0.25} ageDays={ageDays} lat={41.3888} lon={2.159} timezone="Europe/Madrid" date={NOW} lang={lang} />);

describe('MoonWidget — idioma', () => {
  it.each([
    ['ca', 'Il·luminació', 'Sortida', 'Posta', 'Dia 8'],
    ['es', 'Iluminación', 'Salida', 'Puesta', 'Día 8'],
    ['en', 'Illumination', 'Rise', 'Set', 'Day 8'],
    ['fr', 'Illumination', 'Lever', 'Coucher', 'Jour 8'],
  ] as Array<[Language, string, string, string, string]>)('%s: etiquetes i text emergent de la icona', (lang, illum, rise, set, day) => {
    const { container } = renderCard(lang, 8);
    expect(screen.getByText(illum)).toBeTruthy();
    expect(screen.getByText(rise)).toBeTruthy();
    expect(screen.getByText(set)).toBeTruthy();
    expect(screen.getByText(day)).toBeTruthy();
    expect(container.querySelector(`[title="${illum}: 50%"]`)).not.toBeNull();
  });
});

describe('MoonWidget — edat', () => {
  it('mostra l\'edat rebuda i "--" si no n\'hi ha (no l\'estima a partir de la fase)', () => {
    const { unmount } = renderCard('ca', 8);
    expect(screen.getByText('Dia 8')).toBeTruthy();
    unmount();
    renderCard('ca');
    expect(screen.getByText('Dia --')).toBeTruthy();
  });

  it('les hores de sortida i posta són les del dia local (posta passada mitjanit, +1d)', () => {
    renderCard('ca', 8);
    // Contrastat amb l'USNO: sortida 15:22, cap posta el 18-10 (la següent, el 19-10 a les 00:38).
    expect(screen.getByText('15:22')).toBeTruthy();
    expect(screen.getByText('00:38')).toBeTruthy();
    expect(screen.getByText('+1d')).toBeTruthy();
  });
});
