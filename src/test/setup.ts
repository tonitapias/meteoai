// src/test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Força la neteja del DOM després de cada test per assegurar
// que un test no afecti al següent (evita "fantasmes" de la UI).
afterEach(() => {
  cleanup();
});