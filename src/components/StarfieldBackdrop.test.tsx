// src/components/StarfieldBackdrop.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StarfieldBackdrop } from './StarfieldBackdrop';

const circles = (el: Element | null) => ((el as HTMLElement | null)?.style.backgroundImage.match(/%3Ccircle/g) ?? []).length;

describe('StarfieldBackdrop', () => {
  it('les estrelles brillants s\'afegeixen a les de sempre', () => {
    const plain = render(<StarfieldBackdrop density={70} />).container.firstElementChild;
    const withBright = render(<StarfieldBackdrop density={70} bright={7} />).container.firstElementChild;
    expect(circles(plain)).toBeGreaterThan(40);
    // 7 per full de mòbil, repartides en els dos mosaics: 2 + 3.
    expect(circles(withBright) - circles(plain)).toBe(5);
  });

  it('accepta un estil propi (la màscara de la benvinguda) sense perdre el mosaic', () => {
    const el = render(<StarfieldBackdrop style={{ opacity: 0 }} />).container.firstElementChild as HTMLElement;
    expect(el.style.opacity).toBe('0');
    expect(el.style.backgroundImage).toContain('data:image/svg+xml');
  });
});
